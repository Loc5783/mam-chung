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
export type ApiErrorInfo = {
  message: string;
  code?: string;
  status?: number;
  isNetworkError: boolean;
  isTimeout: boolean;
  isSessionChanged: boolean;
  isUnauthorized: boolean;
  isForbidden: boolean;
  isNotFound: boolean;
  isConflict: boolean;
  isValidationError: boolean;
  isRateLimited: boolean;
  isServerError: boolean;
  retryAfterSeconds?: number;
  fieldErrors?: Record<string, string>;
  raw?: unknown;
};

export function parseApiError(error: unknown): ApiErrorInfo {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data as
      | {
          error?: {
            code?: string;
            message?: string;
            details?: Array<{
              path?: (string | number)[];
              message?: string;
              code?: string;
            }>;
            retryAfter?: number;
          };
        }
      | undefined;
    const serverCode = data?.error?.code;
    const serverMsg = data?.error?.message;

    // 1. Session Epoch Changed
    if (error.code === "SESSION_CHANGED") {
      return {
        message: "Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại.",
        code: "SESSION_CHANGED",
        isNetworkError: false,
        isTimeout: false,
        isSessionChanged: true,
        isUnauthorized: true,
        isForbidden: false,
        isNotFound: false,
        isConflict: false,
        isValidationError: false,
        isRateLimited: false,
        isServerError: false,
        raw: error,
      };
    }

    // 2. Network error / Timeout
    const isTimeout =
      error.code === "ECONNABORTED" ||
      (typeof error.message === "string" &&
        error.message.toLowerCase().includes("timeout"));
    const isNetwork =
      !isTimeout &&
      (!navigator.onLine ||
        error.code === "ERR_NETWORK" ||
        error.message === "Network Error" ||
        (!error.response && !!error.request));

    if (isTimeout) {
      return {
        message:
          "Yêu cầu máy chủ quá thời gian (timeout). Vui lòng thử lại sau.",
        code: "TIMEOUT",
        isNetworkError: false,
        isTimeout: true,
        isSessionChanged: false,
        isUnauthorized: false,
        isForbidden: false,
        isNotFound: false,
        isConflict: false,
        isValidationError: false,
        isRateLimited: false,
        isServerError: false,
        raw: error,
      };
    }

    if (isNetwork) {
      return {
        message: "Mất kết nối mạng. Vui lòng kiểm tra đường truyền và thử lại.",
        code: "NETWORK_ERROR",
        isNetworkError: true,
        isTimeout: false,
        isSessionChanged: false,
        isUnauthorized: false,
        isForbidden: false,
        isNotFound: false,
        isConflict: false,
        isValidationError: false,
        isRateLimited: false,
        isServerError: false,
        raw: error,
      };
    }

    // 3. HTTP Status Mappings
    if (status === 401) {
      return {
        message:
          serverMsg || "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
        code: serverCode || "UNAUTHORIZED",
        status: 401,
        isNetworkError: false,
        isTimeout: false,
        isSessionChanged: false,
        isUnauthorized: true,
        isForbidden: false,
        isNotFound: false,
        isConflict: false,
        isValidationError: false,
        isRateLimited: false,
        isServerError: false,
        raw: error,
      };
    }

    if (status === 403) {
      return {
        message: serverMsg || "Bạn không có quyền thực hiện thao tác này.",
        code: serverCode || "FORBIDDEN",
        status: 403,
        isNetworkError: false,
        isTimeout: false,
        isSessionChanged: false,
        isUnauthorized: false,
        isForbidden: true,
        isNotFound: false,
        isConflict: false,
        isValidationError: false,
        isRateLimited: false,
        isServerError: false,
        raw: error,
      };
    }

    if (status === 404) {
      return {
        message: serverMsg || "Nội dung này không còn tồn tại hoặc đã bị xóa.",
        code: serverCode || "NOT_FOUND",
        status: 404,
        isNetworkError: false,
        isTimeout: false,
        isSessionChanged: false,
        isUnauthorized: false,
        isForbidden: false,
        isNotFound: true,
        isConflict: false,
        isValidationError: false,
        isRateLimited: false,
        isServerError: false,
        raw: error,
      };
    }

    if (status === 409) {
      return {
        message:
          serverMsg ||
          "Nội dung vừa được cập nhật bởi người ấy hoặc phiên khác. Vui lòng làm mới để xem bản mới nhất.",
        code: serverCode || "CONFLICT",
        status: 409,
        isNetworkError: false,
        isTimeout: false,
        isSessionChanged: false,
        isUnauthorized: false,
        isForbidden: false,
        isNotFound: false,
        isConflict: true,
        isValidationError: false,
        isRateLimited: false,
        isServerError: false,
        raw: error,
      };
    }

    if (status === 429) {
      const retryHeader = error.response?.headers?.["retry-after"];
      const retrySec = retryHeader
        ? Number(retryHeader)
        : data?.error?.retryAfter;
      let msg = "Thao tác quá nhanh, vui lòng đợi một chút rồi thử lại.";
      if (
        serverCode === "TASK_NUDGE_RATE_LIMIT" ||
        serverMsg?.includes("nhắc")
      ) {
        msg = "Mỗi công việc chỉ có thể gửi nhắc nhẹ 1 lần mỗi giờ.";
      } else if (retrySec && !isNaN(retrySec)) {
        msg = `Thao tác quá nhanh, vui lòng đợi ${retrySec} giây rồi thử lại.`;
      }
      return {
        message: serverMsg || msg,
        code: serverCode || "RATE_LIMITED",
        status: 429,
        retryAfterSeconds: retrySec,
        isNetworkError: false,
        isTimeout: false,
        isSessionChanged: false,
        isUnauthorized: false,
        isForbidden: false,
        isNotFound: false,
        isConflict: false,
        isValidationError: false,
        isRateLimited: true,
        isServerError: false,
        raw: error,
      };
    }

    if (status === 400 || status === 422) {
      const fieldErrors: Record<string, string> = {};
      if (Array.isArray(data?.error?.details)) {
        for (const item of data.error.details) {
          if (item.path && item.path.length > 0 && item.message) {
            fieldErrors[item.path.join(".")] = item.message;
          }
        }
      }
      return {
        message:
          serverMsg || "Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại thông tin.",
        code: serverCode || "VALIDATION_ERROR",
        status,
        fieldErrors,
        isNetworkError: false,
        isTimeout: false,
        isSessionChanged: false,
        isUnauthorized: false,
        isForbidden: false,
        isNotFound: false,
        isConflict: false,
        isValidationError: true,
        isRateLimited: false,
        isServerError: false,
        raw: error,
      };
    }

    if (status && status >= 500) {
      return {
        message:
          serverMsg ||
          "Hệ thống đang gặp sự cố. Dữ liệu của bạn vẫn an toàn, vui lòng thử lại sau.",
        code: serverCode || "SERVER_ERROR",
        status,
        isNetworkError: false,
        isTimeout: false,
        isSessionChanged: false,
        isUnauthorized: false,
        isForbidden: false,
        isNotFound: false,
        isConflict: false,
        isValidationError: false,
        isRateLimited: false,
        isServerError: true,
        raw: error,
      };
    }

    return {
      message: serverMsg || "Không kết nối được máy chủ. Vui lòng thử lại.",
      code: serverCode,
      status,
      isNetworkError: false,
      isTimeout: false,
      isSessionChanged: false,
      isUnauthorized: false,
      isForbidden: false,
      isNotFound: false,
      isConflict: false,
      isValidationError: false,
      isRateLimited: false,
      isServerError: false,
      raw: error,
    };
  }

  if (error instanceof Error) {
    if (error.message.includes("Mất kết nối")) {
      return {
        message: error.message,
        code: "NETWORK_ERROR",
        isNetworkError: true,
        isTimeout: false,
        isSessionChanged: false,
        isUnauthorized: false,
        isForbidden: false,
        isNotFound: false,
        isConflict: false,
        isValidationError: false,
        isRateLimited: false,
        isServerError: false,
        raw: error,
      };
    }
    if (error.message.includes("Phiên đăng nhập đã thay đổi")) {
      return {
        message: error.message,
        code: "SESSION_CHANGED",
        isNetworkError: false,
        isTimeout: false,
        isSessionChanged: true,
        isUnauthorized: true,
        isForbidden: false,
        isNotFound: false,
        isConflict: false,
        isValidationError: false,
        isRateLimited: false,
        isServerError: false,
        raw: error,
      };
    }
    return {
      message: "Có lỗi xảy ra. Vui lòng thử lại.",
      code: "UNKNOWN_ERROR",
      isNetworkError: false,
      isTimeout: false,
      isSessionChanged: false,
      isUnauthorized: false,
      isForbidden: false,
      isNotFound: false,
      isConflict: false,
      isValidationError: false,
      isRateLimited: false,
      isServerError: false,
      raw: error,
    };
  }

  return {
    message: "Có lỗi xảy ra. Vui lòng thử lại.",
    isNetworkError: false,
    isTimeout: false,
    isSessionChanged: false,
    isUnauthorized: false,
    isForbidden: false,
    isNotFound: false,
    isConflict: false,
    isValidationError: false,
    isRateLimited: false,
    isServerError: false,
    raw: error,
  };
}

export function errorMessage(error: unknown): string {
  return parseApiError(error).message;
}
