import { z } from "zod";
import {
  objectId,
  money,
  pagination,
  transactionCreate,
} from "../finance/schema";
import { day } from "../planning/schema";
const name = z.string().trim().min(1, "Vui lòng nhập tên.").max(100);
export const walletCreate = z.object({ name }).strict();
export const walletUpdate = z
  .object({ name: name.optional(), archived: z.boolean().optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Vui lòng nhập thông tin cần sửa.");
export const contribution = z
  .object({
    amount: money,
    date: transactionCreate.shape.date,
    notes: z.string().max(1000).default(""),
  })
  .strict();
export const split = z
  .object({
    userId: objectId,
    shareAmount: z
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER)
      .optional(),
    percent: z
      .number()
      .min(0)
      .max(100)
      .refine(
        (v) => /^\d+(\.\d{1,2})?$/.test(String(v)),
        "Tỷ lệ tối đa 2 chữ số thập phân.",
      )
      .optional(),
  })
  .strict();
export const transactionCreateSchema = z
  .object({
    sharedWalletId: objectId,
    payerId: objectId,
    amount: money,
    date: transactionCreate.shape.date,
    description: z.string().trim().min(1).max(200),
    categoryId: objectId,
    splitType: z.enum(["equal", "custom", "percent"]),
    paidFrom: z.enum(["fund", "personal"]),
    splits: z.array(split).length(2).optional(),
  })
  .strict();
export const listQuery = pagination
  .extend({
    coupleId: objectId.optional(),
    from: day.optional(),
    to: day.optional(),
    sharedWalletId: objectId.optional(),
    status: z.enum(["pending", "pending_confirm", "paid"]).optional(),
  })
  .strict()
  .refine(
    (v) => !v.from || !v.to || v.from <= v.to,
    "Ngày bắt đầu phải trước ngày kết thúc.",
  );
export const contextQuery = z
  .object({ coupleId: objectId.optional() })
  .strict();
export const action = z
  .object({ notes: z.string().max(1000).default("") })
  .strict();
export const goalCreate = z
  .object({
    name,
    targetAmount: money,
    deadline: day.nullable().optional(),
    notes: z.string().max(1000).default(""),
  })
  .strict();
export const goalUpdate = goalCreate
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Vui lòng nhập thông tin cần sửa.");
export const undoParams = z
  .object({ id: objectId, contributionId: objectId })
  .strict();
