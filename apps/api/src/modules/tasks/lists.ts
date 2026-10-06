import { ClientSession } from "mongoose";
import { z } from "zod";
import { objectId, pagination } from "../finance/schema";
import { AppError } from "../../utils/AppError";
import { inTransaction } from "../../utils/transaction";
import { Task, TaskList } from "./models";
import { between } from "./position";
import { user, shared, missing } from "./access";
const listFields = {
  name: z.string().trim().min(1).max(80),
  color: z
    .enum(["#7E9B57", "#57713A", "#E38FA9", "#B3577A", "#75806B"])
    .default("#7E9B57"),
  icon: z
    .enum([
      "ListTodo",
      "Heart",
      "ShoppingBag",
      "House",
      "Briefcase",
      "Plane",
      "Sprout",
      "BookOpen",
    ])
    .default("ListTodo"),
  type: z.enum(["normal", "shopping"]).default("normal"),
};
export const listCreate = z
  .object({
    ...listFields,
    scope: z.enum(["personal", "shared"]).default("personal"),
  })
  .strict();
export const listUpdate = z
  .object(listFields)
  .partial()
  .extend({
    archived: z.boolean().optional(),
    revision: z.number().int().nonnegative(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 1);
export const listQuery = pagination
  .extend({
    scope: z.enum(["all", "personal", "shared"]).default("all"),
    coupleId: objectId.optional(),
    archived: z.enum(["true", "false"]).default("false"),
  })
  .strict();
export const listDelete = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("move"),
      targetListId: objectId,
      revision: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      mode: z.literal("delete"),
      revision: z.number().int().nonnegative(),
    })
    .strict(),
]);
export const reorderInput = z
  .object({
    id: objectId,
    revision: z.number().int().nonnegative(),
    beforeId: objectId.nullable().default(null),
    afterId: objectId.nullable().default(null),
  })
  .strict();
export function checkRevision(actual: number, expected: number) {
  if (actual !== expected)
    throw new AppError(
      409,
      "TASK_CHANGED",
      "Dữ liệu đã thay đổi. Tải lại trước khi sửa.",
    );
}
export async function listAccess(
  actor: string,
  id: string,
  session: ClientSession,
  write = false,
  allowArchived = false,
) {
  const u = await user(actor, session, write);
  const list = await TaskList.findOne({ _id: id, deletedAt: null }).session(
    session,
  );
  if (!list) throw missing();
  let readOnly = false;
  if (list.coupleId) {
    const c = await shared(actor, list.coupleId.toString(), session, write);
    if (write && u.coupleId?.toString() !== c.id) throw missing();
    readOnly = c.status !== "active";
  } else if (list.ownerId?.toString() !== actor) throw missing();
  if (write && list.archivedAt && !allowArchived)
    throw new AppError(
      409,
      "LIST_ARCHIVED",
      "Danh sách đã lưu trữ. Mở lại trước khi sửa.",
    );
  return { list, readOnly: readOnly || !!list.archivedAt };
}
export async function ensureInbox(
  scope: { ownerId: string } | { coupleId: string },
  session: ClientSession,
) {
  const key =
    "ownerId" in scope
      ? `personal:${scope.ownerId}`
      : `shared:${scope.coupleId}`;
  let list = await TaskList.findOne({ systemKey: key }).session(session);
  if (!list) {
    const last = await TaskList.findOne({ ...scope, deletedAt: null })
      .sort({ position: -1 })
      .session(session);
    [list] = await TaskList.create(
      [
        {
          ...scope,
          systemKey: key,
          name: "ownerId" in scope ? "Hộp thư vào" : "Việc chung",
          color: "ownerId" in scope ? "#7E9B57" : "#E38FA9",
          icon: "ownerId" in scope ? "ListTodo" : "Heart",
          position: between(last?.position ?? null, null),
        },
      ],
      { session },
    );
  }
  return list;
}
export async function appendTaskPosition(
  listId: string | null,
  session: ClientSession,
) {
  const last = await Task.findOne({
    listId,
    deletedAt: null,
    position: { $type: "string" },
  })
    .sort({ position: -1 })
    .session(session);
  return between(last?.position ?? null, null);
}
export const listDto = (
  list: InstanceType<typeof TaskList>,
  readOnly = false,
) => ({
  id: list.id as string,
  name: list.name,
  color: list.color,
  icon: list.icon,
  type: list.type,
  ownerId: list.ownerId?.toString() ?? null,
  coupleId: list.coupleId?.toString() ?? null,
  position: list.position,
  archivedAt: list.archivedAt,
  revision: list.revision,
  isDefault: !!list.systemKey,
  readOnly,
});
export const taskListService = {
  async list(actor: string, raw: unknown) {
    const q = listQuery.parse(raw);
    return inTransaction(async (s) => {
      const u = await user(actor, s);
      const cid = q.coupleId ?? u.coupleId?.toString();
      let readOnly = false;
      if (cid) readOnly = (await shared(actor, cid, s)).status !== "active";
      const scopes =
        q.coupleId || q.scope === "shared"
          ? cid
            ? [{ coupleId: cid }]
            : []
          : q.scope === "personal"
            ? [{ ownerId: actor }]
            : [{ ownerId: actor }, ...(cid ? [{ coupleId: cid }] : [])];
      if (!scopes.length)
        return { items: [], total: 0, page: q.page, limit: q.limit, readOnly };
      const filter = {
        deletedAt: null,
        archivedAt: q.archived === "true" ? { $ne: null } : null,
        $or: scopes,
      };
      const total = await TaskList.countDocuments(filter).session(s);
      const rows = await TaskList.find(filter)
        .sort({ position: 1, _id: 1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .session(s);
      return {
        items: rows.map((l) =>
          listDto(l, !!l.archivedAt || (!!l.coupleId && readOnly)),
        ),
        total,
        page: q.page,
        limit: q.limit,
        readOnly,
      };
    });
  },
  async create(actor: string, raw: unknown) {
    const input = listCreate.parse(raw);
    return inTransaction(async (s) => {
      const u = await user(actor, s, true);
      const scope =
        input.scope === "shared"
          ? { coupleId: u.coupleId?.toString() }
          : { ownerId: actor };
      if (input.scope === "shared") {
        if (!scope.coupleId) throw missing();
        await shared(actor, scope.coupleId, s, true);
      }
      await ensureInbox(
        input.scope === "shared"
          ? { coupleId: scope.coupleId! }
          : { ownerId: actor },
        s,
      );
      const last = await TaskList.findOne({ ...scope, deletedAt: null })
        .sort({ position: -1 })
        .session(s);
      const { scope: _, ...fields } = input;
      void _;
      const [list] = await TaskList.create(
        [
          {
            ...fields,
            ...scope,
            position: between(last?.position ?? null, null),
          },
        ],
        { session: s },
      );
      return listDto(list);
    });
  },
  async update(actor: string, rawId: unknown, raw: unknown) {
    const id = objectId.parse(rawId),
      input = listUpdate.parse(raw);
    return inTransaction(async (s) => {
      const { list } = await listAccess(actor, id, s, true, true);
      checkRevision(list.revision, input.revision);
      if (list.systemKey && input.archived)
        throw new AppError(
          400,
          "DEFAULT_LIST",
          "Không thể lưu trữ danh sách mặc định.",
        );
      const { revision: _, archived, ...fields } = input;
      void _;
      Object.assign(list, fields);
      if (archived !== undefined)
        list.archivedAt = archived ? new Date() : null;
      list.revision++;
      await list.save({ session: s });
      return listDto(list, !!list.archivedAt);
    });
  },
  async remove(actor: string, rawId: unknown, raw: unknown) {
    const id = objectId.parse(rawId),
      input = listDelete.parse(raw);
    return inTransaction(async (s) => {
      const { list } = await listAccess(actor, id, s, true, true);
      checkRevision(list.revision, input.revision);
      if (list.systemKey)
        throw new AppError(
          400,
          "DEFAULT_LIST",
          "Không thể xóa danh sách mặc định.",
        );
      if (input.mode === "move") {
        if (input.targetListId === id)
          throw new AppError(400, "INVALID_TARGET", "Chọn một danh sách khác.");
        const { list: target } = await listAccess(
          actor,
          input.targetListId,
          s,
          true,
        );
        if (
          String(target.ownerId) !== String(list.ownerId) ||
          String(target.coupleId) !== String(list.coupleId)
        )
          throw missing();
        const rows = await Task.find({ listId: id })
          .sort({ position: 1, _id: 1 })
          .session(s);
        let position = await appendTaskPosition(target.id, s);
        for (const t of rows) {
          t.listId = target._id;
          t.position = position;
          t.revision++;
          await t.save({ session: s });
          position = between(position, null);
        }
      } else
        await Task.updateMany(
          { listId: id, deletedAt: null },
          { $set: { deletedAt: new Date() }, $inc: { revision: 1 } },
          { session: s },
        );
      list.deletedAt = new Date();
      list.revision++;
      await list.save({ session: s });
    });
  },
  async reorder(actor: string, raw: unknown) {
    const input = reorderInput.parse(raw);
    return inTransaction(async (s) => {
      const { list } = await listAccess(actor, input.id, s, true);
      checkRevision(list.revision, input.revision);
      const filter = list.coupleId
        ? { coupleId: list.coupleId }
        : { ownerId: list.ownerId };
      const position = await insertionPosition(TaskList, filter, input, s);
      list.position = position;
      list.revision++;
      await list.save({ session: s });
      return listDto(list);
    });
  },
};
// Both neighbours must be adjacent in the same authorized container.
export async function insertionPosition(
  model: typeof TaskList | typeof Task,
  scope: Record<string, unknown>,
  input: z.infer<typeof reorderInput>,
  s: ClientSession,
) {
  if (
    input.beforeId === input.id ||
    input.afterId === input.id ||
    (input.beforeId && input.beforeId === input.afterId)
  )
    throw new AppError(400, "INVALID_ORDER", "Vị trí chèn không hợp lệ.");
  const filter = {
    ...scope,
    deletedAt: null,
    _id: { $ne: input.id },
    ...(model === TaskList ? { archivedAt: null } : {}),
  };
  // Read only the authorized container; no other rows are written.
  const rows =
    model === TaskList
      ? await TaskList.find(filter).sort({ position: 1, _id: 1 }).session(s)
      : await Task.find(filter).sort({ position: 1, _id: 1 }).session(s);
  const leftIndex = input.afterId
    ? rows.findIndex((r) => r.id === input.afterId)
    : -1;
  const rightIndex = input.beforeId
    ? rows.findIndex((r) => r.id === input.beforeId)
    : rows.length;
  if ((input.afterId && leftIndex < 0) || (input.beforeId && rightIndex < 0))
    throw missing();
  if (rightIndex !== leftIndex + 1)
    throw new AppError(
      409,
      "ORDER_CHANGED",
      "Thứ tự đã thay đổi hoặc hai vị trí không liền nhau.",
    );
  if (rows.some((r) => !r.position))
    throw new AppError(
      409,
      "MIGRATION_REQUIRED",
      "Cần chuyển đổi dữ liệu trước khi sắp xếp thủ công.",
    );
  return between(
    rows[leftIndex]?.position ?? null,
    rows[rightIndex]?.position ?? null,
  );
}
