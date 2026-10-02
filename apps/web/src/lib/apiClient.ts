import axios, { InternalAxiosRequestConfig } from "axios";
import { useAuthStore, Profile } from "../features/auth/store";
import { queryClient } from "./queryClient";
export type SessionResponse = { accessToken: string; user: Profile };
export const apiClient = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 10000,
});
const refreshClient = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 10000,
});
let refreshPromise: Promise<SessionResponse> | null = null;
let sessionEpoch = 0;
export function clearSession() {
  sessionEpoch++;
  useAuthStore.getState().clear();
  queryClient.clear();
}
export function setSession(session: SessionResponse) {
  sessionEpoch++;
  useAuthStore.getState().setSession(session.accessToken, session.user);
}
export async function refreshSession(): Promise<SessionResponse> {
  if (!refreshPromise) {
    const epoch = sessionEpoch;
    const perform = async () => {
      const { data } =
        await refreshClient.post<SessionResponse>("/auth/refresh");
      if (epoch !== sessionEpoch) throw new Error("Phiên đã thay đổi.");
      useAuthStore.getState().setSession(data.accessToken, data.user);
      return data;
    };
    const execute = async () =>
      "locks" in navigator
        ? await navigator.locks.request("mam-chung-refresh", perform)
        : await perform();
    refreshPromise = execute().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}
export async function restoreSession() {
  const epoch = sessionEpoch;
  try {
    await refreshSession();
  } catch (error) {
    if (epoch !== sessionEpoch) return;
    if (axios.isAxiosError(error) && error.response?.status === 401)
      clearSession();
    else useAuthStore.getState().setError();
  }
}
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as
      (InternalAxiosRequestConfig & { retried?: boolean }) | undefined;
    if (
      error.response?.status !== 401 ||
      !config ||
      config.retried ||
      ["/auth/login", "/auth/register", "/auth/refresh"].includes(
        config.url ?? "",
      )
    )
      throw error;
    config.retried = true;
    const epoch = sessionEpoch;
    let session: SessionResponse;
    try {
      session = await refreshSession();
    } catch (refreshError) {
      if (epoch === sessionEpoch) clearSession();
      throw refreshError;
    }
    config.headers.Authorization = `Bearer ${session.accessToken}`;
    return apiClient(config);
  },
);
export function errorMessage(error: unknown) {
  if (axios.isAxiosError(error))
    return (
      error.response?.data?.error?.message ||
      "Không kết nối được máy chủ. Vui lòng thử lại."
    );
  return "Có lỗi xảy ra. Vui lòng thử lại.";
}
