import { Router } from "express";
import { auth } from "../../middlewares/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAdmin, adminLimiter } from "./middleware";
import { adminController } from "./controller";

export function adminRoutes() {
  const router = Router();
  router.use(adminLimiter);
  router.use(auth);
  router.use(requireAdmin);

  router.get("/overview", asyncHandler(adminController.overview));

  router.get("/users", asyncHandler(adminController.users));
  router.post("/users/:id/lock", asyncHandler(adminController.lockUser));
  router.post("/users/:id/unlock", asyncHandler(adminController.unlockUser));
  router.post(
    "/users/:id/unlock-login",
    asyncHandler(adminController.unlockLogin),
  );
  router.delete("/users/:id", asyncHandler(adminController.deleteUser));
  router.post(
    "/users/:id/reset-password",
    asyncHandler(adminController.resetPassword),
  );

  router.get("/couples", asyncHandler(adminController.couples));
  router.post(
    "/couples/:id/archive",
    asyncHandler(adminController.archiveCouple),
  );
  router.post(
    "/couples/:id/transfer-owner",
    asyncHandler(adminController.transferCoupleOwner),
  );

  router.get("/settings", asyncHandler(adminController.getSettings));
  router.patch("/settings", asyncHandler(adminController.updateSettings));

  router.get("/audit", asyncHandler(adminController.audit));
  router.get("/ping", (_req, res) => {
    res.json({ ok: true, admin: true });
  });

  return router;
}
