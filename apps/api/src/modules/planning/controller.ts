import { Request, Response } from "express";
import { planningService as service } from "./service";
export const planningController = {
  budgets: async (req: Request, res: Response) =>
    res.json(await service.budgets(req.user!.id, req.query)),
  createBudget: async (req: Request, res: Response) =>
    res.status(201).json(await service.createBudget(req.user!.id, req.body)),
  updateBudget: async (req: Request, res: Response) =>
    res.json(await service.updateBudget(req.user!.id, req.params.id, req.body)),
  deleteBudget: async (req: Request, res: Response) => {
    await service.deleteBudget(req.user!.id, req.params.id);
    res.status(204).end();
  },
  goals: async (req: Request, res: Response) =>
    res.json(await service.goals(req.user!.id, req.query)),
  createGoal: async (req: Request, res: Response) =>
    res.status(201).json(await service.createGoal(req.user!.id, req.body)),
  updateGoal: async (req: Request, res: Response) =>
    res.json(await service.updateGoal(req.user!.id, req.params.id, req.body)),
  deleteGoal: async (req: Request, res: Response) => {
    await service.deleteGoal(req.user!.id, req.params.id);
    res.status(204).end();
  },
  contribute: async (req: Request, res: Response) =>
    res
      .status(201)
      .json(await service.contribute(req.user!.id, req.params.id, req.body)),
  contributions: async (req: Request, res: Response) =>
    res.json(
      await service.contributions(req.user!.id, req.params.id, req.query),
    ),
  undoContribution: async (req: Request, res: Response) => {
    await service.undoContribution(
      req.user!.id,
      req.params.id,
      req.params.contributionId,
    );
    res.status(204).end();
  },
  recurring: async (req: Request, res: Response) =>
    res.json(await service.recurring(req.user!.id, req.query)),
  createRecurring: async (req: Request, res: Response) =>
    res.status(201).json(await service.createRecurring(req.user!.id, req.body)),
  updateRecurring: async (req: Request, res: Response) =>
    res.json(
      await service.updateRecurring(req.user!.id, req.params.id, req.body),
    ),
  deleteRecurring: async (req: Request, res: Response) => {
    await service.deleteRecurring(req.user!.id, req.params.id);
    res.status(204).end();
  },
  runRecurring: async (req: Request, res: Response) =>
    res.json(await service.runRecurring(req.user!.id, req.params.id)),
  reports: async (req: Request, res: Response) =>
    res.json(await service.reports(req.user!.id, req.query)),
  exportCsv: async (req: Request, res: Response) => {
    const csv = await service.exportCsv(req.user!.id, req.query);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="mam-chung-transactions.csv"',
    );
    res.send(csv);
  },
};
