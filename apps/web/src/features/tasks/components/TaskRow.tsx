import { memo } from "react";
import {
  Check,
  Flag,
  Heart,
  MessageCircle,
  Repeat,
  ListChecks,
} from "lucide-react";
import { useAuthStore } from "../../auth/store";
import { localInputDate } from "../../finance/api";
import { dateLabel } from "../lib/dateLabels";
import { Task, Members, Status, statuses, priorities } from "../types";
export const TaskRow = memo(function TaskRow({
  task,
  members,
  busy,
  onStatus,
  onEdit,
  onComments,
  onDelete,
  onCheck,
  listName,
}: {
  task: Task;
  members: Members;
  busy: boolean;
  onStatus: (s: Status) => void;
  onEdit: () => void;
  onComments: () => void;
  onDelete: () => void;
  onCheck: (id: string, done: boolean) => void;
  listName?: string;
}) {
  const user = useAuthStore((s) => s.user)!,
    today = localInputDate(new Date(), user.timezone),
    done = task.status === "DONE",
    disabled = task.readOnly || busy;
  const name =
    task.assignedTo === user.id
      ? user.name
      : (members.items.find((m) => m.id === task.assignedTo)?.name ??
        "Chưa giao");
  return (
    <article className={`todo-row ${done ? "is-done" : ""}`}>
      <button
        role="checkbox"
        aria-checked={done}
        aria-label={`Hoàn thành ${task.title}`}
        className="todo-checkbox"
        disabled={disabled}
        onClick={() => onStatus(done ? "TODO" : "DONE")}
      >
        <Check size={15} />
      </button>
      <div className="todo-row-content">
        <button className="todo-title-button" onClick={onEdit}>
          <h3>
            {task.status === "IN_PROGRESS" && (
              <span className="todo-working-dot" />
            )}
            {task.title}
          </h3>
        </button>
        <p className="todo-row-caption">
          {task.coupleId && <Heart size={12} />}{" "}
          {listName ?? (task.coupleId ? "Việc chung" : "Hộp thư vào")}
          {task.description && ` · ${task.description}`}
        </p>
        <div className="todo-row-meta">
          <span
            className={`todo-date ${task.deadline && task.deadline < today && !done && task.status !== "CANCELLED" ? "is-overdue" : task.deadline === today ? "is-today" : ""}`}
          >
            {dateLabel(task, today)}
          </span>
          <span
            className={`todo-flag priority-${task.priority.toLowerCase()}`}
            title={priorities[task.priority]}
          >
            <Flag size={13} />
            {priorities[task.priority]}
          </span>
          {task.recurrence !== "none" && (
            <span title="Việc lặp lại">
              <Repeat size={13} />
            </span>
          )}
          {task.labels.map((label) => (
            <span className="todo-label" key={label}>
              {label}
            </span>
          ))}
          {task.checklist.length > 0 && (
            <span>
              <ListChecks size={13} />
              {task.checklist.filter((i) => i.done).length}/
              {task.checklist.length}
            </span>
          )}
        </div>
        {task.checklist.length > 0 && (
          <details
            className="todo-inline-checklist"
            open={task.checklist.length <= 2}
          >
            <summary>Việc con</summary>
            {task.checklist.map((i) => (
              <label key={i.id} className="checkbox-label">
                <input
                  type="checkbox"
                  aria-label={`${task.title}: ${i.text}`}
                  checked={i.done}
                  disabled={disabled}
                  onChange={(e) => onCheck(i.id, e.target.checked)}
                />
                <span className={i.done ? "task-checked" : ""}>{i.text}</span>
              </label>
            ))}
          </details>
        )}
      </div>
      <div className="todo-row-controls">
        <span
          className={`todo-assignee ${task.assignedTo === user.id ? "is-mine" : ""}`}
          title={name}
          aria-label={`Người thực hiện: ${name}`}
        >
          {name === "Chưa giao" ? "—" : name.split(" ").at(-1)?.slice(0, 2)}
        </span>
        <select
          aria-label={`Trạng thái ${task.title}`}
          value={task.status}
          disabled={disabled}
          onChange={(e) => onStatus(e.target.value as Status)}
        >
          {Object.entries(statuses).map(([key, value]) => (
            <option value={key} key={key}>
              {value}
            </option>
          ))}
        </select>
        <div className="todo-row-actions">
          {!task.readOnly && (
            <>
              <button className="text-button" onClick={onEdit} disabled={busy}>
                Sửa
              </button>
              <button
                className="text-button"
                onClick={onDelete}
                disabled={busy}
              >
                Xóa
              </button>
            </>
          )}
          {task.coupleId && (
            <button className="text-button" onClick={onComments}>
              <MessageCircle size={13} />
              Bình luận
            </button>
          )}
        </div>
      </div>
    </article>
  );
});
