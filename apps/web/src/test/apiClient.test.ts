import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
const captured = vi.hoisted(() => ({ clients: [] as unknown[] }));
vi.mock("axios", async () => {
  const actual = await vi.importActual<typeof import("axios")>("axios");
  return {
    ...actual,
    default: {
      ...actual.default,
      create: (...args: Parameters<typeof actual.default.create>) => {
        const client = actual.default.create(...args);
        captured.clients.push(client);
        return client;
      },
    },
  };
});
import {
  apiClient,
  clearSession,
  refreshSession,
  restoreSession,
  setSession,
} from "../lib/apiClient";
import { useAuthStore } from "../features/auth/store";
const profile = {
  id: "test-id",
  email: "minh@example.test",
  name: "Minh",
  avatar: null,
  timezone: "Asia/Ho_Chi_Minh",
  coupleId: null,
  createdAt: "2026-10-02T00:00:00Z",
};
const refresh = captured.clients[1] as AxiosInstance;
const response = (
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
): AxiosResponse => ({
  data,
  status,
  statusText: String(status),
  headers: {},
  config,
});
const fail = (config: InternalAxiosRequestConfig, status: number) =>
  Promise.reject(
    new AxiosError(
      "Rejected",
      undefined,
      config,
      undefined,
      response(config, { error: { message: "Lỗi" } }, status),
    ),
  );
beforeEach(() => {
  clearSession();
  setSession({ accessToken: "expired", user: profile });
});
afterEach(() => {
  vi.restoreAllMocks();
  clearSession();
});
describe("Quản lý access token và refresh", () => {
  it("nhiều yêu cầu 401 đồng thời chỉ refresh một lần rồi thử lại", async () => {
    let refreshCalls = 0;
    refresh.defaults.adapter = async (config) => {
      refreshCalls++;
      await new Promise((resolve) => setTimeout(resolve, 15));
      return response(config, { accessToken: "renewed", user: profile });
    };
    apiClient.defaults.adapter = async (config) =>
      config.headers.Authorization === "Bearer renewed"
        ? response(config, { ok: true })
        : fail(config, 401);
    const results = await Promise.all([
      apiClient.get("/users/me"),
      apiClient.get("/protected"),
    ]);
    expect(results.every((r) => r.data.ok)).toBe(true);
    expect(refreshCalls).toBe(1);
    expect(useAuthStore.getState().accessToken).toBe("renewed");
  });
  it("refresh lỗi thu hồi phiên frontend, không lặp vô hạn", async () => {
    let requests = 0;
    refresh.defaults.adapter = (config) => fail(config, 401);
    apiClient.defaults.adapter = (config) => {
      requests++;
      return fail(config, 401);
    };
    await expect(apiClient.get("/users/me")).rejects.toBeInstanceOf(AxiosError);
    expect(requests).toBe(1);
    expect(useAuthStore.getState().status).toBe("anonymous");
  });
  it("đăng nhập sai không tự gọi refresh", async () => {
    const refreshCall = vi.fn((config) => fail(config, 401));
    refresh.defaults.adapter = refreshCall;
    apiClient.defaults.adapter = (config) => fail(config, 401);
    await expect(apiClient.post("/auth/login", {})).rejects.toBeInstanceOf(
      AxiosError,
    );
    expect(refreshCall).not.toHaveBeenCalled();
  });
  it("lỗi nghiệp vụ sau retry giữ phiên đã làm mới", async () => {
    refresh.defaults.adapter = async (config) =>
      response(config, { accessToken: "renewed", user: profile });
    apiClient.defaults.adapter = (config) =>
      fail(
        config,
        config.headers.Authorization === "Bearer renewed" ? 409 : 401,
      );
    await expect(apiClient.put("/users/me", {})).rejects.toMatchObject({
      response: { status: 409 },
    });
    expect(useAuthStore.getState().status).toBe("authenticated");
  });
  it("refresh trả chậm không ghi đè phiên đăng nhập mới", async () => {
    let resolve!: (response: AxiosResponse) => void;
    let requestConfig!: InternalAxiosRequestConfig;
    refresh.defaults.adapter = (config) => {
      requestConfig = config;
      return new Promise((res) => {
        resolve = res;
      });
    };
    const pending = refreshSession();
    await vi.waitFor(() => expect(resolve).toBeTypeOf("function"));
    setSession({ accessToken: "new-login", user: { ...profile, name: "Lan" } });
    resolve(response(requestConfig, { accessToken: "stale", user: profile }));
    await expect(pending).rejects.toThrow("Phiên đã thay đổi.");
    expect(useAuthStore.getState().accessToken).toBe("new-login");
  });
  it("khôi phục phiên lỗi trả chậm không đăng xuất người vừa đăng nhập", async () => {
    let reject!: (error: unknown) => void;
    let config!: InternalAxiosRequestConfig;
    refresh.defaults.adapter = (c) => {
      config = c;
      return new Promise((_resolve, rej) => {
        reject = rej;
      });
    };
    const pending = restoreSession();
    await vi.waitFor(() => expect(reject).toBeTypeOf("function"));
    setSession({ accessToken: "new-login", user: profile });
    reject(
      new AxiosError(
        "expired",
        undefined,
        config,
        undefined,
        response(config, {}, 401),
      ),
    );
    await pending;
    expect(useAuthStore.getState().accessToken).toBe("new-login");
  });
  it("khôi phục mất mạng có trạng thái thử lại; cookie hết hạn thành anonymous", async () => {
    refresh.defaults.adapter = () =>
      Promise.reject(new AxiosError("Network error"));
    await restoreSession();
    expect(useAuthStore.getState().status).toBe("error");
    refresh.defaults.adapter = (config) => fail(config, 401);
    await restoreSession();
    expect(useAuthStore.getState().status).toBe("anonymous");
  });
  it("có Web Locks thì phối hợp refresh giữa các tab", async () => {
    const previous = Object.getOwnPropertyDescriptor(navigator, "locks");
    const lock = vi.fn((_name: string, perform: () => Promise<unknown>) =>
      perform(),
    );
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: { request: lock },
    });
    try {
      refresh.defaults.adapter = async (config) =>
        response(config, { accessToken: "locked-renewed", user: profile });
      await refreshSession();
      expect(lock).toHaveBeenCalledWith(
        "mam-chung-refresh",
        expect.any(Function),
      );
    } finally {
      if (previous) Object.defineProperty(navigator, "locks", previous);
      else Reflect.deleteProperty(navigator, "locks");
    }
    expect(axios.isAxiosError(new AxiosError())).toBe(true);
  });
});

it("401 cũ sau đổi tài khoản không được thử lại thao tác dưới người mới", async () => {
  let reject!: (reason: unknown) => void;
  let old!: InternalAxiosRequestConfig;
  const renew = vi.fn(async (c: InternalAxiosRequestConfig) =>
    response(c, {
      accessToken: "new-refreshed",
      user: { ...profile, id: "other" },
    }),
  );
  refresh.defaults.adapter = renew;
  const requests = vi.fn((c: InternalAxiosRequestConfig) => {
    old = c;
    return new Promise<AxiosResponse>((_res, rej) => {
      reject = rej;
    });
  });
  apiClient.defaults.adapter = requests;
  const pending = apiClient.post("/transactions", { amount: 100 });
  await vi.waitFor(() => expect(reject).toBeTypeOf("function"));
  setSession({ accessToken: "other-token", user: { ...profile, id: "other" } });
  reject(
    new AxiosError(
      "expired",
      undefined,
      old,
      undefined,
      response(old, {}, 401),
    ),
  );
  await expect(pending).rejects.toThrow("Phiên đã thay đổi.");
  expect(requests).toHaveBeenCalledTimes(1);
  expect(renew).not.toHaveBeenCalled();
  expect(useAuthStore.getState().accessToken).toBe("other-token");
});
it("phản hồi thành công cũ không được đi vào hồ sơ/cache của phiên mới", async () => {
  let resolve!: (r: AxiosResponse) => void;
  let config!: InternalAxiosRequestConfig;
  apiClient.defaults.adapter = (c) => {
    config = c;
    return new Promise((res) => {
      resolve = res;
    });
  };
  const pending = apiClient.get("/users/me");
  await vi.waitFor(() => expect(resolve).toBeTypeOf("function"));
  setSession({ accessToken: "other-token", user: { ...profile, id: "other" } });
  resolve(response(config, profile));
  await expect(pending).rejects.toThrow("Phiên đã thay đổi.");
  expect(useAuthStore.getState().user?.id).toBe("other");
});
it("refresh mất mạng giữ phiên để người dùng thử lại", async () => {
  apiClient.defaults.adapter = (c) => fail(c, 401);
  refresh.defaults.adapter = () =>
    Promise.reject(new AxiosError("Network error"));
  await expect(apiClient.get("/users/me")).rejects.toThrow("Network error");
  expect(useAuthStore.getState().accessToken).toBe("expired");
});
it("cookie của tài khoản khác không dùng để thử lại giao dịch", async () => {
  let calls = 0;
  apiClient.defaults.adapter = (c) => {
    calls++;
    return fail(c, 401);
  };
  refresh.defaults.adapter = async (c) =>
    response(c, { accessToken: "other", user: { ...profile, id: "other" } });
  await expect(apiClient.post("/transactions", {})).rejects.toThrow(
    "Phiên đã thay đổi.",
  );
  expect(calls).toBe(1);
  expect(useAuthStore.getState().user).toBeNull();
});

it("phiên mới không dùng chung refresh đang chờ của phiên cũ", async () => {
  let rejectOld!: (reason: unknown) => void;
  let calls = 0;
  refresh.defaults.adapter = (c) => {
    calls++;
    if (calls === 1)
      return new Promise<AxiosResponse>((_res, rej) => {
        rejectOld = rej;
      });
    return Promise.resolve(
      response(c, {
        accessToken: "renewed-new",
        user: { ...profile, id: "other" },
      }),
    );
  };
  const old = refreshSession();
  const rejected = expect(old).rejects.toThrow("Old refresh failed");
  await vi.waitFor(() => expect(rejectOld).toBeTypeOf("function"));
  setSession({ accessToken: "new-login", user: { ...profile, id: "other" } });
  expect((await refreshSession()).accessToken).toBe("renewed-new");
  rejectOld(new AxiosError("Old refresh failed"));
  await rejected;
  expect(calls).toBe(2);
  expect(useAuthStore.getState().accessToken).toBe("renewed-new");
});
