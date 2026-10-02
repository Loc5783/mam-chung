import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import mongoose from "mongoose";
import { env } from "./config/env";
import { AppError } from "./utils/AppError";
import { errorHandler } from "./middlewares/errorHandler";
const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Mầm Chung API",
    version: "0.1.0",
    description:
      "Giai đoạn 0: kiểm tra kết nối. Các API nghiệp vụ sẽ được bổ sung theo từng giai đoạn.",
  },
  paths: {
    "/api/health": {
      get: {
        summary: "Kiểm tra tình trạng hệ thống",
        responses: {
          "200": { description: "MongoDB đã kết nối" },
          "503": { description: "MongoDB chưa sẵn sàng" },
        },
      },
    },
  },
};
export const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
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
    phase: 0,
  });
});
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi));
app.use((_req, _res, next) =>
  next(new AppError(404, "NOT_FOUND", "Không tìm thấy tài nguyên.")),
);
app.use(errorHandler);
