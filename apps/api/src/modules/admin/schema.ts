import { z } from "zod";

export const adminPaginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const adminUsersQuerySchema = z
  .object({
    query: z.string().trim().max(100).optional(),
    status: z
      .enum(["all", "active", "disabled", "deleted"])
      .optional()
      .default("all"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const adminCouplesQuerySchema = z
  .object({
    status: z.enum(["all", "active", "archived"]).optional().default("all"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const adminAuditQuerySchema = z
  .object({
    action: z.string().trim().max(50).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const adminPasswordBodySchema = z
  .object({
    adminPassword: z.string().min(1, "Vui lòng nhập mật khẩu quản trị viên."),
  })
  .strict();

export const adminTransferOwnerSchema = z
  .object({
    newOwnerId: z
      .string()
      .trim()
      .min(1, "Vui lòng chọn thành viên nhận quyền."),
    adminPassword: z.string().min(1, "Vui lòng nhập mật khẩu quản trị viên."),
  })
  .strict();

export const adminSettingsPatchSchema = z
  .object({
    registrationOpen: z.boolean().optional(),
    allowNewCouples: z.boolean().optional(),
    adminPassword: z.string().min(1, "Vui lòng nhập mật khẩu quản trị viên."),
  })
  .strict()
  .refine(
    (data) =>
      typeof data.registrationOpen === "boolean" ||
      typeof data.allowNewCouples === "boolean",
    "Vui lòng chỉ định ít nhất một cài đặt cần cập nhật.",
  );

export const adminIdParamSchema = z
  .object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "ID không hợp lệ."),
  })
  .strict();
