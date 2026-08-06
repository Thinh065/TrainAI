import type { ConversationDocument } from "@/lib/models/Conversation";
import type { MessageDocument } from "@/lib/models/Message";
import type { UserDocument } from "@/lib/models/User";
import type { Conversation, Message, User } from "@/lib/types";

export function serializeUser(doc: UserDocument): User {
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    avatar: doc.avatar ?? undefined,
  };
}

export function serializeConversation(doc: ConversationDocument): Conversation {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    title: doc.title,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function serializeMessage(doc: MessageDocument): Message {
  return {
    id: doc._id.toString(),
    conversationId: doc.conversationId.toString(),
    role: doc.role as Message["role"],
    content: doc.content,
    createdAt: doc.createdAt.toISOString(),
  };
}
