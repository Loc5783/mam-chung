import { apiClient } from "../../lib/apiClient";
import type {
  AdminOverview,
  AdminUsersResponse,
  AdminCouplesResponse,
  AdminAuditResponse,
  AdminSettings,
} from "./types";

export const adminApi = {
  async getOverview() {
    const res = await apiClient.get<AdminOverview>("/admin/overview");
    return res.data;
  },

  async getUsers(params: {
    query?: string;
    status?: "all" | "active" | "disabled" | "deleted";
    page?: number;
    limit?: number;
  }) {
    const res = await apiClient.get<AdminUsersResponse>("/admin/users", {
      params,
    });
    return res.data;
  },

  async lockUser(userId: string, adminPassword: string) {
    const res = await apiClient.post<{ success: boolean; message: string }>(
      `/admin/users/${userId}/lock`,
      { adminPassword },
    );
    return res.data;
  },

  async unlockUser(userId: string, adminPassword: string) {
    const res = await apiClient.post<{ success: boolean; message: string }>(
      `/admin/users/${userId}/unlock`,
      { adminPassword },
    );
    return res.data;
  },

  async unlockLogin(userId: string, adminPassword: string) {
    const res = await apiClient.post<{ success: boolean; message: string }>(
      `/admin/users/${userId}/unlock-login`,
      { adminPassword },
    );
    return res.data;
  },

  async deleteUser(userId: string, adminPassword: string) {
    const res = await apiClient.delete<{ success: boolean; message: string }>(
      `/admin/users/${userId}`,
      { data: { adminPassword } },
    );
    return res.data;
  },

  async resetPassword(userId: string, adminPassword: string) {
    const res = await apiClient.post<{
      success: boolean;
      temporaryPassword: string;
      message: string;
    }>(`/admin/users/${userId}/reset-password`, { adminPassword });
    return res.data;
  },

  async getCouples(params: {
    status?: "all" | "active" | "archived";
    page?: number;
    limit?: number;
  }) {
    const res = await apiClient.get<AdminCouplesResponse>("/admin/couples", {
      params,
    });
    return res.data;
  },

  async archiveCouple(coupleId: string, adminPassword: string) {
    const res = await apiClient.post<{ success: boolean; message: string }>(
      `/admin/couples/${coupleId}/archive`,
      { adminPassword },
    );
    return res.data;
  },

  async transferCoupleOwner(
    coupleId: string,
    newOwnerId: string,
    adminPassword: string,
  ) {
    const res = await apiClient.post<{ success: boolean; message: string }>(
      `/admin/couples/${coupleId}/transfer-owner`,
      { newOwnerId, adminPassword },
    );
    return res.data;
  },

  async getSettings() {
    const res = await apiClient.get<AdminSettings>("/admin/settings");
    return res.data;
  },

  async updateSettings(body: {
    registrationOpen?: boolean;
    allowNewCouples?: boolean;
    adminPassword: string;
  }) {
    const res = await apiClient.patch<AdminSettings>("/admin/settings", body);
    return res.data;
  },

  async getAuditLogs(params: {
    action?: string;
    page?: number;
    limit?: number;
  }) {
    const res = await apiClient.get<AdminAuditResponse>("/admin/audit", {
      params,
    });
    return res.data;
  },
};
