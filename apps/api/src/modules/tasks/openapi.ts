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
  listId: { ...id, nullable: true },
  startDate: date,
  deadlineHasTime: { type: "boolean", default: false },
  deadlineTime: {
    type: "string",
    pattern: "^([01][0-9]|2[0-3]):[0-5][0-9]$",
    nullable: true,
  },
  deadlineTimezone: {
    type: "string",
    nullable: true,
    description:
      "IANA timezone; defaults to user timezone for timed deadlines.",
  },
  reminderAt: {
    type: "string",
    format: "date-time",
    nullable: true,
    description:
      "Stored configuration; reminder worker is scheduled for phase E.",
  },
  estimateMinutes: {
    type: "integer",
    minimum: 1,
    maximum: 525600,
    nullable: true,
  },
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
  TaskListInput: obj(
    {
      name: { type: "string", minLength: 1, maxLength: 80 },
      color: {
        type: "string",
        enum: ["#7E9B57", "#57713A", "#E38FA9", "#B3577A", "#75806B"],
      },
      icon: {
        type: "string",
        enum: [
          "ListTodo",
          "Heart",
          "ShoppingBag",
          "House",
          "Briefcase",
          "Plane",
          "Sprout",
          "BookOpen",
        ],
      },
      type: { type: "string", enum: ["normal", "shopping"] },
      scope: { type: "string", enum: ["personal", "shared"] },
    },
    ["name"],
    true,
  ),
  TaskListUpdate: obj(
    {
      name: { type: "string", minLength: 1, maxLength: 80 },
      color: {
        type: "string",
        enum: ["#7E9B57", "#57713A", "#E38FA9", "#B3577A", "#75806B"],
      },
      icon: {
        type: "string",
        enum: [
          "ListTodo",
          "Heart",
          "ShoppingBag",
          "House",
          "Briefcase",
          "Plane",
          "Sprout",
          "BookOpen",
        ],
      },
      type: { type: "string", enum: ["normal", "shopping"] },
      archived: { type: "boolean" },
      revision,
    },
    ["revision"],
    true,
  ),
  TaskList: obj({
    id,
    name: { type: "string" },
    color: { type: "string" },
    icon: { type: "string" },
    type: { type: "string", enum: ["normal", "shopping"] },
    ownerId: { ...id, nullable: true },
    coupleId: { ...id, nullable: true },
    position: { type: "string" },
    archivedAt: { type: "string", format: "date-time", nullable: true },
    revision,
    isDefault: { type: "boolean" },
    readOnly: { type: "boolean" },
  }),
  TaskListPage: obj({
    items: { type: "array", items: ref("TaskList") },
    total: { type: "integer" },
    page: { type: "integer" },
    limit: { type: "integer" },
    readOnly: { type: "boolean" },
  }),
  TaskReorder: obj(
    {
      id,
      revision,
      beforeId: { ...id, nullable: true },
      afterId: { ...id, nullable: true },
    },
    ["id", "revision"],
    true,
  ),
  TaskListDelete: {
    oneOf: [
      obj(
        {
          mode: { type: "string", enum: ["move"] },
          targetListId: id,
          revision,
        },
        ["mode", "targetListId", "revision"],
        true,
      ),
      obj(
        { mode: { type: "string", enum: ["delete"] }, revision },
        ["mode", "revision"],
        true,
      ),
    ],
  },
  TaskBulk: {
    oneOf: [
      obj(
        {
          action: { type: "string", enum: ["update"] },
          items: {
            type: "array",
            minItems: 1,
            maxItems: 100,
            items: obj({ id, revision }, ["id", "revision"], true),
          },
          changes: obj(
            {
              ...fields,
              status,
              addLabels: {
                type: "array",
                minItems: 1,
                maxItems: 10,
                items: { type: "string", minLength: 1, maxLength: 30 },
              },
            },
            [],
            true,
          ),
        },
        ["action", "items", "changes"],
        true,
      ),
      obj(
        {
          action: { type: "string", enum: ["delete"] },
          items: {
            type: "array",
            minItems: 1,
            maxItems: 100,
            items: obj({ id, revision }, ["id", "revision"], true),
          },
        },
        ["action", "items"],
        true,
      ),
    ],
  },
  TaskQuickAdd: obj(
    {
      items: {
        type: "array",
        minItems: 1,
        maxItems: 100,
        items: ref("TaskInput"),
      },
    },
    ["items"],
    true,
  ),
  TaskBulkUndo: obj(
    {
      items: {
        type: "array",
        minItems: 1,
        maxItems: 100,
        items: obj(
          {
            id,
            revision,
            restore: { type: "boolean" },
            changes: obj(
              {
                status,
                listId: fields.listId,
                deadline: fields.deadline,
                priority: fields.priority,
                assignedTo: fields.assignedTo,
                labels: fields.labels,
              },
              [],
              true,
            ),
          },
          ["id", "revision"],
          true,
        ),
      },
    },
    ["items"],
    true,
  ),
  TaskBulkResult: obj({ items: { type: "array", items: ref("Task") } }),
  TaskSummary: obj({
    counts: { type: "object", additionalProperties: { type: "integer" } },
    lists: { type: "array", items: obj({ id, count: { type: "integer" } }) },
    labels: { type: "array", items: { type: "string" } },
  }),
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
    position: { type: "string", nullable: true },
    timeSpentSeconds: { type: "integer", minimum: 0 },
    completedBy: { ...id, nullable: true },
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
    groups: {
      type: "array",
      description: "Groups for the current page only",
      items: obj({
        key: { type: "string" },
        taskIds: { type: "array", items: id },
      }),
    },
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
  TaskStats: obj({
    completed: obj({
      today: { type: "integer" },
      thisWeek: { type: "integer" },
      thisMonth: { type: "integer" },
    }),
    onTimeRate: { type: "number", nullable: true },
    streak: obj({
      current: { type: "integer" },
      best: { type: "integer" },
    }),
    byDay: {
      type: "array",
      items: obj({
        date: { type: "string", format: "date" },
        completed: { type: "integer" },
      }),
    },
    byList: {
      type: "array",
      items: obj({
        listId: { ...id, nullable: true },
        name: { type: "string" },
        count: { type: "integer" },
        color: { type: "string" },
      }),
    },
    byPriority: obj({
      LOW: { type: "integer" },
      MEDIUM: { type: "integer" },
      HIGH: { type: "integer" },
      URGENT: { type: "integer" },
    }),
    couple: {
      type: "object",
      nullable: true,
      properties: {
        members: {
          type: "array",
          items: obj({
            userId: id,
            name: { type: "string" },
            completed: { type: "integer" },
          }),
        },
        total: { type: "integer" },
      },
    },
    lateHabits: {
      type: "array",
      items: obj({
        name: { type: "string" },
        type: { type: "string", enum: ["label", "list"] },
        lateCount: { type: "integer" },
        rate: { type: "number" },
      }),
    },
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
  query("list", id),
  query("smart", {
    type: "string",
    enum: [
      "today",
      "upcoming",
      "overdue",
      "mine",
      "partner",
      "shared",
      "nodate",
      "done",
    ],
  }),
  query("assignee", id),
  query("q", { type: "string", maxLength: 160 }),
  query("groupBy", {
    type: "string",
    enum: ["deadline", "list", "priority", "assignee"],
  }),
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
    enum: ["manual", "deadline", "priority", "newest", "oldest"],
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
  "/tasks/summary": {
    get: op(
      "Số đếm danh sách thông minh và tiến độ theo quyền",
      "TaskSummary",
      [query("coupleId", id)],
    ),
  },
  "/tasks/stats": {
    get: op(
      "Thống kê công việc: tỷ lệ đúng hạn, chuỗi ngày, phân bố và cặp đôi",
      "TaskStats",
      [
        query("range", { type: "string", enum: ["7d", "30d", "90d"] }),
        query("scope", {
          type: "string",
          enum: ["personal", "shared", "all"],
        }),
      ],
    ),
  },
  "/tasks/{id}/restore": {
    post: op(
      "Khôi phục việc xóa mềm trong30 ngày; kiểm tra revision và quyền",
      "Task",
      [pathId],
      "TaskDelete",
    ),
  },
  "/task-lists": {
    get: op("Danh sách cá nhân/chung theo quyền", "TaskListPage", [
      ...paging,
      query("scope", { type: "string", enum: ["all", "personal", "shared"] }),
      query("archived", { type: "string", enum: ["true", "false"] }),
      query("coupleId", id),
    ]),
    post: op(
      "Tạo danh sách; chủ sở hữu lấy từ phiên đăng nhập",
      "TaskList",
      [],
      "TaskListInput",
      201,
    ),
  },
  "/task-lists/{id}": {
    put: op(
      "Sửa/lưu trữ/mở lại danh sách",
      "TaskList",
      [pathId],
      "TaskListUpdate",
    ),
    delete: op(
      "Xóa danh sách; chọn chuyển việc cùng phạm vi hoặc xóa mềm các việc",
      "",
      [pathId],
      "TaskListDelete",
      204,
    ),
  },
  "/task-lists/reorder": {
    patch: op(
      "Sắp xếp danh sách; beforeId đứng sau, afterId đứng trước vị trí chèn",
      "TaskList",
      [],
      "TaskReorder",
    ),
  },
  "/tasks/reorder": {
    patch: op(
      "Sắp xếp một việc trong danh sách; kiểm tra hai hàng lân cận",
      "Task",
      [],
      "TaskReorder",
    ),
  },
  "/tasks/bulk": {
    patch: op(
      "Cập nhật/xóa 1–100 việc nguyên tử; sai quyền/phiên bản trả details với các ID lỗi",
      "TaskBulkResult",
      [],
      "TaskBulk",
    ),
  },
  "/tasks/quick-add": {
    post: op(
      "Tạo 1–100 công việc đã nhận diện; kiểm tra toàn bộ và lưu nguyên tử",
      "TaskBulkResult",
      [],
      "TaskQuickAdd",
      201,
    ),
  },
  "/tasks/bulk-undo": {
    patch: op(
      "Hoàn tác nhóm theo revision mới; toàn bộ hoặc không có việc nào; khôi phục tối đa 30 ngày",
      "TaskBulkResult",
      [],
      "TaskBulkUndo",
    ),
  },
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
