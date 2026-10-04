import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, it, expect, vi } from "vitest";
import { AccountHome } from "../features/dashboard/AccountHome";
import {
  NotificationBell,
  Notice,
  NoticePage,
} from "../features/notifications/NotificationBell";
import { useAuthStore } from "../features/auth/store";
import { apiClient, setSession } from "../lib/apiClient";
import { emptyHome } from "./dashboard-fixture";
vi.mock("recharts", () => {
  const wrap = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  const empty = () => null;
  return {
    ResponsiveContainer: wrap,
    LineChart: wrap,
    PieChart: wrap,
    Pie: wrap,
    Line: empty,
    XAxis: empty,
    YAxis: empty,
    Tooltip: empty,
    Cell: empty,
    CartesianGrid: empty,
  };
});
const user = {
  id: "minh",
  name: "Minh",
  email: "m@home.test",
  coupleId: null,
  avatar: null,
  timezone: "Asia/Ho_Chi_Minh",
  createdAt: "2026-10-04T00:00:00Z",
};
const notice: Notice = {
  id: "notice",
  type: "PAYMENT_CONFIRM",
  title: "Cần xác nhận thanh toán",
  message: "An đã đánh dấu khoản hoàn trả.",
  href: "/shared?tab=settlements",
  payload: { sourceId: "settlement" },
  readAt: null,
  createdAt: "2026-10-04T00:00:00Z",
};
let data: ReturnType<typeof emptyHome>, notices: NoticePage;
function Location() {
  return (
    <output aria-label="Đường dẫn">
      {useLocation().pathname + useLocation().search}
    </output>
  );
}
function mount(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        {node}
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}
beforeEach(() => {
  vi.restoreAllMocks();
  useAuthStore.getState().setSession("token", user);
  data = emptyHome();
  notices = { items: [notice], total: 1, unreadCount: 1, page: 1, limit: 20 };
  vi.spyOn(apiClient, "get").mockImplementation(async (path) => ({
    data: path === "/dashboard" ? data : notices,
  }));
  vi.spyOn(apiClient, "patch").mockResolvedValue({
    data: { ...notice, readAt: "2026-10-04T10:00:00Z" },
  });
  vi.spyOn(apiClient, "post").mockResolvedValue({ data: { updated: 1 } });
});
it("home uses one aggregate request and no section requests", async () => {
  mount(<AccountHome />);
  await screen.findByText("Chưa có buổi tập. Ghi buổi đầu tiên để bắt đầu.");
  expect(apiClient.get).toHaveBeenCalledTimes(1);
  expect(apiClient.get).toHaveBeenCalledWith("/dashboard");
  expect(
    screen.getByText("Cùng người thương bắt đầu một hành trình chung."),
  ).toBeInTheDocument();
});
it("quick actions include working creation links and no-couple invitation path", async () => {
  mount(<AccountHome />);
  await screen.findByText("Hôm nay (0)");
  expect(screen.getByRole("link", { name: "Giao dịch" })).toHaveAttribute(
    "href",
    "/finance?tab=transactions&add=1",
  );
  expect(screen.getByRole("link", { name: "Việc cần làm" })).toHaveAttribute(
    "href",
    "/tasks?add=1",
  );
  expect(screen.getByRole("link", { name: "Buổi tập" })).toHaveAttribute(
    "href",
    "/fitness?add=1",
  );
  expect(screen.getByRole("link", { name: "Chi tiêu chung" })).toHaveAttribute(
    "href",
    "/couple",
  );
});
it("shared summary renders actual members, days, debt and activity", async () => {
  data.couple = {
    id: "pair",
    name: "Nhà hai người",
    status: "active",
    ownerId: user.id,
    role: "owner",
    anniversary: "2026-01-01",
    anniversaryInfo: {
      date: "2026-01-01",
      daysTogether: 276,
      nextDate: "2027-01-01",
      daysUntil: 89,
      isToday: false,
    },
    createdAt: user.createdAt,
    archivedAt: null,
    archivedReason: null,
    invite: null,
    outstanding: { count: 1, summaryAvailable: true },
    members: [
      {
        userId: user.id,
        name: "Minh",
        avatar: null,
        role: "owner",
        active: true,
        joinedAt: user.createdAt,
        leftAt: null,
      },
      {
        userId: "an",
        name: "An",
        avatar: null,
        role: "member",
        active: true,
        joinedAt: user.createdAt,
        leftAt: null,
      },
    ],
  };
  data.shared = {
    month: "2026-10",
    readOnly: false,
    totalBalance: 100000,
    monthExpense: 200000,
    categories: [],
    summary: {
      amount: 100000,
      fromUserId: "an",
      toUserId: user.id,
      fromName: "An",
      toName: "Minh",
      outstandingCount: 1,
      pendingConfirmation: 1,
    },
    recent: [],
    goals: [],
  };
  data.activity = {
    items: [
      {
        id: "event",
        type: "shared",
        actorName: "An",
        message: "An đã đóng góp vào quỹ",
        createdAt: user.createdAt,
      },
    ],
    total: 1,
    page: 1,
    limit: 5,
  };
  mount(<AccountHome />);
  expect(await screen.findByText("Minh & An")).toBeInTheDocument();
  expect(screen.getByText(/276 ngày bên nhau/)).toBeInTheDocument();
  expect(
    screen.getByText(/An cần hoàn 100.000 đ cho Minh/),
  ).toBeInTheDocument();
  expect(screen.getByText("An đã đóng góp vào quỹ")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Chi tiêu chung" })).toHaveAttribute(
    "href",
    "/shared?tab=transactions&add=1",
  );
  expect(useAuthStore.getState().user?.coupleId).toBe("pair");
});
it("dashboard failure shows retry and does not invent balances; retry recovers", async () => {
  vi.mocked(apiClient.get).mockRejectedValueOnce({
    isAxiosError: true,
    response: { status: 503, data: { error: { message: "Tạm ngắt kết nối" } } },
  });
  mount(<AccountHome />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Tạm ngắt kết nối",
  );
  expect(screen.queryByText("Tổng số dư")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  expect(await screen.findByText("Hôm nay (0)")).toBeInTheDocument();
});
it("quick Done sends revision and refreshes aggregate and notifications for own account", async () => {
  data.tasks.today = {
    items: [
      {
        id: "task",
        title: "Đi chợ",
        description: "",
        deadline: "2026-10-04",
        priority: "HIGH",
        status: "TODO",
        assignedTo: null,
        createdBy: user.id,
        creatorName: "Minh",
        coupleId: null,
        kind: "task",
        labels: [],
        checklist: [],
        recurrence: "none",
        completedAt: null,
        sourceTaskId: null,
        revision: 7,
        createdAt: user.createdAt,
        readOnly: false,
      },
    ],
    total: 1,
    page: 1,
    limit: 5,
    readOnly: false,
  };
  const client = mount(<AccountHome />),
    invalidate = vi.spyOn(client, "invalidateQueries");
  await userEvent.click(await screen.findByRole("button", { name: "Xong" }));
  await waitFor(() =>
    expect(apiClient.patch).toHaveBeenCalledWith("/tasks/task/status", {
      status: "DONE",
      revision: 7,
    }),
  );
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["dashboard", user.id] });
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ["notifications", user.id],
  });
});
it("bell exposes unread total, date, escaped text and reading one item", async () => {
  notices.items = [{ ...notice, message: "<script>không chạy</script>" }];
  const client = mount(<NotificationBell />),
    invalidate = vi.spyOn(client, "invalidateQueries");
  await userEvent.click(
    await screen.findByRole("button", { name: "Thông báo, 1 chưa đọc" }),
  );
  expect(screen.getByRole("dialog", { name: "Thông báo" })).toBeInTheDocument();
  expect(screen.getByText("<script>không chạy</script>")).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Đánh dấu đã đọc" }),
  );
  await waitFor(() =>
    expect(apiClient.patch).toHaveBeenCalledWith(
      "/notifications/notice/read",
      {},
    ),
  );
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ["notifications", user.id],
  });
});
it("opening a notification reads it then navigates to the correct settlement tab", async () => {
  mount(<NotificationBell />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Thông báo, 1 chưa đọc" }),
  );
  await userEvent.click(screen.getByRole("link", { name: "Xem chi tiết" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Đường dẫn")).toHaveTextContent(
      "/shared?tab=settlements",
    ),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("failed read keeps dialog and does not navigate", async () => {
  vi.mocked(apiClient.patch).mockRejectedValue({
    isAxiosError: true,
    response: { status: 503, data: { error: { message: "Không lưu được" } } },
  });
  mount(<NotificationBell />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Thông báo, 1 chưa đọc" }),
  );
  await userEvent.click(screen.getByRole("link", { name: "Xem chi tiết" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Không lưu được");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByLabelText("Đường dẫn")).toHaveTextContent(/^\/$/);
});
it("notification cannot navigate to an external or unsupported route", async () => {
  notices.items = [{ ...notice, href: "https://outside.test/path" }];
  mount(<NotificationBell />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Thông báo, 1 chưa đọc" }),
  );
  await userEvent.click(screen.getByRole("link", { name: "Xem chi tiết" }));
  await waitFor(() => expect(apiClient.patch).toHaveBeenCalled());
  expect(screen.getByLabelText("Đường dẫn")).toHaveTextContent(/^\/$/);
});
it("read-all uses strict empty body and unread filter updates server query", async () => {
  mount(<NotificationBell />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Thông báo, 1 chưa đọc" }),
  );
  await userEvent.click(screen.getByLabelText("Chỉ chưa đọc"));
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenCalledWith("/notifications", {
      params: { page: 1, limit: 20, unread: "true" },
    }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Đọc tất cả" }));
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith("/notifications/read-all", {}),
  );
});
it("empty unread list disables read-all and paginator", async () => {
  notices = { items: [], unreadCount: 0, total: 0, page: 1, limit: 20 };
  mount(<NotificationBell />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Thông báo, 0 chưa đọc" }),
  );
  expect(
    await screen.findByText("Không có thông báo trong bộ lọc này."),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Đọc tất cả" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Sau" })).toBeDisabled();
});
it("shrinking notification result returns to a valid page after read-all", async () => {
  notices.total = 21;
  const client = mount(<NotificationBell />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Thông báo, 1 chưa đọc" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Sau" }));
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenCalledWith("/notifications", {
      params: { page: 2, limit: 20 },
    }),
  );
  notices = { items: [], unreadCount: 0, total: 0, page: 2, limit: 20 };
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["notifications", user.id] });
  });
  await waitFor(() =>
    expect(screen.getByText(/0 thông báo · Trang 1/)).toBeInTheDocument(),
  );
});
it("old notification completion after account switch cannot navigate or invalidate new session", async () => {
  let resolve!: (v: object) => void;
  vi.mocked(apiClient.patch).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const client = mount(<NotificationBell />),
    invalidate = vi.spyOn(client, "invalidateQueries");
  await userEvent.click(
    await screen.findByRole("button", { name: "Thông báo, 1 chưa đọc" }),
  );
  await userEvent.click(screen.getByRole("link", { name: "Xem chi tiết" }));
  await act(async () => {
    setSession({
      accessToken: "new-token",
      user: { ...user, id: "an", name: "An" },
    });
    resolve({ data: notice });
  });
  expect(screen.getByLabelText("Đường dẫn")).toHaveTextContent(/^\/$/);
  expect(invalidate).not.toHaveBeenCalled();
});
it("notification fetch error shows retry inside dialog", async () => {
  vi.mocked(apiClient.get).mockRejectedValueOnce({
    isAxiosError: true,
    response: { status: 503, data: { error: { message: "Chưa tải được" } } },
  });
  mount(<NotificationBell />);
  await userEvent.click(
    screen.getByRole("button", { name: "Thông báo, 0 chưa đọc" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Chưa tải được");
  await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  expect(
    await screen.findByText("Cần xác nhận thanh toán"),
  ).toBeInTheDocument();
});
