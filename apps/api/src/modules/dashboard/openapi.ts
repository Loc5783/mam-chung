const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const obj = (
  properties: Record<string, unknown>,
  required = Object.keys(properties),
) => ({ type: "object", properties, required });
const nullable = (name: string) => ({ allOf: [ref(name)], nullable: true });
const json = (schema: unknown) => ({ "application/json": { schema } });
const errors = {
  "400": { description: "Dữ liệu không hợp lệ" },
  "401": { description: "Cần đăng nhập" },
  "404": { description: "Không tồn tại hoặc không thuộc tài khoản" },
};
const secure = [{ bearerAuth: [] }];
const emptyBody = {
  required: true,
  content: json({
    type: "object",
    additionalProperties: false,
    properties: {},
  }),
};
export const dashboardSchemas = {
  HomeDashboard: obj({
    generatedAt: { type: "string", format: "date-time" },
    finance: ref("FinanceDashboard"),
    budgets: obj({
      month: { type: "string", example: "2026-10" },
      items: { type: "array", items: ref("Budget") },
    }),
    tasks: obj({ today: ref("TaskPage"), overdue: ref("TaskPage") }),
    fitness: ref("FitnessReport"),
    couple: nullable("Couple"),
    shared: nullable("SharedDashboard"),
    activity: nullable("CoupleActivityList"),
  }),
  Notification: obj({
    id: { type: "string" },
    type: {
      type: "string",
      enum: [
        "COUPLE_INVITE",
        "INVITE_ACCEPTED",
        "DEBT_NEW",
        "PAYMENT_CONFIRM",
        "TASK_ASSIGNED",
        "TASK_DUE",
        "BUDGET_EXCEEDED",
      ],
    },
    title: { type: "string" },
    message: { type: "string" },
    href: {
      type: "string",
      description:
        "Đường dẫn nội bộ, không có mã mời hay dữ liệu tài chính riêng của người khác",
    },
    payload: obj({ sourceId: { type: "string" } }),
    readAt: { type: "string", format: "date-time", nullable: true },
    createdAt: { type: "string", format: "date-time" },
  }),
  NotificationPage: obj({
    items: { type: "array", items: ref("Notification") },
    total: { type: "integer", minimum: 0 },
    unreadCount: {
      type: "integer",
      minimum: 0,
      description:
        "Tổng số thông báo còn hiệu lực chưa đọc của người dùng, không phụ thuộc bộ lọc hoặc trang",
    },
    page: { type: "integer", minimum: 1 },
    limit: { type: "integer", minimum: 1, maximum: 100 },
  }),
};
const param = (name: string, schema: unknown) => ({
  name,
  in: "query",
  schema,
});
export const dashboardPaths = {
  "/api/dashboard": {
    get: {
      summary: "Tổng quan bằng một yêu cầu",
      description:
        "Dữ liệu cá nhân riêng tư, Couple/quỹ/hoạt động hiện tại hoặc null. Các phần được đọc qua dịch vụ có phân quyền; không phải một snapshot nguyên tử xuyên mô-đun. Không nhận tham số truy vấn.",
      security: secure,
      responses: {
        "200": {
          description: "Tổng quan",
          content: json(ref("HomeDashboard")),
        },
        ...errors,
      },
    },
  },
  "/api/notifications": {
    get: {
      summary: "Thông báo trong ứng dụng của tôi",
      description:
        "Đồng bộ những điều kiện còn hiệu lực khi đọc. Không email/SMS/push hoặc tác vụ chạy nền. Nhắc nhở hết hạn/đã xử lý bị ẩn; đọc lại không sinh bản sao. Lời mời đến người nhận chỉ xuất hiện sau khi họ xem trước bằng mã hợp lệ.",
      security: secure,
      parameters: [
        param("page", { type: "integer", minimum: 1, default: 1 }),
        param("limit", {
          type: "integer",
          minimum: 1,
          maximum: 100,
          default: 20,
        }),
        param("unread", { type: "string", enum: ["true", "false"] }),
        param("type", dashboardSchemas.Notification.properties.type),
      ],
      responses: {
        "200": {
          description: "Danh sách thông báo",
          content: json(ref("NotificationPage")),
        },
        ...errors,
      },
    },
  },
  "/api/notifications/{id}/read": {
    patch: {
      summary: "Đánh dấu thông báo của tôi đã đọc; gọi lại giữ thời điểm cũ",
      security: secure,
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
        },
      ],
      requestBody: emptyBody,
      responses: {
        "200": {
          description: "Thông báo đã đọc",
          content: json(ref("Notification")),
        },
        ...errors,
      },
    },
  },
  "/api/notifications/read-all": {
    post: {
      summary: "Đọc tất cả thông báo còn hiệu lực của tôi",
      security: secure,
      requestBody: emptyBody,
      responses: {
        "200": {
          description: "Số thông báo cập nhật",
          content: json(obj({ updated: { type: "integer", minimum: 0 } })),
        },
        ...errors,
      },
    },
  },
};
