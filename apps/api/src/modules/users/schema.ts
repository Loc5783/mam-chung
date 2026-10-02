import { z } from "zod";
export const profileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Tên cần ít nhất 2 ký tự.")
      .max(100)
      .optional(),
    avatar: z
      .string()
      .url("Đường dẫn ảnh không hợp lệ.")
      .max(2048)
      .refine(
        (url) => url.startsWith("https://"),
        "Ảnh đại diện cần dùng HTTPS.",
      )
      .nullable()
      .optional(),
    timezone: z
      .string()
      .max(100)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("vi-VN", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, "Múi giờ không hợp lệ.")
      .optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "Vui lòng nhập thông tin cần cập nhật.",
  );
