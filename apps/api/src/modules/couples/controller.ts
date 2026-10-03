import { Request, Response } from "express";
import { coupleService as s } from "./service";
export const coupleController = {
  create: async (req: Request, res: Response) =>
    res.status(201).json(await s.create(req.user!.id, req.body)),
  me: async (req: Request, res: Response) => res.json(await s.me(req.user!.id)),
  update: async (req: Request, res: Response) =>
    res.json(await s.update(req.user!.id, req.body)),
  invite: async (req: Request, res: Response) =>
    res.status(201).json(await s.invite(req.user!.id)),
  revoke: async (req: Request, res: Response) => {
    await s.revokeInvite(req.user!.id);
    res.status(204).end();
  },
  preview: async (req: Request, res: Response) =>
    res.json(await s.preview(req.user!.id, req.params.code)),
  accept: async (req: Request, res: Response) =>
    res.json(await s.accept(req.user!.id, req.body)),
  transfer: async (req: Request, res: Response) =>
    res.json(await s.transferOwner(req.user!.id, req.body)),
  leave: async (req: Request, res: Response) =>
    res.json(await s.leave(req.user!.id, req.body)),
  archives: async (req: Request, res: Response) =>
    res.json(await s.archives(req.user!.id, req.query)),
  archived: async (req: Request, res: Response) =>
    res.json(await s.archived(req.user!.id, req.params.id)),
  activity: async (req: Request, res: Response) =>
    res.json(await s.activity(req.user!.id, req.query)),
};
