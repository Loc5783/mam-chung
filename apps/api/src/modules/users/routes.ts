import { Router } from "express";
import { auth } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { userController } from "./controller";
import { profileSchema } from "./schema";
import { deleteUserSchema } from "../auth/schema";
export function userRoutes() {
  const router = Router();
  router.use(auth);
  router.get("/me", asyncHandler(userController.me));
  router.put(
    "/me",
    validate(profileSchema),
    asyncHandler(userController.update),
  );
  router.delete(
    "/me",
    validate(deleteUserSchema),
    asyncHandler(userController.remove),
  );
  return router;
}
