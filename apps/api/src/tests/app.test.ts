process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/test?replicaSet=rs0";
process.env.JWT_SECRET = "test-secret-longer-than-thirty-two-characters";
import request from "supertest";
import { app } from "../app";
import { requireMoney, splitEqual } from "../utils/money";
describe("Nền tảng API", () => {
  test("báo chưa sẵn sàng khi DB chưa kết nối", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body.database).toBe("disconnected");
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
});
