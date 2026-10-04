import { ClientSession } from "mongoose";
import { inTransaction } from "../../utils/transaction";
import { AppError } from "../../utils/AppError";
import { monthBounds } from "../../utils/dates";
import { sumMoney } from "../../utils/money";
import { User } from "../users/model";
import { userRepository } from "../users/repository";
import { Couple, CoupleMember, CoupleInvite } from "../couples/models";
import { Settlement } from "../shared/models";
import { Task } from "../tasks/models";
import { Budget } from "../planning/models";
import { FinancialTransaction, Category } from "../finance/models";
import { objectId } from "../finance/schema";
import { todayInZone, calendarDate } from "../planning/service";
import { Notification, InviteReceipt } from "./models";
import * as z from "./schema";
const missing = () =>
  new AppError(
    404,
    "NOT_FOUND",
    "Không tìm thấy thông báo hoặc bạn không có quyền truy cập.",
  );
type Event = {
  key: string;
  type: (typeof z.types)[number];
  title: string;
  message: string;
  href: string;
  sourceId: string;
  occurredAt: Date;
};
async function sync(id: string, s: ClientSession) {
  const u = await userRepository.byId(id, s);
  if (!u || !(await userRepository.touch(id, u.securityVersion, s)))
    throw missing();
  const now = new Date(),
    today = todayInZone(now, u.timezone),
    tomorrow = calendarDate(
      Number(today.slice(0, 4)),
      Number(today.slice(5, 7)),
      Number(today.slice(8)) + 1,
    )
      .toISOString()
      .slice(0, 10);
  const events: Event[] = [];
  const add = (e: Event) => events.push(e);
  let cid: string | null = null;
  if (
    u.coupleId &&
    (await CoupleMember.exists({
      userId: id,
      coupleId: u.coupleId,
      active: true,
      deletedAt: null,
    }).session(s))
  ) {
    const c = await Couple.findOne({
      _id: u.coupleId,
      status: "active",
      deletedAt: null,
    }).session(s);
    if (c) cid = c.id as string;
  }
  const invites = await CoupleInvite.find({
    deletedAt: null,
    $or: [{ createdBy: id }, { usedBy: id }],
  }).session(s);
  for (const i of invites) {
    if (i.coupleId.toString() !== cid) continue;
    if (
      i.status === "active" &&
      i.expiresAt > now &&
      i.createdBy.toString() === id
    )
      add({
        key: "invite:" + i.id,
        type: "COUPLE_INVITE",
        title: "Lời mời đang chờ",
        message:
          "Mã mời của bạn đang còn hiệu lực. Chia sẻ mã riêng với người bạn muốn ghép đôi.",
        href: "/couple",
        sourceId: i.id as string,
        occurredAt: i.createdAt,
      });
    if (i.status === "used")
      add({
        key: "accepted:" + i.id,
        type: "INVITE_ACCEPTED",
        title: "Đã ghép đôi thành công",
        message: "Lời mời đã được chấp nhận. Không gian chung đã sẵn sàng.",
        href: "/couple",
        sourceId: i.id as string,
        occurredAt: i.usedAt ?? i.updatedAt,
      });
  }
  if (!u.coupleId) {
    const receipts = await InviteReceipt.find({ userId: id }).session(s);
    const pending = await CoupleInvite.find({
      _id: { $in: receipts.map((r) => r.inviteId) },
      status: "active",
      deletedAt: null,
      expiresAt: { $gt: now },
      createdBy: { $ne: id },
    }).session(s);
    for (const i of pending) {
      const c = await Couple.findOne({
        _id: i.coupleId,
        status: "active",
        deletedAt: null,
      }).session(s);
      if (
        !c ||
        (await CoupleMember.countDocuments({
          coupleId: i.coupleId,
          active: true,
          deletedAt: null,
        }).session(s)) >= 2
      )
        continue;
      const host = await User.findOne({
        _id: i.createdBy,
        deletedAt: null,
      }).session(s);
      if (!host) continue;
      add({
        key: "received:" + i.id,
        type: "COUPLE_INVITE",
        title: "Bạn có lời mời ghép đôi",
        message: `${host.name} mời bạn vào “${c.name}”. Mở Không gian chung và nhập lại mã đã nhận để xem/chấp nhận.`,
        href: "/couple",
        sourceId: i.id as string,
        occurredAt: receipts.find((r) => r.inviteId.toString() === i.id)!
          .createdAt,
      });
    }
  }
  if (cid) {
    const debts = await Settlement.find({
      coupleId: cid,
      deletedAt: null,
      status: { $in: ["pending", "pending_confirm"] },
      $or: [{ fromUserId: id }, { toUserId: id }],
    }).session(s);
    for (const r of debts) {
      add({
        key: "debt:" + r.id,
        type: "DEBT_NEW",
        title: "Công nợ chung",
        message: `${r.fromName} cần hoàn ${r.amount.toLocaleString("vi-VN")} ₫ cho ${r.toName}.`,
        href: "/shared?tab=settlements",
        sourceId: r.id as string,
        occurredAt: r.createdAt,
      });
      if (r.status === "pending_confirm" && r.toUserId.toString() === id)
        add({
          key: `confirm:${r.id}:${r.markedAt?.toISOString()}`,
          type: "PAYMENT_CONFIRM",
          title: "Cần xác nhận nhận tiền",
          message: `${r.fromName} đã báo hoàn ${r.amount.toLocaleString("vi-VN")} ₫. Kiểm tra thực tế trước khi xác nhận.`,
          href: "/shared?tab=settlements",
          sourceId: r.id as string,
          occurredAt: r.markedAt ?? r.updatedAt,
        });
    }
  }
  const tasks = await Task.find({
    deletedAt: null,
    status: { $in: ["TODO", "IN_PROGRESS"] },
    $or: [
      { coupleId: null, createdBy: id },
      ...(cid ? [{ coupleId: cid }] : []),
    ],
  }).session(s);
  for (const t of tasks) {
    if (t.assignedTo?.toString() === id && t.createdBy.toString() !== id)
      add({
        key: `assigned:${t.id}:${t.assignmentVersion ?? 0}`,
        type: "TASK_ASSIGNED",
        title: "Bạn được giao công việc",
        message: t.title,
        href: "/tasks",
        sourceId: t.id as string,
        occurredAt: t.updatedAt,
      });
    const responsible = t.assignedTo?.toString() ?? t.createdBy.toString();
    if (responsible === id && t.deadline && t.deadline <= tomorrow)
      add({
        key: `due:${t.id}:${t.deadline}`,
        type: "TASK_DUE",
        title:
          t.deadline < today
            ? "Công việc quá hạn"
            : t.deadline === today
              ? "Công việc đến hạn hôm nay"
              : "Công việc đến hạn ngày mai",
        message: `${t.title} · Hạn ${t.deadline}`,
        href: "/tasks",
        sourceId: t.id as string,
        occurredAt: now,
      });
  }
  const month = monthBounds(now, u.timezone);
  const budgets = await Budget.find({
    userId: id,
    deletedAt: null,
    month: month.month,
  }).session(s);
  for (const b of budgets) {
    const rows = await FinancialTransaction.find({
      userId: id,
      categoryId: b.categoryId,
      deletedAt: null,
      kind: "transaction",
      type: "expense",
      date: { $gte: month.start, $lt: month.end },
    }).session(s);
    const spent = sumMoney(rows.map((r) => r.amount));
    if (spent < b.amount) continue;
    const cat = await Category.findOne({
      _id: b.categoryId,
      deletedAt: null,
    }).session(s);
    add({
      key: `budget:${b.id}:${b.month}`,
      type: "BUDGET_EXCEEDED",
      title: "Ngân sách đã chạm hoặc vượt hạn mức",
      message: `${cat?.name ?? "Danh mục"} · ${b.month}: ${spent.toLocaleString("vi-VN")} / ${b.amount.toLocaleString("vi-VN")} ₫`,
      href: "/finance?tab=budgets",
      sourceId: b.id as string,
      occurredAt: now,
    });
  }
  for (const e of events) {
    const row = await Notification.findOne({
      userId: id,
      eventKey: e.key,
    }).session(s);
    if (!row) {
      await Notification.create(
        [
          {
            userId: id,
            eventKey: e.key,
            type: e.type,
            title: e.title,
            message: e.message,
            href: e.href,
            payload: { sourceId: e.sourceId },
            occurredAt: e.occurredAt,
          },
        ],
        { session: s },
      );
      continue;
    }
    if (!row.active) {
      row.readAt = null;
      row.occurredAt = now;
    }
    row.active = true;
    row.title = e.title;
    row.message = e.message;
    await row.save({ session: s });
  }
  await Notification.updateMany(
    { userId: id, active: true, eventKey: { $nin: events.map((e) => e.key) } },
    { $set: { active: false } },
    { session: s },
  );
}
const dto = (r: InstanceType<typeof Notification>) => ({
  id: r.id as string,
  type: r.type,
  title: r.title,
  message: r.message,
  href: r.href,
  payload: r.payload,
  readAt: r.readAt,
  createdAt: r.occurredAt,
});
export const notificationService = {
  async list(id: string, raw: unknown) {
    const q = z.list.parse(raw);
    return inTransaction(async (s) => {
      await sync(id, s);
      const base = { userId: id, active: true };
      const filter = {
        ...base,
        ...(q.type ? { type: q.type } : {}),
        ...(q.unread === "true"
          ? { readAt: null }
          : q.unread === "false"
            ? { readAt: { $ne: null } }
            : {}),
      };
      const total = await Notification.countDocuments(filter).session(s),
        unreadCount = await Notification.countDocuments({
          ...base,
          readAt: null,
        }).session(s);
      const rows = await Notification.find(filter)
        .sort({ occurredAt: -1, _id: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .session(s);
      return {
        items: rows.map(dto),
        total,
        unreadCount,
        page: q.page,
        limit: q.limit,
      };
    });
  },
  async read(id: string, rawId: unknown, raw: unknown) {
    const key = objectId.parse(rawId);
    z.empty.parse(raw);
    return inTransaction(async (s) => {
      await sync(id, s);
      const row = await Notification.findOne({
        _id: key,
        userId: id,
        active: true,
      }).session(s);
      if (!row) throw missing();
      if (!row.readAt) {
        row.readAt = new Date();
        await row.save({ session: s });
      }
      return dto(row);
    });
  },
  async readAll(id: string, raw: unknown) {
    z.empty.parse(raw);
    return inTransaction(async (s) => {
      await sync(id, s);
      const result = await Notification.updateMany(
        { userId: id, active: true, readAt: null },
        { $set: { readAt: new Date() } },
        { session: s },
      );
      return { updated: result.modifiedCount };
    });
  },
};
