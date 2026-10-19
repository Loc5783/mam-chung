import { Request } from "express";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";
import { User } from "../users/model";
import { userRepository } from "../users/repository";
import { AppError } from "../../utils/AppError";

export { requireAdmin } from "../../middlewares/requireAdmin";

export const adminLimiter = rateLimit({
  windowMs: 60000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: {
      code: "ADMIN_RATE_LIMIT",
      message: "Bạn gửi quá nhiều yêu cầu quản trị. Vui lòng thử lại sau.",
      details: [],
    },
  },
});

export async function verifyAdminPassword(req: Request) {
  const adminId = req.user?.id;
  if (!adminId) {
    throw new AppError(401, "UNAUTHORIZED", "Vui lòng đăng nhập.");
  }

  const adminPassword = req.body?.adminPassword;
  if (!adminPassword || typeof adminPassword !== "string") {
    throw new AppError(
      403,
      "ADMIN_PASSWORD_INVALID",
      "Mật khẩu quản trị viên không chính xác.",
    );
  }

  const adminUser = await User.findById(adminId).select("+passwordHash");

  if (
    !adminUser ||
    adminUser.deletedAt ||
    adminUser.disabledAt ||
    adminUser.role !== "admin"
  ) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Bạn không có quyền thực hiện hành động này.",
    );
  }

  if (adminUser.lockUntil && adminUser.lockUntil > new Date()) {
    throw new AppError(
      423,
      "ACCOUNT_LOCKED",
      "Tài khoản tạm khóa. Vui lòng thử lại sau 15 phút.",
    );
  }

  const isMatch = await bcrypt.compare(adminPassword, adminUser.passwordHash);
  if (!isMatch) {
    const updated = await userRepository.failedLogin(
      adminUser.id as string,
      adminUser.securityVersion,
      new Date(),
    );
    if (updated?.lockUntil && updated.lockUntil > new Date()) {
      throw new AppError(
        423,
        "ACCOUNT_LOCKED",
        "Tài khoản tạm khóa. Vui lòng thử lại sau 15 phút.",
      );
    }
    throw new AppError(
      403,
      "ADMIN_PASSWORD_INVALID",
      "Mật khẩu quản trị viên không chính xác.",
    );
  }

  await userRepository.resetLogin(
    adminUser.id as string,
    adminUser.securityVersion,
  );

  return adminUser;
}
