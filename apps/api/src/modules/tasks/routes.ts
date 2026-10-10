import {
  taskExtras,
  timeInput,
  templateInput,
  applyInput,
  reminderInput,
  scopeInput,
} from "./extensions";
import { taskStatsService, statsQuery } from "./stats";
import { pagination } from "../finance/schema";
import { z as validator } from "zod";
import {
  taskListService as lists,
  listCreate,
  listUpdate,
  listQuery,
  listDelete,
  reorderInput,
} from "./lists";
import { taskOperations, bulkInput, bulkUndoInput } from "./operations";
import { Router } from "express";
import { auth } from "../../middlewares/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  validate,
  validateQuery,
  validateParams,
} from "../../middlewares/validate";
import { idParams } from "../finance/schema";
import * as z from "./schema";
import { taskService as s } from "./service";
export function taskRoutes() {
  const r = Router();
  r.use(["/tasks", "/task-lists", "/task-templates"], auth);
  r.post(
    "/tasks/:id/scope",
    validateParams(idParams),
    validate(scopeInput),
    asyncHandler(async (req, res) =>
      res.json(await taskExtras.scope(req.user!.id, req.params.id, req.body)),
    ),
  );
  r.post(
    "/tasks/:id/reminder",
    validateParams(idParams),
    validate(reminderInput),
    asyncHandler(async (req, res) =>
      res.json(
        await taskExtras.reminder(req.user!.id, req.params.id, req.body),
      ),
    ),
  );
  r.get(
    "/task-templates",
    validateQuery(pagination),
    asyncHandler(async (req, res) =>
      res.json(await taskExtras.templates(req.user!.id, req.query)),
    ),
  );
  r.post(
    "/task-templates",
    validate(templateInput),
    asyncHandler(async (req, res) =>
      res
        .status(201)
        .json(await taskExtras.saveTemplate(req.user!.id, req.body)),
    ),
  );
  r.post(
    "/task-templates/:id/apply",
    validateParams(idParams),
    validate(applyInput),
    asyncHandler(async (req, res) =>
      res
        .status(201)
        .json(
          await taskExtras.applyTemplate(req.user!.id, req.params.id, req.body),
        ),
    ),
  );
  r.get(
    "/tasks/:id/activity",
    validateParams(idParams),
    validateQuery(pagination),
    asyncHandler(async (req, res) =>
      res.json(
        await taskExtras.activity(req.user!.id, req.params.id, req.query),
      ),
    ),
  );
  r.post(
    "/tasks/:id/time",
    validateParams(idParams),
    validate(timeInput),
    asyncHandler(async (req, res) =>
      res.json(await taskExtras.time(req.user!.id, req.params.id, req.body)),
    ),
  );
  r.post(
    "/tasks/:id/nudge",
    validateParams(idParams),
    validate(validator.object({}).strict()),
    asyncHandler(async (req, res) =>
      res.json(await taskExtras.nudge(req.user!.id, req.params.id, req.body)),
    ),
  );
  r.post(
    "/tasks/:id/duplicate",
    validateParams(idParams),
    validate(validator.object({}).strict()),
    asyncHandler(async (req, res) =>
      res
        .status(201)
        .json(
          await taskExtras.duplicate(req.user!.id, req.params.id, req.body),
        ),
    ),
  );
  r.post(
    "/tasks/:id/subtasks/:subId/promote",
    validateParams(
      validator.object({
        id: validator.string().regex(/^[a-f0-9]{24}$/i),
        subId: validator.string().uuid(),
      }),
    ),
    validate(z.remove),
    asyncHandler(async (req, res) =>
      res
        .status(201)
        .json(
          await taskExtras.promote(
            req.user!.id,
            req.params.id,
            req.params.subId,
            req.body,
          ),
        ),
    ),
  );
  r.get(
    "/task-lists",
    validateQuery(listQuery),
    asyncHandler(async (req, res) =>
      res.json(await lists.list(req.user!.id, req.query)),
    ),
  );
  r.post(
    "/task-lists",
    validate(listCreate),
    asyncHandler(async (req, res) =>
      res.status(201).json(await lists.create(req.user!.id, req.body)),
    ),
  );
  r.patch(
    "/task-lists/reorder",
    validate(reorderInput),
    asyncHandler(async (req, res) =>
      res.json(await lists.reorder(req.user!.id, req.body)),
    ),
  );
  r.put(
    "/task-lists/:id",
    validateParams(idParams),
    validate(listUpdate),
    asyncHandler(async (req, res) =>
      res.json(await lists.update(req.user!.id, req.params.id, req.body)),
    ),
  );
  r.delete(
    "/task-lists/:id",
    validateParams(idParams),
    validate(listDelete),
    asyncHandler(async (req, res) => {
      await lists.remove(req.user!.id, req.params.id, req.body);
      res.sendStatus(204);
    }),
  );
  r.post(
    "/tasks/quick-add",
    validate(z.quickAdd),
    asyncHandler(async (req, res) =>
      res.status(201).json(await s.quickAdd(req.user!.id, req.body)),
    ),
  );
  r.patch(
    "/tasks/bulk-undo",
    validate(bulkUndoInput),
    asyncHandler(async (req, res) =>
      res.json(await taskOperations.undo(req.user!.id, req.body)),
    ),
  );
  r.patch(
    "/tasks/reorder",
    validate(reorderInput),
    asyncHandler(async (req, res) =>
      res.json(await taskOperations.reorder(req.user!.id, req.body)),
    ),
  );
  r.patch(
    "/tasks/bulk",
    validate(bulkInput),
    asyncHandler(async (req, res) =>
      res.json(await taskOperations.bulk(req.user!.id, req.body)),
    ),
  );
  r.get(
    "/tasks/summary",
    validateQuery(z.readQuery),
    asyncHandler(async (req, res) =>
      res.json(await s.summary(req.user!.id, req.query)),
    ),
  );
  r.get(
    "/tasks/stats",
    validateQuery(statsQuery),
    asyncHandler(async (req, res) =>
      res.json(await taskStatsService.get(req.user!.id, req.query)),
    ),
  );
  r.post(
    "/tasks/:id/restore",
    validateParams(idParams),
    validate(z.remove),
    asyncHandler(async (req, res) =>
      res.json(await s.restore(req.user!.id, req.params.id, req.body)),
    ),
  );
  r.get(
    "/tasks/members",
    validateQuery(z.readQuery),
    asyncHandler(async (req, res) =>
      res.json(await s.members(req.user!.id, req.query)),
    ),
  );
  r.get(
    "/tasks",
    validateQuery(z.query),
    asyncHandler(async (req, res) =>
      res.json(await s.list(req.user!.id, req.query)),
    ),
  );
  r.post(
    "/tasks",
    validate(z.create),
    asyncHandler(async (req, res) =>
      res.status(201).json(await s.create(req.user!.id, req.body)),
    ),
  );
  r.get(
    "/tasks/:id",
    validateParams(idParams),
    asyncHandler(async (req, res) =>
      res.json(await s.get(req.user!.id, req.params.id)),
    ),
  );
  r.put(
    "/tasks/:id",
    validateParams(idParams),
    validate(z.update),
    asyncHandler(async (req, res) =>
      res.json(await s.update(req.user!.id, req.params.id, req.body)),
    ),
  );
  r.patch(
    "/tasks/:id/status",
    validateParams(idParams),
    validate(z.changeStatus),
    asyncHandler(async (req, res) =>
      res.json(await s.status(req.user!.id, req.params.id, req.body)),
    ),
  );
  r.delete(
    "/tasks/:id",
    validateParams(idParams),
    validate(z.remove),
    asyncHandler(async (req, res) => {
      await s.remove(req.user!.id, req.params.id, req.body);
      res.sendStatus(204);
    }),
  );
  r.get(
    "/tasks/:id/comments",
    validateParams(idParams),
    validateQuery(z.commentsQuery),
    asyncHandler(async (req, res) =>
      res.json(await s.comments(req.user!.id, req.params.id, req.query)),
    ),
  );
  r.post(
    "/tasks/:id/comments",
    validateParams(idParams),
    validate(z.comment),
    asyncHandler(async (req, res) =>
      res
        .status(201)
        .json(await s.comment(req.user!.id, req.params.id, req.body)),
    ),
  );
  return r;
}
