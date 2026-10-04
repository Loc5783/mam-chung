import { TasksPreview } from "../features/tasks/TasksPreview";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, it, expect, vi } from "vitest";
import { TaskForm } from "../features/tasks/TaskForm";
import { TasksPage } from "../features/tasks/TasksPage";
import { Task, Members } from "../features/tasks/types";
import { apiClient } from "../lib/apiClient";
import { useAuthStore } from "../features/auth/store";
import { localInputDate } from "../features/finance/api";
const members: Members = {
  items: [
    { id: "minh", name: "Minh" },
    { id: "lan", name: "Lan" },
  ],
  readOnly: false,
};
const base: Task = {
  id: "task",
  title: "Dọn nhà",
  description: "Cùng nhau",
  deadline: "2026-10-03",
  priority: "HIGH",
  status: "TODO",
  assignedTo: "lan",
  createdBy: "minh",
  creatorName: "Minh",
  coupleId: "couple",
  kind: "task",
  labels: ["Nhà"],
  checklist: [
    {
      id: "12345678-1234-4234-8234-123456789012",
      text: "Lau bàn",
      done: false,
    },
  ],
  recurrence: "weekly",
  completedAt: null,
  sourceTaskId: null,
  revision: 4,
  createdAt: "2026-10-03T00:00:00Z",
  readOnly: false,
};
let rows: Task[], readOnly: boolean, client: QueryClient;
function mount(node: React.ReactNode, url = "/tasks") {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.restoreAllMocks();
  rows = [{ ...base }];
  readOnly = false;
  useAuthStore.getState().setSession("token", {
    id: "minh",
    name: "Minh",
    email: "minh@test.local",
    coupleId: "couple",
    avatar: null,
    timezone: "Asia/Ho_Chi_Minh",
    createdAt: "2026-10-03T00:00:00Z",
  });
  vi.spyOn(apiClient, "get").mockImplementation(async (url, config) => ({
    data:
      url === "/tasks/members"
        ? { ...members, readOnly }
        : url.endsWith("/comments")
          ? {
              items: [
                {
                  id: "comment",
                  authorName: "Lan",
                  text: "Mình làm rồi",
                  createdAt: base.createdAt,
                },
              ],
              total: 1,
              readOnly,
            }
          : {
              items: rows.map((t) => ({ ...t, readOnly })),
              total: rows.length,
              page:
                (config?.params as { page?: number } | undefined)?.page ?? 1,
              limit: 20,
              readOnly,
            },
  }));
  vi.spyOn(apiClient, "post").mockResolvedValue({ data: {} });
  vi.spyOn(apiClient, "put").mockResolvedValue({ data: {} });
  vi.spyOn(apiClient, "patch").mockImplementation(async (url, body) => {
    rows = rows.map((t) =>
      url.includes(t.id)
        ? { ...t, ...(body as Partial<Task>), revision: t.revision + 1 }
        : t,
    );
    return { data: rows[0] };
  });
  vi.spyOn(apiClient, "delete").mockResolvedValue({ data: {} });
});
it("chặn tiêu đề trống và lặp không có hạn, không gửi API", async () => {
  mount(<TaskForm members={members} onClose={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  expect(
    await screen.findByText("Nhập tiêu đề công việc."),
  ).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("Tiêu đề"), "Việc mới");
  await userEvent.selectOptions(screen.getByLabelText("Lặp lại"), "daily");
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  expect(
    await screen.findByText("Việc lặp lại cần hạn chót."),
  ).toBeInTheDocument();
  expect(apiClient.post).not.toHaveBeenCalled();
});
it("tạo cá nhân mặc định giao chính mình, nhãn được tách", async () => {
  const done = vi.fn();
  mount(<TaskForm members={members} onClose={done} />);
  await userEvent.type(screen.getByLabelText("Tiêu đề"), "Đi bộ");
  await userEvent.type(screen.getByLabelText("Nhãn"), "Sức khỏe, Sáng");
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith(
      "/tasks",
      expect.objectContaining({
        scope: "personal",
        assignedTo: "minh",
        labels: ["Sức khỏe", "Sáng"],
        deadline: null,
      }),
    ),
  );
  expect(done).toHaveBeenCalledOnce();
});
it("đổi sang chung xóa người được giao, chọn partner và thêm việc con", async () => {
  mount(<TaskForm members={members} onClose={vi.fn()} />);
  await userEvent.type(screen.getByLabelText("Tiêu đề"), "Chuẩn bị bữa tối");
  await userEvent.selectOptions(screen.getByLabelText("Không gian"), "shared");
  expect(screen.getByLabelText("Người thực hiện")).toHaveValue("");
  await userEvent.selectOptions(
    screen.getByLabelText("Người thực hiện"),
    "lan",
  );
  await userEvent.type(screen.getByLabelText("Nội dung việc con"), "Rửa rau");
  await userEvent.click(screen.getByRole("button", { name: "Thêm mục" }));
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith(
      "/tasks",
      expect.objectContaining({
        scope: "shared",
        assignedTo: "lan",
        checklist: [expect.objectContaining({ text: "Rửa rau", done: false })],
      }),
    ),
  );
});
it("sửa gửi revision hiện tại và giữ ngày lặp", async () => {
  mount(<TaskForm task={base} members={members} onClose={vi.fn()} />);
  expect(screen.getByLabelText("Không gian")).toBeDisabled();
  await userEvent.clear(screen.getByLabelText("Tiêu đề"));
  await userEvent.type(screen.getByLabelText("Tiêu đề"), "Dọn bếp");
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    expect(apiClient.put).toHaveBeenCalledWith(
      "/tasks/task",
      expect.objectContaining({
        revision: 4,
        title: "Dọn bếp",
        deadline: "2026-10-03",
        recurrence: "weekly",
      }),
    ),
  );
});
it("shopping mới dùng shared, checklist tick và bỏ mục", async () => {
  mount(<TaskForm members={members} shopping onClose={vi.fn()} />);
  expect(screen.getByLabelText("Không gian")).toHaveValue("shared");
  expect(screen.getByLabelText("Loại công việc")).toHaveValue("shopping");
  await userEvent.type(screen.getByLabelText("Tiêu đề"), "Đi chợ");
  await userEvent.type(screen.getByLabelText("Nội dung việc con"), "Sữa");
  await userEvent.click(screen.getByRole("button", { name: "Thêm mục" }));
  await userEvent.click(screen.getByLabelText("Hoàn thành Sữa"));
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith(
      "/tasks",
      expect.objectContaining({
        kind: "shopping",
        checklist: [expect.objectContaining({ done: true })],
      }),
    ),
  );
});
it("xung đột hiện lỗi và giữ nội dung để người dùng tải lại", async () => {
  vi.mocked(apiClient.put).mockRejectedValue({
    isAxiosError: true,
    response: {
      data: { error: { message: "Công việc đã được người khác cập nhật." } },
    },
  });
  const close = vi.fn();
  mount(<TaskForm task={base} members={members} onClose={close} />);
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Công việc đã được người khác cập nhật",
  );
  expect(close).not.toHaveBeenCalled();
});
it("bộ lọc gửi đúng scope/search/priority và bảng Kanban4 cột", async () => {
  mount(<TasksPage />);
  await screen.findByRole("heading", { name: "Dọn nhà" });
  await userEvent.selectOptions(
    screen.getByLabelText("Lọc không gian"),
    "mine",
  );
  await userEvent.selectOptions(screen.getByLabelText("Lọc ưu tiên"), "HIGH");
  await userEvent.type(screen.getByLabelText("Tìm công việc"), "Dọn");
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenCalledWith(
      "/tasks",
      expect.objectContaining({
        params: expect.objectContaining({
          scope: "mine",
          priority: "HIGH",
          search: "Dọn",
          page: 1,
        }),
      }),
    ),
  );
  await userEvent.click(screen.getByRole("tab", { name: "Kanban" }));
  expect(screen.getByRole("heading", { name: /Cần làm/ })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /Đang làm/ })).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: /Hoàn thành/ }),
  ).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /Đã hủy/ })).toBeInTheDocument();
});
it("đổi trạng thái gửi revision, tick checklist dùng revision", async () => {
  mount(<TasksPage />);
  await screen.findByRole("heading", { name: "Dọn nhà" });
  await userEvent.click(screen.getByLabelText("Dọn nhà: Lau bàn"));
  await waitFor(() =>
    expect(apiClient.put).toHaveBeenCalledWith("/tasks/task", {
      revision: 4,
      checklist: [expect.objectContaining({ done: true })],
    }),
  );
  await userEvent.selectOptions(
    screen.getByLabelText("Trạng thái Dọn nhà"),
    "DONE",
  );
  await waitFor(() =>
    expect(apiClient.patch).toHaveBeenCalledWith("/tasks/task/status", {
      revision: 4,
      status: "DONE",
    }),
  );
});
it("archived không có nút thêm/sửa/xóa, checkbox và status bị khóa", async () => {
  readOnly = true;
  mount(<TasksPage />, "/tasks?coupleId=old");
  await screen.findByRole("heading", { name: "Dọn nhà" });
  expect(
    screen.queryByRole("button", { name: "Thêm công việc" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Sửa" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Xóa" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Dọn nhà: Lau bàn")).toBeDisabled();
  expect(screen.getByLabelText("Trạng thái Dọn nhà")).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Bình luận" }));
  expect(await screen.findByText("Mình làm rồi")).toBeInTheDocument();
  expect(screen.queryByLabelText("Bình luận ngắn")).not.toBeInTheDocument();
});
it("bình luận short shared gửi đúng task", async () => {
  mount(<TasksPage />);
  await screen.findByRole("heading", { name: "Dọn nhà" });
  await userEvent.click(screen.getByRole("button", { name: "Bình luận" }));
  await screen.findByText("Mình làm rồi");
  await userEvent.type(screen.getByLabelText("Bình luận ngắn"), "Mình phụ nhé");
  await userEvent.click(screen.getByRole("button", { name: "Gửi bình luận" }));
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith("/tasks/task/comments", {
      text: "Mình phụ nhé",
    }),
  );
});
it("xóa phải xác nhận, gửi revision và không xóa ngay", async () => {
  mount(<TasksPage />);
  await screen.findByRole("heading", { name: "Dọn nhà" });
  await userEvent.click(screen.getByRole("button", { name: "Xóa" }));
  expect(screen.getByRole("button", { name: "Xác nhận xóa" })).toBeDisabled();
  expect(apiClient.delete).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByLabelText("Tôi xác nhận xóa công việc này."),
  );
  await userEvent.click(screen.getByRole("button", { name: "Xác nhận xóa" }));
  await waitFor(() =>
    expect(apiClient.delete).toHaveBeenCalledWith("/tasks/task", {
      data: { revision: 4 },
    }),
  );
});
it("shopping shortcut lọc kindshopping và scope shared", async () => {
  mount(<TasksPage />);
  await screen.findByRole("heading", { name: "Dọn nhà" });
  await userEvent.click(screen.getByRole("button", { name: "Mua sắm chung" }));
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenCalledWith(
      "/tasks",
      expect.objectContaining({
        params: expect.objectContaining({ kind: "shopping", scope: "shared" }),
      }),
    ),
  );
});
it("dashboard lấy hôm nay/quá hạn và hoàn thành nhanh", async () => {
  rows = [
    {
      ...base,
      coupleId: null,
      assignedTo: "minh",
      deadline: localInputDate(new Date(), "Asia/Ho_Chi_Minh"),
    },
  ];
  mount(<TasksPreview />);
  await screen.findByRole("heading", { name: "Công việc hôm nay" });
  const buttons = await screen.findAllByRole("button", { name: "Xong" });
  await userEvent.click(buttons[0]);
  await waitFor(() =>
    expect(apiClient.patch).toHaveBeenCalledWith("/tasks/task/status", {
      revision: 4,
      status: "DONE",
    }),
  );
  expect(apiClient.get).toHaveBeenCalledWith(
    "/tasks",
    expect.objectContaining({ params: { due: "today", limit: 5 } }),
  );
  expect(apiClient.get).toHaveBeenCalledWith(
    "/tasks",
    expect.objectContaining({ params: { due: "overdue", limit: 5 } }),
  );
});
it("lỗi danh sách có retry, không bịa dữ liệu", async () => {
  vi.mocked(apiClient.get).mockRejectedValue(new Error("Mất kết nối"));
  mount(<TasksPage />);
  expect(
    await screen.findByRole("button", { name: "Thử lại" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Dọn nhà" }),
  ).not.toBeInTheDocument();
});
it("deadline date input giữ ngày khi chỉnh", async () => {
  mount(<TaskForm task={base} members={members} onClose={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Hạn chót"), {
    target: { value: "2026-10-04" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    expect(apiClient.put).toHaveBeenCalledWith(
      "/tasks/task",
      expect.objectContaining({ deadline: "2026-10-04" }),
    ),
  );
});
