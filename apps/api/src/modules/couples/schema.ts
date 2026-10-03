import { z } from "zod";
import { objectId, pagination } from "../finance/schema";
import { validDateOnly } from "../../utils/dates";
export const name = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập tên không gian chung.")
  .max(100);
export const anniversary = z
  .string()
  .refine(
    (v) => validDateOnly(v) && v >= "1900-01-01",
    "Ngày kỷ niệm không hợp lệ.",
  )
  .nullable();
export const createSchema = z
  .object({ name, anniversary: anniversary.optional() })
  .strict();
export const updateSchema = createSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Vui lòng nhập thông tin cần sửa.");
export const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{8}$/, "Mã mời cần 8 ký tự.");
export const acceptSchema = z.object({ code }).strict();
export const codeParams = z.object({ code }).strict();
export const transferSchema = z.object({ userId: objectId }).strict();
export const leaveSchema = z
  .object({
    confirm: z.literal(true, {
      errorMap: () => ({
        message: "Vui lòng xác nhận lưu trữ không gian chung.",
      }),
    }),
    dissolve: z.boolean().default(false),
    confirmOutstanding: z.boolean().default(false),
  })
  .strict();
export const empty = z.object({}).strict();
export const listQuery = pagination.strict();
export const activityQuery = pagination
  .extend({ coupleId: objectId.optional() })
  .strict();
