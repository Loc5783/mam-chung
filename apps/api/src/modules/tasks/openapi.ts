const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const id = { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
  date = { type: "string", format: "date", nullable: true };
const status = {
  type: "string",
  enum: ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"],
};
const revision = {
  type: "integer",
  minimum: 0,
  description: "Revision đang thấy, bắt buộc khi sửa/xóa; bản cũ trả409.",
};
const fields = {
  title: { type: "string", minLength: 1, maxLength: 160 },
  description: { type: "string", maxLength: 2000 },
  deadline: date,
  priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
  assignedTo: { ...id, nullable: true },
  kind: { type: "string", enum: ["task", "shopping"] },
  labels: {
    type: "array",
    maxItems: 10,
    items: { type: "string", minLength: 1, maxLength: 30 },
  },
  checklist: { type: "array", maxItems: 100, items: ref("TaskChecklist") },
  recurrence: { type: "string", enum: ["none", "daily", "weekly", "monthly"] },
};
const obj = (
  properties: Record<string, unknown>,
  required: string[] = [],
  strict = false,
) => ({
  type: "object",
  properties,
  required,
  ...(strict ? { additionalProperties: false } : {}),
});
export const taskSchemas = {
  TaskChecklist: obj(
    {
      id: {
        type: "string",
        format: "uuid",
        description: "Có thể bỏ khi tạo, server sinh UUID.",
      },
      text: { type: "string", minLength: 1, maxLength: 200 },
      done: { type: "boolean" },
    },
    ["text"],
    true,
  ),
  TaskInput: obj(
    {
      ...fields,
      scope: {
        type: "string",
        enum: ["personal", "shared"],
        default: "personal",
      },
    },
    ["title"],
    true,
  ),
  TaskUpdate: obj({ ...fields, revision }, ["revision"], true),
  TaskStatus: obj({ status, revision }, ["status", "revision"], true),
  TaskDelete: obj({ revision }, ["revision"], true),
  Task: obj({
    ...fields,
    id,
    status,
    revision,
    createdBy: id,
    creatorName: { type: "string" },
    coupleId: { ...id, nullable: true },
    completedAt: { type: "string", format: "date-time", nullable: true },
    sourceTaskId: { ...id, nullable: true },
    readOnly: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
  }),
  TaskPage: obj({
    items: { type: "array", items: ref("Task") },
    total: { type: "integer" },
    page: { type: "integer" },
    limit: { type: "integer" },
    readOnly: { type: "boolean" },
  }),
  TaskCommentInput: obj(
    { text: { type: "string", minLength: 1, maxLength: 500 } },
    ["text"],
    true,
  ),
  TaskComment: obj({
    id,
    userId: id,
    authorName: { type: "string" },
    text: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
  }),
  TaskCommentPage: obj({
    items: { type: "array", items: ref("TaskComment") },
    total: { type: "integer" },
    page: { type: "integer" },
    limit: { type: "integer" },
    readOnly: { type: "boolean" },
  }),
  TaskMembers: obj({
    items: { type: "array", items: obj({ id, name: { type: "string" } }) },
    readOnly: { type: "boolean" },
  }),
};
const secured = [{ bearerAuth: [] }];
const response = (schema: string) => ({
  description: "Thành công",
  content: { "application/json": { schema: ref(schema) } },
});
const body = (schema: string) => ({
  required: true,
  content: { "application/json": { schema: ref(schema) } },
});
const errors = {
  400: { description: "Dữ liệu không hợp lệ" },
  401: { description: "Cần đăng nhập" },
  404: { description: "Không tìm thấy/không có quyền/archived không được ghi" },
  409: { description: "Revision cũ; tải lại công việc" },
};
const pathId = { name: "id", in: "path", required: true, schema: id };
const query = (name: string, schema: Record<string, unknown>) => ({
  name,
  in: "query",
  schema,
});
const paging = [
  query("page", { type: "integer", minimum: 1, default: 1 }),
  query("limit", { type: "integer", minimum: 1, maximum: 100, default: 20 }),
];
const filters = [
  ...paging,
  query("coupleId", id),
  query("scope", {
    type: "string",
    enum: ["all", "personal", "shared", "mine"],
    default: "all",
  }),
  query("status", status),
  query("priority", fields.priority),
  query("kind", fields.kind),
  query("search", { type: "string", maxLength: 160 }),
  query("label", { type: "string", maxLength: 30 }),
  query("from", { type: "string", format: "date" }),
  query("to", { type: "string", format: "date" }),
  query("due", { type: "string", enum: ["today", "overdue"] }),
  query("sort", {
    type: "string",
    enum: ["deadline", "priority", "newest", "oldest"],
  }),
];
const op = (
  summary: string,
  schema: string,
  parameters: unknown[] = [],
  input?: string,
  code = 200,
) => ({
  tags: ["Công việc"],
  summary,
  security: secured,
  parameters,
  ...(input ? { requestBody: body(input) } : {}),
  responses: {
    [code]: schema ? response(schema) : { description: "Đã xóa" },
    ...errors,
  },
});
export const taskPaths = {
  "/tasks": {
    get: op(
      "Danh sách công việc cá nhân/chung, lọc và phân trang",
      "TaskPage",
      filters,
    ),
    post: op(
      "Tạo công việc; chỉ giao cho chính mình hoặc thành viên couple active",
      "Task",
      [],
      "TaskInput",
      201,
    ),
  },
  "/tasks/members": {
    get: op(
      "Tên/id các thành viên để phân công; archived dùng snapshot",
      "TaskMembers",
      [query("coupleId", id)],
    ),
  },
  "/tasks/{id}": {
    get: op("Xem công việc theo quyền; archived chỉ đọc", "Task", [pathId]),
    put: op(
      "Cả hai sửa task chung; không chuyển scope; bắt buộc revision",
      "Task",
      [pathId],
      "TaskUpdate",
    ),
    delete: op(
      "Soft delete, không xóa bản lặp đã tạo",
      "",
      [pathId],
      "TaskDelete",
      204,
    ),
  },
  "/tasks/{id}/status": {
    patch: op(
      "Đổi trạng thái; DONE ghi thời gian và sinh đúng một bản lặp kế tiếp",
      "Task",
      [pathId],
      "TaskStatus",
    ),
  },
  "/tasks/{id}/comments": {
    get: op("Bình luận task chung, thứ tự thời gian tăng", "TaskCommentPage", [
      pathId,
      ...paging,
    ]),
    post: op(
      "Bình luận ngắn trên task chung active",
      "TaskComment",
      [pathId],
      "TaskCommentInput",
      201,
    ),
  },
};
