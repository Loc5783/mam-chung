import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, getSessionEpoch } from "../../lib/apiClient";
import { useAuthStore } from "../auth/store";
import { useUiStore } from "../../app/store";
export function useFitnessQuery<T>(
  path: string,
  params: Record<string, string | number> = {},
  enabled = true,
) {
  const id = useAuthStore((s) => s.user!.id);
  return useQuery({
    enabled,
    queryKey: ["fitness", id, path, params],
    queryFn: async () => (await apiClient.get<T>(path, { params })).data,
    refetchInterval: 15000,
  });
}
export function useFitnessMutation<T>(
  run: (v: T) => Promise<unknown>,
  done: (result: unknown) => void = () => {},
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
      done(_r);
      void client.invalidateQueries({ queryKey: ["dashboard", c?.id] });
      notify("Đã lưu dữ liệu tập luyện.");
      void client.invalidateQueries({ queryKey: ["fitness", c?.id] });
    },
    onError: (_e, _v, c) => {
      if (c?.epoch === getSessionEpoch())
        void client.invalidateQueries({ queryKey: ["fitness", c?.id] });
    },
  });
}
