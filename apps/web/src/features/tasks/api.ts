import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, getSessionEpoch } from "../../lib/apiClient";
import { useAuthStore } from "../auth/store";
import { useUiStore } from "../../app/store";
export function useTasksQuery<T>(
  path: string,
  params: Record<string, string | number> = {},
  enabled = true,
) {
  const id = useAuthStore((s) => s.user!.id);
  return useQuery({
    enabled,
    queryKey: ["tasks", id, path, params],
    queryFn: async () => (await apiClient.get<T>(path, { params })).data,
    refetchInterval: 15000,
  });
}
export function useTaskMutation<T>(
  run: (v: T) => Promise<unknown>,
  done: () => void = () => {},
) {
  const client = useQueryClient(),
    notify = useUiStore((s) => s.notify);
  return useMutation({
    mutationFn: run,
    onMutate: () => ({
      epoch: getSessionEpoch(),
      id: useAuthStore.getState().user?.id,
    }),
    onSuccess: (_r, _v, c) => {
      if (c?.epoch !== getSessionEpoch()) return;
      done();
      void client.invalidateQueries({ queryKey: ["dashboard", c?.id] });
      void client.invalidateQueries({ queryKey: ["notifications", c?.id] });
      notify("Đã cập nhật công việc.");
      void client.invalidateQueries({ queryKey: ["tasks", c?.id] });
      void client.invalidateQueries({ queryKey: ["couple", c?.id] });
    },
    onError: () => {
      void client.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
