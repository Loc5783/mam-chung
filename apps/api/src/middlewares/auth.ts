import { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import { userRepository } from "../modules/users/repository";
import { tokenRepository } from "../modules/auth/repository";
declare module "express-serve-static-core" {
  interface Request {
    user?: { id: string; coupleId: string | null; family: string };
  }
}
export const auth: RequestHandler = (req, _res, next) => {
  void (async () => {
    const bearer = req.get("authorization");
    if (!bearer?.startsWith("Bearer "))
      throw new AppError(401, "UNAUTHORIZED", "Vui lòng đăng nhập.");
    let claims;
    try {
      claims = jwt.verify(bearer.slice(7), env.JWT_SECRET, {
        algorithms: ["HS256"],
        issuer: "mam-chung",
        audience: "mam-chung-web",
      });
    } catch {
      throw new AppError(
        401,
        "UNAUTHORIZED",
        "Phiên đăng nhập đã hết hạn hoặc không hợp lệ.",
      );
    }
    if (
      typeof claims === "string" ||
      typeof claims.sub !== "string" ||
      !Types.ObjectId.isValid(claims.sub) ||
      typeof claims.family !== "string" ||
      typeof claims.version !== "number"
    )
      throw new AppError(401, "UNAUTHORIZED", "Phiên đăng nhập không hợp lệ.");
    const user = await userRepository.byId(claims.sub);
    if (
      !user ||
      user.securityVersion !== claims.version ||
      !(await tokenRepository.active(claims.sub, claims.family))
    )
      throw new AppError(401, "UNAUTHORIZED", "Phiên đăng nhập đã bị thu hồi.");
    if (user.disabledAt)
      throw new AppError(
        403,
        "ACCOUNT_DISABLED",
        "Tài khoản của bạn đang bị tạm khóa. Hãy liên hệ người quản trị.",
      );
    req.user = {
      id: user.id as string,
      coupleId: user.coupleId?.toString() ?? null,
      family: claims.family,
    };
    next();
  })().catch(next);
};
