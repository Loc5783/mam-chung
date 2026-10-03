import { Router } from "express";
import { auth } from "../../middlewares/auth";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { idParams, transactionQuery } from "../finance/schema";
import * as schema from "./schema";
import { planningController as c } from "./controller";
export function planningRoutes() {
  const router = Router();
  router.use(
    ["/budgets", "/goals", "/recurring", "/reports", "/transactions/export"],
    auth,
  );
  router.get(
    "/budgets",
    validateQuery(schema.budgetQuery),
    asyncHandler(c.budgets),
  );
  router.post(
    "/budgets",
    validate(schema.budgetCreate),
    asyncHandler(c.createBudget),
  );
  router.put(
    "/budgets/:id",
    validateParams(idParams),
    validate(schema.budgetUpdate),
    asyncHandler(c.updateBudget),
  );
  router.delete(
    "/budgets/:id",
    validateParams(idParams),
    asyncHandler(c.deleteBudget),
  );
  router.get("/goals", validateQuery(schema.emptyQuery), asyncHandler(c.goals));
  router.post(
    "/goals",
    validate(schema.goalCreate),
    asyncHandler(c.createGoal),
  );
  router.put(
    "/goals/:id",
    validateParams(idParams),
    validate(schema.goalUpdate),
    asyncHandler(c.updateGoal),
  );
  router.delete(
    "/goals/:id",
    validateParams(idParams),
    asyncHandler(c.deleteGoal),
  );
  router.post(
    "/goals/:id/contribute",
    validateParams(idParams),
    validate(schema.contributionCreate),
    asyncHandler(c.contribute),
  );
  router.get(
    "/goals/:id/contributions",
    validateParams(idParams),
    validateQuery(schema.contributionQuery),
    asyncHandler(c.contributions),
  );
  router.delete(
    "/goals/:id/contributions/:contributionId",
    validateParams(schema.contributionParams),
    asyncHandler(c.undoContribution),
  );
  router.get(
    "/recurring",
    validateQuery(schema.emptyQuery),
    asyncHandler(c.recurring),
  );
  router.post(
    "/recurring",
    validate(schema.recurringCreate),
    asyncHandler(c.createRecurring),
  );
  router.put(
    "/recurring/:id",
    validateParams(idParams),
    validate(schema.recurringUpdate),
    asyncHandler(c.updateRecurring),
  );
  router.delete(
    "/recurring/:id",
    validateParams(idParams),
    asyncHandler(c.deleteRecurring),
  );
  router.post(
    "/recurring/:id/run",
    validateParams(idParams),
    validate(schema.emptyBody),
    asyncHandler(c.runRecurring),
  );
  router.get(
    "/reports/monthly",
    validateQuery(schema.reportQuery),
    asyncHandler(c.reports),
  );
  router.get(
    "/reports/by-category",
    validateQuery(schema.reportQuery),
    asyncHandler(c.reports),
  );
  router.get(
    "/transactions/export",
    validateQuery(transactionQuery),
    asyncHandler(c.exportCsv),
  );
  return router;
}
