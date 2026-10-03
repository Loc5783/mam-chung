import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, getSessionEpoch } from "../../lib/apiClient";
import { useAuthStore, Profile } from "../auth/store";
import { useUiStore } from "../../app/store";
import { CoupleData } from "./types";
export function useCoupleQuery<T>(
  name: string,
  path: string,
  params: Record<string, string | number> = {},
  poll = false,
) {
  const user = useAuthStore((s) => s.user)!;
  return useQuery({
    queryKey: ["couple", user.id, name, params],
    queryFn: async () => (await apiClient.get<T>(path, { params })).data,
    refetchInterval: poll ? 5000 : false,
  });
}
export function useCouple() {
  const viewerId = useAuthStore((s) => s.user!.id);
  const result = useCoupleQuery<{ couple: CoupleData | null }>(
    "me",
    "/couples/me",
    {},
    true,
  );
  useEffect(() => {
    const user = useAuthStore.getState().user;
    if (user?.id === viewerId && result.data && "couple" in result.data) {
      const coupleId = result.data.couple?.id ?? null;
      if (user.coupleId !== coupleId)
        useAuthStore.getState().updateUser({ ...user, coupleId });
    }
  }, [result.data, viewerId]);
  return result;
}
export function useCoupleMutation<T>(
  run: () => Promise<T>,
  message: string,
  done?: (v: T) => void,
) {
  const query = useQueryClient(),
    notify = useUiStore((s) => s.notify);
  return useMutation({
    mutationFn: run,
    onMutate: () => ({
      epoch: getSessionEpoch(),
      viewerId: useAuthStore.getState().user?.id,
    }),
    onSuccess: async (v, _variables, context) => {
      const current = () =>
        context?.epoch === getSessionEpoch() &&
        context?.viewerId === useAuthStore.getState().user?.id;
      if (!current()) return;
      done?.(v);
      notify(message);
      // The write has committed. Refresh failures must not hide its result.
      void query.invalidateQueries({ queryKey: ["couple", context?.viewerId] });
      try {
        const { data } = await apiClient.get<Profile>("/users/me");
        if (current() && data.id === context?.viewerId) {
          useAuthStore.getState().updateUser(data);
          query.setQueryData(["profile", data.id], data);
        }
      } catch {
        // The couple query reconciles membership on its next successful poll.
        void query.invalidateQueries({
          queryKey: ["profile", context?.viewerId],
        });
      }
    },
  });
}
