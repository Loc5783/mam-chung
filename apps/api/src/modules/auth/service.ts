import { createHash, randomBytes, randomUUID } from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { ClientSession } from "mongoose";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { inTransaction } from "../../utils/transaction";
import { UserDocument, publicUser } from "../users/model";
import { userRepository } from "../users/repository";
import { tokenRepository } from "./repository";
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  emailSchema,
} from "./schema";
import { logger } from "../../config/logger";
const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const unauthorized = () =>
  new AppError(
    401,
    "UNAUTHORIZED",
    "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.",
  );
async function issue(
  user: UserDocument,
  session: ClientSession,
  family: string = randomUUID(),
) {
  const refreshToken = randomBytes(48).toString("base64url");
  await tokenRepository.create(
    {
      userId: user.id as string,
      tokenHash: hashToken(refreshToken),
      family,
      securityVersion: user.securityVersion,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    session,
  );
  const accessToken = jwt.sign(
    { version: user.securityVersion, family },
    env.JWT_SECRET,
    {
      subject: user.id as string,
      expiresIn: "15m",
      algorithm: "HS256",
      issuer: "mam-chung",
      audience: "mam-chung-web",
    },
  );
  return { accessToken, user: publicUser(user), refreshToken };
}
export const authService = {
  async register(input: { name: string; email: string; password: string }) {
    input = registerSchema.parse(input);
    const passwordHash = await bcrypt.hash(input.password, 12);
    try {
      return await inTransaction(async (session) => {
        const [user] = await userRepository.create(
          { name: input.name, email: input.email, passwordHash },
          session,
        );
        return issue(user, session);
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === 11000
      )
        throw new AppError(409, "EMAIL_EXISTS", "Email này đã được đăng ký.");
      throw error;
    }
  },
  async login(input: { email: string; password: string }) {
    input = loginSchema.parse(input);
    const user = await userRepository.byEmail(input.email);
    const mismatch = () =>
      new AppError(
        401,
        "INVALID_CREDENTIALS",
        "Email hoặc mật khẩu không đúng.",
      );
    if (!user) {
      await bcrypt.compare(
        input.password,
        "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW",
      );
      throw mismatch();
    }
    if (user.lockUntil && user.lockUntil > new Date())
      throw new AppError(
        423,
        "ACCOUNT_LOCKED",
        "Tài khoản tạm khóa. Vui lòng thử lại sau 15 phút.",
      );
    if (!(await bcrypt.compare(input.password, user.passwordHash))) {
      const updated = await userRepository.failedLogin(
        user.id as string,
        user.securityVersion,
        new Date(),
      );
      if (updated?.lockUntil && updated.lockUntil > new Date())
        throw new AppError(
          423,
          "ACCOUNT_LOCKED",
          "Tài khoản tạm khóa. Vui lòng thử lại sau 15 phút.",
        );
      throw mismatch();
    }
    return inTransaction(async (session) => {
      const current = await userRepository.touch(
        user.id as string,
        user.securityVersion,
        session,
      );
      if (!current) throw unauthorized();
      if (current.lockUntil && current.lockUntil > new Date())
        throw new AppError(
          423,
          "ACCOUNT_LOCKED",
          "Tài khoản tạm khóa. Vui lòng thử lại sau 15 phút.",
        );
      await userRepository.resetLogin(
        current.id as string,
        current.securityVersion,
        session,
      );
      return issue(current, session);
    });
  },
  async refresh(rawToken: unknown) {
    if (typeof rawToken !== "string" || rawToken.length !== 64)
      throw unauthorized();
    const result = await inTransaction(async (session) => {
      const token = await tokenRepository.byHash(hashToken(rawToken), session);
      if (!token || token.expiresAt <= new Date() || token.revokedAt)
        throw unauthorized();
      const user = await userRepository.byId(token.userId.toString(), session);
      if (!user || user.securityVersion !== token.securityVersion)
        throw unauthorized();
      if (token.consumedAt) {
        await userRepository.invalidate(user.id as string, session);
        await tokenRepository.revoke(user.id as string, session);
        return null;
      }
      const current = await userRepository.touch(
        user.id as string,
        user.securityVersion,
        session,
      );
      if (
        !current ||
        !(await tokenRepository.consume(token.id as string, session))
      )
        throw unauthorized();
      return issue(current, session, token.family);
    });
    if (!result)
      throw new AppError(
        401,
        "TOKEN_REUSE",
        "Phiên đăng nhập đã bị thu hồi để bảo vệ tài khoản. Vui lòng đăng nhập lại.",
      );
    return result;
  },
  async logout(userId: string, family: string) {
    await inTransaction(async (session) => {
      const user = await userRepository.byId(userId, session);
      if (user)
        await userRepository.touch(userId, user.securityVersion, session);
      await tokenRepository.revoke(userId, session, family);
    });
  },
  async changePassword(
    userId: string,
    input: { currentPassword: string; newPassword: string },
  ) {
    input = changePasswordSchema.parse(input);
    const user = await userRepository.byId(userId);
    if (!user) throw unauthorized();
    if (!(await bcrypt.compare(input.currentPassword, user.passwordHash)))
      throw new AppError(
        400,
        "WRONG_PASSWORD",
        "Mật khẩu hiện tại không đúng.",
      );
    if (await bcrypt.compare(input.newPassword, user.passwordHash))
      throw new AppError(
        400,
        "SAME_PASSWORD",
        "Mật khẩu mới phải khác mật khẩu hiện tại.",
      );
    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    await inTransaction(async (session) => {
      if (
        !(await userRepository.credentials(
          userId,
          user.securityVersion,
          passwordHash,
          session,
        ))
      )
        throw unauthorized();
      await tokenRepository.revoke(userId, session);
    });
  },
  async adminResetPassword(rawEmail: string) {
    const email = emailSchema.parse(rawEmail);
    const user = await userRepository.byEmail(email);
    if (!user) {
      throw new AppError(
        404,
        "USER_NOT_FOUND",
        "Không tìm thấy người dùng với email này.",
      );
    }
    let temporaryPassword = randomBytes(16).toString("base64url");
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(temporaryPassword)) {
      temporaryPassword += "1aA";
    }
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    await inTransaction(async (session) => {
      const updated = await userRepository.credentials(
        user.id as string,
        user.securityVersion,
        passwordHash,
        session,
      );
      if (!updated) {
        throw new AppError(
          409,
          "CONCURRENT_MODIFICATION",
          "Không thể đặt lại mật khẩu do dữ liệu thay đổi cùng lúc. Vui lòng thử lại.",
        );
      }
      await tokenRepository.revoke(user.id as string, session);
    });
    logger.info(
      { userId: user.id, email: user.email },
      "Admin reset password successfully executed",
    );
    return {
      user: publicUser(user),
      temporaryPassword,
    };
  },
};

