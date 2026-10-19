import { Request, Response } from "express";
import { adminService } from "./service";
import { verifyAdminPassword } from "./middleware";
import {
  adminIdParamSchema,
  adminPasswordBodySchema,
  adminTransferOwnerSchema,
} from "./schema";

export const adminController = {
  async overview(_req: Request, res: Response) {
    const data = await adminService.getOverview();
    res.json(data);
  },

  async users(req: Request, res: Response) {
    const data = await adminService.getUsers(req.query);
    res.json(data);
  },

  async lockUser(req: Request, res: Response) {
    const admin = await verifyAdminPassword(req);
    const { id } = adminIdParamSchema.parse(req.params);
    adminPasswordBodySchema.parse(req.body);
    const result = await adminService.lockUser(
      id,
      admin.id as string,
      admin.email,
      req.ip,
    );
    res.json(result);
  },

  async unlockUser(req: Request, res: Response) {
    const admin = await verifyAdminPassword(req);
    const { id } = adminIdParamSchema.parse(req.params);
    adminPasswordBodySchema.parse(req.body);
    const result = await adminService.unlockUser(
      id,
      admin.id as string,
      admin.email,
      req.ip,
    );
    res.json(result);
  },

  async unlockLogin(req: Request, res: Response) {
    const admin = await verifyAdminPassword(req);
    const { id } = adminIdParamSchema.parse(req.params);
    adminPasswordBodySchema.parse(req.body);
    const result = await adminService.unlockLogin(
      id,
      admin.id as string,
      admin.email,
      req.ip,
    );
    res.json(result);
  },

  async deleteUser(req: Request, res: Response) {
    const admin = await verifyAdminPassword(req);
    const { id } = adminIdParamSchema.parse(req.params);
    adminPasswordBodySchema.parse(req.body);
    const result = await adminService.deleteUser(
      id,
      admin.id as string,
      admin.email,
      req.ip,
    );
    res.json(result);
  },

  async resetPassword(req: Request, res: Response) {
    const admin = await verifyAdminPassword(req);
    const { id } = adminIdParamSchema.parse(req.params);
    adminPasswordBodySchema.parse(req.body);
    const result = await adminService.resetPassword(
      id,
      admin.id as string,
      admin.email,
      req.ip,
    );
    res.json(result);
  },

  async couples(req: Request, res: Response) {
    const data = await adminService.getCouples(req.query);
    res.json(data);
  },

  async archiveCouple(req: Request, res: Response) {
    const admin = await verifyAdminPassword(req);
    const { id } = adminIdParamSchema.parse(req.params);
    adminPasswordBodySchema.parse(req.body);
    const result = await adminService.archiveCouple(
      id,
      admin.id as string,
      admin.email,
      req.ip,
    );
    res.json(result);
  },

  async transferCoupleOwner(req: Request, res: Response) {
    const admin = await verifyAdminPassword(req);
    const { id } = adminIdParamSchema.parse(req.params);
    const { newOwnerId } = adminTransferOwnerSchema.parse(req.body);
    const result = await adminService.transferCoupleOwner(
      id,
      newOwnerId,
      admin.id as string,
      admin.email,
      req.ip,
    );
    res.json(result);
  },

  async getSettings(_req: Request, res: Response) {
    const data = await adminService.getSettings();
    res.json(data);
  },

  async updateSettings(req: Request, res: Response) {
    const admin = await verifyAdminPassword(req);
    const data = await adminService.updateSettings(
      req.body,
      admin.id as string,
      admin.email,
      req.ip,
    );
    res.json(data);
  },

  async audit(req: Request, res: Response) {
    const data = await adminService.getAuditLogs(req.query);
    res.json(data);
  },
};
