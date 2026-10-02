import bcrypt from "bcrypt";
import { AppError } from "../../utils/AppError";
import { inTransaction } from "../../utils/transaction";
import { publicUser } from "./model";
import { userRepository } from "./repository";
import { tokenRepository } from "../auth/repository";
import { profileSchema } from "./schema";
import { deleteUserSchema } from "../auth/schema";
export const userService = {
  async me(userId: string) {
    const user = await userRepository.byId(userId);
    if (!user)
      throw new AppError(401, "UNAUTHORIZED", "Vui lòng đăng nhập lại.");
    return publicUser(user);
  },
  async update(
    userId: string,
    input: { name?: string; avatar?: string | null; timezone?: string },
  ) {
    input = profileSchema.parse(input);
    const user = await userRepository.profile(userId, input);
    if (!user)
      throw new AppError(404, "NOT_FOUND", "Không tìm thấy tài khoản.");
    return publicUser(user);
  },
  async remove(userId: string, password: string) {
    password = deleteUserSchema.parse({ password }).password;
    const user = await userRepository.byId(userId);
    if (!user)
      throw new AppError(401, "UNAUTHORIZED", "Vui lòng đăng nhập lại.");
    if (!(await bcrypt.compare(password, user.passwordHash)))
      throw new AppError(400, "WRONG_PASSWORD", "Mật khẩu không đúng.");
    if (user.coupleId)
      throw new AppError(
        409,
        "COUPLE_ACTIVE",
        "Vui lòng rời hoặc giải tán không gian chung trước khi xóa tài khoản.",
      );
    await inTransaction(async (session) => {
      if (!(await userRepository.remove(userId, user.securityVersion, session)))
        throw new AppError(
          401,
          "UNAUTHORIZED",
          "Phiên đăng nhập đã thay đổi. Vui lòng thử lại.",
        );
      await tokenRepository.revoke(userId, session);
    });
  },
};
