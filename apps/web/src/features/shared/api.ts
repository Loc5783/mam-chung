import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, getSessionEpoch } from "../../lib/apiClient";
import { useAuthStore } from "../auth/store";
import { useUiStore } from "../../app/store";
export function useSharedQuery<T>(
  path: string,
  params: Record<string, string | number> = {},
) {
  const id = useAuthStore((s) => s.user!.id);
  return useQuery({
    queryKey: ["shared", id, path, params],
    queryFn: async () => (await apiClient.get<T>(path, { params })).data,
    refetchInterval: 15000,
  });
}
export function useSharedMutation(
  run: (data: unknown) => Promise<unknown>,
  done: () => void,
  message: string,
) {
  const query = useQueryClient(),
    notify = useUiStore((s) => s.notify);
  return useMutation({
    mutationFn: run,
    onMutate: () => ({
      epoch: getSessionEpoch(),
      id: useAuthStore.getState().user?.id,
    }),
    onSuccess: (_v, _variables, c) => {
      if (c?.epoch !== getSessionEpoch()) return;
      done();
      notify(message);
      void query.invalidateQueries({ queryKey: ["shared", c?.id] });
      void query.invalidateQueries({ queryKey: ["couple", c?.id] });
    },
  });
}
