import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { KanbanView } from "../features/tasks/components/KanbanView";
import { CalendarView } from "../features/tasks/components/CalendarView";
import { FocusMode } from "../features/tasks/components/FocusMode";
import { TemplatePicker } from "../features/tasks/components/TemplatePicker";
import { ShoppingView } from "../features/tasks/components/ShoppingView";
import { TaskExtras } from "../features/tasks/components/TaskExtras";
import { QuickAddBar } from "../features/tasks/components/QuickAddBar";
import { FormattedDescription, isSafeUrl } from "../features/tasks/components/FormattedDescription";
import { useTaskWrite } from "../features/tasks/useTaskWrite";
import { useAuthStore } from "../features/auth/store";
import { useFocusStore } from "../features/tasks/store/focus";
import { useUiStore } from "../app/store";
import { apiClient } from "../lib/apiClient";
import type { Task, Status } from "../features/tasks/types";

const mockUser = {
  id: "user-1",
  name: "Minh",
  email: "minh@test.com",
  avatar: null,
  timezone: "Asia/Ho_Chi_Minh",
  coupleId: "couple-1",
  createdAt: "2026-10-01T00:00:00Z",
};

const mockTask: Task = {
  id: "task-1",
  title: "Mua rau sạch",
  description: "Mua ở **siêu thị** hoặc [chợ](https://cho.vn)",
  deadline: "2026-10-10",
  priority: "MEDIUM",
  status: "TODO",
  assignedTo: "user-2",
  createdBy: "user-1",
  creatorName: "Minh",
  coupleId: "couple-1",
  kind: "task",
  labels: ["rau", "chợ"],
  checklist: [{ id: "c1", text: "Rau muống", done: false }],
  recurrence: "none",
  completedAt: null,
  sourceTaskId: null,
  revision: 0,
  createdAt: "2026-10-01T00:00:00Z",
  readOnly: false,
};

let queryClient: QueryClient;

function renderWithProviders(ui: React.ReactElement) {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  useAuthStore.getState().setSession("test-token", mockUser);
  useFocusStore.getState().set(null);

  // Default mocks for network safety
  vi.spyOn(apiClient, "get").mockImplementation(async (url) => ({
    data: url.includes("/activity")
      ? { items: [], total: 0 }
      : url.startsWith("/tasks/")
        ? mockTask
        : { items: [mockTask], total: 1, page: 1, limit: 100 },
  }));
  vi.spyOn(apiClient, "post").mockImplementation(async () => ({
    data: {},
  }));
  vi.spyOn(apiClient, "patch").mockImplementation(async () => ({
    data: mockTask,
  }));
});

describe("FormattedDescription Component", () => {
  it("renders bold, italic, and bullet lists safely", () => {
    const markdown = "Dòng 1: **đậm** và *nghiêng*\n- Mục danh sách 1\n- Mục danh sách 2";
    render(<FormattedDescription text={markdown} />);

    expect(screen.getByText("đậm").tagName).toBe("STRONG");
    expect(screen.getByText("nghiêng").tagName).toBe("EM");
    expect(screen.getByText("Mục danh sách 1").tagName).toBe("LI");
    expect(screen.getByText("Mục danh sách 2").tagName).toBe("LI");
  });

  it("renders safe http and https links with security attributes", () => {
    const text = "Xem tại [Google](https://google.com) và [Nội bộ](http://local.test)";
    render(<FormattedDescription text={text} />);

    const googleLink = screen.getByRole("link", { name: "Google" });
    expect(googleLink).toHaveAttribute("href", "https://google.com");
    expect(googleLink).toHaveAttribute("target", "_blank");
    expect(googleLink).toHaveAttribute("rel", "noopener noreferrer");

    const localLink = screen.getByRole("link", { name: "Nội bộ" });
    expect(localLink).toHaveAttribute("href", "http://local.test");
  });

  it("strictly rejects javascript:, data:, and malicious links without creating an <a> element", () => {
    const text = "Thử [Hack](javascript:alert('xss')) hoặc [Data](data:text/html,evil)";
    render(<FormattedDescription text={text} />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(/javascript:alert\('xss'\)/)).toBeInTheDocument();
  });

  it("neutralizes raw html tags and script injections via React escaping", () => {
    const malicious = '<script>alert("xss")</script><img src="x" onerror="alert(1)">';
    render(<FormattedDescription text={malicious} />);

    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText(/<script>alert\("xss"\)<\/script>/)).toBeInTheDocument();
  });

  it("isSafeUrl helper validates strict protocols", () => {
    expect(isSafeUrl("https://example.com")).toBe(true);
    expect(isSafeUrl("http://example.com")).toBe(true);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("data:text/html,abc")).toBe(false);
    expect(isSafeUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeUrl("not-a-valid-url")).toBe(false);
  });
});

describe("KanbanView Component", () => {
  it("renders tasks inside status columns and handles status selection", () => {
    const onStatus = vi.fn();
    const tasks: Task[] = [
      { ...mockTask, id: "t1", status: "TODO" },
      { ...mockTask, id: "t2", status: "IN_PROGRESS" },
    ];

    render(
      <KanbanView
        tasks={tasks}
        disabled={false}
        onStatus={onStatus}
        render={(task) => (
          <div>
            <span>{task.title}</span>
            <select
              aria-label={`Trạng thái của ${task.id}`}
              value={task.status}
              onChange={(e) => onStatus(task, e.target.value as Status)}
            >
              <option value="TODO">Cần làm</option>
              <option value="IN_PROGRESS">Đang làm</option>
              <option value="DONE">Hoàn thành</option>
            </select>
          </div>
        )}
      />,
    );

    expect(screen.getByRole("heading", { name: /Cần làm/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Đang làm/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Hoàn thành/ })).toBeInTheDocument();

    const select = screen.getByLabelText("Trạng thái của t1");
    fireEvent.change(select, { target: { value: "DONE" } });
    expect(onStatus).toHaveBeenCalledWith(tasks[0], "DONE");
  });

  it("has accessible drag handle buttons for keyboard and pointer drag", () => {
    const onStatus = vi.fn();
    render(
      <KanbanView
        tasks={[mockTask]}
        disabled={false}
        onStatus={onStatus}
        render={(t) => <span>{t.title}</span>}
      />,
    );

    const handle = screen.getByRole("button", { name: `Di chuyển ${mockTask.title}` });
    expect(handle).toBeInTheDocument();
    expect(handle).not.toBeDisabled();
  });

  it("rollback and toast notification on mutation failure", async () => {
    // Test the rollback + toast behavior of useTaskWrite
    vi.spyOn(apiClient, "patch").mockRejectedValueOnce(new Error("Lỗi cập nhật trạng thái"));
    const notifySpy = vi.spyOn(useUiStore.getState(), "notify");

    function TestComponent() {
      const write = useTaskWrite();
      return (
        <button
          onClick={() => write.mutate({ task: mockTask, status: "DONE" })}
        >
          Cập nhật trạng thái
        </button>
      );
    }

    renderWithProviders(<TestComponent />);

    // Seed query cache with initial task
    queryClient.setQueryData(["tasks", mockUser.id], {
      items: [mockTask],
      total: 1,
      page: 1,
      limit: 20,
    });

    fireEvent.click(screen.getByRole("button", { name: "Cập nhật trạng thái" }));

    await waitFor(() => {
      expect(notifySpy).toHaveBeenCalledWith("Có lỗi xảy ra. Vui lòng thử lại.");
    });

    // Check query cache was rolled back to initial state
    const cached = queryClient.getQueryData<{ items: Task[] }>(["tasks", mockUser.id]);
    expect(cached?.items[0].status).toBe("TODO");
  });
});

describe("CalendarView Component", () => {
  it("renders calendar navigation and switches between week and month modes", async () => {
    const onAdd = vi.fn();
    const onOpen = vi.fn();
    const onMove = vi.fn();

    renderWithProviders(
      <CalendarView
        filters={{}}
        disabled={false}
        onAdd={onAdd}
        onOpen={onOpen}
        onMove={onMove}
      />,
    );

    expect(await screen.findByRole("button", { name: "Trước" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sau" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hôm nay" })).toBeInTheDocument();

    const modeSelect = screen.getByLabelText("Kiểu lịch");
    fireEvent.change(modeSelect, { target: { value: "month" } });
    expect(modeSelect).toHaveValue("month");

    // Click "Trước" and "Sau" shifts navigation
    fireEvent.click(screen.getByRole("button", { name: "Sau" }));
    fireEvent.click(screen.getByRole("button", { name: "Trước" }));
  });

  it("triggers onAdd when clicking a day slot button", async () => {
    const onAdd = vi.fn();
    const onOpen = vi.fn();
    const onMove = vi.fn();

    renderWithProviders(
      <CalendarView
        filters={{}}
        disabled={false}
        onAdd={onAdd}
        onOpen={onOpen}
        onMove={onMove}
      />,
    );

    const dayButtons = await screen.findAllByRole("button", { name: /Thêm việc ngày/ });
    expect(dayButtons.length).toBeGreaterThan(0);
    fireEvent.click(dayButtons[0]);
    expect(onAdd).toHaveBeenCalled();
  });
});

describe("FocusMode Component", () => {
  it("configures work, short rest, and long rest with tab notice", () => {
    renderWithProviders(
      <FocusMode
        tasks={[mockTask]}
        disabled={false}
        onCheck={vi.fn()}
      />,
    );

    expect(screen.getByText("Một việc, một khoảng tập trung 🌱")).toBeInTheDocument();
    expect(screen.getAllByText("Chỉ chạy khi tab đang mở.")[0]).toBeInTheDocument();

    const workInput = screen.getByLabelText("Thời gian tập trung");
    const restInput = screen.getByLabelText("Thời gian nghỉ ngắn");
    const longRestInput = screen.getByLabelText("Thời gian nghỉ dài");

    expect(workInput).toHaveValue(25);
    expect(restInput).toHaveValue(5);
    expect(longRestInput).toHaveValue(15);

    fireEvent.change(workInput, { target: { value: "30" } });
    expect(workInput).toHaveValue(30);
  });

  it("starts session, tracks countdown, and supports pause/resume with fake timers", () => {
    vi.useFakeTimers();
    const startTime = 1700000000000;
    vi.setSystemTime(startTime);

    try {
      const onCheck = vi.fn();
      renderWithProviders(
        <FocusMode
          tasks={[mockTask]}
          disabled={false}
          onCheck={onCheck}
        />,
      );

      const select = screen.getByLabelText("Việc tập trung");
      fireEvent.change(select, { target: { value: mockTask.id } });
      fireEvent.click(screen.getByRole("button", { name: "Bắt đầu tập trung" }));

      expect(screen.getByText("Tập trung")).toBeInTheDocument();
      expect(screen.getByRole("timer")).toHaveTextContent("25:00");

      act(() => {
        vi.setSystemTime(startTime + 10000);
        vi.advanceTimersByTime(10000);
      });

      const pauseBtn = screen.getByRole("button", { name: "Tạm dừng" });
      fireEvent.click(pauseBtn);
      expect(screen.getByRole("button", { name: "Tiếp tục" })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("calls POST /tasks/:id/time on stop and save with exact seconds", async () => {
    const postSpy = vi.spyOn(apiClient, "post").mockImplementation(async () => ({ data: {} }));

    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      renderWithProviders(
        <FocusMode
          tasks={[mockTask]}
          disabled={false}
          onCheck={vi.fn()}
        />,
      );

      const select = screen.getByLabelText("Việc tập trung");
      fireEvent.change(select, { target: { value: mockTask.id } });
      fireEvent.click(screen.getByRole("button", { name: "Bắt đầu tập trung" }));

      act(() => {
        vi.advanceTimersByTime(60000);
      });

      const stopBtn = screen.getByRole("button", { name: "Dừng và lưu thời gian" });
      fireEvent.click(stopBtn);

      await waitFor(() => {
        expect(postSpy).toHaveBeenCalledWith(
          `/tasks/${mockTask.id}/time`,
          expect.objectContaining({
            seconds: 60,
          }),
        );
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not call POST /tasks/:id/time when 0 seconds elapsed", () => {
    const postSpy = vi.spyOn(apiClient, "post").mockImplementation(async () => ({ data: {} }));
    renderWithProviders(<FocusMode tasks={[mockTask]} disabled={false} onCheck={vi.fn()} />);

    const select = screen.getByLabelText("Việc tập trung");
    fireEvent.change(select, { target: { value: mockTask.id } });
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu tập trung" }));

    // Stop button is disabled when less than 1s elapsed
    const stopBtn = screen.getByRole("button", { name: "Dừng và lưu thời gian" });
    expect(stopBtn).toBeDisabled();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it("cleans up interval timer when unmounting", () => {
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    const { unmount } = renderWithProviders(
      <FocusMode
        tasks={[mockTask]}
        disabled={false}
        onCheck={vi.fn()}
      />,
    );
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});

describe("TemplatePicker Component", () => {
  it("opens modal, allows saving current list, and applies template", async () => {
    const onList = vi.fn();
    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: {
        items: [{ id: "tmpl-1", name: "Mẫu sinh hoạt", count: 3, readOnly: false }],
      },
    });
    const postSpy = vi.spyOn(apiClient, "post").mockImplementation(async (url) => {
      if (url.includes("/apply")) {
        return { data: { list: { id: "new-list-123" } } };
      }
      return { data: {} };
    });

    renderWithProviders(
      <TemplatePicker
        listId="list-1"
        disabled={false}
        onList={onList}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mẫu danh sách" }));
    expect(await screen.findByRole("heading", { name: "Mẫu danh sách" })).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Tên mẫu \/ danh sách mới/);
    fireEvent.change(nameInput, { target: { value: "Mẫu tuần" } });

    // Save current list
    fireEvent.click(screen.getByRole("button", { name: "Lưu danh sách hiện tại thành mẫu" }));
    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith("/task-templates", {
        listId: "list-1",
        name: "Mẫu tuần",
      });
    });

    // Select existing template to apply
    const select = await screen.findByRole("combobox");
    fireEvent.change(select, { target: { value: "tmpl-1" } });
    fireEvent.change(nameInput, { target: { value: "Danh sách mới từ mẫu" } });

    fireEvent.click(screen.getByRole("button", { name: "Tạo danh sách từ mẫu" }));
    await waitFor(() => {
      expect(onList).toHaveBeenCalledWith("new-list-123");
    });
  });
});

describe("ShoppingView Component", () => {
  it("groups by first label, puts unlabeled into 'Chưa phân khu', and completed at the bottom", () => {
    const tasks: Task[] = [
      { ...mockTask, id: "1", title: "Thịt heo", labels: ["thịt"], status: "TODO" },
      { ...mockTask, id: "2", title: "Cải xanh", labels: ["rau"], status: "TODO" },
      { ...mockTask, id: "3", title: "Nước rửa chén", labels: [], status: "TODO" },
      { ...mockTask, id: "4", title: "Muối", labels: ["gia-vị"], status: "DONE" },
    ];

    render(
      <ShoppingView
        tasks={tasks}
        render={(t) => <div key={t.id}>{t.title}</div>}
      />,
    );

    expect(screen.getByText("thịt")).toBeInTheDocument();
    expect(screen.getByText("rau")).toBeInTheDocument();
    expect(screen.getByText("Chưa phân khu")).toBeInTheDocument();
    expect(screen.getByText("Đã xong")).toBeInTheDocument();
  });
});

describe("TaskExtras Component", () => {
  it("displays nudge button for partner task and sends nudge request", async () => {
    const postSpy = vi.spyOn(apiClient, "post").mockImplementation(async () => ({ data: {} }));

    renderWithProviders(
      <TaskExtras
        task={mockTask}
        disabled={false}
      />,
    );

    const nudgeBtn = screen.getByRole("button", { name: "Nhắc nhẹ 💌" });
    fireEvent.click(nudgeBtn);
    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(`/tasks/${mockTask.id}/nudge`, {});
    });
  });

  it("handles duplicate task and confirms scope switch", async () => {
    const postSpy = vi.spyOn(apiClient, "post").mockImplementation(async () => ({ data: {} }));

    renderWithProviders(
      <TaskExtras
        task={mockTask}
        disabled={false}
      />,
    );

    // Duplicate
    fireEvent.click(screen.getByRole("button", { name: "Nhân bản việc" }));
    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(`/tasks/${mockTask.id}/duplicate`, {});
    });

    // Scope conversion confirmation modal
    fireEvent.click(screen.getByRole("button", { name: "Chuyển thành việc cá nhân" }));
    expect(await screen.findByRole("heading", { name: "Chuyển không gian công việc?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Xác nhận chuyển" }));
    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(`/tasks/${mockTask.id}/scope`, {
        revision: mockTask.revision,
        scope: "personal",
      });
    });
  });
});

describe("QuickAddBar Multi-line Paste Edge Cases", () => {
  it("opens confirmation modal 'Tạo N việc?' and ignores empty lines", async () => {
    const postSpy = vi.spyOn(apiClient, "post").mockImplementation(async () => ({ data: {} }));

    renderWithProviders(
      <QuickAddBar
        context={{ user: mockUser, scope: "personal" }}
        disabled={false}
      />,
    );

    const textarea = screen.getByLabelText("Thêm nhanh công việc");
    fireEvent.change(textarea, {
      target: { value: "Việc một\n\nViệc hai #nhà\n   \nViệc ba" },
    });

    expect(screen.getByText("3 việc · kiểm tra trước khi thêm.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Thêm" }));
    expect(await screen.findByRole("heading", { name: "Tạo 3 việc?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Xác nhận thêm" }));
    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        "/tasks/quick-add",
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({ title: "Việc một" }),
            expect.objectContaining({ title: "Việc hai" }),
            expect.objectContaining({ title: "Việc ba" }),
          ]),
        }),
      );
    });
  });

  it("blocks submission and shows warning when lines exceed 50", async () => {
    renderWithProviders(
      <QuickAddBar
        context={{ user: mockUser, scope: "personal" }}
        disabled={false}
      />,
    );

    const textarea = screen.getByLabelText("Thêm nhanh công việc");
    const text51 = Array.from({ length: 51 }, (_, i) => `Việc thứ ${i + 1}`).join("\n");
    fireEvent.change(textarea, { target: { value: text51 } });

    expect(await screen.findByText("Tối đa 50 việc mỗi lần.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thêm" })).toBeDisabled();
  });
});
