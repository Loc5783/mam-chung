import React from "react";
import { TaskRow } from "./TaskRow";
import { localInputDate } from "../../finance/api";
import type { Task, Members, Status } from "../types";

export function SelectableTaskRow({
  task,
  index = 0,
  search,
  userTimezone,
  members,
  listName,
  isChosen,
  isWritePending,
  isExitAnimation,
  online,
  onToggleChosen,
  onTomorrow,
  onStatus,
  onEdit,
  onComments,
  onDelete,
  onCheck,
  onClickCapture,
}: {
  task: Task;
  index?: number;
  search: string;
  userTimezone: string;
  members: Members;
  listName?: string;
  isChosen: boolean;
  isWritePending: boolean;
  isExitAnimation: boolean;
  online: boolean;
  onToggleChosen: (checked: boolean) => void;
  onTomorrow: (deadline: string) => void;
  onStatus: (status: Status) => void;
  onEdit: () => void;
  onComments: () => void;
  onDelete: () => void;
  onCheck: (id: string, done: boolean) => void;
  onClickCapture: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      key={task.id}
      data-task-id={task.id}
      className={`stagger-item ${isExitAnimation ? "item-exit" : ""}`.trim()}
      style={{ "--i": Math.min(index, 12) } as React.CSSProperties}
      onClickCapture={onClickCapture}
    >
      <label className="todo-row-checkbox">
        <input
          type="checkbox"
          aria-label={`Chọn ${task.title}`}
          checked={isChosen}
          disabled={task.readOnly || isWritePending || !online}
          onChange={(e) => onToggleChosen(e.target.checked)}
        />{" "}
        Chọn
      </label>
      <TaskRow
        key={task.id}
        task={task}
        search={search}
        onTomorrow={() => {
          const now = new Date();
          const today = localInputDate(now, userTimezone);
          const next = new Date(today + "T12:00:00Z");
          next.setUTCDate(next.getUTCDate() + 1);
          onTomorrow(next.toISOString().slice(0, 10));
        }}
        members={members}
        listName={listName}
        busy={isWritePending || !online}
        onStatus={onStatus}
        onEdit={onEdit}
        onComments={onComments}
        onDelete={onDelete}
        onCheck={onCheck}
      />
    </div>
  );
}
