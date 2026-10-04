import { fitnessRoutes } from "./modules/fitness/routes";
import { taskRoutes } from "./modules/tasks/routes";
import { sharedRoutes } from "./modules/shared/routes";
import { coupleRoutes } from "./modules/couples/routes";
import { planningRoutes } from "./modules/planning/routes";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import mongoose from "mongoose";
import { env } from "./config/env";
import { openapi } from "./config/openapi";
import { AppError } from "./utils/AppError";
import { errorHandler } from "./middlewares/errorHandler";
import { authRoutes } from "./modules/auth/routes";
import { userRoutes } from "./modules/users/routes";
import { financeRoutes } from "./modules/finance/routes";
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY_HOPS);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use("/api", (req, _res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("origin") &&
      req.get("origin") !== env.CORS_ORIGIN
    ) {
      next(
        new AppError(403, "ORIGIN_FORBIDDEN", "Nguồn yêu cầu không được phép."),
      );
      return;
    }
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 100,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: {
        error: {
          code: "RATE_LIMIT",
          message: "Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau.",
          details: [],
        },
      },
    }),
  );
  app.get("/api/health", (_req, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({
      status: connected ? "ok" : "not_ready",
      database: connected ? "connected" : "disconnected",
      phase: 7,
    });
  });
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi));
  app.get("/api/openapi.json", (_req, res) => res.json(openapi));
  app.use("/api/auth", authRoutes());
  app.use("/api/users", userRoutes());
  app.use("/api", coupleRoutes());
  app.use("/api", sharedRoutes());
  app.use("/api", taskRoutes());
  app.use("/api", fitnessRoutes());
  app.use("/api", planningRoutes());
  app.use("/api", financeRoutes());
  app.use((_req, _res, next) =>
    next(new AppError(404, "NOT_FOUND", "Không tìm thấy tài nguyên.")),
  );
  app.use(errorHandler);
  return app;
}
export const app = createApp();
