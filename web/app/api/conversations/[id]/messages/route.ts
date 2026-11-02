import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { ConversationModel } from "@/lib/models/Conversation";
import { MessageModel } from "@/lib/models/Message";
import {
  getAssistantReply,
  type AssistantReply,
} from "@/lib/server/assistant";
import { getCurrentUser, unauthorized } from "@/lib/server/auth";
import { errorMessage, shortTitle } from "@/lib/utils";
import {
  serializeConversation,
  serializeMessage,
} from "@/lib/server/serialize";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
    }

    await connectDB();
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const conv = await ConversationModel.findOne({
      _id: id,
      userId: user._id,
    });
    if (!conv) {
      return NextResponse.json(
        { error: "Không tìm thấy cuộc trò chuyện" },
        { status: 404 },
      );
    }

    const docs = await MessageModel.find({ conversationId: conv._id }).sort({
      createdAt: 1,
    });

    return NextResponse.json({
      messages: docs.map((m) => serializeMessage(m)),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không tải được tin nhắn" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      content?: string;
    };
    const content = body.content?.trim();
    if (!content) {
      return NextResponse.json(
        { error: "Nội dung tin nhắn trống" },
        { status: 400 },
      );
    }

    await connectDB();
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const conv = await ConversationModel.findOne({
      _id: id,
      userId: user._id,
    });
    if (!conv) {
      return NextResponse.json(
        { error: "Không tìm thấy cuộc trò chuyện" },
        { status: 404 },
      );
    }

    // Ask first, save after: a failed answer must not leave an orphan question.
    let reply: AssistantReply;
    try {
      // The web app owns the history; Python only reads it for context.
      const recent = await MessageModel.find({ conversationId: conv._id })
        .sort({ createdAt: -1 })
        .limit(8)
        .lean();
      const history = recent
        .reverse()
        .map((m) => ({ role: m.role, content: m.content }));
      reply = await getAssistantReply(
        content,
        user._id.toString(),
        id,
        history,
      );
    } catch (e) {
      console.error("Python API chat failed:", e);
      return NextResponse.json(
        {
          error: errorMessage(e, "Trợ lý không trả lời được"),
        },
        { status: 502 },
      );
    }

    if (conv.title === "Cuộc trò chuyện mới") {
      conv.title = shortTitle(content);
    }
    conv.updatedAt = new Date();
    // The conversation may have been deleted while the answer was being written.
    const { matchedCount } = await ConversationModel.updateOne(
      { _id: conv._id, userId: user._id },
      { $set: { title: conv.title, updatedAt: conv.updatedAt } },
      { timestamps: false },
    );
    if (matchedCount === 0) {
      return NextResponse.json(
        { error: "Cuộc trò chuyện đã bị xóa trong lúc trả lời" },
        { status: 410 },
      );
    }

    const userMessage = await MessageModel.create({
      conversationId: conv._id,
      role: "user",
      content,
    });

    const assistantMessage = await MessageModel.create({
      conversationId: conv._id,
      role: "assistant",
      content: reply.answer,
      sources: reply.sources.length ? reply.sources : undefined,
    });

    return NextResponse.json({
      conversation: serializeConversation(conv),
      userMessage: serializeMessage(userMessage),
      assistantMessage: serializeMessage(assistantMessage),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không gửi được tin nhắn" },
      { status: 500 },
    );
  }
}
