export type Status = "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type ChecklistItem = { id: string; text: string; done: boolean };
export type Task = {
  id: string;
  listId?: string | null;
  position?: string | null;
  startDate?: string | null;
  deadlineHasTime?: boolean;
  deadlineTime?: string | null;
  deadlineTimezone?: string | null;
  reminderAt?: string | null;
  estimateMinutes?: number | null;
  timeSpentSeconds?: number;
  completedBy?: string | null;
  title: string;
  description: string;
  deadline: string | null;
  priority: Priority;
  status: Status;
  assignedTo: string | null;
  createdBy: string;
  creatorName: string;
  coupleId: string | null;
  kind: "task" | "shopping";
  labels: string[];
  checklist: ChecklistItem[];
  recurrence: "none" | "daily" | "weekly" | "monthly";
  completedAt: string | null;
  sourceTaskId: string | null;
  revision: number;
  createdAt: string;
  readOnly: boolean;
};
export type TaskPage = {
  items: Task[];
  total: number;
  page: number;
  limit: number;
  readOnly: boolean;
};
export type Members = {
  items: { id: string; name: string }[];
  readOnly: boolean;
};
export const statuses: Record<Status, string> = {
  TODO: "Cần làm",
  IN_PROGRESS: "Đang làm",
  DONE: "Hoàn thành",
  CANCELLED: "Đã hủy",
};
export const priorities: Record<Priority, string> = {
  LOW: "Thấp",
  MEDIUM: "Vừa",
  HIGH: "Cao",
  URGENT: "Khẩn cấp",
};

export type TaskList = {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: "normal" | "shopping";
  ownerId: string | null;
  coupleId: string | null;
  position: string;
  archivedAt: string | null;
  revision: number;
  isDefault: boolean;
  readOnly: boolean;
};
export type TaskListPage = {
  items: TaskList[];
  total: number;
  page: number;
  limit: number;
  readOnly: boolean;
};
