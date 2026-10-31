import { NextResponse } from "next/server";
import { proxyToPython } from "@/lib/server/python-api";

export async function POST(request: Request) {
  const conversationId = new URL(request.url).searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json(
      { error: "conversationId query parameter is required" },
      { status: 400 },
    );
  }

  const file = (await request.formData().catch(() => null))?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Chưa chọn file" }, { status: 400 });
  }

  return proxyToPython(
    () => `/api/conversations/${encodeURIComponent(conversationId)}/files`,
    "Không xử lý được PDF",
    // The owner comes from the server session, never from the browser.
    (userId) => {
      const form = new FormData();
      form.append("file", file, file.name);
      form.append("user_id", userId);
      return { method: "POST", body: form };
    },
  );
}
