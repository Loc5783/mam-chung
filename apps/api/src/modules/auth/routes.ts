import { Router } from "express";
import rateLimit from "express-rate-limit";
import { auth } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { authController } from "./controller";
import { registerSchema, loginSchema, changePasswordSchema } from "./schema";
export function authRoutes() {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 60000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: {
        code: "AUTH_RATE_LIMIT",
        message:
          "Bạn thử đăng nhập quá nhiều lần. Vui lòng thử lại sau một phút.",
        details: [],
      },
    },
  });
  router.post(
    "/register",
    limiter,
    validate(registerSchema),
    asyncHandler(authController.register),
  );
  router.post(
    "/login",
    limiter,
    validate(loginSchema),
    asyncHandler(authController.login),
  );
  router.post("/refresh", asyncHandler(authController.refresh));
  router.post("/logout", auth, asyncHandler(authController.logout));
  router.post(
    "/change-password",
    auth,
    validate(changePasswordSchema),
    asyncHandler(authController.changePassword),
  );
  return router;
}
