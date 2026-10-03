import { icons } from "./schema";
const id = { type: "string", pattern: "^[a-fA-F0-9]{24}$" };
const money = {
  type: "integer",
  minimum: 1,
  maximum: Number.MAX_SAFE_INTEGER,
  description: "Số nguyên VND an toàn; không dùng số thực.",
};
const signedMoney = {
  type: "integer",
  minimum: -Number.MAX_SAFE_INTEGER,
  maximum: Number.MAX_SAFE_INTEGER,
};
const date = {
  type: "string",
  description:
    "YYYY-MM-DD theo múi giờ hồ sơ (ghi lúc 12:00) hoặc ISO 8601 kèm offset.",
};
const icon = { type: "string", enum: icons };
const walletFields = {
  name: { type: "string", minLength: 1, maxLength: 80 },
  type: { type: "string", enum: ["cash", "bank", "ewallet"] },
  allowNegative: { type: "boolean", default: false },
  color: {
    type: "string",
    enum: ["#7E9B57", "#57713A", "#B9CC9A", "#E38FA9", "#B3577A"],
    default: "#7E9B57",
  },
  icon,
};
const categoryFields = {
  name: { type: "string", minLength: 1, maxLength: 60 },
  type: { type: "string", enum: ["income", "expense"] },
  icon,
};
const entryFields = {
  type: { type: "string", enum: ["income", "expense"] },
  amount: money,
  walletId: id,
  categoryId: id,
  date,
  description: { type: "string", minLength: 1, maxLength: 200 },
  notes: { type: "string", maxLength: 1000, default: "" },
  tags: {
    type: "array",
    maxItems: 10,
    items: { type: "string", minLength: 1, maxLength: 30 },
    default: [],
  },
};
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
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
const page = (name: string) =>
  object(
    {
      items: { type: "array", items: ref(name) },
      total: { type: "integer" },
      page: { type: "integer" },
      limit: { type: "integer" },
    },
    ["items", "total", "page", "limit"],
  );
export const financeSchemas = {
  Wallet: object(
    {
      ...walletFields,
      id,
      currency: { type: "string", enum: ["VND"] },
      balance: signedMoney,
      archived: { type: "boolean" },
      createdAt: { type: "string", format: "date-time" },
    },
    ["id", "name", "type", "balance", "archived"],
  ),
  WalletCreate: object(
    { ...walletFields, initialBalance: { ...money, minimum: 0, default: 0 } },
    ["name", "type"],
    true,
  ),
  WalletUpdate: {
    ...object({ ...walletFields, archived: { type: "boolean" } }, [], true),
    minProperties: 1,
  },
  WalletPage: page("Wallet"),
  Category: object({ ...categoryFields, id, isSystem: { type: "boolean" } }, [
    "id",
    "name",
    "type",
    "isSystem",
  ]),
  CategoryCreate: object(categoryFields, ["name", "type"], true),
  CategoryUpdate: { ...object(categoryFields, [], true), minProperties: 1 },
  CategoryDelete: object(
    {
      replacementId: {
        ...id,
        description:
          "Bắt buộc khi danh mục đã có lịch sử; danh mục thay thế phải cùng loại.",
      },
    },
    [],
    true,
  ),
  CategoryPage: page("Category"),
  FinancialEntry: object(
    {
      ...entryFields,
      id,
      categoryId: { ...id, nullable: true },
      kind: { type: "string", enum: ["transaction", "transfer", "opening"] },
      walletName: { type: "string" },
      walletColor: { type: "string" },
      walletArchived: { type: "boolean" },
      categoryName: { type: "string" },
      categoryIcon: { type: "string" },
      date: { type: "string", format: "date-time" },
      transferId: { type: "string", nullable: true },
      counterWalletId: { ...id, nullable: true },
    },
    ["id", "kind", "type", "amount", "walletId", "date", "description"],
  ),
  TransactionCreate: object(
    entryFields,
    ["type", "amount", "walletId", "categoryId", "date", "description"],
    true,
  ),
  TransactionUpdate: { ...object(entryFields, [], true), minProperties: 1 },
  TransactionPage: {
    ...page("FinancialEntry"),
    properties: {
      ...page("FinancialEntry").properties,
      summary: object(
        { income: signedMoney, expense: signedMoney, net: signedMoney },
        ["income", "expense", "net"],
      ),
    },
  },
  TransferCreate: object(
    {
      fromWalletId: id,
      toWalletId: id,
      amount: money,
      date,
      description: {
        type: "string",
        maxLength: 200,
        default: "Chuyển tiền giữa ví",
      },
    },
    ["fromWalletId", "toWalletId", "amount", "date"],
    true,
  ),
  TransferResult: object(
    {
      transferId: { type: "string" },
      items: {
        type: "array",
        minItems: 2,
        maxItems: 2,
        items: ref("FinancialEntry"),
      },
    },
    ["transferId", "items"],
  ),
  DuplicateCreate: object({ date }, [], true),
  ReconcileInput: object(
    { repair: { type: "boolean", default: false } },
    [],
    true,
  ),
  ReconcileResult: object(
    {
      walletId: id,
      actualBalance: signedMoney,
      expectedBalance: signedMoney,
      difference: signedMoney,
      matched: { type: "boolean" },
      repaired: { type: "boolean" },
    },
    [
      "walletId",
      "actualBalance",
      "expectedBalance",
      "difference",
      "matched",
      "repaired",
    ],
  ),
  FinanceDashboard: object({
    month: { type: "string", example: "2026-10" },
    timezone: { type: "string" },
    totalBalance: signedMoney,
    income: signedMoney,
    expense: signedMoney,
    incomeChange: { type: "number", nullable: true },
    expenseChange: { type: "number", nullable: true },
    wallets: { type: "array", items: ref("Wallet") },
    spending: {
      type: "array",
      items: object({
        categoryId: { type: "string" },
        name: { type: "string" },
        amount: money,
      }),
    },
    recent: { type: "array", maxItems: 5, items: ref("FinancialEntry") },
  }),
};
const parameter = (name: string, schema: unknown, description?: string) => ({
  name,
  in: "query",
  schema,
  description,
});
const pagination = [
  parameter("page", {
    type: "integer",
    minimum: 1,
    maximum: 1000000,
    default: 1,
  }),
  parameter("limit", {
    type: "integer",
    minimum: 1,
    maximum: 100,
    default: 20,
  }),
];
const pathId = { name: "id", in: "path", required: true, schema: id };
const json = (name: string) => ({
  content: { "application/json": { schema: ref(name) } },
});
const errors = Object.fromEntries(
  [400, 401, 403, 404, 409, 422, 429].map((code) => [
    code,
    {
      description:
        code === 404
          ? "Không tồn tại hoặc không thuộc người đang đăng nhập"
          : "Lỗi chuẩn; 409 cho thiếu số dư, ví lưu trữ hoặc xung đột",
      ...json("Error"),
    },
  ]),
);
function operation(
  summary: string,
  result?: string,
  input?: string,
  parameters: unknown[] = [],
  created = false,
) {
  return {
    summary,
    tags: ["Tài chính cá nhân"],
    security: [{ bearerAuth: [] }],
    parameters,
    ...(input ? { requestBody: { required: true, ...json(input) } } : {}),
    responses: {
      [result ? (created ? 201 : 200) : 204]: {
        description: result ? "Thành công" : "Đã xóa",
        ...(result ? json(result) : {}),
      },
      ...errors,
    },
  };
}
const historyParams = [
  ...pagination,
  parameter(
    "from",
    { type: "string", format: "date" },
    "Ngày bắt đầu, theo múi giờ hồ sơ",
  ),
  parameter(
    "to",
    { type: "string", format: "date" },
    "Ngày kết thúc, bao gồm toàn bộ ngày",
  ),
  parameter("walletId", id),
  parameter("categoryId", id),
  parameter("type", {
    type: "string",
    enum: ["income", "expense", "transfer", "opening"],
  }),
  parameter(
    "search",
    { type: "string", maxLength: 100 },
    "Tìm chuỗi thường trong mô tả, ghi chú, nhãn",
  ),
  parameter("sort", {
    type: "string",
    enum: ["date_desc", "date_asc", "amount_desc", "amount_asc"],
    default: "date_desc",
  }),
];
export const financePaths = {
  "/wallets": {
    get: operation("Danh sách ví, gồm cả ví lưu trữ", "WalletPage", undefined, [
      ...pagination,
      parameter("archived", { type: "string", enum: ["true", "false"] }),
    ]),
    post: operation(
      "Tạo ví và dòng số dư ban đầu nguyên tử",
      "Wallet",
      "WalletCreate",
      [],
      true,
    ),
  },
  "/wallets/{id}": {
    get: operation("Xem ví của mình", "Wallet", undefined, [pathId]),
    put: operation(
      "Sửa ví, lưu trữ hoặc khôi phục; không ghi đè balance",
      "Wallet",
      "WalletUpdate",
      [pathId],
    ),
    delete: operation("Xóa ví chưa từng có lịch sử", undefined, undefined, [
      pathId,
    ]),
  },
  "/wallets/transfer": {
    post: operation(
      "Chuyển tiền hai ví, ghi hai dòng và hai số dư trong một transaction",
      "TransferResult",
      "TransferCreate",
      [],
      true,
    ),
  },
  "/wallets/{id}/reconcile": {
    post: operation(
      "Đối soát sổ; chỉ sửa khi repair=true",
      "ReconcileResult",
      "ReconcileInput",
      [pathId],
    ),
  },
  "/categories": {
    get: operation("Danh mục mặc định và riêng", "CategoryPage", undefined, [
      ...pagination,
      parameter("type", { type: "string", enum: ["income", "expense"] }),
    ]),
    post: operation(
      "Tạo danh mục riêng",
      "Category",
      "CategoryCreate",
      [],
      true,
    ),
  },
  "/categories/{id}": {
    put: operation(
      "Sửa danh mục riêng; không đổi loại nếu có lịch sử",
      "Category",
      "CategoryUpdate",
      [pathId],
    ),
    delete: operation(
      "Xóa danh mục riêng, chuyển lịch sử sang danh mục thay thế",
      undefined,
      "CategoryDelete",
      [pathId],
    ),
  },
  "/transactions": {
    get: operation(
      "Lịch sử và tổng thu/chi toàn kết quả lọc; loại trừ opening và transfer khỏi tổng",
      "TransactionPage",
      undefined,
      historyParams,
    ),
    post: operation(
      "Ghi giao dịch và cập nhật ví nguyên tử",
      "FinancialEntry",
      "TransactionCreate",
      [],
      true,
    ),
  },
  "/transactions/{id}": {
    get: operation("Xem giao dịch của mình", "FinancialEntry", undefined, [
      pathId,
    ]),
    put: operation(
      "Sửa giao dịch thường, hoàn nguyên và áp dụng số dư nguyên tử",
      "FinancialEntry",
      "TransactionUpdate",
      [pathId],
    ),
    delete: operation(
      "Xóa và hoàn nguyên; với chuyển tiền xóa cả cặp",
      undefined,
      undefined,
      [pathId],
    ),
  },
  "/transactions/{id}/duplicate": {
    post: operation(
      "Nhân bản giao dịch thường vào hôm nay hoặc ngày chỉ định",
      "FinancialEntry",
      "DuplicateCreate",
      [pathId],
      true,
    ),
  },
  "/finance/dashboard": {
    get: operation(
      "Tổng số dư, thu/chi tháng, so sánh tháng trước, donut và 5 dòng mới nhất",
      "FinanceDashboard",
    ),
  },
};
