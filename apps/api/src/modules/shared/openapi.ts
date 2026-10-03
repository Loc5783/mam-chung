const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const id = { type: "string", pattern: "^[a-fA-F0-9]{24}$" };
const amount = {
  type: "integer",
  minimum: 1,
  maximum: Number.MAX_SAFE_INTEGER,
};
const date = {
  type: "string",
  description: "YYYY-MM-DD theo múi giờ hồ sơ hoặc ISO 8601 có offset.",
};
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
const names = { name: { type: "string", minLength: 1, maxLength: 100 } };
const contribution = {
  amount,
  date,
  notes: { type: "string", maxLength: 1000 },
};
const goal = {
  ...names,
  targetAmount: amount,
  deadline: { type: "string", format: "date", nullable: true },
  notes: { type: "string", maxLength: 1000 },
};
const transaction = {
  sharedWalletId: id,
  payerId: id,
  amount,
  date,
  description: { type: "string", minLength: 1, maxLength: 200 },
  categoryId: id,
  splitType: { type: "string", enum: ["equal", "custom", "percent"] },
  paidFrom: { type: "string", enum: ["fund", "personal"] },
  splits: {
    type: "array",
    minItems: 2,
    maxItems: 2,
    items: ref("SharedSplitInput"),
  },
};
export const sharedSchemas = {
  SharedWalletInput: object(names, ["name"], true),
  SharedWalletUpdate: object(
    { ...names, archived: { type: "boolean" } },
    [],
    true,
  ),
  SharedWallet: object(
    {
      id,
      ...names,
      balance: { type: "integer" },
      archived: { type: "boolean" },
      createdAt: { type: "string", format: "date-time" },
    },
    ["id", "name", "balance", "archived"],
  ),
  SharedContributionInput: object(contribution, ["amount", "date"], true),
  SharedContribution: object({
    id,
    userId: id,
    actorName: { type: "string" },
    ...contribution,
  }),
  SharedSplitInput: object(
    {
      userId: id,
      shareAmount: {
        type: "integer",
        minimum: 0,
        maximum: Number.MAX_SAFE_INTEGER,
      },
      percent: { type: "number", minimum: 0, maximum: 100, multipleOf: 0.01 },
    },
    ["userId"],
    true,
  ),
  SharedTransactionInput: object(
    transaction,
    [
      "sharedWalletId",
      "payerId",
      "amount",
      "date",
      "description",
      "categoryId",
      "splitType",
      "paidFrom",
    ],
    true,
  ),
  SharedTransaction: object({
    id,
    ...transaction,
    createdBy: id,
    payerName: { type: "string" },
    walletName: { type: "string" },
    categoryName: { type: "string" },
    splits: {
      type: "array",
      items: object({
        userId: id,
        name: { type: "string" },
        shareAmount: { type: "integer", minimum: 0 },
      }),
    },
  }),
  Settlement: object({
    id,
    fromUserId: id,
    toUserId: id,
    fromName: { type: "string" },
    toName: { type: "string" },
    amount,
    status: { type: "string", enum: ["pending", "pending_confirm", "paid"] },
    sourceTransactionId: id,
    notes: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
    markedAt: { type: "string", format: "date-time", nullable: true },
    paidAt: { type: "string", format: "date-time", nullable: true },
  }),
  SettlementAction: object(
    { notes: { type: "string", maxLength: 1000 } },
    [],
    true,
  ),
  DebtSummary: object({
    amount: { type: "integer", minimum: 0 },
    fromUserId: { ...id, nullable: true },
    toUserId: { ...id, nullable: true },
    fromName: { type: "string", nullable: true },
    toName: { type: "string", nullable: true },
    outstandingCount: { type: "integer" },
    pendingConfirmation: { type: "integer" },
    readOnly: { type: "boolean" },
  }),
  SharedGoalInput: object(goal, ["name", "targetAmount"], true),
  SharedGoalUpdate: object(goal, [], true),
  SharedGoal: object({
    id,
    ...goal,
    savedAmount: { type: "integer" },
    progress: { type: "number" },
  }),
  SharedFunds: object({
    items: { type: "array", items: ref("SharedWallet") },
    coupleId: id,
    readOnly: { type: "boolean" },
    role: { type: "string", enum: ["owner", "member"] },
    members: {
      type: "array",
      items: object({
        id,
        name: { type: "string" },
        active: { type: "boolean" },
      }),
    },
  }),
  SharedDashboard: object({
    month: { type: "string" },
    readOnly: { type: "boolean" },
    totalBalance: { type: "integer" },
    monthExpense: { type: "integer" },
    summary: ref("DebtSummary"),
    recent: { type: "array", items: ref("SharedTransaction") },
    goals: { type: "array", items: ref("SharedGoal") },
    categories: {
      type: "array",
      items: object({ categoryId: id, name: { type: "string" }, amount }),
    },
  }),
};
const parameters = [
  {
    name: "coupleId",
    in: "query",
    description: "Thành viên cũ dùng để xem hành trình archived; chỉ đọc.",
    schema: id,
  },
];
const paginated = [
  ...parameters,
  ...["from", "to", "sharedWalletId", "status"].map((name) => ({
    name,
    in: "query",
    schema: { type: "string" },
  })),
  ...["page", "limit"].map((name) => ({
    name,
    in: "query",
    schema: {
      type: "integer",
      minimum: 1,
      maximum: name === "limit" ? 100 : 1000000,
    },
  })),
];
function operation(
  summary: string,
  response?: unknown,
  input?: string,
  code = 200,
  params: unknown[] = parameters,
) {
  return {
    tags: ["Tài chính chung"],
    summary,
    security: [{ bearerAuth: [] }],
    parameters: params,
    ...(input
      ? {
          requestBody: {
            required: true,
            content: { "application/json": { schema: ref(input) } },
          },
        }
      : {}),
    responses: {
      [code]: {
        description: "Thành công",
        ...(response
          ? { content: { "application/json": { schema: response } } }
          : {}),
      },
      ...Object.fromEntries(
        [400, 401, 403, 404, 409, 422].map((code) => [
          code,
          {
            description: "Lỗi nghiệp vụ hoặc quyền truy cập",
            content: { "application/json": { schema: ref("Error") } },
          },
        ]),
      ),
    },
  };
}
const pathId = [{ name: "id", in: "path", required: true, schema: id }];
const list = (name: string) =>
  object({
    items: { type: "array", items: ref(name) },
    total: { type: "integer" },
    page: { type: "integer" },
    limit: { type: "integer" },
    readOnly: { type: "boolean" },
  });
export const sharedPaths = {
  "/shared-wallets": {
    get: operation("Các quỹ và thành viên có quyền đọc", ref("SharedFunds")),
    post: operation(
      "Tạo quỹ số dư 0",
      ref("SharedWallet"),
      "SharedWalletInput",
      201,
      [],
    ),
  },
  "/shared-wallets/{id}": {
    put: operation(
      "Sửa tên/lưu trữ hoặc mở quỹ",
      ref("SharedWallet"),
      "SharedWalletUpdate",
      200,
      pathId,
    ),
    delete: operation(
      "Xóa quỹ chưa từng có lịch sử",
      undefined,
      undefined,
      204,
      pathId,
    ),
  },
  "/shared-wallets/{id}/contribute": {
    post: operation(
      "Ghi nhận tiền đã nạp; không tự trừ ví cá nhân",
      object({ wallet: ref("SharedWallet"), contributionId: id }),
      "SharedContributionInput",
      201,
      pathId,
    ),
  },
  "/shared-wallets/{id}/contributions": {
    get: operation(
      "Lịch sử nạp quỹ",
      list("SharedContribution"),
      undefined,
      200,
      [...pathId, ...paginated],
    ),
  },
  "/shared-transactions": {
    get: operation(
      "Chi chung theo quỹ/ngày, phân trang",
      list("SharedTransaction"),
      undefined,
      200,
      paginated,
    ),
    post: operation(
      "Ghi chi và split nguyên tử; personal sinh nợ, fund trừ quỹ",
      ref("SharedTransaction"),
      "SharedTransactionInput",
      201,
      [],
    ),
  },
  "/shared-transactions/{id}": {
    get: operation(
      "Chi tiết và phần chia",
      ref("SharedTransaction"),
      undefined,
      200,
      [...pathId, ...parameters],
    ),
    delete: operation(
      "Xóa bởi creator/owner; chặn paid/pending_confirm",
      undefined,
      undefined,
      204,
      pathId,
    ),
  },
  "/settlements": {
    get: operation(
      "Công nợ hoặc lịch sử paid; lọc ngày tạo khoản nợ",
      list("Settlement"),
      undefined,
      200,
      paginated,
    ),
  },
  "/settlements/summary": {
    get: operation(
      "Công nợ ròng chưa hoàn tất; không tự bù trừ trạng thái",
      ref("DebtSummary"),
    ),
  },
  ...Object.fromEntries(
    ["mark-paid", "confirm", "reject"].map((mode) => [
      `/settlements/{id}/${mode}`,
      {
        put: operation(
          mode === "mark-paid"
            ? "Người nợ báo đã chuyển ngoài ứng dụng"
            : mode === "confirm"
              ? "Người nhận xác nhận đủ tiền"
              : "Người nhận từ chối và ghi chú",
          ref("Settlement"),
          "SettlementAction",
          200,
          pathId,
        ),
      },
    ]),
  ),
  "/shared-goals": {
    get: operation(
      "Mục tiêu chung",
      object({
        items: { type: "array", items: ref("SharedGoal") },
        readOnly: { type: "boolean" },
      }),
    ),
    post: operation(
      "Tạo mục tiêu chung",
      ref("SharedGoal"),
      "SharedGoalInput",
      201,
      [],
    ),
  },
  "/shared-goals/{id}": {
    put: operation(
      "Sửa mục tiêu chung",
      ref("SharedGoal"),
      "SharedGoalUpdate",
      200,
      pathId,
    ),
    delete: operation(
      "Ẩn mục tiêu, giữ lịch sử",
      undefined,
      undefined,
      204,
      pathId,
    ),
  },
  "/shared-goals/{id}/contribute": {
    post: operation(
      "Ghi nhận dành dụm, không trừ quỹ",
      ref("SharedGoal"),
      "SharedContributionInput",
      201,
      pathId,
    ),
  },
  "/shared-goals/{id}/contributions": {
    get: operation(
      "Lịch sử dành dụm",
      list("SharedContribution"),
      undefined,
      200,
      [...pathId, ...paginated],
    ),
  },
  "/shared-goals/{id}/contributions/{contributionId}": {
    delete: operation(
      "Hoàn tác bởi người góp/owner",
      undefined,
      undefined,
      204,
      [
        ...pathId,
        { name: "contributionId", in: "path", required: true, schema: id },
      ],
    ),
  },
  "/shared/dashboard": {
    get: operation(
      "Quỹ, chi tháng theo danh mục, công nợ, khoản gần đây và mục tiêu",
      ref("SharedDashboard"),
    ),
  },
};
