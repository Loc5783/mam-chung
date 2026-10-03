import { Router } from "express";
import rateLimit from "express-rate-limit";
import { auth } from "../../middlewares/auth";
import {
  validate,
  validateQuery,
  validateParams,
} from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { idParams } from "../finance/schema";
import * as s from "./schema";
import { coupleController as c } from "./controller";
export function coupleRoutes() {
  const r = Router();
  r.use("/couples", auth);
  r.use("/couples", (req, res, next) => {
    if (["GET", "HEAD"].includes(req.method)) return next();
    validateQuery(s.empty)(req, res, next);
  });
  const limited = rateLimit({
    windowMs: 60000,
    limit: 10,
    keyGenerator: (req) => req.user!.id,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: {
        code: "INVITE_RATE_LIMITED",
        message: "Bạn đã thử nhiều mã mời. Vui lòng đợi một phút.",
      },
    },
  });
  r.post("/couples", validate(s.createSchema), asyncHandler(c.create));
  r.get("/couples/me", validateQuery(s.empty), asyncHandler(c.me));
  r.put("/couples/me", validate(s.updateSchema), asyncHandler(c.update));
  r.post("/couples/invite", limited, validate(s.empty), asyncHandler(c.invite));
  r.delete("/couples/invite", validate(s.empty), asyncHandler(c.revoke));
  r.get(
    "/couples/invite/:code",
    limited,
    validateParams(s.codeParams),
    validateQuery(s.empty),
    asyncHandler(c.preview),
  );
  r.post(
    "/couples/accept",
    limited,
    validate(s.acceptSchema),
    asyncHandler(c.accept),
  );
  r.post(
    "/couples/transfer-owner",
    validate(s.transferSchema),
    asyncHandler(c.transfer),
  );
  r.delete("/couples/leave", validate(s.leaveSchema), asyncHandler(c.leave));
  r.get(
    "/couples/archives",
    validateQuery(s.listQuery),
    asyncHandler(c.archives),
  );
  r.get(
    "/couples/archives/:id",
    validateParams(idParams),
    validateQuery(s.empty),
    asyncHandler(c.archived),
  );
  r.get(
    "/couples/activity",
    validateQuery(s.activityQuery),
    asyncHandler(c.activity),
  );
  return r;
}
