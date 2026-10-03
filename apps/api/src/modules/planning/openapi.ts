import { financeSchemas, historyParams } from "../finance/openapi";
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const id = { type: "string", pattern: "^[a-fA-F0-9]{24}$" };
const day = { type: "string", format: "date" },
  month = { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" };
const money = { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER };
const signed = { ...money, minimum: -Number.MAX_SAFE_INTEGER };
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
const array = (name: string) => ({ type: "array", items: ref(name) });
const collection = (name: string) => object({ items: array(name) }, ["items"]);
const budgetFields = { categoryId: id, month, amount: money };
const goalFields = {
  name: { type: "string", minLength: 1, maxLength: 100 },
  targetAmount: money,
  deadline: { ...day, nullable: true },
  notes: { type: "string", maxLength: 1000, default: "" },
  color: {
    type: "string",
    enum: ["#7E9B57", "#E38FA9", "#57713A", "#B3577A"],
    default: "#7E9B57",
  },
};
const { date: transactionDate, ...entry } =
  financeSchemas.TransactionCreate.properties;
const recurringFields = {
  ...entry,
  frequency: { type: "string", enum: ["weekly", "monthly"] },
  nextDate: day,
  endDate: { ...day, nullable: true },
  enabled: { type: "boolean", default: true },
};
export const planningSchemas = {
  BudgetCreate: object(budgetFields, ["categoryId", "month", "amount"], true),
  BudgetUpdate: { ...object(budgetFields, [], true), minProperties: 1 },
  Budget: object(
    {
      ...budgetFields,
      id,
      categoryName: { type: "string" },
      categoryIcon: { type: "string" },
      spent: signed,
      remaining: signed,
      progress: { type: "number" },
      status: { type: "string", enum: ["healthy", "warning", "exceeded"] },
    },
    ["id", "categoryId", "month", "amount", "spent", "progress", "status"],
  ),
  BudgetList: object({ month, items: array("Budget") }),
  GoalCreate: object(goalFields, ["name", "targetAmount"], true),
  GoalUpdate: { ...object(goalFields, [], true), minProperties: 1 },
  Goal: object({
    ...goalFields,
    id,
    savedAmount: { ...money, minimum: 0 },
    progress: { type: "number" },
    createdAt: { type: "string", format: "date-time" },
  }),
  GoalList: collection("Goal"),
  ContributionCreate: object(
    {
      amount: money,
      date: transactionDate,
      notes: { type: "string", maxLength: 1000 },
    },
    ["amount", "date"],
    true,
  ),
  Contribution: object({
    id,
    amount: money,
    date: { type: "string", format: "date-time" },
    notes: { type: "string" },
  }),
  ContributionResult: object({
    goal: ref("Goal"),
    contribution: ref("Contribution"),
  }),
  ContributionPage: object({
    items: array("Contribution"),
    total: { type: "integer" },
    page: { type: "integer" },
    limit: { type: "integer" },
  }),
  RecurringCreate: object(
    recurringFields,
    [
      "type",
      "amount",
      "walletId",
      "categoryId",
      "description",
      "frequency",
      "nextDate",
    ],
    true,
  ),
  RecurringUpdate: { ...object(recurringFields, [], true), minProperties: 1 },
  Recurring: object({
    ...recurringFields,
    id,
    lastError: { type: "string", nullable: true },
    lastRunAt: { type: "string", format: "date-time", nullable: true },
  }),
  RecurringList: collection("Recurring"),
  RecurringRunResult: object({
    created: { type: "integer" },
    error: { type: "string", nullable: true },
    catchUpLimit: { type: "integer", example: 100 },
  }),
  ReportMonth: object({ month, income: signed, expense: signed, net: signed }),
  ReportCategory: object({
    categoryId: id,
    name: { type: "string" },
    amount: money,
    months: { type: "array", items: { ...money, minimum: 0 } },
  }),
  FinanceReport: object({
    timezone: { type: "string" },
    endMonth: month,
    months: array("ReportMonth"),
    categories: array("ReportCategory"),
    totalIncome: signed,
    totalExpense: signed,
    comparison: object({
      incomeChange: { type: "number", nullable: true },
      expenseChange: { type: "number", nullable: true },
    }),
  }),
  EmptyBody: object({}, [], true),
};
const parameter = (name: string, schema: unknown, inPath = false) => ({
  name,
  in: inPath ? "path" : "query",
  required: inPath,
  schema,
});
const pathId = parameter("id", id, true);
const json = (name: string) => ({
  content: { "application/json": { schema: ref(name) } },
});
const errors = Object.fromEntries(
  [400, 401, 404, 409, 422, 429].map((code) => [
    code,
    {
      description:
        "Lỗi chuẩn; tài nguyên không thuộc tài khoản trả 404; thiếu số dư hoặc overflow trả 422",
      ...json("Error"),
    },
  ]),
);
const op = (
  summary: string,
  result?: string,
  input?: string,
  parameters: unknown[] = [],
  created = false,
) => ({
  summary,
  tags: ["Kế hoạch tài chính"],
  security: [{ bearerAuth: [] }],
  parameters,
  ...(input ? { requestBody: { required: true, ...json(input) } } : {}),
  responses: {
    [result ? (created ? 201 : 200) : 204]: {
      description: "Thành công",
      ...(result ? json(result) : {}),
    },
    ...errors,
  },
});
const reportParameters = [
  parameter("months", { type: "integer", enum: [6, 12], default: 6 }),
  parameter("endMonth", month),
];
export const planningPaths = {
  "/budgets": {
    get: op(
      "Ngân sách tháng; chi thường theo múi giờ hồ sơ, nhắc ở 80/100%",
      "BudgetList",
      undefined,
      [parameter("month", month)],
    ),
    post: op(
      "Tạo ngân sách danh mục chi, duy nhất theo tháng",
      "Budget",
      "BudgetCreate",
      [],
      true,
    ),
  },
  "/budgets/{id}": {
    put: op("Sửa kế hoạch ngân sách", "Budget", "BudgetUpdate", [pathId]),
    delete: op("Xóa kế hoạch, giữ sổ giao dịch", undefined, undefined, [
      pathId,
    ]),
  },
  "/goals": {
    get: op("Mục tiêu cá nhân và số tiền đã dành dụm", "GoalList"),
    post: op("Tạo mục tiêu cá nhân", "Goal", "GoalCreate", [], true),
  },
  "/goals/{id}": {
    put: op("Sửa mục tiêu; không ghi đè savedAmount", "Goal", "GoalUpdate", [
      pathId,
    ]),
    delete: op(
      "Lưu mục tiêu vào dữ liệu đã xóa, giữ lịch sử",
      undefined,
      undefined,
      [pathId],
    ),
  },
  "/goals/{id}/contribute": {
    post: op(
      "Ghi nhận dành dụm nguyên tử; không trừ ví hoặc tính là chi",
      "ContributionResult",
      "ContributionCreate",
      [pathId],
      true,
    ),
  },
  "/goals/{id}/contributions": {
    get: op("Lịch sử dành dụm phân trang", "ContributionPage", undefined, [
      pathId,
      parameter("page", { type: "integer", minimum: 1, default: 1 }),
      parameter("limit", {
        type: "integer",
        minimum: 1,
        maximum: 100,
        default: 20,
      }),
    ]),
  },
  "/goals/{id}/contributions/{contributionId}": {
    delete: op(
      "Hoàn tác một lần ghi nhận và giảm savedAmount nguyên tử",
      undefined,
      undefined,
      [pathId, parameter("contributionId", id, true)],
    ),
  },
  "/recurring": {
    get: op("Lịch định kỳ cá nhân và lỗi kỳ gần nhất", "RecurringList"),
    post: op(
      "Tạo lịch tuần/tháng; kỳ quá khứ được chạy bù khi server hoạt động",
      "Recurring",
      "RecurringCreate",
      [],
      true,
    ),
  },
  "/recurring/{id}": {
    put: op(
      "Sửa hoặc bật/tạm dừng lịch; đổi nextDate đặt lại ngày neo",
      "Recurring",
      "RecurringUpdate",
      [pathId],
    ),
    delete: op(
      "Dừng và xóa lịch, giữ giao dịch đã sinh",
      undefined,
      undefined,
      [pathId],
    ),
  },
  "/recurring/{id}/run": {
    post: op(
      "Thử chạy tối đa 100 kỳ đến hạn; mỗi kỳ chỉ ghi một lần, lỗi thiếu tiền giữ nguyên ngày",
      "RecurringRunResult",
      "EmptyBody",
      [pathId],
    ),
  },
  "/reports/monthly": {
    get: op(
      "Thu/chi 6 hoặc 12 tháng, so sánh hai tháng cuối",
      "FinanceReport",
      undefined,
      reportParameters,
    ),
  },
  "/reports/by-category": {
    get: op(
      "Xu hướng danh mục chi theo cùng khoảng 6 hoặc 12 tháng",
      "FinanceReport",
      undefined,
      reportParameters,
    ),
  },
  "/transactions/export": {
    get: {
      ...op(
        "CSV UTF-8 BOM, cùng bộ lọc lịch sử, tối đa 10000 dòng, escape công thức",
      ),
      parameters: historyParams.filter(
        (p) => p.name !== "page" && p.name !== "limit",
      ),
      responses: {
        200: {
          description:
            "Tệp CSV có header và CRLF, opening/transfer cũng xuất nếu nằm trong bộ lọc",
          content: { "text/csv": { schema: { type: "string" } } },
        },
        ...errors,
      },
    },
  },
};
