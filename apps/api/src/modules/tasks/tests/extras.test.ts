process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1/test?replicaSet=rs0";
process.env.JWT_SECRET = "test-secret-longer-than-thirty-two-characters";
import mongoose from "mongoose";
import { randomUUID } from "crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { User } from "../../users/model";
import { coupleModels } from "../../couples/models";
import { coupleService } from "../../couples/service";
import { Notification, notificationModels } from "../../notifications/models";
import { notificationService } from "../../notifications/service";
import { taskModels, Task, TaskList, TaskTemplate } from "../models";
import { taskService as tasks } from "../service";
import { taskListService as lists } from "../lists";
import { taskExtras as extras } from "../extensions";
import { runTaskReminderJob } from "../job";
let db: MongoMemoryReplSet, a: string, b: string, c: string;
jest.setTimeout(30000);
beforeAll(async () => {
  db = await MongoMemoryReplSet.create({
    binary: { version: "7.0.14" },
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(db.getUri());
  for (const m of [User, ...coupleModels, ...taskModels, ...notificationModels])
    await m.init();
}, 180000);
beforeEach(async () => {
  for (const m of [User, ...coupleModels, ...taskModels, ...notificationModels])
    await m.collection.deleteMany({});
  const users = await User.create(
    ["Minh", "Lan", "Khác"].map((name, i) => ({
      name,
      email: `${i}@extras.test`,
      passwordHash: "unused",
      timezone: "Asia/Ho_Chi_Minh",
    })),
  );
  [a, b, c] = users.map((u) => u.id as string);
  await coupleService.create(a, { name: "Chung" });
  await coupleService.accept(b, { code: (await coupleService.invite(a)).code });
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await mongoose.disconnect();
  await db?.stop();
});
const make = (extra: Record<string, unknown> = {}, actor = a) =>
  tasks.create(actor, { title: "Việc", ...extra });
it("nudge only targets the other assigned member and survives notification sync", async () => {
  const t = await make({ scope: "shared", assignedTo: b });
  await extras.nudge(a, t.id, {});
  const result = await notificationService.list(b, {});
  expect(result.items.some((n) => n.type === "TASK_NUDGE")).toBe(true);
  expect(
    await Notification.countDocuments({
      userId: b,
      type: "TASK_NUDGE",
      active: true,
    }),
  ).toBe(1);
  await expect(extras.nudge(a, t.id, {})).rejects.toMatchObject({
    status: 429,
  });
  await expect(extras.nudge(c, t.id, {})).rejects.toMatchObject({
    status: 404,
  });
});
it("concurrent nudges send once and cooldown is measured per task", async () => {
  const t = await make({ scope: "shared", assignedTo: b });
  const result = await Promise.allSettled([
    extras.nudge(a, t.id, {}),
    extras.nudge(a, t.id, {}),
  ]);
  expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(await Notification.countDocuments({ type: "TASK_NUDGE" })).toBe(1);
  await Task.updateOne(
    { _id: t.id },
    { $set: { lastNudgedAt: new Date(Date.now() - 3600001) } },
  );
  await extras.nudge(a, t.id, {});
  expect(await Notification.countDocuments({ type: "TASK_NUDGE" })).toBe(2);
});
it("private, self-assigned and terminal tasks cannot be nudged", async () => {
  for (const extra of [
    {},
    { scope: "shared", assignedTo: a },
    { scope: "shared" },
  ]) {
    const t = await make(extra);
    await expect(extras.nudge(a, t.id, {})).rejects.toMatchObject({
      code: "INVALID_NUDGE",
    });
  }
  const done = await make({ scope: "shared", assignedTo: b });
  await tasks.status(a, done.id, { revision: 0, status: "DONE" });
  await expect(extras.nudge(a, done.id, {})).rejects.toMatchObject({
    code: "TASK_FINISHED",
  });
});
it("time logging is idempotent under concurrent retries and rejects changed payload", async () => {
  const t = await make(),
    value = { sessionId: randomUUID(), seconds: 30 };
  await Promise.all([extras.time(a, t.id, value), extras.time(a, t.id, value)]);
  expect((await tasks.get(a, t.id)).timeSpentSeconds).toBe(30);
  await expect(
    extras.time(a, t.id, { ...value, seconds: 31 }),
  ).rejects.toMatchObject({ status: 409 });
  await extras.time(a, t.id, { sessionId: randomUUID(), seconds: 15 });
  expect((await tasks.get(a, t.id)).timeSpentSeconds).toBe(45);
  await expect(extras.time(b, t.id, value)).rejects.toMatchObject({
    status: 404,
  });
});
it("time logging validates bounded seconds and session IDs", async () => {
  const t = await make();
  for (const value of [
    { sessionId: "bad", seconds: 10 },
    { sessionId: randomUUID(), seconds: 0 },
    { sessionId: randomUUID(), seconds: 86401 },
    { sessionId: randomUUID(), seconds: 1.5 },
  ])
    await expect(extras.time(a, t.id, value)).rejects.toBeDefined();
  expect((await tasks.get(a, t.id)).timeSpentSeconds).toBe(0);
});
it("reminder uses user timezone, custom time and optimistic revision", async () => {
  const t = await make({
    deadline: "2099-10-06",
    deadlineHasTime: true,
    deadlineTime: "08:30",
    deadlineTimezone: "Asia/Ho_Chi_Minh",
  });
  const saved = await extras.reminder(a, t.id, {
    mode: "before",
    minutes: 60,
    revision: 0,
  });
  expect(saved.reminderAt?.toISOString()).toBe("2099-10-06T00:30:00.000Z");
  await expect(
    extras.reminder(a, t.id, { mode: "off", revision: 0 }),
  ).rejects.toMatchObject({ status: 409 });
  const custom = await extras.reminder(a, t.id, {
    mode: "custom",
    local: "2099-10-05T10:15",
    revision: 1,
  });
  expect(custom.reminderAt?.toISOString()).toBe("2099-10-05T03:15:00.000Z");
  expect(
    (await extras.reminder(a, t.id, { mode: "off", revision: 2 })).reminderAt,
  ).toBeNull();
});
it("date-only reminders use explicit 18:00 and reject past/invalid dates", async () => {
  const t = await make({ deadline: "2099-10-06" });
  expect(
    (
      await extras.reminder(a, t.id, {
        mode: "before",
        minutes: 10,
        revision: 0,
      })
    ).reminderAt?.toISOString(),
  ).toBe("2099-10-06T10:50:00.000Z");
  for (const local of ["2020-01-01T08:00", "2099-02-30T08:00"])
    await expect(
      extras.reminder(a, t.id, { mode: "custom", local, revision: 1 }),
    ).rejects.toBeDefined();
});
it("reminder job does not duplicate notifications and prunes stale notices on completion", async () => {
  const t = await make({ scope: "shared", assignedTo: b });
  await extras.reminder(a, t.id, {
    mode: "custom",
    local: "2099-10-05T10:00",
    revision: 0,
  });
  const now = new Date("2099-10-06T00:00:00Z");
  await Promise.all([runTaskReminderJob(now), runTaskReminderJob(now)]);
  expect(await Notification.countDocuments({ type: "TASK_REMINDER" })).toBe(1);
  expect(
    (await notificationService.list(b, {})).items.some(
      (n) => n.type === "TASK_REMINDER",
    ),
  ).toBe(true);
  await tasks.status(a, t.id, { revision: 1, status: "DONE" });
  expect(
    (await notificationService.list(b, {})).items.some(
      (n) => n.type === "TASK_REMINDER",
    ),
  ).toBe(false);
});
it("archived lists do not deliver reminders", async () => {
  const list = await lists.create(a, { name: "Cũ" }),
    t = await make({ listId: list.id });
  await extras.reminder(a, t.id, {
    mode: "custom",
    local: "2099-10-05T10:00",
    revision: 0,
  });
  await lists.update(a, list.id, { revision: 0, archived: true });
  expect((await runTaskReminderJob(new Date("2099-10-06"))).created).toBe(0);
});
it("duplicate resets checklist and completion while preserving task content", async () => {
  const t = await make({
    labels: ["rau"],
    checklist: [{ text: "Mua rau", done: true }],
  });
  await tasks.status(a, t.id, { revision: 0, status: "DONE" });
  const copy = await extras.duplicate(a, t.id, {});
  expect(copy.id).not.toBe(t.id);
  expect(copy.status).toBe("TODO");
  expect(copy.checklist[0].done).toBe(false);
  expect(copy.labels).toEqual(["rau"]);
  expect(copy.timeSpentSeconds).toBe(0);
});
it("promoting a subtask is atomic and revision-protected", async () => {
  const t = await make({ checklist: [{ text: "Mua sữa" }] });
  await expect(
    extras.promote(a, t.id, t.checklist[0].id, { revision: 9 }),
  ).rejects.toMatchObject({ status: 409 });
  expect(await Task.countDocuments()).toBe(1);
  const result = await extras.promote(a, t.id, t.checklist[0].id, {
    revision: 0,
  });
  expect(result.created.title).toBe("Mua sữa");
  expect(result.task.checklist).toHaveLength(0);
});
it("templates reuse shared scope and shopping type, with independent reset checklists", async () => {
  const list = await lists.create(a, {
    name: "Đi chợ",
    scope: "shared",
    type: "shopping",
  });
  await make({
    scope: "shared",
    listId: list.id,
    checklist: [{ text: "Mua", done: true }],
  });
  const template = await extras.saveTemplate(a, {
    name: "Mẫu",
    listId: list.id,
  });
  await expect(
    extras.applyTemplate(c, template.id, { name: "Lấy" }),
  ).rejects.toMatchObject({ status: 404 });
  const result = await extras.applyTemplate(b, template.id, {
    name: "Chợ mới",
  });
  expect(result.list.coupleId).toBe(list.coupleId);
  expect(result.list.type).toBe("shopping");
  expect(result.items[0].kind).toBe("shopping");
  expect(result.items[0].checklist[0].done).toBe(false);
  expect(result.items[0].checklist[0].id).not.toBe(
    (await tasks.list(a, { list: list.id })).items[0].checklist[0].id,
  );
});
it("empty and foreign lists cannot be saved as templates; invalid apply date leaves no list", async () => {
  const list = await lists.create(a, { name: "Rỗng" });
  await expect(
    extras.saveTemplate(a, { name: "X", listId: list.id }),
  ).rejects.toMatchObject({ code: "EMPTY_TEMPLATE" });
  await expect(
    extras.saveTemplate(b, { name: "X", listId: list.id }),
  ).rejects.toMatchObject({ status: 404 });
  await make({ listId: list.id });
  const t = await extras.saveTemplate(a, { name: "X", listId: list.id }),
    count = await TaskList.countDocuments();
  await expect(
    extras.applyTemplate(a, t.id, { name: "Sai", startDate: "2099-02-30" }),
  ).rejects.toBeDefined();
  expect(await TaskList.countDocuments()).toBe(count);
  expect(await TaskTemplate.countDocuments()).toBe(1);
});
it("scope conversion requires active couple and creator for shared-to-personal", async () => {
  const t = await make();
  const joint = await extras.scope(a, t.id, { revision: 0, scope: "shared" });
  expect(joint.coupleId).toBeTruthy();
  await expect(
    extras.scope(b, t.id, { revision: 1, scope: "personal" }),
  ).rejects.toMatchObject({ status: 403 });
  const own = await extras.scope(a, t.id, { revision: 1, scope: "personal" });
  expect(own.coupleId).toBeNull();
  expect(own.assignedTo).toBe(a);
  await expect(tasks.get(b, t.id)).rejects.toMatchObject({ status: 404 });
  const other = await make({}, c);
  await expect(
    extras.scope(c, other.id, { revision: 0, scope: "shared" }),
  ).rejects.toMatchObject({ status: 404 });
});
it("activity is recorded for personal tasks and hidden from other users", async () => {
  const t = await make();
  await tasks.status(a, t.id, { revision: 0, status: "DONE" });
  const result = await extras.activity(a, t.id, {});
  expect(result.items).toHaveLength(2);
  expect(result.items[0].actorId).toBe(a);
  await expect(extras.activity(b, t.id, {})).rejects.toMatchObject({
    status: 404,
  });
});

it("nudge enforces strictly 1 hour cooldown per task without blocking distinct tasks", async () => {
  const t1 = await make({ scope: "shared", assignedTo: b });
  const t2 = await make({ scope: "shared", assignedTo: b });
  await extras.nudge(a, t1.id, {});
  await expect(extras.nudge(a, t1.id, {})).rejects.toMatchObject({
    status: 429,
    code: "NUDGE_LIMIT",
  });
  await expect(extras.nudge(a, t2.id, {})).resolves.toBeDefined();
  await Task.updateOne(
    { _id: t1.id },
    { $set: { lastNudgedAt: new Date(Date.now() - 3540000) } },
  );
  await expect(extras.nudge(a, t1.id, {})).rejects.toMatchObject({
    status: 429,
    code: "NUDGE_LIMIT",
  });
  await Task.updateOne(
    { _id: t1.id },
    { $set: { lastNudgedAt: new Date(Date.now() - 3600001) } },
  );
  await expect(extras.nudge(a, t1.id, {})).resolves.toBeDefined();
});

it("reminder job rerun produces zero duplicate notifications", async () => {
  const t = await make({ scope: "shared", assignedTo: b });
  await extras.reminder(a, t.id, {
    mode: "custom",
    local: "2099-10-05T09:00",
    revision: 0,
  });
  const now = new Date("2099-10-06T00:00:00Z");
  const firstRun = await runTaskReminderJob(now);
  expect(firstRun.created).toBe(1);
  expect(await Notification.countDocuments({ type: "TASK_REMINDER" })).toBe(1);

  const secondRun = await runTaskReminderJob(now);
  expect(secondRun.created).toBe(0);
  const thirdRun = await runTaskReminderJob(new Date("2099-10-06T00:05:00Z"));
  expect(thirdRun.created).toBe(0);
  expect(await Notification.countDocuments({ type: "TASK_REMINDER" })).toBe(1);
});

it("applying template creates new list and items with calculated dates", async () => {
  const list = await lists.create(a, { name: "Chuẩn bị tiệc" });
  await make({
    listId: list.id,
    title: "Lên thực đơn",
    deadline: "2099-10-01",
  });
  await make({
    listId: list.id,
    title: "Mua bánh kẹo",
    deadline: "2099-10-03",
  });
  const template = await extras.saveTemplate(a, {
    name: "Mẫu tiệc",
    listId: list.id,
  });

  const applied = await extras.applyTemplate(a, template.id, {
    name: "Tiệc sinh nhật",
    startDate: "2099-11-10",
  });
  expect(applied.list.name).toBe("Tiệc sinh nhật");
  expect(applied.items).toHaveLength(2);
  expect(applied.items.map((i) => i.title).sort()).toEqual([
    "Lên thực đơn",
    "Mua bánh kẹo",
  ]);
  expect(await TaskTemplate.findById(template.id)).toBeTruthy();
});

it("concurrent distinct time receipts accumulate timeSpentSeconds accurately", async () => {
  const t = await make();
  const session1 = randomUUID();
  const session2 = randomUUID();
  await Promise.all([
    extras.time(a, t.id, { sessionId: session1, seconds: 20 }),
    extras.time(a, t.id, { sessionId: session2, seconds: 35 }),
  ]);
  const updated = await tasks.get(a, t.id);
  expect(updated.timeSpentSeconds).toBe(55);
});

it("activity logs accurately record actor ID, name, and specific action message", async () => {
  const t = await make({ scope: "shared", assignedTo: b });
  await extras.nudge(a, t.id, {});
  await extras.time(a, t.id, { sessionId: randomUUID(), seconds: 45 });
  const act = await extras.activity(a, t.id, {});
  expect(act.items.length).toBeGreaterThanOrEqual(3);
  const nudgeEntry = act.items.find((i) => i.message.includes("lời nhắc nhẹ"));
  expect(nudgeEntry).toBeDefined();
  expect(nudgeEntry?.actorId).toBe(a);
  expect(nudgeEntry?.actorName).toBe("Minh");

  const timeEntry = act.items.find((i) => i.message.includes("45 giây"));
  expect(timeEntry).toBeDefined();
  expect(timeEntry?.actorId).toBe(a);
  expect(timeEntry?.actorName).toBe("Minh");
});

it("shared-to-personal conversion strictly rejects non-creator member", async () => {
  const t = await make({ scope: "shared", assignedTo: a }, b);
  await expect(
    extras.scope(a, t.id, { revision: 0, scope: "personal" }),
  ).rejects.toMatchObject({ status: 403, code: "CREATOR_ONLY" });

  const converted = await extras.scope(b, t.id, {
    revision: 0,
    scope: "personal",
  });
  expect(converted.coupleId).toBeNull();
  expect(converted.assignedTo).toBe(b);
});

it("archived couple rejects writes on shared tasks", async () => {
  const t = await make({ scope: "shared", assignedTo: b });
  await coupleService.leave(b, { confirm: true });

  await expect(extras.nudge(a, t.id, {})).rejects.toMatchObject({
    status: 404,
  });
  await expect(
    extras.time(a, t.id, { sessionId: randomUUID(), seconds: 15 }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    extras.reminder(a, t.id, { mode: "before", minutes: 30, revision: 0 }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    extras.scope(a, t.id, { revision: 0, scope: "personal" }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(extras.duplicate(a, t.id, {})).rejects.toMatchObject({
    status: 404,
  });
});
