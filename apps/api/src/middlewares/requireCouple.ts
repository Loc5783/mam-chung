import { RequestHandler } from "express";
import { coupleService } from "../modules/couples/service";
export const requireCouple: RequestHandler = (req, _res, next) => {
  void coupleService
    .requireActive(req.user!.id)
    .then((id) => {
      req.user!.coupleId = id;
      next();
    })
    .catch(next);
};
