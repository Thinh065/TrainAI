export type MessageRole = "user" | "assistant";

export type DocumentStatus = "uploading" | "processing" | "ready" | "error";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface Document {
  id: string;
  userId: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
  status: DocumentStatus;
}

export type HistoryGroupKey =
  | "today"
  | "yesterday"
  | "previous7Days"
  | "older";

export interface HistoryGroup {
  key: HistoryGroupKey;
  label: string;
  conversations: Conversation[];
}
