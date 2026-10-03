const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const id = { type: "string", pattern: "^[a-fA-F0-9]{24}$" };
const date = { type: "string", format: "date-time" };
const object = (
  properties: Record<string, unknown>,
  required: string[] = [],
  strict = false,
) => ({
  type: "object",
  properties,
  required,
  ...(strict ? { additionalProperties: false } : {}),
});
const info = {
  name: { type: "string", minLength: 1, maxLength: 100 },
  anniversary: { type: "string", format: "date", nullable: true },
};
export const coupleSchemas = {
  CoupleInput: object(info, ["name"], true),
  CoupleUpdate: object(info, [], true),
  CoupleAccept: object(
    { code: { type: "string", pattern: "^[A-HJ-NP-Z2-9]{8}$" } },
    ["code"],
    true,
  ),
  CoupleTransfer: object({ userId: id }, ["userId"], true),
  CoupleLeave: object(
    {
      confirm: { type: "boolean", enum: [true] },
      dissolve: { type: "boolean", default: false },
      confirmOutstanding: { type: "boolean", default: false },
    },
    ["confirm"],
    true,
  ),
  CoupleMember: object(
    {
      userId: id,
      name: { type: "string" },
      avatar: { type: "string", nullable: true },
      role: { type: "string", enum: ["owner", "member"] },
      active: { type: "boolean" },
      joinedAt: date,
      leftAt: { ...date, nullable: true },
    },
    ["userId", "name", "role", "active"],
  ),
  AnniversaryInfo: object({
    date: { type: "string", format: "date" },
    daysTogether: { type: "integer" },
    nextDate: { type: "string", format: "date" },
    daysUntil: { type: "integer" },
    isToday: { type: "boolean" },
  }),
  Couple: object(
    {
      id,
      ...info,
      status: { type: "string", enum: ["active", "archived"] },
      ownerId: id,
      role: { type: "string", enum: ["owner", "member"] },
      createdAt: date,
      archivedAt: { ...date, nullable: true },
      archivedReason: { type: "string", nullable: true },
      anniversaryInfo: { allOf: [ref("AnniversaryInfo")], nullable: true },
      members: { type: "array", items: ref("CoupleMember") },
      invite: { ...object({ id, expiresAt: date }), nullable: true },
      outstanding: object({
        count: { type: "integer" },
        summaryAvailable: {
          type: "boolean",
          description: "Tổng hợp công nợ khả dụng tại /settlements/summary.",
        },
      }),
    },
    ["id", "name", "status", "members", "role"],
  ),
  CoupleMe: object({ couple: { allOf: [ref("Couple")], nullable: true } }, [
    "couple",
  ]),
  CoupleInvite: object(
    { id, code: { type: "string" }, expiresAt: date, path: { type: "string" } },
    ["id", "code", "expiresAt", "path"],
  ),
  InvitePreview: object({
    name: { type: "string" },
    inviterName: { type: "string" },
    expiresAt: date,
    isSelf: { type: "boolean" },
  }),
  CoupleActivity: object({
    id,
    type: { type: "string" },
    actorName: { type: "string" },
    message: { type: "string" },
    createdAt: date,
  }),
  CoupleArchiveList: object({
    items: { type: "array", items: ref("Couple") },
    total: { type: "integer" },
    page: { type: "integer" },
    limit: { type: "integer" },
  }),
  CoupleActivityList: object({
    items: { type: "array", items: ref("CoupleActivity") },
    total: { type: "integer" },
    page: { type: "integer" },
    limit: { type: "integer" },
  }),
  CoupleEmpty: object({}, [], true),
};
const query = (name: string, schema: unknown) => ({
  in: "query",
  name,
  schema,
});
const pagination = [
  query("page", { type: "integer", minimum: 1, default: 1 }),
  query("limit", { type: "integer", minimum: 1, maximum: 100, default: 20 }),
];
const pathId = { in: "path", name: "id", required: true, schema: id };
const operation = (
  summary: string,
  response?: string,
  input?: string,
  parameters: unknown[] = [],
  created = false,
) => ({
  summary,
  security: [{ bearerAuth: [] }],
  parameters,
  ...(input
    ? {
        requestBody: {
          required: true,
          content: { "application/json": { schema: ref(input) } },
        },
      }
    : {}),
  responses: {
    [response ? (created ? "201" : "200") : "204"]: {
      description: "Thành công",
      ...(response
        ? { content: { "application/json": { schema: ref(response) } } }
        : {}),
    },
    ...Object.fromEntries(
      [400, 401, 403, 404, 409, 429].map((status) => [
        String(status),
        {
          description: "Lỗi thống nhất",
          content: { "application/json": { schema: ref("Error") } },
        },
      ]),
    ),
  },
});
export const couplePaths = {
  "/couples": {
    post: operation(
      "Tạo hành trình đang hoạt động, người tạo là owner",
      "Couple",
      "CoupleInput",
      [],
      true,
    ),
  },
  "/couples/me": {
    get: operation("Không gian chung hiện tại hoặc null", "CoupleMe"),
    put: operation(
      "Thành viên sửa tên và ngày kỷ niệm",
      "Couple",
      "CoupleUpdate",
    ),
  },
  "/couples/invite": {
    post: operation(
      "Owner tạo mã 8 ký tự, 48h, một lần; thu hồi mã cũ",
      "CoupleInvite",
      "CoupleEmpty",
      [],
      true,
    ),
    delete: operation("Owner thu hồi mã mời", undefined, "CoupleEmpty"),
  },
  "/couples/invite/{code}": {
    get: operation(
      "Xem lời mời còn hiệu lực sau đăng nhập",
      "InvitePreview",
      undefined,
      [
        {
          in: "path",
          name: "code",
          required: true,
          schema: { type: "string", pattern: "^[A-HJ-NP-Z2-9]{8}$" },
        },
      ],
    ),
  },
  "/couples/accept": {
    post: operation(
      "Ghép đôi nguyên tử, một tài khoản một couple active",
      "Couple",
      "CoupleAccept",
    ),
  },
  "/couples/transfer-owner": {
    post: operation(
      "Owner chuyển quyền cho thành viên còn lại",
      "Couple",
      "CoupleTransfer",
    ),
  },
  "/couples/leave": {
    delete: operation(
      "Rời/giải tán, lưu trữ cả hành trình cho hai người",
      "Couple",
      "CoupleLeave",
    ),
  },
  "/couples/archives": {
    get: operation(
      "Các hành trình cũ của chính người dùng",
      "CoupleArchiveList",
      undefined,
      pagination,
    ),
  },
  "/couples/archives/{id}": {
    get: operation(
      "Xem hành trình lưu trữ, chỉ thành viên cũ",
      "Couple",
      undefined,
      [pathId],
    ),
  },
  "/couples/activity": {
    get: operation(
      "Lịch sử hoạt động active hoặc archived theo quyền",
      "CoupleActivityList",
      undefined,
      [...pagination, query("coupleId", id)],
    ),
  },
};
