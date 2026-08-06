import { connectDB } from "@/lib/mongodb";
import { UserModel, type UserDocument } from "@/lib/models/User";

export async function getDefaultUser(): Promise<UserDocument> {
  await connectDB();

  const email =
    process.env.DEFAULT_USER_EMAIL?.trim() || "thinh.tran@example.com";
  const name =
    process.env.DEFAULT_USER_NAME?.trim() || "Trần Nhật Thịnh";

  const user = await UserModel.findOneAndUpdate(
    { email },
    { $setOnInsert: { email, name } },
    { new: true, upsert: true },
  );

  if (!user) {
    throw new Error("Không thể khởi tạo user mặc định");
  }

  return user;
}
