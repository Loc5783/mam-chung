import { ClientSession } from "mongoose";
import { RefreshToken } from "./model";
export const tokenRepository = {
  create: (
    data: {
      userId: string;
      tokenHash: string;
      family: string;
      securityVersion: number;
      expiresAt: Date;
    },
    session: ClientSession,
  ) => RefreshToken.create([data], { session }),
  byHash: (tokenHash: string, session: ClientSession) =>
    RefreshToken.findOne({ tokenHash }).session(session),
  consume: (id: string, session: ClientSession) =>
    RefreshToken.findOneAndUpdate(
      {
        _id: id,
        consumedAt: null,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      },
      { $set: { consumedAt: new Date() } },
      { session, new: true },
    ),
  active: (userId: string, family: string) =>
    RefreshToken.exists({
      userId,
      family,
      consumedAt: null,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    }),
  revoke: (userId: string, session?: ClientSession, family?: string) =>
    RefreshToken.updateMany(
      { userId, ...(family ? { family } : {}), revokedAt: null },
      { $set: { revokedAt: new Date() } },
      { ...(session ? { session } : {}) },
    ),
};
