import { z } from "zod";
import { randomUUID } from "crypto";
import { validDateOnly } from "../../utils/dates";
import { objectId, pagination } from "../finance/schema";
export const status = z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]);
const day = z.string().refine(validDateOnly, "Ngày không hợp lệ (yyyy-MM-dd).");
const item = z
  .object({
    id: z
      .string()
      .uuid()
      .default(() => randomUUID()),
    text: z.string().trim().min(1, "Nhập nội dung việc con.").max(200),
    done: z.boolean().default(false),
  })
  .strict();
export const timezone = z
  .string()
  .max(80)
  .refine((zone) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: zone });
      return true;
    } catch {
      return false;
    }
  }, "Múi giờ không hợp lệ.");
export const fields = {
  listId: objectId.nullable().default(null),
  startDate: day.nullable().default(null),
  deadlineHasTime: z.boolean().default(false),
  deadlineTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .default(null),
  deadlineTimezone: timezone.nullable().default(null),
  reminderAt: z.string().datetime({ offset: true }).nullable().default(null),
  estimateMinutes: z.number().int().min(1).max(525600).nullable().default(null),
  title: z.string().trim().min(1, "Nhập tiêu đề công việc.").max(160),
  description: z.string().trim().max(2000).default(""),
  deadline: day.nullable().default(null),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  assignedTo: objectId.nullable().default(null),
  kind: z.enum(["task", "shopping"]).default("task"),
  labels: z
    .array(z.string().trim().min(1).max(30))
    .max(10)
    .transform((a) => [...new Set(a)])
    .default([]),
  checklist: z
    .array(item)
    .max(100)
    .refine(
      (a) => new Set(a.map((i) => i.id)).size === a.length,
      "Mã việc con bị trùng.",
    )
    .default([]),
  recurrence: z.enum(["none", "daily", "weekly", "monthly"]).default("none"),
};
export const create = z
  .object({
    ...fields,
    scope: z.enum(["personal", "shared"]).default("personal"),
  })
  .strict();
export const update = z
  .object(fields)
  .partial()
  .extend({ revision: z.number().int().nonnegative() })
  .strict()
  .refine((v) => Object.keys(v).length > 1, "Chưa có thay đổi.");
export const changeStatus = z
  .object({ status, revision: z.number().int().nonnegative() })
  .strict();
export const remove = z
  .object({ revision: z.number().int().nonnegative() })
  .strict();
export const query = pagination
  .extend({
    list: objectId.optional(),
    smart: z
      .enum([
        "today",
        "upcoming",
        "overdue",
        "mine",
        "partner",
        "shared",
        "nodate",
        "done",
      ])
      .optional(),
    assignee: objectId.optional(),
    q: z.string().trim().max(160).optional(),
    groupBy: z.enum(["deadline", "list", "priority", "assignee"]).optional(),
    scope: z.enum(["all", "personal", "shared", "mine"]).default("all"),
    coupleId: objectId.optional(),
    status: status.optional(),
    priority: fields.priority.removeDefault().optional(),
    kind: fields.kind.removeDefault().optional(),
    search: z.string().trim().max(160).optional(),
    label: z.string().max(30).optional(),
    from: day.optional(),
    to: day.optional(),
    due: z.enum(["today", "overdue"]).optional(),
    sort: z
      .enum(["manual", "deadline", "priority", "newest", "oldest"])
      .default("deadline"),
  })
  .strict()
  .refine(
    (v) => !v.from || !v.to || v.from <= v.to,
    "Ngày kết thúc phải sau ngày bắt đầu.",
  );
export const readQuery = z.object({ coupleId: objectId.optional() }).strict();
export const commentsQuery = pagination
  .extend({ coupleId: objectId.optional() })
  .strict();
export const comment = z
  .object({ text: z.string().trim().min(1, "Nhập bình luận.").max(500) })
  .strict();

export const quickAdd = z
  .object({ items: z.array(create).min(1).max(100) })
  .strict();
