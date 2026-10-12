process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1/test?replicaSet=rs0";
process.env.JWT_SECRET = "test-secret-longer-than-thirty-two-characters";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { createApp } from "../../../app";
import { env } from "../../../config/env";
import { User } from "../../users/model";
import { RefreshToken } from "../../auth/model";
import { coupleModels } from "../../couples/models";
import { taskModels } from "../models";
import type { Request, Response } from "express";
import { errorHandler } from "../../../middlewares/errorHandler";

let db: MongoMemoryReplSet,
  userA: string,
  tokenA: string,
  app: ReturnType<typeof createApp>;

jest.setTimeout(30000);

beforeAll(async () => {
  db = await MongoMemoryReplSet.create({
    binary: { version: "7.0.14" },
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(db.getUri());
  for (const m of [User, RefreshToken, ...coupleModels, ...taskModels]) {
    await m.init();
  }
  app = createApp();
}, 180000);

beforeEach(async () => {
  for (const m of [User, RefreshToken, ...coupleModels, ...taskModels]) {
    await m.collection.deleteMany({});
  }
  const u = await User.create({
    name: "Minh",
    email: "minh@resilience.test",
    passwordHash: "unused",
    timezone: "Asia/Ho_Chi_Minh",
  });
  userA = u.id as string;

  await RefreshToken.create({
    userId: userA,
    tokenHash: randomBytes(32).toString("hex"),
    family: "fam-res",
    securityVersion: 0,
    expiresAt: new Date(Date.now() + 86400000),
  });
  tokenA = jwt.sign({ version: 0, family: "fam-res" }, env.JWT_SECRET, {
    subject: userA,
    issuer: "mam-chung",
    audience: "mam-chung-web",
    expiresIn: "15m",
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await db?.stop();
});

describe("Backend Error Resilience (Phase B3)", () => {
  describe("Mongoose & Database Error Mapping in errorHandler middleware", () => {
    type MockResponse = {
      statusCode: number;
      status: jest.Mock;
      json: jest.Mock;
      body?: {
        error: {
          code: string;
          message: string;
          details?: unknown[];
        };
      };
    };

    function createMockRes(): MockResponse & any {
      const res: any = {
        statusCode: 200,
      };
      res.status = jest.fn((code: number) => {
        res.statusCode = code;
        return res;
      });
      res.json = jest.fn((data: unknown) => {
        res.body = data as MockResponse["body"];
        return res;
      });
      return res;
    }

    it("maps CastError to 400 Bad Request with INVALID_IDENTIFIER", () => {
      const castErr = new mongoose.Error.CastError(
        "ObjectId",
        "invalid-id",
        "taskId",
      );
      const res = createMockRes();

      errorHandler(castErr, {} as Request, res as Response, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body?.error.code).toBe("INVALID_IDENTIFIER");
      expect(res.body?.error.message).toContain("Định dạng mã không hợp lệ");
    });

    it("maps Mongoose ValidationError to 422 Unprocessable Entity", () => {
      const valErr = new mongoose.Error.ValidationError();
      valErr.errors = {
        title: new mongoose.Error.ValidatorError({
          message: "Tiêu đề không được để trống",
          type: "required",
          path: "title",
          value: "",
        }),
      };
      const res = createMockRes();

      errorHandler(valErr, {} as Request, res as Response, jest.fn());

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.body?.error.code).toBe("VALIDATION_ERROR");
      expect(res.body?.error.message).toContain("Dữ liệu không đúng định dạng");
      expect(res.body?.error.details).toHaveLength(1);
    });

    it("maps MongoServerError duplicate key (11000) to 409 Conflict", () => {
      const mongoErr = Object.assign(new Error("E11000 duplicate key error"), {
        name: "MongoServerError",
        code: 11000,
      });
      const res = createMockRes();

      errorHandler(mongoErr, {} as Request, res as Response, jest.fn());

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.body?.error.code).toBe("DUPLICATE_KEY");
      expect(res.body?.error.message).toContain("Dữ liệu đã tồn tại");
    });

    it("maps VersionError to 409 Conflict", () => {
      const versionErr = new mongoose.Error.VersionError(
        {
          _doc: { _id: new mongoose.Types.ObjectId() },
        } as unknown as mongoose.Document,
        1,
        ["title"],
      );
      const res = createMockRes();

      errorHandler(versionErr, {} as Request, res as Response, jest.fn());

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.body?.error.code).toBe("CONFLICT");
      expect(res.body?.error.message).toContain(
        "Dữ liệu đã bị thay đổi bởi người khác",
      );
    });

    it("maps TransientTransactionError to 409 Conflict", () => {
      const transientErr = Object.assign(new Error("WriteConflict"), {
        errorLabels: ["TransientTransactionError"],
      });
      const res = createMockRes();

      errorHandler(transientErr, {} as Request, res as Response, jest.fn());

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.body?.error.code).toBe("TRANSIENT_CONFLICT");
      expect(res.body?.error.message).toContain("Hệ thống đang bận");
    });
  });

  describe("API Route Resilience - No 500s on client data errors", () => {
    it("returns 400 Bad Request (not 500) when taskId parameter is not a valid ObjectId", async () => {
      const res = await request(app)
        .patch("/api/tasks/not-a-valid-uuid-or-oid/status")
        .set("Authorization", "Bearer " + tokenA)
        .send({ status: "DONE", revision: 1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 Bad Request when JSON body is corrupted", async () => {
      const res = await request(app)
        .post("/api/tasks")
        .set("Authorization", "Bearer " + tokenA)
        .set("Content-Type", "application/json")
        .send("{ broken json: ");

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_BODY");
    });
  });
});
