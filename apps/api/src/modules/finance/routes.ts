import { Router } from "express";
import { auth } from "../../middlewares/auth";
import {
  validate,
  validateQuery,
  validateParams,
} from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import * as schema from "./schema";
import { financeController as c } from "./controller";
export function financeRoutes() {
  const router = Router();
  router.use(["/wallets", "/categories", "/transactions", "/finance"], auth);
  router.get(
    "/wallets",
    validateQuery(schema.walletQuery),
    asyncHandler(c.wallets),
  );
  router.post(
    "/wallets",
    validate(schema.walletCreate),
    asyncHandler(c.createWallet),
  );
  router.post(
    "/wallets/transfer",
    validate(schema.transferCreate),
    asyncHandler(c.transfer),
  );
  router.get(
    "/wallets/:id",
    validateParams(schema.idParams),
    asyncHandler(c.wallet),
  );
  router.put(
    "/wallets/:id",
    validateParams(schema.idParams),
    validate(schema.walletUpdate),
    asyncHandler(c.updateWallet),
  );
  router.delete(
    "/wallets/:id",
    validateParams(schema.idParams),
    asyncHandler(c.deleteWallet),
  );
  router.post(
    "/wallets/:id/reconcile",
    validateParams(schema.idParams),
    validate(schema.reconcileSchema),
    asyncHandler(c.reconcile),
  );
  router.get(
    "/categories",
    validateQuery(schema.categoryQuery),
    asyncHandler(c.categories),
  );
  router.post(
    "/categories",
    validate(schema.categoryCreate),
    asyncHandler(c.createCategory),
  );
  router.put(
    "/categories/:id",
    validateParams(schema.idParams),
    validate(schema.categoryUpdate),
    asyncHandler(c.updateCategory),
  );
  router.delete(
    "/categories/:id",
    validateParams(schema.idParams),
    validate(schema.categoryDelete),
    asyncHandler(c.deleteCategory),
  );
  router.get(
    "/transactions",
    validateQuery(schema.transactionQuery),
    asyncHandler(c.transactions),
  );
  router.post(
    "/transactions",
    validate(schema.transactionCreate),
    asyncHandler(c.createTransaction),
  );
  router.get(
    "/transactions/:id",
    validateParams(schema.idParams),
    asyncHandler(c.transaction),
  );
  router.put(
    "/transactions/:id",
    validateParams(schema.idParams),
    validate(schema.transactionUpdate),
    asyncHandler(c.updateTransaction),
  );
  router.delete(
    "/transactions/:id",
    validateParams(schema.idParams),
    asyncHandler(c.deleteTransaction),
  );
  router.post(
    "/transactions/:id/duplicate",
    validateParams(schema.idParams),
    validate(schema.duplicateSchema),
    asyncHandler(c.duplicate),
  );
  router.get("/finance/dashboard", asyncHandler(c.dashboard));
  return router;
}
