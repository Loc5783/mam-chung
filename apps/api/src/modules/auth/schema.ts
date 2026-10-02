import { z } from "zod";
export const passwordSchema = z
  .string()
  .min(8, "Mật khẩu cần ít nhất 8 ký tự.")
  .regex(/(?=.*[A-Za-z])(?=.*\d)/, "Mật khẩu cần có chữ và số.")
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "Mật khẩu không được vượt quá 72 byte.",
  );
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Email không hợp lệ.")
  .max(254);
export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Tên cần ít nhất 2 ký tự.").max(100),
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();
export const loginSchema = z
  .object({
    email: emailSchema,
    password: z
      .string()
      .min(1, "Vui lòng nhập mật khẩu.")
      .refine(
        (value) => Buffer.byteLength(value, "utf8") <= 72,
        "Mật khẩu không hợp lệ.",
      ),
  })
  .strict();
export const changePasswordSchema = z
  .object({
    currentPassword: loginSchema.shape.password,
    newPassword: passwordSchema,
  })
  .strict();
export const deleteUserSchema = z
  .object({ password: loginSchema.shape.password })
  .strict();
