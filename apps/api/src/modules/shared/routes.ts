import { requireCouple } from "../../middlewares/requireCouple";
import { Router } from "express";
import { auth } from "../../middlewares/auth";
import {
  validate,
  validateQuery,
  validateParams,
} from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { idParams } from "../finance/schema";
import * as schema from "./schema";
import { sharedService as s } from "./service";
export function sharedRoutes() {
  const r = Router();
  r.use(
    [
      "/shared-wallets",
      "/shared-transactions",
      "/settlements",
      "/shared-goals",
      "/shared/dashboard",
    ],
    auth,
    (req, res, next) =>
      ["GET", "HEAD", "OPTIONS"].includes(req.method)
        ? next()
        : requireCouple(req, res, next),
  );
  r.get(
    "/shared-wallets",
    validateQuery(schema.contextQuery),
    asyncHandler(async (req, res) =>
      res.json(await s.wallets(req.user!.id, req.query)),
    ),
  );
  r.post(
    "/shared-wallets",
    validate(schema.walletCreate),
    asyncHandler(async (req, res) =>
      res.status(201).json(await s.createWallet(req.user!.id, req.body)),
    ),
  );
  r.put(
    "/shared-wallets/:id",
    validateParams(idParams),
    validate(schema.walletUpdate),
    asyncHandler(async (req, res) =>
      res.json(await s.updateWallet(req.user!.id, req.params.id, req.body)),
    ),
  );
  r.delete(
    "/shared-wallets/:id",
    validateParams(idParams),
    asyncHandler(async (req, res) => {
      await s.deleteWallet(req.user!.id, req.params.id);
      res.sendStatus(204);
    }),
  );
  r.post(
    "/shared-wallets/:id/contribute",
    validateParams(idParams),
    validate(schema.contribution),
    asyncHandler(async (req, res) =>
      res
        .status(201)
        .json(await s.contribute(req.user!.id, req.params.id, req.body)),
    ),
  );
  r.get(
    "/shared-wallets/:id/contributions",
    validateParams(idParams),
    validateQuery(schema.listQuery),
    asyncHandler(async (req, res) =>
      res.json(await s.contributions(req.user!.id, req.params.id, req.query)),
    ),
  );
  r.get(
    "/shared-transactions",
    validateQuery(schema.listQuery),
    asyncHandler(async (req, res) =>
      res.json(await s.transactions(req.user!.id, req.query)),
    ),
  );
  r.post(
    "/shared-transactions",
    validate(schema.transactionCreateSchema),
    asyncHandler(async (req, res) =>
      res.status(201).json(await s.createTransaction(req.user!.id, req.body)),
    ),
  );
  r.get(
    "/shared-transactions/:id",
    validateParams(idParams),
    validateQuery(schema.contextQuery),
    asyncHandler(async (req, res) =>
      res.json(await s.transaction(req.user!.id, req.params.id, req.query)),
    ),
  );
  r.delete(
    "/shared-transactions/:id",
    validateParams(idParams),
    asyncHandler(async (req, res) => {
      await s.deleteTransaction(req.user!.id, req.params.id);
      res.sendStatus(204);
    }),
  );
  r.get(
    "/settlements/summary",
    validateQuery(schema.contextQuery),
    asyncHandler(async (req, res) =>
      res.json(await s.summary(req.user!.id, req.query)),
    ),
  );
  r.get(
    "/settlements",
    validateQuery(schema.listQuery),
    asyncHandler(async (req, res) =>
      res.json(await s.settlements(req.user!.id, req.query)),
    ),
  );
  for (const mode of ["mark-paid", "confirm", "reject"] as const)
    r.put(
      `/settlements/:id/${mode}`,
      validateParams(idParams),
      validate(schema.action),
      asyncHandler(async (req, res) =>
        res.json(
          await s.settlementAction(req.user!.id, req.params.id, mode, req.body),
        ),
      ),
    );
  r.get(
    "/shared-goals",
    validateQuery(schema.contextQuery),
    asyncHandler(async (req, res) =>
      res.json(await s.goals(req.user!.id, req.query)),
    ),
  );
  r.post(
    "/shared-goals",
    validate(schema.goalCreate),
    asyncHandler(async (req, res) =>
      res.status(201).json(await s.createGoal(req.user!.id, req.body)),
    ),
  );
  r.put(
    "/shared-goals/:id",
    validateParams(idParams),
    validate(schema.goalUpdate),
    asyncHandler(async (req, res) =>
      res.json(await s.updateGoal(req.user!.id, req.params.id, req.body)),
    ),
  );
  r.delete(
    "/shared-goals/:id",
    validateParams(idParams),
    asyncHandler(async (req, res) => {
      await s.deleteGoal(req.user!.id, req.params.id);
      res.sendStatus(204);
    }),
  );
  r.post(
    "/shared-goals/:id/contribute",
    validateParams(idParams),
    validate(schema.contribution),
    asyncHandler(async (req, res) =>
      res
        .status(201)
        .json(await s.contributeGoal(req.user!.id, req.params.id, req.body)),
    ),
  );
  r.get(
    "/shared-goals/:id/contributions",
    validateParams(idParams),
    validateQuery(schema.listQuery),
    asyncHandler(async (req, res) =>
      res.json(
        await s.goalContributions(req.user!.id, req.params.id, req.query),
      ),
    ),
  );
  r.delete(
    "/shared-goals/:id/contributions/:contributionId",
    validateParams(schema.undoParams),
    asyncHandler(async (req, res) => {
      await s.undoGoal(req.user!.id, req.params.id, req.params.contributionId);
      res.sendStatus(204);
    }),
  );
  r.get(
    "/shared/dashboard",
    validateQuery(schema.contextQuery),
    asyncHandler(async (req, res) =>
      res.json(await s.dashboard(req.user!.id, req.query)),
    ),
  );
  return r;
}
