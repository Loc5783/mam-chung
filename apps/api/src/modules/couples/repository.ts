import { ClientSession, Types } from "mongoose";
import { Couple, CoupleMember, CoupleInvite, CoupleActivity } from "./models";
export const coupleRepository = {
  member: (userId: string, coupleId: string, session: ClientSession) =>
    CoupleMember.findOne({ userId, coupleId, deletedAt: null }).session(
      session,
    ),
  active: (id: string, session: ClientSession) =>
    Couple.findOne({ _id: id, status: "active", deletedAt: null }).session(
      session,
    ),
  lock: (id: string, session: ClientSession) =>
    Couple.findOneAndUpdate(
      { _id: id, status: "active", deletedAt: null },
      { $inc: { revision: 1 } },
      { new: true, session },
    ),
  members: (id: string, session: ClientSession) =>
    CoupleMember.find({ coupleId: id, deletedAt: null })
      .sort({ createdAt: 1, _id: 1 })
      .session(session),
  invitation: (hash: string, now: Date, session: ClientSession) =>
    CoupleInvite.findOne({
      codeHash: hash,
      status: "active",
      expiresAt: { $gt: now },
      deletedAt: null,
    }).session(session),
  activity: (id: string, page: number, limit: number, session: ClientSession) =>
    CoupleActivity.find({ coupleId: id, deletedAt: null })
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .session(session),
  // Stage 5 settlements must use this collection/status contract. No arbitrary settlement writes here.
  outstanding: (id: string, session: ClientSession) =>
    Couple.db.collection("settlements").countDocuments(
      {
        coupleId: new Types.ObjectId(id),
        deletedAt: null,
        status: { $in: ["unpaid", "pending", "pending_confirm"] },
      },
      { session },
    ),
};
