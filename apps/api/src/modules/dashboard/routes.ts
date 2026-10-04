import { Router } from "express";
import { auth } from "../../middlewares/auth";
import { validateQuery } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { dashboardService, dashboardQuery } from "./service";
export function dashboardRoutes() {
  const r = Router();
  r.get(
    "/dashboard",
    auth,
    validateQuery(dashboardQuery),
    asyncHandler(async (req, res) =>
      res.json(await dashboardService.get(req.user!.id, req.query)),
    ),
  );
  return r;
}
