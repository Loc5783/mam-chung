process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/test?replicaSet=rs0";
process.env.JWT_SECRET = "test-secret-longer-than-thirty-two-characters";

import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { User } from "../../users/model";
import { AppSettings, AdminAuditLog } from "../models";
import { adminService } from "../service";

let replica: MongoMemoryReplSet;

beforeAll(async () => {
  replica = await MongoMemoryReplSet.create({
    binary: { version: "7.0.14" },
    instanceOpts: [{ ip: "127.0.0.1" }],
    replSet: { count: 1, storageEngine: "wiredTiger", ip: "127.0.0.1" },
  });
  await mongoose.connect(replica.getUri());
  await Promise.all([
    User.init(),
    AdminAuditLog.init(),
    AppSettings.init(),
  ]);
}, 180000);

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    AdminAuditLog.deleteMany({}),
    AppSettings.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replica?.stop();
});

describe("Bảo vệ quản trị viên cuối cùng (Invariant Hardening)", () => {
  test("không thể khóa admin hoạt động cuối cùng của hệ thống", async () => {
    const [admin] = await User.create([
      {
        name: "Admin Sole",
        email: "sole_admin@test.local",
        passwordHash: "hash123",
        role: "admin",
      },
    ]);

    const dummyCallerId = new mongoose.Types.ObjectId().toString();
    await expect(
      adminService.lockUser(admin.id, dummyCallerId, "caller@test.local"),
    ).rejects.toMatchObject({
      status: 400,
      code: "LAST_ADMIN_CANNOT_BE_LOCKED",
    });

    const refreshed = await User.findById(admin._id);
    expect(refreshed?.disabledAt).toBeNull();
  });

  test("không thể xóa hoặc revoke admin có thể đăng nhập cuối cùng khi có admin khác bị disabled", async () => {
    const [activeAdmin, disabledAdmin] = await User.create([
      {
        name: "Active Admin",
        email: "active_admin@test.local",
        passwordHash: "hash123",
        role: "admin",
      },
      {
        name: "Disabled Admin",
        email: "disabled_admin@test.local",
        passwordHash: "hash123",
        role: "admin",
        disabledAt: new Date(),
      },
    ]);

    const dummyCallerId = new mongoose.Types.ObjectId().toString();

    // Thử xóa admin đang active duy nhất -> từ chối
    await expect(
      adminService.deleteUser(activeAdmin.id, dummyCallerId, "caller@test.local"),
    ).rejects.toMatchObject({
      status: 400,
      code: "LAST_ADMIN_CANNOT_BE_DELETED",
    });

    // Thử revoke admin đang active duy nhất -> từ chối
    await expect(
      adminService.revokeAdminRole("active_admin@test.local"),
    ).rejects.toMatchObject({
      status: 400,
      code: "LAST_ADMIN_CANNOT_BE_REVOKED",
    });

    // Nhưng có thể revoke/xóa admin bị disabled vì vẫn còn admin active
    const revokeDisabled = await adminService.revokeAdminRole("disabled_admin@test.local");
    expect(revokeDisabled.changed).toBe(true);

    const refreshedDisabled = await User.findById(disabledAdmin._id);
    expect(refreshedDisabled?.role).toBe("user");
  });

  test("thao tác revoke đồng thời chỉ một thao tác thành công khi còn đúng 2 admin", async () => {
    await User.create([
      {
        name: "Admin 1",
        email: "admin1@test.local",
        passwordHash: "hash123",
        role: "admin",
      },
      {
        name: "Admin 2",
        email: "admin2@test.local",
        passwordHash: "hash123",
        role: "admin",
      },
    ]);

    const [res1, res2] = await Promise.allSettled([
      adminService.revokeAdminRole("admin1@test.local"),
      adminService.revokeAdminRole("admin2@test.local"),
    ]);

    const fulfilled = [res1, res2].filter((r) => r.status === "fulfilled");
    const rejected = [res1, res2].filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const remainingAdmins = await User.countDocuments({
      role: "admin",
      deletedAt: null,
    });
    expect(remainingAdmins).toBe(1);
  });

  test("thao tác delete đồng thời chỉ một thao tác thành công khi còn đúng 2 admin", async () => {
    const [admin1, admin2] = await User.create([
      {
        name: "Admin A",
        email: "adminA@test.local",
        passwordHash: "hash123",
        role: "admin",
      },
      {
        name: "Admin B",
        email: "adminB@test.local",
        passwordHash: "hash123",
        role: "admin",
      },
    ]);

    const callerId = new mongoose.Types.ObjectId().toString();

    const [res1, res2] = await Promise.allSettled([
      adminService.deleteUser(admin1.id, callerId, "caller@test.local"),
      adminService.deleteUser(admin2.id, callerId, "caller@test.local"),
    ]);

    const fulfilled = [res1, res2].filter((r) => r.status === "fulfilled");
    const rejected = [res1, res2].filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const remainingAdmins = await User.countDocuments({
      role: "admin",
      deletedAt: null,
    });
    expect(remainingAdmins).toBe(1);
  });
});
