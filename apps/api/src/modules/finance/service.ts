import { ClientSession, FilterQuery, Types } from "mongoose";
import { AppError } from "../../utils/AppError";
import {
  addMoney,
  sumMoney,
  moneyEffect,
  decimalMoney,
} from "../../utils/money";
import { parseFinancialDate, dateBounds, monthBounds } from "../../utils/dates";
import { inTransaction } from "../../utils/transaction";
import { userRepository } from "../users/repository";
import { financeRepository as repo } from "./repository";
import {
  WalletRecord,
  CategoryRecord,
  TransactionRecord,
  FinancialTransaction,
} from "./models";
import * as schema from "./schema";
import { randomUUID } from "crypto";
const escapeSearch = (value: string) =>
  Array.from(value)
    .map((character) =>
      [
        ".",
        "*",
        "+",
        "?",
        "^",
        "$",
        "{",
        "}",
        "(",
        ")",
        "|",
        "[",
        "]",
        String.fromCharCode(92),
      ].includes(character)
        ? String.fromCharCode(92) + character
        : character,
    )
    .join("");
const notFound = () =>
  new AppError(404, "NOT_FOUND", "Không tìm thấy tài nguyên.");
async function readUser(userId: string, session: ClientSession) {
  const user = await userRepository.byId(userId, session);
  if (!user) throw notFound();
  return user;
}
async function lockUser(userId: string, session: ClientSession) {
  const user = await readUser(userId, session);
  if (!(await userRepository.touch(userId, user.securityVersion, session)))
    throw notFound();
  return user;
}
async function requireWallet(
  userId: string,
  id: string,
  session: ClientSession,
  allowArchived = false,
) {
  const wallet = await repo.wallet(userId, id, session);
  if (!wallet) throw notFound();
  if (wallet.archived && !allowArchived)
    throw new AppError(
      409,
      "WALLET_ARCHIVED",
      "Ví đã được lưu trữ. Hãy mở lại ví trước khi thay đổi giao dịch.",
    );
  return wallet;
}
async function requireCategory(
  userId: string,
  id: string,
  type: string,
  session: ClientSession,
) {
  const category = await repo.category(userId, id, session);
  if (!category) throw notFound();
  if (category.type !== type)
    throw new AppError(
      400,
      "CATEGORY_TYPE_MISMATCH",
      "Danh mục phải cùng loại thu hoặc chi với giao dịch.",
    );
  return category;
}
function publicWallet(wallet: WalletRecord) {
  return {
    id: wallet.id as string,
    name: wallet.name,
    type: wallet.type,
    currency: wallet.currency,
    balance: wallet.balance,
    allowNegative: wallet.allowNegative,
    archived: wallet.archived,
    color: wallet.color,
    icon: wallet.icon,
    createdAt: wallet.createdAt,
  };
}
function publicCategory(category: CategoryRecord) {
  return {
    id: category.id as string,
    name: category.name,
    type: category.type,
    icon: category.icon,
    isSystem: category.userId === null,
  };
}
function publicEntry(
  entry: TransactionRecord,
  wallets: WalletRecord[],
  categories: CategoryRecord[],
) {
  const wallet = wallets.find((w) => w.id === entry.walletId.toString());
  const category = categories.find(
    (c) => c.id === entry.categoryId?.toString(),
  );
  return {
    id: entry.id as string,
    type: entry.type,
    kind: entry.kind,
    amount: entry.amount,
    walletId: entry.walletId.toString(),
    walletName: wallet?.name ?? "Ví",
    walletColor: wallet?.color ?? "#7E9B57",
    walletArchived: wallet?.archived ?? false,
    categoryId: entry.categoryId?.toString() ?? null,
    categoryName:
      category?.name ??
      (entry.kind === "transfer" ? "Chuyển ví" : "Số dư ban đầu"),
    categoryIcon: category?.icon ?? "Wallet",
    date: entry.date,
    description: entry.description,
    notes: entry.notes,
    tags: entry.tags,
    transferId: entry.transferId,
    counterWalletId: entry.counterWalletId?.toString() ?? null,
  };
}
function paginate<T>(items: T[], page: number, limit: number) {
  return {
    items: items.slice((page - 1) * limit, page * limit),
    total: items.length,
    page,
    limit,
  };
}
async function applyDeltas(
  userId: string,
  deltas: Map<string, number>,
  session: ClientSession,
) {
  for (const [id, delta] of [...deltas].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const wallet = await requireWallet(userId, id, session);
    const balance = addMoney(wallet.balance, delta);
    if (balance < 0 && !wallet.allowNegative)
      throw new AppError(
        422,
        "INSUFFICIENT_BALANCE",
        "Số dư ví không đủ cho thay đổi này.",
      );
    wallet.balance = balance;
    wallet.revision++;
    await repo.saveWallet(wallet, session);
  }
}
async function createEntry(
  userId: string,
  input: schema.TransactionInput,
  timeZone: string,
  session: ClientSession,
) {
  await requireWallet(userId, input.walletId, session);
  await requireCategory(userId, input.categoryId, input.type, session);
  await applyDeltas(
    userId,
    new Map([[input.walletId, moneyEffect(input.type, input.amount)]]),
    session,
  );
  const [entry] = await repo.createEntries(
    [
      {
        ...input,
        userId,
        date: parseFinancialDate(input.date, timeZone),
        kind: "transaction",
      },
    ],
    session,
  );
  return entry;
}
async function viewEntry(
  userId: string,
  entry: TransactionRecord,
  session: ClientSession,
) {
  const wallets = await repo.wallets(userId, session);
  const categories = await repo.categories(userId, session);
  return publicEntry(entry, wallets, categories);
}
async function categoryMutation<T>(work: () => Promise<T>) {
  try {
    return await work();
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000
    )
      throw new AppError(
        409,
        "CATEGORY_EXISTS",
        "Danh mục cùng tên và loại đã tồn tại.",
      );
    throw error;
  }
}
function transactionFilter(
  userId: string,
  query: schema.TransactionQuery,
  timeZone: string,
): FilterQuery<TransactionRecord> {
  const filter: FilterQuery<TransactionRecord> = {
    userId: new Types.ObjectId(userId),
    deletedAt: null,
  };
  if (query.walletId) filter.walletId = new Types.ObjectId(query.walletId);
  if (query.categoryId)
    filter.categoryId = new Types.ObjectId(query.categoryId);
  if (query.type === "transfer" || query.type === "opening")
    filter.kind = query.type;
  else if (query.type) {
    filter.type = query.type;
    filter.kind = "transaction";
  }
  if (query.search)
    filter.description = { $regex: escapeSearch(query.search), $options: "i" };
  const { lower, upper } = dateBounds(query.from, query.to, timeZone);
  if (lower || upper)
    filter.date = {
      ...(lower ? { $gte: lower } : {}),
      ...(upper ? { $lt: upper } : {}),
    };
  return filter;
}
async function summarize(
  filter: FilterQuery<TransactionRecord>,
  session: ClientSession,
) {
  const result = await FinancialTransaction.aggregate<{
    total: number;
    income: unknown;
    expense: unknown;
  }>([
    { $match: filter },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        income: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$kind", "transaction"] },
                  { $eq: ["$type", "income"] },
                ],
              },
              { $toDecimal: { $toLong: "$amount" } },
              0,
            ],
          },
        },
        expense: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$kind", "transaction"] },
                  { $eq: ["$type", "expense"] },
                ],
              },
              { $toDecimal: { $toLong: "$amount" } },
              0,
            ],
          },
        },
      },
    },
  ]).session(session);
  return {
    total: result[0]?.total ?? 0,
    income: decimalMoney(result[0]?.income ?? 0),
    expense: decimalMoney(result[0]?.expense ?? 0),
  };
}
const sortBy = {
  date_desc: { date: -1 as const, _id: -1 as const },
  date_asc: { date: 1 as const, _id: 1 as const },
  amount_desc: { amount: -1 as const, _id: -1 as const },
  amount_asc: { amount: 1 as const, _id: 1 as const },
};
export const financeService = {
  async wallets(userId: string, raw: unknown) {
    const query = schema.walletQuery.parse(raw);
    return inTransaction(async (session) => {
      await readUser(userId, session);
      let wallets = await repo.wallets(userId, session);
      if (query.archived)
        wallets = wallets.filter(
          (w) => w.archived === (query.archived === "true"),
        );
      return paginate(wallets.map(publicWallet), query.page, query.limit);
    });
  },
  async wallet(userId: string, rawId: unknown) {
    const id = schema.objectId.parse(rawId);
    return inTransaction(async (session) => {
      await readUser(userId, session);
      return publicWallet(await requireWallet(userId, id, session, true));
    });
  },
  async createWallet(userId: string, raw: unknown) {
    const input = schema.walletCreate.parse(raw);
    return inTransaction(async (session) => {
      await lockUser(userId, session);
      const { initialBalance, ...fields } = input;
      const [wallet] = await repo.createWallet(
        { ...fields, userId, balance: initialBalance },
        session,
      );
      if (initialBalance > 0)
        await repo.createEntries(
          [
            {
              userId,
              walletId: wallet._id,
              type: "income",
              kind: "opening",
              amount: initialBalance,
              date: new Date(),
              description: "Số dư ban đầu",
              categoryId: null,
            },
          ],
          session,
        );
      return publicWallet(wallet);
    });
  },
  async updateWallet(userId: string, rawId: unknown, raw: unknown) {
    const id = schema.objectId.parse(rawId),
      input = schema.walletUpdate.parse(raw);
    return inTransaction(async (session) => {
      await lockUser(userId, session);
      const wallet = await requireWallet(userId, id, session, true);
      if (input.allowNegative === false && wallet.balance < 0)
        throw new AppError(
          422,
          "NEGATIVE_BALANCE",
          "Ví đang âm. Hãy đưa số dư về 0 trở lên trước khi tắt cho phép âm.",
        );
      Object.assign(wallet, input);
      wallet.revision++;
      await repo.saveWallet(wallet, session);
      return publicWallet(wallet);
    });
  },
  async deleteWallet(userId: string, rawId: unknown) {
    const id = schema.objectId.parse(rawId);
    await inTransaction(async (session) => {
      await lockUser(userId, session);
      const wallet = await requireWallet(userId, id, session, true);
      if (await repo.walletHistory(userId, id, session))
        throw new AppError(
          409,
          "WALLET_HAS_TRANSACTIONS",
          "Ví đã có giao dịch. Hãy lưu trữ ví thay vì xóa.",
        );
      wallet.deletedAt = new Date();
      await repo.saveWallet(wallet, session);
    });
  },
  async reconcile(userId: string, rawId: unknown, raw: unknown) {
    const id = schema.objectId.parse(rawId),
      input = schema.reconcileSchema.parse(raw);
    return inTransaction(async (session) => {
      await lockUser(userId, session);
      const wallet = await requireWallet(userId, id, session, true);
      const entries = await repo.entries(
        { userId, walletId: id, deletedAt: null },
        session,
      );
      const expectedBalance = sumMoney(
          entries.map((e) => moneyEffect(e.type, e.amount)),
        ),
        actualBalance = wallet.balance,
        difference = addMoney(expectedBalance, -actualBalance);
      if (input.repair) {
        if (expectedBalance < 0 && !wallet.allowNegative)
          throw new AppError(
            422,
            "NEGATIVE_BALANCE",
            "Sổ giao dịch đang âm. Cần kiểm tra trước khi sửa số dư.",
          );
        wallet.balance = expectedBalance;
        wallet.revision++;
        await repo.saveWallet(wallet, session);
      }
      return {
        walletId: id,
        actualBalance,
        expectedBalance,
        difference,
        matched: difference === 0,
        repaired: input.repair && difference !== 0,
      };
    });
  },
  async categories(userId: string, raw: unknown) {
    const query = schema.categoryQuery.parse(raw);
    return inTransaction(async (session) => {
      await readUser(userId, session);
      let categories = await repo.categories(userId, session);
      if (query.type)
        categories = categories.filter((c) => c.type === query.type);
      return paginate(categories.map(publicCategory), query.page, query.limit);
    });
  },
  async createCategory(userId: string, raw: unknown) {
    const input = schema.categoryCreate.parse(raw);
    return categoryMutation(() =>
      inTransaction(async (session) => {
        await lockUser(userId, session);
        const [category] = await repo.createCategory(
          {
            ...input,
            userId,
            nameKey: input.name.normalize("NFKC").toLowerCase(),
          },
          session,
        );
        return publicCategory(category);
      }),
    );
  },
  async updateCategory(userId: string, rawId: unknown, raw: unknown) {
    const id = schema.objectId.parse(rawId),
      input = schema.categoryUpdate.parse(raw);
    return categoryMutation(() =>
      inTransaction(async (session) => {
        await lockUser(userId, session);
        const category = await repo.category(userId, id, session);
        if (!category) throw notFound();
        if (category.userId === null)
          throw new AppError(
            403,
            "SYSTEM_CATEGORY",
            "Không được sửa danh mục hệ thống.",
          );
        if (
          input.type &&
          input.type !== category.type &&
          (await repo.categoryHistory(userId, id, session))
        )
          throw new AppError(
            409,
            "CATEGORY_IN_USE",
            "Danh mục đã có giao dịch nên không thể đổi loại thu/chi.",
          );
        Object.assign(category, input);
        category.nameKey = category.name.normalize("NFKC").toLowerCase();
        category.revision++;
        await repo.saveCategory(category, session);
        return publicCategory(category);
      }),
    );
  },
  async deleteCategory(userId: string, rawId: unknown, raw: unknown) {
    const id = schema.objectId.parse(rawId),
      input = schema.categoryDelete.parse(raw);
    await inTransaction(async (session) => {
      await lockUser(userId, session);
      const category = await repo.category(userId, id, session);
      if (!category) throw notFound();
      if (category.userId === null)
        throw new AppError(
          403,
          "SYSTEM_CATEGORY",
          "Không được xóa danh mục hệ thống.",
        );
      const hasHistory = await repo.categoryHistory(userId, id, session);
      if (hasHistory) {
        if (!input.replacementId || input.replacementId === id)
          throw new AppError(
            400,
            "REPLACEMENT_REQUIRED",
            "Danh mục đã có giao dịch. Hãy chọn danh mục thay thế.",
          );
        await requireCategory(
          userId,
          input.replacementId,
          category.type,
          session,
        );
        await repo.replaceCategory(userId, id, input.replacementId, session);
      }
      category.deletedAt = new Date();
      await repo.saveCategory(category, session);
    });
  },
  async createTransaction(userId: string, raw: unknown) {
    const input = schema.transactionCreate.parse(raw);
    return inTransaction(async (session) => {
      const user = await lockUser(userId, session);
      return viewEntry(
        userId,
        await createEntry(userId, input, user.timezone, session),
        session,
      );
    });
  },
  async transaction(userId: string, rawId: unknown) {
    const id = schema.objectId.parse(rawId);
    return inTransaction(async (session) => {
      await readUser(userId, session);
      const entry = await repo.transaction(userId, id, session);
      if (!entry) throw notFound();
      return viewEntry(userId, entry, session);
    });
  },
  async updateTransaction(userId: string, rawId: unknown, raw: unknown) {
    const id = schema.objectId.parse(rawId),
      patch = schema.transactionUpdate.parse(raw);
    return inTransaction(async (session) => {
      const user = await lockUser(userId, session);
      const entry = await repo.transaction(userId, id, session);
      if (!entry) throw notFound();
      if (entry.kind !== "transaction")
        throw new AppError(
          409,
          "LINKED_ENTRY",
          "Không sửa riêng dòng chuyển ví hoặc số dư ban đầu.",
        );
      const input = schema.transactionCreate.parse({
        type: entry.type,
        amount: entry.amount,
        walletId: entry.walletId.toString(),
        categoryId: entry.categoryId!.toString(),
        date: entry.date.toISOString(),
        description: entry.description,
        notes: entry.notes,
        tags: entry.tags,
        ...patch,
      });
      await requireWallet(userId, entry.walletId.toString(), session);
      await requireWallet(userId, input.walletId, session);
      await requireCategory(userId, input.categoryId, input.type, session);
      const deltas = new Map<string, number>();
      deltas.set(
        entry.walletId.toString(),
        -moneyEffect(entry.type, entry.amount),
      );
      deltas.set(
        input.walletId,
        addMoney(
          deltas.get(input.walletId) ?? 0,
          moneyEffect(input.type, input.amount),
        ),
      );
      await applyDeltas(userId, deltas, session);
      Object.assign(entry, input, {
        date: parseFinancialDate(input.date, user.timezone),
      });
      await repo.saveEntry(entry, session);
      return viewEntry(userId, entry, session);
    });
  },
  async deleteTransaction(userId: string, rawId: unknown) {
    const id = schema.objectId.parse(rawId);
    await inTransaction(async (session) => {
      await lockUser(userId, session);
      const entry = await repo.transaction(userId, id, session);
      if (!entry) throw notFound();
      if (entry.kind === "opening")
        throw new AppError(
          409,
          "OPENING_ENTRY",
          "Không xóa số dư ban đầu. Hãy ghi một giao dịch điều chỉnh nếu cần.",
        );
      let entries = [entry];
      if (entry.kind === "transfer") {
        entries = await repo.entries(
          {
            userId,
            transferId: entry.transferId,
            kind: "transfer",
            deletedAt: null,
          },
          session,
        );
        if (
          entries.length !== 2 ||
          entries[0].type === entries[1].type ||
          entries[0].amount !== entries[1].amount
        )
          throw new AppError(
            409,
            "INCONSISTENT_TRANSFER",
            "Cặp chuyển ví không khớp. Cần kiểm tra sổ giao dịch.",
          );
      }
      const deltas = new Map<string, number>();
      for (const item of entries) {
        const walletId = item.walletId.toString();
        deltas.set(
          walletId,
          addMoney(
            deltas.get(walletId) ?? 0,
            -moneyEffect(item.type, item.amount),
          ),
        );
      }
      await applyDeltas(userId, deltas, session);
      await repo.softDeleteEntries(
        userId,
        entries.map((e) => e.id as string),
        session,
      );
    });
  },
  async duplicate(userId: string, rawId: unknown, raw: unknown) {
    const id = schema.objectId.parse(rawId),
      input = schema.duplicateSchema.parse(raw);
    return inTransaction(async (session) => {
      const user = await lockUser(userId, session);
      const old = await repo.transaction(userId, id, session);
      if (!old) throw notFound();
      if (old.kind !== "transaction")
        throw new AppError(
          409,
          "LINKED_ENTRY",
          "Chỉ nhân bản giao dịch thu/chi thông thường.",
        );
      const copy = schema.transactionCreate.parse({
        type: old.type,
        amount: old.amount,
        walletId: old.walletId.toString(),
        categoryId: old.categoryId!.toString(),
        date: input.date ?? new Date().toISOString(),
        description: old.description.slice(0, 188) + " (bản sao)",
        notes: old.notes,
        tags: old.tags,
      });
      return viewEntry(
        userId,
        await createEntry(userId, copy, user.timezone, session),
        session,
      );
    });
  },
  async transfer(userId: string, raw: unknown) {
    const input = schema.transferCreate.parse(raw);
    if (input.fromWalletId === input.toWalletId)
      throw new AppError(
        400,
        "SAME_WALLET",
        "Ví gửi và ví nhận phải khác nhau.",
      );
    return inTransaction(async (session) => {
      const user = await lockUser(userId, session);
      await requireWallet(userId, input.fromWalletId, session);
      await requireWallet(userId, input.toWalletId, session);
      await applyDeltas(
        userId,
        new Map([
          [input.fromWalletId, -input.amount],
          [input.toWalletId, input.amount],
        ]),
        session,
      );
      const transferId = randomUUID();
      const common = {
        userId,
        amount: input.amount,
        date: parseFinancialDate(input.date, user.timezone),
        description: input.description || "Chuyển tiền giữa ví",
        kind: "transfer",
        transferId,
      };
      const entries = await repo.createEntries(
        [
          {
            ...common,
            walletId: input.fromWalletId,
            counterWalletId: input.toWalletId,
            type: "expense",
          },
          {
            ...common,
            walletId: input.toWalletId,
            counterWalletId: input.fromWalletId,
            type: "income",
          },
        ],
        session,
      );
      const wallets = await repo.wallets(userId, session);
      return {
        transferId,
        items: entries.map((e) => publicEntry(e, wallets, [])),
      };
    });
  },
  async transactions(userId: string, raw: unknown) {
    const query = schema.transactionQuery.parse(raw);
    return inTransaction(async (session) => {
      const user = await readUser(userId, session);
      const filter = transactionFilter(userId, query, user.timezone);
      const items = await repo
        .entries(filter, session)
        .sort(sortBy[query.sort])
        .skip((query.page - 1) * query.limit)
        .limit(query.limit);
      const summary = await summarize(filter, session);
      const wallets = await repo.wallets(userId, session),
        categories = await repo.categories(userId, session);
      return {
        items: items.map((e) => publicEntry(e, wallets, categories)),
        total: summary.total,
        page: query.page,
        limit: query.limit,
        summary: {
          income: summary.income,
          expense: summary.expense,
          net: addMoney(summary.income, -summary.expense),
        },
      };
    });
  },
  async dashboard(userId: string) {
    return inTransaction(async (session) => {
      const user = await readUser(userId, session),
        bounds = monthBounds(new Date(), user.timezone);
      const wallets = await repo.wallets(userId, session),
        categories = await repo.categories(userId, session);
      const current = await summarize(
        {
          userId: new Types.ObjectId(userId),
          deletedAt: null,
          date: { $gte: bounds.start, $lt: bounds.end },
        },
        session,
      );
      const previous = await summarize(
        {
          userId: new Types.ObjectId(userId),
          deletedAt: null,
          date: { $gte: bounds.previous, $lt: bounds.start },
        },
        session,
      );
      const groups = await FinancialTransaction.aggregate<{
        _id: Types.ObjectId;
        amount: unknown;
      }>([
        {
          $match: {
            userId: new Types.ObjectId(userId),
            deletedAt: null,
            kind: "transaction",
            type: "expense",
            date: { $gte: bounds.start, $lt: bounds.end },
          },
        },
        {
          $group: {
            _id: "$categoryId",
            amount: { $sum: { $toDecimal: { $toLong: "$amount" } } },
          },
        },
        { $sort: { amount: -1, _id: 1 } },
      ]).session(session);
      const spending = groups.slice(0, 5).map((item) => ({
        categoryId: item._id.toString(),
        name:
          categories.find((c) => c.id === item._id.toString())?.name ?? "Khác",
        amount: decimalMoney(item.amount),
      }));
      if (groups.length > 5)
        spending.push({
          categoryId: "other",
          name: "Khác (các danh mục còn lại)",
          amount: sumMoney(groups.slice(5).map((g) => decimalMoney(g.amount))),
        });
      const recent = await repo
        .entries({ userId, deletedAt: null }, session)
        .sort({ date: -1, _id: -1 })
        .limit(5);
      const change = (now: number, before: number) =>
        before === 0 ? null : Math.round(((now - before) / before) * 1000) / 10;
      return {
        month: bounds.month,
        timezone: user.timezone,
        totalBalance: sumMoney(wallets.map((w) => w.balance)),
        income: current.income,
        expense: current.expense,
        incomeChange: change(current.income, previous.income),
        expenseChange: change(current.expense, previous.expense),
        wallets: wallets.map(publicWallet),
        spending,
        recent: recent.map((e) => publicEntry(e, wallets, categories)),
      };
    });
  },
};
