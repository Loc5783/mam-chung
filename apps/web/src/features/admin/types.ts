export type AdminOverview = {
  totalUsers: number;
  activeUsers7d: number;
  disabledUsers: number;
  newUsers7d: number;
  activeCouples: number;
  archivedCouples: number;
  registrationOpen: boolean;
};

export type AdminUserItem = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastLoginAt: string | null;
  status: "active" | "disabled" | "deleted";
  lockedUntil: string | null;
  coupleName: string | null;
  coupleStatus: "active" | "archived" | null;
  role: "user" | "admin";
};

export type AdminUsersResponse = {
  items: AdminUserItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type AdminCoupleMember = {
  userId: string;
  name: string;
  role: "owner" | "member";
  active: boolean;
};

export type AdminCoupleItem = {
  id: string;
  name: string;
  status: "active" | "archived";
  createdAt: string;
  memberCount: number;
  members: AdminCoupleMember[];
  activeInviteCount: number;
};

export type AdminCouplesResponse = {
  items: AdminCoupleItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type AdminAuditItem = {
  id: string;
  adminId: string | null;
  adminEmail: string;
  ip: string | null;
  action: string;
  targetType: "user" | "couple" | "setting";
  targetId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};

export type AdminAuditResponse = {
  items: AdminAuditItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type AdminSettings = {
  registrationOpen: boolean;
  allowNewCouples: boolean;
};
