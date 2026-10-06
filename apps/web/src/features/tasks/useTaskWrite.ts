import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, errorMessage, getSessionEpoch } from "../../lib/apiClient";
import { useAuthStore } from "../auth/store";
import { useUiStore } from "../../app/store";
import type { Task, TaskPage, Status } from "./types";
export type TaskWrite = {
  task: Task;
  status?: Status;
  checklist?: Task["checklist"];
  remove?: boolean;
  restore?: boolean;
  epoch?: number;
};
function page(value: unknown): value is TaskPage {
  return (
    !!value &&
    typeof value === "object" &&
    Array.isArray((value as TaskPage).items)
  );
}
export function useTaskWrite(
  onSaved?: (input: TaskWrite, saved: Task | null) => void,
) {
  const client = useQueryClient();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: TaskWrite) => {
      if (input.epoch !== getSessionEpoch())
        throw new Error("Phiên đăng nhập đã thay đổi.");
      if (!navigator.onLine)
        throw new Error(
          "Mất kết nối. Kết nối mạng trước khi cập nhật công việc.",
        );
      const { task } = input;
      if (input.restore)
        return (
          await apiClient.post<Task>(`/tasks/${task.id}/restore`, {
            revision: task.revision,
          })
        ).data;
      if (input.remove) {
        await apiClient.delete(`/tasks/${task.id}`, {
          data: { revision: task.revision },
        });
        return null;
      }
      if (input.status)
        return (
          await apiClient.patch<Task>(`/tasks/${task.id}/status`, {
            status: input.status,
            revision: task.revision,
          })
        ).data;
      return (
        await apiClient.put<Task>(`/tasks/${task.id}`, {
          checklist: input.checklist,
          revision: task.revision,
        })
      ).data;
    },
    onMutate: async (input) => {
      const id = useAuthStore.getState().user?.id,
        epoch = getSessionEpoch(),
        key = ["tasks", id];
      input.epoch = epoch;
      await client.cancelQueries({ queryKey: key });
      if (epoch !== getSessionEpoch()) return { id, epoch, snapshots: [] };
      const snapshots = client.getQueriesData<unknown>({ queryKey: key });
      client.setQueriesData<unknown>({ queryKey: key }, (value: unknown) => {
        if (!page(value)) return value;
        const exists = value.items.some((t) => t.id === input.task.id);
        return {
          ...value,
          total:
            input.remove && exists ? Math.max(0, value.total - 1) : value.total,
          items: input.remove
            ? value.items.filter((t) => t.id !== input.task.id)
            : value.items.map((t) =>
                t.id === input.task.id
                  ? {
                      ...t,
                      ...(input.status
                        ? {
                            status: input.status,
                            completedAt:
                              input.status === "DONE"
                                ? new Date().toISOString()
                                : null,
                          }
                        : {}),
                      ...(input.checklist
                        ? { checklist: input.checklist }
                        : {}),
                    }
                  : t,
              ),
        };
      });
      return { id, epoch, snapshots };
    },
    onError: (error, input, context) => {
      if (context?.epoch !== getSessionEpoch()) return;
      for (const [key, value] of context.snapshots) {
        if (!page(value)) continue;
        const previous = value.items.find((t) => t.id === input.task.id);
        if (!previous) continue;
        client.setQueryData<unknown>(key, (current: unknown) => {
          if (!page(current)) return current;
          const exists = current.items.some((t) => t.id === input.task.id);
          return {
            ...current,
            total: input.remove && !exists ? current.total + 1 : current.total,
            items: exists
              ? current.items.map((t) => (t.id === previous.id ? previous : t))
              : [previous, ...current.items],
          };
        });
      }
      useUiStore.getState().notify(errorMessage(error));
    },
    onSuccess: (saved, input, context) => {
      if (context?.epoch !== getSessionEpoch()) return;
      if (saved?.id)
        client.setQueriesData<unknown>(
          { queryKey: ["tasks", context.id] },
          (value: unknown) =>
            page(value)
              ? {
                  ...value,
                  items: value.items.map((t) =>
                    t.id === saved.id ? saved : t,
                  ),
                }
              : value,
        );
      onSaved?.(input, saved?.id ? saved : null);
    },
    onSettled: (_data, _error, _input, context) => {
      if (context?.epoch !== getSessionEpoch()) return;
      for (const key of ["tasks", "dashboard", "notifications", "couple"])
        void client.invalidateQueries({ queryKey: [key, context.id] });
    },
  });
}
