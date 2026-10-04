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
import { fitnessService as s } from "./service";
export function fitnessRoutes() {
  const r = Router();
  r.use(
    [
      "/exercises",
      "/workout-sessions",
      "/workout-sets",
      "/workout-templates",
      "/fitness",
      "/body-metrics",
    ],
    auth,
  );
  r.get(
    "/exercises",
    validateQuery(z.exerciseQuery),
    asyncHandler(async (req, res) =>
      res.json(await s.exercises(req.user!.id, req.query)),
    ),
  );
  r.post(
    "/exercises",
    validate(z.exercise),
    asyncHandler(async (req, res) =>
      res.status(201).json(await s.createExercise(req.user!.id, req.body)),
    ),
  );
  r.put(
    "/exercises/:id",
    validateParams(idParams),
    validate(z.exerciseUpdate),
    asyncHandler(async (req, res) =>
      res.json(await s.updateExercise(req.user!.id, req.params.id, req.body)),
    ),
  );
  r.delete(
    "/exercises/:id",
    validateParams(idParams),
    asyncHandler(async (req, res) => {
      await s.deleteExercise(req.user!.id, req.params.id);
      res.sendStatus(204);
    }),
  );
  r.get(
    "/workout-sessions",
    validateQuery(z.list),
    asyncHandler(async (req, res) =>
      res.json(await s.sessions(req.user!.id, req.query)),
    ),
  );
  r.post(
    "/workout-sessions",
    validate(z.session),
    asyncHandler(async (req, res) =>
      res.status(201).json(await s.createSession(req.user!.id, req.body)),
    ),
  );
  r.get(
    "/workout-sessions/:id",
    validateParams(idParams),
    asyncHandler(async (req, res) =>
      res.json(await s.getSession(req.user!.id, req.params.id)),
    ),
  );
  r.put(
    "/workout-sessions/:id",
    validateParams(idParams),
    validate(z.sessionUpdate),
    asyncHandler(async (req, res) =>
      res.json(await s.updateSession(req.user!.id, req.params.id, req.body)),
    ),
  );
  r.delete(
    "/workout-sessions/:id",
    validateParams(idParams),
    validate(z.remove),
    asyncHandler(async (req, res) => {
      await s.deleteSession(req.user!.id, req.params.id, req.body);
      res.sendStatus(204);
    }),
  );
  r.post(
    "/workout-sets",
    validate(z.set),
    asyncHandler(async (req, res) =>
      res.status(201).json(await s.createSet(req.user!.id, req.body)),
    ),
  );
  r.put(
    "/workout-sets/:id",
    validateParams(idParams),
    validate(z.setUpdate),
    asyncHandler(async (req, res) =>
      res.json(await s.updateSet(req.user!.id, req.params.id, req.body)),
    ),
  );
  r.delete(
    "/workout-sets/:id",
    validateParams(idParams),
    validate(z.remove),
    asyncHandler(async (req, res) => {
      await s.deleteSet(req.user!.id, req.params.id, req.body);
      res.sendStatus(204);
    }),
  );
  r.get(
    "/workout-templates",
    asyncHandler(async (req, res) => res.json(await s.templates(req.user!.id))),
  );
  r.post(
    "/workout-templates",
    validate(z.template),
    asyncHandler(async (req, res) =>
      res.status(201).json(await s.createTemplate(req.user!.id, req.body)),
    ),
  );
  r.put(
    "/workout-templates/:id",
    validateParams(idParams),
    validate(z.templateUpdate),
    asyncHandler(async (req, res) =>
      res.json(await s.updateTemplate(req.user!.id, req.params.id, req.body)),
    ),
  );
  r.delete(
    "/workout-templates/:id",
    validateParams(idParams),
    validate(z.remove),
    asyncHandler(async (req, res) => {
      await s.deleteTemplate(req.user!.id, req.params.id, req.body);
      res.sendStatus(204);
    }),
  );
  r.post(
    "/workout-templates/:id/start",
    validateParams(idParams),
    validate(z.session),
    asyncHandler(async (req, res) =>
      res
        .status(201)
        .json(await s.startTemplate(req.user!.id, req.params.id, req.body)),
    ),
  );
  r.get(
    "/body-metrics",
    validateQuery(z.list),
    asyncHandler(async (req, res) =>
      res.json(await s.bodies(req.user!.id, req.query)),
    ),
  );
  r.post(
    "/body-metrics",
    validate(z.body),
    asyncHandler(async (req, res) =>
      res.status(201).json(await s.createBody(req.user!.id, req.body)),
    ),
  );
  r.put(
    "/body-metrics/:id",
    validateParams(idParams),
    validate(z.bodyUpdate),
    asyncHandler(async (req, res) =>
      res.json(await s.updateBody(req.user!.id, req.params.id, req.body)),
    ),
  );
  r.delete(
    "/body-metrics/:id",
    validateParams(idParams),
    validate(z.remove),
    asyncHandler(async (req, res) => {
      await s.deleteBody(req.user!.id, req.params.id, req.body);
      res.sendStatus(204);
    }),
  );
  r.get(
    "/fitness/goal",
    asyncHandler(async (req, res) => res.json(await s.goal(req.user!.id))),
  );
  r.put(
    "/fitness/goal",
    validate(z.goal),
    asyncHandler(async (req, res) =>
      res.json(await s.updateGoal(req.user!.id, req.body)),
    ),
  );
  r.get(
    "/fitness/last/:exerciseId",
    validateParams(z.progressParams),
    asyncHandler(async (req, res) =>
      res.json(await s.last(req.user!.id, req.params.exerciseId)),
    ),
  );
  for (const part of ["stats", "volume", "rep-distribution", "prs"] as const)
    r.get(
      "/fitness/" + part,
      validateQuery(z.analysis),
      asyncHandler(async (req, res) => {
        const report = await s.analysis(req.user!.id, req.query);
        res.json(
          part === "stats"
            ? report
            : {
                items:
                  part === "volume"
                    ? report.volume
                    : part === "prs"
                      ? report.prs
                      : report.repDistribution,
                from: report.from,
                to: report.to,
              },
        );
      }),
    );
  r.get(
    "/fitness/progress/:exerciseId",
    validateParams(z.progressParams),
    validateQuery(z.analysis),
    asyncHandler(async (req, res) => {
      const report = await s.analysis(req.user!.id, {
        ...req.query,
        exerciseId: req.params.exerciseId,
      });
      res.json({ items: report.progress, from: report.from, to: report.to });
    }),
  );
  return r;
}
