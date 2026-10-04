import { Router } from "express";
import { auth } from "../../middlewares/auth";
import {
  validate,
  validateQuery,
  validateParams,
} from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { idParams } from "../finance/schema";
import * as z from "./schema";
import { notificationService as s } from "./service";
export function notificationRoutes() {
  const r = Router();
  r.use("/notifications", auth);
  r.get(
    "/notifications",
    validateQuery(z.list),
    asyncHandler(async (req, res) =>
      res.json(await s.list(req.user!.id, req.query)),
    ),
  );
  r.patch(
    "/notifications/:id/read",
    validateParams(idParams),
    validateQuery(z.empty),
    validate(z.empty),
    asyncHandler(async (req, res) =>
      res.json(await s.read(req.user!.id, req.params.id, req.body)),
    ),
  );
  r.post(
    "/notifications/read-all",
    validateQuery(z.empty),
    validate(z.empty),
    asyncHandler(async (req, res) =>
      res.json(await s.readAll(req.user!.id, req.body)),
    ),
  );
  return r;
}
