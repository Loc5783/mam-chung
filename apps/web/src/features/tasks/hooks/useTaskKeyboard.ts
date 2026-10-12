import { useEffect } from "react";
import { localInputDate } from "../../finance/api";
import type { Task } from "../types";
import type { useTaskWrite } from "../useTaskWrite";

export function useTaskKeyboard({
  items,
  readOnly,
  online,
  listReady,
  userTimezone,
  isWritePending,
  writeMutate,
  rescheduleMutate,
  hasBulkUndo,
  triggerBulkUndo,
  hasSingleUndo,
  triggerSingleUndo,
  onOpenShortcuts,
  onOpenDetail,
  onSetRemoving,
}: {
  items: Task[];
  readOnly: boolean;
  online: boolean;
  listReady: boolean;
  userTimezone: string;
  isWritePending: boolean;
  writeMutate: ReturnType<typeof useTaskWrite>["mutate"];
  rescheduleMutate: (args: { task: Task; deadline: string }) => void;
  hasBulkUndo: boolean;
  triggerBulkUndo: () => void;
  hasSingleUndo: boolean;
  triggerSingleUndo: () => void;
  onOpenShortcuts: () => void;
  onOpenDetail: (task: Task) => void;
  onSetRemoving: (task: Task) => void;
}) {
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const target =
        event.target instanceof Element ? event.target : document.activeElement;
      if (
        target?.closest(
          "input,textarea,select,[contenteditable=true],[data-drag-controls]",
        ) ||
        document.querySelector('[role="dialog"]') ||
        event.altKey
      )
        return;

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "z" &&
        hasBulkUndo
      ) {
        event.preventDefault();
        triggerBulkUndo();
        return;
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "z" &&
        hasSingleUndo
      ) {
        event.preventDefault();
        triggerSingleUndo();
        return;
      }
      if (event.ctrlKey || event.metaKey) return;
      const key = event.key.toLowerCase();
      if (key === "?") {
        event.preventDefault();
        onOpenShortcuts();
        return;
      }
      if (key === "n" && !readOnly && online && listReady) {
        event.preventDefault();
        document
          .querySelector<HTMLTextAreaElement>(
            'textarea[aria-label="Thêm nhanh công việc"]',
          )
          ?.focus();
        return;
      }
      if (key === "/") {
        event.preventDefault();
        const input = document.querySelector<HTMLInputElement>(
          'input[aria-label="Tìm công việc"]',
        );
        const details = input?.closest("details");
        if (details) details.open = true;
        input?.focus();
        return;
      }
      const rows = Array.from(
        document.querySelectorAll<HTMLElement>("[data-task-id]"),
      );
      const index = rows.findIndex((row) =>
        row.contains(document.activeElement),
      );
      if (key === "j" || key === "k") {
        event.preventDefault();
        rows[
          Math.max(0, Math.min(rows.length - 1, index + (key === "j" ? 1 : -1)))
        ]
          ?.querySelector<HTMLButtonElement>(".todo-title-button")
          ?.focus();
        return;
      }
      const task = items.find((t) => t.id === rows[index]?.dataset.taskId);
      if (!task || task.readOnly || isWritePending || !online) return;
      if (key === "x") {
        event.preventDefault();
        writeMutate({
          task,
          status: task.status === "DONE" ? "TODO" : "DONE",
        });
      }
      if (key === "e") {
        event.preventDefault();
        onOpenDetail(task);
      }
      if (key === "t") {
        event.preventDefault();
        rescheduleMutate({
          task,
          deadline: localInputDate(new Date(), userTimezone),
        });
      }
      if (key === "delete") {
        event.preventDefault();
        onSetRemoving(task);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  });
}
