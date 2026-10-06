import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { TasksPage } from "../features/tasks/TasksPage";
import { TaskDetailDrawer } from "../features/tasks/components/TaskDetailDrawer";
import { dateLabel, groupTasks } from "../features/tasks/lib/dateLabels";
import { apiClient, clearSession } from "../lib/apiClient";
import { useAuthStore } from "../features/auth/store";
import type { Task, TaskList } from "../features/tasks/types";
const original: Task = {
  id: "task",
  title: "Việc thử",
  description: "Mô tả",
  deadline: null,
  priority: "MEDIUM",
  status: "TODO",
  assignedTo: "minh",
  createdBy: "minh",
  creatorName: "Minh",
  coupleId: null,
  kind: "task",
  labels: [],
  checklist: [],
  recurrence: "none",
  completedAt: null,
  sourceTaskId: null,
  revision: 0,
  createdAt: "2026-10-01T00:00:00Z",
  readOnly: false,
  listId: "list",
};
const list: TaskList = {
  id: "list",
  name: "Nhà",
  color: "#7E9B57",
  icon: "ListTodo",
  type: "normal",
  ownerId: "minh",
  coupleId: null,
  position: "V",
  archivedAt: null,
  revision: 0,
  isDefault: false,
  readOnly: false,
};
const members = {
  items: [
    { id: "minh", name: "Minh" },
    { id: "lan", name: "Lan" },
  ],
  readOnly: false,
};
let task: Task, client: QueryClient, deleted: boolean;
const mount = (node: React.ReactNode, url = "/tasks") => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
};
beforeEach(() => {
  vi.restoreAllMocks();
  task = { ...original };
  deleted = false;
  useAuthStore.getState().setSession("token", {
    id: "minh",
    name: "Minh",
    email: "minh@test.local",
    avatar: null,
    timezone: "UTC",
    coupleId: "couple",
    createdAt: original.createdAt,
  });
  vi.spyOn(apiClient, "get").mockImplementation(async (url) => ({
    data:
      url === "/tasks/members"
        ? members
        : url === "/task-lists"
          ? { items: [list], total: 1, page: 1, limit: 100, readOnly: false }
          : url === "/tasks/summary"
            ? {
                counts: {
                  all: 250,
                  today: 40,
                  todayTotal: 50,
                  todayDone: 10,
                  done: 5,
                },
                lists: [{ id: "list", count: 2 }],
                labels: ["Nhà"],
              }
            : url === "/tasks/task"
              ? task
              : {
                  items: deleted ? [] : [task],
                  total: deleted ? 0 : 1,
                  page: 1,
                  limit: 20,
                  readOnly: false,
                },
  }));
  vi.spyOn(apiClient, "patch").mockImplementation(async (_url, body) => {
    task = { ...task, ...(body as Partial<Task>), revision: task.revision + 1 };
    return { data: task };
  });
  vi.spyOn(apiClient, "put").mockImplementation(async (_url, body) => {
    task = { ...task, ...(body as Partial<Task>), revision: task.revision + 1 };
    return { data: task };
  });
  vi.spyOn(apiClient, "post").mockImplementation(async (url) => {
    if (url.endsWith("/restore")) {
      deleted = false;
      task = { ...task, revision: 2 };
    }
    return { data: task };
  });
  vi.spyOn(apiClient, "delete").mockImplementation(async () => {
    deleted = true;
    return { data: undefined };
  });
});
it("sidebar uses full server counts and switches smart/list filters through URL", async () => {
  mount(<TasksPage />);
  await waitFor(() =>
    expect(screen.getByLabelText("Số việc Hôm nay")).toHaveTextContent("40"),
  );
  expect(
    screen.getByRole("img", { name: "Hôm nay hoàn thành 10/50 việc" }),
  ).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /^Hôm nay/ }));
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenCalledWith(
      "/tasks",
      expect.objectContaining({
        params: expect.objectContaining({ smart: "today" }),
      }),
    ),
  );
  await userEvent.click(screen.getByRole("button", { name: /^Nhà/ }));
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenCalledWith(
      "/tasks",
      expect.objectContaining({
        params: expect.objectContaining({ list: "list" }),
      }),
    ),
  );
});
it("restores URL filters and changes grouping without losing search", async () => {
  mount(<TasksPage />, "/tasks?smart=mine&priority=HIGH&search=Việc&view=list");
  await screen.findByRole("heading", { name: "Việc thử" });
  expect(screen.getByLabelText("Lọc ưu tiên")).toHaveValue("HIGH");
  expect(screen.getByLabelText("Tìm công việc")).toHaveValue("Việc");
  await userEvent.selectOptions(
    screen.getByLabelText("Nhóm công việc"),
    "priority",
  );
  expect(
    screen.getByRole("heading", { name: "Ưu tiên vừa" }),
  ).toBeInTheDocument();
});
it("checkbox updates before the network reply and offers revision-safe undo", async () => {
  let resolve!: (v: unknown) => void;
  vi.mocked(apiClient.patch).mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  mount(<TasksPage />);
  await screen.findByRole("heading", { name: "Việc thử" });
  await userEvent.click(
    screen.getByRole("checkbox", { name: "Hoàn thành Việc thử" }),
  );
  expect(screen.getByLabelText("Hoàn thành Việc thử")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  expect(
    screen.queryByRole("button", { name: "Hoàn tác" }),
  ).not.toBeInTheDocument();
  task = { ...task, status: "DONE", revision: 1 };
  await act(async () => resolve({ data: task }));
  await userEvent.click(
    await screen.findByRole("button", { name: "Hoàn tác" }),
  );
  await waitFor(() =>
    expect(apiClient.patch).toHaveBeenLastCalledWith("/tasks/task/status", {
      revision: 1,
      status: "TODO",
    }),
  );
});
it("failed optimistic checkbox rolls back and reports the failure", async () => {
  vi.mocked(apiClient.patch).mockRejectedValueOnce(new Error("Không thể lưu"));
  mount(<TasksPage />);
  await screen.findByRole("heading", { name: "Việc thử" });
  await userEvent.click(
    screen.getByRole("checkbox", { name: "Hoàn thành Việc thử" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("checkbox", { name: "Hoàn thành Việc thử" }),
    ).toHaveAttribute("aria-checked", "false"),
  );
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Hoàn tác" }),
  ).not.toBeInTheDocument();
});
it("confirmed delete can restore the same task using the post-delete revision", async () => {
  mount(<TasksPage />);
  await screen.findByRole("heading", { name: "Việc thử" });
  await userEvent.click(screen.getByRole("button", { name: "Xóa" }));
  await userEvent.click(
    screen.getByLabelText("Tôi xác nhận xóa công việc này."),
  );
  await userEvent.click(screen.getByRole("button", { name: "Xác nhận xóa" }));
  await userEvent.click(
    await screen.findByRole("button", { name: "Hoàn tác" }),
  );
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith("/tasks/task/restore", {
      revision: 1,
    }),
  );
  expect(
    await screen.findByRole("heading", { name: "Việc thử" }),
  ).toBeInTheDocument();
});
it("drawer autosaves and uses the returned revision for the next edit", async () => {
  mount(
    <TaskDetailDrawer
      task={task}
      lists={[list]}
      members={members}
      onClose={vi.fn()}
      onStatus={vi.fn()}
      onComments={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("Tiêu đề công việc"), {
    target: { value: "Việc mới" },
  });
  await waitFor(
    () =>
      expect(apiClient.put).toHaveBeenCalledWith(
        "/tasks/task",
        expect.objectContaining({ title: "Việc mới", revision: 0 }),
      ),
    { timeout: 2000 },
  );
  await screen.findByText("Đã lưu");
  fireEvent.change(screen.getByLabelText("Mô tả công việc"), {
    target: { value: "Mô tả mới" },
  });
  await waitFor(
    () =>
      expect(apiClient.put).toHaveBeenLastCalledWith(
        "/tasks/task",
        expect.objectContaining({ description: "Mô tả mới", revision: 1 }),
      ),
    { timeout: 2000 },
  );
});
it("drawer preserves draft after failure, prevents silent close and retries explicitly", async () => {
  vi.mocked(apiClient.put).mockRejectedValueOnce(new Error("Xung đột"));
  const close = vi.fn();
  mount(
    <TaskDetailDrawer
      task={task}
      lists={[list]}
      members={members}
      onClose={close}
      onStatus={vi.fn()}
      onComments={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("Tiêu đề công việc"), {
    target: { value: "Giữ lại bản nháp" },
  });
  await screen.findByRole("alert", {}, { timeout: 2000 });
  expect(screen.getByLabelText("Tiêu đề công việc")).toHaveValue(
    "Giữ lại bản nháp",
  );
  fireEvent.keyDown(document, { key: "Escape" });
  expect(close).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Lưu ngay" }));
  await screen.findByText("Đã lưu");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(close).toHaveBeenCalledOnce();
});
it("offline blocks row, quick-add and drawer writes", async () => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  mount(<TasksPage />);
  await screen.findByRole("heading", { name: "Việc thử" });
  expect(
    screen.getByRole("checkbox", { name: "Hoàn thành Việc thử" }),
  ).toBeDisabled();
  expect(screen.getByLabelText("Thêm nhanh công việc")).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Việc thử" }));
  expect(screen.getByLabelText("Tiêu đề công việc")).toBeDisabled();
  expect(apiClient.put).not.toHaveBeenCalled();
});
it("late drawer save does not update UI after logout", async () => {
  let resolve!: (v: unknown) => void;
  vi.mocked(apiClient.put).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const view = mount(
    <TaskDetailDrawer
      task={task}
      lists={[list]}
      members={members}
      onClose={vi.fn()}
      onStatus={vi.fn()}
      onComments={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("Tiêu đề công việc"), {
    target: { value: "Cũ" },
  });
  await waitFor(() => expect(apiClient.put).toHaveBeenCalled(), {
    timeout: 2000,
  });
  view.unmount();
  clearSession();
  await act(async () =>
    resolve({ data: { ...task, title: "Cũ", revision: 1 } }),
  );
  expect(client.getQueryData(["tasks", "minh", "/tasks", {}])).toBeUndefined();
});
it("groups honor timezone, date boundaries and terminal groups; date labels include time", () => {
  const rows = [
    { ...original, id: "late", deadline: "2026-10-05" },
    { ...original, id: "today", deadline: "2026-10-06" },
    { ...original, id: "tomorrow", deadline: "2026-10-07" },
    { ...original, id: "week", deadline: "2026-10-09" },
    { ...original, id: "later", deadline: "2026-10-20" },
    { ...original, id: "done", status: "DONE" as const },
    { ...original, id: "cancelled", status: "CANCELLED" as const },
    original,
  ];
  expect(
    groupTasks(rows, new Date("2026-10-05T18:00:00Z"), "Asia/Ho_Chi_Minh").map(
      ([key]) => key,
    ),
  ).toEqual([
    "Quá hạn",
    "Hôm nay",
    "Ngày mai",
    "Tuần này",
    "Sau đó",
    "Không hạn",
    "Đã hủy",
    "Đã xong",
  ]);
  expect(dateLabel(rows[0], "2026-10-06")).toBe("Quá hạn 1 ngày");
  expect(
    dateLabel(
      {
        ...original,
        deadline: "2026-10-06",
        deadlineHasTime: true,
        deadlineTime: "09:00",
      },
      "2026-10-06",
    ),
  ).toBe("Hôm nay · 09:00");
});

afterEach(() => vi.useRealTimers());
it("undo expires after five seconds without another server write", async () => {
  vi.useFakeTimers();
  mount(<TasksPage />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Hoàn thành Việc thử" }),
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  expect(screen.getByRole("button", { name: "Hoàn tác" })).toBeInTheDocument();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4800);
  });
  expect(screen.getByRole("button", { name: "Hoàn tác" })).toBeInTheDocument();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(
    screen.queryByRole("button", { name: "Hoàn tác" }),
  ).not.toBeInTheDocument();
  expect(apiClient.patch).toHaveBeenCalledTimes(1);
});

it("quick add waits for list metadata and uses its shared scope", async () => {
  const get = vi.mocked(apiClient.get).getMockImplementation()!;
  let resolve!: (v: unknown) => void;
  vi.mocked(apiClient.get).mockImplementation((url, config) =>
    url === "/task-lists"
      ? new Promise((r) => {
          resolve = r;
        })
      : get(url, config),
  );
  mount(<TasksPage />, "/tasks?list=list");
  await screen.findByRole("heading", { name: "Việc thử" });
  expect(screen.getByLabelText("Thêm nhanh công việc")).toBeDisabled();
  await act(async () =>
    resolve({
      data: {
        items: [{ ...list, coupleId: "couple", ownerId: null }],
        total: 1,
        page: 1,
        limit: 100,
        readOnly: false,
      },
    }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Thêm nhanh công việc")).not.toBeDisabled(),
  );
  await userEvent.type(screen.getByLabelText("Thêm nhanh công việc"), "Đi chợ");
  await userEvent.click(screen.getByRole("button", { name: "Thêm" }));
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith(
      "/tasks",
      expect.objectContaining({
        title: "Đi chợ",
        scope: "shared",
        listId: "list",
      }),
    ),
  );
});

it("completion inside the focus-trapped drawer has an accessible undo action", async () => {
  mount(<TasksPage />);
  await screen.findByRole("heading", { name: "Việc thử" });
  await userEvent.click(screen.getByRole("button", { name: "Việc thử" }));
  await userEvent.selectOptions(
    screen.getByLabelText("Trạng thái trong chi tiết"),
    "DONE",
  );
  await userEvent.click(
    await screen.findByRole("button", { name: "Hoàn tác" }),
  );
  await waitFor(() =>
    expect(apiClient.patch).toHaveBeenLastCalledWith("/tasks/task/status", {
      revision: 1,
      status: "TODO",
    }),
  );
});
