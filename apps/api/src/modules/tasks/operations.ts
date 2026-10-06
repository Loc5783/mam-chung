import { z } from "zod";
import { inTransaction } from "../../utils/transaction";
import { AppError } from "../../utils/AppError";
import { objectId } from "../finance/schema";
import { fields, status } from "./schema";
import {
  task,
  dto,
  revision,
  change,
  event,
  validateAssignment,
  validateRecurrence,
  validateTaskDates,
} from "./service";
import {
  listAccess,
  ensureInbox,
  appendTaskPosition,
  insertionPosition,
  reorderInput,
} from "./lists";
import { Task } from "./models";
import { missing } from "./access";
const bulkChanges = z
  .object(fields)
  .partial()
  .extend({
    status: status.optional(),
    addLabels: z
      .array(z.string().trim().min(1).max(30))
      .min(1)
      .max(10)
      .optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Chưa có thay đổi.");
const items = z
  .array(
    z
      .object({ id: objectId, revision: z.number().int().nonnegative() })
      .strict(),
  )
  .min(1)
  .max(100)
  .refine(
    (v) => new Set(v.map((i) => i.id)).size === v.length,
    "Mã công việc bị trùng.",
  );
export const bulkInput = z.discriminatedUnion("action", [
  z
    .object({ action: z.literal("update"), items, changes: bulkChanges })
    .strict(),
  z.object({ action: z.literal("delete"), items }).strict(),
]);
export const bulkUndoInput = z
  .object({
    items: z
      .array(
        z
          .object({
            id: objectId,
            revision: z.number().int().nonnegative(),
            restore: z.boolean().optional(),
            changes: z
              .object({
                status: status.optional(),
                listId: fields.listId.optional(),
                deadline: fields.deadline.optional(),
                priority: fields.priority.optional(),
                assignedTo: fields.assignedTo.optional(),
                labels: fields.labels.optional(),
              })
              .strict()
              .optional(),
          })
          .strict(),
      )
      .min(1)
      .max(100)
      .refine(
        (a) => new Set(a.map((i) => i.id)).size === a.length,
        "Mã công việc bị trùng.",
      ),
  })
  .strict();
export const taskOperations = {
  async undo(actor: string, raw: unknown) {
    const input = bulkUndoInput.parse(raw);
    return inTransaction(async (s) => {
      const result = [];
      for (const item of [...input.items].sort((a, b) =>
        a.id.localeCompare(b.id),
      )) {
        const { t, u } = await task(actor, item.id, s, true, !!item.restore);
        revision(t, item.revision);
        if (item.restore) {
          if (
            !t.deletedAt ||
            Date.now() - t.deletedAt.getTime() > 30 * 86400000
          )
            throw new AppError(
              410,
              "RESTORE_EXPIRED",
              "Đã quá thời hạn khôi phục 30 ngày.",
            );
          t.deletedAt = null;
        }
        const { status: next, ...updates } = item.changes ?? {};
        if (updates.listId !== undefined) {
          const list = updates.listId
            ? (await listAccess(actor, updates.listId, s, true)).list
            : await ensureInbox(
                t.coupleId
                  ? { coupleId: t.coupleId.toString() }
                  : { ownerId: actor },
                s,
              );
          if (
            (list.coupleId?.toString() ?? null) !==
            (t.coupleId?.toString() ?? null)
          )
            throw missing();
          if (list.id !== t.listId?.toString())
            t.position = await appendTaskPosition(list.id, s);
          updates.listId = list.id;
        }
        const oldAssignee = t.assignedTo?.toString(),
          oldDeadline = t.deadline;
        Object.assign(t, updates);
        if (oldAssignee !== t.assignedTo?.toString()) t.assignmentVersion++;
        if (oldDeadline !== t.deadline)
          t.anchorDay = t.deadline ? Number(t.deadline.slice(8)) : null;
        validateTaskDates(t);
        validateRecurrence(t);
        await validateAssignment(t, actor, s);
        if (next) await change(t, next, s, actor);
        t.revision++;
        await t.save({ session: s });
        await event(t, u, "đã hoàn tác thay đổi công việc chung.", s);
        result.push(dto(t));
      }
      return { items: result };
    });
  },
  async reorder(actor: string, raw: unknown) {
    const input = reorderInput.parse(raw);
    return inTransaction(async (s) => {
      const { t } = await task(actor, input.id, s, true);
      revision(t, input.revision);
      if (!t.listId)
        throw new AppError(
          409,
          "MIGRATION_REQUIRED",
          "Cần chuyển đổi dữ liệu trước khi sắp xếp.",
        );
      t.position = await insertionPosition(
        Task,
        {
          listId: t.listId,
          coupleId: t.coupleId,
          ...(t.coupleId ? {} : { createdBy: actor }),
        },
        input,
        s,
      );
      t.revision++;
      await t.save({ session: s });
      return dto(t);
    });
  },
  async bulk(actor: string, raw: unknown) {
    const input = bulkInput.parse(raw);
    return inTransaction(async (s) => {
      const contexts: Awaited<ReturnType<typeof task>>[] = [],
        errors: { id: string; code: string }[] = [];
      for (const item of [...input.items].sort((a, b) =>
        a.id.localeCompare(b.id),
      )) {
        try {
          const context = await task(actor, item.id, s, true);
          revision(context.t, item.revision);
          contexts.push(context);
        } catch (error) {
          if (!(error instanceof AppError)) throw error;
          errors.push({ id: item.id, code: error.code });
        }
      }
      if (errors.length)
        throw new AppError(
          errors.some((e) => e.code === "TASK_CHANGED") ? 409 : 404,
          "BULK_REJECTED",
          "Không cập nhật việc nào. Kiểm tra quyền và phiên bản của các việc được chọn.",
          errors,
        );
      // Validate every resulting task before applying any save/status recurrence.
      for (const { t, u } of contexts) {
        if (input.action === "delete") continue;
        const { status: _, addLabels, ...fields } = input.changes;
        if (addLabels) {
          const labels = [...new Set([...t.labels, ...addLabels])];
          if (labels.length > 10)
            throw new AppError(400, "LABEL_LIMIT", "Tối đa 10 nhãn mỗi việc.");
          t.labels = labels;
        }
        void _;
        if (fields.listId !== undefined) {
          const target = fields.listId
            ? (await listAccess(actor, fields.listId, s, true)).list
            : await ensureInbox(
                t.coupleId
                  ? { coupleId: t.coupleId.toString() }
                  : { ownerId: actor },
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
        const oldAssignee = t.assignedTo?.toString() ?? null,
          oldDeadline = t.deadline;
        Object.assign(t, fields);
        if (oldAssignee !== (t.assignedTo?.toString() ?? null))
          t.assignmentVersion++;
        if (oldDeadline !== t.deadline)
          t.anchorDay = t.deadline ? Number(t.deadline.slice(8)) : null;
        if (t.deadlineHasTime && !t.deadlineTimezone)
          t.deadlineTimezone = u.timezone;
        validateTaskDates(t);
        validateRecurrence(t);
        await validateAssignment(t, actor, s);
      }
      for (const { t, u } of contexts) {
        if (input.action === "delete") t.deletedAt = new Date();
        else {
          // Allocate moves sequentially so multiple tasks never share a new position.
          if (input.changes.listId !== undefined)
            t.position = await appendTaskPosition(
              t.listId?.toString() ?? null,
              s,
            );
          if (input.changes.status)
            await change(t, input.changes.status, s, actor);
        }
        t.revision++;
        await t.save({ session: s });
        await event(
          t,
          u,
          input.action === "delete"
            ? "đã xóa một công việc chung."
            : "đã cập nhật một công việc chung.",
          s,
        );
      }
      return { items: contexts.map((c) => dto(c.t)) };
    });
  },
};
