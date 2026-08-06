import type { Conversation, Message, User } from "@/lib/types";

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof (data as { error?: string }).error === "string"
        ? (data as { error: string }).error
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export async function fetchCurrentUser(): Promise<User> {
  const res = await fetch("/api/user");
  return parseJson<User>(res);
}

export async function fetchConversations(): Promise<Conversation[]> {
  const res = await fetch("/api/conversations");
  const data = await parseJson<{ conversations: Conversation[] }>(res);
  return data.conversations;
}

export async function createConversationApi(
  title = "Cuộc trò chuyện mới",
): Promise<Conversation> {
  const res = await fetch("/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  const data = await parseJson<{ conversation: Conversation }>(res);
  return data.conversation;
}

export async function updateConversationApi(
  id: string,
  title: string,
): Promise<Conversation> {
  const res = await fetch(`/api/conversations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  const data = await parseJson<{ conversation: Conversation }>(res);
  return data.conversation;
}

export async function deleteConversationApi(id: string): Promise<void> {
  const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
  await parseJson<{ ok: boolean }>(res);
}

export async function fetchMessages(
  conversationId: string,
): Promise<Message[]> {
  const res = await fetch(`/api/conversations/${conversationId}/messages`);
  const data = await parseJson<{ messages: Message[] }>(res);
  return data.messages;
}

export async function sendMessageApi(
  conversationId: string,
  content: string,
): Promise<{
  conversation: Conversation;
  userMessage: Message;
  assistantMessage: Message;
}> {
  const res = await fetch(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  return parseJson(res);
}

export async function uploadPdfApi(
  conversationId: string,
  userId: string,
  file: File,
): Promise<{ file_id: string; file_name: string; chunks_indexed: number }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("user_id", userId);

  const res = await fetch(
    `/api/upload-pdf?conversationId=${encodeURIComponent(conversationId)}`,
    {
      method: "POST",
      body: formData,
    },
  );
  return parseJson(res);
}
