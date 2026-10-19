export const adminSchemas = {
  AdminOverview: {
    type: "object",
    properties: {
      totalUsers: { type: "integer" },
      activeUsers7d: { type: "integer" },
      disabledUsers: { type: "integer" },
      newUsers7d: { type: "integer" },
      activeCouples: { type: "integer" },
      archivedCouples: { type: "integer" },
      registrationOpen: { type: "boolean" },
    },
  },
  AdminUserItem: {
    type: "object",
    properties: {
      id: { type: "string" },
      email: { type: "string" },
      name: { type: "string" },
      createdAt: { type: "string", format: "date-time" },
      lastLoginAt: { type: "string", format: "date-time", nullable: true },
      status: { type: "string", enum: ["active", "disabled", "deleted"] },
      lockedUntil: { type: "string", format: "date-time", nullable: true },
      coupleName: { type: "string", nullable: true },
      coupleStatus: { type: "string", nullable: true },
      role: { type: "string", enum: ["user", "admin"] },
    },
  },
  AdminUsersResponse: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: { $ref: "#/components/schemas/AdminUserItem" },
      },
      total: { type: "integer" },
      page: { type: "integer" },
      limit: { type: "integer" },
      totalPages: { type: "integer" },
    },
  },
  AdminCoupleItem: {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      status: { type: "string", enum: ["active", "archived"] },
      createdAt: { type: "string", format: "date-time" },
      memberCount: { type: "integer" },
      members: {
        type: "array",
        items: {
          type: "object",
          properties: {
            userId: { type: "string" },
            name: { type: "string" },
            role: { type: "string", enum: ["owner", "member"] },
            active: { type: "boolean" },
          },
        },
      },
      activeInviteCount: { type: "integer" },
    },
  },
  AdminCouplesResponse: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: { $ref: "#/components/schemas/AdminCoupleItem" },
      },
      total: { type: "integer" },
      page: { type: "integer" },
      limit: { type: "integer" },
      totalPages: { type: "integer" },
    },
  },
  AdminAuditItem: {
    type: "object",
    properties: {
      id: { type: "string" },
      adminId: { type: "string", nullable: true },
      adminEmail: { type: "string" },
      ip: { type: "string", nullable: true },
      action: { type: "string" },
      targetType: { type: "string", enum: ["user", "couple", "setting"] },
      targetId: { type: "string", nullable: true },
      before: { type: "object", nullable: true },
      after: { type: "object", nullable: true },
      details: { type: "object", nullable: true },
      createdAt: { type: "string", format: "date-time" },
    },
  },
  AdminAuditResponse: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: { $ref: "#/components/schemas/AdminAuditItem" },
      },
      total: { type: "integer" },
      page: { type: "integer" },
      limit: { type: "integer" },
      totalPages: { type: "integer" },
    },
  },
  AdminSuccessResponse: {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
    },
  },
  AdminResetPasswordResponse: {
    type: "object",
    properties: {
      success: { type: "boolean" },
      temporaryPassword: { type: "string" },
      message: { type: "string" },
    },
  },
  AdminPasswordBody: {
    type: "object",
    required: ["adminPassword"],
    properties: {
      adminPassword: { type: "string" },
    },
  },
  AdminTransferOwnerBody: {
    type: "object",
    required: ["newOwnerId", "adminPassword"],
    properties: {
      newOwnerId: { type: "string" },
      adminPassword: { type: "string" },
    },
  },
  AdminSettingsResponse: {
    type: "object",
    properties: {
      registrationOpen: { type: "boolean" },
      allowNewCouples: { type: "boolean" },
    },
  },
  AdminSettingsPatchBody: {
    type: "object",
    required: ["adminPassword"],
    properties: {
      registrationOpen: { type: "boolean" },
      allowNewCouples: { type: "boolean" },
      adminPassword: { type: "string" },
    },
  },
};

const secured = [{ bearerAuth: [] }];
const error = {
  description: "Lỗi thống nhất",
  content: {
    "application/json": { schema: { $ref: "#/components/schemas/Error" } },
  },
};

export const adminPaths = {
  "/admin/overview": {
    get: {
      tags: ["Admin"],
      summary: "Tổng quan siêu dữ liệu hệ thống",
      security: secured,
      responses: {
        200: {
          description: "Thành công",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AdminOverview" },
            },
          },
        },
        401: error,
        403: error,
      },
    },
  },
  "/admin/users": {
    get: {
      tags: ["Admin"],
      summary: "Danh sách tài khoản (chỉ siêu dữ liệu)",
      security: secured,
      parameters: [
        { name: "query", in: "query", schema: { type: "string" } },
        {
          name: "status",
          in: "query",
          schema: {
            type: "string",
            enum: ["all", "active", "disabled", "deleted"],
          },
        },
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20 },
        },
      ],
      responses: {
        200: {
          description: "Thành công",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AdminUsersResponse" },
            },
          },
        },
        401: error,
        403: error,
      },
    },
  },
  "/admin/couples": {
    get: {
      tags: ["Admin"],
      summary: "Danh sách cặp đôi (chỉ siêu dữ liệu)",
      security: secured,
      parameters: [
        {
          name: "status",
          in: "query",
          schema: { type: "string", enum: ["all", "active", "archived"] },
        },
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20 },
        },
      ],
      responses: {
        200: {
          description: "Thành công",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AdminCouplesResponse" },
            },
          },
        },
        401: error,
        403: error,
      },
    },
  },
  "/admin/audit": {
    get: {
      tags: ["Admin"],
      summary: "Nhật ký thao tác quản trị viên",
      security: secured,
      parameters: [
        { name: "action", in: "query", schema: { type: "string" } },
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20 },
        },
      ],
      responses: {
        200: {
          description: "Thành công",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AdminAuditResponse" },
            },
          },
        },
        401: error,
        403: error,
      },
    },
  },
  "/admin/users/{id}/lock": {
    post: {
      tags: ["Admin"],
      summary: "Tạm khóa tài khoản",
      security: secured,
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/AdminPasswordBody" },
          },
        },
      },
      responses: {
        200: {
          description: "Thành công",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AdminSuccessResponse" },
            },
          },
        },
        400: error,
        401: error,
        403: error,
        404: error,
      },
    },
  },
  "/admin/users/{id}/unlock": {
    post: {
      tags: ["Admin"],
      summary: "Mở khóa tài khoản",
      security: secured,
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/AdminPasswordBody" },
          },
        },
      },
      responses: {
        200: {
          description: "Thành công",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AdminSuccessResponse" },
            },
          },
        },
        400: error,
        401: error,
        403: error,
        404: error,
      },
    },
  },
  "/admin/users/{id}/unlock-login": {
    post: {
      tags: ["Admin"],
      summary: "Xóa trạng thái tạm khóa do nhập sai mật khẩu",
      security: secured,
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/AdminPasswordBody" },
          },
        },
      },
      responses: {
        200: {
          description: "Thành công",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AdminSuccessResponse" },
            },
          },
        },
        400: error,
        401: error,
        403: error,
        404: error,
      },
    },
  },
  "/admin/users/{id}": {
    delete: {
      tags: ["Admin"],
      summary: "Xóa mềm tài khoản",
      security: secured,
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/AdminPasswordBody" },
          },
        },
      },
      responses: {
        200: {
          description: "Thành công",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AdminSuccessResponse" },
            },
          },
        },
        400: error,
        401: error,
        403: error,
        404: error,
      },
    },
  },
  "/admin/users/{id}/reset-password": {
    post: {
      tags: ["Admin"],
      summary: "Đặt lại mật khẩu tạm cho người dùng",
      security: secured,
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/AdminPasswordBody" },
          },
        },
      },
      responses: {
        200: {
          description: "Thành công",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/AdminResetPasswordResponse",
              },
            },
          },
        },
        400: error,
        401: error,
        403: error,
        404: error,
      },
    },
  },
  "/admin/couples/{id}/archive": {
    post: {
      tags: ["Admin"],
      summary: "Lưu trữ không gian chung",
      security: secured,
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/AdminPasswordBody" },
          },
        },
      },
      responses: {
        200: {
          description: "Thành công",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AdminSuccessResponse" },
            },
          },
        },
        400: error,
        401: error,
        403: error,
        404: error,
      },
    },
  },
  "/admin/couples/{id}/transfer-owner": {
    post: {
      tags: ["Admin"],
      summary: "Chuyển quyền chủ không gian chung cho thành viên khác",
      security: secured,
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/AdminTransferOwnerBody" },
          },
        },
      },
      responses: {
        200: {
          description: "Thành công",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AdminSuccessResponse" },
            },
          },
        },
        400: error,
        401: error,
        403: error,
        404: error,
      },
    },
  },
  "/admin/settings": {
    get: {
      tags: ["Admin"],
      summary: "Lấy cài đặt hệ thống",
      security: secured,
      responses: {
        200: {
          description: "Thành công",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AdminSettingsResponse" },
            },
          },
        },
        401: error,
        403: error,
      },
    },
    patch: {
      tags: ["Admin"],
      summary: "Cập nhật cài đặt hệ thống",
      security: secured,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/AdminSettingsPatchBody" },
          },
        },
      },
      responses: {
        200: {
          description: "Thành công",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AdminSettingsResponse" },
            },
          },
        },
        400: error,
        401: error,
        403: error,
      },
    },
  },
};
