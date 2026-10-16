process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/test?replicaSet=rs0";
process.env.JWT_SECRET = "test-secret-longer-than-thirty-two-characters";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { createApp } from "../../../app";
import { env } from "../../../config/env";
import { User } from "../../users/model";
import { RefreshToken } from "../model";
import { authService } from "../service";
import { userService } from "../../users/service";
import { logger } from "../../../config/logger";
let replica: MongoMemoryReplSet;
let app: ReturnType<typeof createApp>;
const account = {
  name: "Minh",
  email: "minh@example.test",
  password: "Secret12345",
};
function cookie(response: request.Response) {
  const values = response.headers["set-cookie"] as unknown as string[];
  return values[0].split(";")[0];
}
const raw = (value: string) => value.split("=")[1];
async function register(email = account.email) {
  return request(app)
    .post("/api/auth/register")
    .send({ ...account, email });
}
async function me(accessToken: string) {
  return request(app)
    .get("/api/users/me")
    .auth(accessToken, { type: "bearer" });
}
beforeAll(async () => {
  replica = await MongoMemoryReplSet.create({
    binary: { version: "7.0.14" },
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(replica.getUri());
  await Promise.all([User.init(), RefreshToken.init()]);
}, 180000);
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), RefreshToken.deleteMany({})]);
  app = createApp();
});
afterAll(async () => {
  await mongoose.disconnect();
  await replica?.stop();
});
describe("Auth và người dùng trên MongoDB replica set", () => {
  test("đăng ký: hash bcrypt 12, JWT 15 phút, cookie httpOnly, không lộ hash", async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body.user.name).toBe("Minh");
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
    const user = await User.findOne({ email: account.email }).select(
      "+passwordHash",
    );
    expect(bcrypt.getRounds(user!.passwordHash)).toBe(12);
    expect(await bcrypt.compare(account.password, user!.passwordHash)).toBe(
      true,
    );
    const claims = jwt.decode(res.body.accessToken) as jwt.JwtPayload;
    expect(claims.exp! - claims.iat!).toBe(900);
    const headers = res.headers["set-cookie"] as unknown as string[];
    expect(headers[0]).toContain("HttpOnly");
    expect(headers[0]).toContain("SameSite=Strict");
    expect(headers[0]).toContain("Max-Age=604800");
    expect(headers[0]).toContain("Path=/api/auth");
    const token = await RefreshToken.findOne({}).select("+tokenHash");
    expect(token!.tokenHash).not.toBe(raw(cookie(res)));
    expect(token!.tokenHash).toHaveLength(64);
    expect((await me(res.body.accessToken)).status).toBe(200);
  });
  test("chuẩn hóa email, chặn trùng", async () => {
    await register();
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...account, email: " MINH@EXAMPLE.TEST " });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_EXISTS");
  });
  test("đăng ký đồng thời chỉ tạo một tài khoản", async () => {
    const results = await Promise.all([register(), register()]);
    expect(results.map((x) => x.status).sort()).toEqual([201, 409]);
    expect(await User.countDocuments()).toBe(1);
    expect(await RefreshToken.countDocuments()).toBe(1);
  });
  test("rollback đăng ký nếu tạo phiên lỗi", async () => {
    const spy = jest
      .spyOn(RefreshToken, "create")
      .mockRejectedValueOnce(new Error("injected"));
    await expect(authService.register(account)).rejects.toThrow("injected");
    spy.mockRestore();
    expect(await User.countDocuments()).toBe(0);
  });
  test("đăng nhập đúng, sai và email không tồn tại", async () => {
    await register();
    expect(
      (
        await request(app)
          .post("/api/auth/login")
          .send({ email: account.email, password: account.password })
      ).status,
    ).toBe(200);
    const wrong = await request(app)
      .post("/api/auth/login")
      .send({ email: account.email, password: "wrong" });
    expect(wrong.status).toBe(401);
    const absent = await request(app)
      .post("/api/auth/login")
      .send({ email: "no@example.test", password: "wrong" });
    expect(absent.body.error.code).toBe(wrong.body.error.code);
  });
  test("khóa sau 5 lần sai, đúng cũng bị khóa; hết khóa đăng nhập lại được", async () => {
    await register();
    for (let i = 0; i < 5; i++)
      await request(app)
        .post("/api/auth/login")
        .send({ email: account.email, password: "wrong" });
    const locked = await request(app)
      .post("/api/auth/login")
      .send({ email: account.email, password: account.password });
    expect(locked.status).toBe(423);
    await User.updateOne(
      { email: account.email },
      { $set: { lockUntil: new Date(Date.now() - 1000) } },
    );
    expect(
      (
        await request(app)
          .post("/api/auth/login")
          .send({ email: account.email, password: account.password })
      ).status,
    ).toBe(200);
    expect((await User.findOne({ email: account.email }))!.loginAttempts).toBe(
      0,
    );
  });
  test("10 lần/phút cho login/register", async () => {
    for (let i = 0; i < 10; i++)
      await request(app).post("/api/auth/login").send({});
    const res = await request(app).post("/api/auth/register").send({});
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("AUTH_RATE_LIMIT");
  });
  test("JWT thiếu, hết hạn hoặc sai chữ ký bị chặn", async () => {
    const created = await register();
    expect((await request(app).get("/api/users/me")).status).toBe(401);
    const decoded = jwt.decode(created.body.accessToken) as jwt.JwtPayload;
    const expired = jwt.sign(
      { family: decoded.family, version: decoded.version },
      env.JWT_SECRET,
      {
        subject: decoded.sub,
        issuer: "mam-chung",
        audience: "mam-chung-web",
        expiresIn: -1,
      },
    );
    expect((await me(expired)).status).toBe(401);
    expect((await me(jwt.sign({ sub: decoded.sub }, "wrong"))).status).toBe(
      401,
    );
  });
  test("rotation thay cookie; dùng lại token cũ thu hồi mọi phiên", async () => {
    const first = await register();
    const other = await request(app)
      .post("/api/auth/login")
      .send({ email: account.email, password: account.password });
    const rotated = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookie(first));
    expect(rotated.status).toBe(200);
    expect(cookie(rotated)).not.toBe(cookie(first));
    const reuse = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookie(first));
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe("TOKEN_REUSE");
    expect((await me(rotated.body.accessToken)).status).toBe(401);
    expect((await me(other.body.accessToken)).status).toBe(401);
    expect(
      (
        await request(app)
          .post("/api/auth/refresh")
          .set("Cookie", cookie(rotated))
      ).status,
    ).toBe(401);
  });
  test("refresh thiếu, không hợp lệ hoặc hết hạn bị chặn", async () => {
    expect((await request(app).post("/api/auth/refresh")).status).toBe(401);
    expect(
      (
        await request(app)
          .post("/api/auth/refresh")
          .set("Cookie", "refreshToken=invalid")
      ).status,
    ).toBe(401);
    const created = await register();
    await RefreshToken.updateMany(
      {},
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    expect(
      (
        await request(app)
          .post("/api/auth/refresh")
          .set("Cookie", cookie(created))
      ).status,
    ).toBe(401);
  });
  test("hai refresh đồng thời không để lại phiên dùng được khi phát hiện reuse", async () => {
    const created = await register();
    const results = await Promise.all([
      request(app).post("/api/auth/refresh").set("Cookie", cookie(created)),
      request(app).post("/api/auth/refresh").set("Cookie", cookie(created)),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    const ok = results.find((r) => r.status === 200)!;
    expect((await me(ok.body.accessToken)).status).toBe(401);
  });
  test("logout thu hồi phiên hiện tại, không ảnh hưởng phiên khác", async () => {
    const first = await register();
    const other = await request(app)
      .post("/api/auth/login")
      .send({ email: account.email, password: account.password });
    const out = await request(app)
      .post("/api/auth/logout")
      .auth(first.body.accessToken, { type: "bearer" });
    expect(out.status).toBe(204);
    expect((await me(first.body.accessToken)).status).toBe(401);
    expect((await me(other.body.accessToken)).status).toBe(200);
    expect(
      (
        await request(app)
          .post("/api/auth/refresh")
          .set("Cookie", cookie(first))
      ).status,
    ).toBe(401);
  });
  test("profile chỉ cập nhật tài khoản lấy từ token", async () => {
    const a = await register();
    const b = await register("lan@example.test");
    const illegal = await request(app)
      .put("/api/users/me")
      .auth(a.body.accessToken, { type: "bearer" })
      .send({
        name: "Hacked",
        userId: b.body.user.id,
        coupleId: b.body.user.id,
      });
    expect(illegal.status).toBe(400);
    const updated = await request(app)
      .put("/api/users/me")
      .auth(a.body.accessToken, { type: "bearer" })
      .send({
        name: "Minh mới",
        avatar: "https://example.test/avatar.png",
        timezone: "Asia/Tokyo",
      });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe("Minh mới");
    expect(updated.body.passwordHash).toBeUndefined();
    expect((await me(b.body.accessToken)).body.name).toBe("Minh");
    expect(
      (
        await request(app)
          .get(`/api/users/${b.body.user.id}`)
          .auth(a.body.accessToken, { type: "bearer" })
      ).status,
    ).toBe(404);
  });
  test("chặn múi giờ sai, URL ảnh không HTTPS và NoSQL injection", async () => {
    const created = await register();
    for (const body of [
      { timezone: "not/a/timezone" },
      { avatar: "http://example.test/avatar" },
      { email: "change@example.test" },
    ])
      expect(
        (
          await request(app)
            .put("/api/users/me")
            .auth(created.body.accessToken, { type: "bearer" })
            .send(body)
        ).status,
      ).toBe(400);
    expect(
      (
        await request(app)
          .post("/api/auth/login")
          .send({ email: { $ne: null }, password: "wrong" })
      ).status,
    ).toBe(400);
  });
  test("chặn mật khẩu quá 72 byte (kể cả Unicode)", async () => {
    expect(
      (
        await request(app)
          .post("/api/auth/register")
          .send({ ...account, password: "a1" + "ắ".repeat(30) })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post("/api/auth/register")
          .send({ ...account, password: "abcdefgh" })
      ).status,
    ).toBe(400);
  });
  test("đổi mật khẩu yêu cầu mật khẩu cũ và thu hồi mọi phiên", async () => {
    const first = await register();
    const other = await request(app)
      .post("/api/auth/login")
      .send({ email: account.email, password: account.password });
    const change = () =>
      request(app)
        .post("/api/auth/change-password")
        .auth(first.body.accessToken, { type: "bearer" });
    expect(
      (
        await change().send({
          currentPassword: "wrong",
          newPassword: "Updated12345",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await change().send({
          currentPassword: account.password,
          newPassword: account.password,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await change().send({
          currentPassword: account.password,
          newPassword: "Updated12345",
        })
      ).status,
    ).toBe(204);
    expect((await me(first.body.accessToken)).status).toBe(401);
    expect((await me(other.body.accessToken)).status).toBe(401);
    expect(
      (
        await request(app)
          .post("/api/auth/login")
          .send({ email: account.email, password: account.password })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post("/api/auth/login")
          .send({ email: account.email, password: "Updated12345" })
      ).status,
    ).toBe(200);
  });
  test("xóa tài khoản xác nhận mật khẩu, soft delete, không còn đăng nhập", async () => {
    const first = await register();
    const remove = () =>
      request(app)
        .delete("/api/users/me")
        .auth(first.body.accessToken, { type: "bearer" });
    expect((await remove().send({ password: "wrong" })).status).toBe(400);
    expect((await remove().send({ password: account.password })).status).toBe(
      204,
    );
    expect((await me(first.body.accessToken)).status).toBe(401);
    const deleted = await User.findById(first.body.user.id);
    expect(deleted!.deletedAt).not.toBeNull();
    expect(deleted!.name).toBe("Tài khoản đã xóa");
    expect(
      (
        await request(app)
          .post("/api/auth/login")
          .send({ email: account.email, password: account.password })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post("/api/auth/refresh")
          .set("Cookie", cookie(first))
      ).status,
    ).toBe(401);
  });
  test("không xóa tài khoản đang thuộc couple để tránh dữ liệu mồ côi", async () => {
    const first = await register();
    await User.updateOne(
      { _id: first.body.user.id },
      { $set: { coupleId: new mongoose.Types.ObjectId() } },
    );
    expect(
      (
        await request(app)
          .delete("/api/users/me")
          .auth(first.body.accessToken, { type: "bearer" })
          .send({ password: account.password })
      ).status,
    ).toBe(409);
  });
  test("coupleId luôn lấy từ DB, không tin claim client", async () => {
    const first = await register();
    const coupled = new mongoose.Types.ObjectId();
    await User.updateOne(
      { _id: first.body.user.id },
      { $set: { coupleId: coupled } },
    );
    const claims = jwt.decode(first.body.accessToken) as jwt.JwtPayload;
    const token = jwt.sign(
      { family: claims.family, version: claims.version, coupleId: "attacker" },
      env.JWT_SECRET,
      {
        subject: claims.sub,
        issuer: "mam-chung",
        audience: "mam-chung-web",
        expiresIn: "15m",
      },
    );
    expect((await me(token)).body.coupleId).toBe(coupled.toString());
  });
  test("chặn Origin ngoài whitelist và JSON lỗi", async () => {
    expect(
      (
        await request(app)
          .post("/api/auth/refresh")
          .set("Origin", "https://evil.test")
      ).status,
    ).toBe(403);
    const bad = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{broken");
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("INVALID_BODY");
  });
  test("service không thao tác tài khoản đã biến mất", async () => {
    const id = new mongoose.Types.ObjectId().toString();
    await expect(userService.me(id)).rejects.toMatchObject({ status: 401 });
    await expect(
      userService.update(id, { name: "Minh" }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      userService.remove(id, account.password),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      authService.changePassword(id, {
        currentPassword: account.password,
        newPassword: "New123456",
      }),
    ).rejects.toMatchObject({ status: 401 });
  });
  test("refresh lỗi giữa chừng rollback, token cũ vẫn dùng được", async () => {
    const created = await register();
    const spy = jest
      .spyOn(RefreshToken, "create")
      .mockRejectedValueOnce(new Error("injected-refresh"));
    await expect(authService.refresh(raw(cookie(created)))).rejects.toThrow(
      "injected-refresh",
    );
    spy.mockRestore();
    const rotated = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookie(created));
    expect(rotated.status).toBe(200);
  });
  test("logout và refresh đồng thời không hồi sinh phiên", async () => {
    const created = await register();
    const results = await Promise.all([
      request(app)
        .post("/api/auth/logout")
        .auth(created.body.accessToken, { type: "bearer" }),
      request(app).post("/api/auth/refresh").set("Cookie", cookie(created)),
    ]);
    expect(results[0].status).toBe(204);
    expect([200, 401]).toContain(results[1].status);
    expect((await me(created.body.accessToken)).status).toBe(401);
    if (results[1].status === 200)
      expect((await me(results[1].body.accessToken)).status).toBe(401);
  });
  test("mật khẩu xác nhận vượt 72 byte bị chặn", async () => {
    const created = await register();
    const body = { currentPassword: "x".repeat(73), newPassword: "New123456" };
    expect(
      (
        await request(app)
          .post("/api/auth/change-password")
          .auth(created.body.accessToken, { type: "bearer" })
          .send(body)
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .delete("/api/users/me")
          .auth(created.body.accessToken, { type: "bearer" })
          .send({ password: "x".repeat(73) })
      ).status,
    ).toBe(400);
  });
});

test("đăng nhập sai trả chậm không cộng lỗi vào mật khẩu vừa đổi", async () => {
  const first = await register();
  const spy = jest.spyOn(bcrypt, "compare").mockImplementationOnce(async () => {
    await User.updateOne(
      { _id: first.body.user.id },
      {
        $inc: { securityVersion: 1 },
        $set: { loginAttempts: 0, lockUntil: null },
      },
    );
    return false;
  });
  try {
    await expect(
      authService.login({ email: account.email, password: "Wrong12345" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    const user = await User.findById(first.body.user.id);
    expect(user!.loginAttempts).toBe(0);
    expect(user!.lockUntil).toBeNull();
  } finally {
    spy.mockRestore();
  }
});

describe("adminResetPassword (quản trị đặt lại mật khẩu không cần email)", () => {
  test("đặt lại thành công: mật khẩu tạm đăng nhập được, mật khẩu cũ bị từ chối, refresh token cũ bị thu hồi, không lộ mật khẩu trong log", async () => {
    const created = await register();
    expect(created.status).toBe(201);
    const oldCookie = cookie(created);

    const logSpy = jest.spyOn(logger, "info");

    const result = await authService.adminResetPassword(
      "  MINH@EXAMPLE.TEST  ",
    );
    expect(result.user.email).toBe(account.email);
    expect(result.temporaryPassword).toBeDefined();
    expect(result.temporaryPassword.length).toBeGreaterThanOrEqual(16);
    expect(/(?=.*[A-Za-z])(?=.*\d)/.test(result.temporaryPassword)).toBe(true);

    // Mật khẩu tạm không được xuất hiện trong log
    expect(logSpy).toHaveBeenCalled();
    const loggedCalls = logSpy.mock.calls;
    for (const call of loggedCalls) {
      const serialized = JSON.stringify(call);
      expect(serialized).not.toContain(result.temporaryPassword);
    }
    logSpy.mockRestore();

    // Mật khẩu cũ bị từ chối
    await expect(
      authService.login({
        email: account.email,
        password: account.password,
      }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });

    // Refresh token cũ bị thu hồi
    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", oldCookie);
    expect(refreshRes.status).toBe(401);

    // Access token cũ không còn hợp lệ do securityVersion đã tăng
    expect((await me(created.body.accessToken)).status).toBe(401);

    // Đăng nhập được bằng mật khẩu tạm
    const loginRes = await authService.login({
      email: account.email,
      password: result.temporaryPassword,
    });
    expect(loginRes.user.email).toBe(account.email);
    expect(loginRes.accessToken).toBeDefined();

    // Đổi mật khẩu từ mật khẩu tạm sang mật khẩu mới bình thường
    await authService.changePassword(loginRes.user.id, {
      currentPassword: result.temporaryPassword,
      newPassword: "BrandNewPassword2026!",
    });

    // Mật khẩu mới hoạt động
    const finalLogin = await authService.login({
      email: account.email,
      password: "BrandNewPassword2026!",
    });
    expect(finalLogin.user.email).toBe(account.email);
  });

  test("email không tồn tại → ném lỗi USER_NOT_FOUND (404), không thay đổi gì", async () => {
    await register();
    await expect(
      authService.adminResetPassword("nonexistent@example.test"),
    ).rejects.toMatchObject({
      code: "USER_NOT_FOUND",
      status: 404,
    });
  });

  test("email không hợp lệ cú pháp → ném lỗi validation", async () => {
    await expect(
      authService.adminResetPassword("invalid-email-format"),
    ).rejects.toThrow();
  });
});

describe("bcrypt v6 tương thích ngược với hash tạo từ bcrypt v5", () => {
  // Hash cố định $2b$12$ sinh bởi bcrypt 5.1.1 với mật khẩu "OldBcrypt5Password123!"
  const LEGACY_BCRYPT5_PASSWORD = "OldBcrypt5Password123!";
  const LEGACY_BCRYPT5_HASH =
    "$2b$12$9GOVamvMYgMNUzjCotWdtu0wMXX17u8P03qRygXS4xgdrUPycW2S.";

  test("bcrypt.compare xác thực thành công hash cố định sinh từ bcrypt v5", async () => {
    expect(bcrypt.getRounds(LEGACY_BCRYPT5_HASH)).toBe(12);
    expect(
      await bcrypt.compare(LEGACY_BCRYPT5_PASSWORD, LEGACY_BCRYPT5_HASH),
    ).toBe(true);
    expect(
      await bcrypt.compare("WrongPassword123!", LEGACY_BCRYPT5_HASH),
    ).toBe(false);
  });

  test("người dùng mang hash từ phiên bản cũ đăng nhập bình thường qua authService.login", async () => {
    const legacyUser = await User.create({
      name: "Tài khoản cũ",
      email: "legacy-v5@example.test",
      passwordHash: LEGACY_BCRYPT5_HASH,
    });
    expect(legacyUser).toBeDefined();

    // Đăng nhập thành công với mật khẩu đúng
    const loginResult = await authService.login({
      email: "legacy-v5@example.test",
      password: LEGACY_BCRYPT5_PASSWORD,
    });
    expect(loginResult.user.email).toBe("legacy-v5@example.test");
    expect(loginResult.accessToken).toBeDefined();

    // Mật khẩu sai vẫn bị từ chối
    await expect(
      authService.login({
        email: "legacy-v5@example.test",
        password: "SaiMatKhau123!",
      }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
});


