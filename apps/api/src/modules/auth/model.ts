import { Schema, model } from "mongoose";
const refreshSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    family: { type: String, required: true, index: true },
    securityVersion: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
refreshSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshSchema.index({ userId: 1, family: 1, revokedAt: 1 });
export const RefreshToken = model("RefreshToken", refreshSchema);
