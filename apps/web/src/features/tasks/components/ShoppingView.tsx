import { type ReactNode } from "react";
import { TaskGroup } from "./TaskGroup";
import type { Task } from "../types";
export function ShoppingView({
  tasks,
  render,
}: {
  tasks: Task[];
  render: (task: Task) => ReactNode;
}) {
  const groups = new Map<string, Task[]>();
  for (const t of tasks) {
    const group =
      t.status === "DONE"
        ? "Đã xong"
        : t.status === "CANCELLED"
          ? "Đã hủy"
          : (t.labels[0] ?? "Chưa phân khu");
    groups.set(group, [...(groups.get(group) ?? []), t]);
  }
  return (
    <>
      <p className="muted">
        Mua sắm nhóm theo nhãn đầu tiên, ví dụ #rau, #đồ-khô, #gia-dụng. Tick
        nhanh; hai bạn thấy thay đổi khi tải lại hoặc quay về cửa sổ.
      </p>
      {[...groups.entries()]
        .sort(
          ([a], [b]) =>
            Number(a === "Đã xong" || a === "Đã hủy") -
            Number(b === "Đã xong" || b === "Đã hủy"),
        )
        .map(([name, items]) => (
          <TaskGroup key={name} name={name} count={items.length}>
            {items.map(render)}
          </TaskGroup>
        ))}
    </>
  );
}
