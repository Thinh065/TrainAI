import { NextResponse, type NextRequest } from "next/server";

// Only a cheap presence check here; every API route verifies the signed session itself.
const SESSION_COOKIE = "trainai_session";

export function middleware(request: NextRequest) {
  if (!request.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/"] };
