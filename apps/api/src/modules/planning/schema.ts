import { z } from "zod";
import {
  money,
  objectId,
  transactionCreate,
  pagination,
} from "../finance/schema";
import { validDateOnly } from "../../utils/dates";
export const day = z
  .string()
  .refine(validDateOnly, "Ngày không hợp lệ (YYYY-MM-DD).");
export const month = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Tháng không hợp lệ (YYYY-MM).")
  .refine((v) => validDateOnly(v + "-01"), "Tháng không hợp lệ.");
export const budgetCreate = z
  .object({ categoryId: objectId, month, amount: money })
  .strict();
export const budgetUpdate = budgetCreate
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Vui lòng nhập thông tin cần sửa.");
export const budgetQuery = z.object({ month: month.optional() }).strict();
const goalFields = {
  name: z.string().trim().min(1).max(100),
  targetAmount: money,
  deadline: day.nullable().optional(),
  notes: z.string().max(1000).default(""),
  color: z
    .enum(["#7E9B57", "#E38FA9", "#57713A", "#B3577A"])
    .default("#7E9B57"),
};
export const goalCreate = z.object(goalFields).strict();
export const goalUpdate = goalCreate
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Vui lòng nhập thông tin cần sửa.");
export const contributionCreate = z
  .object({
    amount: money,
    date: transactionCreate.shape.date,
    notes: z.string().max(1000).default(""),
  })
  .strict();
export const contributionParams = z
  .object({ id: objectId, contributionId: objectId })
  .strict();
export const recurringCreate = transactionCreate
  .omit({ date: true })
  .extend({
    frequency: z.enum(["weekly", "monthly"]),
    nextDate: day,
    endDate: day.nullable().optional(),
    enabled: z.boolean().default(true),
  })
  .strict()
  .refine(
    (v) => !v.enabled || !v.endDate || v.nextDate <= v.endDate,
    "Ngày kết thúc phải sau kỳ đầu.",
  );
export const recurringUpdate = transactionCreate
  .omit({ date: true })
  .partial()
  .extend({
    frequency: z.enum(["weekly", "monthly"]).optional(),
    nextDate: day.optional(),
    endDate: day.nullable().optional(),
    enabled: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Vui lòng nhập thông tin cần sửa.");
export const reportQuery = z
  .object({
    months: z.coerce
      .number()
      .int()
      .refine((v) => v === 6 || v === 12, "Chọn 6 hoặc 12 tháng.")
      .default(6),
    endMonth: month.optional(),
  })
  .strict();
export const emptyQuery = z.object({}).strict();
export const contributionQuery = pagination.strict();
export const emptyBody = z.object({}).strict();
