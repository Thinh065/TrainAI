import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { ConversationModel } from "@/lib/models/Conversation";
import { getCurrentUser, unauthorized } from "@/lib/server/auth";
import { errorMessage } from "@/lib/utils";

export function pythonApiBase(): string {
  return (
    process.env.PYTHON_API_URL?.replace(/\/$/, "") || "http://localhost:8501"
  );
}

/** Reads a Python API response as JSON, whatever it actually sent back. */
export async function readPythonJson(
  res: Response,
): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: text.slice(0, 300) || `HTTP ${res.status}` };
  }
}

export function pythonErrorMessage(
  data: Record<string, unknown>,
  fallback: string,
): string {
  return typeof data.error === "string" && data.error ? data.error : fallback;
}

/** fetch() to the Python API, with a readable error when it is not running. */
export async function fetchPython(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  // Shared secret: the Python API trusts the user id it is sent, so only we may call it.
  if (process.env.INTERNAL_API_KEY) {
    headers.set("X-Internal-Key", process.env.INTERNAL_API_KEY);
  }
  try {
    return await fetch(`${pythonApiBase()}${path}`, { ...init, headers });
  } catch {
    throw new Error(
      `Không kết nối được máy chủ Python (${pythonApiBase()}). Hãy chạy app/server.py.`,
    );
  }
}

/** Whether the conversation exists and belongs to this user. */
export async function ownsConversation(
  userId: mongoose.Types.ObjectId,
  conversationId: string,
): Promise<boolean> {
  if (!mongoose.isValidObjectId(conversationId)) return false;
  await connectDB();
  return Boolean(await ConversationModel.exists({ _id: conversationId, userId }));
}

export function conversationNotFound(): NextResponse {
  return NextResponse.json(
    { error: "Không tìm thấy cuộc trò chuyện" },
    { status: 404 },
  );
}

/**
 * Forwards a call to the Python API for the current user and relays its JSON.
 * `buildPath` gets the user id; errors come back as `{ error }` with a status.
 * The conversation is checked to belong to the user before anything is sent.
 */
export async function proxyToPython(
  conversationId: string,
  buildPath: (userId: string) => string,
  fallbackError: string,
  init?: (userId: string) => RequestInit,
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!(await ownsConversation(user._id, conversationId))) {
      return conversationNotFound();
    }
    const userId = user._id.toString();
    const res = await fetchPython(buildPath(userId), init?.(userId));
    const data = await readPythonJson(res);
    if (!res.ok) {
      return NextResponse.json(
        { error: pythonErrorMessage(data, fallbackError) },
        { status: res.status },
      );
    }
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: errorMessage(e, fallbackError) },
      { status: 502 },
    );
  }
}
