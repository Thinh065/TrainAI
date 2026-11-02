import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";
import {
  clearFailedLogins,
  isLockedOut,
  recordFailedLogin,
  setSessionCookie,
  verifyPassword,
} from "@/lib/server/auth";
import { serializeUser } from "@/lib/server/serialize";
import { errorMessage } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";

    if (isLockedOut(email)) {
      return NextResponse.json(
        { error: "Sai quá nhiều lần. Thử lại sau 10 phút." },
        { status: 429 },
      );
    }

    await connectDB();
    const user = email ? await UserModel.findOne({ email }) : null;
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      recordFailedLogin(email);
      // Same message either way, so the form does not reveal which emails exist.
      return NextResponse.json(
        { error: "Email hoặc mật khẩu không đúng" },
        { status: 401 },
      );
    }

    clearFailedLogins(email);
    return setSessionCookie(
      NextResponse.json(serializeUser(user)),
      user._id.toString(),
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: errorMessage(e, "Không đăng nhập được") },
      { status: 500 },
    );
  }
}
