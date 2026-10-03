import { ClientSession, Types } from "mongoose";
import { User } from "./model";
export const userRepository = {
  byId: (id: string, session?: ClientSession) =>
    User.findOne({ _id: id, deletedAt: null })
      .select("+passwordHash")
      .session(session ?? null),
  byEmail: (email: string) =>
    User.findOne({ email, deletedAt: null }).select("+passwordHash"),
  create: (
    data: { email: string; passwordHash: string; name: string },
    session: ClientSession,
  ) => User.create([data], { session }),
  touch: (id: string, version: number, session: ClientSession) =>
    User.findOneAndUpdate(
      { _id: id, securityVersion: version, deletedAt: null },
      { $inc: { sessionRevision: 1 } },
      { new: true, session },
    ).select("+passwordHash"),
  failedLogin: (id: string, version: number, now: Date) => {
    const count = {
      $add: [
        {
          $cond: [
            {
              $and: [
                { $ne: ["$lockUntil", null] },
                { $lte: ["$lockUntil", now] },
              ],
            },
            0,
            { $ifNull: ["$loginAttempts", 0] },
          ],
        },
        1,
      ],
    };
    return User.findOneAndUpdate(
      {
        _id: id,
        securityVersion: version,
        deletedAt: null,
        $or: [{ lockUntil: null }, { lockUntil: { $lte: now } }],
      },
      [
        {
          $set: {
            loginAttempts: count,
            lockUntil: {
              $cond: [
                { $gte: [count, 5] },
                new Date(now.getTime() + 15 * 60 * 1000),
                "$lockUntil",
              ],
            },
          },
        },
      ],
      { new: true },
    );
  },
  resetLogin: (id: string, version: number, session: ClientSession) =>
    User.updateOne(
      { _id: id, securityVersion: version, deletedAt: null },
      { $set: { loginAttempts: 0, lockUntil: null } },
      { session },
    ),
  profile: (
    id: string,
    data: { name?: string; avatar?: string | null; timezone?: string },
  ) =>
    User.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: data },
      { new: true },
    ),
  credentials: (
    id: string,
    version: number,
    passwordHash: string,
    session: ClientSession,
  ) =>
    User.findOneAndUpdate(
      { _id: id, deletedAt: null, securityVersion: version },
      {
        $set: { passwordHash, loginAttempts: 0, lockUntil: null },
        $inc: { securityVersion: 1, sessionRevision: 1 },
      },
      { session, new: true },
    ),
  invalidate: (id: string, session: ClientSession) =>
    User.updateOne(
      { _id: id, deletedAt: null },
      { $inc: { securityVersion: 1, sessionRevision: 1 } },
      { session },
    ),
  remove: (id: string, version: number, session: ClientSession) =>
    User.findOneAndUpdate(
      { _id: id, deletedAt: null, securityVersion: version },
      {
        $set: {
          deletedAt: new Date(),
          name: "Tài khoản đã xóa",
          email: `deleted-${new Types.ObjectId().toString()}@deleted.invalid`,
          avatar: null,
          passwordHash: "deleted",
        },
        $inc: { securityVersion: 1, sessionRevision: 1 },
      },
      { session, new: true },
    ),
};
