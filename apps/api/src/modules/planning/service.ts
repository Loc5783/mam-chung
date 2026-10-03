import { ClientSession } from "mongoose";
import {
  Budget,
  Goal,
  GoalContribution,
  Recurring,
  RecurringRun,
} from "./models";
import { planningRepository as repo } from "./repository";
import { financeLedger } from "../finance/service";
import { financeRepository } from "../finance/repository";
import { transactionQuery, objectId } from "../finance/schema";
import { inTransaction } from "../../utils/transaction";
import { AppError } from "../../utils/AppError";
import { addMoney, sumMoney } from "../../utils/money";
import {
  dateBounds,
  monthBounds,
  localDateParts,
  parseFinancialDate,
} from "../../utils/dates";
import * as schema from "./schema";
const missing = () =>
  new AppError(404, "NOT_FOUND", "Không tìm thấy tài nguyên.");
export function calendarDate(year: number, month: number, day: number) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}
export function nextOccurrence(
  value: string,
  frequency: string,
  anchorDay: number,
) {
  const [y, m, d] = value.split("-").map(Number);
  if (frequency === "weekly")
    return calendarDate(y, m, d + 7)
      .toISOString()
      .slice(0, 10);
  const last = calendarDate(y, m + 2, 0).getUTCDate();
  return calendarDate(y, m + 1, Math.min(anchorDay, last))
    .toISOString()
    .slice(0, 10);
}
export function todayInZone(now: Date, zone: string) {
  const p = localDateParts(now, zone);
  return `${String(p.year).padStart(4, "0")}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
function goalDto(g: InstanceType<typeof Goal>) {
  return {
    id: g.id as string,
    name: g.name,
    targetAmount: g.targetAmount,
    savedAmount: g.savedAmount,
    deadline: g.deadline,
    notes: g.notes,
    color: g.color,
    progress: Math.round((g.savedAmount / g.targetAmount) * 1000) / 10,
    createdAt: g.createdAt,
  };
}
function recurringDto(r: InstanceType<typeof Recurring>) {
  return {
    id: r.id as string,
    type: r.type,
    amount: r.amount,
    walletId: r.walletId.toString(),
    categoryId: r.categoryId.toString(),
    description: r.description,
    notes: r.notes,
    tags: r.tags,
    frequency: r.frequency,
    nextDate: r.nextDate,
    endDate: r.endDate,
    enabled: r.enabled,
    lastError: r.lastError,
    lastRunAt: r.lastRunAt,
  };
}
async function budgetDto(
  b: InstanceType<typeof Budget>,
  userId: string,
  zone: string,
  session: ClientSession,
) {
  const [y, m] = b.month.split("-").map(Number);
  const last = calendarDate(y, m + 1, 0)
    .toISOString()
    .slice(0, 10);
  const bounds = dateBounds(b.month + "-01", last, zone);
  const entries = await repo.transactions(
    {
      userId,
      categoryId: b.categoryId,
      deletedAt: null,
      type: "expense",
      kind: "transaction",
      date: { $gte: bounds.lower, $lt: bounds.upper },
    },
    session,
  );
  const spent = sumMoney(entries.map((e) => e.amount));
  const category = await financeRepository.category(
    userId,
    b.categoryId.toString(),
    session,
  );
  const ratio = spent / b.amount;
  return {
    id: b.id as string,
    categoryId: b.categoryId.toString(),
    categoryName: category?.name ?? "Danh mục",
    categoryIcon: category?.icon ?? "Ellipsis",
    month: b.month,
    amount: b.amount,
    spent,
    remaining: addMoney(b.amount, -spent),
    progress: Math.round(ratio * 1000) / 10,
    status:
      spent >= b.amount
        ? "exceeded"
        : BigInt(spent) * 100n >= BigInt(b.amount) * 80n
          ? "warning"
          : "healthy",
  };
}
async function checkBudgetDuplicate(
  userId: string,
  categoryId: string,
  month: string,
  session: ClientSession,
  id?: string,
) {
  if (
    await Budget.exists({
      userId,
      categoryId,
      month,
      deletedAt: null,
      ...(id ? { _id: { $ne: id } } : {}),
    }).session(session)
  )
    throw new AppError(
      409,
      "BUDGET_EXISTS",
      "Danh mục đã có ngân sách cho tháng này.",
    );
}
export const planningService = {
  async budgets(userId: string, raw: unknown) {
    const query = schema.budgetQuery.parse(raw);
    return inTransaction(async (session) => {
      const user = await financeLedger.readUser(userId, session);
      const month = query.month ?? monthBounds(new Date(), user.timezone).month;
      const items = [];
      for (const b of await repo.budgets(userId, month, session))
        items.push(await budgetDto(b, userId, user.timezone, session));
      return { month, items };
    });
  },
  async createBudget(userId: string, raw: unknown) {
    const input = schema.budgetCreate.parse(raw);
    return inTransaction(async (session) => {
      const user = await financeLedger.lockUser(userId, session);
      await financeLedger.requireCategory(
        userId,
        input.categoryId,
        "expense",
        session,
      );
      await checkBudgetDuplicate(
        userId,
        input.categoryId,
        input.month,
        session,
      );
      const [b] = await Budget.create([{ ...input, userId }], { session });
      return budgetDto(b, userId, user.timezone, session);
    });
  },
  async updateBudget(userId: string, rawId: unknown, raw: unknown) {
    const id = objectId.parse(rawId),
      input = schema.budgetUpdate.parse(raw);
    return inTransaction(async (session) => {
      const user = await financeLedger.lockUser(userId, session),
        b = await repo.budget(userId, id, session);
      if (!b) throw missing();
      const categoryId = input.categoryId ?? b.categoryId.toString(),
        month = input.month ?? b.month;
      await financeLedger.requireCategory(
        userId,
        categoryId,
        "expense",
        session,
      );
      await checkBudgetDuplicate(userId, categoryId, month, session, id);
      Object.assign(b, input);
      await b.save({ session });
      return budgetDto(b, userId, user.timezone, session);
    });
  },
  async deleteBudget(userId: string, rawId: unknown) {
    const id = objectId.parse(rawId);
    await inTransaction(async (session) => {
      await financeLedger.lockUser(userId, session);
      const b = await repo.budget(userId, id, session);
      if (!b) throw missing();
      b.deletedAt = new Date();
      await b.save({ session });
    });
  },
  async goals(userId: string, raw: unknown) {
    schema.emptyQuery.parse(raw);
    return inTransaction(async (session) => {
      await financeLedger.readUser(userId, session);
      return { items: (await repo.goals(userId, session)).map(goalDto) };
    });
  },
  async createGoal(userId: string, raw: unknown) {
    const input = schema.goalCreate.parse(raw);
    return inTransaction(async (session) => {
      await financeLedger.lockUser(userId, session);
      const [g] = await Goal.create([{ ...input, userId }], { session });
      return goalDto(g);
    });
  },
  async updateGoal(userId: string, rawId: unknown, raw: unknown) {
    const id = objectId.parse(rawId),
      input = schema.goalUpdate.parse(raw);
    return inTransaction(async (session) => {
      await financeLedger.lockUser(userId, session);
      const g = await repo.goal(userId, id, session);
      if (!g) throw missing();
      Object.assign(g, input);
      await g.save({ session });
      return goalDto(g);
    });
  },
  async deleteGoal(userId: string, rawId: unknown) {
    const id = objectId.parse(rawId);
    await inTransaction(async (session) => {
      await financeLedger.lockUser(userId, session);
      const g = await repo.goal(userId, id, session);
      if (!g) throw missing();
      g.deletedAt = new Date();
      await g.save({ session });
    });
  },
  async contribute(userId: string, rawId: unknown, raw: unknown) {
    const id = objectId.parse(rawId),
      input = schema.contributionCreate.parse(raw);
    return inTransaction(async (session) => {
      const user = await financeLedger.lockUser(userId, session),
        g = await repo.goal(userId, id, session);
      if (!g) throw missing();
      g.savedAmount = addMoney(g.savedAmount, input.amount);
      await g.save({ session });
      const [c] = await GoalContribution.create(
        [
          {
            ...input,
            userId,
            goalId: id,
            date: parseFinancialDate(input.date, user.timezone),
          },
        ],
        { session },
      );
      return {
        goal: goalDto(g),
        contribution: {
          id: c.id,
          amount: c.amount,
          date: c.date,
          notes: c.notes,
        },
      };
    });
  },
  async contributions(userId: string, rawId: unknown, raw: unknown) {
    const id = objectId.parse(rawId),
      query = schema.contributionQuery.parse(raw);
    return inTransaction(async (session) => {
      await financeLedger.readUser(userId, session);
      if (!(await repo.goal(userId, id, session))) throw missing();
      const total = await GoalContribution.countDocuments({
        userId,
        goalId: id,
        deletedAt: null,
      }).session(session);
      const items = await repo
        .contributions(userId, id, session)
        .skip((query.page - 1) * query.limit)
        .limit(query.limit);
      return {
        items: items.map((c) => ({
          id: c.id,
          amount: c.amount,
          date: c.date,
          notes: c.notes,
        })),
        page: query.page,
        limit: query.limit,
        total,
      };
    });
  },
  async undoContribution(
    userId: string,
    rawId: unknown,
    rawContribution: unknown,
  ) {
    const id = objectId.parse(rawId),
      contributionId = objectId.parse(rawContribution);
    await inTransaction(async (session) => {
      await financeLedger.lockUser(userId, session);
      const g = await repo.goal(userId, id, session),
        c = await GoalContribution.findOne({
          _id: contributionId,
          userId,
          goalId: id,
          deletedAt: null,
        }).session(session);
      if (!g || !c) throw missing();
      g.savedAmount = addMoney(g.savedAmount, -c.amount);
      c.deletedAt = new Date();
      await g.save({ session });
      await c.save({ session });
    });
  },
  async recurring(userId: string, raw: unknown) {
    schema.emptyQuery.parse(raw);
    return inTransaction(async (session) => {
      await financeLedger.readUser(userId, session);
      return {
        items: (await repo.recurring(userId, session)).map(recurringDto),
      };
    });
  },
  async createRecurring(userId: string, raw: unknown) {
    const input = schema.recurringCreate.parse(raw);
    return inTransaction(async (session) => {
      await financeLedger.lockUser(userId, session);
      await financeLedger.requireWallet(userId, input.walletId, session);
      await financeLedger.requireCategory(
        userId,
        input.categoryId,
        input.type,
        session,
      );
      const [r] = await Recurring.create(
        [{ ...input, userId, anchorDay: Number(input.nextDate.slice(-2)) }],
        { session },
      );
      return recurringDto(r);
    });
  },
  async updateRecurring(userId: string, rawId: unknown, raw: unknown) {
    const id = objectId.parse(rawId),
      input = schema.recurringUpdate.parse(raw);
    return inTransaction(async (session) => {
      await financeLedger.lockUser(userId, session);
      const r = await repo.template(userId, id, session);
      if (!r) throw missing();
      const merged = { ...r.toObject(), ...input };
      if (merged.enabled && merged.endDate && merged.nextDate > merged.endDate)
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Ngày kết thúc phải sau kỳ tiếp theo.",
        );
      await financeLedger.requireWallet(
        userId,
        String(merged.walletId),
        session,
        !merged.enabled,
      );
      await financeLedger.requireCategory(
        userId,
        String(merged.categoryId),
        merged.type,
        session,
      );
      if (input.nextDate && input.nextDate !== r.nextDate)
        r.anchorDay = Number(input.nextDate.slice(-2));
      Object.assign(r, input);
      r.lastError = null;
      r.lastAttemptDate = null;
      await r.save({ session });
      return recurringDto(r);
    });
  },
  async deleteRecurring(userId: string, rawId: unknown) {
    const id = objectId.parse(rawId);
    await inTransaction(async (session) => {
      await financeLedger.lockUser(userId, session);
      const r = await repo.template(userId, id, session);
      if (!r) throw missing();
      r.deletedAt = new Date();
      r.enabled = false;
      await r.save({ session });
    });
  },
  async runRecurring(
    userId: string,
    rawId: unknown,
    now = new Date(),
    force = true,
  ) {
    const id = objectId.parse(rawId);
    let created = 0;
    let error: string | null = null;
    let scheduledDate = "";
    let attemptDay = "";
    for (let i = 0; i < 100; i++) {
      try {
        const result = await inTransaction(async (session) => {
          const user = await financeLedger.lockUser(userId, session),
            r = await repo.template(userId, id, session);
          if (!r) throw missing();
          attemptDay = todayInZone(now, user.timezone);
          scheduledDate = r.nextDate;
          if (
            !r.enabled ||
            r.nextDate > attemptDay ||
            (!force && r.lastError && r.lastAttemptDate === attemptDay)
          )
            return "done";
          if (r.endDate && r.nextDate > r.endDate) {
            r.enabled = false;
            await r.save({ session });
            return "done";
          }
          const already = await repo.run(id, r.nextDate, session);
          if (!already) {
            const entry = await financeLedger.createEntry(
              userId,
              {
                type: r.type as "income" | "expense",
                amount: r.amount,
                walletId: r.walletId.toString(),
                categoryId: r.categoryId.toString(),
                date: r.nextDate,
                description: r.description,
                notes: r.notes,
                tags: r.tags,
              },
              user.timezone,
              session,
            );
            await RecurringRun.create(
              [
                {
                  userId,
                  recurringId: id,
                  scheduledDate: r.nextDate,
                  transactionId: entry.id,
                },
              ],
              { session },
            );
          }
          r.nextDate = nextOccurrence(r.nextDate, r.frequency, r.anchorDay);
          if (r.endDate && r.nextDate > r.endDate) r.enabled = false;
          r.lastError = null;
          r.lastAttemptDate = attemptDay;
          r.lastRunAt = now;
          await r.save({ session });
          return already ? "existing" : "created";
        });
        if (result === "done") break;
        if (result === "created") created++;
      } catch (e) {
        if (e instanceof AppError && [400, 409, 422].includes(e.status)) {
          error = e.message;
          await inTransaction(async (session) => {
            await financeLedger.lockUser(userId, session);
            const r = await repo.template(userId, id, session);
            if (r && r.nextDate === scheduledDate) {
              r.lastError = error;
              r.lastAttemptDate = attemptDay;
              await r.save({ session });
            }
          });
          break;
        }
        throw e;
      }
    }
    return { created, error, catchUpLimit: 100 };
  },
  async reports(userId: string, raw: unknown) {
    const query = schema.reportQuery.parse(raw);
    return inTransaction(async (session) => {
      const user = await financeLedger.readUser(userId, session),
        endMonth =
          query.endMonth ?? monthBounds(new Date(), user.timezone).month;
      const [y, m] = endMonth.split("-").map(Number);
      const items = [];
      const categories = await financeRepository.categories(userId, session);
      const totals = new Map<string, number>();
      const trend = new Map<string, number[]>();
      for (let index = 0; index < query.months; index++) {
        const first = calendarDate(y, m - query.months + 1 + index, 1),
          last = calendarDate(
            first.getUTCFullYear(),
            first.getUTCMonth() + 2,
            0,
          );
        const label = first.toISOString().slice(0, 7),
          bounds = dateBounds(
            label + "-01",
            last.toISOString().slice(0, 10),
            user.timezone,
          );
        const rows = await repo.transactions(
          {
            userId,
            deletedAt: null,
            kind: "transaction",
            date: { $gte: bounds.lower, $lt: bounds.upper },
          },
          session,
        );
        const income = sumMoney(
            rows.filter((e) => e.type === "income").map((e) => e.amount),
          ),
          expense = sumMoney(
            rows.filter((e) => e.type === "expense").map((e) => e.amount),
          );
        items.push({
          month: label,
          income,
          expense,
          net: addMoney(income, -expense),
        });
        for (const row of rows.filter((e) => e.type === "expense")) {
          const key = row.categoryId!.toString();
          totals.set(key, addMoney(totals.get(key) ?? 0, row.amount));
          const values =
            trend.get(key) ?? (Array(query.months).fill(0) as number[]);
          values[index] = addMoney(values[index], row.amount);
          trend.set(key, values);
        }
      }
      const groups = [...totals].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      );
      const categoryItems = groups.map(([id, amount]) => ({
        categoryId: id,
        name: categories.find((c) => c.id === id)?.name ?? "Khác",
        amount,
        months: trend.get(id)!,
      }));
      const current = items.at(-1)!,
        previous = items.at(-2)!;
      const percent = (a: number, b: number) =>
        b ? Math.round(((a - b) / b) * 1000) / 10 : null;
      return {
        timezone: user.timezone,
        endMonth,
        months: items,
        categories: categoryItems,
        totalIncome: sumMoney(items.map((i) => i.income)),
        totalExpense: sumMoney(items.map((i) => i.expense)),
        comparison: {
          incomeChange: percent(current.income, previous.income),
          expenseChange: percent(current.expense, previous.expense),
        },
      };
    });
  },
  async exportCsv(userId: string, raw: unknown) {
    const query = transactionQuery.parse(raw);
    return inTransaction(async (session) => {
      const user = await financeLedger.readUser(userId, session);
      const rows = await repo
        .transactions(
          financeLedger.transactionFilter(userId, query, user.timezone),
          session,
        )
        .sort(financeLedger.sortBy[query.sort])
        .limit(10001);
      if (rows.length > 10000)
        throw new AppError(
          422,
          "EXPORT_TOO_LARGE",
          "Tối đa 10.000 dòng mỗi lần xuất. Hãy thu hẹp khoảng ngày.",
        );
      const wallets = await financeRepository.wallets(userId, session),
        categories = await financeRepository.categories(userId, session);
      const cell = (v: unknown) => {
        let text = String(v ?? "");
        if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))
          text = "'" + text;
        return '"' + text.replace(/"/g, '""') + '"';
      };
      const lines = [
        [
          "Ngày giờ ISO",
          "Loại",
          "Bản ghi",
          "Số tiền VND",
          "Ví",
          "Danh mục",
          "Mô tả",
          "Ghi chú",
          "Nhãn",
        ]
          .map(cell)
          .join(","),
      ];
      for (const row of rows)
        lines.push(
          [
            row.date.toISOString(),
            row.type,
            row.kind,
            row.amount,
            wallets.find((w) => w.id === row.walletId.toString())?.name ?? "Ví",
            row.kind === "opening"
              ? "Số dư ban đầu"
              : row.kind === "transfer"
                ? "Chuyển ví"
                : (categories.find((c) => c.id === row.categoryId?.toString())
                    ?.name ?? "Khác"),
            row.description,
            row.notes,
            row.tags.join("; "),
          ]
            .map(cell)
            .join(","),
        );
      return "\uFEFF" + lines.join("\r\n") + "\r\n";
    });
  },
};
