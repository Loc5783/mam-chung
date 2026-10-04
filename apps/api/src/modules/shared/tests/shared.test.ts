process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1/test?replicaSet=rs0";
process.env.JWT_SECRET = "test-secret-longer-than-thirty-two-characters";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../../../app";
import { env } from "../../../config/env";
import { User } from "../../users/model";
import { RefreshToken } from "../../auth/model";
import { coupleModels, CoupleActivity } from "../../couples/models";
import { coupleService } from "../../couples/service";
import { Category, Wallet } from "../../finance/models";
import { seedCategories } from "../../../seeds/categories";
import {
  sharedModels,
  SharedWallet,
  SharedContribution,
  SharedSplit,
  SharedTransaction,
  Settlement,
  SharedGoal,
} from "../models";
import { sharedService as s } from "../service";
let db: MongoMemoryReplSet,
  a: string,
  b: string,
  c: string,
  coupleId: string,
  walletId: string,
  categoryId: string,
  token: string,
  app: ReturnType<typeof createApp>;
jest.setTimeout(30000);
beforeAll(async () => {
  db = await MongoMemoryReplSet.create({
    binary: { version: "7.0.14" },
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(db.getUri());
  for (const m of [
    User,
    RefreshToken,
    Category,
    Wallet,
    ...coupleModels,
    ...sharedModels,
  ])
    await m.init();
  await seedCategories();
  categoryId = (await Category.findOne({ systemKey: "food" }))!.id as string;
}, 180000);
beforeEach(async () => {
  for (const m of [
    User,
    RefreshToken,
    Wallet,
    ...coupleModels,
    ...sharedModels,
  ])
    await m.collection.deleteMany({});
  const users = await User.create(
    ["Minh", "Lan", "Khác"].map((name, i) => ({
      name,
      email: `${i}@test.local`,
      passwordHash: "unused",
    })),
  );
  [a, b, c] = users.map((u) => u.id as string);
  const couple = await coupleService.create(a, { name: "Quỹ của chúng mình" });
  coupleId = couple.id;
  const invite = await coupleService.invite(a);
  await coupleService.accept(b, { code: invite.code });
  walletId = (await s.createWallet(a, { name: "Sinh hoạt" })).id;
  await RefreshToken.create({
    userId: a,
    tokenHash: "a".repeat(64),
    family: "a",
    securityVersion: 0,
    expiresAt: new Date(Date.now() + 86400000),
  });
  token = jwt.sign({ version: 0, family: "a" }, env.JWT_SECRET, {
    subject: a,
    issuer: "mam-chung",
    audience: "mam-chung-web",
    expiresIn: "15m",
  });
  app = createApp();
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await mongoose.disconnect();
  await db?.stop();
});
const date = "2026-10-03";
const tx = (extra: Record<string, unknown> = {}, actor = a) =>
  s.createTransaction(actor, {
    sharedWalletId: walletId,
    payerId: a,
    amount: 101,
    date,
    description: "Ăn chung",
    categoryId,
    splitType: "equal",
    paidFrom: "personal",
    ...extra,
  });
const deposit = (amount = 1000, actor = a) =>
  s.contribute(actor, walletId, { amount, date, notes: "Tiền đã nạp" });
const debt = async () => {
  await tx();
  return (await s.settlements(a, {})).items[0];
};
describe("Quỹ và khoản chi chung", () => {
  test("CRUD quỹ rỗng; chỉ ghi nhận tiền nạp, không trừ ví cá nhân", async () => {
    const w = await s.createWallet(b, { name: "Du lịch" });
    expect(w.balance).toBe(0);
    expect((await s.updateWallet(a, w.id, { name: "Đà Lạt" })).name).toBe(
      "Đà Lạt",
    );
    await s.deleteWallet(b, w.id);
    await deposit();
    expect((await s.wallets(b, {})).items[0].balance).toBe(1000);
    expect((await s.contributions(b, walletId, {})).items[0].actorName).toBe(
      "Minh",
    );
    expect(await Wallet.countDocuments()).toBe(0);
    await expect(s.deleteWallet(a, walletId)).rejects.toMatchObject({
      code: "WALLET_HAS_HISTORY",
    });
  });
  test("nạp đồng thời hai người không mất tiền", async () => {
    await Promise.all([deposit(100, a), deposit(200, b)]);
    expect((await SharedWallet.findById(walletId))!.balance).toBe(300);
    expect(await SharedContribution.countDocuments()).toBe(2);
  });
  test("chia đều số lẻ phần dư thuộc payer, không phụ thuộc thứ tự user", async () => {
    const t = await tx({ payerId: b });
    expect(t.splits.find((x) => x.userId === b)!.shareAmount).toBe(51);
    expect(t.splits.find((x) => x.userId === a)!.shareAmount).toBe(50);
    expect((await s.settlements(a, {})).items[0]).toMatchObject({
      fromUserId: a,
      toUserId: b,
      amount: 50,
      status: "pending",
    });
    expect((await SharedWallet.findById(walletId))!.balance).toBe(0);
    expect((await s.transaction(b, t.id, {})).description).toBe("Ăn chung");
  });
  test("số tiền 1 có phần chia 0, không tạo công nợ bằng 0", async () => {
    const t = await tx({ amount: 1 });
    expect(t.splits.map((x) => x.shareAmount).sort()).toEqual([0, 1]);
    expect(await Settlement.countDocuments()).toBe(0);
  });
  test("custom tổng chính xác, cho phép một người 0", async () => {
    const t = await tx({
      splitType: "custom",
      splits: [
        { userId: a, shareAmount: 0 },
        { userId: b, shareAmount: 101 },
      ],
    });
    expect(t.splits.find((x) => x.userId === a)!.shareAmount).toBe(0);
    expect((await s.summary(a, {})).amount).toBe(101);
  });
  test("percent đến 2 thập phân, số lớn vẫn đúng một đồng", async () => {
    const amount = Number.MAX_SAFE_INTEGER;
    const t = await tx({
      amount,
      splitType: "percent",
      splits: [
        { userId: b, percent: 33.33 },
        { userId: a, percent: 66.67 },
      ],
    });
    const other = Number((BigInt(amount) * 3333n) / 10000n);
    expect(t.splits.find((x) => x.userId === b)!.shareAmount).toBe(other);
    expect(
      BigInt(t.splits[0].shareAmount) + BigInt(t.splits[1].shareAmount),
    ).toBe(BigInt(amount));
  });
  test.each([
    {
      splitType: "custom",
      splits: () => [
        { userId: a, shareAmount: 50 },
        { userId: b, shareAmount: 50 },
      ],
    },
    {
      splitType: "custom",
      splits: () => [
        { userId: a, shareAmount: 50 },
        { userId: c, shareAmount: 51 },
      ],
    },
    {
      splitType: "custom",
      splits: () => [
        { userId: a, shareAmount: 50 },
        { userId: a, shareAmount: 51 },
      ],
    },
    {
      splitType: "custom",
      splits: () => [
        { userId: a, percent: 50 },
        { userId: b, percent: 50 },
      ],
    },
    { splitType: "custom", splits: () => undefined },
    {
      splitType: "percent",
      splits: () => [
        { userId: a, percent: 40 },
        { userId: b, percent: 50 },
      ],
    },
    {
      splitType: "percent",
      splits: () => [
        { userId: a, shareAmount: 50 },
        { userId: b, shareAmount: 51 },
      ],
    },
    {
      splitType: "equal",
      splits: () => [
        { userId: a, shareAmount: 50 },
        { userId: b, shareAmount: 51 },
      ],
    },
  ])("chia sai bị chặn và rollback %#", async (testCase) => {
    await expect(
      tx({ ...testCase, splits: testCase.splits() }),
    ).rejects.toMatchObject({ status: 400 });
    expect(await SharedTransaction.countDocuments()).toBe(0);
    expect(await SharedSplit.countDocuments()).toBe(0);
    expect(await Settlement.countDocuments()).toBe(0);
  });
  test("chi từ quỹ không sinh nợ; xóa hoàn tiền và giữ history", async () => {
    await deposit(101);
    const t = await tx({ paidFrom: "fund" });
    expect((await SharedWallet.findById(walletId))!.balance).toBe(0);
    expect(await Settlement.countDocuments()).toBe(0);
    await s.deleteTransaction(a, t.id);
    expect((await SharedWallet.findById(walletId))!.balance).toBe(101);
    expect((await s.transactions(a, {})).total).toBe(0);
    await expect(s.transaction(a, t.id, {})).rejects.toMatchObject({
      status: 404,
    });
  });
  test("chi vượt quỹ bị chặn; hai khoản đồng thời chỉ một thành công", async () => {
    await deposit(100);
    await expect(tx({ paidFrom: "fund" })).rejects.toMatchObject({
      status: 422,
    });
    const results = await Promise.allSettled([
      tx({ amount: 80, paidFrom: "fund" }, a),
      tx({ amount: 80, paidFrom: "fund" }, b),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await SharedWallet.findById(walletId))!.balance).toBe(20);
  });
  test("lỗi ghi split rollback cả ví và sổ", async () => {
    await deposit(200);
    jest
      .spyOn(SharedSplit, "create")
      .mockRejectedValueOnce(new Error("DB failed"));
    await expect(tx({ paidFrom: "fund" })).rejects.toThrow("DB failed");
    expect((await SharedWallet.findById(walletId))!.balance).toBe(200);
    expect(await SharedTransaction.countDocuments()).toBe(0);
  });
  test("quỹ lưu trữ chặn nạp/chi, khôi phục giữ số dư", async () => {
    await deposit();
    await s.updateWallet(a, walletId, { archived: true });
    await expect(deposit()).rejects.toMatchObject({ code: "WALLET_ARCHIVED" });
    await expect(tx()).rejects.toMatchObject({ code: "WALLET_ARCHIVED" });
    expect((await s.wallets(a, {})).items[0].archived).toBe(true);
    await s.updateWallet(b, walletId, { archived: false });
    expect((await SharedWallet.findById(walletId))!.balance).toBe(1000);
  });
  test("xóa chỉ creator hoặc owner; xóa khoản chưa trả thu hồi nợ", async () => {
    const t = await tx();
    await expect(s.deleteTransaction(b, t.id)).rejects.toMatchObject({
      status: 403,
    });
    await s.deleteTransaction(a, t.id);
    expect((await s.summary(b, {})).amount).toBe(0);
    const own = await tx({}, b);
    await s.deleteTransaction(a, own.id);
  });
  test("user ngoài nhóm, payer ngoài nhóm, category riêng bị chặn", async () => {
    await expect(s.wallets(c, {})).rejects.toMatchObject({ status: 404 });
    await expect(
      s.transaction(c, "123456789012345678901234", { coupleId }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(tx({ payerId: c })).rejects.toMatchObject({ status: 400 });
    await expect(
      tx({ categoryId: "123456789012345678901234" }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      s.updateWallet(c, walletId, { name: "Hack" }),
    ).rejects.toMatchObject({ status: 404 });
  });
  test("một thành viên được tạo/nạp quỹ nhưng chưa được chia chi", async () => {
    await coupleService.leave(b, { confirm: true });
    await coupleService.create(a, { name: "Một mình" });
    const w = await s.createWallet(a, { name: "Quỹ mới" });
    await expect(tx({ sharedWalletId: w.id })).rejects.toMatchObject({
      status: 400,
    });
  });
  test("lọc thời gian, quỹ, phân trang và dashboard không tính tiền nạp vào chi", async () => {
    await deposit();
    await tx();
    await tx({ date: "2026-09-30", description: "Tháng trước" });
    const page = await s.transactions(b, {
      from: date,
      to: date,
      sharedWalletId: walletId,
      limit: 1,
    });
    expect(page.total).toBe(1);
    expect(page.items[0].description).toBe("Ăn chung");
    const d = await s.dashboard(a, {});
    expect(d.monthExpense).toBe(101);
    expect(d.totalBalance).toBe(1000);
    expect(d.categories[0].amount).toBe(101);
    expect(d.recent).toHaveLength(2);
  });
});
describe("Công nợ, thanh toán và archive", () => {
  test("net hai chiều chính xác và pending-confirm vẫn là khoản nợ", async () => {
    await tx({ amount: 301 });
    await tx({ payerId: b, amount: 101 });
    expect(await s.summary(a, {})).toMatchObject({
      amount: 100,
      fromUserId: b,
      toUserId: a,
      outstandingCount: 2,
    });
    const row = (await s.settlements(a, {})).items.find(
      (x) => x.fromUserId === b,
    )!;
    await s.settlementAction(b, row.id, "mark-paid", {
      notes: "Đã chuyển ngoài app",
    });
    expect((await s.summary(a, {})).amount).toBe(100);
  });
  test("người nợ báo, người nhận confirm, giữ paidAt và không động ví", async () => {
    const row = await debt();
    await expect(
      s.settlementAction(a, row.id, "mark-paid", {}),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      s.settlementAction(a, row.id, "confirm", {}),
    ).rejects.toMatchObject({ code: "INVALID_SETTLEMENT_STATE" });
    await s.settlementAction(b, row.id, "mark-paid", {});
    await expect(
      s.settlementAction(b, row.id, "confirm", {}),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      s.deleteTransaction(a, row.sourceTransactionId),
    ).rejects.toMatchObject({ code: "SETTLEMENT_LOCKED" });
    const paid = await s.settlementAction(a, row.id, "confirm", {
      notes: "Đã nhận",
    });
    expect(paid.paidAt).not.toBeNull();
    expect((await s.summary(b, {})).amount).toBe(0);
    const createdDay = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(row.createdAt));
    expect(
      (
        await s.settlements(a, {
          status: "paid",
          from: createdDay,
          to: createdDay,
        })
      ).total,
    ).toBe(1);
    await expect(
      s.deleteTransaction(a, row.sourceTransactionId),
    ).rejects.toMatchObject({ code: "SETTLEMENT_LOCKED" });
    expect((await SharedWallet.findById(walletId))!.balance).toBe(0);
  });
  test("reject có ghi chú; chỉ người nhận; báo lại được", async () => {
    const row = await debt();
    await s.settlementAction(b, row.id, "mark-paid", {});
    await expect(
      s.settlementAction(b, row.id, "reject", {}),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      await s.settlementAction(a, row.id, "reject", {
        notes: "Chưa nhận tiền",
      }),
    ).toMatchObject({
      status: "pending",
      notes: "Chưa nhận tiền",
      markedAt: null,
    });
    await s.settlementAction(b, row.id, "mark-paid", {});
    await s.settlementAction(a, row.id, "confirm", {});
    await expect(
      s.settlementAction(a, row.id, "reject", {}),
    ).rejects.toMatchObject({ status: 409 });
  });
  test("confirm đồng thời không xử lý lặp", async () => {
    const row = await debt();
    await s.settlementAction(b, row.id, "mark-paid", {});
    const results = await Promise.allSettled([
      s.settlementAction(a, row.id, "confirm", {}),
      s.settlementAction(a, row.id, "confirm", {}),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await Settlement.countDocuments({ status: "paid" })).toBe(1);
  });
  test("rời cần xác nhận công nợ; archive đọc được, mọi ghi bị chặn", async () => {
    const row = await debt();
    await deposit();
    await expect(
      coupleService.leave(b, { confirm: true }),
    ).rejects.toMatchObject({ code: "OUTSTANDING_SETTLEMENTS" });
    await coupleService.leave(b, { confirm: true, confirmOutstanding: true });
    expect((await s.wallets(b, { coupleId })).readOnly).toBe(true);
    expect(
      (await s.transaction(a, row.sourceTransactionId, { coupleId })).readOnly,
    ).toBe(true);
    expect((await s.settlements(a, { coupleId })).items).toHaveLength(1);
    expect((await s.summary(b, { coupleId })).amount).toBe(50);
    expect((await s.dashboard(a, { coupleId })).readOnly).toBe(true);
    await expect(
      s.settlementAction(a, row.id, "confirm", {}),
    ).rejects.toMatchObject({ status: 404 });
    await expect(deposit()).rejects.toMatchObject({ status: 404 });
    await coupleService.create(a, { name: "Mới" });
    await expect(
      s.deleteTransaction(a, row.sourceTransactionId),
    ).rejects.toMatchObject({ status: 404 });
    await expect(s.wallets(c, { coupleId })).rejects.toMatchObject({
      status: 404,
    });
  });
  test("API validation, quyền, các đường dẫn và không tạo settlement tự do", async () => {
    expect((await request(app).get("/api/shared-wallets")).status).toBe(401);
    expect(
      (
        await request(app)
          .post("/api/settlements")
          .auth(token, { type: "bearer" })
          .send({ amount: 100 })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .post("/api/shared-transactions")
          .auth(token, { type: "bearer" })
          .send({
            sharedWalletId: walletId,
            payerId: a,
            amount: 101,
            date,
            description: "Sai",
            categoryId,
            splitType: "custom",
            paidFrom: "personal",
            splits: [
              { userId: a, shareAmount: 50 },
              { userId: b, shareAmount: 50 },
            ],
          })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .get("/api/shared-wallets")
          .auth(token, { type: "bearer" })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .get("/api/shared-transactions?from=2026-10-04&to=2026-10-03")
          .auth(token, { type: "bearer" })
      ).status,
    ).toBe(400);
  });
});
describe("Mục tiêu chung", () => {
  test("CRUD, góp đồng thời, history và hoàn tác; không trừ quỹ", async () => {
    await deposit();
    const g = await s.createGoal(a, {
      name: "Du lịch",
      targetAmount: 100,
      deadline: "2027-01-01",
    });
    expect((await s.updateGoal(b, g.id, { name: "Đà Lạt" })).name).toBe(
      "Đà Lạt",
    );
    await Promise.all([
      s.contributeGoal(a, g.id, { amount: 60, date }),
      s.contributeGoal(b, g.id, { amount: 50, date }),
    ]);
    expect((await s.goals(b, {})).items[0].progress).toBe(110);
    const rows = await s.goalContributions(a, g.id, {});
    expect(rows.total).toBe(2);
    const arow = rows.items.find((x) => x.userId === a)!;
    await expect(s.undoGoal(b, g.id, arow.id)).rejects.toMatchObject({
      status: 403,
    });
    await s.undoGoal(a, g.id, arow.id);
    await expect(s.undoGoal(a, g.id, arow.id)).rejects.toMatchObject({
      status: 404,
    });
    expect((await SharedGoal.findById(g.id))!.savedAmount).toBe(50);
    expect((await SharedWallet.findById(walletId))!.balance).toBe(1000);
    await s.deleteGoal(b, g.id);
    expect((await s.goals(a, {})).items).toHaveLength(0);
    await expect(
      s.contributeGoal(a, g.id, { amount: 1, date }),
    ).rejects.toMatchObject({ status: 404 });
  });
  test("overflow rollback, invalid IDs và resource không thuộc nhóm", async () => {
    const g = await s.createGoal(a, { name: "Lớn", targetAmount: 1 });
    await s.contributeGoal(a, g.id, { amount: Number.MAX_SAFE_INTEGER, date });
    await expect(
      s.contributeGoal(b, g.id, { amount: 1, date }),
    ).rejects.toMatchObject({ code: "MONEY_OVERFLOW" });
    await expect(s.updateGoal(c, g.id, { name: "Hack" })).rejects.toMatchObject(
      { status: 404 },
    );
    await expect(
      s.goalContributions(a, "123456789012345678901234", {}),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      s.deleteGoal(a, "123456789012345678901234"),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      s.updateGoal(a, "123456789012345678901234", { name: "X" }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      s.settlementAction(a, "123456789012345678901234", "confirm", {}),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      s.contributions(a, "123456789012345678901234", {}),
    ).rejects.toMatchObject({ status: 404 });
  });
  test("mục tiêu được snapshot chỉ đọc khi archive; feed không chứa token", async () => {
    const g = await s.createGoal(a, { name: "Chung", targetAmount: 100 });
    await s.contributeGoal(b, g.id, { amount: 20, date });
    await coupleService.leave(b, { confirm: true });
    expect((await s.goals(a, { coupleId })).readOnly).toBe(true);
    expect((await s.goalContributions(b, g.id, { coupleId })).total).toBe(1);
    expect((await s.dashboard(a, { coupleId })).goals[0].savedAmount).toBe(20);
    expect(JSON.stringify(await CoupleActivity.find({}))).not.toContain(
      "Bearer",
    );
  });
});
