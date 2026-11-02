import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { ConversationModel } from "@/lib/models/Conversation";
import { getCurrentUser, unauthorized } from "@/lib/server/auth";
import {
  fetchPython,
  pythonErrorMessage,
  readPythonJson,
} from "@/lib/server/python-api";
import { errorMessage } from "@/lib/utils";

type RouteContext = { params: Promise<{ id: string }> };

/** Bắt đầu kiểm tra độ nhất quán của bài ở một link; trả jobId để hỏi tiến độ. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { url?: string };
    const url = body.url?.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return NextResponse.json(
        { error: "Hãy dán link bắt đầu bằng http:// hoặc https://" },
        { status: 400 },
      );
    }

    await connectDB();
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (
      !mongoose.isValidObjectId(id) ||
      !(await ConversationModel.exists({ _id: id, userId: user._id }))
    ) {
      return NextResponse.json(
        { error: "Không tìm thấy cuộc trò chuyện" },
        { status: 404 },
      );
    }

    const res = await fetchPython("/api/consistency", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, user_id: user._id.toString() }),
    });
    const data = await readPythonJson(res);
    if (!res.ok) {
      return NextResponse.json(
        { error: pythonErrorMessage(data, "Không bắt đầu kiểm tra được") },
        { status: res.status },
      );
    }
    return NextResponse.json({ jobId: data.job_id }, { status: 202 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: errorMessage(e, "Không bắt đầu kiểm tra được") },
      { status: 502 },
    );
  }
}
