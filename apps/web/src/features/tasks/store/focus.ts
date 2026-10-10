import { create } from "zustand";
import { useAuthStore } from "../../auth/store";
export type FocusSession = {
  userId: string;
  taskId: string;
  title: string;
  phase: "work" | "rest";
  workMinutes: number;
  restMinutes: number;
  elapsedMs: number;
  runningSince: number | null;
  sessionId: string;
  pendingSeconds: number | null;
};
export const useFocusStore = create<{
  session: FocusSession | null;
  set: (session: FocusSession | null) => void;
}>((set) => ({ session: null, set: (session) => set({ session }) }));
useAuthStore.subscribe((current, previous) => {
  if (current.user?.id !== previous.user?.id)
    useFocusStore.getState().set(null);
});
export function focusElapsed(session: FocusSession, now: number) {
  const limit =
    (session.phase === "work" ? session.workMinutes : session.restMinutes) *
    60000;
  return Math.min(
    limit,
    Math.max(
      0,
      session.elapsedMs +
        (session.runningSince === null
          ? 0
          : Math.max(0, now - session.runningSince)),
    ),
  );
}
