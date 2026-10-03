import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
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
let refreshEpoch = -1;
type SessionConfig = InternalAxiosRequestConfig & {
  retried?: boolean;
  sessionEpoch?: number;
};
export const getSessionEpoch = () => sessionEpoch;
const sessionChanged = (config?: InternalAxiosRequestConfig) =>
  new AxiosError("Phiên đã thay đổi.", "SESSION_CHANGED", config);
export function clearSession() {
  sessionEpoch++;
  useAuthStore.getState().clear();
  queryClient.clear();
}
export function setSession(session: SessionResponse) {
  sessionEpoch++;
  queryClient.clear();
  useAuthStore.getState().setSession(session.accessToken, session.user);
}
export async function refreshSession(): Promise<SessionResponse> {
  if (!refreshPromise || refreshEpoch !== sessionEpoch) {
    const epoch = sessionEpoch;
    const userId = useAuthStore.getState().user?.id;
    refreshEpoch = epoch;
    const perform = async () => {
      if (epoch !== sessionEpoch) throw sessionChanged();
      const { data } =
        await refreshClient.post<SessionResponse>("/auth/refresh");
      if (epoch !== sessionEpoch) throw sessionChanged();
      if (userId && data.user.id !== userId) {
        clearSession();
        throw sessionChanged();
      }
      useAuthStore.getState().setSession(data.accessToken, data.user);
      return data;
    };
    const execute = async () =>
      "locks" in navigator
        ? await navigator.locks.request("mam-chung-refresh", perform)
        : await perform();
    const pending = execute().finally(() => {
      if (refreshPromise === pending) refreshPromise = null;
    });
    refreshPromise = pending;
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
apiClient.interceptors.request.use((rawConfig) => {
  const config = rawConfig as SessionConfig;
  if (config.sessionEpoch !== undefined && config.sessionEpoch !== sessionEpoch)
    throw sessionChanged(config);
  config.sessionEpoch = sessionEpoch;
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
apiClient.interceptors.response.use(
  (response) => {
    if ((response.config as SessionConfig).sessionEpoch !== sessionEpoch)
      throw sessionChanged(response.config);
    return response;
  },
  async (error) => {
    const config = error.config as SessionConfig | undefined;
    if (
      config?.sessionEpoch !== undefined &&
      config.sessionEpoch !== sessionEpoch
    )
      throw sessionChanged(config);
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
      if (
        epoch === sessionEpoch &&
        axios.isAxiosError(refreshError) &&
        refreshError.response?.status === 401
      )
        clearSession();
      throw refreshError;
    }
    if (epoch !== sessionEpoch) throw sessionChanged(config);
    config.headers.Authorization = `Bearer ${session.accessToken}`;
    return apiClient(config);
  },
);
export function errorMessage(error: unknown) {
  if (axios.isAxiosError(error))
    return (
      (error.code === "SESSION_CHANGED" ? error.message : undefined) ||
      error.response?.data?.error?.message ||
      "Không kết nối được máy chủ. Vui lòng thử lại."
    );
  return "Có lỗi xảy ra. Vui lòng thử lại.";
}
