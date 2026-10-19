import { rememberInvitation } from "../notifications/models";
import { ClientSession } from "mongoose";
import { createHash, randomInt } from "crypto";
import { inTransaction } from "../../utils/transaction";
import { AppError } from "../../utils/AppError";
import { User, UserDocument } from "../users/model";
import { userRepository } from "../users/repository";
import {
  Couple,
  CoupleMember,
  CoupleInvite,
  CoupleActivity,
  CoupleRecord,
} from "./models";
import { coupleRepository as repo } from "./repository";
import * as schema from "./schema";
import { AppSettings } from "../admin/models";
import { objectId } from "../finance/schema";
const missing = () =>
  new AppError(
    404,
    "NOT_FOUND",
    "Không tìm thấy không gian chung hoặc mã mời còn hiệu lực.",
  );
const conflict = (code: string, message: string) =>
  new AppError(409, code, message);
const hash = (code: string) => createHash("sha256").update(code).digest("hex");
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newCode() {
  return Array.from(
    { length: 8 },
    () => alphabet[randomInt(alphabet.length)],
  ).join("");
}
export function anniversaryInfo(
  day: string | null,
  zone: string,
  now = new Date(),
) {
  if (!day) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const p = (key: string) => parts.find((v) => v.type === key)!.value;
  const today = `${p("year")}-${p("month")}-${p("day")}`;
  const daysTogether = Math.floor(
    (Date.parse(today + "T00:00:00Z") - Date.parse(day + "T00:00:00Z")) /
      86400000,
  );
  let year = Number(p("year"));
  const annual = (y: number) => {
    const mmdd = day.slice(5);
    return mmdd === "02-29" &&
      !schema.anniversary.safeParse(`${y}-02-29`).success
      ? `${y}-02-28`
      : `${y}-${mmdd}`;
  };
  let next = annual(year);
  if (next < today) next = annual(++year);
  return {
    date: day,
    daysTogether,
    nextDate: next,
    daysUntil: Math.floor(
      (Date.parse(next + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) /
        86400000,
    ),
    isToday: next === today,
  };
}
async function readUser(id: string, session: ClientSession) {
  const u = await userRepository.byId(id, session);
  if (!u) throw missing();
  return u;
}
async function lockUser(id: string, session: ClientSession) {
  const u = await readUser(id, session);
  if (!(await userRepository.touch(id, u.securityVersion, session)))
    throw missing();
  return u;
}
async function activeContext(
  userId: string,
  session: ClientSession,
  lock = false,
) {
  const user = lock
    ? await lockUser(userId, session)
    : await readUser(userId, session);
  if (!user.coupleId) throw missing();
  const id = user.coupleId.toString();
  const couple = lock
    ? await repo.lock(id, session)
    : await repo.active(id, session);
  const member = await repo.member(userId, id, session);
  if (!couple || !member?.active) throw missing();
  return { user, couple, member };
}
function owner(role: string) {
  if (role !== "owner")
    throw new AppError(
      403,
      "OWNER_REQUIRED",
      "Chỉ chủ không gian chung được thực hiện thao tác này.",
    );
}
async function event(
  c: CoupleRecord,
  u: UserDocument,
  type: string,
  message: string,
  session: ClientSession,
) {
  await CoupleActivity.create(
    [{ coupleId: c._id, actorId: u._id, actorName: u.name, type, message }],
    { session },
  );
}
async function dto(
  c: CoupleRecord,
  userId: string,
  zone: string,
  session: ClientSession,
) {
  const members = await repo.members(c.id as string, session);
  const invite = await CoupleInvite.findOne({
    coupleId: c._id,
    status: "active",
    expiresAt: { $gt: new Date() },
    deletedAt: null,
  })
    .sort({ createdAt: -1 })
    .session(session);
  const activeUsers =
    c.status === "active"
      ? await User.find({
          _id: { $in: members.map((m) => m.userId) },
          deletedAt: null,
        }).session(session)
      : [];
  const outstandingCount = await repo.outstanding(c.id as string, session);
  return {
    id: c.id as string,
    name: c.name,
    status: c.status,
    ownerId: c.ownerId.toString(),
    anniversary: c.anniversary,
    anniversaryInfo: anniversaryInfo(c.anniversary ?? null, zone),
    createdAt: c.createdAt,
    archivedAt: c.archivedAt,
    archivedReason: c.archivedReason,
    role: members.find((m) => m.userId.toString() === userId)?.role ?? null,
    members: members.map((m) => {
      const u = activeUsers.find((u) => u.id === m.userId.toString());
      return {
        userId: m.userId.toString(),
        name: u?.name ?? m.nameSnapshot,
        avatar: u?.avatar ?? m.avatarSnapshot,
        role: m.role,
        active: m.active,
        joinedAt: m.createdAt,
        leftAt: m.leftAt,
      };
    }),
    invite: invite
      ? { id: invite.id as string, expiresAt: invite.expiresAt }
      : null,
    outstanding: { count: outstandingCount, summaryAvailable: true },
  };
}
function checkAnniversary(day: string | null | undefined, zone: string) {
  if (day && anniversaryInfo(day, zone)!.daysTogether < 0)
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Ngày bắt đầu không được ở tương lai.",
    );
}
export const coupleService = {
  async create(userId: string, raw: unknown) {
    const input = schema.createSchema.parse(raw);
    const settings = await AppSettings.findOne({ key: "global" });
    if (settings && settings.allowNewCouples === false) {
      throw new AppError(
        403,
        "COUPLE_CREATION_CLOSED",
        "Hiện tại hệ thống tạm ngưng tạo không gian chung mới.",
      );
    }
    return inTransaction(async (session) => {
      const user = await lockUser(userId, session);
      if (
        user.coupleId ||
        (await CoupleMember.exists({ userId, active: true }).session(session))
      )
        throw conflict(
          "COUPLE_ACTIVE",
          "Bạn đã thuộc một không gian chung đang hoạt động.",
        );
      checkAnniversary(input.anniversary, user.timezone);
      const [c] = await Couple.create([{ ...input, ownerId: user._id }], {
        session,
      });
      await CoupleMember.create(
        [
          {
            coupleId: c._id,
            userId: user._id,
            role: "owner",
            nameSnapshot: user.name,
            avatarSnapshot: user.avatar,
          },
        ],
        { session },
      );
      user.coupleId = c._id;
      await user.save({ session });
      await event(
        c,
        user,
        "created",
        `${user.name} đã tạo không gian chung.`,
        session,
      );
      return dto(c, userId, user.timezone, session);
    });
  },
  async me(userId: string) {
    return inTransaction(async (session) => {
      const user = await readUser(userId, session);
      if (!user.coupleId) return { couple: null };
      const { couple } = await activeContext(userId, session);
      return { couple: await dto(couple, userId, user.timezone, session) };
    });
  },
  async update(userId: string, raw: unknown) {
    const input = schema.updateSchema.parse(raw);
    return inTransaction(async (session) => {
      const { user, couple } = await activeContext(userId, session, true);
      checkAnniversary(input.anniversary, user.timezone);
      Object.assign(couple, input);
      await couple.save({ session });
      await event(
        couple,
        user,
        "updated",
        `${user.name} đã cập nhật thông tin hoặc ngày kỷ niệm.`,
        session,
      );
      return dto(couple, userId, user.timezone, session);
    });
  },
  async invite(userId: string) {
    return inTransaction(async (session) => {
      const { user, couple, member } = await activeContext(
        userId,
        session,
        true,
      );
      owner(member.role);
      if (
        (await repo.members(couple.id as string, session)).filter(
          (m) => m.active,
        ).length >= 2
      )
        throw conflict("COUPLE_FULL", "Không gian chung đã có đủ hai người.");
      await CoupleInvite.updateMany(
        { coupleId: couple._id, status: "active" },
        { $set: { status: "revoked" } },
        { session },
      );
      const code = newCode();
      const expiresAt = new Date(Date.now() + 48 * 3600000);
      await CoupleInvite.create(
        [
          {
            coupleId: couple._id,
            createdBy: user._id,
            codeHash: hash(code),
            expiresAt,
          },
        ],
        { session },
      );
      await event(
        couple,
        user,
        "invite_created",
        `${user.name} đã tạo mã mời mới.`,
        session,
      );
      return {
        id: (await CoupleInvite.findOne({ codeHash: hash(code) }).session(
          session,
        ))!.id as string,
        code,
        expiresAt,
        path: `/invite/${code}`,
      };
    });
  },
  async revokeInvite(userId: string) {
    return inTransaction(async (session) => {
      const { user, couple, member } = await activeContext(
        userId,
        session,
        true,
      );
      owner(member.role);
      await CoupleInvite.updateMany(
        { coupleId: couple._id, status: "active" },
        { $set: { status: "revoked" } },
        { session },
      );
      await event(
        couple,
        user,
        "invite_revoked",
        `${user.name} đã thu hồi mã mời.`,
        session,
      );
    });
  },
  async preview(userId: string, raw: unknown) {
    const code = schema.code.parse(raw);
    return inTransaction(async (session) => {
      await lockUser(userId, session);
      const invite = await repo.invitation(hash(code), new Date(), session);
      if (!invite) throw missing();
      const c = await repo.active(invite.coupleId.toString(), session);
      if (!c) throw missing();
      const members = await repo.members(c.id as string, session);
      if (members.filter((m) => m.active).length >= 2) throw missing();
      const inviter = await User.findOne({
        _id: invite.createdBy,
        deletedAt: null,
      }).session(session);
      if (invite.createdBy.toString() !== userId)
        await rememberInvitation(userId, invite.id as string, session);
      return {
        name: c.name,
        inviterName: inviter?.name ?? "Người mời",
        expiresAt: invite.expiresAt,
        isSelf: invite.createdBy.toString() === userId,
      };
    });
  },
  async accept(userId: string, raw: unknown) {
    const { code } = schema.acceptSchema.parse(raw);
    return inTransaction(async (session) => {
      const user = await lockUser(userId, session);
      if (
        user.coupleId ||
        (await CoupleMember.exists({ userId, active: true }).session(session))
      )
        throw conflict(
          "COUPLE_ACTIVE",
          "Hãy rời không gian chung hiện tại trước khi ghép đôi.",
        );
      const invite = await repo.invitation(hash(code), new Date(), session);
      if (!invite) throw missing();
      if (invite.createdBy.toString() === userId)
        throw conflict(
          "SELF_INVITE",
          "Bạn không thể chấp nhận lời mời của mình.",
        );
      const c = await repo.lock(invite.coupleId.toString(), session);
      if (!c) throw missing();
      const members = await repo.members(c.id as string, session);
      if (members.filter((m) => m.active).length >= 2)
        throw conflict("COUPLE_FULL", "Không gian chung đã có đủ hai người.");
      const host = await lockUser(c.ownerId.toString(), session);
      if (host.coupleId?.toString() !== c.id) throw missing();
      await CoupleMember.create(
        [
          {
            coupleId: c._id,
            userId: user._id,
            role: "member",
            nameSnapshot: user.name,
            avatarSnapshot: user.avatar,
          },
        ],
        { session },
      );
      user.coupleId = c._id;
      await user.save({ session });
      invite.status = "used";
      invite.usedBy = user._id;
      invite.usedAt = new Date();
      await invite.save({ session });
      await CoupleInvite.updateMany(
        { coupleId: c._id, status: "active" },
        { $set: { status: "revoked" } },
        { session },
      );
      await event(
        c,
        user,
        "joined",
        `${user.name} đã tham gia không gian chung.`,
        session,
      );
      return dto(c, userId, user.timezone, session);
    });
  },
  async transferOwner(userId: string, raw: unknown) {
    const input = schema.transferSchema.parse(raw);
    return inTransaction(async (session) => {
      const { user, couple, member } = await activeContext(
        userId,
        session,
        true,
      );
      owner(member.role);
      if (input.userId === userId)
        throw conflict("SAME_OWNER", "Hãy chọn thành viên còn lại.");
      const target = await repo.member(
        input.userId,
        couple.id as string,
        session,
      );
      if (!target?.active) throw missing();
      const next = await lockUser(input.userId, session);
      if (next.coupleId?.toString() !== couple.id) throw missing();
      member.role = "member";
      target.role = "owner";
      couple.ownerId = target.userId;
      await member.save({ session });
      await target.save({ session });
      await couple.save({ session });
      await event(
        couple,
        user,
        "owner_transferred",
        `${user.name} đã chuyển quyền chủ không gian cho ${next.name}.`,
        session,
      );
      return dto(couple, userId, user.timezone, session);
    });
  },
  async leave(userId: string, raw: unknown) {
    const input = schema.leaveSchema.parse(raw);
    return inTransaction(async (session) => {
      const { user, couple, member } = await activeContext(
        userId,
        session,
        true,
      );
      const members = await repo.members(couple.id as string, session);
      if (member.role === "owner" && members.filter((m) => m.active).length > 1)
        throw conflict(
          "TRANSFER_OWNER_REQUIRED",
          "Hãy chuyển quyền cho người còn lại trước khi rời.",
        );
      if (member.role === "owner" && !input.dissolve)
        throw conflict(
          "DISSOLVE_REQUIRED",
          "Bạn là người cuối cùng. Hãy xác nhận giải tán không gian chung.",
        );
      if (member.role !== "owner" && input.dissolve)
        throw new AppError(
          403,
          "OWNER_REQUIRED",
          "Thành viên chỉ được rời, không tự giải tán.",
        );
      const outstandingCount = await repo.outstanding(
        couple.id as string,
        session,
      );
      if (outstandingCount && !input.confirmOutstanding)
        throw conflict(
          "OUTSTANDING_SETTLEMENTS",
          "Còn công nợ chưa thanh toán. Xác nhận riêng để lưu trữ lịch sử và công nợ.",
        );
      for (const m of members) {
        const u =
          m.userId.toString() === userId
            ? user
            : await lockUser(m.userId.toString(), session);
        m.nameSnapshot = u.name;
        m.avatarSnapshot = u.avatar;
        m.active = false;
        m.leftAt = new Date();
        u.coupleId = null;
        await u.save({ session });
        await m.save({ session });
      }
      couple.status = "archived";
      couple.archivedAt = new Date();
      couple.archivedReason =
        member.role === "owner" ? "dissolved" : "member_left";
      await couple.save({ session });
      await CoupleInvite.updateMany(
        { coupleId: couple._id, status: "active" },
        { $set: { status: "revoked" } },
        { session },
      );
      await event(
        couple,
        user,
        "archived",
        member.role === "owner"
          ? `${user.name} đã giải tán và lưu trữ không gian chung.`
          : `${user.name} đã rời; hành trình chung được lưu trữ cho cả hai.`,
        session,
      );
      return dto(couple, userId, user.timezone, session);
    });
  },
  async archives(userId: string, raw: unknown) {
    const { page, limit } = schema.listQuery.parse(raw);
    return inTransaction(async (session) => {
      const user = await readUser(userId, session);
      const memberships = await CoupleMember.find({
        userId,
        active: false,
        deletedAt: null,
      }).session(session);
      const filter = {
        _id: { $in: memberships.map((m) => m.coupleId) },
        status: "archived",
        deletedAt: null,
      };
      const total = await Couple.countDocuments(filter).session(session);
      const items = await Couple.find(filter)
        .sort({ archivedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .session(session);
      return {
        items: await (async () => {
          const results = [];
          for (const c of items)
            results.push(await dto(c, userId, user.timezone, session));
          return results;
        })(),
        total,
        page,
        limit,
      };
    });
  },
  async archived(userId: string, rawId: unknown) {
    const id = objectId.parse(rawId);
    return inTransaction(async (session) => {
      const u = await readUser(userId, session);
      const m = await repo.member(userId, id, session);
      const c = await Couple.findOne({
        _id: id,
        status: "archived",
        deletedAt: null,
      }).session(session);
      if (!m || !c) throw missing();
      return dto(c, userId, u.timezone, session);
    });
  },
  async activity(userId: string, raw: unknown) {
    const { coupleId, page, limit } = schema.activityQuery.parse(raw);
    return inTransaction(async (session) => {
      const u = await readUser(userId, session);
      const id = coupleId ?? u.coupleId?.toString();
      if (!id || !(await repo.member(userId, id, session))) throw missing();
      const c = await Couple.findOne({ _id: id, deletedAt: null }).session(
        session,
      );
      if (!c) throw missing();
      const items = await repo.activity(id, page, limit, session);
      return {
        items: items.map((a) => ({
          id: a.id as string,
          type: a.type,
          actorName: a.actorName,
          message: a.message,
          createdAt: a.createdAt,
        })),
        total: await CoupleActivity.countDocuments({
          coupleId: id,
          deletedAt: null,
        }).session(session),
        page,
        limit,
      };
    });
  },
  async requireActive(userId: string) {
    return inTransaction(async (session) => {
      const { couple } = await activeContext(userId, session);
      return couple.id as string;
    });
  },
};
