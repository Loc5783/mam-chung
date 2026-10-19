import { CookieOptions, Request, Response } from "express";
import { env } from "../../config/env";
import { authService } from "./service";
import { AppSettings } from "../admin/models";
const options: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/api/auth",
};
export const clearRefresh = (res: Response) =>
  res.clearCookie("refreshToken", options);
function sendSession(
  res: Response,
  result: Awaited<ReturnType<typeof authService.login>>,
  status = 200,
) {
  res.cookie("refreshToken", result.refreshToken, {
    ...options,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res
    .status(status)
    .json({ accessToken: result.accessToken, user: result.user });
}
export const authController = {
  register: async (req: Request, res: Response) =>
    sendSession(res, await authService.register(req.body), 201),
  login: async (req: Request, res: Response) =>
    sendSession(res, await authService.login(req.body)),
  refresh: async (req: Request, res: Response) => {
    try {
      sendSession(res, await authService.refresh(req.cookies.refreshToken));
    } catch (error) {
      clearRefresh(res);
      throw error;
    }
  },
  logout: async (req: Request, res: Response) => {
    await authService.logout(req.user!.id, req.user!.family);
    clearRefresh(res);
    res.status(204).end();
  },
  changePassword: async (req: Request, res: Response) => {
    await authService.changePassword(req.user!.id, req.body);
    clearRefresh(res);
    res.status(204).end();
  },
  registrationStatus: async (_req: Request, res: Response) => {
    const settings = await AppSettings.findOne({ key: "global" });
    res.json({ open: settings?.registrationOpen ?? true });
  },
};
