process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/test?replicaSet=rs0";
process.env.JWT_SECRET = "test-secret-longer-than-thirty-two-characters";
import request from "supertest";
import { app, createApp } from "../app";
import { env } from "../config/env";
import { requireMoney, splitEqual } from "../utils/money";
describe("Nền tảng API", () => {
  test("Swagger gọi đúng tiền tố API cho tất cả nhóm nghiệp vụ", async () => {
    const res = await request(app).get("/api/openapi.json");
    expect(res.status).toBe(200);
    expect(
      Object.keys(res.body.paths).every((path) => path.startsWith("/api/")),
    ).toBe(true);
    for (const path of [
      "/api/wallets",
      "/api/transactions",
      "/api/budgets",
      "/api/couples",
      "/api/shared-wallets",
      "/api/tasks",
      "/api/exercises",
      "/api/dashboard",
      "/api/notifications",
    ]) {
      expect(res.body.paths[path]).toBeDefined();
    }
    expect(res.body.paths["/api/wallets"].post.security).toEqual([
      { bearerAuth: [] },
    ]);
    expect(
      res.body.paths["/api/health"].get.responses["200"].content[
        "application/json"
      ].schema.$ref,
    ).toBe("#/components/schemas/Health");
  });
  test("báo chưa sẵn sàng khi DB chưa kết nối", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body.database).toBe("disconnected");
    expect(res.body.phase).toBe(10);
    expect(res.body.development).toBe(false);
  });
  test("lỗi 404 thống nhất", async () => {
    const res = await request(app).get("/api/missing");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
  test("không nhận tiền lẻ hoặc số không an toàn", () => {
    expect(() => requireMoney(1.5)).toThrow();
    expect(() => requireMoney(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });
  test("phần dư khi chia tiền thuộc payer", () => {
    expect(splitEqual(101, "a", "b")).toEqual([
      { userId: "a", shareAmount: 51 },
      { userId: "b", shareAmount: 50 },
    ]);
  });
  type MutableEnv = {
    NODE_ENV: "development" | "test" | "production";
    ENABLE_API_DOCS: boolean;
  };
  const envMutable = env as unknown as MutableEnv;

  test("production: /api/health chỉ trả { status: ... }, không lộ phase hay thông tin nội bộ", async () => {
    const originalEnv = env.NODE_ENV;
    envMutable.NODE_ENV = "production";
    try {
      const prodApp = createApp();
      const res = await request(prodApp).get("/api/health");
      expect([200, 503]).toContain(res.status);
      expect(res.body.status).toBeDefined();
      expect(res.body.phase).toBeUndefined();
      expect(res.body.database).toBeUndefined();
      expect(res.body.development).toBeUndefined();
    } finally {
      envMutable.NODE_ENV = originalEnv;
    }
  });
  test("production: /api/docs và /api/openapi.json mặc định trả 404 khi không bật ENABLE_API_DOCS", async () => {
    const originalEnv = env.NODE_ENV;
    const originalDocs = env.ENABLE_API_DOCS;
    envMutable.NODE_ENV = "production";
    envMutable.ENABLE_API_DOCS = false;
    try {
      const prodApp = createApp();
      const docsRes = await request(prodApp).get("/api/docs");
      expect(docsRes.status).toBe(404);

      const openapiRes = await request(prodApp).get("/api/openapi.json");
      expect(openapiRes.status).toBe(404);
    } finally {
      envMutable.NODE_ENV = originalEnv;
      envMutable.ENABLE_API_DOCS = originalDocs;
    }
  });
  test("production: /api/docs mở lại khi ENABLE_API_DOCS=true", async () => {
    const originalEnv = env.NODE_ENV;
    const originalDocs = env.ENABLE_API_DOCS;
    envMutable.NODE_ENV = "production";
    envMutable.ENABLE_API_DOCS = true;
    try {
      const prodApp = createApp();
      const openapiRes = await request(prodApp).get("/api/openapi.json");
      expect(openapiRes.status).toBe(200);
    } finally {
      envMutable.NODE_ENV = originalEnv;
      envMutable.ENABLE_API_DOCS = originalDocs;
    }
  });
});
