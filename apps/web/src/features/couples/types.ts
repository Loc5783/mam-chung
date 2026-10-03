export interface CoupleData {
  id: string;
  name: string;
  status: "active" | "archived";
  ownerId: string;
  role: "owner" | "member";
  anniversary: string | null;
  anniversaryInfo: {
    date: string;
    daysTogether: number;
    nextDate: string;
    daysUntil: number;
    isToday: boolean;
  } | null;
  createdAt: string;
  archivedAt: string | null;
  archivedReason: string | null;
  members: {
    userId: string;
    name: string;
    avatar: string | null;
    role: "owner" | "member";
    active: boolean;
    joinedAt: string;
    leftAt: string | null;
  }[];
  invite: { id: string; expiresAt: string } | null;
  outstanding: { count: number; summaryAvailable: boolean };
}
export interface InviteData {
  id: string;
  code: string;
  expiresAt: string;
  path: string;
}
export interface Activity {
  id: string;
  type: string;
  actorName: string;
  message: string;
  createdAt: string;
}
