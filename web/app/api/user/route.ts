import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getCurrentUser, unauthorized } from "@/lib/server/auth";
import { serializeUser } from "@/lib/server/serialize";

export async function GET() {
  try {
    await connectDB();
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    return NextResponse.json(serializeUser(user));
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không tải được user" },
      { status: 500 },
    );
  }
}
