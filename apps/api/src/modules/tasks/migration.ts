import mongoose, { Types } from "mongoose";
import { Task, TaskList } from "./models";
import { User } from "../users/model";
import { Couple } from "../couples/models";
import { inTransaction } from "../../utils/transaction";
import { between } from "./position";
import { ensureInbox } from "./lists";
// Match the legacy default order: dated first, then newest, then ID.
function legacyOrder(a: Record<string, unknown>, b: Record<string, unknown>) {
  const dates = String(a.deadline ?? "9999-99-99").localeCompare(
    String(b.deadline ?? "9999-99-99"),
  );
  const created =
    new Date(String(b.createdAt ?? 0)).getTime() -
    new Date(String(a.createdAt ?? 0)).getTime();
  return dates || created || String(a._id).localeCompare(String(b._id));
}
const defaults = {
  listId: null,
  position: null,
  startDate: null,
  deadlineHasTime: false,
  deadlineTime: null,
  deadlineTimezone: null,
  reminderAt: null,
  estimateMinutes: null,
  timeSpentSeconds: 0,
  completedBy: null,
  recurrenceRule: null,
};
export async function migrateTaskLists(dryRun = true) {
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
  if (!hello.setName) throw new Error("Migration yêu cầu MongoDB replica set.");
  const users = await User.find().select("_id").lean();
  const couples = await Couple.find().select("_id").lean();
  const scopes = [
    ...users.map((u) => ({ ownerId: String(u._id) })),
    ...couples.map((c) => ({ coupleId: String(c._id) })),
  ];
  const owners = new Set(users.map((u) => String(u._id))),
    pairs = new Set(couples.map((c) => String(c._id)));
  const all = await Task.collection.find({}).toArray();
  const orphanIds = all
    .filter((t) =>
      t.coupleId
        ? !pairs.has(String(t.coupleId))
        : !owners.has(String(t.createdBy)),
    )
    .map((t) => String(t._id));
  if (orphanIds.length)
    throw new Error(
      `Có ${orphanIds.length} việc thiếu chủ sở hữu. Dừng migration để kiểm tra: ${orphanIds.join(", ")}`,
    );
  const lists = await TaskList.find().lean();
  const listById = new Map(lists.map((list) => [String(list._id), list]));
  const broken = all.filter((t) => {
    if (!t.listId) return false;
    const list = listById.get(String(t.listId));
    return (
      !list ||
      (t.coupleId
        ? String(list.coupleId) !== String(t.coupleId)
        : !!list.coupleId || String(list.ownerId) !== String(t.createdBy))
    );
  });
  if (broken.length)
    throw new Error(
      `Có ${broken.length} việc tham chiếu danh sách sai quyền/không tồn tại. Dừng migration để kiểm tra.`,
    );
  let listsCreated = 0,
    tasksUpdated = 0;
  for (const scope of scopes) {
    const key =
      "ownerId" in scope
        ? `personal:${scope.ownerId}`
        : `shared:${scope.coupleId}`;
    const existing = await TaskList.findOne({ systemKey: key }).lean();
    const filter =
      "ownerId" in scope
        ? { coupleId: null, createdBy: new Types.ObjectId(scope.ownerId) }
        : { coupleId: new Types.ObjectId(scope.coupleId) };
    const rows = await Task.collection
      .find(filter)
      .sort({ deadline: 1, createdAt: -1, _id: 1 })
      .toArray();
    rows.sort(legacyOrder);
    const needs = rows.filter(
      (t) =>
        Object.keys(defaults).some((k) => !(k in t)) ||
        !t.listId ||
        !t.position,
    );
    if (!existing) listsCreated++;
    tasksUpdated += needs.length;
    if (dryRun || (existing && !needs.length)) continue;
    await inTransaction(async (s) => {
      // Serialize against normal mutations, including archived scopes. No ownership changes.
      if ("ownerId" in scope)
        await User.updateOne(
          { _id: scope.ownerId },
          { $inc: { sessionRevision: 1 } },
          { session: s },
        );
      else
        await Couple.updateOne(
          { _id: scope.coupleId },
          { $inc: { revision: 1 } },
          { session: s },
        );
      const inbox = await ensureInbox(scope, s);
      const fresh = await Task.collection
        .find(filter, { session: s })
        .sort({ deadline: 1, createdAt: -1, _id: 1 })
        .toArray();
      fresh.sort(legacyOrder);
      const lastByList = new Map<string, string>();
      for (const t of fresh)
        if (t.listId && t.position) {
          const id = String(t.listId),
            current = lastByList.get(id);
          if (!current || t.position > current) lastByList.set(id, t.position);
        }
      for (const t of fresh) {
        const patch: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(defaults))
          if (!(key in t)) patch[key] = value;
        const listId = t.listId ?? inbox._id;
        if (!t.listId) patch.listId = listId;
        if (!t.position) {
          const position = between(
            lastByList.get(String(listId)) ?? null,
            null,
          );
          patch.position = position;
          lastByList.set(String(listId), position);
        }
        if (Object.keys(patch).length)
          await Task.collection.updateOne(
            { _id: t._id },
            { $set: patch, $inc: { revision: 1 } },
            { session: s },
          );
      }
    });
  }
  return { dryRun, listsCreated, tasksUpdated, scopes: scopes.length };
}
