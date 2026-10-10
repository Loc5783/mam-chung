import { z } from "zod";
import { inTransaction } from "../../utils/transaction";
import { AppError } from "../../utils/AppError";
import { objectId, pagination } from "../finance/schema";
import { task, dto, revision, event, createTask } from "./service";
import { create, remove } from "./schema";
import { Task, TaskActivity, TaskTimeReceipt, TaskTemplate } from "./models";
import { user, shared, missing } from "./access";
import {
  listAccess,
  createList,
  listCreate,
  ensureInbox,
  appendTaskPosition,
} from "./lists";
import { validDateOnly, zonedDate, localDateParts } from "../../utils/dates";
import { todayInZone } from "../planning/service";
import { Notification } from "../notifications/models";
const blank = z.object({}).strict();
export const timeInput = z
  .object({
    sessionId: z.string().uuid(),
    seconds: z.number().int().min(1).max(86400),
  })
  .strict();
export const templateInput = z
  .object({ name: z.string().trim().min(1).max(80), listId: objectId })
  .strict();
export const applyInput = z
  .object({
    name: z.string().trim().min(1).max(80),
    startDate: z
      .string()
      .refine(validDateOnly, "Ngày không hợp lệ.")
      .optional(),
  })
  .strict();
export const reminderInput = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("off"),
      revision: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      mode: z.literal("before"),
      revision: z.number().int().nonnegative(),
      minutes: z.number().int().min(1).max(525600),
    })
    .strict(),
  z
    .object({
      mode: z.literal("custom"),
      revision: z.number().int().nonnegative(),
      local: z.string().regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/),
    })
    .strict(),
]);
export const scopeInput = z
  .object({
    revision: z.number().int().nonnegative(),
    scope: z.enum(["personal", "shared"]),
  })
  .strict();
const copy = (t: InstanceType<typeof Task>) => ({
  title: t.title,
  description: t.description,
  priority: t.priority,
  labels: [...t.labels],
  checklist: t.checklist.map((i) => ({ text: i.text, done: false })),
  recurrence: t.recurrence,
  estimateMinutes: t.estimateMinutes,
  kind: t.kind,
});
async function templateAccess(
  actor: string,
  id: string,
  s: import("mongoose").ClientSession,
  write = false,
) {
  const u = await user(actor, s, write),
    t = await TaskTemplate.findById(id).session(s);
  if (!t) throw missing();
  if (t.coupleId) {
    const c = await shared(actor, t.coupleId.toString(), s, write);
    if (write && (c.status !== "active" || u.coupleId?.toString() !== c.id))
      throw missing();
    return { t, readOnly: c.status !== "active" };
  }
  if (t.ownerId?.toString() !== actor) throw missing();
  return { t, readOnly: false };
}
export const taskExtras = {
  async scope(actor: string, id: string, raw: unknown) {
    const input = scopeInput.parse(raw);
    return inTransaction(async (s) => {
      const { t, u } = await task(actor, id, s, true);
      revision(t, input.revision);
      const targetShared = input.scope === "shared";
      if (!!t.coupleId === targetShared) return dto(t);
      if (!targetShared && t.createdBy.toString() !== actor)
        throw new AppError(
          403,
          "CREATOR_ONLY",
          "Chỉ người tạo được chuyển việc chung thành cá nhân.",
        );
      let cid: string | null = null;
      if (targetShared) {
        cid = u.coupleId?.toString() ?? null;
        if (!cid) throw missing();
        const couple = await shared(actor, cid, s, true);
        if (couple.status !== "active") throw missing();
      }
      await event(
        t,
        u,
        targetShared
          ? "đã chuyển việc cá nhân thành việc chung."
          : "đã chuyển việc chung thành việc cá nhân.",
        s,
      );
      const list = await ensureInbox(
        cid ? { coupleId: cid } : { ownerId: actor },
        s,
      );
      t.set("coupleId", cid);
      t.listId = list._id;
      t.position = await appendTaskPosition(list.id, s);
      t.set("assignedTo", actor);
      t.assignmentVersion++;
      t.lastNudgedAt = null;
      t.revision++;
      await t.save({ session: s });
      return dto(t);
    });
  },
  async reminder(actor: string, id: string, raw: unknown) {
    const input = reminderInput.parse(raw);
    return inTransaction(async (s) => {
      const { t, u } = await task(actor, id, s, true);
      revision(t, input.revision);
      let instant: Date | null = null;
      if (input.mode !== "off") {
        const local =
          input.mode === "custom"
            ? input.local
            : t.deadline
              ? `${t.deadline}T${t.deadlineHasTime ? t.deadlineTime : "18:00"}`
              : null;
        if (!local || !validDateOnly(local.slice(0, 10)))
          throw new AppError(
            400,
            "DEADLINE_REQUIRED",
            "Chọn ngày nhắc hoặc hạn chót trước.",
          );
        const [year, month, day] = local.slice(0, 10).split("-").map(Number),
          [hour, minute] = local.slice(11).split(":").map(Number),
          zone =
            input.mode === "custom"
              ? u.timezone
              : (t.deadlineTimezone ?? u.timezone);
        instant = new Date(
          zonedDate(year, month, day, zone, hour).getTime() + minute * 60000,
        );
        const actual = localDateParts(instant, zone);
        if (
          actual.year !== year ||
          actual.month !== month ||
          actual.day !== day ||
          actual.hour !== hour ||
          actual.minute !== minute
        )
          throw new AppError(
            400,
            "INVALID_LOCAL_TIME",
            "Giờ này không tồn tại trong múi giờ tài khoản.",
          );
        if (input.mode === "before")
          instant = new Date(instant.getTime() - input.minutes * 60000);
        if (instant.getTime() <= Date.now())
          throw new AppError(
            400,
            "REMINDER_PAST",
            "Thời điểm nhắc phải ở tương lai.",
          );
      }
      t.reminderAt = instant;
      t.revision++;
      await t.save({ session: s });
      await event(
        t,
        u,
        instant ? "đã đặt nhắc hẹn công việc." : "đã tắt nhắc hẹn công việc.",
        s,
      );
      return dto(t);
    });
  },
  async activity(actor: string, id: string, raw: unknown) {
    const q = pagination.parse(raw);
    return inTransaction(async (s) => {
      await task(actor, id, s);
      const rows = await TaskActivity.find({ taskId: id })
        .sort({ createdAt: -1, _id: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .session(s);
      return {
        items: rows.map((r) => ({
          id: r.id,
          actorId: r.actorId.toString(),
          actorName: r.actorName,
          message: r.message,
          createdAt: r.createdAt,
        })),
        total: await TaskActivity.countDocuments({ taskId: id }).session(s),
        page: q.page,
        limit: q.limit,
      };
    });
  },
  async nudge(actor: string, id: string, raw: unknown) {
    blank.parse(raw);
    return inTransaction(async (s) => {
      const { t, u } = await task(actor, id, s, true);
      if (!t.coupleId || !t.assignedTo || t.assignedTo.toString() === actor)
        throw new AppError(
          400,
          "INVALID_NUDGE",
          "Chỉ nhắc nhẹ người ấy trong việc chung đã giao.",
        );
      if (t.status === "DONE" || t.status === "CANCELLED")
        throw new AppError(
          400,
          "TASK_FINISHED",
          "Việc đã kết thúc, không cần nhắc nữa.",
        );
      await shared(t.assignedTo.toString(), t.coupleId.toString(), s, true);
      const now = new Date();
      if (t.lastNudgedAt && now.getTime() - t.lastNudgedAt.getTime() < 3600000)
        throw new AppError(
          429,
          "NUDGE_LIMIT",
          "Mỗi việc chỉ nhắc nhẹ một lần mỗi giờ.",
        );
      t.lastNudgedAt = now;
      await t.save({ session: s });
      await Notification.create(
        [
          {
            userId: t.assignedTo,
            eventKey: `nudge:${t.id}:${now.getTime()}`,
            type: "TASK_NUDGE",
            title: "Một lời nhắc nhẹ 💌",
            message: `${u.name} nhắc bạn: ${t.title}`,
            href: `/tasks?task=${t.id}`,
            payload: { sourceId: t.id },
            occurredAt: now,
          },
        ],
        { session: s },
      );
      await event(t, u, "đã gửi một lời nhắc nhẹ.", s);
      return { sentAt: now };
    });
  },
  async time(actor: string, id: string, raw: unknown) {
    const input = timeInput.parse(raw);
    return inTransaction(async (s) => {
      const { t, u } = await task(actor, id, s, true),
        previous = await TaskTimeReceipt.findOne({
          taskId: id,
          userId: actor,
          sessionId: input.sessionId,
        }).session(s);
      if (previous) {
        if (previous.seconds !== input.seconds)
          throw new AppError(
            409,
            "TIME_CHANGED",
            "Mã lượt tập trung đã dùng với thời lượng khác.",
          );
        return dto(t);
      }
      await TaskTimeReceipt.create([{ taskId: id, userId: actor, ...input }], {
        session: s,
      });
      t.timeSpentSeconds = (t.timeSpentSeconds ?? 0) + input.seconds;
      t.revision++;
      await t.save({ session: s });
      await event(t, u, `đã tập trung ${input.seconds} giây.`, s);
      return dto(t);
    });
  },
  async duplicate(actor: string, id: string, raw: unknown) {
    blank.parse(raw);
    return inTransaction(async (s) => {
      const { t } = await task(actor, id, s, true);
      return createTask(
        actor,
        create.parse({
          ...copy(t),
          title: t.title.slice(0, 150) + " (bản sao)",
          scope: t.coupleId ? "shared" : "personal",
          assignedTo: t.assignedTo?.toString() ?? null,
          listId: t.listId?.toString() ?? null,
          deadline: t.deadline,
          deadlineHasTime: t.deadlineHasTime,
          deadlineTime: t.deadlineTime,
          deadlineTimezone: t.deadlineTimezone,
        }),
        s,
      );
    });
  },
  async promote(actor: string, id: string, subId: string, raw: unknown) {
    const input = remove.parse(raw);
    return inTransaction(async (s) => {
      const { t, u } = await task(actor, id, s, true);
      revision(t, input.revision);
      const item = t.checklist.find((i) => i.id === subId);
      if (!item) throw missing();
      const result = await createTask(
        actor,
        create.parse({
          title: item.text,
          scope: t.coupleId ? "shared" : "personal",
          assignedTo: t.assignedTo?.toString() ?? null,
          listId: t.listId?.toString() ?? null,
          deadline: t.deadline,
        }),
        s,
      );
      t.set(
        "checklist",
        t.checklist.filter((i) => i.id !== subId),
      );
      t.revision++;
      await t.save({ session: s });
      await event(t, u, "đã chuyển một việc con thành việc riêng.", s);
      return { task: dto(t), created: result };
    });
  },
  async templates(actor: string, raw: unknown) {
    const q = pagination.parse(raw);
    return inTransaction(async (s) => {
      const u = await user(actor, s);
      let readOnly = false;
      if (u.coupleId)
        readOnly =
          (await shared(actor, u.coupleId.toString(), s)).status !== "active";
      const filter = {
          $or: [
            { ownerId: actor },
            ...(u.coupleId ? [{ coupleId: u.coupleId }] : []),
          ],
        },
        rows = await TaskTemplate.find(filter)
          .sort({ createdAt: -1 })
          .skip((q.page - 1) * q.limit)
          .limit(q.limit)
          .session(s);
      return {
        items: rows.map((t) => ({
          id: t.id,
          name: t.name,
          type: t.type,
          coupleId: t.coupleId?.toString() ?? null,
          count: t.items.length,
          readOnly: !!t.coupleId && readOnly,
        })),
        total: await TaskTemplate.countDocuments(filter).session(s),
        page: q.page,
        limit: q.limit,
      };
    });
  },
  async saveTemplate(actor: string, raw: unknown) {
    const input = templateInput.parse(raw);
    return inTransaction(async (s) => {
      const { list } = await listAccess(actor, input.listId, s, true),
        rows = await Task.find({
          listId: list._id,
          deletedAt: null,
          status: { $ne: "CANCELLED" },
        })
          .sort({ position: 1, _id: 1 })
          .limit(101)
          .session(s);
      if (rows.length > 100)
        throw new AppError(
          400,
          "TEMPLATE_LIMIT",
          "Mẫu tối đa 100 việc; chia danh sách trước khi lưu.",
        );
      if (!rows.length)
        throw new AppError(
          400,
          "EMPTY_TEMPLATE",
          "Danh sách cần ít nhất một việc.",
        );
      const [t] = await TaskTemplate.create(
        [
          {
            name: input.name,
            ownerId: list.ownerId,
            coupleId: list.coupleId,
            type: list.type,
            items: rows.map(copy),
          },
        ],
        { session: s },
      );
      return { id: t.id, name: t.name };
    });
  },
  async applyTemplate(actor: string, id: string, raw: unknown) {
    const input = applyInput.parse(raw);
    return inTransaction(async (s) => {
      const { t } = await templateAccess(actor, id, s, true),
        u = await user(actor, s, true);
      const date = input.startDate ?? todayInZone(new Date(), u.timezone);
      const list = await createList(
        actor,
        listCreate.parse({
          name: input.name,
          scope: t.coupleId ? "shared" : "personal",
          type: t.type,
        }),
        s,
      );
      const items = [];
      for (const item of t.items) {
        const values = item as Record<string, unknown>;
        items.push(
          await createTask(
            actor,
            create.parse({
              ...values,
              scope: t.coupleId ? "shared" : "personal",
              listId: list.id,
              assignedTo: actor,
              deadline: values.recurrence !== "none" ? date : null,
            }),
            s,
          ),
        );
      }
      return { list, items };
    });
  },
};
