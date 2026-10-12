import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, errorMessage, getSessionEpoch } from "../../lib/apiClient";
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
    refetchOnWindowFocus: true,
  });
}
export function useTaskMutation<T>(
  run: (v: T) => Promise<unknown>,
  done: (result: unknown) => void = () => {},
) {
  const client = useQueryClient(),
    notify = useUiStore((s) => s.notify);
  return useMutation({
    networkMode: "always",
    mutationFn: (value: T) => {
      if (!navigator.onLine)
        throw new Error(
          "Mất kết nối. Kết nối mạng trước khi cập nhật công việc.",
        );
      return run(value);
    },
    onMutate: () => ({
      epoch: getSessionEpoch(),
      id: useAuthStore.getState().user?.id,
    }),
    onSuccess: (_r, _v, c) => {
      if (c?.epoch !== getSessionEpoch()) return;
      done(_r);
      void client.invalidateQueries({ queryKey: ["dashboard", c?.id] });
      void client.invalidateQueries({ queryKey: ["notifications", c?.id] });
      notify("Đã cập nhật công việc.");
      void client.invalidateQueries({ queryKey: ["tasks", c?.id] });
      void client.invalidateQueries({ queryKey: ["couple", c?.id] });
    },
    onError: (error, _value, context) => {
      if (context?.epoch !== getSessionEpoch()) return;
      notify(errorMessage(error));
      void client.invalidateQueries({ queryKey: ["tasks", context?.id] });
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context?.epoch !== getSessionEpoch()) return;
      void client.invalidateQueries({ queryKey: ["tasks", context?.id] });
    },
  });
}
