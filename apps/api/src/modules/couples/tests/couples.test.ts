import express from "express";
import { errorHandler } from "../../../middlewares/errorHandler";
process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1/test?replicaSet=rs0";
process.env.JWT_SECRET = "test-secret-longer-than-thirty-two-characters";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { createApp } from "../../../app";
import { env } from "../../../config/env";
import { User } from "../../users/model";
import { RefreshToken } from "../../auth/model";
import { userService } from "../../users/service";
import { userRepository } from "../../users/repository";
import {
  Couple,
  CoupleMember,
  CoupleInvite,
  CoupleActivity,
  coupleModels,
} from "../models";
import { coupleService as s, anniversaryInfo } from "../service";
import { requireCouple } from "../../../middlewares/requireCouple";
import { auth } from "../../../middlewares/auth";
let db: MongoMemoryReplSet,
  a: string,
  b: string,
  c: string,
  token: string,
  app: ReturnType<typeof createApp>;
const guarded = express();
guarded.get("/test-couple", auth, requireCouple, (req, res) =>
  res.json({ id: req.user!.coupleId }),
);
guarded.use(errorHandler);
jest.setTimeout(30000);
beforeAll(async () => {
  db = await MongoMemoryReplSet.create({
    binary: { version: "7.0.14" },
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(db.getUri());
  await Promise.all([
    User.init(),
    RefreshToken.init(),
    ...coupleModels.map((m) => m.init()),
  ]);
}, 180000);
beforeEach(async () => {
  await User.deleteMany({});
  await RefreshToken.deleteMany({});
  for (const m of coupleModels) await m.collection.deleteMany({});
  await mongoose.connection.collection("settlements").deleteMany({});
  const users = await User.create(
    ["Minh", "Lan", "Ngọc"].map((name, i) => ({
      name,
      email: `qa${i}@example.test`,
      passwordHash: "unused",
    })),
  );
  [a, b, c] = users.map((u) => u.id as string);
  await RefreshToken.create({
    userId: a,
    tokenHash: "a".repeat(64),
    family: "a",
    securityVersion: 0,
    expiresAt: new Date(Date.now() + 86400000),
  });
  token = jwt.sign({ version: 0, family: "a" }, env.JWT_SECRET, {
    subject: a,
    expiresIn: "15m",
    issuer: "mam-chung",
    audience: "mam-chung-web",
  });
  app = createApp();
  app.get("/test-couple", auth, requireCouple, (req, res) =>
    res.json({ id: req.user!.coupleId }),
  );
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await mongoose.disconnect();
  await db?.stop();
});
const create = () =>
  s.create(a, { name: "Minh & Lan", anniversary: "2020-02-29" });
async function pair() {
  const couple = await create();
  const invite = await s.invite(a);
  await s.accept(b, { code: invite.code });
  return couple;
}
const err = (code: string) => expect.objectContaining({ code });
describe("couple membership and invitations", () => {
  it("creates owner, active membership and private DTO", async () => {
    const out = await create();
    expect(out.role).toBe("owner");
    expect(out.members).toHaveLength(1);
    expect(out.members[0]).not.toHaveProperty("email");
    expect((await User.findById(a))!.coupleId?.toString()).toBe(out.id);
    expect(await CoupleActivity.countDocuments()).toBe(1);
    expect((await s.me(a)).couple?.id).toBe(out.id);
  });
  it("empty account has no invented couple", async () => {
    expect(await s.me(a)).toEqual({ couple: null });
    await expect(s.requireActive(a)).rejects.toMatchObject({ status: 404 });
  });
  it("validates names, future dates, leap dates and owner inputs", async () => {
    await expect(s.create(a, { name: " ", userId: b })).rejects.toThrow();
    await expect(
      s.create(a, { name: "X", anniversary: "2025-02-29" }),
    ).rejects.toThrow();
    await expect(
      s.create(a, { name: "X", anniversary: "2099-01-01" }),
    ).rejects.toMatchObject({ status: 400 });
    await create();
    await expect(create()).rejects.toMatchObject(err("COUPLE_ACTIVE"));
  });
  it("two concurrent creations yield just one active membership", async () => {
    const out = await Promise.allSettled([create(), create()]);
    expect(out.filter((v) => v.status === "fulfilled")).toHaveLength(1);
    expect(await Couple.countDocuments()).toBe(1);
    expect(await CoupleMember.countDocuments({ active: true })).toBe(1);
  });
  it("random code is hashed, lasts 48h, link and preview disclose no secrets", async () => {
    await create();
    const before = Date.now();
    const inv = await s.invite(a);
    expect(inv.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(inv.path).toBe(`/invite/${inv.code}`);
    expect(inv.expiresAt.getTime() - before).toBeGreaterThanOrEqual(
      48 * 3600000,
    );
    expect(
      (await CoupleInvite.findOne().select("+codeHash"))!.codeHash,
    ).not.toBe(inv.code);
    expect(await s.preview(b, inv.code.toLowerCase())).toMatchObject({
      name: "Minh & Lan",
      inviterName: "Minh",
      isSelf: false,
    });
    expect(await s.preview(a, inv.code)).toMatchObject({ isSelf: true });
    expect((await s.me(a)).couple?.invite).not.toHaveProperty("code");
  });
  it("rotation and revoke invalidate previous code", async () => {
    await create();
    const first = await s.invite(a),
      second = await s.invite(a);
    await expect(s.preview(b, first.code)).rejects.toMatchObject({
      status: 404,
    });
    await s.revokeInvite(a);
    await expect(s.accept(b, { code: second.code })).rejects.toMatchObject({
      status: 404,
    });
    expect(await CoupleInvite.countDocuments({ status: "active" })).toBe(0);
  });
  it("expired, unknown and malformed codes rejected", async () => {
    await create();
    const inv = await s.invite(a);
    await CoupleInvite.updateMany(
      {},
      { $set: { expiresAt: new Date(Date.now() - 1) } },
    );
    await expect(s.accept(b, { code: inv.code })).rejects.toMatchObject({
      status: 404,
    });
    await expect(s.preview(b, "ABCDEFGH")).rejects.toMatchObject({
      status: 404,
    });
    await expect(s.preview(b, "bad")).rejects.toThrow();
  });
  it("accept is atomic, one use and refuses a third member", async () => {
    const out = await pair();
    expect((await s.me(b)).couple?.members).toHaveLength(2);
    expect(
      await CoupleInvite.countDocuments({ status: "used", usedBy: b }),
    ).toBe(1);
    const used = await CoupleInvite.findOne();
    expect(used!.usedAt).toBeInstanceOf(Date);
    await expect(s.accept(c, { code: "ABCDEFGH" })).rejects.toMatchObject({
      status: 404,
    });
    await expect(s.invite(a)).rejects.toMatchObject(err("COUPLE_FULL"));
    expect(await s.requireActive(b)).toBe(out.id);
  });
  it("self acceptance and already paired accounts fail", async () => {
    await create();
    const inv = await s.invite(a);
    await expect(s.accept(a, { code: inv.code })).rejects.toMatchObject({
      status: 409,
    });
    await s.create(b, { name: "Lan" });
    await expect(s.accept(b, { code: inv.code })).rejects.toMatchObject(
      err("COUPLE_ACTIVE"),
    );
  });
  it("racing acceptances use code once and never exceed two people", async () => {
    await create();
    const inv = await s.invite(a);
    const out = await Promise.allSettled([
      s.accept(b, { code: inv.code }),
      s.accept(c, { code: inv.code }),
    ]);
    expect(out.filter((v) => v.status === "fulfilled")).toHaveLength(1);
    expect(await CoupleMember.countDocuments({ active: true })).toBe(2);
    expect(await CoupleInvite.countDocuments({ status: "used" })).toBe(1);
  });
  it("one account cannot concurrently join two couples", async () => {
    await create();
    await s.create(c, { name: "Other" });
    const i = await s.invite(a),
      j = await s.invite(c);
    const out = await Promise.allSettled([
      s.accept(b, { code: i.code }),
      s.accept(b, { code: j.code }),
    ]);
    expect(out.filter((v) => v.status === "fulfilled")).toHaveLength(1);
    expect(await CoupleMember.countDocuments({ userId: b, active: true })).toBe(
      1,
    );
  });
  it("database partial unique index enforces active membership", async () => {
    const out = await create();
    await expect(
      CoupleMember.create({
        coupleId: new mongoose.Types.ObjectId(),
        userId: a,
        role: "member",
        nameSnapshot: "Minh",
      }),
    ).rejects.toMatchObject({ code: 11000 });
    expect(out.members[0].active).toBe(true);
  });
  it("create rolls back membership and user pointer on feed failure", async () => {
    jest
      .spyOn(CoupleActivity, "create")
      .mockRejectedValueOnce(new Error("feed down"));
    await expect(create()).rejects.toThrow("feed down");
    expect(await Couple.countDocuments()).toBe(0);
    expect(await CoupleMember.countDocuments()).toBe(0);
    expect((await User.findById(a))!.coupleId).toBeNull();
  });
  it("accept rollback keeps invite reusable and ledger untouched", async () => {
    await create();
    const inv = await s.invite(a);
    jest
      .spyOn(CoupleActivity, "create")
      .mockRejectedValueOnce(new Error("feed down"));
    await expect(s.accept(b, { code: inv.code })).rejects.toThrow();
    expect((await User.findById(b))!.coupleId).toBeNull();
    expect(await CoupleMember.countDocuments()).toBe(1);
    expect(await CoupleInvite.countDocuments({ status: "active" })).toBe(1);
    await s.accept(b, { code: inv.code });
  });
  it("missing/deleted hosts and accounts cannot use invitations", async () => {
    await create();
    const inv = await s.invite(a);
    await User.updateOne({ _id: a }, { $set: { deletedAt: new Date() } });
    await expect(s.accept(b, { code: inv.code })).rejects.toMatchObject({
      status: 404,
    });
    await User.updateOne({ _id: b }, { $set: { deletedAt: new Date() } });
    await expect(s.me(b)).rejects.toMatchObject({ status: 404 });
  });
});
describe("ownership, anniversary, feed and archives", () => {
  it("members may update name and anniversary but not privileged invites", async () => {
    await pair();
    const updated = await s.update(b, {
      name: "Chúng mình",
      anniversary: null,
    });
    expect(updated.name).toBe("Chúng mình");
    expect(updated.anniversaryInfo).toBeNull();
    await expect(s.invite(b)).rejects.toMatchObject({ status: 403 });
    await expect(s.revokeInvite(b)).rejects.toMatchObject({ status: 403 });
    await expect(
      s.update(b, { anniversary: "2099-01-01" }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(s.update(b, {})).rejects.toThrow();
  });
  it("anniversary counts local days and maps leap anniversary to Feb 28", () => {
    expect(
      anniversaryInfo(
        "2020-02-29",
        "Asia/Ho_Chi_Minh",
        new Date("2026-02-27T18:00:00Z"),
      ),
    ).toMatchObject({
      nextDate: "2026-02-28",
      isToday: true,
      daysUntil: 0,
      daysTogether: 2191,
    });
    expect(
      anniversaryInfo("2020-10-03", "UTC", new Date("2026-10-04T00:00:00Z"))
        ?.nextDate,
    ).toBe("2027-10-03");
    expect(anniversaryInfo(null, "UTC")).toBeNull();
  });
  it("only owner transfers to active other member; old role changes immediately", async () => {
    await pair();
    await expect(s.transferOwner(b, { userId: a })).rejects.toMatchObject({
      status: 403,
    });
    await expect(s.transferOwner(a, { userId: a })).rejects.toMatchObject(
      err("SAME_OWNER"),
    );
    await expect(s.transferOwner(a, { userId: c })).rejects.toMatchObject({
      status: 404,
    });
    await s.transferOwner(a, { userId: b });
    expect((await s.me(b)).couple?.role).toBe("owner");
    expect((await s.me(a)).couple?.role).toBe("member");
    await expect(s.transferOwner(a, { userId: b })).rejects.toMatchObject({
      status: 403,
    });
  });
  it("owner with partner must transfer and last owner must explicitly dissolve", async () => {
    await pair();
    await expect(
      s.leave(a, { confirm: true, dissolve: true }),
    ).rejects.toMatchObject(err("TRANSFER_OWNER_REQUIRED"));
    await expect(
      s.leave(b, { confirm: true, dissolve: true }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(s.leave(b, { confirm: false })).rejects.toThrow();
  });
  it("solo dissolution archives and revokes code, permits fresh couple", async () => {
    const out = await create();
    const inv = await s.invite(a);
    await expect(s.leave(a, { confirm: true })).rejects.toMatchObject(
      err("DISSOLVE_REQUIRED"),
    );
    await s.leave(a, { confirm: true, dissolve: true });
    expect((await s.archived(a, out.id)).status).toBe("archived");
    await expect(s.preview(b, inv.code)).rejects.toMatchObject({ status: 404 });
    expect((await s.me(a)).couple).toBeNull();
    await s.create(a, { name: "New" });
    expect((await s.archives(a, {})).total).toBe(1);
  });
  it("member leaving archives for both, retains feed snapshots and no active pointers", async () => {
    const out = await pair();
    await s.leave(b, { confirm: true });
    for (const id of [a, b]) {
      expect((await s.me(id)).couple).toBeNull();
      expect((await s.archives(id, {})).total).toBe(1);
      expect((await s.archived(id, out.id)).members).toHaveLength(2);
      await expect(s.requireActive(id)).rejects.toMatchObject({ status: 404 });
    }
    await User.updateOne({ _id: b }, { $set: { name: "Changed" } });
    expect((await s.archived(a, out.id)).members[1].name).toBe("Lan");
    expect((await s.activity(a, { coupleId: out.id })).items[0].type).toBe(
      "archived",
    );
    await expect(s.leave(b, { confirm: true })).rejects.toMatchObject({
      status: 404,
    });
    await expect(s.update(b, { name: "No" })).rejects.toMatchObject({
      status: 404,
    });
  });
  it("outstanding settlements require separate confirmation and are never deleted", async () => {
    const out = await pair();
    await mongoose.connection.collection("settlements").insertMany([
      {
        coupleId: new mongoose.Types.ObjectId(out.id),
        status: "unpaid",
        deletedAt: null,
      },
      {
        coupleId: new mongoose.Types.ObjectId(out.id),
        status: "paid",
        deletedAt: null,
      },
    ]);
    expect((await s.me(b)).couple?.outstanding.count).toBe(1);
    await expect(s.leave(b, { confirm: true })).rejects.toMatchObject(
      err("OUTSTANDING_SETTLEMENTS"),
    );
    await s.leave(b, { confirm: true, confirmOutstanding: true });
    expect(
      await mongoose.connection.collection("settlements").countDocuments(),
    ).toBe(2);
  });
  it("archive rollback restores both active memberships and pointers", async () => {
    await pair();
    jest
      .spyOn(CoupleActivity, "create")
      .mockRejectedValueOnce(new Error("archive feed down"));
    await expect(s.leave(b, { confirm: true })).rejects.toThrow();
    expect(await CoupleMember.countDocuments({ active: true })).toBe(2);
    expect((await s.me(a)).couple?.status).toBe("active");
    expect((await s.me(b)).couple?.status).toBe("active");
  });
  it("archives and activity are paginated and scoped, unrelated accounts get 404", async () => {
    const out = await pair();
    await s.leave(b, { confirm: true });
    await expect(s.archived(c, out.id)).rejects.toMatchObject({ status: 404 });
    await expect(s.activity(c, { coupleId: out.id })).rejects.toMatchObject({
      status: 404,
    });
    expect((await s.archives(c, {})).total).toBe(0);
    const feed = await s.activity(a, { coupleId: out.id, page: 2, limit: 1 });
    expect(feed.items).toHaveLength(1);
    expect(feed.total).toBe(4);
    expect((await s.archives(a, { page: 2, limit: 1 })).items).toHaveLength(0);
  });
  it("membership change blocks account deletion even after initial password check", async () => {
    await User.updateOne(
      { _id: a },
      { $set: { passwordHash: await bcrypt.hash("Testing123!", 4) } },
    );
    const original = userRepository.byId;
    jest.spyOn(userRepository, "byId").mockImplementationOnce((async (
      ...args: Parameters<typeof original>
    ) => {
      const u = await original(...args);
      await create();
      return u;
    }) as never);
    await expect(userService.remove(a, "Testing123!")).rejects.toMatchObject(
      err("COUPLE_ACTIVE"),
    );
    expect((await User.findById(a))!.deletedAt).toBeNull();
  });
});
describe("REST validation and access", () => {
  it("all main routes are authenticated and inputs reject ownership injection", async () => {
    expect((await request(app).get("/api/couples/me")).status).toBe(401);
    const h = { Authorization: `Bearer ${token}` };
    expect(
      (
        await request(app)
          .post("/api/couples")
          .set(h)
          .send({ name: "Us", ownerId: b })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post("/api/couples?userId=x")
          .set(h)
          .send({ name: "Us" })
      ).status,
    ).toBe(400);
    const created = await request(app)
      .post("/api/couples")
      .set(h)
      .send({ name: "Us" });
    expect(created.status).toBe(201);
    expect(
      (await request(app).put("/api/couples/me").set(h).send({ name: "New" }))
        .status,
    ).toBe(200);
    const invite = await request(app)
      .post("/api/couples/invite")
      .set(h)
      .send({});
    expect(invite.status).toBe(201);
    expect(
      (await request(app).get(`/api/couples/invite/${invite.body.code}`).set(h))
        .status,
    ).toBe(200);
    expect(
      (await request(app).delete("/api/couples/invite").set(h).send({})).status,
    ).toBe(204);
    expect(
      (await request(app).get("/api/couples/activity").set(h)).body.total,
    ).toBe(4);
    expect((await request(guarded).get("/test-couple").set(h)).status).toBe(
      200,
    );
    expect(
      (
        await request(app)
          .delete("/api/couples/leave")
          .set(h)
          .send({ confirm: true, dissolve: true })
      ).status,
    ).toBe(200);
    expect(
      (await request(app).get("/api/couples/archives").set(h)).body.total,
    ).toBe(1);
    expect(
      (
        await request(app)
          .get(`/api/couples/archives/${created.body.id}`)
          .set(h)
      ).status,
    ).toBe(200);
    expect((await request(guarded).get("/test-couple").set(h)).status).toBe(
      404,
    );
    expect(
      (await request(app).get("/api/couples/archives/bad").set(h)).status,
    ).toBe(400);
    expect(
      (await request(app).get("/api/couples/me?userId=x").set(h)).status,
    ).toBe(400);
  });
  it("accept/transfer REST and rate limiting share per-user invitation budget", async () => {
    await s.create(b, { name: "Host" });
    const inv = await s.invite(b);
    const h = { Authorization: `Bearer ${token}` };
    expect(
      (
        await request(app)
          .post("/api/couples/accept")
          .set(h)
          .send({ code: inv.code })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post("/api/couples/transfer-owner")
          .set(h)
          .send({ userId: b })
      ).status,
    ).toBe(403);
    for (let i = 0; i < 9; i++)
      await request(app).get("/api/couples/invite/ABCDEFGH").set(h);
    expect(
      (await request(app).get("/api/couples/invite/ABCDEFGH").set(h)).status,
    ).toBe(429);
  });
});

it("không chuyển quyền cho chính mình bằng mã user viết hoa", async () => {
  await pair();
  await expect(
    s.transferOwner(a, { userId: a.toUpperCase() }),
  ).rejects.toMatchObject({ code: "SAME_OWNER" });
  expect((await s.me(a)).couple?.role).toBe("owner");
  expect(
    await CoupleMember.countDocuments({ active: true, role: "owner" }),
  ).toBe(1);
});
