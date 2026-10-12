import { useState, useCallback } from "react";
import type { Task } from "../types";

export function useTaskSelection() {
  const [chosen, setChosen] = useState<string[]>([]);

  const toggleTask = useCallback((taskId: string) => {
    setChosen((current) =>
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId],
    );
  }, []);

  const clearSelection = useCallback(() => {
    setChosen([]);
  }, []);

  const handleRowClickCapture = useCallback(
    (
      e: React.MouseEvent,
      task: Task,
      allTasks: Task[],
      isWritePending: boolean,
      isOnline: boolean,
    ) => {
      if (
        (e.ctrlKey || e.metaKey || e.shiftKey) &&
        !task.readOnly &&
        !isWritePending &&
        isOnline &&
        !(e.target as HTMLElement).closest("input")
      ) {
        e.preventDefault();
        e.stopPropagation();

        if (e.shiftKey) {
          const lastIndex = allTasks.findIndex((t) => t.id === chosen.at(-1));
          const currentIndex = allTasks.findIndex((t) => t.id === task.id);
          if (lastIndex >= 0 && currentIndex >= 0) {
            const slice = allTasks
              .slice(
                Math.min(lastIndex, currentIndex),
                Math.max(lastIndex, currentIndex) + 1,
              )
              .map((t) => t.id);
            setChosen((all) => Array.from(new Set([...all, ...slice])));
            return;
          }
        }

        toggleTask(task.id);
      }
    },
    [chosen, toggleTask],
  );

  return {
    chosen,
    setChosen,
    toggleTask,
    clearSelection,
    handleRowClickCapture,
  };
}
