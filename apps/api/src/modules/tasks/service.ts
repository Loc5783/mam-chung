import { user, shared, missing } from "./access";
import { ensureInbox, listAccess, appendTaskPosition } from "./lists";
import { ClientSession } from "mongoose";
import { inTransaction } from "../../utils/transaction";
import { AppError } from "../../utils/AppError";
import { localDateParts, validDateOnly } from "../../utils/dates";
import { calendarDate, nextOccurrence } from "../planning/service";
import { User } from "../users/model";
import { CoupleMember, CoupleActivity } from "../couples/models";
import { objectId } from "../finance/schema";
import { Task, TaskComment, TaskList } from "./models";
import * as schema from "./schema";
export async function task(
  userId: string,
  id: string,
  s: ClientSession,
  write = false,
) {
  const u = await user(userId, s, write);
  const t = await Task.findOne({ _id: id, deletedAt: null }).session(s);
  if (!t) throw missing();
  let readOnly = false;
  if (t.coupleId) {
    const c = await shared(userId, t.coupleId.toString(), s, write);
    if (write && u.coupleId?.toString() !== c.id) throw missing();
    readOnly = c.status !== "active";
  } else if (t.createdBy.toString() !== userId) throw missing();
  if (t.listId) {
    const container = await listAccess(userId, t.listId.toString(), s, write);
    readOnly = readOnly || container.readOnly;
  }
  return { u, t, readOnly };
}
type RecordTask = InstanceType<typeof Task>;
export const dto = (t: RecordTask, readOnly = false) => ({
  id: t.id as string,
  listId: t.listId?.toString() ?? null,
  position: t.position ?? null,
  startDate: t.startDate ?? null,
  deadlineHasTime: t.deadlineHasTime ?? false,
  deadlineTime: t.deadlineTime ?? null,
  deadlineTimezone: t.deadlineTimezone ?? null,
  reminderAt: t.reminderAt ?? null,
  estimateMinutes: t.estimateMinutes ?? null,
  timeSpentSeconds: t.timeSpentSeconds ?? 0,
  completedBy: t.completedBy?.toString() ?? null,
  title: t.title,
  description: t.description,
  deadline: t.deadline,
  priority: t.priority,
  status: t.status,
  assignedTo: t.assignedTo?.toString() ?? null,
  createdBy: t.createdBy.toString(),
  creatorName: t.creatorName,
  coupleId: t.coupleId?.toString() ?? null,
  kind: t.kind,
  labels: t.labels,
  checklist: t.checklist.map((i) => ({ id: i.id, text: i.text, done: i.done })),
  recurrence: t.recurrence,
  completedAt: t.completedAt,
  sourceTaskId: t.sourceTaskId?.toString() ?? null,
  revision: t.revision,
  createdAt: t.createdAt,
  readOnly,
});
export async function event(
  t: RecordTask,
  u: Awaited<ReturnType<typeof user>>,
  message: string,
  s: ClientSession,
) {
  if (t.coupleId)
    await CoupleActivity.create(
      [
        {
          coupleId: t.coupleId,
          actorId: u._id,
          actorName: u.name,
          type: "tasks",
          message: `${u.name} ${message}`,
        },
      ],
      { session: s },
    );
}
export async function validateAssignment(
  t: { coupleId?: unknown; assignedTo?: unknown },
  id: string,
  s: ClientSession,
) {
  if (!t.assignedTo) return;
  if (!t.coupleId) {
    if (String(t.assignedTo) !== id)
      throw new AppError(
        400,
        "INVALID_ASSIGNEE",
        "Việc cá nhân chỉ giao cho chính bạn.",
      );
  } else {
    const m = await CoupleMember.findOne({
      coupleId: t.coupleId,
      userId: t.assignedTo,
      active: true,
      deletedAt: null,
    }).session(s);
    if (!m)
      throw new AppError(
        400,
        "INVALID_ASSIGNEE",
        "Người thực hiện phải là thành viên hiện tại.",
      );
  }
}
export function revision(t: RecordTask, value: number) {
  if (t.revision !== value)
    throw new AppError(
      409,
      "TASK_CHANGED",
      "Công việc đã được người khác cập nhật. Tải lại trước khi sửa.",
    );
}
export function validateRecurrence(t: {
  recurrence: string;
  deadline?: string | null;
}) {
  if (t.recurrence !== "none" && !t.deadline)
    throw new AppError(400, "DEADLINE_REQUIRED", "Việc lặp lại cần hạn chót.");
}
export async function change(
  t: RecordTask,
  value: RecordTask["status"],
  s: ClientSession,
  actorId: string,
) {
  if (t.status === value) return;
  t.status = value;
  if (value !== "DONE") {
    t.completedAt = null;
    t.completedBy = null;
    return;
  }
  t.completedAt = new Date();
  t.set("completedBy", actorId);
  if (t.recurrence === "none") return;
  validateRecurrence(t);
  if (await Task.exists({ sourceTaskId: t._id }).session(s)) return;
  const date = t.deadline!;
  const [year, month, day] = date.split("-").map(Number);
  const next =
    t.recurrence === "daily"
      ? calendarDate(year, month, day + 1)
          .toISOString()
          .slice(0, 10)
      : nextOccurrence(date, t.recurrence, t.anchorDay!);
  if (!validDateOnly(next))
    throw new AppError(400, "DATE_RANGE", "Ngày kế tiếp vượt giới hạn hỗ trợ.");
  await Task.create(
    [
      {
        listId: t.listId,
        position: await appendTaskPosition(t.listId?.toString() ?? null, s),
        startDate: null,
        deadlineHasTime: t.deadlineHasTime,
        deadlineTime: t.deadlineTime,
        deadlineTimezone: t.deadlineTimezone,
        estimateMinutes: t.estimateMinutes,
        title: t.title,
        description: t.description,
        deadline: next,
        priority: t.priority,
        status: "TODO",
        createdBy: t.createdBy,
        creatorName: t.creatorName,
        coupleId: t.coupleId,
        assignedTo: t.assignedTo,
        kind: t.kind,
        labels: t.labels,
        checklist: t.checklist.map((i) => ({
          id: i.id,
          text: i.text,
          done: false,
        })),
        recurrence: t.recurrence,
        anchorDay: t.anchorDay,
        sourceTaskId: t._id,
      },
    ],
    { session: s },
  );
}
export function validateTaskDates(t: {
  startDate?: string | null;
  deadline?: string | null;
  deadlineHasTime?: boolean;
  deadlineTime?: string | null;
  deadlineTimezone?: string | null;
  reminderAt?: unknown;
}) {
  if (t.startDate && t.deadline && t.startDate > t.deadline)
    throw new AppError(
      400,
      "INVALID_DATES",
      "Ngày bắt đầu phải trước hoặc bằng hạn chót.",
    );
  if (
    t.deadlineHasTime &&
    (!t.deadline || !t.deadlineTime || !t.deadlineTimezone)
  )
    throw new AppError(
      400,
      "DEADLINE_TIME_REQUIRED",
      "Hạn có giờ cần ngày, giờ và múi giờ.",
    );
  if (!t.deadlineHasTime && t.deadlineTime)
    throw new AppError(
      400,
      "INVALID_DEADLINE_TIME",
      "Bật hạn có giờ để lưu giờ hạn.",
    );
}
export const taskService = {
  async create(id: string, raw: unknown) {
    const input = schema.create.parse(raw);
    return inTransaction(async (s) => {
      const u = await user(id, s, true);
      let coupleId: string | null = null;
      if (input.scope === "shared") {
        coupleId = u.coupleId?.toString() ?? null;
        if (!coupleId) throw missing();
        await shared(id, coupleId, s, true);
      }
      const { scope: _, ...fields } = input;
      void _;
      const list = fields.listId
        ? (await listAccess(id, fields.listId, s, true)).list
        : await ensureInbox(coupleId ? { coupleId } : { ownerId: id }, s);
      if ((list.coupleId?.toString() ?? null) !== coupleId) throw missing();
      validateTaskDates({
        ...fields,
        deadlineTimezone: fields.deadlineTimezone ?? u.timezone,
      });
      validateRecurrence(fields);
      await validateAssignment({ ...fields, coupleId }, id, s);
      const [t] = await Task.create(
        [
          {
            ...fields,
            listId: list._id,
            position: await appendTaskPosition(list.id, s),
            deadlineTimezone: fields.deadlineHasTime
              ? (fields.deadlineTimezone ?? u.timezone)
              : null,
            coupleId,
            createdBy: id,
            creatorName: u.name,
            anchorDay: fields.deadline
              ? Number(fields.deadline.slice(8))
              : null,
          },
        ],
        { session: s },
      );
      await event(t, u, "đã tạo một công việc chung.", s);
      return dto(t);
    });
  },
  async list(id: string, raw: unknown) {
    const q = schema.query.parse(raw);
    return inTransaction(async (s) => {
      const u = await user(id, s);
      const sharedId = q.coupleId ?? u.coupleId?.toString();
      let readOnly = false;
      if (q.coupleId) {
        const c = await shared(id, q.coupleId, s);
        readOnly = c.status !== "active";
      } else if (sharedId) {
        await shared(id, sharedId, s);
      }
      const clauses: Record<string, unknown>[] = [];
      if (q.coupleId || q.scope === "shared") {
        if (!sharedId) throw missing();
        clauses.push({ coupleId: sharedId });
      } else if (q.scope === "personal")
        clauses.push({ coupleId: null, createdBy: id });
      else {
        clauses.push({
          $or: [
            { coupleId: null, createdBy: id },
            ...(sharedId ? [{ coupleId: sharedId }] : []),
          ],
        });
      }
      if (q.scope === "mine") clauses.push({ assignedTo: id });
      if (q.list) {
        const container = await listAccess(id, q.list, s);
        readOnly = readOnly || container.readOnly;
        clauses.push({ listId: q.list });
      }
      if (q.assignee) clauses.push({ assignedTo: q.assignee });
      if (q.smart) {
        const p = localDateParts(new Date(), u.timezone);
        const today = calendarDate(p.year, p.month, p.day)
          .toISOString()
          .slice(0, 10);
        const week = calendarDate(p.year, p.month, p.day + 7)
          .toISOString()
          .slice(0, 10);
        if (q.smart === "today") clauses.push({ deadline: today });
        if (q.smart === "upcoming")
          clauses.push({ deadline: { $gt: today, $lte: week } });
        if (q.smart === "overdue")
          clauses.push({ deadline: { $ne: null, $lt: today } });
        if (q.smart === "mine") clauses.push({ assignedTo: id });
        if (q.smart === "partner")
          clauses.push({
            coupleId: sharedId ?? null,
            assignedTo: { $ne: id, $exists: true, $nin: [null] },
          });
        if (q.smart === "shared")
          clauses.push({ coupleId: sharedId ?? { $exists: false } });
        if (q.smart === "nodate") clauses.push({ deadline: null });
        clauses.push({
          status: q.smart === "done" ? "DONE" : { $nin: ["DONE", "CANCELLED"] },
        });
      }
      if (q.status) clauses.push({ status: q.status });
      if (q.priority) clauses.push({ priority: q.priority });
      if (q.kind) clauses.push({ kind: q.kind });
      if (q.label) clauses.push({ labels: q.label });
      if (q.from || q.to)
        clauses.push({
          deadline: {
            ...(q.from ? { $gte: q.from } : {}),
            ...(q.to ? { $lte: q.to } : {}),
          },
        });
      if (q.due) {
        const p = localDateParts(new Date(), u.timezone);
        const today = calendarDate(p.year, p.month, p.day)
          .toISOString()
          .slice(0, 10);
        clauses.push({
          deadline: q.due === "today" ? today : { $ne: null, $lt: today },
          status: { $nin: ["DONE", "CANCELLED"] },
        });
      }
      const search = q.q ?? q.search;
      if (search) {
        const pattern = [...search]
          .map((char) =>
            ".*+?^${}()|[]\\".includes(char) ? "\\" + char : char,
          )
          .join("");
        clauses.push({
          $or: [
            { title: { $regex: pattern, $options: "i" } },
            { description: { $regex: pattern, $options: "i" } },
            { labels: { $regex: pattern, $options: "i" } },
          ],
        });
      }
      const filter = { deletedAt: null, $and: clauses };
      const sort: Record<string, 1 | -1> =
        q.sort === "oldest"
          ? { createdAt: 1, _id: 1 }
          : q.sort === "newest"
            ? { createdAt: -1, _id: 1 }
            : q.sort === "manual"
              ? { listId: 1, position: 1, _id: 1 }
              : q.sort === "priority"
                ? { priorityRank: 1, createdAt: -1, _id: 1 }
                : { noDeadline: 1, deadline: 1, createdAt: -1, _id: 1 };
      const total = await Task.countDocuments(filter).session(s);
      const rows = await Task.aggregate([
        { $match: Task.find(filter).cast(Task) },
        {
          $addFields: {
            noDeadline: {
              $cond: [{ $eq: [{ $ifNull: ["$deadline", null] }, null] }, 1, 0],
            },
            priorityRank: {
              $indexOfArray: [["URGENT", "HIGH", "MEDIUM", "LOW"], "$priority"],
            },
          },
        },
        { $sort: sort },
        { $skip: (q.page - 1) * q.limit },
        { $limit: q.limit },
      ]).session(s);
      const listIds = rows.flatMap((r) => (r.listId ? [r.listId] : []));
      const archived = await TaskList.find({
        _id: { $in: listIds },
        archivedAt: { $ne: null },
      }).session(s);
      const archiveIds = new Set(archived.map((l) => l.id));
      const items = rows.map((row) =>
        dto(Task.hydrate(row), readOnly || archiveIds.has(String(row.listId))),
      );
      const groups = q.groupBy
        ? Object.entries(
            items.reduce<Record<string, string[]>>((acc, t) => {
              const key =
                q.groupBy === "list"
                  ? (t.listId ?? "inbox")
                  : q.groupBy === "priority"
                    ? t.priority
                    : q.groupBy === "assignee"
                      ? (t.assignedTo ?? "unassigned")
                      : (t.deadline ?? "nodate");
              (acc[key] ??= []).push(t.id);
              return acc;
            }, {}),
          ).map(([key, taskIds]) => ({ key, taskIds }))
        : undefined;
      return {
        items,
        total,
        page: q.page,
        limit: q.limit,
        readOnly,
        ...(groups ? { groups } : {}),
      };
    });
  },
  async get(id: string, rawId: unknown) {
    const key = objectId.parse(rawId);
    return inTransaction(async (s) => {
      const c = await task(id, key, s);
      return dto(c.t, c.readOnly);
    });
  },
  async update(id: string, rawId: unknown, raw: unknown) {
    const key = objectId.parse(rawId),
      input = schema.update.parse(raw);
    return inTransaction(async (s) => {
      const { t, u } = await task(id, key, s, true);
      revision(t, input.revision);
      const previous = t.deadline;
      const oldAssignee = t.assignedTo?.toString() ?? null;
      const { revision: _, ...fields } = input;
      void _;
      if (fields.listId !== undefined) {
        const target = fields.listId
          ? (await listAccess(id, fields.listId, s, true)).list
          : await ensureInbox(
              t.coupleId
                ? { coupleId: t.coupleId.toString() }
                : { ownerId: id },
              s,
            );
        if (
          (target.coupleId?.toString() ?? null) !==
          (t.coupleId?.toString() ?? null)
        )
          throw missing();
        if (target.id !== t.listId?.toString())
          t.position = await appendTaskPosition(target.id, s);
        fields.listId = target.id;
      }
      Object.assign(t, fields);
      if (t.deadlineHasTime && !t.deadlineTimezone)
        t.deadlineTimezone = u.timezone;
      validateTaskDates(t);
      validateRecurrence(t);
      await validateAssignment(t, id, s);
      if ((t.assignedTo?.toString() ?? null) !== oldAssignee)
        t.assignmentVersion = (t.assignmentVersion ?? 0) + 1;
      if (t.deadline !== previous)
        t.anchorDay = t.deadline ? Number(t.deadline.slice(8)) : null;
      t.revision++;
      await t.save({ session: s });
      await event(t, u, "đã sửa một công việc chung.", s);
      return dto(t);
    });
  },
  async status(id: string, rawId: unknown, raw: unknown) {
    const key = objectId.parse(rawId),
      input = schema.changeStatus.parse(raw);
    return inTransaction(async (s) => {
      const { t, u } = await task(id, key, s, true);
      revision(t, input.revision);
      if (t.status !== input.status) {
        await change(t, input.status, s, id);
        t.revision++;
        await t.save({ session: s });
        await event(t, u, "đã đổi trạng thái công việc chung.", s);
      }
      return dto(t);
    });
  },
  async remove(id: string, rawId: unknown, raw: unknown) {
    const key = objectId.parse(rawId),
      input = schema.remove.parse(raw);
    await inTransaction(async (s) => {
      const { t, u } = await task(id, key, s, true);
      revision(t, input.revision);
      t.deletedAt = new Date();
      t.revision++;
      await t.save({ session: s });
      await event(t, u, "đã xóa một công việc chung.", s);
    });
  },
  async comments(id: string, rawId: unknown, raw: unknown) {
    const key = objectId.parse(rawId),
      q = schema.commentsQuery.parse(raw);
    return inTransaction(async (s) => {
      const { t, readOnly } = await task(id, key, s);
      if (!t.coupleId)
        throw new AppError(
          400,
          "SHARED_ONLY",
          "Bình luận chỉ dành cho công việc chung.",
        );
      const filter = { taskId: key, coupleId: t.coupleId };
      const total = await TaskComment.countDocuments(filter).session(s);
      const rows = await TaskComment.find(filter)
        .sort({ createdAt: 1, _id: 1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .session(s);
      return {
        items: rows.map((r) => ({
          id: r.id,
          text: r.text,
          userId: r.userId.toString(),
          authorName: r.authorName,
          createdAt: r.createdAt,
        })),
        total,
        page: q.page,
        limit: q.limit,
        readOnly,
      };
    });
  },
  async comment(id: string, rawId: unknown, raw: unknown) {
    const key = objectId.parse(rawId),
      input = schema.comment.parse(raw);
    return inTransaction(async (s) => {
      const { t, u } = await task(id, key, s, true);
      if (!t.coupleId)
        throw new AppError(
          400,
          "SHARED_ONLY",
          "Bình luận chỉ dành cho công việc chung.",
        );
      const [r] = await TaskComment.create(
        [
          {
            taskId: key,
            coupleId: t.coupleId,
            userId: id,
            authorName: u.name,
            text: input.text,
          },
        ],
        { session: s },
      );
      await event(t, u, "đã bình luận trên công việc chung.", s);
      return {
        id: r.id,
        text: r.text,
        userId: id,
        authorName: r.authorName,
        createdAt: r.createdAt,
      };
    });
  },
  async members(id: string, raw: unknown) {
    const q = schema.readQuery.parse(raw);
    return inTransaction(async (s) => {
      const u = await user(id, s);
      const cid = q.coupleId ?? u.coupleId?.toString();
      if (!cid) return { items: [], readOnly: false };
      const c = await shared(id, cid, s);
      const ms = await CoupleMember.find({
        coupleId: cid,
        deletedAt: null,
      }).session(s);
      const items = [];
      for (const m of ms) {
        const live =
          c.status === "active"
            ? await User.findOne({ _id: m.userId, deletedAt: null }).session(s)
            : null;
        items.push({
          id: m.userId.toString(),
          name: live?.name ?? m.nameSnapshot,
        });
      }
      return { items, readOnly: c.status !== "active" };
    });
  },
};
