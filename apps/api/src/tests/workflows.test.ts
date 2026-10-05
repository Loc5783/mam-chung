process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1/test?replicaSet=rs0";
process.env.JWT_SECRET =
  "workflow-test-secret-longer-than-thirty-two-characters";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { createApp } from "../app";
import { seedCategories } from "../seeds/categories";
import { seedExercises } from "../modules/fitness/seed";
let db: MongoMemoryReplSet,
  app: ReturnType<typeof createApp>,
  sequence = 0;
let a: { accessToken: string; user: { id: string } },
  b: typeof a,
  outsider: typeof a;
let cookie: string, food: string, exercise: string;
const password = "Workflow2026!";
const day = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
function call(
  actor: typeof a,
  method: "get" | "post" | "put" | "delete" | "patch",
  path: string,
  body?: Record<string, unknown>,
  status = 200,
) {
  const req = request(app)
    [method]("/api" + path)
    .auth(actor.accessToken, { type: "bearer" });
  return (body === undefined ? req : req.send(body)).expect(status);
}
async function pair() {
  await call(
    a,
    "post",
    "/couples",
    { name: "Workflow pair", anniversary: day },
    201,
  );
  const invite = (await call(a, "post", "/couples/invite", {}, 201)).body;
  await call(b, "get", "/couples/invite/" + invite.code);
  await call(b, "post", "/couples/accept", { code: invite.code });
}
jest.setTimeout(45000);
beforeAll(async () => {
  db = await MongoMemoryReplSet.create({
    binary: { version: "7.0.14" },
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(db.getUri());
  await Promise.all(
    mongoose.modelNames().map((name) => mongoose.model(name).init()),
  );
  await seedCategories();
  await seedExercises();
}, 180000);
beforeEach(async () => {
  app = createApp();
  sequence++;
  const sessions = [];
  for (const label of ["a", "b", "outsider"]) {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "User " + label,
        email: `workflow-${sequence}-${label}@example.test`,
        password,
      })
      .expect(201);
    sessions.push(res.body);
    if (label === "a")
      cookie = (res.headers["set-cookie"] as unknown as string[])[0].split(
        ";",
      )[0];
  }
  [a, b, outsider] = sessions;
  food = (
    await call(a, "get", "/categories?type=expense&limit=100")
  ).body.items.find((x: { name: string }) => x.name === "Ăn uống").id;
  exercise = (await call(a, "get", "/exercises")).body.items.find(
    (x: { name: string }) => x.name === "Bench Press",
  ).id;
});
afterAll(async () => {
  await mongoose.disconnect();
  await db?.stop();
});
it("register → refresh rotation → logout invalidates session and refuses foreign Origin", async () => {
  await request(app)
    .put("/api/users/me")
    .auth(a.accessToken, { type: "bearer" })
    .set("Origin", "https://foreign.test")
    .send({ name: "Injected" })
    .expect(403);
  const refreshed = await request(app)
    .post("/api/auth/refresh")
    .set("Cookie", cookie)
    .expect(200);
  expect(refreshed.body.user.id).toBe(a.user.id);
  expect(JSON.stringify(refreshed.body)).not.toMatch(
    /passwordHash|refreshToken/,
  );
  const token = refreshed.body.accessToken;
  await request(app)
    .post("/api/auth/logout")
    .auth(token, { type: "bearer" })
    .expect(204);
  await request(app)
    .get("/api/users/me")
    .auth(token, { type: "bearer" })
    .expect(401);
  await request(app)
    .post("/api/auth/refresh")
    .set("Cookie", cookie)
    .expect(401);
  await call(b, "get", "/users/me");
});
it("wallet → expense/update → transfer/rollback → budget/goal/CSV → undo", async () => {
  const w = (
    await call(
      a,
      "post",
      "/wallets",
      { name: "Cash", type: "cash", initialBalance: 1000 },
      201,
    )
  ).body;
  const target = (
    await call(a, "post", "/wallets", { name: "Bank", type: "bank" }, 201)
  ).body;
  const budget = (
    await call(
      a,
      "post",
      "/budgets",
      { categoryId: food, month: day.slice(0, 7), amount: 200 },
      201,
    )
  ).body;
  const tx = (
    await call(
      a,
      "post",
      "/transactions",
      {
        walletId: w.id,
        categoryId: food,
        type: "expense",
        amount: 250,
        date: day,
        description: "Workflow lunch",
      },
      201,
    )
  ).body;
  await call(a, "put", "/transactions/" + tx.id, { amount: 300 });
  await call(
    a,
    "post",
    "/wallets/transfer",
    { fromWalletId: w.id, toWalletId: target.id, amount: 200, date: day },
    201,
  );
  await call(
    a,
    "post",
    "/wallets/transfer",
    { fromWalletId: w.id, toWalletId: target.id, amount: 9999, date: day },
    422,
  );
  expect((await call(a, "get", "/wallets/" + w.id)).body.balance).toBe(500);
  expect((await call(a, "get", "/wallets/" + target.id)).body.balance).toBe(
    200,
  );
  const home = (await call(a, "get", "/dashboard")).body;
  expect(home.finance.totalBalance).toBe(700);
  expect(home.finance.expense).toBe(300);
  expect(
    home.budgets.items.find((x: { id: string }) => x.id === budget.id).spent,
  ).toBe(300);
  expect(
    (await call(a, "get", "/notifications")).body.items.some(
      (x: { type: string }) => x.type === "BUDGET_EXCEEDED",
    ),
  ).toBe(true);
  const csv = await call(
    a,
    "get",
    "/transactions/export?from=" + day + "&to=" + day,
  );
  expect(csv.headers["content-type"]).toMatch(/csv/);
  expect(csv.text).toContain("Workflow lunch");
  const goal = (
    await call(a, "post", "/goals", { name: "Trip", targetAmount: 1000 }, 201)
  ).body;
  await call(
    a,
    "post",
    "/goals/" + goal.id + "/contribute",
    { amount: 400, date: day },
    201,
  );
  const contribution = (
    await call(a, "get", "/goals/" + goal.id + "/contributions")
  ).body.items[0];
  await call(
    a,
    "delete",
    "/goals/" + goal.id + "/contributions/" + contribution.id,
    undefined,
    204,
  );
  await call(a, "delete", "/transactions/" + tx.id, undefined, 204);
  expect((await call(a, "get", "/wallets/" + w.id)).body.balance).toBe(800);
  expect(
    (await call(a, "get", "/wallets/" + w.id + "/reconcile", undefined, 404))
      .status,
  ).toBe(404);
  const reconcile = (
    await call(a, "post", "/wallets/" + w.id + "/reconcile", { repair: false })
  ).body;
  expect(reconcile.matched).toBe(true);
  await call(b, "get", "/wallets/" + w.id, undefined, 404);
});
it("invite → joint fund → odd equal split → debtor reports → creditor confirms → archive", async () => {
  await pair();
  const fund = (
    await call(a, "post", "/shared-wallets", { name: "Together" }, 201)
  ).body;
  await call(
    b,
    "post",
    "/shared-wallets/" + fund.id + "/contribute",
    { amount: 1000, date: day },
    201,
  );
  await call(
    a,
    "post",
    "/shared-transactions",
    {
      sharedWalletId: fund.id,
      payerId: a.user.id,
      amount: 101,
      date: day,
      description: "Advance",
      categoryId: food,
      splitType: "equal",
      paidFrom: "personal",
    },
    201,
  );
  const debts = (await call(b, "get", "/settlements")).body.items;
  expect(debts).toHaveLength(1);
  expect(debts[0].amount).toBe(50);
  await call(a, "put", "/settlements/" + debts[0].id + "/mark-paid", {}, 403);
  await call(b, "put", "/settlements/" + debts[0].id + "/mark-paid", {});
  expect(
    (await call(a, "get", "/notifications")).body.items.some(
      (x: { type: string }) => x.type === "PAYMENT_CONFIRM",
    ),
  ).toBe(true);
  await call(b, "put", "/settlements/" + debts[0].id + "/confirm", {}, 403);
  await call(a, "put", "/settlements/" + debts[0].id + "/confirm", {});
  const shared = (await call(a, "get", "/shared/dashboard")).body;
  expect(shared.totalBalance).toBe(1000);
  expect(shared.summary.amount).toBe(0);
  expect(shared.summary.outstandingCount).toBe(0);
  await call(
    outsider,
    "get",
    "/shared-wallets?coupleId=" +
      (await call(a, "get", "/couples/me")).body.couple.id,
    undefined,
    404,
  );
  await call(
    a,
    "delete",
    "/couples/leave",
    { confirm: true, dissolve: true },
    409,
  );
  await call(b, "delete", "/couples/leave", { confirm: true });
  expect((await call(b, "get", "/couples/me")).body.couple).toBeNull();
});
it("shared task assignment → comments → revision conflict → recurring successor once", async () => {
  await pair();
  const task = (
    await call(
      a,
      "post",
      "/tasks",
      {
        title: "Daily shared task",
        scope: "shared",
        assignedTo: b.user.id,
        deadline: day,
        recurrence: "daily",
        checklist: [{ text: "Pack bag" }],
      },
      201,
    )
  ).body;
  expect(
    (await call(b, "get", "/notifications")).body.items.some(
      (x: { type: string }) => x.type === "TASK_ASSIGNED",
    ),
  ).toBe(true);
  await call(
    b,
    "post",
    "/tasks/" + task.id + "/comments",
    { text: "I will do it" },
    201,
  );
  const updated = (
    await call(b, "put", "/tasks/" + task.id, {
      revision: task.revision,
      description: "Ready",
    })
  ).body;
  await call(
    a,
    "patch",
    "/tasks/" + task.id + "/status",
    { status: "DONE", revision: task.revision },
    409,
  );
  const done = (
    await call(b, "patch", "/tasks/" + task.id + "/status", {
      status: "DONE",
      revision: updated.revision,
    })
  ).body;
  await call(b, "patch", "/tasks/" + task.id + "/status", {
    status: "DONE",
    revision: done.revision,
  });
  const tasks = (await call(a, "get", "/tasks?scope=shared&search=Daily")).body
    .items;
  expect(tasks).toHaveLength(2);
  expect(
    tasks.filter((x: { status: string }) => x.status === "TODO"),
  ).toHaveLength(1);
  await call(outsider, "get", "/tasks/" + task.id, undefined, 404);
  const personal = (
    await call(
      a,
      "post",
      "/tasks",
      { title: "Private task", scope: "personal" },
      201,
    )
  ).body;
  await call(b, "get", "/tasks/" + personal.id, undefined, 404);
});
it("workout → completed sets → template pending sets → edit/delete recalculates private stats", async () => {
  await pair();
  const session = (
    await call(
      a,
      "post",
      "/workout-sessions",
      { date: day, durationMinutes: 45, notes: "Actual workout" },
      201,
    )
  ).body;
  const set = (
    await call(
      a,
      "post",
      "/workout-sets",
      {
        sessionId: session.id,
        exerciseId: exercise,
        weight: 50,
        reps: 8,
        done: true,
      },
      201,
    )
  ).body;
  const stats = (
    await call(a, "get", "/fitness/stats?from=" + day + "&to=" + day)
  ).body;
  expect(stats.stats.rangeSessions).toBe(1);
  expect(stats.volume[0].volume).toBe(400);
  const template = (
    await call(
      a,
      "post",
      "/workout-templates",
      {
        name: "Next workout",
        items: [{ exerciseId: exercise, weight: 50, reps: 8 }],
      },
      201,
    )
  ).body;
  const next = (
    await call(
      a,
      "post",
      "/workout-templates/" + template.id + "/start",
      { date: day, durationMinutes: 40 },
      201,
    )
  ).body;
  expect(next.sets.every((x: { done: boolean }) => !x.done)).toBe(true);
  expect(next.volume).toBe(0);
  await call(a, "put", "/workout-sets/" + set.id, {
    weight: 60,
    revision: set.revision,
  });
  expect(
    (await call(a, "get", "/workout-sessions/" + session.id)).body.volume,
  ).toBe(480);
  await call(b, "get", "/workout-sessions/" + session.id, undefined, 404);
  expect(
    (await call(b, "get", "/fitness/stats?from=" + day + "&to=" + day)).body
      .stats.rangeSessions,
  ).toBe(0);
  const current = (await call(a, "get", "/workout-sessions/" + session.id))
    .body;
  await call(
    a,
    "delete",
    "/workout-sessions/" + session.id,
    { revision: current.revision },
    204,
  );
  await call(a, "get", "/workout-sessions/" + session.id, undefined, 404);
  expect(
    (await call(a, "get", "/fitness/stats?from=" + day + "&to=" + day)).body
      .stats.rangeSessions,
  ).toBe(1);
});
