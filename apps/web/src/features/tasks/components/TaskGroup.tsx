import { ReactNode } from "react";
export function TaskGroup({
  name,
  count,
  children,
}: {
  name: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <details
      className="todo-group"
      open={name !== "Đã xong" && name !== "Đã hủy"}
    >
      <summary>
        <h2>{name}</h2>
        <span>{count}</span>
      </summary>
      <div>{children}</div>
    </details>
  );
}
export function TaskSkeleton() {
  return (
    <div
      className="todo-skeletons"
      role="status"
      aria-label="Đang tải công việc"
    >
      {[1, 2, 3, 4].map((i) => (
        <div className="todo-skeleton-row" key={i}>
          <span />
          <div>
            <b />
            <small />
          </div>
        </div>
      ))}
    </div>
  );
}
