const MOCK_REPLY =
  "Đây là phản hồi tạm từ TrainAI. Kết nối PYTHON_API_URL để dùng model Gemini + RAG.";

export async function getAssistantReply(
  question: string,
  userId: string,
  conversationId: string,
): Promise<string> {
  const base = process.env.PYTHON_API_URL?.replace(/\/$/, "");
  if (!base) {
    return MOCK_REPLY;
  }

  try {
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        conversation_id: conversationId,
        message: question,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        typeof err.error === "string" ? err.error : `HTTP ${res.status}`,
      );
    }

    const data = (await res.json()) as { answer?: string };
    if (!data.answer?.trim()) {
      throw new Error("Phản hồi trống từ Python API");
    }
    return data.answer;
  } catch (e) {
    console.error("Python API chat failed:", e);
    return `${MOCK_REPLY}\n\n*(Lỗi khi gọi Python: ${e instanceof Error ? e.message : "unknown"})*`;
  }
}
