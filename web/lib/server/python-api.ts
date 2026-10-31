import { NextResponse } from "next/server";
import { getDefaultUser } from "@/lib/server/default-user";
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
  try {
    return await fetch(`${pythonApiBase()}${path}`, init);
  } catch {
    throw new Error(
      `Không kết nối được máy chủ Python (${pythonApiBase()}). Hãy chạy app/server.py.`,
    );
  }
}

/**
 * Forwards a call to the Python API for the current user and relays its JSON.
 * `buildPath` gets the user id; errors come back as `{ error }` with a status.
 */
export async function proxyToPython(
  buildPath: (userId: string) => string,
  fallbackError: string,
  init?: (userId: string) => RequestInit,
): Promise<NextResponse> {
  try {
    const userId = (await getDefaultUser())._id.toString();
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
