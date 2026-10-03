import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/apiClient";
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
    onSuccess: async (v) => {
      const { data } = await apiClient.get<Profile>("/users/me");
      useAuthStore.getState().updateUser(data);
      await query.invalidateQueries({ queryKey: ["couple"] });
      done?.(v);
      notify(message);
    },
  });
}
