import { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError";
import { logger } from "../config/logger";
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        details: error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
          code: issue.code,
        })),
      },
    });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }
  if (
    error?.type === "entity.parse.failed" ||
    error?.type === "entity.too.large"
  ) {
    res.status(error.type === "entity.too.large" ? 413 : 400).json({
      error: {
        code: "INVALID_BODY",
        message: "Nội dung yêu cầu không hợp lệ hoặc quá lớn.",
        details: [],
      },
    });
    return;
  }
  logger.error({ name: error?.name }, "Lỗi máy chủ");
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Có lỗi xảy ra, vui lòng thử lại.",
      details: [],
    },
  });
};
