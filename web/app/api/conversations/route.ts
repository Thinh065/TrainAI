import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import {
  ConversationModel,
  type ConversationDocument,
} from "@/lib/models/Conversation";
import { getCurrentUser, unauthorized } from "@/lib/server/auth";
import { serializeConversation } from "@/lib/server/serialize";

export async function GET() {
  try {
    await connectDB();
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const docs = await ConversationModel.find({ userId: user._id })
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({
      conversations: docs.map((d) =>
        serializeConversation(d as unknown as ConversationDocument),
      ),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không tải được hội thoại" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
    };

    const title = body.title?.trim() || "Cuộc trò chuyện mới";

    const doc = await ConversationModel.create({
      userId: user._id,
      title,
    });

    return NextResponse.json(
      { conversation: serializeConversation(doc) },
      { status: 201 },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không tạo được hội thoại" },
      { status: 500 },
    );
  }
}
