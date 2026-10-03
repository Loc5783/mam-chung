import { Request, Response } from "express";
import { financeService as service } from "./service";
export const financeController = {
  wallets: async (req: Request, res: Response) =>
    res.json(await service.wallets(req.user!.id, req.query)),
  wallet: async (req: Request, res: Response) =>
    res.json(await service.wallet(req.user!.id, req.params.id)),
  createWallet: async (req: Request, res: Response) =>
    res.status(201).json(await service.createWallet(req.user!.id, req.body)),
  updateWallet: async (req: Request, res: Response) =>
    res.json(await service.updateWallet(req.user!.id, req.params.id, req.body)),
  deleteWallet: async (req: Request, res: Response) => {
    await service.deleteWallet(req.user!.id, req.params.id);
    res.status(204).end();
  },
  reconcile: async (req: Request, res: Response) =>
    res.json(await service.reconcile(req.user!.id, req.params.id, req.body)),
  transfer: async (req: Request, res: Response) =>
    res.status(201).json(await service.transfer(req.user!.id, req.body)),
  categories: async (req: Request, res: Response) =>
    res.json(await service.categories(req.user!.id, req.query)),
  createCategory: async (req: Request, res: Response) =>
    res.status(201).json(await service.createCategory(req.user!.id, req.body)),
  updateCategory: async (req: Request, res: Response) =>
    res.json(
      await service.updateCategory(req.user!.id, req.params.id, req.body),
    ),
  deleteCategory: async (req: Request, res: Response) => {
    await service.deleteCategory(req.user!.id, req.params.id, req.body);
    res.status(204).end();
  },
  transactions: async (req: Request, res: Response) =>
    res.json(await service.transactions(req.user!.id, req.query)),
  transaction: async (req: Request, res: Response) =>
    res.json(await service.transaction(req.user!.id, req.params.id)),
  createTransaction: async (req: Request, res: Response) =>
    res
      .status(201)
      .json(await service.createTransaction(req.user!.id, req.body)),
  updateTransaction: async (req: Request, res: Response) =>
    res.json(
      await service.updateTransaction(req.user!.id, req.params.id, req.body),
    ),
  deleteTransaction: async (req: Request, res: Response) => {
    await service.deleteTransaction(req.user!.id, req.params.id);
    res.status(204).end();
  },
  duplicate: async (req: Request, res: Response) =>
    res
      .status(201)
      .json(await service.duplicate(req.user!.id, req.params.id, req.body)),
  dashboard: async (req: Request, res: Response) =>
    res.json(await service.dashboard(req.user!.id)),
};
