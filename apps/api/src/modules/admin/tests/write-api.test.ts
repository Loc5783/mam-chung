process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/test?replicaSet=rs0";
process.env.JWT_SECRET = "test-secret-longer-than-thirty-two-characters";

import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { createApp } from "../../../app";
import { User } from "../../users/model";
import { Couple, CoupleMember, CoupleInvite } from "../../couples/models";
import { RefreshToken } from "../../auth/model";
import { AdminAuditLog, AppSettings } from "../models";
import { adminService } from "../service";

let replica: MongoMemoryReplSet;
let app: ReturnType<typeof createApp>;
let adminToken: string;
let adminUserId: string;
let normalUserToken: string;
let normalUserRefreshToken: string;
let normalUserId: string;
const ADMIN_PASSWORD = "Password123";

beforeAll(async () => {
  replica = await MongoMemoryReplSet.create({
    binary: { version: "7.0.14" },
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(replica.getUri());
  await Promise.all([
    User.init(),
    Couple.init(),
    CoupleMember.init(),
    CoupleInvite.init(),
    RefreshToken.init(),
    AdminAuditLog.init(),
    AppSettings.init(),
  ]);
}, 180000);

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Couple.deleteMany({}),
    CoupleMember.deleteMany({}),
    CoupleInvite.deleteMany({}),
    RefreshToken.deleteMany({}),
    AdminAuditLog.deleteMany({}),
    AppSettings.deleteMany({}),
  ]);
  app = createApp();

  // Tạo admin
  const adminReg = await request(app).post("/api/auth/register").send({
    name: "Admin Master",
    email: "admin@test.local",
    password: ADMIN_PASSWORD,
  });
  adminToken = adminReg.body.accessToken;
  adminUserId = adminReg.body.user.id;
  await User.updateOne(
    { email: "admin@test.local" },
    { $set: { role: "admin" } },
  );

  // Tạo normal user
  const userReg = await request(app).post("/api/auth/register").send({
    name: "Normal User",
    email: "normal@test.local",
    password: "UserPassword123",
  });
  normalTokenSetup(userReg.body);
});

function normalTokenSetup(body: {
  accessToken: string;
  refreshToken: string;
  user: { id: string };
}) {
  normalUserToken = body.accessToken;
  normalUserRefreshToken = body.refreshToken;
  normalUserId = body.user.id;
}

afterAll(async () => {
  await mongoose.disconnect();
  await replica?.stop();
});

describe("Admin Write API - Giai đoạn 3", () => {
  describe("Xác thực step-up bằng adminPassword", () => {
    test("thiếu adminPassword trả về 403 ADMIN_PASSWORD_INVALID", async () => {
      const res = await request(app)
        .post(`/api/admin/users/${normalUserId}/lock`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ADMIN_PASSWORD_INVALID");
    });

    test("sai adminPassword trả về 403 ADMIN_PASSWORD_INVALID", async () => {
      const res = await request(app)
        .post(`/api/admin/users/${normalUserId}/lock`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ adminPassword: "WrongPassword!" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ADMIN_PASSWORD_INVALID");
    });
  });

  describe("Tự khóa và tự xóa bản thân", () => {
    test("admin tự khóa chính mình trả về 400 CANNOT_LOCK_SELF", async () => {
      const res = await request(app)
        .post(`/api/admin/users/${adminUserId}/lock`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ adminPassword: ADMIN_PASSWORD });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("CANNOT_LOCK_SELF");
    });

    test("admin tự xóa tài khoản của mình trả về 400 CANNOT_DELETE_SELF", async () => {
      const res = await request(app)
        .delete(`/api/admin/users/${adminUserId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ adminPassword: ADMIN_PASSWORD });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("CANNOT_DELETE_SELF");
    });
  });

  describe("Khóa và mở khóa người dùng", () => {
    test("khóa người khác -> token cũ chết ngay, không thể refresh hoặc đăng nhập", async () => {
      // Khóa user
      const lockRes = await request(app)
        .post(`/api/admin/users/${normalUserId}/lock`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ adminPassword: ADMIN_PASSWORD });

      expect(lockRes.status).toBe(200);
      expect(lockRes.body.success).toBe(true);

      // Token cũ gọi API -> 401 hoặc 403
      const checkOldToken = await request(app)
        .get("/api/users/me")
        .set("Authorization", `Bearer ${normalUserToken}`);
      expect([401, 403]).toContain(checkOldToken.status);

      // Refresh token cũ -> 401 hoặc 403
      const refreshRes = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: normalUserRefreshToken });
      expect([401, 403]).toContain(refreshRes.status);

      // Đăng nhập lại -> 403 ACCOUNT_DISABLED
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "normal@test.local", password: "UserPassword123" });
      expect(loginRes.status).toBe(403);
      expect(loginRes.body.error.code).toBe("ACCOUNT_DISABLED");

      // Kiểm tra audit log
      const audit = await AdminAuditLog.findOne({
        action: "lock_user",
        targetId: normalUserId,
      });
      expect(audit).not.toBeNull();
      expect(audit?.adminEmail).toBe("admin@test.local");
    });

    test("mở khóa người dùng -> đăng nhập lại thành công", async () => {
      // Khóa trước
      await request(app)
        .post(`/api/admin/users/${normalUserId}/lock`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ adminPassword: ADMIN_PASSWORD });

      // Mở khóa
      const unlockRes = await request(app)
        .post(`/api/admin/users/${normalUserId}/unlock`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ adminPassword: ADMIN_PASSWORD });

      expect(unlockRes.status).toBe(200);
      expect(unlockRes.body.success).toBe(true);

      // Đăng nhập lại được
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "normal@test.local", password: "UserPassword123" });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.accessToken).toBeDefined();

      // Kiểm tra audit log
      const audit = await AdminAuditLog.findOne({
        action: "unlock_user",
        targetId: normalUserId,
      });
      expect(audit).not.toBeNull();
    });

    test("unlock-login chỉ xóa trạng thái tạm khóa do sai mật khẩu", async () => {
      const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      await User.updateOne(
        { _id: normalUserId },
        { $set: { loginAttempts: 5, lockUntil, disabledAt: new Date() } },
      );

      const res = await request(app)
        .post(`/api/admin/users/${normalUserId}/unlock-login`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ adminPassword: ADMIN_PASSWORD });

      expect(res.status).toBe(200);

      const user = await User.findById(normalUserId);
      expect(user?.loginAttempts).toBe(0);
      expect(user?.lockUntil).toBeNull();
      // disabledAt vẫn được giữ nguyên
      expect(user?.disabledAt).not.toBeNull();
    });
  });

  describe("Đặt lại mật khẩu", () => {
    test("trả về mật khẩu tạm, mật khẩu cũ chết, mật khẩu tạm đăng nhập được", async () => {
      const res = await request(app)
        .post(`/api/admin/users/${normalUserId}/reset-password`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ adminPassword: ADMIN_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.temporaryPassword).toBe("string");
      const tempPass = res.body.temporaryPassword;

      // Mật khẩu cũ không đăng nhập được
      const oldLogin = await request(app)
        .post("/api/auth/login")
        .send({ email: "normal@test.local", password: "UserPassword123" });
      expect(oldLogin.status).toBe(401);

      // Mật khẩu tạm đăng nhập được
      const newLogin = await request(app)
        .post("/api/auth/login")
        .send({ email: "normal@test.local", password: tempPass });
      expect(newLogin.status).toBe(200);
      expect(newLogin.body.accessToken).toBeDefined();

      // Audit log được tạo
      const audit = await AdminAuditLog.findOne({
        action: "reset_password",
        targetId: normalUserId,
      });
      expect(audit).not.toBeNull();
    });
  });

  describe("Xóa mềm người dùng và dọn dẹp cặp đôi", () => {
    test("xóa mềm user độc thân", async () => {
      const res = await request(app)
        .delete(`/api/admin/users/${normalUserId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ adminPassword: ADMIN_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const deleted = await User.findById(normalUserId);
      expect(deleted?.deletedAt).not.toBeNull();
      expect(deleted?.email).toMatch(/^deleted_\d+_normal@test\.local$/);
      expect(deleted?.name).toBe("Tài khoản đã xóa");

      // Audit log
      const audit = await AdminAuditLog.findOne({
        action: "delete_user",
        targetId: normalUserId,
      });
      expect(audit).not.toBeNull();
      expect(audit?.details).toMatchObject({
        originalEmail: "normal@test.local",
      });
    });

    test("xóa mềm user trong cặp có 2 người: owner được chuyển sang member còn lại", async () => {
      // Tạo user thứ 2
      const reg2 = await request(app).post("/api/auth/register").send({
        name: "Partner",
        email: "partner@test.local",
        password: "Password123",
      });
      const partnerId = reg2.body.user.id;
      const partnerToken = reg2.body.accessToken;

      // normalUser tạo couple
      const coupleRes = await request(app)
        .post("/api/couples")
        .set("Authorization", `Bearer ${normalUserToken}`)
        .send({ name: "Tổ Ấm Nhỏ" });
      const coupleId = coupleRes.body.id;

      // Tạo invite và partner tham gia
      const inviteRes = await request(app)
        .post("/api/couples/invite")
        .set("Authorization", `Bearer ${normalUserToken}`);
      const code = inviteRes.body.code;

      await request(app)
        .post("/api/couples/accept")
        .set("Authorization", `Bearer ${partnerToken}`)
        .send({ code });

      // Admin xóa owner (normalUser)
      const delRes = await request(app)
        .delete(`/api/admin/users/${normalUserId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ adminPassword: ADMIN_PASSWORD });

      expect(delRes.status).toBe(200);

      // Cặp vẫn active, nhưng owner mới là partner
      const couple = await Couple.findById(coupleId);
      expect(couple?.status).toBe("active");
      expect(couple?.ownerId.toString()).toBe(partnerId);

      const partnerMember = await CoupleMember.findOne({
        coupleId,
        userId: partnerId,
      });
      expect(partnerMember?.role).toBe("owner");
      expect(partnerMember?.active).toBe(true);

      const deletedMember = await CoupleMember.findOne({
        coupleId,
        userId: normalUserId,
      });
      expect(deletedMember?.active).toBe(false);
    });

    test("xóa mềm user là thành viên duy nhất của cặp: cặp bị lưu trữ", async () => {
      // normalUser tạo couple một mình
      const coupleRes = await request(app)
        .post("/api/couples")
        .set("Authorization", `Bearer ${normalUserToken}`)
        .send({ name: "Không Gian Một Mình" });
      const coupleId = coupleRes.body.id;

      // Xóa user
      const delRes = await request(app)
        .delete(`/api/admin/users/${normalUserId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ adminPassword: ADMIN_PASSWORD });

      expect(delRes.status).toBe(200);

      const couple = await Couple.findById(coupleId);
      expect(couple?.status).toBe("archived");
      expect(couple?.archivedReason).toBe("admin_action");
    });

    test("không thể xóa admin cuối cùng của hệ thống", async () => {
      // adminUserId là admin duy nhất trong DB lúc này
      const dummyAdminId = new mongoose.Types.ObjectId().toString();
      await expect(
        adminService.deleteUser(adminUserId, dummyAdminId, "caller@test.local"),
      ).rejects.toMatchObject({
        status: 400,
        code: "LAST_ADMIN_CANNOT_BE_DELETED",
      });
    });
  });

  describe("Quản lý cặp đôi", () => {
    let coupleId: string;
    let partnerId: string;

    beforeEach(async () => {
      const reg2 = await request(app).post("/api/auth/register").send({
        name: "Partner",
        email: "partner@test.local",
        password: "Password123",
      });
      partnerId = reg2.body.user.id;
      const partnerToken = reg2.body.accessToken;

      const coupleRes = await request(app)
        .post("/api/couples")
        .set("Authorization", `Bearer ${normalUserToken}`)
        .send({ name: "Cặp Đôi Hạnh Phúc" });
      coupleId = coupleRes.body.id;

      const inviteRes = await request(app)
        .post("/api/couples/invite")
        .set("Authorization", `Bearer ${normalUserToken}`);

      await request(app)
        .post("/api/couples/accept")
        .set("Authorization", `Bearer ${partnerToken}`)
        .send({ code: inviteRes.body.code });
    });

    test("archiveCouple lưu trữ cặp đôi và thu hồi invite", async () => {
      const res = await request(app)
        .post(`/api/admin/couples/${coupleId}/archive`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ adminPassword: ADMIN_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const couple = await Couple.findById(coupleId);
      expect(couple?.status).toBe("archived");
      expect(couple?.archivedReason).toBe("admin_action");

      // Thử archive lại lần 2 -> 400
      const retry = await request(app)
        .post(`/api/admin/couples/${coupleId}/archive`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ adminPassword: ADMIN_PASSWORD });
      expect(retry.status).toBe(400);
      expect(retry.body.error.code).toBe("COUPLE_ALREADY_ARCHIVED");
    });

    test("transferOwner sang người không thuộc cặp -> 400 INVALID_MEMBER", async () => {
      const res = await request(app)
        .post(`/api/admin/couples/${coupleId}/transfer-owner`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          newOwnerId: adminUserId, // admin không thuộc cặp này
          adminPassword: ADMIN_PASSWORD,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_MEMBER");
    });

    test("transferOwner sang chính owner hiện tại -> 400 ALREADY_OWNER", async () => {
      const res = await request(app)
        .post(`/api/admin/couples/${coupleId}/transfer-owner`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          newOwnerId: normalUserId, // normalUser đang là owner
          adminPassword: ADMIN_PASSWORD,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("ALREADY_OWNER");
    });

    test("transferOwner sang thành viên hợp lệ -> thành công", async () => {
      const res = await request(app)
        .post(`/api/admin/couples/${coupleId}/transfer-owner`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          newOwnerId: partnerId,
          adminPassword: ADMIN_PASSWORD,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const couple = await Couple.findById(coupleId);
      expect(couple?.ownerId.toString()).toBe(partnerId);

      const partnerMember = await CoupleMember.findOne({
        coupleId,
        userId: partnerId,
      });
      expect(partnerMember?.role).toBe("owner");

      const oldOwnerMember = await CoupleMember.findOne({
        coupleId,
        userId: normalUserId,
      });
      expect(oldOwnerMember?.role).toBe("member");

      // Audit log
      const audit = await AdminAuditLog.findOne({
        action: "transfer_owner",
        targetId: coupleId,
      });
      expect(audit).not.toBeNull();
    });
  });

  describe("Cài đặt hệ thống (Settings)", () => {
    test("GET /settings và PATCH /settings tắt đăng ký mới", async () => {
      // Ban đầu mở đăng ký
      const getRes = await request(app)
        .get("/api/admin/settings")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.registrationOpen).toBe(true);
      expect(getRes.body.allowNewCouples).toBe(true);

      // Tắt đăng ký
      const patchRes = await request(app)
        .patch("/api/admin/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          registrationOpen: false,
          adminPassword: ADMIN_PASSWORD,
        });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.registrationOpen).toBe(false);

      // Thử đăng ký tài khoản mới -> 403 REGISTRATION_CLOSED
      const regRes = await request(app).post("/api/auth/register").send({
        name: "Newbie",
        email: "newbie@test.local",
        password: "Password123",
      });
      expect(regRes.status).toBe(403);
      expect(regRes.body.error.code).toBe("REGISTRATION_CLOSED");

      // Audit log ghi lại
      const audit = await AdminAuditLog.findOne({
        action: "change_setting",
      });
      expect(audit).not.toBeNull();
      expect(audit?.after).toMatchObject({ registrationOpen: false });
    });

    test("PATCH /settings tắt tạo không gian chung mới", async () => {
      const patchRes = await request(app)
        .patch("/api/admin/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          allowNewCouples: false,
          adminPassword: ADMIN_PASSWORD,
        });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.allowNewCouples).toBe(false);

      // Thử tạo couple mới -> 403 COUPLE_CREATION_CLOSED
      const coupleRes = await request(app)
        .post("/api/couples")
        .set("Authorization", `Bearer ${normalUserToken}`)
        .send({ name: "Cặp Đôi Bị Chặn" });
      expect(coupleRes.status).toBe(403);
      expect(coupleRes.body.error.code).toBe("COUPLE_CREATION_CLOSED");
    });
  });
});
