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

let replica: MongoMemoryReplSet;
let app: ReturnType<typeof createApp>;
let adminToken: string;
let normalUserToken: string;
let adminUserId: string;

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
    name: "Admin",
    email: "admin@test.local",
    password: "Password123",
  });
  adminToken = adminReg.body.accessToken;
  adminUserId = adminReg.body.user.id;
  await User.updateOne(
    { email: "admin@test.local" },
    { $set: { role: "admin" } },
  );

  // Tạo user thường
  const userReg = await request(app).post("/api/auth/register").send({
    name: "Normal User",
    email: "user@test.local",
    password: "Password123",
  });
  normalUserToken = userReg.body.accessToken;
});

afterAll(async () => {
  await mongoose.disconnect();
  await replica?.stop();
});

// Hàm quét đệ quy các key JSON trong một object/mảng
function extractAllKeys(obj: unknown): string[] {
  const keys: string[] = [];
  if (obj && typeof obj === "object") {
    if (Array.isArray(obj)) {
      for (const item of obj) {
        keys.push(...extractAllKeys(item));
      }
    } else {
      for (const [k, v] of Object.entries(obj)) {
        keys.push(k);
        keys.push(...extractAllKeys(v));
      }
    }
  }
  return keys;
}

const FORBIDDEN_CONTENT_KEYS = [
  "passwordHash",
  "tokenHash",
  "codeHash",
  "amount",
  "balance",
  "task",
  "tasks",
  "workout",
  "workouts",
  "weight",
  "notes",
  "metric",
  "metrics",
  "checklist",
  "exercises",
  "rpe",
  "sets",
  "debts",
  "settlements",
  "transactions",
  "wallets",
  "budgets",
  "goals",
];

describe("Admin Read API – Giai đoạn 2 (Chỉ siêu dữ liệu, cô lập nội dung)", () => {
  describe("Phân quyền & Chặn truy cập", () => {
    test("người thường bị 403 FORBIDDEN ở tất cả các endpoint đọc admin", async () => {
      const endpoints = [
        "/api/admin/overview",
        "/api/admin/users",
        "/api/admin/couples",
        "/api/admin/audit",
      ];
      for (const endpoint of endpoints) {
        const res = await request(app)
          .get(endpoint)
          .set("Authorization", `Bearer ${normalUserToken}`);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("FORBIDDEN");
      }
    });

    test("người chưa đăng nhập bị 401 UNAUTHORIZED", async () => {
      const res = await request(app).get("/api/admin/overview");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /api/admin/overview (2.1)", () => {
    test("trả về đúng các chỉ số đếm siêu dữ liệu và trạng thái đăng ký", async () => {
      // Tạo thêm một số user
      const user2 = await request(app).post("/api/auth/register").send({
        name: "User 2",
        email: "user2@test.local",
        password: "Password123",
      });
      const user3 = await request(app).post("/api/auth/register").send({
        name: "User 3",
        email: "user3@test.local",
        password: "Password123",
      });

      // Khóa user2
      await User.updateOne(
        { _id: user2.body.user.id },
        { $set: { disabledAt: new Date() } },
      );

      // Xóa mềm user3
      await User.updateOne(
        { _id: user3.body.user.id },
        { $set: { deletedAt: new Date() } },
      );

      // Tạo couples: 1 active, 1 archived
      await Couple.create([
        {
          name: "Couple A",
          ownerId: new mongoose.Types.ObjectId(),
          status: "active",
        },
        {
          name: "Couple B",
          ownerId: new mongoose.Types.ObjectId(),
          status: "archived",
        },
      ]);

      const res = await request(app)
        .get("/api/admin/overview")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        totalUsers: 3, // admin, normalUser, user2 (user3 đã xóa mềm)
        activeUsers7d: 0, // chưa ai đăng nhập qua /api/auth/login trong 7 ngày
        disabledUsers: 1, // user2
        newUsers7d: 3, // admin, normalUser, user2
        activeCouples: 1,
        archivedCouples: 1,
        registrationOpen: true,
      });
    });
  });

  describe("GET /api/admin/users (2.2)", () => {
    beforeEach(async () => {
      // Chuẩn bị dữ liệu mẫu
      const couple = await Couple.create({
        name: "Gia đình Mầm",
        ownerId: new mongoose.Types.ObjectId(),
        status: "active",
      });

      await User.create([
        {
          name: "Nguyễn Văn An",
          email: "an.nguyen@example.com",
          passwordHash: "hash123",
          role: "user",
          coupleId: couple._id,
          lastLoginAt: new Date(),
        },
        {
          name: "Trần Thị Bình",
          email: "binh.tran@example.com",
          passwordHash: "hash123",
          role: "user",
          disabledAt: new Date(),
        },
        {
          name: "Lê Văn Cường",
          email: "cuong.le@example.com",
          passwordHash: "hash123",
          role: "user",
          deletedAt: new Date(),
        },
      ]);
    });

    test("trả về đầy đủ các trường DTO cho phép, không lộ thông tin nhạy cảm", async () => {
      const res = await request(app)
        .get("/api/admin/users?query=an.nguyen")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(1);
      const userItem = res.body.items[0];

      expect(userItem).toMatchObject({
        email: "an.nguyen@example.com",
        name: "Nguyễn Văn An",
        status: "active",
        coupleName: "Gia đình Mầm",
        coupleStatus: "active",
        role: "user",
      });
      expect(userItem.id).toBeDefined();
      expect(userItem.createdAt).toBeDefined();
      expect(userItem.lastLoginAt).toBeDefined();

      // Không bao giờ có passwordHash, securityVersion
      expect(
        (userItem as Record<string, unknown>).passwordHash,
      ).toBeUndefined();
      expect(
        (userItem as Record<string, unknown>).securityVersion,
      ).toBeUndefined();
    });

    test("tìm kiếm với ký tự đặc biệt / regex không làm hỏng hay treo hệ thống", async () => {
      const trickyQueries = [
        ".*",
        "[a-z]+",
        "\\",
        "^an$",
        "(test|admin)",
        "+?{}",
      ];

      for (const query of trickyQueries) {
        const res = await request(app)
          .get(`/api/admin/users?query=${encodeURIComponent(query)}`)
          .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.items)).toBe(true);
      }
    });

    test("lọc theo status (active, disabled, deleted, all) hoạt động chính xác", async () => {
      const resActive = await request(app)
        .get("/api/admin/users?status=active")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(
        resActive.body.items.every(
          (u: { status: string }) => u.status === "active",
        ),
      ).toBe(true);

      const resDisabled = await request(app)
        .get("/api/admin/users?status=disabled")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(
        resDisabled.body.items.every(
          (u: { status: string }) => u.status === "disabled",
        ),
      ).toBe(true);

      const resDeleted = await request(app)
        .get("/api/admin/users?status=deleted")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(
        resDeleted.body.items.every(
          (u: { status: string }) => u.status === "deleted",
        ),
      ).toBe(true);
    });

    test("NoSQL injection dạng ?email[$ne]=x bị từ chối 400 (Zod strict)", async () => {
      const res = await request(app)
        .get("/api/admin/users?email[$ne]=admin@test.local")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    test("phân trang hoạt động chính xác (page, limit, total, totalPages)", async () => {
      const res = await request(app)
        .get("/api/admin/users?page=1&limit=2")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(2);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(2);
      expect(res.body.total).toBeGreaterThanOrEqual(5);
      expect(res.body.totalPages).toBe(Math.ceil(res.body.total / 2));
    });
  });

  describe("GET /api/admin/couples (2.3)", () => {
    beforeEach(async () => {
      const couple1 = await Couple.create({
        name: "Cặp Đôi Hạnh Phúc",
        ownerId: new mongoose.Types.ObjectId(),
        status: "active",
      });

      await CoupleMember.create([
        {
          coupleId: couple1._id,
          userId: new mongoose.Types.ObjectId(),
          role: "owner",
          nameSnapshot: "Thành Viên A",
          active: true,
        },
        {
          coupleId: couple1._id,
          userId: new mongoose.Types.ObjectId(),
          role: "member",
          nameSnapshot: "Thành Viên B",
          active: true,
        },
      ]);

      await CoupleInvite.create({
        coupleId: couple1._id,
        createdBy: new mongoose.Types.ObjectId(),
        codeHash: "secret_invite_hash",
        status: "active",
        expiresAt: new Date(Date.now() + 86400000),
      });
    });

    test("trả về đúng siêu dữ liệu cặp đôi, không có số tiền/công việc/số đo", async () => {
      const res = await request(app)
        .get("/api/admin/couples")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(1);
      const coupleItem = res.body.items[0];

      expect(coupleItem).toMatchObject({
        name: "Cặp Đôi Hạnh Phúc",
        status: "active",
        memberCount: 2,
        activeInviteCount: 1,
      });
      expect(coupleItem.members).toEqual([
        {
          userId: expect.any(String),
          name: "Thành Viên A",
          role: "owner",
          active: true,
        },
        {
          userId: expect.any(String),
          name: "Thành Viên B",
          role: "member",
          active: true,
        },
      ]);
      expect((coupleItem as Record<string, unknown>).codeHash).toBeUndefined();
    });
  });

  describe("GET /api/admin/audit (2.4)", () => {
    test("trả về danh sách nhật ký thao tác sắp xếp mới nhất trước", async () => {
      await AdminAuditLog.create([
        {
          adminId: new mongoose.Types.ObjectId(adminUserId),
          adminEmail: "admin@test.local",
          action: "admin_grant",
          targetType: "user",
          targetId: "user-123",
          details: { reason: "Cấp quyền thử nghiệm" },
          createdAt: new Date(Date.now() - 60000),
        },
        {
          adminId: new mongoose.Types.ObjectId(adminUserId),
          adminEmail: "admin@test.local",
          action: "lock_user",
          targetType: "user",
          targetId: "user-456",
          createdAt: new Date(),
        },
      ]);

      const res = await request(app)
        .get("/api/admin/audit")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(2);
      expect(res.body.items[0].action).toBe("lock_user");
      expect(res.body.items[1].action).toBe("admin_grant");
    });
  });

  describe("Quyền riêng tư tuyệt đối (2.5 – Quét toàn bộ khóa JSON)", () => {
    test("quét mọi response của các endpoint admin để chứng minh không có khóa nội dung riêng tư nào", async () => {
      const endpoints = [
        "/api/admin/overview",
        "/api/admin/users",
        "/api/admin/couples",
        "/api/admin/audit",
      ];

      for (const endpoint of endpoints) {
        const res = await request(app)
          .get(endpoint)
          .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBe(200);

        const keys = extractAllKeys(res.body);
        const leakedKeys = keys.filter((key) =>
          FORBIDDEN_CONTENT_KEYS.includes(key),
        );

        expect(leakedKeys).toEqual([]);
      }
    });
  });
});
