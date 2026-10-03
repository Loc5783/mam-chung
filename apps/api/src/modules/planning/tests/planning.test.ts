process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/test?replicaSet=rs0";
process.env.JWT_SECRET = "test-secret-longer-than-thirty-two-characters";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../../../app";
import { env } from "../../../config/env";
import { User } from "../../users/model";
import { RefreshToken } from "../../auth/model";
import { Wallet, Category, FinancialTransaction } from "../../finance/models";
import { financeService as finance } from "../../finance/service";
import { seedCategories } from "../../../seeds/categories";
import {
  planningService as service,
  nextOccurrence,
  todayInZone,
} from "../service";
import {
  planningModels,
  Budget,
  GoalContribution,
  Recurring,
  RecurringRun,
} from "../models";
import { runRecurringJob, startRecurringJob } from "../job";
jest.setTimeout(30000);
let replica: MongoMemoryReplSet,
  userId: string,
  otherId: string,
  walletId: string,
  expenseId: string,
  incomeId: string,
  token: string,
  app: ReturnType<typeof createApp>;
beforeAll(async () => {
  replica = await MongoMemoryReplSet.create({
    binary: { version: "7.0.14" },
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(replica.getUri());
  await Promise.all([
    User.init(),
    RefreshToken.init(),
    Wallet.init(),
    Category.init(),
    FinancialTransaction.init(),
    ...planningModels.map((m) => m.init()),
  ]);
  await seedCategories();
  expenseId = (await Category.findOne({ systemKey: "food" }))!.id as string;
  incomeId = (await Category.findOne({ systemKey: "salary" }))!.id as string;
}, 180000);
beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    RefreshToken.deleteMany({}),
    Wallet.deleteMany({}),
    FinancialTransaction.deleteMany({}),
    Category.deleteMany({ userId: { $ne: null } }),
    ...planningModels.map((m) => m.collection.deleteMany({})),
  ]);
  const [a, b] = await User.create([
    { name: "Minh", email: "minh@example.test", passwordHash: "unused" },
    { name: "Lan", email: "lan@example.test", passwordHash: "unused" },
  ]);
  userId = a.id as string;
  otherId = b.id as string;
  await RefreshToken.create({
    userId,
    tokenHash: "a".repeat(64),
    family: "a",
    securityVersion: 0,
    expiresAt: new Date(Date.now() + 86400000),
  });
  token = jwt.sign({ version: 0, family: "a" }, env.JWT_SECRET, {
    subject: userId,
    expiresIn: "15m",
    issuer: "mam-chung",
    audience: "mam-chung-web",
  });
  walletId = (
    await finance.createWallet(userId, {
      name: "Ví thử",
      type: "cash",
      initialBalance: 1000000,
    })
  ).id;
  app = createApp();
});
afterAll(async () => {
  await mongoose.disconnect();
  await replica?.stop();
});
const goal = () =>
  service.createGoal(userId, {
    name: "Du lịch",
    targetAmount: 1000000,
    deadline: "2026-12-31",
  });
const budget = (amount = 100000) =>
  service.createBudget(userId, {
    categoryId: expenseId,
    month: "2026-10",
    amount,
  });
const entry = (amount: number, extra: Record<string, unknown> = {}) =>
  finance.createTransaction(userId, {
    walletId,
    categoryId: expenseId,
    type: "expense",
    amount,
    date: "2026-10-03",
    description: "Ăn trưa",
    ...extra,
  });
const recurring = (extra: Record<string, unknown> = {}) =>
  service.createRecurring(userId, {
    walletId,
    categoryId: expenseId,
    type: "expense",
    amount: 10000,
    nextDate: "2026-10-03",
    frequency: "weekly",
    description: "Hóa đơn",
    ...extra,
  });
const now = new Date("2026-10-24T10:00:00Z");
describe("Ngân sách", () => {
  test("tạo, đọc, sửa và xóa ngân sách", async () => {
    const b = await budget();
    expect(b.status).toBe("healthy");
    expect(
      (await service.budgets(userId, { month: "2026-10" })).items,
    ).toHaveLength(1);
    expect(
      (await service.updateBudget(userId, b.id, { amount: 200000 })).amount,
    ).toBe(200000);
    await service.deleteBudget(userId, b.id);
    expect((await service.budgets(userId, { month: "2026-10" })).items).toEqual(
      [],
    );
    await budget();
  });
  test("cảnh báo đúng 80 và 100%, sửa/xóa giao dịch đổi tiến độ", async () => {
    const b = await budget();
    const e = await entry(80000);
    expect(
      (await service.budgets(userId, { month: "2026-10" })).items[0],
    ).toMatchObject({ status: "warning", progress: 80 });
    await finance.updateTransaction(userId, e.id, { amount: 100000 });
    expect(
      (await service.updateBudget(userId, b.id, { amount: 100000 })).status,
    ).toBe("exceeded");
    await finance.deleteTransaction(userId, e.id);
    expect(
      (await service.budgets(userId, { month: "2026-10" })).items[0].spent,
    ).toBe(0);
  });
  test("trùng danh mục/tháng bị chặn, thu nhập và transfer không tính chi", async () => {
    await budget();
    await expect(budget()).rejects.toMatchObject({ code: "BUDGET_EXISTS" });
    await expect(
      service.createBudget(userId, {
        categoryId: incomeId,
        month: "2026-10",
        amount: 5000,
      }),
    ).rejects.toMatchObject({ code: "CATEGORY_TYPE_MISMATCH" });
    await entry(50000, { type: "income", categoryId: incomeId });
    const w = await finance.createWallet(userId, {
      name: "Ví 2",
      type: "bank",
    });
    await finance.transfer(userId, {
      fromWalletId: walletId,
      toWalletId: w.id,
      amount: 10000,
      date: "2026-10-03",
    });
    expect(
      (await service.budgets(userId, { month: "2026-10" })).items[0].spent,
    ).toBe(0);
  });
  test("cập nhật không trùng và mặc định tháng hiện tại", async () => {
    const b = await budget();
    const cat = await finance.createCategory(userId, {
      name: "Cà phê",
      type: "expense",
    });
    const other = await service.createBudget(userId, {
      categoryId: cat.id,
      month: "2026-10",
      amount: 50000,
    });
    await expect(
      service.updateBudget(userId, other.id, { categoryId: expenseId }),
    ).rejects.toMatchObject({ code: "BUDGET_EXISTS" });
    expect((await service.budgets(userId, {})).month).toMatch(/^\d{4}-\d{2}$/);
    expect(
      (await service.updateBudget(userId, b.id, { month: "2026-11" })).spent,
    ).toBe(0);
  });
  test("ghi ngân sách đồng thời không tạo bản trùng", async () => {
    const results = await Promise.allSettled([budget(), budget()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await Budget.countDocuments({})).toBe(1);
  });
  test("danh mục có ngân sách không được xóa hoặc đổi loại", async () => {
    const cat = await finance.createCategory(userId, {
      name: "Cà phê",
      type: "expense",
    });
    const b = await service.createBudget(userId, {
      categoryId: cat.id,
      month: "2026-10",
      amount: 10000,
    });
    await expect(
      finance.deleteCategory(userId, cat.id, { replacementId: expenseId }),
    ).rejects.toMatchObject({ code: "CATEGORY_IN_USE" });
    await expect(
      finance.updateCategory(userId, cat.id, { type: "income" }),
    ).rejects.toMatchObject({ code: "CATEGORY_IN_USE" });
    await service.deleteBudget(userId, b.id);
    await finance.deleteCategory(userId, cat.id, {});
  });
});
describe("Mục tiêu tiết kiệm", () => {
  test("CRUD, nạp tiền, lịch sử và hoàn tác không thay số dư ví", async () => {
    const g = await goal();
    await service.updateGoal(userId, g.id, {
      name: "Đà Lạt",
      notes: "Cuối năm",
      deadline: null,
      color: "#E38FA9",
    });
    const c = await service.contribute(userId, g.id, {
      amount: 100000,
      date: "2026-10-03",
      notes: "Đã dành dụm",
    });
    expect(c.goal.progress).toBe(10);
    expect((await service.goals(userId, {})).items[0].name).toBe("Đà Lạt");
    expect((await service.contributions(userId, g.id, {})).total).toBe(1);
    await service.undoContribution(userId, g.id, c.contribution.id);
    expect((await service.goals(userId, {})).items[0].savedAmount).toBe(0);
    expect((await finance.wallet(userId, walletId)).balance).toBe(1000000);
    await service.deleteGoal(userId, g.id);
    expect((await service.goals(userId, {})).items).toEqual([]);
  });
  test("nạp đồng thời chính xác và đạt hơn 100%", async () => {
    const g = await goal();
    await Promise.all(
      Array.from({ length: 5 }, () =>
        service.contribute(userId, g.id, {
          amount: 300000,
          date: "2026-10-03",
        }),
      ),
    );
    expect((await service.goals(userId, {})).items[0]).toMatchObject({
      savedAmount: 1500000,
      progress: 150,
    });
    expect(
      (await service.contributions(userId, g.id, { page: 2, limit: 2 })).items,
    ).toHaveLength(2);
  });
  test("hoàn tác hai lần không trừ hai lần", async () => {
    const g = await goal(),
      c = await service.contribute(userId, g.id, {
        amount: 10000,
        date: "2026-10-03",
      });
    const r = await Promise.allSettled([
      service.undoContribution(userId, g.id, c.contribution.id),
      service.undoContribution(userId, g.id, c.contribution.id),
    ]);
    expect(r.filter((i) => i.status === "fulfilled")).toHaveLength(1);
    expect((await service.goals(userId, {})).items[0].savedAmount).toBe(0);
  });
  test("rollback khi ghi lịch sử nạp lỗi", async () => {
    const g = await goal();
    const spy = jest
      .spyOn(GoalContribution, "create")
      .mockRejectedValueOnce(new Error("insert failed"));
    await expect(
      service.contribute(userId, g.id, { amount: 10000, date: "2026-10-03" }),
    ).rejects.toThrow("insert failed");
    spy.mockRestore();
    expect((await service.goals(userId, {})).items[0].savedAmount).toBe(0);
  });
  test("giới hạn số nguyên an toàn và phân quyền", async () => {
    const g = await goal();
    await service.contribute(userId, g.id, {
      amount: Number.MAX_SAFE_INTEGER,
      date: "2026-10-03",
    });
    await expect(
      service.contribute(userId, g.id, { amount: 1, date: "2026-10-03" }),
    ).rejects.toMatchObject({ code: "MONEY_OVERFLOW" });
    await expect(
      service.updateGoal(otherId, g.id, { name: "Sai" }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(service.deleteGoal(otherId, g.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      service.contributions(otherId, g.id, {}),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.contribute(otherId, g.id, { amount: 1, date: "2026-10-03" }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
describe("Định kỳ", () => {
  test("tuần và tháng giữ ngày neo qua tháng ngắn/năm nhuận", () => {
    expect(nextOccurrence("2026-01-31", "monthly", 31)).toBe("2026-02-28");
    expect(nextOccurrence("2026-02-28", "monthly", 31)).toBe("2026-03-31");
    expect(nextOccurrence("2024-01-31", "monthly", 31)).toBe("2024-02-29");
    expect(nextOccurrence("2026-12-28", "weekly", 28)).toBe("2027-01-04");
    expect(
      todayInZone(new Date("2026-10-02T18:00:00Z"), "Asia/Ho_Chi_Minh"),
    ).toBe("2026-10-03");
  });
  test("chạy bù 4 kỳ, chạy lại không trùng, đối soát khớp", async () => {
    const r = await recurring();
    expect((await service.runRecurring(userId, r.id, now)).created).toBe(4);
    expect((await service.runRecurring(userId, r.id, now)).created).toBe(0);
    expect(await RecurringRun.countDocuments({})).toBe(4);
    expect((await finance.reconcile(userId, walletId, {})).matched).toBe(true);
    expect((await service.recurring(userId, {})).items[0].nextDate).toBe(
      "2026-10-31",
    );
  });
  test("hai job đồng thời không sinh trùng hoặc lệch ví", async () => {
    const r = await recurring();
    const results = await Promise.all([
      service.runRecurring(userId, r.id, now),
      service.runRecurring(userId, r.id, now),
    ]);
    expect(results.reduce((sum, r) => sum + r.created, 0)).toBe(4);
    expect((await finance.wallet(userId, walletId)).balance).toBe(960000);
  });
  test("thiếu tiền giữ ngày kỳ và lỗi, nạp tiền rồi thử lại được", async () => {
    const r = await recurring({ amount: 2000000 });
    const first = await service.runRecurring(userId, r.id, now);
    expect(first.error).toMatch(/Số dư/);
    expect((await service.recurring(userId, {})).items[0]).toMatchObject({
      nextDate: "2026-10-03",
      lastError: first.error,
    });
    expect(await RecurringRun.countDocuments({})).toBe(0);
    expect((await service.runRecurring(userId, r.id, now, false)).created).toBe(
      0,
    );
    await entry(9000000, { type: "income", categoryId: incomeId });
    expect((await service.runRecurring(userId, r.id, now)).created).toBe(4);
  });
  test("lịch thu nhập, ngày cuối, tạm dừng và xóa giữ giao dịch", async () => {
    const r = await recurring({
      type: "income",
      categoryId: incomeId,
      frequency: "monthly",
      nextDate: "2026-01-31",
      endDate: "2026-03-31",
    });
    expect((await service.runRecurring(userId, r.id, now)).created).toBe(3);
    expect((await service.recurring(userId, {})).items[0].enabled).toBe(false);
    await expect(
      service.updateRecurring(userId, r.id, { enabled: true }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await service.updateRecurring(userId, r.id, {
      nextDate: "2026-10-31",
      endDate: null,
      enabled: false,
    });
    expect((await service.runRecurring(userId, r.id, now)).created).toBe(0);
    await service.deleteRecurring(userId, r.id);
    expect((await service.recurring(userId, {})).items).toEqual([]);
    expect(await RecurringRun.countDocuments({})).toBe(3);
  });
  test("đổi ngày và ví kiểm tra quyền, giữ neo mới và lỗi clear", async () => {
    const r = await recurring();
    await service.updateRecurring(userId, r.id, {
      nextDate: "2026-11-15",
      frequency: "monthly",
      description: "Lịch mới",
    });
    expect((await Recurring.findById(r.id))!.anchorDay).toBe(15);
    await expect(
      service.updateRecurring(otherId, r.id, { enabled: false }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(service.deleteRecurring(otherId, r.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      service.runRecurring(otherId, r.id, now),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.createRecurring(otherId, {
        walletId,
        categoryId: expenseId,
        type: "expense",
        amount: 100,
        nextDate: "2026-10-03",
        frequency: "weekly",
        description: "Sai",
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
  test("rollback khi ghi idempotency lỗi", async () => {
    const r = await recurring();
    const spy = jest
      .spyOn(RecurringRun, "create")
      .mockRejectedValueOnce(new Error("run insert failed"));
    await expect(service.runRecurring(userId, r.id, now)).rejects.toThrow(
      "run insert failed",
    );
    spy.mockRestore();
    expect((await finance.wallet(userId, walletId)).balance).toBe(1000000);
    expect(
      await FinancialTransaction.countDocuments({ kind: "transaction" }),
    ).toBe(0);
    expect((await Recurring.findById(r.id))!.nextDate).toBe("2026-10-03");
  });
  test("ví lưu trữ giữ lỗi, lịch tạm dừng sửa được và bảo vệ danh mục/ví", async () => {
    const cat = await finance.createCategory(userId, {
      name: "Cà phê",
      type: "expense",
    });
    const empty = await finance.createWallet(userId, {
      name: "Ví trống",
      type: "cash",
    });
    const r = await recurring({ categoryId: cat.id, walletId: empty.id });
    await expect(finance.deleteWallet(userId, empty.id)).rejects.toMatchObject({
      code: "WALLET_IN_USE",
    });
    await expect(
      finance.deleteCategory(userId, cat.id, {}),
    ).rejects.toMatchObject({ code: "CATEGORY_IN_USE" });
    await finance.updateWallet(userId, empty.id, { archived: true });
    expect((await service.runRecurring(userId, r.id, now)).error).toMatch(
      /lưu trữ/,
    );
    await service.updateRecurring(userId, r.id, { enabled: false });
    await service.deleteRecurring(userId, r.id);
    await finance.deleteWallet(userId, empty.id);
  });
  test("đã có run không ghi lại, dù xóa dòng giao dịch đã sinh", async () => {
    const r = await recurring();
    await service.runRecurring(userId, r.id, new Date("2026-10-03T10:00:00Z"));
    const run = (await RecurringRun.findOne({ recurringId: r.id }))!;
    await finance.deleteTransaction(userId, run.transactionId.toString());
    await service.updateRecurring(userId, r.id, { nextDate: "2026-10-03" });
    expect(
      (
        await service.runRecurring(
          userId,
          r.id,
          new Date("2026-10-03T10:00:00Z"),
        )
      ).created,
    ).toBe(0);
    expect((await finance.wallet(userId, walletId)).balance).toBe(1000000);
  });
  test("job tự động bỏ tài khoản đã xóa và gọi lặp an toàn", async () => {
    await recurring();
    const r = await recurring({ description: "Lịch của tài khoản đã xóa" });
    await Recurring.updateOne({ _id: r.id }, { userId: otherId });
    await User.updateOne({ _id: otherId }, { deletedAt: new Date() });
    expect((await runRecurringJob(now)).created).toBe(4);
    expect((await runRecurringJob(now)).created).toBe(0);
    const stop = startRecurringJob();
    await stop();
  });
  test("giới hạn catch-up 100 kỳ và tự tắt khi hết hạn", async () => {
    const r = await recurring({
      type: "income",
      categoryId: incomeId,
      nextDate: "2024-01-01",
    });
    expect((await service.runRecurring(userId, r.id, now)).created).toBe(100);
    const ended = await recurring({
      nextDate: "2026-10-03",
      endDate: "2026-10-03",
    });
    await Recurring.updateOne({ _id: ended.id }, { nextDate: "2026-10-10" });
    expect((await service.runRecurring(userId, ended.id, now)).created).toBe(0);
    expect((await Recurring.findById(ended.id))!.enabled).toBe(false);
  });
});
describe("Báo cáo và CSV", () => {
  test("6/12 tháng đủ dòng trống, xu hướng đúng và loại trừ opening/transfer", async () => {
    await entry(10000, { date: "2026-09-30" });
    await entry(30000);
    await entry(50000, { type: "income", categoryId: incomeId });
    const r = await service.reports(userId, { months: 6, endMonth: "2026-10" });
    expect(r.months).toHaveLength(6);
    expect(r.months[0].month).toBe("2026-05");
    expect(r.months.at(-1)).toMatchObject({
      income: 50000,
      expense: 30000,
      net: 20000,
    });
    expect(r.comparison).toMatchObject({
      incomeChange: null,
      expenseChange: 200,
    });
    expect(r.categories[0]).toMatchObject({
      amount: 40000,
      months: [0, 0, 0, 0, 10000, 30000],
    });
    expect((await service.reports(userId, { months: 12 })).months).toHaveLength(
      12,
    );
    expect(
      (await service.reports(otherId, { endMonth: "2026-10" })).totalExpense,
    ).toBe(0);
  });
  test("tháng theo múi giờ hồ sơ và đủ danh mục riêng", async () => {
    await entry(10000, { date: "2026-09-30T18:00:00Z" });
    const cat = await finance.createCategory(userId, {
      name: "Cà phê",
      type: "expense",
    });
    await entry(20000, { categoryId: cat.id });
    const r = await service.reports(userId, { endMonth: "2026-10" });
    expect(r.months.at(-1)!.expense).toBe(30000);
    expect(r.categories[0].name).toBe("Cà phê");
  });
  test("CSV BOM, dấu ngoặc/ký tự xuống dòng, chống công thức và bộ lọc", async () => {
    await entry(10000, {
      description: '=HYPERLINK("bad")',
      notes: "hai\ndòng",
      tags: ["@nhãn"],
    });
    const csv = await service.exportCsv(userId, {
      type: "expense",
      search: "HYPERLINK",
    });
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain("hai\ndòng");
    expect(csv).toContain("'@nhãn");
    expect(csv).not.toContain("Số dư ban đầu");
    expect(await service.exportCsv(otherId, {})).not.toContain("HYPERLINK");
  });
  test("CSV giới hạn 10000 dòng, lưu báo cáo không dùng tiền float", async () => {
    const records = Array.from({ length: 10001 }, () => ({
      userId,
      walletId,
      categoryId: expenseId,
      type: "expense",
      amount: 1,
      date: new Date(),
      description: "bulk",
    }));
    await FinancialTransaction.insertMany(records);
    await expect(service.exportCsv(userId, {})).rejects.toMatchObject({
      code: "EXPORT_TOO_LARGE",
    });
  });
  test("phân quyền ngân sách và dữ liệu thiếu", async () => {
    const b = await budget(),
      g = await goal();
    await expect(
      service.updateBudget(otherId, b.id, { amount: 100 }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(service.deleteBudget(otherId, b.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      service.undoContribution(
        otherId,
        g.id,
        new mongoose.Types.ObjectId().toString(),
      ),
    ).rejects.toMatchObject({ status: 404 });
    await User.updateOne({ _id: otherId }, { deletedAt: new Date() });
    await expect(service.goals(otherId, {})).rejects.toMatchObject({
      status: 404,
    });
  });
  test("API đúng schema, phân quyền, CSV route không bị coi như id", async () => {
    const header = { Authorization: "Bearer " + token };
    const b = await request(app)
      .post("/api/budgets")
      .set(header)
      .send({ categoryId: expenseId, month: "2026-10", amount: 10000 });
    expect(b.status).toBe(201);
    expect(
      (await request(app).get("/api/budgets?month=2026-10").set(header)).body
        .items,
    ).toHaveLength(1);
    expect(
      (
        await request(app)
          .put("/api/budgets/" + b.body.id)
          .set(header)
          .send({ amount: 20000 })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .delete("/api/budgets/" + b.body.id)
          .set(header)
      ).status,
    ).toBe(204);
    const g = await request(app)
      .post("/api/goals")
      .set(header)
      .send({ name: "Du lịch", targetAmount: 100000 });
    expect(g.status).toBe(201);
    expect((await request(app).get("/api/goals").set(header)).status).toBe(200);
    expect(
      (
        await request(app)
          .put("/api/goals/" + g.body.id)
          .set(header)
          .send({ name: "Mục tiêu mới" })
      ).status,
    ).toBe(200);
    const c = await request(app)
      .post("/api/goals/" + g.body.id + "/contribute")
      .set(header)
      .send({ amount: 10000, date: "2026-10-03" });
    expect(c.status).toBe(201);
    expect(
      (
        await request(app)
          .get("/api/goals/" + g.body.id + "/contributions")
          .set(header)
      ).body.total,
    ).toBe(1);
    expect(
      (
        await request(app)
          .delete(
            "/api/goals/" +
              g.body.id +
              "/contributions/" +
              c.body.contribution.id,
          )
          .set(header)
      ).status,
    ).toBe(204);
    expect(
      (
        await request(app)
          .delete("/api/goals/" + g.body.id)
          .set(header)
      ).status,
    ).toBe(204);
    const r = await request(app).post("/api/recurring").set(header).send({
      walletId,
      categoryId: expenseId,
      type: "expense",
      amount: 100,
      nextDate: "2026-10-03",
      frequency: "weekly",
      description: "Hóa đơn",
    });
    expect(r.status).toBe(201);
    expect((await request(app).get("/api/recurring").set(header)).status).toBe(
      200,
    );
    expect(
      (
        await request(app)
          .put("/api/recurring/" + r.body.id)
          .set(header)
          .send({ enabled: false })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post("/api/recurring/" + r.body.id + "/run")
          .set(header)
          .send({})
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .delete("/api/recurring/" + r.body.id)
          .set(header)
      ).status,
    ).toBe(204);
    expect(
      (await request(app).get("/api/reports/monthly").set(header)).status,
    ).toBe(200);
    expect(
      (await request(app).get("/api/reports/by-category?months=12").set(header))
        .status,
    ).toBe(200);
    const csv = await request(app).get("/api/transactions/export").set(header);
    expect(csv.status).toBe(200);
    expect(csv.headers["content-type"]).toMatch(/text\/csv/);
    expect((await request(app).get("/api/goals")).status).toBe(401);
    expect(
      (
        await request(app)
          .post("/api/goals")
          .set(header)
          .send({ name: "X", targetAmount: 1.5, userId: otherId })
      ).status,
    ).toBe(400);
    expect(
      (await request(app).get("/api/reports/monthly?months=7").set(header))
        .status,
    ).toBe(400);
    expect(
      (await request(app).get("/api/budgets?month=2026-13").set(header)).status,
    ).toBe(400);
  });
});

it("budget threshold compares integers exactly near the safe-money ceiling", async () => {
  const amount = Number.MAX_SAFE_INTEGER;
  const spent = Number((BigInt(amount) * 80n) / 100n);
  await finance.updateWallet(userId, walletId, { allowNegative: true });
  await budget(amount);
  await entry(spent);
  expect(
    (await service.budgets(userId, { month: "2026-10" })).items[0].status,
  ).toBe("healthy");
  await entry(1);
  expect(
    (await service.budgets(userId, { month: "2026-10" })).items[0].status,
  ).toBe("warning");
});

test("sửa ghi chú lịch đã kết thúc; bật lại vẫn cần gia hạn", async () => {
  const r = await recurring({ endDate: "2026-10-03" });
  await service.runRecurring(userId, r.id, now);
  expect(
    (await service.updateRecurring(userId, r.id, { notes: "Đã hoàn tất" }))
      .notes,
  ).toBe("Đã hoàn tất");
  await expect(
    service.updateRecurring(userId, r.id, { enabled: true }),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  await service.updateRecurring(userId, r.id, {
    enabled: true,
    endDate: "2026-10-10",
  });
  expect((await service.runRecurring(userId, r.id, now)).created).toBe(1);
  expect(await RecurringRun.countDocuments({ recurringId: r.id })).toBe(2);
});
test("CSV và lịch sử dùng cùng bộ lọc ghi chú/nhãn", async () => {
  await entry(10, {
    description: "Một dòng riêng",
    notes: "Từ khóa [CSV]",
    tags: ["nhãn-csv"],
  });
  await entry(20, { description: "Không liên quan" });
  const csv = await service.exportCsv(userId, { search: "[CSV]" });
  expect(csv).toContain("Một dòng riêng");
  expect(csv).not.toContain("Không liên quan");
  expect(
    (await finance.transactions(userId, { search: "nhãn-csv" })).total,
  ).toBe(1);
});

test("sửa mẫu tháng mà không đổi ngày giữ neo 31 sau tháng ngắn", async () => {
  const r = await recurring({ frequency: "monthly", nextDate: "2026-01-31" });
  await service.runRecurring(userId, r.id, new Date("2026-01-31T10:00:00Z"));
  const current = (await service.recurring(userId, {})).items[0];
  expect(current.nextDate).toBe("2026-02-28");
  await service.updateRecurring(userId, r.id, {
    nextDate: current.nextDate,
    notes: "Chỉ sửa ghi chú",
  });
  await service.runRecurring(userId, r.id, new Date("2026-02-28T10:00:00Z"));
  expect((await service.recurring(userId, {})).items[0].nextDate).toBe(
    "2026-03-31",
  );
});
