import { z } from "zod";
import { validDateOnly } from "../../utils/dates";
export const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Mã tài nguyên không hợp lệ.");
export const money = z
  .number()
  .int("Số tiền phải là số nguyên VND.")
  .positive("Số tiền phải lớn hơn 0.")
  .max(Number.MAX_SAFE_INTEGER, "Số tiền vượt giới hạn an toàn.");
const dateOnly = z
  .string()
  .refine(validDateOnly, "Ngày không hợp lệ (yyyy-MM-dd).");
const date = z.union([
  dateOnly,
  z.string().datetime({ offset: true, message: "Ngày giờ không hợp lệ." }),
]);
export const icons = [
  "Wallet",
  "Landmark",
  "Smartphone",
  "Utensils",
  "Car",
  "ShoppingBag",
  "Receipt",
  "Gamepad2",
  "HeartPulse",
  "GraduationCap",
  "Briefcase",
  "Gift",
  "Ellipsis",
  "PiggyBank",
  "House",
  "Coffee",
] as const;
const color = z.enum(["#7E9B57", "#57713A", "#B9CC9A", "#E38FA9", "#B3577A"]);
const walletFields = {
  name: z.string().trim().min(1, "Vui lòng nhập tên ví.").max(80),
  type: z.enum(["cash", "bank", "ewallet"]),
  allowNegative: z.boolean().default(false),
  color: color.default("#7E9B57"),
  icon: z.enum(icons).default("Wallet"),
};
export const walletCreate = z
  .object({
    ...walletFields,
    initialBalance: z
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER)
      .default(0),
  })
  .strict();
export const walletUpdate = z
  .object({ ...walletFields })
  .partial()
  .extend({ archived: z.boolean().optional() })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "Vui lòng nhập thông tin cần sửa.",
  );
export const pagination = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const walletQuery = pagination
  .extend({ archived: z.enum(["true", "false"]).optional() })
  .strict();
const categoryFields = {
  name: z.string().trim().min(1, "Vui lòng nhập tên danh mục.").max(60),
  type: z.enum(["income", "expense"]),
  icon: z.enum(icons).default("Ellipsis"),
};
export const categoryCreate = z.object(categoryFields).strict();
export const categoryUpdate = z
  .object(categoryFields)
  .partial()
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "Vui lòng nhập thông tin cần sửa.",
  );
export const categoryDelete = z
  .object({ replacementId: objectId.optional() })
  .strict();
export const categoryQuery = pagination
  .extend({ type: z.enum(["income", "expense"]).optional() })
  .strict();
export const transactionCreate = z
  .object({
    type: z.enum(["income", "expense"]),
    amount: money,
    walletId: objectId,
    categoryId: objectId,
    date,
    description: z.string().trim().min(1, "Vui lòng nhập mô tả.").max(200),
    notes: z.string().max(1000).default(""),
    tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  })
  .strict();
export const transactionUpdate = transactionCreate
  .partial()
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "Vui lòng nhập thông tin cần sửa.",
  );
export const transactionQuery = pagination
  .extend({
    from: dateOnly.optional(),
    to: dateOnly.optional(),
    categoryId: objectId.optional(),
    walletId: objectId.optional(),
    type: z.enum(["income", "expense", "transfer", "opening"]).optional(),
    search: z.string().trim().max(100).optional(),
    sort: z
      .enum(["date_desc", "date_asc", "amount_desc", "amount_asc"])
      .default("date_desc"),
  })
  .strict()
  .refine(
    (data) => !data.from || !data.to || data.from <= data.to,
    "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.",
  );
export const transferCreate = z
  .object({
    fromWalletId: objectId,
    toWalletId: objectId,
    amount: money,
    date,
    description: z.string().trim().max(200).default("Chuyển tiền giữa ví"),
  })
  .strict();
export const duplicateSchema = z.object({ date: date.optional() }).strict();
export const idParams = z.object({ id: objectId }).strict();
export const reconcileSchema = z
  .object({ repair: z.boolean().default(false) })
  .strict();
export type TransactionInput = z.infer<typeof transactionCreate>;
export type TransactionQuery = z.infer<typeof transactionQuery>;
