process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/test?replicaSet=rs0";
process.env.JWT_SECRET = "test-secret-longer-than-thirty-two-characters";

import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { Request } from "express";
import { createApp } from "../../../app";
import { User } from "../../users/model";
import { RefreshToken } from "../../auth/model";
import { AdminAuditLog } from "../models";
import { adminService } from "../service";
import { verifyAdminPassword } from "../middleware";

let replica: MongoMemoryReplSet;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  replica = await MongoMemoryReplSet.create({
    binary: { version: "7.0.14" },
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(replica.getUri());
  await Promise.all([User.init(), RefreshToken.init(), AdminAuditLog.init()]);
}, 180000);

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    RefreshToken.deleteMany({}),
    AdminAuditLog.deleteMany({}),
  ]);
  app = createApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  await replica?.stop();
});

function cookie(res: request.Response) {
  const values = res.headers["set-cookie"] as unknown as string[];
  return values?.[0]?.split(";")[0] ?? "";
}

describe("Admin Foundation (Giai đoạn 1 – Vai trò, Khóa tài khoản, Cổng chặn)", () => {
  test("người thường gọi route admin bị 403 FORBIDDEN", async () => {
    const reg = await request(app).post("/api/auth/register").send({
      name: "User 1",
      email: "user1@example.com",
      password: "Password123",
    });
    expect(reg.status).toBe(201);
    const token = reg.body.accessToken;

    const res = await request(app)
      .get("/api/admin/ping")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  test("người dùng chưa đăng nhập gọi route admin bị 401 UNAUTHORIZED", async () => {
    const res = await request(app).get("/api/admin/ping");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  test("admin truy cập route admin thành công 200", async () => {
    const reg = await request(app).post("/api/auth/register").send({
      name: "Admin 1",
      email: "admin1@example.com",
      password: "Password123",
    });
    const token = reg.body.accessToken;

    await User.updateOne(
      { email: "admin1@example.com" },
      { $set: { role: "admin" } },
    );

    const res = await request(app)
      .get("/api/admin/ping")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.admin).toBe(true);
  });

  test("token cũ của người vừa bị gỡ quyền admin bị 403 ngay lập tức", async () => {
    const reg = await request(app).post("/api/auth/register").send({
      name: "Ex Admin",
      email: "exadmin@example.com",
      password: "Password123",
    });
    const token = reg.body.accessToken;

    await User.updateOne(
      { email: "exadmin@example.com" },
      { $set: { role: "admin" } },
    );

    // Khi còn là admin -> gọi được
    const resBefore = await request(app)
      .get("/api/admin/ping")
      .set("Authorization", `Bearer ${token}`);
    expect(resBefore.status).toBe(200);

    // Gỡ quyền trực tiếp trong DB (mô phỏng revoke)
    await User.updateOne(
      { email: "exadmin@example.com" },
      { $set: { role: "user" } },
    );

    // Dùng token cũ gọi tiếp -> requireAdmin đọc DB và từ chối 403 ngay
    const resAfter = await request(app)
      .get("/api/admin/ping")
      .set("Authorization", `Bearer ${token}`);
    expect(resAfter.status).toBe(403);
    expect(resAfter.body.error.code).toBe("FORBIDDEN");
  });

  describe("Tài khoản bị khóa (disabledAt != null)", () => {
    test("đăng nhập sai mật khẩu chỉ báo lỗi chung 401, không lộ trạng thái khóa", async () => {
      await request(app).post("/api/auth/register").send({
        name: "Disabled User",
        email: "disabled@example.com",
        password: "Password123",
      });

      await User.updateOne(
        { email: "disabled@example.com" },
        { $set: { disabledAt: new Date() } },
      );

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "disabled@example.com", password: "WrongPassword123" });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    test("đăng nhập đúng mật khẩu báo 403 ACCOUNT_DISABLED", async () => {
      await request(app).post("/api/auth/register").send({
        name: "Disabled User",
        email: "disabled@example.com",
        password: "Password123",
      });

      await User.updateOne(
        { email: "disabled@example.com" },
        { $set: { disabledAt: new Date() } },
      );

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "disabled@example.com", password: "Password123" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ACCOUNT_DISABLED");
      expect(res.body.error.message).toContain("tạm khóa");
    });

    test("làm mới token (refresh) của tài khoản bị khóa bị từ chối 403", async () => {
      const reg = await request(app).post("/api/auth/register").send({
        name: "Active User",
        email: "active@example.com",
        password: "Password123",
      });
      const refreshCookie = cookie(reg);

      // Khóa tài khoản sau khi đã cấp refresh token
      await User.updateOne(
        { email: "active@example.com" },
        { $set: { disabledAt: new Date() } },
      );

      const res = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", refreshCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ACCOUNT_DISABLED");
    });

    test("gọi API bằng token đang dùng của tài khoản bị khóa bị từ chối 403 ngay", async () => {
      const reg = await request(app).post("/api/auth/register").send({
        name: "Token User",
        email: "tokenuser@example.com",
        password: "Password123",
      });
      const token = reg.body.accessToken;

      // Khóa tài khoản
      await User.updateOne(
        { email: "tokenuser@example.com" },
        { $set: { disabledAt: new Date() } },
      );

      const res = await request(app)
        .get("/api/users/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ACCOUNT_DISABLED");
    });
  });

  test("ghi lastLoginAt khi đăng nhập thành công, không ghi khi refresh", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Login Record",
      email: "record@example.com",
      password: "Password123",
    });

    const beforeLogin = await User.findOne({ email: "record@example.com" });
    expect(beforeLogin?.lastLoginAt).toBeNull();

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "record@example.com", password: "Password123" });
    expect(loginRes.status).toBe(200);

    const afterLogin = await User.findOne({ email: "record@example.com" });
    expect(afterLogin?.lastLoginAt).not.toBeNull();
    const loginTime = afterLogin?.lastLoginAt?.getTime();

    // Refresh token
    const refreshCookie = cookie(loginRes);
    await new Promise((r) => setTimeout(r, 50));

    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", refreshCookie);
    expect(refreshRes.status).toBe(200);

    const afterRefresh = await User.findOne({ email: "record@example.com" });
    expect(afterRefresh?.lastLoginAt?.getTime()).toBe(loginTime);
  });

  test("body có role: admin khi đăng ký hoặc sửa hồ sơ bị từ chối 400 (strict schema)", async () => {
    // Đăng ký với role: admin
    const reg = await request(app).post("/api/auth/register").send({
      name: "Hacker",
      email: "hacker@example.com",
      password: "Password123",
      role: "admin",
    });
    expect(reg.status).toBe(400);
    expect(reg.body.error.code).toBe("VALIDATION_ERROR");

    // Đăng ký hợp lệ
    const validReg = await request(app).post("/api/auth/register").send({
      name: "Normal User",
      email: "normal@example.com",
      password: "Password123",
    });
    expect(validReg.status).toBe(201);
    expect(validReg.body.user.role).toBe("user");
    const token = validReg.body.accessToken;

    // Sửa hồ sơ kèm role: admin
    const patch = await request(app)
      .put("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Updated Name", role: "admin" });
    expect(patch.status).toBe(400);
    expect(patch.body.error.code).toBe("VALIDATION_ERROR");

    // Kiểm tra trong DB vẫn là user
    const checkUser = await User.findOne({ email: "normal@example.com" });
    expect(checkUser?.role).toBe("user");
  });

  describe("Cấp và gỡ quyền Admin (adminService / CLI)", () => {
    test("cấp quyền admin thành công và ghi audit log", async () => {
      await request(app).post("/api/auth/register").send({
        name: "Promoted",
        email: "promoted@example.com",
        password: "Password123",
      });

      const grantRes = await adminService.grantAdminRole(
        "promoted@example.com",
      );
      expect(grantRes.changed).toBe(true);
      expect(grantRes.user.role).toBe("admin");

      const audit = await AdminAuditLog.findOne({
        action: "admin_grant",
        targetId: grantRes.user.id,
      });
      expect(audit).not.toBeNull();
      expect(audit?.adminEmail).toBe("system:cli");
    });

    test("cấp quyền cho email không tồn tại bị 404", async () => {
      await expect(
        adminService.grantAdminRole("nonexistent@example.com"),
      ).rejects.toThrow("Không tìm thấy người dùng");
    });

    test("gỡ quyền admin thành công khi có nhiều hơn 1 admin", async () => {
      await request(app).post("/api/auth/register").send({
        name: "Admin One",
        email: "admin1@example.com",
        password: "Password123",
      });
      await request(app).post("/api/auth/register").send({
        name: "Admin Two",
        email: "admin2@example.com",
        password: "Password123",
      });

      await User.updateMany({}, { $set: { role: "admin" } });

      const revokeRes =
        await adminService.revokeAdminRole("admin2@example.com");
      expect(revokeRes.changed).toBe(true);

      const checkUser = await User.findOne({ email: "admin2@example.com" });
      expect(checkUser?.role).toBe("user");

      const audit = await AdminAuditLog.findOne({
        action: "admin_revoke",
        targetId: checkUser?.id,
      });
      expect(audit).not.toBeNull();
    });

    test("không thể gỡ quyền khi đó là admin cuối cùng", async () => {
      await request(app).post("/api/auth/register").send({
        name: "Sole Admin",
        email: "sole@example.com",
        password: "Password123",
      });

      await User.updateOne(
        { email: "sole@example.com" },
        { $set: { role: "admin" } },
      );

      await expect(
        adminService.revokeAdminRole("sole@example.com"),
      ).rejects.toThrow("quản trị viên cuối cùng");

      const checkUser = await User.findOne({ email: "sole@example.com" });
      expect(checkUser?.role).toBe("admin");
    });

    test("listAdmins trả về danh sách admin chính xác", async () => {
      await request(app).post("/api/auth/register").send({
        name: "Adm 1",
        email: "adm1@example.com",
        password: "Password123",
      });
      await request(app).post("/api/auth/register").send({
        name: "Adm 2",
        email: "adm2@example.com",
        password: "Password123",
      });
      await request(app).post("/api/auth/register").send({
        name: "Usr 1",
        email: "usr1@example.com",
        password: "Password123",
      });

      await User.updateMany(
        { email: { $in: ["adm1@example.com", "adm2@example.com"] } },
        { $set: { role: "admin" } },
      );

      const list = await adminService.listAdmins();
      expect(list.length).toBe(2);
      expect(list.map((u) => u.email).sort()).toEqual([
        "adm1@example.com",
        "adm2@example.com",
      ]);
    });
  });

  describe("Step-up Authentication: verifyAdminPassword", () => {
    test("đúng mật khẩu admin thì xác nhận thành công và reset login attempts", async () => {
      const reg = await request(app).post("/api/auth/register").send({
        name: "Stepup Admin",
        email: "stepup@example.com",
        password: "AdminPassword123",
      });
      await User.updateOne(
        { email: "stepup@example.com" },
        { $set: { role: "admin", loginAttempts: 2 } },
      );

      const fakeReq = {
        user: { id: reg.body.user.id, coupleId: null, family: "f1" },
        body: { adminPassword: "AdminPassword123" },
      } as unknown as Request;

      const verified = await verifyAdminPassword(fakeReq);
      expect(verified.email).toBe("stepup@example.com");

      const dbUser = await User.findById(reg.body.user.id);
      expect(dbUser?.loginAttempts).toBe(0);
    });

    test("sai mật khẩu admin tăng loginAttempts và ném 403 ADMIN_PASSWORD_INVALID", async () => {
      const reg = await request(app).post("/api/auth/register").send({
        name: "Stepup Admin",
        email: "stepup2@example.com",
        password: "AdminPassword123",
      });
      await User.updateOne(
        { email: "stepup2@example.com" },
        { $set: { role: "admin" } },
      );

      const fakeReq = {
        user: { id: reg.body.user.id, coupleId: null, family: "f1" },
        body: { adminPassword: "WrongPassword!" },
      } as unknown as Request;

      await expect(verifyAdminPassword(fakeReq)).rejects.toMatchObject({
        status: 403,
        code: "ADMIN_PASSWORD_INVALID",
      });

      const dbUser = await User.findById(reg.body.user.id);
      expect(dbUser?.loginAttempts).toBe(1);
    });

    test("sai 5 lần liên tiếp sẽ bị khóa tài khoản 423 ACCOUNT_LOCKED", async () => {
      const reg = await request(app).post("/api/auth/register").send({
        name: "Stepup Admin",
        email: "stepup3@example.com",
        password: "AdminPassword123",
      });
      await User.updateOne(
        { email: "stepup3@example.com" },
        { $set: { role: "admin", loginAttempts: 4 } },
      );

      const fakeReq = {
        user: { id: reg.body.user.id, coupleId: null, family: "f1" },
        body: { adminPassword: "WrongPassword!" },
      } as unknown as Request;

      await expect(verifyAdminPassword(fakeReq)).rejects.toMatchObject({
        status: 423,
        code: "ACCOUNT_LOCKED",
      });

      const dbUser = await User.findById(reg.body.user.id);
      expect(dbUser?.loginAttempts).toBe(5);
      expect(dbUser?.lockUntil).not.toBeNull();
    });
  });
});
