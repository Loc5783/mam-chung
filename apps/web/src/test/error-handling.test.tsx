import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, renderHook, act } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { parseApiError, errorMessage, apiClient } from "../lib/apiClient";
import { safeStorage } from "../lib/safeStorage";
import { ViewErrorBoundary } from "../components/ui/ViewErrorBoundary";
import { useTaskWrite } from "../features/tasks/useTaskWrite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Task, TaskPage } from "../features/tasks/types";

function createAxiosError({
  status,
  data,
  code,
  message = "Request failed",
  headers = {},
}: {
  status?: number;
  data?: unknown;
  code?: string;
  message?: string;
  headers?: Record<string, string>;
}) {
  const axiosHeaders = new AxiosHeaders(headers);
  const error = new AxiosError(
    message,
    code,
    { headers: axiosHeaders },
    undefined,
    {
      status: status ?? 500,
      statusText: status ? String(status) : "Error",
      headers: axiosHeaders,
      config: { headers: axiosHeaders },
      data,
    },
  );
  return error;
}

describe("Lớp xử lý lỗi Frontend (Giai đoạn B1)", () => {
  describe("parseApiError & errorMessage", () => {
    it("handles SESSION_CHANGED and 401 gracefully", () => {
      const sessionErr = new AxiosError(
        "Phiên đã thay đổi.",
        "SESSION_CHANGED",
      );
      const parsedSession = parseApiError(sessionErr);
      expect(parsedSession.isSessionChanged).toBe(true);
      expect(parsedSession.isUnauthorized).toBe(true);
      expect(parsedSession.message).toContain("Phiên đăng nhập đã thay đổi");

      const authErr = createAxiosError({
        status: 401,
        data: { error: { code: "UNAUTHORIZED", message: "Token hết hạn" } },
      });
      const parsedAuth = parseApiError(authErr);
      expect(parsedAuth.isUnauthorized).toBe(true);
      expect(parsedAuth.message).toBe("Token hết hạn");
    });

    it("handles Network Error and Timeout with clear Vietnamese messages", () => {
      const netErr = createAxiosError({
        code: "ERR_NETWORK",
        message: "Network Error",
      });
      const parsedNet = parseApiError(netErr);
      expect(parsedNet.isNetworkError).toBe(true);
      expect(parsedNet.message).toContain("Mất kết nối mạng");

      const timeoutErr = createAxiosError({
        code: "ECONNABORTED",
        message: "timeout of 10000ms exceeded",
      });
      const parsedTimeout = parseApiError(timeoutErr);
      expect(parsedTimeout.isTimeout).toBe(true);
      expect(parsedTimeout.message).toContain("quá thời gian");
    });

    it("handles 403 Forbidden with proper explanation", () => {
      const forbiddenErr = createAxiosError({
        status: 403,
        data: {
          error: {
            code: "FORBIDDEN",
            message: "Chỉ người tạo mới có thể chuyển việc.",
          },
        },
      });
      const parsed = parseApiError(forbiddenErr);
      expect(parsed.isForbidden).toBe(true);
      expect(parsed.message).toBe("Chỉ người tạo mới có thể chuyển việc.");

      const defaultForbidden = createAxiosError({ status: 403 });
      expect(parseApiError(defaultForbidden).message).toContain(
        "không có quyền",
      );
    });

    it("handles 404 Not Found", () => {
      const notFoundErr = createAxiosError({
        status: 404,
        data: {
          error: { code: "TASK_NOT_FOUND", message: "Công việc đã bị xóa." },
        },
      });
      const parsed = parseApiError(notFoundErr);
      expect(parsed.isNotFound).toBe(true);
      expect(parsed.message).toBe("Công việc đã bị xóa.");

      const defaultNotFound = createAxiosError({ status: 404 });
      expect(parseApiError(defaultNotFound).message).toContain(
        "không còn tồn tại hoặc đã bị xóa",
      );
    });

    it("handles 409 Conflict (revision conflict)", () => {
      const conflictErr = createAxiosError({
        status: 409,
        data: {
          error: {
            code: "TASK_CHANGED",
            message: "Người ấy vừa sửa việc này.",
          },
        },
      });
      const parsed = parseApiError(conflictErr);
      expect(parsed.isConflict).toBe(true);
      expect(parsed.message).toBe("Người ấy vừa sửa việc này.");
    });

    it("handles 422 / 400 Validation Error and extracts fieldErrors", () => {
      const valErr = createAxiosError({
        status: 422,
        data: {
          error: {
            code: "VALIDATION_ERROR",
            message: "Dữ liệu không hợp lệ.",
            details: [
              { path: ["title"], message: "Tiêu đề không được để trống" },
              { path: ["deadline"], message: "Ngày hạn không hợp lệ" },
            ],
          },
        },
      });
      const parsed = parseApiError(valErr);
      expect(parsed.isValidationError).toBe(true);
      expect(parsed.fieldErrors?.title).toBe("Tiêu đề không được để trống");
      expect(parsed.fieldErrors?.deadline).toBe("Ngày hạn không hợp lệ");
    });

    it("handles 429 Rate Limit with Retry-After and nudge limit", () => {
      const nudgeErr = createAxiosError({
        status: 429,
        data: { error: { code: "TASK_NUDGE_RATE_LIMIT" } },
      });
      const parsedNudge = parseApiError(nudgeErr);
      expect(parsedNudge.isRateLimited).toBe(true);
      expect(parsedNudge.message).toContain("1 lần mỗi giờ");

      const rateErr = createAxiosError({
        status: 429,
        headers: { "retry-after": "15" },
      });
      const parsedRate = parseApiError(rateErr);
      expect(parsedRate.isRateLimited).toBe(true);
      expect(parsedRate.retryAfterSeconds).toBe(15);
      expect(parsedRate.message).toContain("15 giây");
    });

    it("handles 500 Server Error safely without leaking internals", () => {
      const serverErr = createAxiosError({
        status: 500,
      });
      const msg = errorMessage(serverErr);
      expect(msg).toContain("Hệ thống đang gặp sự cố");
    });
  });

  describe("safeStorage", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("safely reads and writes primitive values", () => {
      safeStorage.setItem("test_key", "hello");
      expect(safeStorage.getItem("test_key")).toBe("hello");
      safeStorage.removeItem("test_key");
      expect(safeStorage.getItem("test_key")).toBeNull();
    });

    it("safely reads and writes JSON with validation", () => {
      const payload = { id: 1, name: "Mầm" };
      safeStorage.setJSON("test_json", payload);

      const isValid = (v: unknown): v is { id: number; name: string } =>
        typeof v === "object" && v !== null && "id" in v && "name" in v;

      expect(safeStorage.getJSON("test_json", isValid)).toEqual(payload);
    });

    it("handles corrupted JSON without throwing errors", () => {
      localStorage.setItem("bad_json", "{invalid-json: missing quotes");
      expect(safeStorage.getJSON("bad_json")).toBeNull();
    });

    it("handles storage exceptions gracefully", () => {
      const spy = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(() => {
          throw new Error("QuotaExceededError");
        });
      expect(safeStorage.setItem("any", "val")).toBe(false);
      spy.mockRestore();
    });
  });

  describe("ViewErrorBoundary", () => {
    it("renders children normally when there is no error", () => {
      render(
        <ViewErrorBoundary name="Kanban">
          <div>Nội dung Kanban bình thường</div>
        </ViewErrorBoundary>,
      );
      expect(
        screen.getByText("Nội dung Kanban bình thường"),
      ).toBeInTheDocument();
    });

    it("catches rendering errors and displays isolated fallback with reset button", () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      function CrashingComponent(): JSX.Element {
        throw new Error("Lỗi giả lập trong view");
      }

      render(
        <ViewErrorBoundary name="Lịch">
          <CrashingComponent />
        </ViewErrorBoundary>,
      );

      expect(
        screen.getByText(
          "Chưa tải được phần Lịch. Dữ liệu của bạn vẫn an toàn.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Tải lại Lịch" }),
      ).toBeInTheDocument();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("useTaskWrite 404 cache purge", () => {
    it("evicts task from cache when server responds with 404", async () => {
      const queryClient = new QueryClient();
      const mockTask: Task = {
        id: "task-deleted",
        title: "Việc đã bị đối phương xóa",
        description: "",
        status: "TODO",
        priority: "MEDIUM",
        kind: "task",
        recurrence: "none",
        deadline: null,
        deadlineHasTime: false,
        deadlineTime: null,
        deadlineTimezone: null,
        startDate: null,
        completedAt: null,
        assignedTo: null,
        listId: null,
        coupleId: "couple-1",
        labels: [],
        checklist: [],
        revision: 1,
        estimateMinutes: null,
        timeSpentSeconds: 0,
        reminderAt: null,
        readOnly: false,
        createdBy: "user-1",
        creatorName: "Người dùng",
        sourceTaskId: null,
        createdAt: new Date().toISOString(),
      };

      const initialPage: TaskPage = {
        items: [mockTask],
        total: 1,
        page: 1,
        limit: 50,
        readOnly: false,
      };

      queryClient.setQueryData(["tasks", undefined], initialPage);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      const { result } = renderHook(() => useTaskWrite(), { wrapper });

      // Trigger mutation with simulated 404
      const notFoundAxiosError = createAxiosError({
        status: 404,
        data: { error: { message: "Công việc không còn tồn tại" } },
      });

      // Mock apiClient.patch to throw 404
      vi.spyOn(apiClient, "patch").mockRejectedValue(notFoundAxiosError);

      await act(async () => {
        try {
          await result.current.mutateAsync({ task: mockTask, status: "DONE" });
        } catch {
          // Expected
        }
      });

      // Check cache: task should have been evicted!
      const cached = queryClient.getQueryData<TaskPage>(["tasks", undefined]);
      expect(
        cached?.items.find((t) => t.id === "task-deleted"),
      ).toBeUndefined();
      expect(cached?.total).toBe(0);
    });
  });
});
