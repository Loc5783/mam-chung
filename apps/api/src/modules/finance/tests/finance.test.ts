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
import { Wallet, Category, FinancialTransaction } from "../models";
import { seedCategories } from "../../../seeds/categories";
import { financeService as service } from "../service";
import { financeRepository as repo } from "../repository";
import {
  parseFinancialDate,
  monthBounds,
  dateBounds,
} from "../../../utils/dates";
import { addMoney, sumMoney, decimalMoney } from "../../../utils/money";
jest.setTimeout(30000);
let replica: MongoMemoryReplSet,
  userId: string,
  otherId: string,
  expenseId: string,
  incomeId: string,
  token: string,
  otherToken: string,
  app: ReturnType<typeof createApp>;
const date = "2026-10-02";
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
  ]);
  const [a, b] = await User.create([
    { name: "Minh", email: "minh@example.test", passwordHash: "unused-test" },
    { name: "Lan", email: "lan@example.test", passwordHash: "unused-test" },
  ]);
  userId = a.id as string;
  otherId = b.id as string;
  await RefreshToken.create([
    {
      userId,
      tokenHash: "a".repeat(64),
      family: "a",
      securityVersion: 0,
      expiresAt: new Date(Date.now() + 86400000),
    },
    {
      userId: otherId,
      tokenHash: "b".repeat(64),
      family: "b",
      securityVersion: 0,
      expiresAt: new Date(Date.now() + 86400000),
    },
  ]);
  const sign = (id: string, family: string) =>
    jwt.sign({ version: 0, family }, env.JWT_SECRET, {
      subject: id,
      expiresIn: "15m",
      issuer: "mam-chung",
      audience: "mam-chung-web",
    });
  token = sign(userId, "a");
  otherToken = sign(otherId, "b");
  app = createApp();
});
afterAll(async () => {
  await mongoose.disconnect();
  await replica?.stop();
});
const wallet = (balance = 0, extra: Record<string, unknown> = {}) =>
  service.createWallet(userId, {
    name: "Tiền mặt",
    type: "cash",
    initialBalance: balance,
    ...extra,
  });
const entry = (
  walletId: string,
  type: "income" | "expense",
  amount: number,
  extra: Record<string, unknown> = {},
) =>
  service.createTransaction(userId, {
    walletId,
    type,
    amount,
    categoryId: type === "income" ? incomeId : expenseId,
    date,
    description: type === "income" ? "Lương" : "Ăn trưa",
    ...extra,
  });
const balance = async (id: string) => (await Wallet.findById(id))!.balance;
const api = (
  method: "get" | "post" | "put" | "delete",
  path: string,
  authToken = token,
) =>
  request(app)
    [method]("/api" + path)
    .auth(authToken, { type: "bearer" });
describe("Sổ giao dịch và ví", () => {
  test("ví ban đầu bằng 0; CRUD và soft delete ví chưa có lịch sử", async () => {
    const created = await wallet();
    expect(created.balance).toBe(0);
    expect(created.currency).toBe("VND");
    const updated = await service.updateWallet(userId, created.id, {
      name: "Ngân hàng",
      type: "bank",
      color: "#E38FA9",
      icon: "Landmark",
    });
    expect(updated.name).toBe("Ngân hàng");
    expect((await service.wallet(userId, created.id)).type).toBe("bank");
    await service.deleteWallet(userId, created.id);
    expect((await service.wallets(userId, {})).items).toHaveLength(0);
    expect((await Wallet.findById(created.id))!.deletedAt).not.toBeNull();
  });
  test("số dư ban đầu có bút toán, không được tính vào thu nhập", async () => {
    const created = await wallet(1000);
    const opening = await FinancialTransaction.findOne({
      walletId: created.id,
    });
    expect(opening!.kind).toBe("opening");
    expect((await service.reconcile(userId, created.id, {})).matched).toBe(
      true,
    );
    expect((await service.transactions(userId, {})).summary.income).toBe(0);
    expect(
      (await service.transactions(userId, { type: "opening" })).total,
    ).toBe(1);
  });
  test("income cộng, expense trừ đúng", async () => {
    const created = await wallet();
    await entry(created.id, "income", 1000);
    await entry(created.id, "expense", 250);
    expect(await balance(created.id)).toBe(750);
    const summary = await service.transactions(userId, {});
    expect(summary.summary).toEqual({ income: 1000, expense: 250, net: 750 });
  });
  test("chi vượt số dư bị 422 và không tạo giao dịch", async () => {
    const created = await wallet(100);
    await expect(entry(created.id, "expense", 101)).rejects.toMatchObject({
      status: 422,
      code: "INSUFFICIENT_BALANCE",
    });
    expect(await balance(created.id)).toBe(100);
    expect(
      await FinancialTransaction.countDocuments({ kind: "transaction" }),
    ).toBe(0);
  });
  test("cho phép âm theo từng ví; không tắt khi đang âm", async () => {
    const created = await wallet(0, { allowNegative: true });
    await entry(created.id, "expense", 50);
    expect(await balance(created.id)).toBe(-50);
    await expect(
      service.updateWallet(userId, created.id, { allowNegative: false }),
    ).rejects.toMatchObject({ code: "NEGATIVE_BALANCE" });
    await entry(created.id, "income", 50);
    expect(
      (await service.updateWallet(userId, created.id, { allowNegative: false }))
        .allowNegative,
    ).toBe(false);
  });
  test("không sửa trực tiếp balance/userId hoặc nhận tiền lẻ/không an toàn", async () => {
    const created = await wallet();
    expect(
      (await api("put", `/wallets/${created.id}`).send({ balance: 500 }))
        .status,
    ).toBe(400);
    expect(
      (
        await api("post", "/wallets").send({
          name: "Bad",
          type: "cash",
          userId: otherId,
        })
      ).status,
    ).toBe(400);
    for (const amount of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "100"])
      expect(
        (
          await api("post", "/transactions").send({
            walletId: created.id,
            type: "income",
            amount,
            categoryId: incomeId,
            date,
            description: "Bad",
          })
        ).status,
      ).toBe(400);
  });
  test("sửa số tiền, loại, ví hoàn nguyên đúng cùng transaction", async () => {
    const a = await wallet(1000),
      b = await wallet(1000);
    const transaction = await entry(a.id, "expense", 100);
    await service.updateTransaction(userId, transaction.id, { amount: 300 });
    expect(await balance(a.id)).toBe(700);
    await service.updateTransaction(userId, transaction.id, {
      type: "income",
      categoryId: incomeId,
      amount: 200,
      walletId: b.id,
    });
    expect(await balance(a.id)).toBe(1000);
    expect(await balance(b.id)).toBe(1200);
    const updated = await service.transaction(userId, transaction.id);
    expect(updated.walletId).toBe(b.id);
    expect(updated.type).toBe("income");
  });
  test("sửa loại mà chưa đổi danh mục bị chặn và rollback", async () => {
    const created = await wallet(1000),
      tx = await entry(created.id, "expense", 100);
    await expect(
      service.updateTransaction(userId, tx.id, { type: "income" }),
    ).rejects.toMatchObject({ code: "CATEGORY_TYPE_MISMATCH" });
    expect(await balance(created.id)).toBe(900);
    expect((await service.transaction(userId, tx.id)).type).toBe("expense");
  });
  test("sửa cùng ví kiểm tra số dư cuối, không chặn hoàn nguyên tạm", async () => {
    const created = await wallet();
    const tx = await entry(created.id, "income", 100);
    await entry(created.id, "expense", 100);
    await service.updateTransaction(userId, tx.id, {
      description: "Đổi mô tả",
    });
    expect(await balance(created.id)).toBe(0);
    await expect(
      service.updateTransaction(userId, tx.id, { amount: 99 }),
    ).rejects.toMatchObject({ status: 422 });
  });
  test("sửa giao dịch sang ví thiếu tiền rollback cả hai ví", async () => {
    const a = await wallet(500),
      b = await wallet(10),
      tx = await entry(a.id, "expense", 200);
    await expect(
      service.updateTransaction(userId, tx.id, { walletId: b.id }),
    ).rejects.toMatchObject({ status: 422 });
    expect(await balance(a.id)).toBe(300);
    expect(await balance(b.id)).toBe(10);
    expect((await service.transaction(userId, tx.id)).walletId).toBe(a.id);
  });
  test("xóa expense hoàn tiền, xóa income trừ tiền và soft delete", async () => {
    const created = await wallet(1000),
      income = await entry(created.id, "income", 200),
      expense = await entry(created.id, "expense", 100);
    await service.deleteTransaction(userId, expense.id);
    expect(await balance(created.id)).toBe(1200);
    await service.deleteTransaction(userId, income.id);
    expect(await balance(created.id)).toBe(1000);
    expect(
      (await FinancialTransaction.findById(expense.id))!.deletedAt,
    ).not.toBeNull();
    expect(
      (await service.transactions(userId, { type: "expense" })).total,
    ).toBe(0);
  });
  test("xóa income đã chi hết bị chặn để không tạo ví âm", async () => {
    const created = await wallet(),
      income = await entry(created.id, "income", 100);
    await entry(created.id, "expense", 100);
    await expect(
      service.deleteTransaction(userId, income.id),
    ).rejects.toMatchObject({ status: 422 });
    expect(await balance(created.id)).toBe(0);
  });
  test("lịch sử đã xóa vẫn không cho xóa ví; có thể lưu trữ và mở lại", async () => {
    const created = await wallet(),
      tx = await entry(created.id, "income", 100);
    await service.deleteTransaction(userId, tx.id);
    await expect(
      service.deleteWallet(userId, created.id),
    ).rejects.toMatchObject({ code: "WALLET_HAS_TRANSACTIONS" });
    await service.updateWallet(userId, created.id, { archived: true });
    expect((await service.wallets(userId, { archived: "true" })).total).toBe(1);
    expect((await service.wallets(userId, { archived: "false" })).total).toBe(
      0,
    );
    await expect(entry(created.id, "income", 100)).rejects.toMatchObject({
      code: "WALLET_ARCHIVED",
    });
    await service.updateWallet(userId, created.id, { archived: false });
    await entry(created.id, "income", 100);
    expect(await balance(created.id)).toBe(100);
  });
  test("ví lưu trữ không cho sửa/xóa giao dịch cũ", async () => {
    const created = await wallet(),
      tx = await entry(created.id, "income", 100);
    await service.updateWallet(userId, created.id, { archived: true });
    await expect(
      service.updateTransaction(userId, tx.id, { amount: 200 }),
    ).rejects.toMatchObject({ code: "WALLET_ARCHIVED" });
    await expect(
      service.deleteTransaction(userId, tx.id),
    ).rejects.toMatchObject({ code: "WALLET_ARCHIVED" });
  });
  test("rollback nếu lỗi sau khi đã đổi số dư", async () => {
    const created = await wallet(100);
    const spy = jest
      .spyOn(repo, "createEntries")
      .mockRejectedValueOnce(new Error("injected"));
    await expect(entry(created.id, "income", 200)).rejects.toThrow("injected");
    spy.mockRestore();
    expect(await balance(created.id)).toBe(100);
    expect(
      await FinancialTransaction.countDocuments({ kind: "transaction" }),
    ).toBe(0);
  });
  test("thao tác đồng thời không làm lệch số dư", async () => {
    const created = await wallet(1000);
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        entry(created.id, i % 2 ? "income" : "expense", 20),
      ),
    );
    expect(await balance(created.id)).toBe(1000);
    expect((await service.reconcile(userId, created.id, {})).matched).toBe(
      true,
    );
    expect(
      await FinancialTransaction.countDocuments({ kind: "transaction" }),
    ).toBe(10);
  });
  test("hai khoản chi đồng thời chỉ một khoản được dùng số dư", async () => {
    const created = await wallet(100);
    const results = await Promise.allSettled([
      entry(created.id, "expense", 70),
      entry(created.id, "expense", 70),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await balance(created.id)).toBe(30);
  });
  test("hai lần xóa cùng giao dịch không hoàn tiền hai lần", async () => {
    const created = await wallet(100),
      tx = await entry(created.id, "expense", 50);
    const results = await Promise.allSettled([
      service.deleteTransaction(userId, tx.id),
      service.deleteTransaction(userId, tx.id),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await balance(created.id)).toBe(100);
  });
  test("đối soát chỉ đọc phát hiện lệch; sửa phải yêu cầu rõ", async () => {
    const created = await wallet(100);
    await entry(created.id, "income", 50);
    await Wallet.updateOne({ _id: created.id }, { $set: { balance: 1 } });
    const report = await service.reconcile(userId, created.id, {});
    expect(report).toMatchObject({
      actualBalance: 1,
      expectedBalance: 150,
      difference: 149,
      matched: false,
      repaired: false,
    });
    expect(await balance(created.id)).toBe(1);
    expect(
      (await service.reconcile(userId, created.id, { repair: true })).repaired,
    ).toBe(true);
    expect(await balance(created.id)).toBe(150);
  });
  test("đối soát không sửa thành âm khi ví cấm âm", async () => {
    const created = await wallet(0, { allowNegative: true });
    await entry(created.id, "expense", 100);
    await Wallet.updateOne(
      { _id: created.id },
      { $set: { allowNegative: false, balance: 0 } },
    );
    await expect(
      service.reconcile(userId, created.id, { repair: true }),
    ).rejects.toMatchObject({ code: "NEGATIVE_BALANCE" });
  });
  test("giữ chính xác tiền lớn và chặn overflow", async () => {
    const created = await wallet();
    await entry(created.id, "income", Number.MAX_SAFE_INTEGER);
    expect((await service.transactions(userId, {})).summary.income).toBe(
      Number.MAX_SAFE_INTEGER,
    );
    await expect(entry(created.id, "income", 1)).rejects.toMatchObject({
      code: "MONEY_OVERFLOW",
    });
    expect(await balance(created.id)).toBe(Number.MAX_SAFE_INTEGER);
    expect(
      sumMoney([Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER, 1]),
    ).toBe(1);
    expect(() => addMoney(Number.MAX_SAFE_INTEGER, 1)).toThrow();
    expect(decimalMoney("1.000E+3")).toBe(1000);
    expect(() => decimalMoney("0.5")).toThrow();
  });
});
describe("Chuyển tiền liên kết", () => {
  test("tạo hai dòng, không tính thu/chi, đối soát đúng", async () => {
    const a = await wallet(1000),
      b = await wallet();
    const result = await service.transfer(userId, {
      fromWalletId: a.id,
      toWalletId: b.id,
      amount: 250,
      date,
    });
    expect(result.items).toHaveLength(2);
    expect(result.items.every((e) => e.transferId === result.transferId)).toBe(
      true,
    );
    expect(await balance(a.id)).toBe(750);
    expect(await balance(b.id)).toBe(250);
    expect(
      (await service.transactions(userId, { type: "transfer" })).total,
    ).toBe(2);
    expect((await service.transactions(userId, {})).summary).toEqual({
      income: 0,
      expense: 0,
      net: 0,
    });
    expect((await service.reconcile(userId, a.id, {})).matched).toBe(true);
  });
  test("chặn cùng ví, thiếu số dư và ví của người khác", async () => {
    const a = await wallet(100),
      b = await wallet();
    const foreign = await service.createWallet(otherId, {
      name: "Lan",
      type: "bank",
    });
    await expect(
      service.transfer(userId, {
        fromWalletId: a.id,
        toWalletId: a.id,
        amount: 10,
        date,
      }),
    ).rejects.toMatchObject({ code: "SAME_WALLET" });
    await expect(
      service.transfer(userId, {
        fromWalletId: a.id,
        toWalletId: b.id,
        amount: 101,
        date,
      }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      service.transfer(userId, {
        fromWalletId: a.id,
        toWalletId: foreign.id,
        amount: 10,
        date,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
  test("xóa một dòng hoàn nguyên cả cặp, không sửa/nhân bản lẻ", async () => {
    const a = await wallet(100),
      b = await wallet(),
      result = await service.transfer(userId, {
        fromWalletId: a.id,
        toWalletId: b.id,
        amount: 40,
        date,
      });
    await expect(
      service.updateTransaction(userId, result.items[0].id, { amount: 20 }),
    ).rejects.toMatchObject({ code: "LINKED_ENTRY" });
    await expect(
      service.duplicate(userId, result.items[0].id, {}),
    ).rejects.toMatchObject({ code: "LINKED_ENTRY" });
    await service.deleteTransaction(userId, result.items[1].id);
    expect(await balance(a.id)).toBe(100);
    expect(await balance(b.id)).toBe(0);
    expect(
      (await service.transactions(userId, { type: "transfer" })).total,
    ).toBe(0);
  });
  test("xóa cặp khi ví nhận đã chi hết bị chặn và giữ nguyên", async () => {
    const a = await wallet(100),
      b = await wallet(),
      result = await service.transfer(userId, {
        fromWalletId: a.id,
        toWalletId: b.id,
        amount: 40,
        date,
      });
    await entry(b.id, "expense", 40);
    await expect(
      service.deleteTransaction(userId, result.items[0].id),
    ).rejects.toMatchObject({ status: 422 });
    expect(await balance(a.id)).toBe(60);
    expect(await balance(b.id)).toBe(0);
    expect(
      (await service.transactions(userId, { type: "transfer" })).total,
    ).toBe(2);
  });
  test("rollback chuyển tiền khi tạo dòng liên kết lỗi", async () => {
    const a = await wallet(100),
      b = await wallet();
    const spy = jest
      .spyOn(repo, "createEntries")
      .mockRejectedValueOnce(new Error("transfer-failed"));
    await expect(
      service.transfer(userId, {
        fromWalletId: a.id,
        toWalletId: b.id,
        amount: 30,
        date,
      }),
    ).rejects.toThrow("transfer-failed");
    spy.mockRestore();
    expect(await balance(a.id)).toBe(100);
    expect(await balance(b.id)).toBe(0);
  });
  test("không thao tác số dư ban đầu hoặc cặp chuyển tiền bị hỏng", async () => {
    const a = await wallet(100),
      b = await wallet();
    const opening = (await service.transactions(userId, { type: "opening" }))
      .items[0];
    await expect(
      service.deleteTransaction(userId, opening.id),
    ).rejects.toMatchObject({ code: "OPENING_ENTRY" });
    await expect(
      service.updateTransaction(userId, opening.id, { amount: 1 }),
    ).rejects.toMatchObject({ code: "LINKED_ENTRY" });
    const pair = await service.transfer(userId, {
      fromWalletId: a.id,
      toWalletId: b.id,
      amount: 10,
      date,
    });
    await FinancialTransaction.deleteOne({ _id: pair.items[1].id });
    await expect(
      service.deleteTransaction(userId, pair.items[0].id),
    ).rejects.toMatchObject({ code: "INCONSISTENT_TRANSFER" });
  });
});
describe("Danh mục, lọc và quyền sở hữu", () => {
  test("seed idempotent; CRUD danh mục riêng", async () => {
    const before = await Category.countDocuments({ userId: null });
    await seedCategories();
    expect(await Category.countDocuments({ userId: null })).toBe(before);
    const c = await service.createCategory(userId, {
      name: "Cà phê",
      type: "expense",
      icon: "Coffee",
    });
    expect(c.isSystem).toBe(false);
    expect(
      (
        await service.updateCategory(userId, c.id, {
          name: "Cà phê sáng",
          type: "income",
        })
      ).type,
    ).toBe("income");
    expect(
      (await service.categories(userId, { type: "income" })).items.some(
        (x) => x.id === c.id,
      ),
    ).toBe(true);
    await service.deleteCategory(userId, c.id, {});
    expect(
      (await service.categories(userId, {})).items.some((x) => x.id === c.id),
    ).toBe(false);
  });
  test("chặn danh mục hệ thống sửa/xóa, trùng tên cùng loại", async () => {
    await expect(
      service.updateCategory(userId, expenseId, { name: "Sửa" }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.deleteCategory(userId, expenseId, {}),
    ).rejects.toMatchObject({ status: 403 });
    const c = await service.createCategory(userId, {
      name: "Riêng",
      type: "expense",
    });
    await expect(
      service.createCategory(userId, { name: " riêng ", type: "expense" }),
    ).rejects.toMatchObject({ code: "CATEGORY_EXISTS" });
    const other = await service.createCategory(userId, {
      name: "Khác riêng",
      type: "expense",
    });
    await expect(
      service.updateCategory(userId, other.id, { name: c.name }),
    ).rejects.toMatchObject({ code: "CATEGORY_EXISTS" });
  });
  test("thay danh mục trong mọi giao dịch khi xóa; giữ nguyên số dư", async () => {
    const c = await service.createCategory(userId, {
        name: "Cafe",
        type: "expense",
      }),
      created = await wallet(100),
      tx = await entry(created.id, "expense", 20, { categoryId: c.id });
    await expect(
      service.deleteCategory(userId, c.id, {}),
    ).rejects.toMatchObject({ code: "REPLACEMENT_REQUIRED" });
    await expect(
      service.deleteCategory(userId, c.id, { replacementId: c.id }),
    ).rejects.toMatchObject({ code: "REPLACEMENT_REQUIRED" });
    await expect(
      service.deleteCategory(userId, c.id, { replacementId: incomeId }),
    ).rejects.toMatchObject({ code: "CATEGORY_TYPE_MISMATCH" });
    await expect(
      service.updateCategory(userId, c.id, { type: "income" }),
    ).rejects.toMatchObject({ code: "CATEGORY_IN_USE" });
    await service.deleteCategory(userId, c.id, { replacementId: expenseId });
    expect((await service.transaction(userId, tx.id)).categoryId).toBe(
      expenseId,
    );
    expect(await balance(created.id)).toBe(80);
  });
  test("danh mục của user khác không thể dùng làm thay thế", async () => {
    const a = await service.createCategory(userId, {
        name: "A",
        type: "expense",
      }),
      b = await service.createCategory(otherId, { name: "B", type: "expense" }),
      created = await wallet(100);
    await entry(created.id, "expense", 10, { categoryId: a.id });
    await expect(
      service.deleteCategory(userId, a.id, { replacementId: b.id }),
    ).rejects.toMatchObject({ status: 404 });
  });
  test("lọc ngày, ví, loại, danh mục; tìm mô tả; sắp xếp và tổng toàn bộ kết quả", async () => {
    const a = await wallet(1000),
      b = await wallet(1000);
    await entry(a.id, "expense", 200, {
      description: "Cà phê (đặc biệt)",
      date: "2026-10-01",
    });
    await entry(a.id, "expense", 100, {
      description: "Cà phê thường",
      date: "2026-10-02",
    });
    await entry(b.id, "expense", 300, {
      description: "Cà phê khác",
      date: "2026-10-03",
    });
    const list = await service.transactions(userId, {
      from: "2026-10-01",
      to: "2026-10-02",
      walletId: a.id,
      type: "expense",
      categoryId: expenseId,
      search: "Cà phê",
      sort: "amount_asc",
      limit: 1,
    });
    expect(list.total).toBe(2);
    expect(list.items[0].amount).toBe(100);
    expect(list.summary.expense).toBe(300);
    expect(
      (await service.transactions(userId, { search: "(đặc biệt)" })).total,
    ).toBe(1);
    expect((await service.transactions(userId, { search: ".*" })).total).toBe(
      0,
    );
    const page = await service.transactions(userId, {
      type: "expense",
      sort: "amount_desc",
      limit: 1,
      page: 2,
    });
    expect(page.items[0].amount).toBe(200);
    expect(
      (
        await service.transactions(userId, {
          sort: "date_asc",
          from: "2026-10-01",
        })
      ).items[0].description,
    ).toBe("Cà phê (đặc biệt)");
    expect(
      (await service.transactions(userId, { to: "2026-09-30" })).total,
    ).toBe(0);
  });
  test("clone là giao dịch thật, sao chép notes/tags và kiểm tra số dư", async () => {
    const created = await wallet(100),
      tx = await entry(created.id, "expense", 40, {
        notes: "Ghi chú",
        tags: ["cafe"],
      });
    const cloned = await service.duplicate(userId, tx.id, {
      date: "2026-10-03",
    });
    expect(cloned.id).not.toBe(tx.id);
    expect(cloned.tags).toEqual(["cafe"]);
    expect(cloned.notes).toBe("Ghi chú");
    expect(await balance(created.id)).toBe(20);
    await expect(service.duplicate(userId, tx.id, {})).rejects.toMatchObject({
      status: 422,
    });
  });
  test("404 cho mọi tài nguyên user khác, danh sách chỉ thấy của mình", async () => {
    const mine = await wallet(100),
      tx = await entry(mine.id, "expense", 10),
      cat = await service.createCategory(userId, {
        name: "Riêng Minh",
        type: "expense",
      });
    expect((await api("get", `/wallets/${mine.id}`, otherToken)).status).toBe(
      404,
    );
    expect(
      (
        await api("put", `/wallets/${mine.id}`, otherToken).send({
          name: "Hack",
        })
      ).status,
    ).toBe(404);
    expect(
      (await api("delete", `/wallets/${mine.id}`, otherToken)).status,
    ).toBe(404);
    expect(
      (await api("get", `/transactions/${tx.id}`, otherToken)).status,
    ).toBe(404);
    expect(
      (
        await api("put", `/transactions/${tx.id}`, otherToken).send({
          amount: 5,
        })
      ).status,
    ).toBe(404);
    expect(
      (await api("delete", `/transactions/${tx.id}`, otherToken)).status,
    ).toBe(404);
    expect(
      (
        await api("put", `/categories/${cat.id}`, otherToken).send({
          name: "Hack",
        })
      ).status,
    ).toBe(404);
    expect(
      (await api("delete", `/categories/${cat.id}`, otherToken).send({}))
        .status,
    ).toBe(404);
    expect((await service.wallets(otherId, {})).total).toBe(0);
    expect((await service.transactions(otherId, {})).total).toBe(0);
    expect(
      (await service.categories(otherId, {})).items.some(
        (c) => c.id === cat.id,
      ),
    ).toBe(false);
  });
  test("mọi route tài chính yêu cầu auth và input chặt", async () => {
    expect((await request(app).get("/api/wallets")).status).toBe(401);
    for (const path of ["/wallets/not-an-id", "/transactions/not-an-id"])
      expect((await api("get", path)).status).toBe(400);
    expect((await api("get", "/transactions?from=2026-02-30")).status).toBe(
      400,
    );
    expect(
      (await api("get", "/transactions?from=2026-10-03&to=2026-10-01")).status,
    ).toBe(400);
    expect((await api("get", "/wallets?limit=101")).status).toBe(400);
    expect((await api("get", "/transactions?walletId[$ne]=0")).status).toBe(
      400,
    );
    const created = await wallet(100);
    expect(
      (
        await api("post", "/transactions").send({
          walletId: created.id,
          type: "expense",
          amount: 10,
          categoryId: expenseId,
          date: "2026-02-30",
          description: "bad",
        })
      ).status,
    ).toBe(400);
    await expect(
      entry(created.id, "expense", 10, { categoryId: incomeId }),
    ).rejects.toMatchObject({ code: "CATEGORY_TYPE_MISMATCH" });
  });
  test("service không thao tác tài khoản đã xóa và id không tồn tại", async () => {
    const missing = new mongoose.Types.ObjectId().toString();
    await expect(service.wallet(userId, missing)).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.transaction(userId, missing)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      service.updateCategory(userId, missing, { name: "x" }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.deleteCategory(userId, missing, {}),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.updateTransaction(userId, missing, { amount: 1 }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.deleteTransaction(userId, missing),
    ).rejects.toMatchObject({ status: 404 });
    await expect(service.duplicate(userId, missing, {})).rejects.toMatchObject({
      status: 404,
    });
    await User.updateOne({ _id: userId }, { $set: { deletedAt: new Date() } });
    await expect(wallet()).rejects.toMatchObject({ status: 404 });
    await expect(service.wallets(userId, {})).rejects.toMatchObject({
      status: 404,
    });
  });
  test("các controller CRUD và pagination chạy được với Bearer thật", async () => {
    const created = await api("post", "/wallets").send({
      name: "Ví API",
      type: "cash",
      initialBalance: 1000,
    });
    expect(created.status).toBe(201);
    const id = created.body.id;
    const cat = await api("post", "/categories").send({
      name: "Danh mục API",
      type: "expense",
    });
    expect(cat.status).toBe(201);
    expect(
      (await api("get", "/categories?page=1&limit=1")).body.items,
    ).toHaveLength(1);
    expect(
      (await api("put", `/categories/${cat.body.id}`).send({ icon: "Coffee" }))
        .status,
    ).toBe(200);
    const tx = await api("post", "/transactions").send({
      walletId: id,
      type: "expense",
      amount: 100,
      categoryId: cat.body.id,
      date,
      description: "API chi tiêu",
    });
    expect(tx.status).toBe(201);
    expect(
      (await api("put", `/transactions/${tx.body.id}`).send({ amount: 200 }))
        .status,
    ).toBe(200);
    expect(
      (await api("post", `/transactions/${tx.body.id}/duplicate`).send({}))
        .status,
    ).toBe(201);
    expect(
      (await api("get", "/transactions?type=expense")).body.summary.expense,
    ).toBe(400);
    expect((await api("get", "/finance/dashboard")).status).toBe(200);
    expect(
      (await api("post", `/wallets/${id}/reconcile`).send({})).body.matched,
    ).toBe(true);
    expect((await api("delete", `/transactions/${tx.body.id}`)).status).toBe(
      204,
    );
    expect(
      (
        await api("delete", `/categories/${cat.body.id}`).send({
          replacementId: expenseId,
        })
      ).status,
    ).toBe(204);
    expect(
      (await api("put", `/wallets/${id}`).send({ archived: true })).status,
    ).toBe(200);
  });
});
describe("Dashboard và múi giờ", () => {
  test("dashboard rỗng không bịa số liệu, phần trăm null khi tháng trước không có", async () => {
    const data = await service.dashboard(userId);
    expect(data.totalBalance).toBe(0);
    expect(data.income).toBe(0);
    expect(data.expense).toBe(0);
    expect(data.incomeChange).toBeNull();
    expect(data.spending).toEqual([]);
    expect(data.recent).toEqual([]);
  });
  test("tổng ví, tháng hiện tại, so sánh và top5+Khác tính đúng", async () => {
    const created = await wallet(10000);
    const bounds = monthBounds(new Date(), "Asia/Ho_Chi_Minh");
    await entry(created.id, "income", 1000, {
      date: new Date(bounds.previous.getTime() + 3600000).toISOString(),
    });
    await entry(created.id, "income", 2000, {
      date: new Date(bounds.start.getTime() + 3600000).toISOString(),
    });
    for (let i = 1; i <= 7; i++) {
      const category = await service.createCategory(userId, {
        name: `Mục ${i}`,
        type: "expense",
      });
      await entry(created.id, "expense", i * 10, {
        categoryId: category.id,
        date: new Date(bounds.start.getTime() + 7200000).toISOString(),
      });
    }
    const data = await service.dashboard(userId);
    expect(data.income).toBe(2000);
    expect(data.expense).toBe(280);
    expect(data.incomeChange).toBe(100);
    expect(data.totalBalance).toBe(12720);
    expect(data.spending).toHaveLength(6);
    expect(data.spending[5].amount).toBe(30);
    expect(data.recent).toHaveLength(5);
  });
  test("lọc ngày theo múi giờ, không lệch ở ranh giới UTC", async () => {
    const created = await wallet();
    await entry(created.id, "income", 100, { date: "2026-10-01T18:00:00Z" });
    expect(
      (
        await service.transactions(userId, {
          from: "2026-10-02",
          to: "2026-10-02",
        })
      ).total,
    ).toBe(1);
    expect(
      (
        await service.transactions(userId, {
          from: "2026-10-01",
          to: "2026-10-01",
        })
      ).total,
    ).toBe(0);
    expect(
      parseFinancialDate("2026-10-02", "Asia/Ho_Chi_Minh").toISOString(),
    ).toBe("2026-10-02T05:00:00.000Z");
    const dst = dateBounds("2026-03-08", "2026-03-08", "America/New_York");
    expect(dst.upper!.getTime() - dst.lower!.getTime()).toBe(23 * 3600000);
  });
});

describe("Hồi quy kiểm toán logic", () => {
  test("cùng ví khác kiểu chữ không được chuyển tiền cho chính mình", async () => {
    const w = await wallet(100);
    await expect(
      service.transfer(userId, {
        fromWalletId: w.id,
        toWalletId: w.id.toUpperCase(),
        amount: 20,
        date,
      }),
    ).rejects.toMatchObject({ code: "SAME_WALLET" });
    expect(await balance(w.id)).toBe(100);
    expect(
      await FinancialTransaction.countDocuments({ kind: "transfer" }),
    ).toBe(0);
  });
  test("sửa thu nhập đã tiêu hết với mã ví viết hoa chỉ áp dụng chênh lệch cuối", async () => {
    const w = await wallet();
    const tx = await entry(w.id, "income", 100);
    await entry(w.id, "expense", 100);
    await service.updateTransaction(userId, tx.id, {
      walletId: w.id.toUpperCase(),
      amount: 120,
    });
    expect(await balance(w.id)).toBe(20);
    expect((await service.reconcile(userId, w.id, {})).matched).toBe(true);
  });
  test("không thay thế danh mục bằng chính nó với mã viết hoa", async () => {
    const c = await service.createCategory(userId, {
      name: "Danh mục kiểm toán",
      type: "expense",
    });
    const w = await wallet(100);
    await entry(w.id, "expense", 10, { categoryId: c.id });
    await expect(
      service.deleteCategory(userId, c.id, {
        replacementId: c.id.toUpperCase(),
      }),
    ).rejects.toMatchObject({ code: "REPLACEMENT_REQUIRED" });
    expect((await Category.findById(c.id))!.deletedAt).toBeNull();
  });
  test("tìm ghi chú và nhãn theo chuỗi literal, không trùng dòng và không lộ user khác", async () => {
    const w = await wallet(100);
    const tx = await entry(w.id, "expense", 10, {
      notes: "Kiểm toán [đặc biệt]",
      tags: ["Kiểm toán [đặc biệt]"],
    });
    const other = await service.createWallet(otherId, {
      name: "Ví khác",
      type: "cash",
      initialBalance: 100,
    });
    await service.createTransaction(otherId, {
      walletId: other.id,
      categoryId: expenseId,
      type: "expense",
      amount: 20,
      date,
      description: "Kiểm toán [đặc biệt]",
    });
    const result = await service.transactions(userId, {
      search: "kiểm toán [đặc biệt]",
    });
    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe(tx.id);
    expect(result.summary.expense).toBe(10);
    expect((await service.transactions(userId, { search: ".*" })).total).toBe(
      0,
    );
  });
  test("lọc ngày đúng ở năm nhỏ hơn 100 và ngày đổi giờ tại nửa đêm", () => {
    expect(parseFinancialDate("0099-10-02", "UTC").toISOString()).toBe(
      "0099-10-02T12:00:00.000Z",
    );
    const b = dateBounds("2026-09-06", "2026-09-06", "America/Santiago");
    expect(b.lower!.toISOString()).toBe("2026-09-06T04:00:00.000Z");
    expect(b.upper!.toISOString()).toBe("2026-09-07T03:00:00.000Z");
  });
  test("không âm thầm đổi ngày không tồn tại trong múi giờ", () => {
    expect(() => parseFinancialDate("2011-12-30", "Pacific/Apia")).toThrow();
  });
});
