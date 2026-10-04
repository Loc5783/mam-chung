process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1/test?replicaSet=rs0";
process.env.JWT_SECRET = "test-secret-longer-than-thirty-two-characters";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../../../app";
import { env } from "../../../config/env";
import { User } from "../../users/model";
import { RefreshToken } from "../../auth/model";
import { coupleModels, CoupleInvite } from "../../couples/models";
import { coupleService } from "../../couples/service";
import { sharedModels } from "../../shared/models";
import { sharedService } from "../../shared/service";
import { Category, Wallet, FinancialTransaction } from "../../finance/models";
import { financeService } from "../../finance/service";
import { seedCategories } from "../../../seeds/categories";
import { planningModels } from "../../planning/models";
import { planningService, todayInZone } from "../../planning/service";
import { taskModels } from "../../tasks/models";
import { taskService } from "../../tasks/service";
import { fitnessModels } from "../../fitness/models";
import { fitnessService } from "../../fitness/service";
import { seedExercises } from "../../fitness/seed";
import { Notification, notificationModels } from "../models";
import { notificationService as s } from "../service";
import { dashboardService as home } from "../../dashboard/service";
let db: MongoMemoryReplSet,
  a: string,
  b: string,
  c: string,
  category: string,
  token: string;
const models = [
  User,
  RefreshToken,
  Category,
  Wallet,
  FinancialTransaction,
  ...coupleModels,
  ...sharedModels,
  ...planningModels,
  ...taskModels,
  ...fitnessModels,
  ...notificationModels,
];
const day = todayInZone(new Date(), "Asia/Ho_Chi_Minh"),
  month = day.slice(0, 7);
const shift = (n: number) =>
  new Date(Date.parse(day + "T00:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
jest.setTimeout(30000);
beforeAll(async () => {
  db = await MongoMemoryReplSet.create({
    binary: { version: "7.0.14" },
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(db.getUri());
  for (const m of models) await m.init();
}, 180000);
beforeEach(async () => {
  for (const m of models) await m.collection.deleteMany({});
  const us = await User.create(
    ["Minh", "Lan", "Khác"].map((name, i) => ({
      name,
      email: `${i}@notifications.local`,
      passwordHash: "unused",
    })),
  );
  [a, b, c] = us.map((u) => u.id as string);
  await seedCategories();
  await seedExercises();
  category = (await Category.findOne({ systemKey: "food" }))!.id as string;
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
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await mongoose.disconnect();
  await db?.stop();
});
const task = (v: Record<string, unknown> = {}, actor = a) =>
  taskService.create(actor, { title: "Đi chợ", deadline: day, ...v });
async function pair() {
  const couple = await coupleService.create(a, {
      name: "Cặp thử",
      anniversary: shift(-100),
    }),
    invite = await coupleService.invite(a);
  await coupleService.accept(b, { code: invite.code });
  return couple.id;
}
async function debt() {
  const wallet = await sharedService.createWallet(a, { name: "Chung" });
  await sharedService.createTransaction(a, {
    sharedWalletId: wallet.id,
    payerId: a,
    amount: 101,
    date: day,
    description: "Ăn chung",
    categoryId: category,
    splitType: "equal",
    paidFrom: "personal",
  });
  return (await sharedService.settlements(a, {})).items[0];
}
it("empty list/read-all have zero counts; invalid/missing users cannot read or write", async () => {
  expect(await s.list(a, {})).toMatchObject({
    items: [],
    total: 0,
    unreadCount: 0,
    page: 1,
    limit: 20,
  });
  expect(await s.readAll(a, {})).toEqual({ updated: 0 });
  await expect(s.list("000000000000000000000000", {})).rejects.toMatchObject({
    status: 404,
  });
  jest
    .spyOn((await import("../../users/repository")).userRepository, "touch")
    .mockResolvedValueOnce(null);
  await expect(s.list(a, {})).rejects.toMatchObject({ status: 404 });
});
it("due reminders include yesterday/today/tomorrow but exclude later, done and cancelled", async () => {
  for (const n of [-1, 0, 1, 2]) await task({ deadline: shift(n) });
  const done = await task();
  await taskService.status(a, done.id, { status: "DONE", revision: 0 });
  const cancelled = await task();
  await taskService.status(a, cancelled.id, {
    status: "CANCELLED",
    revision: 0,
  });
  const r = await s.list(a, {});
  expect(r.total).toBe(3);
  expect(r.items.map((n) => n.title)).toEqual(
    expect.arrayContaining([
      "Công việc quá hạn",
      "Công việc đến hạn hôm nay",
      "Công việc đến hạn ngày mai",
    ]),
  );
  expect((await s.list(b, {})).total).toBe(0);
});
it("assigned shared task notifies recipient, private task stays private, unassigned shared reminds creator", async () => {
  await pair();
  await task({ scope: "shared", assignedTo: b });
  await task({ assignedTo: a });
  await task({ scope: "shared", title: "Chung chưa giao" });
  const rb = await s.list(b, { type: "TASK_ASSIGNED" });
  expect(rb.total).toBe(1);
  expect((await s.list(b, { type: "TASK_DUE" })).total).toBe(1);
  expect((await s.list(a, { type: "TASK_DUE" })).total).toBe(2);
  expect((await s.list(c, {})).total).toBe(0);
});
it("same task editing does not repeat read assignment, reassignment hides old and creates a new unread event", async () => {
  await pair();
  const t = await task({ scope: "shared", assignedTo: b, deadline: null });
  const first = (await s.list(b, { type: "TASK_ASSIGNED" })).items[0];
  await s.read(b, first.id, {});
  await taskService.update(a, t.id, { revision: 0, title: "Đổi tên" });
  expect((await s.list(b, { type: "TASK_ASSIGNED" })).unreadCount).toBe(1);
  expect(
    (await s.list(b, { type: "TASK_ASSIGNED" })).items[0].readAt,
  ).not.toBeNull();
  await taskService.update(a, t.id, { revision: 1, assignedTo: a });
  expect((await s.list(b, { type: "TASK_ASSIGNED" })).total).toBe(0);
  await taskService.update(a, t.id, { revision: 2, assignedTo: b });
  const next = (await s.list(b, { type: "TASK_ASSIGNED" })).items[0];
  expect(next.id).not.toBe(first.id);
  expect(next.readAt).toBeNull();
});
it("read ownership and read-all are idempotent, unread count ignores pagination/filter", async () => {
  await task();
  await task({ deadline: shift(-1) });
  const r = await s.list(a, { limit: 1 });
  expect(r.items).toHaveLength(1);
  expect(r.unreadCount).toBe(2);
  await expect(s.read(b, r.items[0].id, {})).rejects.toMatchObject({
    status: 404,
  });
  const read = await s.read(a, r.items[0].id, {});
  expect((await s.read(a, read.id, {})).readAt).toEqual(read.readAt);
  expect((await s.list(a, { unread: "true" })).total).toBe(1);
  expect((await s.list(a, { unread: "false" })).total).toBe(1);
  expect(await s.readAll(a, {})).toEqual({ updated: 1 });
  expect(await s.readAll(a, {})).toEqual({ updated: 0 });
  expect((await s.list(b, {})).unreadCount).toBe(0);
});
it("reload and concurrent lists cannot duplicate events or reset readAt", async () => {
  await task();
  const results = await Promise.all([
    s.list(a, {}),
    s.list(a, {}),
    s.list(a, {}),
  ]);
  expect(new Set(results.map((r) => r.items[0].id)).size).toBe(1);
  await s.readAll(a, {});
  expect((await s.list(a, {})).unreadCount).toBe(0);
  expect(await Notification.countDocuments({ userId: a })).toBe(1);
});
it("completion/deletion hide reminders; reopening makes unread without duplicate row", async () => {
  const t = await task();
  const first = (await s.list(a, {})).items[0];
  await s.read(a, first.id, {});
  await taskService.status(a, t.id, { revision: 0, status: "DONE" });
  expect((await s.list(a, {})).total).toBe(0);
  await expect(s.read(a, first.id, {})).rejects.toMatchObject({ status: 404 });
  await taskService.status(a, t.id, { revision: 1, status: "TODO" });
  const reopened = (await s.list(a, {})).items[0];
  expect(reopened.id).toBe(first.id);
  expect(reopened.readAt).toBeNull();
  await taskService.remove(a, t.id, { revision: 2 });
  expect((await s.list(a, {})).total).toBe(0);
});
it("deadline changes suppress old reminder and respect profile timezone", async () => {
  const t = await task();
  const first = (await s.list(a, {})).items[0];
  await taskService.update(a, t.id, { revision: 0, deadline: shift(3) });
  expect((await s.list(a, {})).total).toBe(0);
  await taskService.update(a, t.id, { revision: 1, deadline: shift(-2) });
  expect((await s.list(a, {})).items[0].id).not.toBe(first.id);
  await User.updateOne({ _id: b }, { $set: { timezone: "Pacific/Honolulu" } });
  const bd = todayInZone(new Date(), "Pacific/Honolulu");
  await task({ deadline: bd }, b);
  expect((await s.list(b, {})).items[0].title).toBe(
    "Công việc đến hạn hôm nay",
  );
});
it("budget notifications use current own month expenses and disappear after corrections", async () => {
  const w = await financeService.createWallet(a, {
    name: "Riêng",
    type: "cash",
    initialBalance: 1000,
  });
  const budget = await planningService.createBudget(a, {
    categoryId: category,
    month,
    amount: 100,
  });
  const tx = await financeService.createTransaction(a, {
    walletId: w.id,
    categoryId: category,
    type: "expense",
    amount: 100,
    date: day,
    description: "Ăn",
  });
  expect((await s.list(a, { type: "BUDGET_EXCEEDED" })).total).toBe(1);
  expect((await s.list(b, {})).total).toBe(0);
  await s.readAll(a, {});
  expect((await s.list(a, {})).unreadCount).toBe(0);
  await financeService.deleteTransaction(a, tx.id);
  expect((await s.list(a, {})).total).toBe(0);
  await financeService.createTransaction(a, {
    walletId: w.id,
    categoryId: category,
    type: "expense",
    amount: 110,
    date: day,
    description: "Ăn",
  });
  expect((await s.list(a, {})).unreadCount).toBe(1);
  await planningService.deleteBudget(a, budget.id);
  expect((await s.list(a, {})).total).toBe(0);
});
it("budgets below threshold and other months do not notify, income is not spending", async () => {
  const w = await financeService.createWallet(a, {
    name: "Riêng",
    type: "cash",
    initialBalance: 1000,
  });
  const salary = (await Category.findOne({ systemKey: "salary" }))!
    .id as string;
  await planningService.createBudget(a, {
    categoryId: category,
    month,
    amount: 100,
  });
  await financeService.createTransaction(a, {
    walletId: w.id,
    categoryId: category,
    type: "expense",
    amount: 99,
    date: day,
    description: "Ăn",
  });
  await financeService.createTransaction(a, {
    walletId: w.id,
    categoryId: salary,
    type: "income",
    amount: 100,
    date: day,
    description: "Lương",
  });
  expect((await s.list(a, {})).total).toBe(0);
});
it("new debt notifies both parties, payment confirmation only receiver, paid hides both", async () => {
  await pair();
  const r = await debt();
  expect((await s.list(a, { type: "DEBT_NEW" })).total).toBe(1);
  expect((await s.list(b, { type: "DEBT_NEW" })).total).toBe(1);
  await sharedService.settlementAction(b, r.id, "mark-paid", {});
  expect((await s.list(a, { type: "PAYMENT_CONFIRM" })).total).toBe(1);
  expect((await s.list(b, { type: "PAYMENT_CONFIRM" })).total).toBe(0);
  await sharedService.settlementAction(a, r.id, "confirm", {});
  expect((await s.list(a, { type: "DEBT_NEW" })).total).toBe(0);
  expect((await s.list(a, { type: "PAYMENT_CONFIRM" })).total).toBe(0);
});
it("rejected payment deactivates old request, new mark-paid gets its own unread request", async () => {
  await pair();
  const r = await debt();
  await sharedService.settlementAction(b, r.id, "mark-paid", {});
  const first = (await s.list(a, { type: "PAYMENT_CONFIRM" })).items[0];
  await s.read(a, first.id, {});
  await sharedService.settlementAction(a, r.id, "reject", {});
  expect((await s.list(a, { type: "PAYMENT_CONFIRM" })).total).toBe(0);
  await sharedService.settlementAction(b, r.id, "mark-paid", {});
  const next = (await s.list(a, { type: "PAYMENT_CONFIRM" })).items[0];
  expect(next.id).not.toBe(first.id);
  expect(next.readAt).toBeNull();
});
it("deleting source shared transaction removes debt notice", async () => {
  await pair();
  const r = await debt();
  await s.list(a, {});
  await sharedService.deleteTransaction(a, r.sourceTransactionId);
  expect((await s.list(a, { type: "DEBT_NEW" })).total).toBe(0);
});
it("invitation notification is limited to creator and validated recipient, never exposes code/hash", async () => {
  await coupleService.create(a, { name: "Mời thử" });
  const i = await coupleService.invite(a);
  expect((await s.list(a, { type: "COUPLE_INVITE" })).total).toBe(1);
  expect((await s.list(b, {})).total).toBe(0);
  await coupleService.preview(b, i.code);
  await coupleService.preview(b, i.code);
  const received = await s.list(b, {});
  expect(received.total).toBe(1);
  expect(received.items[0].title).toBe("Bạn có lời mời ghép đôi");
  expect(JSON.stringify(received)).not.toContain(i.code);
  expect(JSON.stringify(received)).not.toContain("codeHash");
  expect((await s.list(c, {})).total).toBe(0);
  await coupleService.accept(b, { code: i.code });
  expect((await s.list(b, { type: "COUPLE_INVITE" })).total).toBe(0);
  expect((await s.list(b, { type: "INVITE_ACCEPTED" })).total).toBe(1);
  expect((await s.list(a, { type: "INVITE_ACCEPTED" })).total).toBe(1);
});
it("revoked or expired invites cease reminding recipient and owner", async () => {
  await coupleService.create(a, { name: "Mời" });
  const i = await coupleService.invite(a);
  await coupleService.preview(b, i.code);
  await s.list(b, {});
  await coupleService.revokeInvite(a);
  expect((await s.list(b, {})).total).toBe(0);
  const j = await coupleService.invite(a);
  await coupleService.preview(b, j.code);
  await CoupleInvite.updateOne(
    { _id: j.id },
    { $set: { expiresAt: new Date(0) } },
  );
  expect((await s.list(b, {})).total).toBe(0);
  expect((await s.list(a, {})).total).toBe(0);
});
it("leaving couple hides old shared reminders but retains private ones", async () => {
  await pair();
  await task({ scope: "shared", assignedTo: b });
  await debt();
  await task({}, b);
  await s.list(b, {});
  await coupleService.leave(b, { confirm: true, confirmOutstanding: true });
  const r = await s.list(b, {});
  expect(r.total).toBe(1);
  expect(r.items[0].type).toBe("TASK_DUE");
  expect((await home.get(a, {})).shared).toBeNull();
});
it("sync and read-all rollback when persistence fails", async () => {
  await task();
  const spy = jest
    .spyOn(Notification, "create")
    .mockRejectedValueOnce(new Error("failed insert"));
  await expect(s.list(a, {})).rejects.toThrow("failed insert");
  spy.mockRestore();
  expect(await Notification.countDocuments({ userId: a })).toBe(0);
  const r = await s.list(a, {});
  jest.spyOn(Notification, "updateMany").mockImplementationOnce(() => {
    throw new Error("failed cleanup");
  });
  await expect(s.readAll(a, {})).rejects.toThrow("failed cleanup");
  expect((await Notification.findById(r.items[0].id))!.readAt).toBeNull();
});
it("HTTP guards, strict validation, read and read-all expose only own notices", async () => {
  const app = createApp();
  expect((await request(app).get("/api/notifications")).status).toBe(401);
  const headers = { Authorization: "Bearer " + token };
  for (const p of [
    "/api/notifications?limit=101",
    "/api/notifications?userId=" + b,
    "/api/notifications?unread=x",
    "/api/dashboard?coupleId=" + b,
  ])
    expect((await request(app).get(p).set(headers)).status).toBe(400);
  await task();
  const r = await request(app).get("/api/notifications").set(headers);
  expect(r.body.unreadCount).toBe(1);
  expect(
    (
      await request(app)
        .patch("/api/notifications/" + r.body.items[0].id + "/read?userId=" + b)
        .set(headers)
        .send({})
    ).status,
  ).toBe(400);
  expect(
    (
      await request(app)
        .post("/api/notifications/read-all?all=true")
        .set(headers)
        .send({})
    ).status,
  ).toBe(400);
  expect(
    (
      await request(app)
        .patch("/api/notifications/" + r.body.items[0].id + "/read")
        .set(headers)
        .send({ readAt: "x" })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(app)
        .patch("/api/notifications/" + r.body.items[0].id + "/read")
        .set(headers)
        .send({})
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .post("/api/notifications/read-all")
        .set(headers)
        .send({})
    ).body.updated,
  ).toBe(0);
  expect((await request(app).get("/api/dashboard")).status).toBe(401);
  expect(
    (await request(app).get("/api/dashboard").set(headers)).body.tasks.today
      .total,
  ).toBe(1);
});
it("dashboard aggregates private balances/tasks/fitness and active shared context without partner private data", async () => {
  await pair();
  await financeService.createWallet(a, {
    name: "A",
    type: "cash",
    initialBalance: 1000,
  });
  await financeService.createWallet(b, {
    name: "B",
    type: "cash",
    initialBalance: 99999,
  });
  const sw = await sharedService.createWallet(a, { name: "Quỹ" });
  await sharedService.contribute(a, sw.id, { amount: 500, date: day });
  await task();
  await task({ title: "B riêng" }, b);
  await task({ scope: "shared" });
  await fitnessService.createSession(a, { date: day, durationMinutes: 40 });
  await fitnessService.createSession(b, { date: day, durationMinutes: 99 });
  const r = await home.get(a, {});
  expect(r.finance.totalBalance).toBe(1000);
  expect(r.shared!.totalBalance).toBe(500);
  expect(r.tasks.today.total).toBe(2);
  expect(r.tasks.today.items.map((t) => t.title)).not.toContain("B riêng");
  expect(r.fitness.stats.totalMinutes).toBe(40);
  expect(r.couple!.anniversaryInfo!.daysTogether).toBe(100);
  expect(r.activity!.items.length).toBeGreaterThan(0);
});
it("dashboard drops stale shared context when couple changes during aggregation and propagates real errors", async () => {
  await pair();
  const real = coupleService.me.bind(coupleService);
  jest
    .spyOn(coupleService, "me")
    .mockImplementationOnce(real)
    .mockResolvedValueOnce({ couple: null });
  expect((await home.get(a, {})).shared).toBeNull();
  jest.restoreAllMocks();
  jest
    .spyOn(sharedService, "dashboard")
    .mockRejectedValueOnce(new Error("database offline"));
  await expect(home.get(a, {})).rejects.toThrow("database offline");
  jest.restoreAllMocks();
  jest
    .spyOn(sharedService, "dashboard")
    .mockRejectedValueOnce(
      new (await import("../../../utils/AppError")).AppError(
        404,
        "NOT_FOUND",
        "gone",
      ),
    );
  expect((await home.get(a, {})).couple).toBeNull();
});
