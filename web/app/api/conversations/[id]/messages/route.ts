import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { ConversationModel } from "@/lib/models/Conversation";
import { MessageModel } from "@/lib/models/Message";
import { getAssistantReply } from "@/lib/server/assistant";
import { getDefaultUser } from "@/lib/server/default-user";
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
    const user = await getDefaultUser();
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

    const body = (await request.json()) as { content?: string };
    const content = body.content?.trim();
    if (!content) {
      return NextResponse.json(
        { error: "Nội dung tin nhắn trống" },
        { status: 400 },
      );
    }

    await connectDB();
    const user = await getDefaultUser();
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

    if (conv.title === "Cuộc trò chuyện mới") {
      conv.title =
        content.slice(0, 48) + (content.length > 48 ? "…" : "");
    }
    conv.updatedAt = new Date();
    await conv.save();

    const userMessage = await MessageModel.create({
      conversationId: conv._id,
      role: "user",
      content,
    });

    const answer = await getAssistantReply(
      content,
      user._id.toString(),
      id,
    );

    const assistantMessage = await MessageModel.create({
      conversationId: conv._id,
      role: "assistant",
      content: answer,
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
