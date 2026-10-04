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
import { coupleModels } from "../../couples/models";
import { coupleService } from "../../couples/service";
import { fitnessModels, Exercise, WorkoutSession, WorkoutSet } from "../models";
import { seedExercises } from "../seed";
import { fitnessService as s } from "../service";
let db: MongoMemoryReplSet,
  a: string,
  b: string,
  ex: string,
  squat: string,
  token: string;
jest.setTimeout(30000);
const models = [User, RefreshToken, ...coupleModels, ...fitnessModels];
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
    ["Minh", "Lan"].map((name, i) => ({
      name,
      email: `${i}@fitness.local`,
      passwordHash: "unused",
      timezone: "Asia/Ho_Chi_Minh",
    })),
  );
  [a, b] = us.map((u) => u.id as string);
  await coupleService.create(a, { name: "Riêng tư" });
  const invite = await coupleService.invite(a);
  await coupleService.accept(b, { code: invite.code });
  await seedExercises();
  ex = (await Exercise.findOne({ name: "Bench Press" }))!.id as string;
  squat = (await Exercise.findOne({ name: "Squat" }))!.id as string;
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
const day = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const shift = (n: number) =>
  new Date(Date.parse(day + "T00:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
const monday = -(new Date(day + "T00:00:00Z").getUTCDay() + 6) % 7;
const create = (extra: Record<string, unknown> = {}, actor = a) =>
  s.createSession(actor, { date: day, durationMinutes: 45, ...extra });
const set = (
  sessionId: string,
  extra: Record<string, unknown> = {},
  actor = a,
) =>
  s.createSet(actor, {
    sessionId,
    exerciseId: ex,
    weight: 100,
    reps: 5,
    ...extra,
  });
it("seed idempotent, exercise search and own CRUD keep system protected", async () => {
  await seedExercises();
  expect((await s.exercises(a, {})).items).toHaveLength(11);
  expect(
    (await s.exercises(a, { search: "bench", muscleGroup: "Ngực" })).items,
  ).toHaveLength(1);
  const e = await s.createExercise(a, { name: " Đi bộ ", muscleGroup: "Chân" });
  expect(e.name).toBe("Đi bộ");
  expect(
    (await s.exercises(b, {})).items.find((x) => x.id === e.id),
  ).toBeUndefined();
  expect((await s.updateExercise(a, e.id, { name: "Đi bộ nhanh" })).name).toBe(
    "Đi bộ nhanh",
  );
  for (const key of [e.id, ex])
    await expect(
      s.updateExercise(b, key, { name: "Sai" }),
    ).rejects.toMatchObject({ status: 404 });
  await expect(s.deleteExercise(a, ex)).rejects.toMatchObject({ status: 404 });
  await s.deleteExercise(a, e.id);
  await expect(s.deleteExercise(a, e.id)).rejects.toMatchObject({
    status: 404,
  });
});
it("used custom exercise cannot be removed; foreign exercise cannot create sets/templates", async () => {
  const e = await s.createExercise(a, { name: "Riêng", muscleGroup: "Tay" }),
    w = await create();
  await set(w.id, { exerciseId: e.id });
  await expect(s.deleteExercise(a, e.id)).rejects.toMatchObject({
    code: "EXERCISE_USED",
  });
  const wb = await create({}, b);
  await expect(set(wb.id, { exerciseId: e.id }, b)).rejects.toMatchObject({
    status: 404,
  });
  await expect(
    s.createTemplate(b, {
      name: "Sai",
      items: [{ exerciseId: e.id, weight: 1, reps: 2 }],
    }),
  ).rejects.toMatchObject({ status: 404 });
  const e2 = await s.createExercise(a, { name: "Mẫu", muscleGroup: "Tay" });
  await s.createTemplate(a, {
    name: "A",
    items: [{ exerciseId: e2.id, weight: 1, reps: 2 }],
  });
  await expect(s.deleteExercise(a, e2.id)).rejects.toMatchObject({
    code: "EXERCISE_USED",
  });
});
it("session CRUD has revision protection, pagination and date bounds", async () => {
  const w = await create({ notes: "Mới", mood: 4, bodyWeight: 65 });
  expect((await s.getSession(a, w.id)).notes).toBe("Mới");
  const edited = await s.updateSession(a, w.id, {
    revision: 0,
    notes: "Đổi",
    durationMinutes: 30,
  });
  expect(edited.revision).toBe(1);
  await expect(
    s.updateSession(a, w.id, { revision: 0, notes: "Cũ" }),
  ).rejects.toMatchObject({ code: "FITNESS_CHANGED" });
  await expect(s.deleteSession(a, w.id, { revision: 0 })).rejects.toMatchObject(
    { status: 409 },
  );
  await create({ date: shift(-3) });
  expect((await s.sessions(a, { from: day, to: day, limit: 1 })).total).toBe(1);
  expect((await s.sessions(a, { page: 2, limit: 1 })).items).toHaveLength(1);
  await s.deleteSession(a, w.id, { revision: 1 });
  await expect(s.getSession(a, w.id)).rejects.toMatchObject({ status: 404 });
});
it("couple membership never grants fitness read/write access", async () => {
  const w = await create(),
    r = await set(w.id);
  for (const operation of [
    () => s.getSession(b, w.id),
    () => s.updateSession(b, w.id, { revision: 0, notes: "Sai" }),
    () => s.deleteSession(b, w.id, { revision: 0 }),
    () => set(w.id, {}, b),
    () => s.updateSet(b, r.id, { revision: 0, done: false }),
    () => s.deleteSet(b, r.id, { revision: 0 }),
  ])
    await expect(operation()).rejects.toMatchObject({ status: 404 });
  expect((await s.sessions(b, {})).total).toBe(0);
  expect((await s.analysis(b, {})).volume).toEqual([]);
  expect((await s.last(b, ex)).sets).toEqual([]);
});
it("paired start/end derive duration across midnight, reject invalid pairs and zero rounded duration", async () => {
  const w = await create({
    startTime: "2026-10-03T23:30:00+07:00",
    endTime: "2026-10-04T00:15:00+07:00",
    durationMinutes: 99,
  });
  expect(w.durationMinutes).toBe(45);
  expect(
    (
      await s.updateSession(a, w.id, {
        revision: 0,
        startTime: null,
        endTime: null,
        durationMinutes: 20,
      })
    ).durationMinutes,
  ).toBe(20);
  for (const extra of [
    { startTime: "2026-10-03T00:00:00Z" },
    { startTime: "2026-10-03T00:00:00Z", endTime: "2026-10-02T23:00:00Z" },
    { startTime: "2026-10-03T00:00:00Z", endTime: "2026-10-05T00:00:00Z" },
    { startTime: "2026-10-03T00:00:00Z", endTime: "2026-10-03T00:00:00.001Z" },
  ])
    await expect(create(extra)).rejects.toMatchObject({ status: 400 });
});
it("concurrent sets allocate distinct per-exercise sequence, explicit collision returns conflict", async () => {
  const w = await create();
  const rows = await Promise.all([set(w.id), set(w.id), set(w.id)]);
  expect(rows.map((r) => r.setNumber).sort()).toEqual([1, 2, 3]);
  expect(
    (await set(w.id, { exerciseId: squat, weight: 0, reps: 15 })).setNumber,
  ).toBe(1);
  await expect(set(w.id, { setNumber: 2 })).rejects.toMatchObject({
    code: "SET_NUMBER",
  });
  await set(w.id, { setNumber: 10000 });
  await expect(set(w.id)).rejects.toMatchObject({ code: "SET_LIMIT" });
});
it("set edits/deletes reject stale revision and duplicate number; done toggles recompute volume", async () => {
  const w = await create(),
    r = await set(w.id),
    r2 = await set(w.id);
  await expect(
    s.updateSet(a, r2.id, { revision: 0, setNumber: 1 }),
  ).rejects.toMatchObject({ code: "SET_NUMBER" });
  const updated = await s.updateSet(a, r.id, {
    revision: 0,
    done: false,
    rpe: 8.5,
  });
  expect(updated.volume).toBe(0);
  expect((await s.getSession(a, w.id)).volume).toBe(500);
  await expect(
    s.updateSet(a, r.id, { revision: 0, reps: 10 }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(s.deleteSet(a, r.id, { revision: 0 })).rejects.toMatchObject({
    status: 409,
  });
  await s.deleteSet(a, r.id, { revision: 1 });
  await expect(s.deleteSet(a, r.id, { revision: 2 })).rejects.toMatchObject({
    status: 404,
  });
});
it("session delete cascades sets atomically and deleted parents cannot acquire children", async () => {
  const w = await create();
  await set(w.id);
  const spy = jest
    .spyOn(WorkoutSet, "updateMany")
    .mockRejectedValueOnce(new Error("rollback"));
  await expect(s.deleteSession(a, w.id, { revision: 0 })).rejects.toThrow(
    "rollback",
  );
  spy.mockRestore();
  expect((await s.getSession(a, w.id)).sets).toHaveLength(1);
  await s.deleteSession(a, w.id, { revision: 0 });
  expect(
    await WorkoutSet.countDocuments({ sessionId: w.id, deletedAt: null }),
  ).toBe(0);
  await expect(set(w.id)).rejects.toMatchObject({ status: 404 });
  expect((await s.analysis(a, {})).prs).toEqual([]);
});
it("templates CRUD remains private and start copies fresh unfinished sets with independent numbering", async () => {
  const t = await s.createTemplate(a, {
    name: "Push",
    items: [
      { exerciseId: ex, weight: 20, reps: 10, setType: "warmup" },
      { exerciseId: squat, weight: 50, reps: 8 },
      { exerciseId: ex, weight: 60, reps: 8, rpe: 8 },
    ],
  });
  expect((await s.templates(b)).items).toEqual([]);
  await expect(
    s.startTemplate(b, t.id, { date: day, durationMinutes: 40 }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    s.updateTemplate(b, t.id, { ...t, revision: 0 }),
  ).rejects.toThrow();
  const w = await s.startTemplate(a, t.id, { date: day, durationMinutes: 40 });
  expect(w.sets.map((r) => r.done)).toEqual([false, false, false]);
  expect(w.sets.map((r) => r.setNumber)).toEqual([1, 1, 2]);
  expect(w.volume).toBe(0);
  const changed = await s.updateTemplate(a, t.id, {
    name: "Pull",
    items: [{ exerciseId: ex, weight: 30, reps: 5 }],
    revision: 0,
  });
  expect(changed.revision).toBe(1);
  await expect(
    s.updateTemplate(a, t.id, { name: "Old", items: t.items, revision: 0 }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    s.deleteTemplate(b, t.id, { revision: 1 }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    s.deleteTemplate(a, t.id, { revision: 0 }),
  ).rejects.toMatchObject({ status: 409 });
  await s.deleteTemplate(a, t.id, { revision: 1 });
  expect((await s.getSession(a, w.id)).sets).toHaveLength(3);
});
it("template start rolls back the entire session when any exercise disappears", async () => {
  const e = await s.createExercise(a, { name: "Riêng", muscleGroup: "Tay" });
  const t = await s.createTemplate(a, {
    name: "A",
    items: [
      { exerciseId: ex, weight: 10, reps: 10 },
      { exerciseId: e.id, weight: 10, reps: 10 },
    ],
  });
  await Exercise.updateOne({ _id: e.id }, { $set: { deletedAt: new Date() } });
  await expect(
    s.startTemplate(a, t.id, { date: day, durationMinutes: 40 }),
  ).rejects.toMatchObject({ status: 404 });
  expect(await WorkoutSession.countDocuments({ userId: a })).toBe(0);
  expect(await WorkoutSet.countDocuments({ userId: a })).toBe(0);
});
it("body metrics CRUD is unique per own day and stale edits cannot overwrite measurements", async () => {
  const body = await s.createBody(a, { date: day, weight: 65, waist: 75 });
  expect((await s.bodies(b, {})).total).toBe(0);
  await s.createBody(b, { date: day, weight: 70 });
  await expect(
    s.createBody(a, { date: day, weight: 66 }),
  ).rejects.toMatchObject({ code: "BODY_DATE" });
  await expect(
    s.updateBody(b, body.id, { date: day, weight: 60, revision: 0 }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(s.deleteBody(b, body.id, { revision: 0 })).rejects.toMatchObject(
    { status: 404 },
  );
  const changed = await s.updateBody(a, body.id, {
    date: day,
    weight: 64,
    revision: 0,
  });
  expect(changed.waist).toBeNull();
  await expect(
    s.updateBody(a, body.id, { date: day, weight: 63, revision: 0 }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(s.deleteBody(a, body.id, { revision: 0 })).rejects.toMatchObject(
    { status: 409 },
  );
  await s.createBody(a, { date: shift(-1), waist: 74 });
  await expect(
    s.updateBody(a, body.id, { date: shift(-1), weight: 64, revision: 1 }),
  ).rejects.toMatchObject({ code: "BODY_DATE" });
  expect((await s.bodies(a, { from: day, to: day })).total).toBe(1);
  await s.deleteBody(a, body.id, { revision: 1 });
  await s.createBody(a, { date: day, weight: 62 });
  expect((await s.bodies(a, { limit: 1, page: 2 })).items).toHaveLength(1);
});
it("simultaneous body records create exactly one and weekly targets are private", async () => {
  const results = await Promise.allSettled([
    s.createBody(a, { date: day, weight: 65 }),
    s.createBody(a, { date: day, weight: 66 }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(await s.goal(a)).toEqual({ sessionsPerWeek: 4 });
  await s.updateGoal(a, { sessionsPerWeek: 6 });
  expect(await s.goal(a)).toEqual({ sessionsPerWeek: 6 });
  expect(await s.goal(b)).toEqual({ sessionsPerWeek: 4 });
});
it("analytics counts completed sets, includes warmup volume, and keeps rep bucket boundaries exact", async () => {
  const w = await create({ durationMinutes: 60 });
  await set(w.id);
  await set(w.id, { weight: 80, reps: 10 });
  await set(w.id, { weight: 40, reps: 15 });
  await set(w.id, { weight: 200, reps: 20, done: false });
  const report = await s.analysis(a, { from: day, to: day });
  expect(report.volume[0].volume).toBe(1900);
  expect(report.stats.averageReps).toBe(10);
  expect(report.repDistribution.map((x) => [x.count, x.percent])).toEqual([
    [1, 33.33],
    [1, 33.33],
    [1, 33.33],
  ]);
  expect(report.stats).toMatchObject({
    rangeSessions: 1,
    totalMinutes: 60,
    averageMinutes: 60,
    lastVolume: 1900,
    frequencyPerWeek: 7,
  });
  await set(w.id, { weight: 20, reps: 12, setType: "warmup" });
  const r = await s.analysis(a, {});
  expect(r.volume[0].volume).toBe(2140);
  expect(r.repDistribution.map((x) => x.count)).toEqual([1, 2, 1]);
  expect(r.bests[0].weight).toBe(100);
  expect(r.bests[0].volume).toBe(1900);
});
it("progress and PR are per exercise, exclude warmups, retain earlier baseline before range and recompute after deletion", async () => {
  const old = await create({ date: shift(-15) });
  await set(old.id, { weight: 80, reps: 5 });
  const w = await create();
  const best = await set(w.id);
  await set(w.id, { weight: 250, reps: 5, setType: "warmup" });
  await set(w.id, { weight: 300, reps: 5, exerciseId: squat });
  const r = await s.analysis(a, { range: "7d", exerciseId: ex });
  expect(r.prs).toHaveLength(1);
  expect(r.prs[0]).toMatchObject({
    baseline: false,
    weight: 100,
    volume: 500,
    oneRM: 116.67,
    flags: { weight: true, volume: true, oneRM: true },
  });
  expect(r.progress[0]).toMatchObject({ maxWeight: 100, oneRM: 116.67 });
  expect(r.bests).toHaveLength(1);
  expect(r.volume[0].volume).toBe(1750);
  await s.deleteSet(a, best.id, { revision: 0 });
  const after = await s.analysis(a, { range: "7d", exerciseId: ex });
  expect(after.prs).toEqual([]);
  expect(after.bests[0].weight).toBe(80);
  expect(after.progress[0].maxWeight).toBeNull();
});
it("week/month statistics, comparison and goal use local calendar and exclude future planned sessions", async () => {
  const prev = await create({ date: shift(monday - 2), durationMinutes: 20 });
  await set(prev.id, { weight: 50, reps: 10 });
  const current = await create({ date: shift(monday), durationMinutes: 40 });
  await set(current.id, { weight: 100, reps: 5 });
  await set(current.id, { weight: 60, reps: 10 });
  await create({ date: shift(1), durationMinutes: 90 });
  await s.updateGoal(a, { sessionsPerWeek: 2 });
  const r = await s.analysis(a, { range: "30d" });
  expect(r.comparison).toEqual({
    current: { sessions: 1, volume: 1100, averageReps: 7.5 },
    previous: { sessions: 1, volume: 500, averageReps: 10 },
    delta: { sessions: 0, volume: 600, averageReps: -2.5 },
  });
  expect(r.weeklyGoal).toEqual({ target: 2, done: 1, progress: 50 });
  expect(r.stats.weekSessions).toBe(1);
  expect(r.latest!.id).toBe(current.id);
  expect(r.stats.rangeSessions).toBe(2);
  expect(r.stats.averageMinutes).toBe(30);
});
it("empty and bodyweight-only analytics stay finite; measurements follow dates; latest autofill skips incomplete/future sessions", async () => {
  const empty = await s.analysis(a, {});
  expect(empty.stats.averageMinutes).toBe(0);
  expect(empty.repDistribution.every((r) => r.percent === 0)).toBe(true);
  expect(empty.latest).toBeNull();
  const w = await create({ date: shift(-1) });
  await set(w.id, { weight: 0, reps: 12 });
  const newer = await create();
  await set(newer.id, { done: false });
  const future = await create({ date: shift(1) });
  await set(future.id, { weight: 900 });
  expect((await s.last(a, ex)).sessionId).toBe(w.id);
  expect((await s.last(a, squat)).sets).toEqual([]);
  await s.createBody(a, { date: day, weight: 65 });
  await s.createBody(a, { date: shift(-10), waist: 75 });
  const r = await s.analysis(a, { range: "7d" });
  expect(r.body).toHaveLength(1);
  expect(r.stats.averageReps).toBe(12);
  expect(r.continueFrom!.id).toBe(w.id);
  expect(r.stats.lastVolume).toBe(0);
  expect(r.prs).toEqual([]);
});
it("decimal kg volume is rounded consistently and equal maxima do not invent PR", async () => {
  const a1 = await create({ date: shift(-1) });
  await set(a1.id, { weight: 0.1, reps: 3 });
  const a2 = await create();
  await set(a2.id, { weight: 0.1, reps: 3 });
  expect((await s.getSession(a, a2.id)).volume).toBe(0.3);
  const r = await s.analysis(a, {});
  expect(r.prs).toHaveLength(1);
  expect(r.prs[0].baseline).toBe(true);
  expect(r.bests[0].oneRM).toBe(0.11);
});
it("auth and strict HTTP validation cover each resource group", async () => {
  const app = createApp();
  for (const path of [
    "/exercises",
    "/workout-sessions",
    "/workout-templates",
    "/body-metrics",
    "/fitness/stats",
  ])
    expect((await request(app).get("/api" + path)).status).toBe(401);
  for (const [path, payload] of [
    ["/workout-sessions", { date: "2026-02-30", durationMinutes: 40 }],
    ["/workout-sets", { sessionId: ex, exerciseId: ex, weight: -1, reps: 0 }],
    ["/body-metrics", { date: day }],
    ["/workout-templates", { name: "A", items: [] }],
    ["/exercises", { name: "A", muscleGroup: "Sai" }],
  ])
    expect(
      (
        await request(app)
          .post("/api" + path)
          .set("Authorization", "Bearer " + token)
          .send(payload)
      ).status,
    ).toBe(400);
  expect(
    (
      await request(app)
        .put("/api/fitness/goal")
        .set("Authorization", "Bearer " + token)
        .send({ sessionsPerWeek: 0 })
    ).status,
  ).toBe(400);
  for (const path of [
    "/workout-sessions/not-id",
    "/fitness/progress/not-id",
    "/fitness/stats?range=1d",
    "/fitness/volume?from=2026-10-05&to=2026-10-04",
  ])
    expect(
      (
        await request(app)
          .get("/api" + path)
          .set("Authorization", "Bearer " + token)
      ).status,
    ).toBe(400);
});
it("HTTP CRUD endpoints and dedicated charts return actual persisted data", async () => {
  const app = createApp();
  const post = (p: string, v: object) =>
    request(app)
      .post("/api" + p)
      .set("Authorization", "Bearer " + token)
      .send(v);
  const get = (p: string) =>
    request(app)
      .get("/api" + p)
      .set("Authorization", "Bearer " + token);
  const put = (p: string, v: object) =>
    request(app)
      .put("/api" + p)
      .set("Authorization", "Bearer " + token)
      .send(v);
  const del = (p: string, v: object) =>
    request(app)
      .delete("/api" + p)
      .set("Authorization", "Bearer " + token)
      .send(v);
  const e = await post("/exercises", { name: "Custom", muscleGroup: "Tay" });
  expect(e.status).toBe(201);
  expect(
    (await put("/exercises/" + e.body.id, { name: "Custom 2" })).status,
  ).toBe(200);
  expect((await del("/exercises/" + e.body.id, {})).status).toBe(204);
  const w = await post("/workout-sessions", { date: day, durationMinutes: 45 });
  expect(w.status).toBe(201);
  const r = await post("/workout-sets", {
    sessionId: w.body.id,
    exerciseId: ex,
    weight: 100,
    reps: 5,
    rpe: 8.5,
  });
  expect(r.status).toBe(201);
  expect((await get("/fitness/progress/" + ex)).body.items[0].oneRM).toBe(
    116.67,
  );
  expect((await get("/fitness/volume")).body.items[0].volume).toBe(500);
  expect((await get("/fitness/rep-distribution")).body.items[0].count).toBe(1);
  expect((await get("/fitness/prs")).body.items).toHaveLength(1);
  expect((await get("/fitness/last/" + ex)).body.sets).toHaveLength(1);
  expect(
    (await put("/workout-sets/" + r.body.id, { revision: 0, done: false }))
      .status,
  ).toBe(200);
  expect(
    (await del("/workout-sets/" + r.body.id, { revision: 1 })).status,
  ).toBe(204);
  expect(
    (await put("/workout-sessions/" + w.body.id, { revision: 0, notes: "A" }))
      .status,
  ).toBe(200);
  expect((await get("/workout-sessions/" + w.body.id)).body.notes).toBe("A");
  expect(
    (await del("/workout-sessions/" + w.body.id, { revision: 1 })).status,
  ).toBe(204);
  const t = await post("/workout-templates", {
    name: "Push",
    items: [{ exerciseId: ex, weight: 60, reps: 10 }],
  });
  expect((await get("/workout-templates")).body.items).toHaveLength(1);
  expect(
    (
      await put("/workout-templates/" + t.body.id, {
        revision: 0,
        name: "Pull",
        items: t.body.items,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await post("/workout-templates/" + t.body.id + "/start", {
        date: day,
        durationMinutes: 30,
      })
    ).body.sets[0].done,
  ).toBe(false);
  expect(
    (await del("/workout-templates/" + t.body.id, { revision: 1 })).status,
  ).toBe(204);
  const body = await post("/body-metrics", { date: day, weight: 65 });
  expect(
    (
      await put("/body-metrics/" + body.body.id, {
        revision: 0,
        date: day,
        waist: 75,
      })
    ).status,
  ).toBe(200);
  expect((await get("/body-metrics")).body.items[0].weight).toBeNull();
  expect(
    (await del("/body-metrics/" + body.body.id, { revision: 1 })).status,
  ).toBe(204);
  expect((await get("/fitness/goal")).body.sessionsPerWeek).toBe(4);
  expect(
    (await put("/fitness/goal", { sessionsPerWeek: 3 })).body.sessionsPerWeek,
  ).toBe(3);
});
it("invalid inputs do not create data or accept user/couple ownership from payload", async () => {
  for (const extra of [
    { durationMinutes: 0 },
    { bodyWeight: 0 },
    { mood: 6 },
    { userId: b },
    { coupleId: ex },
    { date: "x" },
  ])
    await expect(create(extra)).rejects.toThrow();
  const w = await create();
  for (const extra of [
    { weight: -1 },
    { reps: 0 },
    { reps: 1.2 },
    { rpe: 7.3 },
    { done: "true" },
    { userId: b },
  ])
    await expect(set(w.id, extra)).rejects.toThrow();
  await expect(s.analysis(a, { from: shift(1) })).rejects.toMatchObject({
    code: "DATE_RANGE",
  });
  await expect(
    s.createExercise("000000000000000000000000", {
      name: "A",
      muscleGroup: "Tay",
    }),
  ).rejects.toMatchObject({ status: 404 });
});
