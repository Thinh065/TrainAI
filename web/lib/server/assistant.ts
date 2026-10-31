import type { Source } from "@/lib/types";
import {
  fetchPython,
  pythonErrorMessage,
  readPythonJson,
} from "@/lib/server/python-api";

export interface AssistantReply {
  answer: string;
  sources: Source[];
}

interface PythonSource {
  file_id?: string;
  file_name?: string;
  page_number?: number;
}

export async function getAssistantReply(
  question: string,
  userId: string,
  conversationId: string,
): Promise<AssistantReply> {
  const res = await fetchPython("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      conversation_id: conversationId,
      message: question,
    }),
  });
  const data = await readPythonJson(res);

  if (!res.ok) {
    throw new Error(pythonErrorMessage(data, `HTTP ${res.status}`));
  }

  const answer = typeof data.answer === "string" ? data.answer.trim() : "";
  if (!answer) {
    throw new Error("Phản hồi trống từ Python API");
  }

  const sources = Array.isArray(data.sources)
    ? (data.sources as PythonSource[]).map((s) => ({
        fileId: String(s.file_id ?? ""),
        fileName: String(s.file_name ?? "PDF"),
        pageNumber: Number(s.page_number) || 0,
      }))
    : [];

  return { answer, sources };
}
