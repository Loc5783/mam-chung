import mongoose from "mongoose";
import { env } from "./env";
export async function connectDatabase() {
  await mongoose.connect(env.MONGODB_URI);
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
  if (!hello.setName) {
    await mongoose.disconnect();
    throw new Error("MongoDB phải chạy replica set để bảo đảm transaction.");
  }
}
