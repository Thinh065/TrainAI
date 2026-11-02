import { NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/server/auth";
import {
  conversationNotFound,
  fetchPython,
  ownsConversation,
  pythonErrorMessage,
  readPythonJson,
} from "@/lib/server/python-api";
import type { Document } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

interface PythonFile {
  file_id?: string;
  _id?: string;
  user_id?: string;
  file_name?: string;
  created_at?: string;
}

function normalizeDocument(doc: PythonFile, fallbackUserId: string): Document {
  const createdAt = doc.created_at ? new Date(doc.created_at) : null;
  return {
    id: String(doc.file_id ?? doc._id ?? ""),
    userId: String(doc.user_id ?? fallbackUserId),
    fileName: String(doc.file_name ?? "Tài liệu PDF"),
    fileUrl: "",
    uploadedAt:
      createdAt && !Number.isNaN(createdAt.getTime())
        ? createdAt.toISOString()
        : new Date().toISOString(),
    status: "ready",
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId");

  if (!conversationId) {
    return NextResponse.json(
      { error: "conversationId is required" },
      { status: 400 },
    );
  }

  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!(await ownsConversation(user._id, conversationId))) {
      return conversationNotFound();
    }
    const userId = user._id.toString();
    const res = await fetchPython(
      `/api/conversations/${encodeURIComponent(conversationId)}/files?user_id=${encodeURIComponent(userId)}`,
    );
    const data = await readPythonJson(res);

    if (!res.ok) {
      return NextResponse.json(
        { error: pythonErrorMessage(data, "Không tải được danh sách PDF") },
        { status: res.status },
      );
    }

    const files = Array.isArray(data.files) ? (data.files as PythonFile[]) : [];
    return NextResponse.json({
      documents: files.map((file) => normalizeDocument(file, userId)),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: errorMessage(e, "Không tải được danh sách PDF") },
      { status: 502 },
    );
  }
}
