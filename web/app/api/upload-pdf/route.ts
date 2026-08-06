import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json(
      { error: "conversationId query parameter is required" },
      { status: 400 },
    );
  }

  const pythonBase = process.env.PYTHON_API_URL?.replace(/\/$/, "");
  if (!pythonBase) {
    return NextResponse.json(
      { error: "PYTHON_API_URL is not configured" },
      { status: 500 },
    );
  }

  const formData = await request.formData();
  const userId = formData.get("user_id")?.toString() || "";
  if (!userId) {
    return NextResponse.json(
      { error: "user_id is required" },
      { status: 400 },
    );
  }

  if (!formData.has("file")) {
    return NextResponse.json(
      { error: "No file uploaded" },
      { status: 400 },
    );
  }

  const proxyUrl = `${pythonBase}/api/conversations/${encodeURIComponent(
    conversationId,
  )}/files`;
  const proxyResponse = await fetch(proxyUrl, {
    method: "POST",
    body: formData,
  });

  const responseBody = await proxyResponse.text();
  const contentType = proxyResponse.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? JSON.parse(responseBody) : { message: responseBody };

  return NextResponse.json(body, { status: proxyResponse.status });
}
