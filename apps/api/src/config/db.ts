import mongoose from "mongoose";
import { env } from "./env";
import { User } from "../modules/users/model";
import { RefreshToken } from "../modules/auth/model";
export async function connectDatabase() {
  await mongoose.connect(env.MONGODB_URI);
  await Promise.all([User.init(), RefreshToken.init()]);
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
  if (!hello.setName) {
    await mongoose.disconnect();
    throw new Error("MongoDB phải chạy replica set để bảo đảm transaction.");
  }
}
