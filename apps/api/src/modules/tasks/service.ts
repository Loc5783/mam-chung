import { ClientSession } from "mongoose";
import { inTransaction } from "../../utils/transaction";
import { AppError } from "../../utils/AppError";
import { localDateParts, validDateOnly } from "../../utils/dates";
import { calendarDate, nextOccurrence } from "../planning/service";
import { userRepository } from "../users/repository";
import { User } from "../users/model";
import { Couple, CoupleMember, CoupleActivity } from "../couples/models";
import { coupleRepository } from "../couples/repository";
import { objectId } from "../finance/schema";
import { Task, TaskComment } from "./models";
import * as schema from "./schema";
const missing = () =>
  new AppError(
    404,
    "NOT_FOUND",
    "Không tìm thấy công việc hoặc bạn không có quyền truy cập.",
  );
async function user(id: string, s: ClientSession, write = false) {
  const u = await userRepository.byId(id, s);
  if (!u) throw missing();
  if (write && !(await userRepository.touch(id, u.securityVersion, s)))
    throw missing();
  return u;
}
async function shared(
  userId: string,
  id: string,
  s: ClientSession,
  write = false,
) {
  const m = await coupleRepository.member(userId, id, s);
  if (!m) throw missing();
  const c = write
    ? await coupleRepository.lock(id, s)
    : await Couple.findOne({ _id: id, deletedAt: null }).session(s);
  if (!c || (c.status === "active" && !m.active) || (write && !m.active))
    throw missing();
  return c;
}
async function task(
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
  return { u, t, readOnly };
}
type RecordTask = InstanceType<typeof Task>;
const dto = (t: RecordTask, readOnly = false) => ({
  id: t.id as string,
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
async function event(
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
async function validateAssignment(
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
function revision(t: RecordTask, value: number) {
  if (t.revision !== value)
    throw new AppError(
      409,
      "TASK_CHANGED",
      "Công việc đã được người khác cập nhật. Tải lại trước khi sửa.",
    );
}
function validateRecurrence(t: {
  recurrence: string;
  deadline?: string | null;
}) {
  if (t.recurrence !== "none" && !t.deadline)
    throw new AppError(400, "DEADLINE_REQUIRED", "Việc lặp lại cần hạn chót.");
}
async function change(
  t: RecordTask,
  value: RecordTask["status"],
  s: ClientSession,
) {
  if (t.status === value) return;
  t.status = value;
  if (value !== "DONE") {
    t.completedAt = null;
    return;
  }
  t.completedAt = new Date();
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
      validateRecurrence(fields);
      await validateAssignment({ ...fields, coupleId }, id, s);
      const [t] = await Task.create(
        [
          {
            ...fields,
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
      if (q.search) {
        const pattern = [...q.search]
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
      let rows = await Task.find(filter).session(s);
      const ranks: Record<string, number> = {
        URGENT: 0,
        HIGH: 1,
        MEDIUM: 2,
        LOW: 3,
      };
      rows = rows.sort((a, b) => {
        let delta = 0;
        if (q.sort === "deadline")
          delta = (a.deadline ?? "9999-99-99").localeCompare(
            b.deadline ?? "9999-99-99",
          );
        if (q.sort === "priority")
          delta = ranks[a.priority] - ranks[b.priority];
        if (q.sort === "oldest")
          delta = a.createdAt.getTime() - b.createdAt.getTime();
        else if (!delta) delta = b.createdAt.getTime() - a.createdAt.getTime();
        return delta || a.id.localeCompare(b.id);
      });
      return {
        items: rows
          .slice((q.page - 1) * q.limit, q.page * q.limit)
          .map((t) => dto(t, readOnly)),
        total: rows.length,
        page: q.page,
        limit: q.limit,
        readOnly,
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
      Object.assign(t, fields);
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
        await change(t, input.status, s);
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
