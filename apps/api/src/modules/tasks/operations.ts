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
  .extend({ status: status.optional() })
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
export const taskOperations = {
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
        const { status: _, ...fields } = input.changes;
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
