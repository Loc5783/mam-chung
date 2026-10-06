process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1/test?replicaSet=rs0";
process.env.JWT_SECRET = "test-secret-longer-than-thirty-two-characters";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../../../app";
import { User } from "../../users/model";
import { RefreshToken } from "../../auth/model";
import { coupleModels } from "../../couples/models";
import { coupleService } from "../../couples/service";
import { taskModels, Task, TaskList } from "../models";
import { taskService as tasks } from "../service";
import { taskListService as lists } from "../lists";
import { taskOperations as ops } from "../operations";
import { migrateTaskLists } from "../migration";
import { between } from "../position";
let db: MongoMemoryReplSet, a: string, b: string, c: string, cid: string;
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
      email: `${i}@foundation.test`,
      passwordHash: "unused",
    })),
  );
  [a, b, c] = us.map((u) => u.id as string);
  cid = (await coupleService.create(a, { name: "Cùng làm" })).id;
  await coupleService.accept(b, { code: (await coupleService.invite(a)).code });
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await mongoose.disconnect();
  await db?.stop();
});
const create = (extra: Record<string, unknown> = {}, actor = a) =>
  tasks.create(actor, { title: "Dọn bàn", ...extra });
it("list scopes, palette, default ownership and revisions are protected", async () => {
  const own = await lists.create(a, { name: "Nhà" });
  const joint = await lists.create(a, {
    name: "Đi chợ",
    scope: "shared",
    type: "shopping",
  });
  expect(own.ownerId).toBe(a);
  expect(joint.coupleId).toBe(cid);
  expect((await lists.list(b, {})).items.map((l) => l.id)).toContain(joint.id);
  expect((await lists.list(b, {})).items.map((l) => l.id)).not.toContain(
    own.id,
  );
  await expect(
    lists.update(b, own.id, { revision: 0, name: "Lấy" }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    lists.update(c, joint.id, { revision: 0, name: "Lấy" }),
  ).rejects.toMatchObject({ status: 404 });
  expect(
    (await lists.update(b, joint.id, { revision: 0, name: "Chợ mới" })).name,
  ).toBe("Chợ mới");
  await expect(
    lists.update(a, joint.id, { revision: 0, name: "Cũ" }),
  ).rejects.toMatchObject({ status: 409 });
  for (const extra of [
    { ownerId: b },
    { coupleId: cid },
    { color: "#000000" },
    { name: " " },
  ])
    await expect(
      lists.create(a, { name: "X", ...extra }),
    ).rejects.toBeDefined();
  await expect(
    lists.create(c, { name: "X", scope: "shared" }),
  ).rejects.toMatchObject({ status: 404 });
  expect((await lists.list(c, { scope: "shared" })).total).toBe(0);
});
it("tasks use Inbox for old clients; custom list must have matching scope", async () => {
  const old = await create();
  expect(old.listId).toBeTruthy();
  expect(old.position).toBeTruthy();
  const shared = await lists.create(a, { name: "Cùng", scope: "shared" });
  const foreign = await lists.create(c, { name: "Riêng" });
  await expect(create({ listId: shared.id })).rejects.toMatchObject({
    status: 404,
  });
  await expect(create({ listId: foreign.id })).rejects.toMatchObject({
    status: 404,
  });
  await expect(
    tasks.update(a, old.id, { listId: shared.id, revision: 0 }),
  ).rejects.toMatchObject({ status: 404 });
  const dest = await lists.create(a, { name: "Công ty" });
  const updated = await tasks.update(a, old.id, {
    listId: dest.id,
    revision: 0,
  });
  expect(updated.listId).toBe(dest.id);
  expect((await tasks.list(a, { list: dest.id })).total).toBe(1);
});
it("date/time fields default safely and validate on create/update", async () => {
  const t = await create({
    deadline: "2026-10-10",
    deadlineHasTime: true,
    deadlineTime: "08:30",
    reminderAt: "2026-10-10T01:20:00Z",
    estimateMinutes: 25,
  });
  expect(t.deadlineTimezone).toBe("Asia/Ho_Chi_Minh");
  expect(t.timeSpentSeconds).toBe(0);
  for (const data of [
    { deadlineHasTime: true },
    { deadlineTime: "99:00" },
    { deadlineTime: "08:00" },
    { startDate: "2026-10-11", deadline: "2026-10-10" },
    { estimateMinutes: -1 },
    { timeSpentSeconds: 300 },
    { completedBy: b },
    { deadlineTimezone: "bad" },
  ])
    await expect(create(data)).rejects.toBeDefined();
  await expect(
    tasks.update(a, t.id, { deadline: null, revision: 0 }),
  ).rejects.toMatchObject({ code: "DEADLINE_TIME_REQUIRED" });
  expect((await tasks.get(a, t.id)).deadline).toBe("2026-10-10");
});
it("smart filters and query alias use user timezone, exclusion and groups", async () => {
  const now = new Date();
  await User.updateOne({ _id: a }, { timezone: "UTC" });
  const date = (n: number) =>
    new Date(now.getTime() + n * 86400000).toISOString().slice(0, 10);
  const today = await create({
    title: "Hóa đơn",
    deadline: date(0),
    assignedTo: a,
    labels: ["nhà"],
  });
  await create({ deadline: date(7), scope: "shared", assignedTo: b });
  await create({ deadline: date(8) });
  await create({ deadline: date(-1) });
  const done = await create({ deadline: date(0) });
  await tasks.status(a, done.id, { revision: 0, status: "DONE" });
  await create();
  expect(
    (await tasks.list(a, { smart: "today" })).items.map((t) => t.id),
  ).toEqual([today.id]);
  expect((await tasks.list(a, { smart: "upcoming" })).total).toBe(1);
  expect((await tasks.list(a, { smart: "overdue" })).total).toBe(1);
  expect((await tasks.list(a, { smart: "mine" })).total).toBe(1);
  expect((await tasks.list(a, { smart: "partner" })).total).toBe(1);
  expect((await tasks.list(c, { smart: "partner" })).total).toBe(0);
  expect((await tasks.list(a, { smart: "shared" })).total).toBe(1);
  expect((await tasks.list(a, { smart: "nodate" })).total).toBe(1);
  expect((await tasks.list(a, { smart: "done" })).total).toBe(1);
  const found = await tasks.list(a, {
    q: "Hóa",
    assignee: a,
    groupBy: "priority",
  });
  expect(found.total).toBe(1);
  expect(found.groups?.[0].taskIds).toEqual([today.id]);
  for (const groupBy of ["deadline", "list", "assignee"])
    expect((await tasks.list(a, { groupBy })).groups!.length).toBeGreaterThan(
      0,
    );
});
it("list archive locks its tasks; unarchive restores access; default cannot archive/delete", async () => {
  const l = await lists.create(a, { name: "Cũ" });
  const t = await create({ listId: l.id });
  await lists.update(a, l.id, { revision: 0, archived: true });
  expect((await tasks.get(a, t.id)).readOnly).toBe(true);
  expect((await lists.list(a, { archived: "true" })).items[0].id).toBe(l.id);
  expect(
    (await tasks.list(a, { list: l.id })).items.find((row) => row.id === t.id)!
      .readOnly,
  ).toBe(true);
  await expect(
    tasks.update(a, t.id, { revision: 0, title: "X" }),
  ).rejects.toMatchObject({ code: "LIST_ARCHIVED" });
  await expect(create({ listId: l.id })).rejects.toMatchObject({
    code: "LIST_ARCHIVED",
  });
  await lists.update(a, l.id, { revision: 1, archived: false });
  expect((await tasks.get(a, t.id)).readOnly).toBe(false);
  const inbox = (await lists.list(a, {})).items.find((row) => row.isDefault)!;
  await expect(
    lists.update(a, inbox.id, { revision: 0, archived: true }),
  ).rejects.toMatchObject({ code: "DEFAULT_LIST" });
  await expect(
    lists.remove(a, inbox.id, { revision: 0, mode: "delete" }),
  ).rejects.toMatchObject({ code: "DEFAULT_LIST" });
});
it("archived couple lists stay readable but cannot mutate or leak to another couple", async () => {
  const l = await lists.create(a, { name: "Lịch sử", scope: "shared" });
  await create({ listId: l.id, scope: "shared" });
  await coupleService.leave(b, { confirm: true });
  expect(
    (await lists.list(b, { coupleId: cid })).items.every((l) => l.readOnly),
  ).toBe(true);
  await expect(
    lists.update(a, l.id, { revision: 0, name: "X" }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(lists.list(c, { coupleId: cid })).rejects.toMatchObject({
    status: 404,
  });
  await coupleService.create(a, { name: "Mới" });
  expect((await lists.list(a, { scope: "shared" })).total).toBe(0);
});
it("deleting a list moves tasks atomically or soft deletes, never moves across owners", async () => {
  const source = await lists.create(a, { name: "Tạm" }),
    target = await lists.create(a, { name: "Đích" }),
    foreign = await lists.create(c, { name: "Khác" });
  const t = await create({ listId: source.id });
  await expect(
    lists.remove(a, source.id, {
      mode: "move",
      targetListId: foreign.id,
      revision: 0,
    }),
  ).rejects.toMatchObject({ status: 404 });
  expect((await tasks.get(a, t.id)).listId).toBe(source.id);
  await lists.remove(a, source.id, {
    mode: "move",
    targetListId: target.id,
    revision: 0,
  });
  expect((await tasks.get(a, t.id)).listId).toBe(target.id);
  await lists.remove(a, target.id, { mode: "delete", revision: 0 });
  expect((await Task.findById(t.id))!.deletedAt).toBeInstanceOf(Date);
  await expect(tasks.get(a, t.id)).rejects.toMatchObject({ status: 404 });
});
it("reorder updates one position, verifies adjacent neighbours and container", async () => {
  const one = await create({ title: "1" }),
    two = await create({ title: "2" }),
    three = await create({ title: "3" });
  await ops.reorder(a, {
    id: three.id,
    revision: 0,
    beforeId: one.id,
    afterId: null,
  });
  expect(
    (await tasks.list(a, { list: one.listId, sort: "manual" })).items.map(
      (t) => t.title,
    ),
  ).toEqual(["3", "1", "2"]);
  expect((await tasks.get(a, one.id)).revision).toBe(0);
  await expect(
    ops.reorder(a, { id: three.id, revision: 0 }),
  ).rejects.toMatchObject({ status: 409 });
  const foreign = await create({}, c);
  await expect(
    ops.reorder(a, { id: three.id, revision: 1, afterId: foreign.id }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    ops.reorder(a, { id: three.id, revision: 1, beforeId: two.id }),
  ).rejects.toMatchObject({ status: 409 });
  const l1 = await lists.create(a, { name: "A" }),
    l2 = await lists.create(a, { name: "B" });
  const inbox = (await lists.list(a, {})).items.find((l) => l.isDefault)!;
  await lists.reorder(a, {
    id: l2.id,
    revision: 0,
    afterId: inbox.id,
    beforeId: l1.id,
  });
  expect((await lists.list(a, {})).items.map((l) => l.id)).toEqual([
    inbox.id,
    l2.id,
    l1.id,
  ]);
});
it("bulk rejects forbidden, missing, deleted or stale IDs without partial changes", async () => {
  const own = await create(),
    foreign = await create({}, c);
  for (const item of [
    { id: foreign.id, revision: 0 },
    { id: new Types.ObjectId().toString(), revision: 0 },
    { id: own.id, revision: 99 },
  ]) {
    const input =
      item.id === own.id ? [item] : [{ id: own.id, revision: 0 }, item];
    await expect(
      ops.bulk(a, {
        action: "update",
        items: input,
        changes: { title: "Không lưu" },
      }),
    ).rejects.toMatchObject({
      code: "BULK_REJECTED",
      details: [expect.objectContaining({ id: item.id })],
    });
    expect((await tasks.get(a, own.id)).title).toBe("Dọn bàn");
  }
  await tasks.remove(c, foreign.id, { revision: 0 });
  await expect(
    ops.bulk(a, {
      action: "delete",
      items: [
        { id: own.id, revision: 0 },
        { id: foreign.id, revision: 1 },
      ],
    }),
  ).rejects.toMatchObject({ code: "BULK_REJECTED" });
  expect((await tasks.get(a, own.id)).revision).toBe(0);
});
it("bulk validates assignment before all writes and moves into unique ordered positions", async () => {
  const own = await create(),
    joint = await create({ scope: "shared" });
  await expect(
    ops.bulk(a, {
      action: "update",
      items: [
        { id: own.id, revision: 0 },
        { id: joint.id, revision: 0 },
      ],
      changes: { assignedTo: b, title: "X" },
    }),
  ).rejects.toMatchObject({ code: "INVALID_ASSIGNEE" });
  expect((await tasks.get(a, joint.id)).title).toBe("Dọn bàn");
  const other = await create(),
    dest = await lists.create(a, { name: "Đích" });
  const result = await ops.bulk(a, {
    action: "update",
    items: [
      { id: own.id, revision: 0 },
      { id: other.id, revision: 0 },
    ],
    changes: { listId: dest.id, priority: "HIGH", labels: ["nhà"] },
  });
  expect(new Set(result.items.map((t) => t.position)).size).toBe(2);
  expect(
    result.items.every((t) => t.listId === dest.id && t.priority === "HIGH"),
  ).toBe(true);
});
it("bulk completion records actor, generates one successor and transaction rolls back DB failure", async () => {
  const one = await create({
      scope: "shared",
      recurrence: "daily",
      deadline: "2026-10-01",
    }),
    two = await create({ scope: "shared" });
  const input = {
    action: "update",
    items: [
      { id: one.id, revision: 0 },
      { id: two.id, revision: 0 },
    ],
    changes: { status: "DONE" },
  };
  const original = Task.prototype.save;
  let writes = 0;
  const spy = jest.spyOn(Task.prototype, "save").mockImplementation(function (
    this: InstanceType<typeof Task>,
    options: unknown,
  ) {
    if (++writes === 2) return Promise.reject(new Error("DB fail"));
    return original.call(this, options as never);
  });
  await expect(ops.bulk(b, input)).rejects.toThrow("DB fail");
  spy.mockRestore();
  expect((await tasks.get(a, one.id)).status).toBe("TODO");
  expect(await Task.countDocuments({ sourceTaskId: one.id })).toBe(0);
  const result = await ops.bulk(b, input);
  expect(result.items.every((t) => t.completedBy === b)).toBe(true);
  expect(await Task.countDocuments({ sourceTaskId: one.id })).toBe(1);
  await expect(ops.bulk(a, input)).rejects.toMatchObject({
    code: "BULK_REJECTED",
  });
});
it("bulk checks size, duplicate IDs, unknown fields and supports soft deletion", async () => {
  const t = await create();
  for (const items of [
    [],
    [
      { id: t.id, revision: 0 },
      { id: t.id, revision: 0 },
    ],
    Array.from({ length: 101 }, () => ({
      id: new Types.ObjectId().toString(),
      revision: 0,
    })),
  ])
    await expect(
      ops.bulk(a, { action: "delete", items }),
    ).rejects.toBeDefined();
  await expect(
    ops.bulk(a, {
      action: "update",
      items: [{ id: t.id, revision: 0 }],
      changes: { coupleId: cid },
    }),
  ).rejects.toBeDefined();
  await ops.bulk(a, { action: "delete", items: [{ id: t.id, revision: 0 }] });
  expect((await Task.findById(t.id))!.deletedAt).toBeTruthy();
});
it("fractional positions stay ordered for 1000 appends and repeated inserts", () => {
  let left: string | null = null;
  for (let i = 0; i < 1000; i++) {
    const next = between(left, null);
    if (left) expect(next > left).toBe(true);
    left = next;
  }
  expect(left!.length).toBeLessThan(40);
  let right = "V";
  for (let i = 0; i < 100; i++) {
    const next = between(null, right);
    expect(next < right).toBe(true);
    right = next;
  }
  expect(between("V", "W") > "V").toBe(true);
  expect(between("V", "W") < "W").toBe(true);
  expect(() => between("W", "V")).toThrow();
});
it("migration dry-run leaves legacy records untouched, apply is idempotent with archived and deleted tasks", async () => {
  const first = new Types.ObjectId(),
    second = new Types.ObjectId(),
    third = new Types.ObjectId();
  await Task.collection.insertMany([
    {
      _id: first,
      title: "Cũ",
      createdBy: new Types.ObjectId(a),
      creatorName: "Minh",
      coupleId: null,
      deadline: "2026-10-01",
      status: "DONE",
      completedAt: new Date(),
      revision: 0,
      createdAt: new Date(),
    },
    {
      _id: second,
      title: "Đã xóa",
      createdBy: new Types.ObjectId(a),
      creatorName: "Minh",
      coupleId: null,
      deletedAt: new Date(),
      revision: 0,
    },
    {
      _id: third,
      title: "Chung cũ",
      createdBy: new Types.ObjectId(a),
      creatorName: "Minh",
      coupleId: new Types.ObjectId(cid),
      revision: 0,
    },
  ]);
  await coupleService.leave(b, { confirm: true });
  const dry = await migrateTaskLists(true);
  expect(dry.tasksUpdated).toBe(3);
  expect(dry.listsCreated).toBe(4);
  expect(await TaskList.countDocuments()).toBe(0);
  expect(
    (await Task.collection.findOne({ _id: first }))!.listId,
  ).toBeUndefined();
  const applied = await migrateTaskLists(false);
  expect(applied.tasksUpdated).toBe(3);
  const row = (await Task.collection.findOne({ _id: first }))!;
  expect(row.listId).toBeTruthy();
  expect(row.position).toBeTruthy();
  expect(row.completedBy).toBeNull();
  expect(row.status).toBe("DONE");
  expect(
    (await Task.collection.findOne({ _id: second }))!.deletedAt,
  ).toBeTruthy();
  const snapshot = await Task.collection.find().sort({ _id: 1 }).toArray();
  expect(await migrateTaskLists(false)).toMatchObject({
    listsCreated: 0,
    tasksUpdated: 0,
  });
  expect(await Task.collection.find().sort({ _id: 1 }).toArray()).toEqual(
    snapshot,
  );
  expect((await tasks.get(a, third.toString())).readOnly).toBe(true);
  expect(
    (await lists.list(a, { coupleId: cid })).items.every((l) => l.readOnly),
  ).toBe(true);
});
it("migration preserves assigned list and custom order and aborts orphan ownership", async () => {
  const l = await lists.create(a, { name: "Đã xếp" });
  const t = await create({ listId: l.id });
  await Task.collection.updateOne(
    { _id: new Types.ObjectId(t.id) },
    { $unset: { estimateMinutes: "" } },
  );
  await migrateTaskLists(false);
  const row = (await Task.collection.findOne({
    _id: new Types.ObjectId(t.id),
  }))!;
  expect(String(row.listId)).toBe(l.id);
  expect(row.position).toBe(t.position);
  await Task.collection.insertOne({
    createdBy: new Types.ObjectId(),
    title: "Mồ côi",
  });
  await expect(migrateTaskLists(false)).rejects.toThrow("thiếu chủ sở hữu");
});
it("new routes enforce auth and validate reorder/bulk before id routes", async () => {
  await RefreshToken.create({
    userId: a,
    tokenHash: "a".repeat(64),
    family: "a",
    securityVersion: 0,
    expiresAt: new Date(Date.now() + 86400000),
  });
  const token = jwt.sign({ version: 0, family: "a" }, process.env.JWT_SECRET!, {
    subject: a,
    issuer: "mam-chung",
    audience: "mam-chung-web",
    expiresIn: "15m",
  });
  const app = createApp(),
    authorization = "Bearer " + token;
  await request(app).get("/api/task-lists").expect(401);
  const list = await request(app)
    .post("/api/task-lists")
    .set("Authorization", authorization)
    .send({ name: "HTTP" })
    .expect(201);
  await request(app)
    .get("/api/task-lists")
    .set("Authorization", authorization)
    .expect(200);
  await request(app)
    .put(`/api/task-lists/${list.body.id}`)
    .set("Authorization", authorization)
    .send({ revision: 0, name: "HTTP2" })
    .expect(200);
  await request(app)
    .patch("/api/tasks/reorder")
    .set("Authorization", authorization)
    .send({})
    .expect(400);
  await request(app)
    .patch("/api/tasks/bulk")
    .set("Authorization", authorization)
    .send({ action: "delete", items: [] })
    .expect(400);
  const t = await create();
  await request(app)
    .patch("/api/tasks/bulk")
    .set("Authorization", authorization)
    .send({
      action: "update",
      items: [{ id: t.id, revision: 0 }],
      changes: { priority: "URGENT" },
    })
    .expect(200);
  await request(app)
    .get("/api/tasks?smart=nodate&groupBy=list&sort=manual")
    .set("Authorization", authorization)
    .expect(200);
  await request(app)
    .delete(`/api/task-lists/${list.body.id}`)
    .set("Authorization", authorization)
    .send({ revision: 1, mode: "delete" })
    .expect(204);
});

it("summary counts all accessible tasks, uses local day and excludes archived/deleted/private partner data", async () => {
  await User.updateOne({ _id: a }, { timezone: "Pacific/Kiritimati" });
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Kiritimati",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  await create({ deadline: today, assignedTo: a, labels: ["maison"] });
  const done = await create({
    deadline: today,
    scope: "shared",
    assignedTo: b,
  });
  await tasks.status(b, done.id, { revision: 0, status: "DONE" });
  await create({ title: "Privé", deadline: today, labels: ["secret"] }, b);
  const removed = await create({ deadline: today });
  await tasks.remove(a, removed.id, { revision: 0 });
  const archived = await lists.create(a, { name: "Cũ" });
  await create({ deadline: today, listId: archived.id });
  await lists.update(a, archived.id, { revision: 0, archived: true });
  const counts = await tasks.summary(a, {});
  expect(counts.counts).toMatchObject({
    all: 2,
    today: 1,
    todayTotal: 2,
    todayDone: 1,
    done: 1,
    mine: 1,
  });
  expect(counts.labels).toEqual(["maison"]);
  expect((await tasks.list(a, {})).total).toBe(2);
  expect((await tasks.list(a, { list: archived.id })).total).toBe(1);
  expect((await tasks.summary(c, {})).counts.all).toBe(0);
  await expect(tasks.summary(c, { coupleId: cid })).rejects.toMatchObject({
    status: 404,
  });
  await coupleService.leave(b, { confirm: true });
  expect((await tasks.summary(a, { coupleId: cid })).counts.done).toBe(1);
});
it("restore enforces ownership, revision, 30-day retention and archived read-only scope", async () => {
  const t = await create();
  await tasks.remove(a, t.id, { revision: 0 });
  await expect(tasks.restore(b, t.id, { revision: 1 })).rejects.toMatchObject({
    status: 404,
  });
  await expect(tasks.restore(a, t.id, { revision: 0 })).rejects.toMatchObject({
    status: 409,
  });
  const restored = await tasks.restore(a, t.id, { revision: 1 });
  expect(restored.revision).toBe(2);
  expect((await tasks.get(a, t.id)).id).toBe(t.id);
  await expect(tasks.restore(a, t.id, { revision: 2 })).rejects.toMatchObject({
    status: 404,
  });
  await tasks.remove(a, t.id, { revision: 2 });
  await Task.updateOne(
    { _id: t.id },
    { deletedAt: new Date(Date.now() - 31 * 86400000) },
  );
  await expect(tasks.restore(a, t.id, { revision: 3 })).rejects.toMatchObject({
    code: "RESTORE_EXPIRED",
  });
  const joint = await create({ scope: "shared" });
  await tasks.remove(a, joint.id, { revision: 0 });
  await coupleService.leave(b, { confirm: true });
  await expect(
    tasks.restore(b, joint.id, { revision: 1 }),
  ).rejects.toMatchObject({ status: 404 });
});
it("summary and restore HTTP routes authenticate and return the new contracts", async () => {
  await RefreshToken.create({
    userId: a,
    tokenHash: "a".repeat(64),
    family: "a",
    securityVersion: 0,
    expiresAt: new Date(Date.now() + 86400000),
  });
  const token = jwt.sign({ version: 0, family: "a" }, process.env.JWT_SECRET!, {
    subject: a,
    issuer: "mam-chung",
    audience: "mam-chung-web",
    expiresIn: "15m",
  });
  const app = createApp(),
    auth = "Bearer " + token;
  await request(app).get("/api/tasks/summary").expect(401);
  const t = await create();
  await tasks.remove(a, t.id, { revision: 0 });
  const summary = await request(app)
    .get("/api/tasks/summary")
    .set("Authorization", auth)
    .expect(200);
  expect(summary.body.counts.all).toBe(0);
  const restored = await request(app)
    .post(`/api/tasks/${t.id}/restore`)
    .set("Authorization", auth)
    .send({ revision: 1 })
    .expect(200);
  expect(restored.body.id).toBe(t.id);
});

it("quick-add creates a validated batch and uses token ownership", async () => {
  const result = await tasks.quickAdd(a, {
    items: [
      { title: "Riêng", assignedTo: a },
      { title: "Chung", scope: "shared", assignedTo: b },
    ],
  });
  expect(result.items).toHaveLength(2);
  expect(result.items[0].createdBy).toBe(a);
  expect(result.items[1].coupleId).toBe(cid);
  expect((await tasks.list(b, {})).items.map((t) => t.title)).toEqual([
    "Chung",
  ]);
});
it("quick-add rolls back every item and default list when any item is unauthorized", async () => {
  await expect(
    tasks.quickAdd(c, {
      items: [{ title: "Hợp lệ" }, { title: "Sai", scope: "shared" }],
    }),
  ).rejects.toMatchObject({ status: 404 });
  expect(await Task.countDocuments()).toBe(0);
  expect(await TaskList.countDocuments({ ownerId: c })).toBe(0);
});
it("quick-add rejects forged ownership, empty and oversized batches", async () => {
  for (const raw of [
    { items: [] },
    { items: Array.from({ length: 101 }, () => ({ title: "Việc" })) },
    { items: [{ title: "X", createdBy: b }] },
    { items: [{ title: "X", coupleId: cid }] },
  ])
    await expect(tasks.quickAdd(a, raw)).rejects.toBeDefined();
  expect(await Task.countDocuments()).toBe(0);
});
it("quick-add HTTP endpoint authenticates and rejects the whole invalid batch", async () => {
  await RefreshToken.create({
    userId: a,
    tokenHash: "a".repeat(64),
    family: "a",
    securityVersion: 0,
    expiresAt: new Date(Date.now() + 86400000),
  });
  const app = createApp(),
    token = jwt.sign({ version: 0, family: "a" }, process.env.JWT_SECRET!, {
      subject: a,
      issuer: "mam-chung",
      audience: "mam-chung-web",
      expiresIn: "15m",
    });
  await request(app)
    .post("/api/tasks/quick-add")
    .send({ items: [{ title: "X" }] })
    .expect(401);
  await request(app)
    .post("/api/tasks/quick-add")
    .set("Authorization", `Bearer ${token}`)
    .send({ items: [{ title: "X" }, { title: "" }] })
    .expect(400);
  expect(await Task.countDocuments()).toBe(0);
});

it("bulk attaches labels without removing existing labels and rolls back on overflow", async () => {
  const first = await create({ labels: ["cũ"] }),
    second = await create({
      labels: Array.from({ length: 10 }, (_, i) => `nhãn${i}`),
    });
  await ops.bulk(a, {
    action: "update",
    items: [{ id: first.id, revision: 0 }],
    changes: { addLabels: ["mới"] },
  });
  expect((await tasks.get(a, first.id)).labels).toEqual(["cũ", "mới"]);
  await expect(
    ops.bulk(a, {
      action: "update",
      items: [
        { id: first.id, revision: 1 },
        { id: second.id, revision: 0 },
      ],
      changes: { addLabels: ["thêm"] },
    }),
  ).rejects.toMatchObject({ code: "LABEL_LIMIT" });
  expect((await tasks.get(a, first.id)).labels).toEqual(["cũ", "mới"]);
});

it("bulk undo restores per-item state atomically and refuses stale revisions", async () => {
  const first = await create(),
    second = await create();
  await tasks.status(a, second.id, { revision: 0, status: "IN_PROGRESS" });
  const changed = await ops.bulk(a, {
    action: "update",
    items: [
      { id: first.id, revision: 0 },
      { id: second.id, revision: 1 },
    ],
    changes: { status: "DONE" },
  });
  const payload = {
    items: changed.items.map((t) => ({
      id: t.id,
      revision: t.revision,
      changes: { status: t.id === first.id ? "TODO" : "IN_PROGRESS" },
    })),
  };
  await ops.undo(a, payload);
  expect((await tasks.get(a, first.id)).status).toBe("TODO");
  expect((await tasks.get(a, second.id)).status).toBe("IN_PROGRESS");
  await expect(ops.undo(a, payload)).rejects.toMatchObject({ status: 409 });
  expect((await tasks.get(a, first.id)).revision).toBe(2);
});
it("bulk undo restores soft-deleted tasks and rejects foreign resources", async () => {
  const first = await create(),
    second = await create();
  const result = await ops.bulk(a, {
    action: "delete",
    items: [
      { id: first.id, revision: 0 },
      { id: second.id, revision: 0 },
    ],
  });
  const payload = {
    items: result.items.map((t) => ({
      id: t.id,
      revision: t.revision,
      restore: true,
    })),
  };
  await expect(ops.undo(c, payload)).rejects.toMatchObject({ status: 404 });
  expect(await Task.countDocuments({ deletedAt: null })).toBe(0);
  await ops.undo(a, payload);
  expect(await Task.countDocuments({ deletedAt: null })).toBe(2);
});
