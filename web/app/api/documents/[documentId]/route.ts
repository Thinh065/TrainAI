import { NextResponse } from "next/server";
import { proxyToPython } from "@/lib/server/python-api";

type RouteContext = { params: Promise<{ documentId: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  const conversationId = new URL(request.url).searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json(
      { error: "conversationId is required" },
      { status: 400 },
    );
  }
  const { documentId } = await context.params;

  return proxyToPython(
    conversationId,
    (userId) =>
      `/api/conversations/${encodeURIComponent(conversationId)}/files/${encodeURIComponent(documentId)}?user_id=${encodeURIComponent(userId)}`,
    "Không xóa được PDF",
    () => ({ method: "DELETE" }),
  );
}
