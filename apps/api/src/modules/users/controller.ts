import { Request, Response } from "express";
import { userService } from "./service";
import { clearRefresh } from "../auth/controller";
export const userController = {
  me: async (req: Request, res: Response) =>
    res.json(await userService.me(req.user!.id)),
  update: async (req: Request, res: Response) =>
    res.json(await userService.update(req.user!.id, req.body)),
  remove: async (req: Request, res: Response) => {
    await userService.remove(req.user!.id, req.body.password);
    clearRefresh(res);
    res.status(204).end();
  },
};
