import { RequestHandler } from "express";
import { User } from "../modules/users/model";
import { AppError } from "../utils/AppError";

export const requireAdmin: RequestHandler = async (req, _res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "UNAUTHORIZED", "Vui lòng đăng nhập.");
    }
    const user = await User.findById(userId).select(
      "role disabledAt deletedAt",
    );
    if (!user || user.deletedAt || user.disabledAt || user.role !== "admin") {
      throw new AppError(
        403,
        "FORBIDDEN",
        "Bạn không có quyền thực hiện hành động này.",
      );
    }
    next();
  } catch (error) {
    next(error);
  }
};
