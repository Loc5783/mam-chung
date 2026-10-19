import { Schema, model } from "mongoose";
const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true },
    avatar: { type: String, default: null },
    timezone: { type: String, default: "Asia/Ho_Chi_Minh" },
    coupleId: { type: Schema.Types.ObjectId, default: null },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    disabledAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    securityVersion: { type: Number, default: 0 },
    sessionRevision: { type: Number, default: 0 },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
export const User = model("User", userSchema);
export type UserDocument = InstanceType<typeof User>;
export function publicUser(user: UserDocument) {
  return {
    id: user.id as string,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    timezone: user.timezone,
    coupleId: user.coupleId?.toString() ?? null,
    role: (user.role ?? "user") as "user" | "admin",
    createdAt: user.createdAt,
  };
}
