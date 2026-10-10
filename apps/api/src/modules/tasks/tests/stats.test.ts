process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1/test?replicaSet=rs0";
process.env.JWT_SECRET = "test-secret-longer-than-thirty-two-characters";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { createApp } from "../../../app";
import { env } from "../../../config/env";
import { User } from "../../users/model";
import { RefreshToken } from "../../auth/model";
import { coupleModels } from "../../couples/models";
import { coupleService } from "../../couples/service";
import { Task, TaskList, taskModels } from "../models";
import { taskStatsService } from "../stats";
import { zonedDate } from "../../../utils/dates";
import { todayInZone } from "../../planning/service";

let db: MongoMemoryReplSet,
  a: string,
  b: string,
  c: string,
  cid: string,
  tokenA: string,
  app: ReturnType<typeof createApp>;

jest.setTimeout(30000);

beforeAll(async () => {
  db = await MongoMemoryReplSet.create({
    binary: { version: "7.0.14" },
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(db.getUri());
  for (const m of [User, RefreshToken, ...coupleModels, ...taskModels]) {
    await m.init();
  }
  app = createApp();
}, 180000);

beforeEach(async () => {
  for (const m of [User, RefreshToken, ...coupleModels, ...taskModels]) {
    await m.collection.deleteMany({});
  }
  const users = await User.create([
    {
      name: "Minh",
      email: "minh@stats.test",
      passwordHash: "unused",
      timezone: "Asia/Ho_Chi_Minh",
    },
    {
      name: "Lan",
      email: "lan@stats.test",
      passwordHash: "unused",
      timezone: "Asia/Ho_Chi_Minh",
    },
    {
      name: "Khác",
      email: "khac@stats.test",
      passwordHash: "unused",
      timezone: "UTC",
    },
  ]);
  [a, b, c] = users.map((u) => u.id as string);
  tokenA = await makeToken(a, "fam-a");

  const couple = await coupleService.create(a, { name: "Chung" });
  cid = couple.id;
  await coupleService.accept(b, { code: (await coupleService.invite(a)).code });
});

async function makeToken(userId: string, family = "a") {
  await RefreshToken.create({
    userId,
    tokenHash: randomBytes(32).toString("hex"),
    family,
    securityVersion: 0,
    expiresAt: new Date(Date.now() + 86400000),
  });
  return jwt.sign({ version: 0, family }, env.JWT_SECRET, {
    subject: userId,
    issuer: "mam-chung",
    audience: "mam-chung-web",
    expiresIn: "15m",
  });
}

afterEach(() => jest.restoreAllMocks());

afterAll(async () => {
  await mongoose.disconnect();
  await db?.stop();
});

it("rejects invalid range and scope with 400 Bad Request, unauthenticated with 401", async () => {
  await request(app).get("/api/tasks/stats").expect(401);

  await request(app)
    .get("/api/tasks/stats?range=invalid")
    .set("Authorization", "Bearer " + tokenA)
    .expect(400);

  await request(app)
    .get("/api/tasks/stats?scope=invalid")
    .set("Authorization", "Bearer " + tokenA)
    .expect(400);
});

it("empty dataset returns full day array of 0s, null onTimeRate, and 0 streak", async () => {
  const res = await request(app)
    .get("/api/tasks/stats?range=7d&scope=all")
    .set("Authorization", "Bearer " + tokenA)
    .expect(200);

  expect(res.body.completed).toEqual({ today: 0, thisWeek: 0, thisMonth: 0 });
  expect(res.body.onTimeRate).toBeNull();
  expect(res.body.streak).toEqual({ current: 0, best: 0 });
  expect(res.body.byDay).toHaveLength(7);
  expect(
    res.body.byDay.every((d: { completed: number }) => d.completed === 0),
  ).toBe(true);
  expect(res.body.byPriority).toEqual({
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    URGENT: 0,
  });
  expect(res.body.byList).toEqual([]);
  expect(res.body.lateHabits).toEqual([]);
  expect(res.body.couple).toBeTruthy();
  expect(res.body.couple.total).toBe(0);
});

it("timezone boundary: completed at 23:59 vs 00:01 in UTC+7 (Asia/Ho_Chi_Minh) correctly maps to local dates", async () => {
  const user = (await User.findById(a))!;
  const today = todayInZone(new Date(), user.timezone);
  const [y, m, d] = today.split("-").map(Number);

  // Pick 3 days ago and 2 days ago in UTC+7
  const date3Ago = new Date(Date.UTC(y, m - 1, d - 3, 12))
    .toISOString()
    .slice(0, 10);
  const [y3, m3, d3] = date3Ago.split("-").map(Number);
  const date2Ago = new Date(Date.UTC(y, m - 1, d - 2, 12))
    .toISOString()
    .slice(0, 10);

  // In Asia/Ho_Chi_Minh (UTC+7):
  // date3Ago 23:59:00 is date3AgoT16:59:00.000Z
  const t1DateUtc = new Date(Date.UTC(y3, m3 - 1, d3, 16, 59, 0));
  // date2Ago 00:01:00 is date3AgoT17:01:00.000Z (which is date3Ago in UTC, but date2Ago in UTC+7!)
  const t2DateUtc = new Date(Date.UTC(y3, m3 - 1, d3, 17, 1, 0));

  await Task.create([
    {
      title: "Việc 23:59",
      createdBy: a,
      creatorName: "Minh",
      status: "DONE",
      completedAt: t1DateUtc,
    },
    {
      title: "Việc 00:01",
      createdBy: a,
      creatorName: "Minh",
      status: "DONE",
      completedAt: t2DateUtc,
    },
  ]);

  const stats = await taskStatsService.get(a, {
    range: "30d",
    scope: "personal",
  });

  const day3 = stats.byDay.find((item) => item.date === date3Ago);
  const day2 = stats.byDay.find((item) => item.date === date2Ago);

  // In UTC+7, t1 is on date3Ago, t2 is on date2Ago
  expect(day3?.completed).toBe(1);
  expect(day2?.completed).toBe(1);
});

it("streak calculation: does not break streak when today has no task yet, correctly increments when today completed", async () => {
  const user = (await User.findById(a))!;
  const today = todayInZone(new Date(), user.timezone);
  const [y, m, d] = today.split("-").map(Number);

  // Yesterday completed task
  const yestNoon = new Date(Date.UTC(y, m - 1, d - 1, 6)); // ~13:00 in UTC+7 yesterday
  // 2 days ago completed task
  const twoDaysAgoNoon = new Date(Date.UTC(y, m - 1, d - 2, 6));

  await Task.create([
    {
      title: "Hôm kia",
      createdBy: a,
      creatorName: "Minh",
      status: "DONE",
      completedAt: twoDaysAgoNoon,
    },
    {
      title: "Hôm qua",
      createdBy: a,
      creatorName: "Minh",
      status: "DONE",
      completedAt: yestNoon,
    },
  ]);

  // Today has NO completed task yet. Streak should be 2 (yesterday + day before) without breaking!
  const statsNoToday = await taskStatsService.get(a, {
    range: "30d",
    scope: "personal",
  });
  expect(statsNoToday.streak.current).toBe(2);
  expect(statsNoToday.streak.best).toBe(2);

  // Now user completes a task TODAY
  const todayNoon = new Date(Date.UTC(y, m - 1, d, 6));
  await Task.create({
    title: "Hôm nay",
    createdBy: a,
    creatorName: "Minh",
    status: "DONE",
    completedAt: todayNoon,
  });

  const statsWithToday = await taskStatsService.get(a, {
    range: "30d",
    scope: "personal",
  });
  expect(statsWithToday.streak.current).toBe(3);
  expect(statsWithToday.streak.best).toBe(3);
});

it("onTimeRate handles timed deadlines and date-only deadlines with precision", async () => {
  const user = (await User.findById(a))!;
  const today = todayInZone(new Date(), user.timezone);
  const [y, m, d] = today.split("-").map(Number);

  // Task 1: Timed deadline at 14:00 today. Completed at 13:50 -> ON TIME
  const t1DueTime = "14:00";
  const t1Completed = new Date(
    zonedDate(y, m, d, user.timezone, 13).getTime() + 50 * 60000,
  );

  // Task 2: Timed deadline at 14:00 today. Completed at 14:15 -> LATE
  const t2Completed = new Date(
    zonedDate(y, m, d, user.timezone, 14).getTime() + 15 * 60000,
  );

  // Task 3: Date-only deadline today. Completed at 23:50 today -> ON TIME
  const t3Completed = new Date(
    zonedDate(y, m, d, user.timezone, 23).getTime() + 50 * 60000,
  );

  // Task 4: Date-only deadline yesterday. Completed today at 08:00 -> LATE
  const yesterdayStr = new Date(Date.UTC(y, m - 1, d - 1, 12))
    .toISOString()
    .slice(0, 10);
  const t4Completed = new Date(zonedDate(y, m, d, user.timezone, 8).getTime());

  await Task.create([
    {
      title: "Timed On Time",
      createdBy: a,
      creatorName: "Minh",
      status: "DONE",
      deadline: today,
      deadlineHasTime: true,
      deadlineTime: t1DueTime,
      completedAt: t1Completed,
    },
    {
      title: "Timed Late",
      createdBy: a,
      creatorName: "Minh",
      status: "DONE",
      deadline: today,
      deadlineHasTime: true,
      deadlineTime: t1DueTime,
      completedAt: t2Completed,
    },
    {
      title: "Date-only On Time",
      createdBy: a,
      creatorName: "Minh",
      status: "DONE",
      deadline: today,
      deadlineHasTime: false,
      completedAt: t3Completed,
    },
    {
      title: "Date-only Late",
      createdBy: a,
      creatorName: "Minh",
      status: "DONE",
      deadline: yesterdayStr,
      deadlineHasTime: false,
      completedAt: t4Completed,
    },
  ]);

  const stats = await taskStatsService.get(a, {
    range: "7d",
    scope: "personal",
  });
  // 2 out of 4 are on-time -> onTimeRate = 0.5
  expect(stats.onTimeRate).toBe(0.5);
});

it("enforces strict privacy and scope permissions: user A never sees user B's personal tasks or other couples", async () => {
  const now = new Date();

  // A's personal task
  await Task.create({
    title: "A's Personal",
    createdBy: a,
    creatorName: "Minh",
    status: "DONE",
    completedAt: now,
  });

  // B's personal task
  await Task.create({
    title: "B's Personal",
    createdBy: b,
    creatorName: "Lan",
    status: "DONE",
    completedAt: now,
  });

  // Shared task of couple A & B
  await Task.create({
    title: "Shared Couple",
    coupleId: cid,
    createdBy: a,
    completedBy: b,
    creatorName: "Minh",
    status: "DONE",
    completedAt: now,
  });

  // Foreign user C's task
  await Task.create({
    title: "C's Task",
    createdBy: c,
    creatorName: "Khác",
    status: "DONE",
    completedAt: now,
  });

  // 1. A queries personal: only sees A's personal (1 task)
  const aPersonal = await taskStatsService.get(a, {
    range: "7d",
    scope: "personal",
  });
  expect(aPersonal.completed.today).toBe(1);
  expect(aPersonal.couple).toBeNull();

  // 2. A queries shared: sees only shared couple task completed by B (1 task)
  const aShared = await taskStatsService.get(a, {
    range: "7d",
    scope: "shared",
  });
  expect(aShared.completed.today).toBe(1);
  expect(aShared.couple?.total).toBe(1);
  const lanMember = aShared.couple?.members.find((m) => m.userId === b);
  expect(lanMember?.completed).toBe(1);

  // 3. A queries all: sees A's personal (1) + Shared (1) = 2 tasks. Never B's personal or C's.
  const aAll = await taskStatsService.get(a, { range: "7d", scope: "all" });
  expect(aAll.completed.today).toBe(2);

  // 4. C queries: sees only C's task (1)
  const cStats = await taskStatsService.get(c, { range: "7d", scope: "all" });
  expect(cStats.completed.today).toBe(1);
  expect(cStats.couple).toBeNull();
});

it("archived couple allows read-only viewing of shared stats", async () => {
  const now = new Date();
  await Task.create({
    title: "Shared Before Leave",
    coupleId: cid,
    createdBy: a,
    completedBy: a,
    creatorName: "Minh",
    status: "DONE",
    completedAt: now,
  });

  // Archive couple by partner B leaving
  await coupleService.leave(b, { confirm: true });

  // A queries shared stats: returns 200 with shared data
  const res = await request(app)
    .get("/api/tasks/stats?range=7d&scope=shared")
    .set("Authorization", "Bearer " + tokenA)
    .expect(200);

  expect(res.body.completed.today).toBe(1);
  expect(res.body.couple.total).toBe(1);
});

it("lateHabits accurately ranks top 5 overdue labels and lists", async () => {
  const user = (await User.findById(a))!;
  const today = todayInZone(new Date(), user.timezone);
  const [y, m, d] = today.split("-").map(Number);
  const pastDay = new Date(Date.UTC(y, m - 1, d - 5, 12))
    .toISOString()
    .slice(0, 10);

  const marketList = await TaskList.create({
    name: "Đi chợ",
    ownerId: a,
    position: "1",
  });

  // 3 late tasks with label #rau in marketList
  for (let i = 0; i < 3; i++) {
    await Task.create({
      title: `Rau ${i}`,
      createdBy: a,
      creatorName: "Minh",
      status: "TODO",
      deadline: pastDay,
      labels: ["rau", "chợ"],
      listId: marketList._id,
    });
  }

  // 1 on-time task with label #rau
  await Task.create({
    title: "Rau tươi",
    createdBy: a,
    creatorName: "Minh",
    status: "DONE",
    deadline: today,
    completedAt: new Date(),
    labels: ["rau"],
    listId: marketList._id,
  });

  const stats = await taskStatsService.get(a, {
    range: "30d",
    scope: "personal",
  });

  expect(stats.lateHabits.length).toBeGreaterThan(0);
  const rauHabit = stats.lateHabits.find(
    (h) => h.name === "rau" && h.type === "label",
  );
  expect(rauHabit).toBeDefined();
  expect(rauHabit?.lateCount).toBe(3);
  expect(rauHabit?.rate).toBe(0.75); // 3 late out of 4 total

  const listHabit = stats.lateHabits.find(
    (h) => h.name === "Đi chợ" && h.type === "list",
  );
  expect(listHabit).toBeDefined();
  expect(listHabit?.lateCount).toBe(3);
});
