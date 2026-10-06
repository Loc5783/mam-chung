import type { Task } from "../types";
import { localInputDate } from "../../finance/api";
const add = (date: string, days: number) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
export function dateLabel(task: Task, today: string) {
  if (!task.deadline) return "Không hạn";
  const days = Math.round(
    (Date.parse(today) - Date.parse(task.deadline)) / 86400000,
  );
  const label =
    days > 0 && !["DONE", "CANCELLED"].includes(task.status)
      ? `Quá hạn ${days} ngày`
      : task.deadline === today
        ? "Hôm nay"
        : task.deadline === add(today, 1)
          ? "Ngày mai"
          : new Date(task.deadline + "T12:00:00Z").toLocaleDateString("vi-VN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              timeZone: "UTC",
            });
  return (
    label +
    (task.deadlineHasTime && task.deadlineTime ? ` · ${task.deadlineTime}` : "")
  );
}
export function groupTasks(
  tasks: Task[],
  now: Date,
  timezone: string,
  by = "deadline",
) {
  const today = localInputDate(now, timezone),
    endWeek = add(today, (7 - new Date(today + "T12:00:00Z").getUTCDay()) % 7),
    tomorrow = add(today, 1);
  const order = [
    "Quá hạn",
    "Hôm nay",
    "Ngày mai",
    "Tuần này",
    "Sau đó",
    "Không hạn",
    "Đã hủy",
    "Đã xong",
  ];
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const key =
      task.status === "DONE"
        ? "Đã xong"
        : task.status === "CANCELLED"
          ? "Đã hủy"
          : by === "priority"
            ? {
                LOW: "Ưu tiên thấp",
                MEDIUM: "Ưu tiên vừa",
                HIGH: "Ưu tiên cao",
                URGENT: "Ưu tiên khẩn",
              }[task.priority]
            : by === "list"
              ? (task.listId ?? "inbox")
              : by === "assignee"
                ? (task.assignedTo ?? "unassigned")
                : !task.deadline
                  ? "Không hạn"
                  : task.deadline < today
                    ? "Quá hạn"
                    : task.deadline === today
                      ? "Hôm nay"
                      : task.deadline === tomorrow
                        ? "Ngày mai"
                        : task.deadline <= endWeek
                          ? "Tuần này"
                          : "Sau đó";
    groups.set(key, [...(groups.get(key) ?? []), task]);
  }
  return [...groups].sort(([a], [b]) =>
    by === "deadline"
      ? order.indexOf(a) - order.indexOf(b)
      : Number(a === "Đã xong") - Number(b === "Đã xong"),
  );
}
