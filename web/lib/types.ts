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

/** A PDF page the answer was built from. */
export interface Source {
  fileId: string;
  fileName: string;
  pageNumber: number;
}

export type IssueSeverity = "high" | "medium" | "low";

export interface ConsistencyIssue {
  severity: IssueSeverity;
  category: string;
  title: string;
  explanation: string;
  locations: { label: string; quote: string }[];
  suggestion: string;
}

/** Kết quả kiểm tra độ nhất quán của một bài từ link. */
export interface ConsistencyReport {
  jobId: string;
  url: string;
  title: string;
  source: string;
  totalSections: number;
  sectionsWithText: number;
  truncated: boolean;
  score: number;
  summary: string;
  issues: ConsistencyIssue[];
  consistentPoints: string[];
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  sources?: Source[];
  report?: ConsistencyReport;
}

export interface Document {
  id: string;
  userId: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
  status: DocumentStatus;
  error?: string;
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
