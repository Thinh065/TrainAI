import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";
import { hashPassword, setSessionCookie } from "@/lib/server/auth";
import { serializeUser } from "@/lib/server/serialize";
import { errorMessage } from "@/lib/utils";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      email?: string;
      password?: string;
    };
    const name = body.name?.trim() ?? "";
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";

    if (!name || name.length > 60) {
      return NextResponse.json({ error: "Hãy nhập tên (tối đa 60 ký tự)" }, { status: 400 });
    }
    if (!EMAIL.test(email)) {
      return NextResponse.json({ error: "Email không hợp lệ" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Mật khẩu cần ít nhất 8 ký tự" }, { status: 400 });
    }

    await connectDB();
    if (await UserModel.exists({ email })) {
      return NextResponse.json(
        { error: "Email này đã có tài khoản. Hãy đăng nhập." },
        { status: 409 },
      );
    }

    const user = await UserModel.create({
      name,
      email,
      passwordHash: await hashPassword(password),
    });

    return setSessionCookie(
      NextResponse.json(serializeUser(user), { status: 201 }),
      user._id.toString(),
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: errorMessage(e, "Không tạo được tài khoản") },
      { status: 500 },
    );
  }
}
