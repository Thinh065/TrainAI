import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { ConversationModel } from "@/lib/models/Conversation";
import { MessageModel } from "@/lib/models/Message";
import { getDefaultUser } from "@/lib/server/default-user";
import { serializeConversation } from "@/lib/server/serialize";

type RouteContext = { params: Promise<{ id: string }> };

async function getOwnedConversation(
  id: string,
  userId: mongoose.Types.ObjectId,
) {
  if (!mongoose.isValidObjectId(id)) {
    return null;
  }
  return ConversationModel.findOne({ _id: id, userId });
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await connectDB();
    const user = await getDefaultUser();
    const conv = await getOwnedConversation(id, user._id);

    if (!conv) {
      return NextResponse.json(
        { error: "Không tìm thấy cuộc trò chuyện" },
        { status: 404 },
      );
    }

    const body = (await request.json()) as { title?: string };
    const title = body.title?.trim();
    if (!title) {
      return NextResponse.json(
        { error: "Tiêu đề không hợp lệ" },
        { status: 400 },
      );
    }

    conv.title = title;
    await conv.save();

    return NextResponse.json({ conversation: serializeConversation(conv) });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không cập nhật được" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await connectDB();
    const user = await getDefaultUser();
    const conv = await getOwnedConversation(id, user._id);

    if (!conv) {
      return NextResponse.json(
        { error: "Không tìm thấy cuộc trò chuyện" },
        { status: 404 },
      );
    }

    await MessageModel.deleteMany({ conversationId: conv._id });
    await conv.deleteOne();

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không xóa được" },
      { status: 500 },
    );
  }
}
