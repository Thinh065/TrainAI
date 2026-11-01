import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { ConversationModel } from "@/lib/models/Conversation";
import { MessageModel } from "@/lib/models/Message";
import { getDefaultUser } from "@/lib/server/default-user";
import {
  fetchPython,
  pythonErrorMessage,
  readPythonJson,
} from "@/lib/server/python-api";
import {
  serializeConversation,
  serializeMessage,
} from "@/lib/server/serialize";
import type { ConsistencyReport } from "@/lib/types";
import { errorMessage, shortTitle } from "@/lib/utils";

type RouteContext = { params: Promise<{ id: string; jobId: string }> };

interface PythonIssue {
  severity?: string;
  category?: string;
  title?: string;
  explanation?: string;
  locations?: { label?: string; quote?: string }[];
  suggestion?: string;
}

interface PythonReport {
  url?: string;
  title?: string;
  source?: string;
  total_sections?: number;
  sections_with_text?: number;
  truncated?: boolean;
  score?: number;
  summary?: string;
  issues?: PythonIssue[];
  consistent_points?: string[];
}

function toReport(jobId: string, raw: PythonReport): ConsistencyReport {
  return {
    jobId,
    url: raw.url ?? "",
    title: raw.title ?? "Bài kiểm tra",
    source: raw.source ?? "",
    totalSections: raw.total_sections ?? 0,
    sectionsWithText: raw.sections_with_text ?? 0,
    truncated: Boolean(raw.truncated),
    score: raw.score ?? 0,
    summary: raw.summary ?? "",
    issues: (raw.issues ?? []).map((i) => ({
      severity:
        i.severity === "high" || i.severity === "low" ? i.severity : "medium",
      category: i.category ?? "",
      title: i.title ?? "",
      explanation: i.explanation ?? "",
      locations: (i.locations ?? []).map((l) => ({
        label: l.label ?? "",
        quote: l.quote ?? "",
      })),
      suggestion: i.suggestion ?? "",
    })),
    consistentPoints: raw.consistent_points ?? [],
  };
}

/** Plain-text version, kept as the message content (history, search, copy). */
function reportText(report: ConsistencyReport): string {
  const lines = [
    `Độ nhất quán: ${report.score}/100 — ${report.title}`,
    report.summary,
    ...report.issues.map(
      (i, n) =>
        `${n + 1}. ${i.title} (${i.locations.map((l) => l.label).join(", ")})`,
    ),
  ];
  return lines.filter(Boolean).join("\n");
}

/** Tiến độ một lượt kiểm tra; khi xong thì lưu kết quả vào cuộc trò chuyện (một lần). */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id, jobId } = await context.params;
    await connectDB();
    const user = await getDefaultUser();
    const conv = mongoose.isValidObjectId(id)
      ? await ConversationModel.findOne({ _id: id, userId: user._id })
      : null;
    if (!conv) {
      return NextResponse.json(
        { error: "Không tìm thấy cuộc trò chuyện" },
        { status: 404 },
      );
    }

    const saved = await MessageModel.find({
      conversationId: conv._id,
      "report.jobId": jobId,
    });
    if (saved.length > 0) {
      return NextResponse.json({ status: "done", saved: true });
    }

    const res = await fetchPython(
      `/api/consistency/${encodeURIComponent(jobId)}?user_id=${encodeURIComponent(user._id.toString())}`,
    );
    const job = await readPythonJson(res);
    if (!res.ok) {
      return NextResponse.json(
        { error: pythonErrorMessage(job, "Không xem được tiến độ") },
        { status: res.status },
      );
    }
    if (job.status !== "done") {
      return NextResponse.json({
        status: job.status,
        stage: job.stage,
        sections: job.sections,
        title: job.title,
        error: job.error,
      });
    }

    const report = toReport(jobId, job.result as PythonReport);
    const userMessage = await MessageModel.create({
      conversationId: conv._id,
      role: "user",
      content: `Kiểm tra độ nhất quán: ${report.url}`,
    });
    const assistantMessage = await MessageModel.create({
      conversationId: conv._id,
      role: "assistant",
      content: reportText(report),
      report,
    });

    // The chat was created with the raw link as its title; give it the deck's name.
    if (conv.title === "Cuộc trò chuyện mới" || /^(Kiểm tra: )?https?:\/\//.test(conv.title)) {
      conv.title = shortTitle(`Kiểm tra: ${report.title}`);
    }
    conv.updatedAt = new Date();
    await conv.save();

    return NextResponse.json({
      status: "done",
      conversation: serializeConversation(conv),
      userMessage: serializeMessage(userMessage),
      assistantMessage: serializeMessage(assistantMessage),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: errorMessage(e, "Không xem được tiến độ") },
      { status: 502 },
    );
  }
}
