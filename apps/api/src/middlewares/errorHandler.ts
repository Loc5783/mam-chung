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
  if (error?.name === "CastError") {
    res.status(400).json({
      error: {
        code: "INVALID_IDENTIFIER",
        message: "Định dạng mã không hợp lệ.",
        details: [
          {
            path: [error.path ?? "id"],
            message: `Giá trị '${error.value}' không hợp lệ.`,
          },
        ],
      },
    });
    return;
  }
  if (error?.name === "ValidationError") {
    const details = error.errors
      ? Object.keys(error.errors).map((key) => ({
          path: [key],
          message: error.errors[key]?.message ?? "Dữ liệu không hợp lệ.",
        }))
      : [];
    res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không đúng định dạng.",
        details,
      },
    });
    return;
  }
  if (
    error?.name === "MongoServerError" &&
    (error.code === 11000 || error.code === "11000")
  ) {
    res.status(409).json({
      error: {
        code: "DUPLICATE_KEY",
        message: "Dữ liệu đã tồn tại trong hệ thống.",
        details: [],
      },
    });
    return;
  }
  if (error?.name === "VersionError") {
    res.status(409).json({
      error: {
        code: "CONFLICT",
        message: "Dữ liệu đã bị thay đổi bởi người khác, vui lòng tải lại.",
        details: [],
      },
    });
    return;
  }
  if (
    typeof error?.hasErrorLabel === "function"
      ? error.hasErrorLabel("TransientTransactionError")
      : Array.isArray(error?.errorLabels) &&
        error.errorLabels.includes("TransientTransactionError")
  ) {
    res.status(409).json({
      error: {
        code: "TRANSIENT_CONFLICT",
        message: "Hệ thống đang bận, vui lòng thử lại.",
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
