import { financeSchemas, financePaths } from "../modules/finance/openapi";
const error = {
  description: "Lỗi thống nhất",
  content: {
    "application/json": { schema: { $ref: "#/components/schemas/Error" } },
  },
};
const secured = [{ bearerAuth: [] }];
const body = (schema: string) => ({
  required: true,
  content: {
    "application/json": { schema: { $ref: `#/components/schemas/${schema}` } },
  },
});
const session = {
  description:
    "Đăng nhập thành công, cookie refreshToken httpOnly và access token 15 phút",
  content: {
    "application/json": { schema: { $ref: "#/components/schemas/Session" } },
  },
};
export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Mầm Chung API",
    version: "0.3.0",
    description:
      "Giai đoạn 2 — tài khoản và tài chính cá nhân. Refresh token chỉ được đặt trong cookie httpOnly; không trả qua JSON.",
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      ...financeSchemas,
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: { type: "array", items: { type: "object" } },
            },
          },
        },
      },
      Profile: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string" },
          avatar: { type: "string", nullable: true },
          timezone: { type: "string" },
          coupleId: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Session: {
        type: "object",
        properties: {
          accessToken: { type: "string" },
          user: { $ref: "#/components/schemas/Profile" },
        },
      },
      Register: {
        type: "object",
        required: ["name", "email", "password"],
        additionalProperties: false,
        properties: {
          name: { type: "string", minLength: 2, maxLength: 100 },
          email: { type: "string", format: "email" },
          password: {
            type: "string",
            minLength: 8,
            description: "Có chữ và số, tối đa 72 byte UTF-8",
          },
        },
      },
      Login: {
        type: "object",
        required: ["email", "password"],
        additionalProperties: false,
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string" },
        },
      },
      UpdateProfile: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string", minLength: 2, maxLength: 100 },
          avatar: {
            type: "string",
            format: "uri",
            nullable: true,
            description: "HTTPS URL hoặc null",
          },
          timezone: { type: "string", example: "Asia/Ho_Chi_Minh" },
        },
      },
      ChangePassword: {
        type: "object",
        required: ["currentPassword", "newPassword"],
        additionalProperties: false,
        properties: {
          currentPassword: { type: "string" },
          newPassword: { type: "string", minLength: 8 },
        },
      },
      DeleteUser: {
        type: "object",
        required: ["password"],
        additionalProperties: false,
        properties: { password: { type: "string" } },
      },
    },
  },
  paths: {
    ...financePaths,
    "/api/health": {
      get: {
        summary: "Kiểm tra tình trạng hệ thống",
        responses: {
          "200": { description: "MongoDB đã kết nối" },
          "503": { description: "MongoDB chưa sẵn sàng" },
        },
      },
    },
    "/api/auth/register": {
      post: {
        summary: "Đăng ký",
        requestBody: body("Register"),
        responses: { "201": session, "400": error, "409": error, "429": error },
      },
    },
    "/api/auth/login": {
      post: {
        summary: "Đăng nhập",
        requestBody: body("Login"),
        responses: { "200": session, "401": error, "423": error, "429": error },
      },
    },
    "/api/auth/refresh": {
      post: {
        summary: "Xoay vòng refresh token trong cookie",
        responses: { "200": session, "401": error, "403": error },
      },
    },
    "/api/auth/logout": {
      post: {
        summary: "Đăng xuất phiên hiện tại",
        security: secured,
        responses: {
          "204": { description: "Đã thu hồi phiên và xóa cookie" },
          "401": error,
        },
      },
    },
    "/api/auth/change-password": {
      post: {
        summary: "Đổi mật khẩu, thu hồi mọi phiên",
        security: secured,
        requestBody: body("ChangePassword"),
        responses: {
          "204": { description: "Đã đổi mật khẩu. Cần đăng nhập lại." },
          "400": error,
          "401": error,
        },
      },
    },
    "/api/users/me": {
      get: {
        summary: "Hồ sơ của tôi",
        security: secured,
        responses: {
          "200": {
            description: "Hồ sơ",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Profile" },
              },
            },
          },
          "401": error,
        },
      },
      put: {
        summary: "Cập nhật hồ sơ",
        security: secured,
        requestBody: body("UpdateProfile"),
        responses: {
          "200": { description: "Hồ sơ đã cập nhật" },
          "400": error,
          "401": error,
        },
      },
      delete: {
        summary: "Xóa tài khoản với mật khẩu xác nhận",
        security: secured,
        requestBody: body("DeleteUser"),
        responses: {
          "204": {
            description: "Tài khoản đã bị vô hiệu hóa và thu hồi mọi phiên",
          },
          "400": error,
          "401": error,
          "409": error,
        },
      },
    },
  },
};
