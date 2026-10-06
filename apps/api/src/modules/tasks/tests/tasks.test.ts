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
import { userRepository } from "../../users/repository";
import { RefreshToken } from "../../auth/model";
import {
  coupleModels,
  Couple,
  CoupleMember,
  CoupleActivity,
} from "../../couples/models";
import { coupleRepository } from "../../couples/repository";
import { coupleService } from "../../couples/service";
import { Task, taskModels } from "../models";
import { taskService as s } from "../service";
let db: MongoMemoryReplSet,
  a: string,
  b: string,
  c: string,
  cid: string,
  token: string,
  app: ReturnType<typeof createApp>;
jest.setTimeout(30000);
beforeAll(async () => {
  db = await MongoMemoryReplSet.create({
    binary: { version: "7.0.14" },
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(db.getUri());
  for (const m of [User, RefreshToken, ...coupleModels, ...taskModels])
    await m.init();
}, 180000);
beforeEach(async () => {
  for (const m of [User, RefreshToken, ...coupleModels, ...taskModels])
    await m.collection.deleteMany({});
  const us = await User.create(
    ["Minh", "Lan", "Khác"].map((name, i) => ({
      name,
      email: `${i}@task.local`,
      passwordHash: "unused",
    })),
  );
  [a, b, c] = us.map((u) => u.id as string);
  cid = (await coupleService.create(a, { name: "Cùng làm" })).id;
  const invite = await coupleService.invite(a);
  await coupleService.accept(b, { code: invite.code });
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
const create = (extra: Record<string, unknown> = {}, actor = a) =>
  s.create(actor, { title: "Dọn bàn", ...extra });
it("CRUD cá nhân giữ quyền sở hữu, assignedTo chỉ chính mình", async () => {
  const t = await create({
    assignedTo: a.toUpperCase(),
    description: "Riêng tư",
  });
  expect(t.assignedTo).toBe(a);
  expect(t.coupleId).toBeNull();
  expect((await s.get(a, t.id)).description).toBe("Riêng tư");
  for (const id of [b, c]) {
    await expect(s.get(id, t.id)).rejects.toMatchObject({ status: 404 });
    await expect(
      s.update(id, t.id, { revision: 0, title: "Đánh cắp" }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(s.remove(id, t.id, { revision: 0 })).rejects.toMatchObject({
      status: 404,
    });
  }
  expect((await s.list(b, {})).total).toBe(0);
  const updated = await s.update(a, t.id, {
    revision: 0,
    title: "Bàn mới",
    deadline: "2026-10-04",
    labels: ["Nhà", "Nhà"],
  });
  expect(updated.revision).toBe(1);
  expect(updated.labels).toEqual(["Nhà"]);
  await s.remove(a, t.id, { revision: 1 });
  await expect(s.get(a, t.id)).rejects.toMatchObject({ status: 404 });
  await expect(create({ assignedTo: b })).rejects.toMatchObject({
    code: "INVALID_ASSIGNEE",
  });
});
it("cả hai sửa chung, không cho người ngoài và không đổi scope qua update", async () => {
  const t = await create({ scope: "shared", assignedTo: b });
  expect(t.coupleId).toBe(cid);
  const v = await s.update(b, t.id, { revision: 0, description: "Lan sửa" });
  expect(v.description).toBe("Lan sửa");
  await expect(s.get(c, t.id)).rejects.toMatchObject({ status: 404 });
  await expect(
    s.status(c, t.id, { revision: 1, status: "DONE" }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    s.update(a, t.id, { revision: 1, coupleId: null }),
  ).rejects.toBeDefined();
  await s.remove(b, t.id, { revision: 1 });
  expect(await CoupleActivity.countDocuments({ type: "tasks" })).toBe(3);
});
it("giao sai thành viên bị chặn và rollback update", async () => {
  const t = await create({ scope: "shared" });
  await expect(
    s.update(a, t.id, { revision: 0, title: "Không lưu", assignedTo: c }),
  ).rejects.toMatchObject({ code: "INVALID_ASSIGNEE" });
  expect((await s.get(b, t.id)).title).toBe("Dọn bàn");
  await expect(
    create({ scope: "shared", assignedTo: c }),
  ).rejects.toMatchObject({ code: "INVALID_ASSIGNEE" });
});
it("task shared cần couple; người solo vẫn tạo personal", async () => {
  await expect(create({ scope: "shared" }, c)).rejects.toMatchObject({
    status: 404,
  });
  expect((await create({}, c)).coupleId).toBeNull();
  expect((await s.members(c, {})).items).toEqual([]);
  await expect(s.list(c, { scope: "shared" })).rejects.toMatchObject({
    status: 404,
  });
});
it("chống ghi đè hai thành viên sửa đồng thời", async () => {
  const t = await create({ scope: "shared" });
  const rs = await Promise.allSettled([
    s.update(a, t.id, { revision: 0, title: "Minh" }),
    s.update(b, t.id, { revision: 0, title: "Lan" }),
  ]);
  expect(rs.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const rejected = rs.find(
    (r) => r.status === "rejected",
  ) as PromiseRejectedResult;
  expect(rejected.reason).toMatchObject({ code: "TASK_CHANGED" });
  expect((await s.get(a, t.id)).revision).toBe(1);
  await expect(s.remove(a, t.id, { revision: 0 })).rejects.toMatchObject({
    status: 409,
  });
});
it("trạng thái lưu completedAt đúng, lặp lại request DONE không đổi timestamp", async () => {
  const t = await create();
  const v = await s.status(a, t.id, { status: "IN_PROGRESS", revision: 0 });
  expect(v.completedAt).toBeNull();
  const d = await s.status(a, t.id, { status: "DONE", revision: 1 });
  expect(d.completedAt).toBeInstanceOf(Date);
  const same = await s.status(a, t.id, { status: "DONE", revision: 2 });
  expect(same.completedAt).toEqual(d.completedAt);
  expect(same.revision).toBe(2);
  const reopened = await s.status(a, t.id, {
    status: "CANCELLED",
    revision: 2,
  });
  expect(reopened.completedAt).toBeNull();
});
it.each([
  ["daily", "2026-01-31", "2026-02-01"],
  ["weekly", "2026-01-31", "2026-02-07"],
  ["monthly", "2026-01-31", "2026-02-28"],
] as const)(
  "lặp %s tạo đúng bản kế tiếp và reset checklist",
  async (frequency, date, next) => {
    const t = await create({
      scope: "shared",
      deadline: date,
      recurrence: frequency,
      checklist: [{ text: "Rửa chén", done: true }],
      assignedTo: b,
      labels: ["Nhà"],
    });
    await s.status(b, t.id, { status: "DONE", revision: 0 });
    const successor = await Task.findOne({ sourceTaskId: t.id });
    expect(successor!.deadline).toBe(next);
    expect(successor!.status).toBe("TODO");
    expect(successor!.checklist[0].done).toBe(false);
    expect(successor!.assignedTo!.toString()).toBe(b);
    await s.status(a, t.id, { status: "TODO", revision: 1 });
    await s.status(a, t.id, { status: "DONE", revision: 2 });
    expect(await Task.countDocuments({ sourceTaskId: t.id })).toBe(1);
  },
);
it("anchor31 qua tháng ngắn rồi trở lại31 khi form gửi ngày không đổi", async () => {
  const t = await create({ deadline: "2026-01-31", recurrence: "monthly" });
  await s.status(a, t.id, { status: "DONE", revision: 0 });
  const n = await Task.findOne({ sourceTaskId: t.id });
  const v = await s.update(a, n!.id, { deadline: "2026-02-28", revision: 0 });
  await s.status(a, v.id, { status: "DONE", revision: 1 });
  expect((await Task.findOne({ sourceTaskId: v.id }))!.deadline).toBe(
    "2026-03-31",
  );
});
it("hoàn thành đồng thời sinh đúng một bản", async () => {
  const t = await create({
    scope: "shared",
    deadline: "2026-10-03",
    recurrence: "daily",
  });
  const results = await Promise.allSettled([
    s.status(a, t.id, { status: "DONE", revision: 0 }),
    s.status(b, t.id, { status: "DONE", revision: 0 }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(await Task.countDocuments({ sourceTaskId: t.id })).toBe(1);
});
it("xóa bản kế tiếp không cho hoàn thành cũ sinh lại", async () => {
  const t = await create({ deadline: "2026-10-03", recurrence: "weekly" });
  await s.status(a, t.id, { status: "DONE", revision: 0 });
  const n = await Task.findOne({ sourceTaskId: t.id });
  await s.remove(a, n!.id, { revision: 0 });
  await s.status(a, t.id, { status: "TODO", revision: 1 });
  await s.status(a, t.id, { status: "DONE", revision: 2 });
  expect(await Task.countDocuments({ sourceTaskId: t.id })).toBe(1);
});
it("lỗi tạo bản lặp rollback trạng thái và activity", async () => {
  const t = await create({
    scope: "shared",
    deadline: "2026-10-03",
    recurrence: "daily",
  });
  jest.spyOn(Task, "create").mockRejectedValueOnce(new Error("DB fail"));
  await expect(
    s.status(a, t.id, { status: "DONE", revision: 0 }),
  ).rejects.toThrow("DB fail");
  expect((await s.get(a, t.id)).status).toBe("TODO");
  expect(await Task.countDocuments()).toBe(1);
  expect(await CoupleActivity.countDocuments({ type: "tasks" })).toBe(1);
});
it("thiếu hạn hoặc ngày vượt9999 không hoàn thành nửa chừng", async () => {
  await expect(create({ recurrence: "daily" })).rejects.toMatchObject({
    code: "DEADLINE_REQUIRED",
  });
  const t = await create();
  await expect(
    s.update(a, t.id, { revision: 0, recurrence: "weekly" }),
  ).rejects.toMatchObject({ code: "DEADLINE_REQUIRED" });
  const max = await create({ deadline: "9999-12-31", recurrence: "daily" });
  await expect(
    s.status(a, max.id, { status: "DONE", revision: 0 }),
  ).rejects.toMatchObject({ code: "DATE_RANGE" });
  expect((await s.get(a, max.id)).status).toBe("TODO");
});
it("bình luận chỉ shared, chống người ngoài, phân trang và snapshot tên", async () => {
  const t = await create({ scope: "shared" });
  for (let i = 0; i < 3; i++)
    await s.comment(b, t.id, { text: ` Bình luận ${i} ` });
  const list = await s.comments(a, t.id, { page: 2, limit: 2 });
  expect(list.total).toBe(3);
  expect(list.items).toHaveLength(1);
  expect(list.items[0].authorName).toBe("Lan");
  expect(list.items[0].text).toBe("Bình luận 2");
  await expect(s.comment(c, t.id, { text: "Lạ" })).rejects.toMatchObject({
    status: 404,
  });
  await expect(s.comments(c, t.id, {})).rejects.toMatchObject({ status: 404 });
  const p = await create();
  await expect(s.comments(a, p.id, {})).rejects.toMatchObject({
    code: "SHARED_ONLY",
  });
  await expect(s.comment(a, p.id, { text: "abc" })).rejects.toMatchObject({
    code: "SHARED_ONLY",
  });
  await expect(s.comment(a, t.id, { text: " " })).rejects.toBeDefined();
});
it("shopping tick từng món chung, bảo vệ revision", async () => {
  const t = await create({
    scope: "shared",
    kind: "shopping",
    checklist: [{ text: "Sữa" }, { text: "Trứng" }],
  });
  const v = await s.update(b, t.id, {
    revision: 0,
    checklist: t.checklist.map((i, k) => ({ ...i, done: k === 0 })),
  });
  expect(v.checklist[0].done).toBe(true);
  expect(v.checklist[1].done).toBe(false);
  expect((await s.list(a, { kind: "shopping" })).total).toBe(1);
  await expect(
    s.update(a, t.id, { revision: 0, checklist: [] }),
  ).rejects.toMatchObject({ status: 409 });
});
it("lọc cá nhân/chung/giao tôi, ngày, status, priority, nhãn và literal tìm kiếm", async () => {
  await create({
    title: "Bàn [1].*",
    description: "Mô tả riêng",
    assignedTo: a,
    labels: ["nhà"],
    deadline: "2026-10-03",
    priority: "URGENT",
  });
  await create({
    scope: "shared",
    title: "Đi chợ",
    assignedTo: b,
    deadline: "2026-10-04",
    priority: "LOW",
  });
  await create({
    scope: "shared",
    title: "Lau nhà",
    assignedTo: a,
    priority: "HIGH",
  });
  expect((await s.list(a, { scope: "personal" })).total).toBe(1);
  expect((await s.list(a, { scope: "shared" })).total).toBe(2);
  expect((await s.list(a, { scope: "mine" })).total).toBe(2);
  expect((await s.list(b, { scope: "mine" })).total).toBe(1);
  expect(
    (
      await s.list(a, {
        from: "2026-10-03",
        to: "2026-10-03",
        status: "TODO",
        priority: "URGENT",
        label: "nhà",
      })
    ).total,
  ).toBe(1);
  expect((await s.list(a, { search: "[1].*" })).total).toBe(1);
  expect((await s.list(a, { search: "mô tả" })).total).toBe(1);
  expect((await s.list(a, { search: "nhà" })).total).toBe(2);
  expect((await s.list(a, { sort: "priority" })).items[0].priority).toBe(
    "URGENT",
  );
  const page = await s.list(a, { sort: "deadline", page: 2, limit: 1 });
  expect(page.items[0].title).toBe("Đi chợ");
  expect((await s.list(a, { sort: "newest" })).total).toBe(3);
  expect((await s.list(a, { sort: "oldest" })).total).toBe(3);
  await expect(
    s.list(a, { from: "2026-10-04", to: "2026-10-03" }),
  ).rejects.toBeDefined();
});
it("hôm nay/quá hạn theo timezone loại DONE/CANCELLED và không hạn", async () => {
  const now = new Date();
  const fmt = (offset: number) =>
    new Date(now.getTime() + offset * 86400000).toISOString().slice(0, 10);
  await User.updateOne({ _id: a }, { timezone: "UTC" });
  await create({ deadline: fmt(0) });
  await create({ deadline: fmt(-1) });
  const done = await create({ deadline: fmt(-1) });
  await s.status(a, done.id, { revision: 0, status: "DONE" });
  const cancelled = await create({ deadline: fmt(0) });
  await s.status(a, cancelled.id, { revision: 0, status: "CANCELLED" });
  await create();
  expect((await s.list(a, { due: "today" })).total).toBe(1);
  expect((await s.list(a, { due: "overdue" })).total).toBe(1);
  await User.updateOne({ _id: a }, { timezone: "Pacific/Kiritimati" });
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Kiritimati",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const local = await create({ title: "Theo giờ địa phương", deadline: day });
  expect((await s.list(a, { due: "today" })).items.map((t) => t.id)).toContain(
    local.id,
  );
});
it("archived readonly sau leave, không lẫn couple mới", async () => {
  const t = await create({ scope: "shared" });
  await s.comment(b, t.id, { text: "Giữ lịch sử" });
  await coupleService.leave(b, { confirm: true });
  expect((await s.list(a, {})).total).toBe(0);
  const list = await s.list(b, { coupleId: cid });
  expect(list.readOnly).toBe(true);
  expect(list.items[0].readOnly).toBe(true);
  expect((await s.get(a, t.id)).readOnly).toBe(true);
  expect((await s.comments(b, t.id, {})).items).toHaveLength(1);
  expect((await s.members(a, { coupleId: cid })).items[1].name).toBe("Lan");
  for (const operation of [
    () => s.update(a, t.id, { revision: 0, title: "Sửa" }),
    () => s.status(b, t.id, { revision: 0, status: "DONE" }),
    () => s.comment(b, t.id, { text: "Không ghi" }),
    () => s.remove(a, t.id, { revision: 0 }),
  ])
    await expect(operation()).rejects.toMatchObject({ status: 404 });
  await coupleService.create(a, { name: "Mới" });
  expect((await s.list(a, { scope: "shared" })).total).toBe(0);
  await expect(s.list(c, { coupleId: cid })).rejects.toMatchObject({
    status: 404,
  });
});
it("members active chỉ trả tên/id và tên archived được giữ", async () => {
  const list = await s.members(a, {});
  expect(list.items.map((i) => i.id)).toEqual([a, b]);
  expect(Object.keys(list.items[0]).sort()).toEqual(["id", "name"]);
  await User.updateOne({ _id: b }, { name: "Lan mới" });
  expect((await s.members(a, {})).items[1].name).toBe("Lan mới");
});
it("race rời couple với tạo: chỉ ghi trước lưu trữ hoặc từ chối nguyên tử", async () => {
  const rs = await Promise.allSettled([
    create({ scope: "shared" }),
    coupleService.leave(b, { confirm: true }),
  ]);
  expect(rs[1].status).toBe("fulfilled");
  await expect(create({ scope: "shared" })).rejects.toMatchObject({
    status: 404,
  });
  const tasks = await Task.find({ coupleId: cid });
  expect(tasks.length).toBeLessThanOrEqual(1);
  expect((await Couple.findById(cid))!.status).toBe("archived");
});
it("user xóa không ghi; khóa parent thất bại không ghi; touch thất bại không ghi", async () => {
  await User.updateOne({ _id: c }, { deletedAt: new Date() });
  await expect(create({}, c)).rejects.toMatchObject({ status: 404 });
  jest.spyOn(userRepository, "touch").mockResolvedValueOnce(null);
  await expect(create()).rejects.toMatchObject({ status: 404 });
  jest.spyOn(coupleRepository, "lock").mockResolvedValueOnce(null);
  await expect(create({ scope: "shared" })).rejects.toMatchObject({
    status: 404,
  });
  expect(await Task.countDocuments()).toBe(0);
});
it("membership không active bị chặn active đọc và ghi", async () => {
  await CoupleMember.updateOne({ userId: b }, { active: false });
  await expect(s.list(b, {})).rejects.toMatchObject({ status: 404 });
  await expect(create({ scope: "shared" }, b)).rejects.toMatchObject({
    status: 404,
  });
});
it("HTTP auth/validation/CRUD/comments/status/delete", async () => {
  await request(app).get("/api/tasks").expect(401);
  await request(app)
    .post("/api/tasks")
    .set("Authorization", "Bearer " + token)
    .send({ title: " " })
    .expect(400);
  const r = await request(app)
    .post("/api/tasks")
    .set("Authorization", "Bearer " + token)
    .send({ title: "HTTP", scope: "shared" })
    .expect(201);
  const id = r.body.id;
  await request(app)
    .get("/api/tasks/members")
    .set("Authorization", "Bearer " + token)
    .expect(200);
  await request(app)
    .get("/api/tasks?scope=shared")
    .set("Authorization", "Bearer " + token)
    .expect(200);
  await request(app)
    .get("/api/tasks/" + id)
    .set("Authorization", "Bearer " + token)
    .expect(200);
  await request(app)
    .put("/api/tasks/" + id)
    .set("Authorization", "Bearer " + token)
    .send({ title: "Sửa HTTP", revision: 0 })
    .expect(200);
  await request(app)
    .patch("/api/tasks/" + id + "/status")
    .set("Authorization", "Bearer " + token)
    .send({ status: "DONE", revision: 1 })
    .expect(200);
  await request(app)
    .post("/api/tasks/" + id + "/comments")
    .set("Authorization", "Bearer " + token)
    .send({ text: "Chào" })
    .expect(201);
  await request(app)
    .get("/api/tasks/" + id + "/comments")
    .set("Authorization", "Bearer " + token)
    .expect(200);
  await request(app)
    .delete("/api/tasks/" + id)
    .set("Authorization", "Bearer " + token)
    .send({ revision: 2 })
    .expect(204);
  await request(app)
    .get("/api/tasks/bad")
    .set("Authorization", "Bearer " + token)
    .expect(400);
});
it("schema chặn trường lạ, danh sách quá giới hạn, mã việc con trùng và invaliddate", async () => {
  for (const extra of [
    { deadline: "2026-02-30" },
    { status: "DONE" },
    { labels: Array.from({ length: 11 }, (_, i) => String(i)) },
    { checklist: [{ text: " ", done: true }] },
    {
      checklist: [
        { id: "12345678-1234-4234-8234-123456789012", text: "A" },
        { id: "12345678-1234-4234-8234-123456789012", text: "B" },
      ],
    },
  ])
    await expect(create(extra)).rejects.toBeDefined();
  const t = await create();
  await expect(s.update(a, t.id, { revision: 0 })).rejects.toBeDefined();
  await expect(
    s.status(a, t.id, { revision: 0, status: "WRONG" }),
  ).rejects.toBeDefined();
});

it("completedBy records the actor and clears on reopening", async () => {
  const t = await create({ scope: "shared" });
  expect(
    (await s.status(b, t.id, { revision: 0, status: "DONE" })).completedBy,
  ).toBe(b);
  expect(
    (await s.status(a, t.id, { revision: 1, status: "TODO" })).completedBy,
  ).toBeNull();
});
