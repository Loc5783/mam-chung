import { create } from "zustand";
export type Profile = {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  timezone: string;
  coupleId: string | null;
  role?: "user" | "admin";
  createdAt: string;
};
type AuthState = {
  user: Profile | null;
  accessToken: string | null;
  status: "loading" | "authenticated" | "anonymous" | "error";
  setSession: (accessToken: string, user: Profile) => void;
  updateUser: (user: Profile) => void;
  clear: () => void;
  setError: () => void;
  setLoading: () => void;
};
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: "loading",
  setSession: (accessToken, user) =>
    set({ accessToken, user, status: "authenticated" }),
  updateUser: (user) => set({ user }),
  clear: () => set({ user: null, accessToken: null, status: "anonymous" }),
  setError: () => set({ user: null, accessToken: null, status: "error" }),
  setLoading: () => set({ status: "loading" }),
}));
