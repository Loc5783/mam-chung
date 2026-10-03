import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  BudgetForm,
  GoalForm,
  ContributionForm,
  RecurringForm,
} from "../features/planning/PlanningForms";
import {
  PlanningPanel,
  BudgetPreview,
  ExportHistoryButton,
} from "../features/planning/PlanningPanel";
import { PlanningReports } from "../features/planning/PlanningReports";
import { apiClient } from "../lib/apiClient";
import { useAuthStore } from "../features/auth/store";
import { Goal, Budget, Recurring } from "../features/planning/types";
import { Wallet, Category } from "../features/finance/types";
const categories: Category[] = [
  {
    id: "food",
    name: "Ăn uống",
    type: "expense",
    icon: "Utensils",
    isSystem: true,
  },
  {
    id: "salary",
    name: "Lương",
    type: "income",
    icon: "Briefcase",
    isSystem: true,
  },
];
const wallets: Wallet[] = [
  {
    id: "cash",
    name: "Tiền mặt",
    type: "cash",
    currency: "VND",
    balance: 1000000,
    allowNegative: false,
    archived: false,
    color: "#7E9B57",
    icon: "Wallet",
    createdAt: "2026-10-03T00:00:00Z",
  },
];
const goal: Goal = {
  id: "goal",
  name: "Đà Lạt",
  targetAmount: 1000000,
  savedAmount: 100000,
  deadline: "2026-12-31",
  notes: "Cuối năm",
  color: "#7E9B57",
  progress: 10,
  createdAt: "2026-10-03T00:00:00Z",
};
const budget: Budget = {
  id: "budget",
  categoryId: "food",
  categoryName: "Ăn uống",
  categoryIcon: "Utensils",
  month: "2026-10",
  amount: 100000,
  spent: 80000,
  remaining: 20000,
  progress: 80,
  status: "warning",
};
const recurring: Recurring = {
  id: "recurring",
  type: "expense",
  amount: 10000,
  walletId: "cash",
  categoryId: "food",
  description: "Tiền nhà",
  notes: "",
  tags: [],
  frequency: "monthly",
  nextDate: "2026-10-31",
  endDate: null,
  enabled: true,
  lastError: "Ví không đủ tiền.",
  lastRunAt: null,
};
const report = {
  timezone: "Asia/Ho_Chi_Minh",
  endMonth: "2026-10",
  months: [
    { month: "2026-09", income: 100000, expense: 10000, net: 90000 },
    { month: "2026-10", income: 100000, expense: 20000, net: 80000 },
  ],
  categories: [
    {
      categoryId: "food",
      name: "Ăn uống",
      amount: 30000,
      months: [10000, 20000],
    },
  ],
  totalIncome: 200000,
  totalExpense: 30000,
  comparison: { incomeChange: 0, expenseChange: 100 },
};
function wrap(node: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        {node}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  useAuthStore.getState().setSession("token", {
    id: "qa",
    email: "qa@example.test",
    name: "QA",
    avatar: null,
    timezone: "Asia/Ho_Chi_Minh",
    coupleId: null,
    createdAt: "2026-10-03T00:00:00Z",
  });
  vi.spyOn(apiClient, "get").mockImplementation(async (url) => ({
    data:
      url === "/budgets"
        ? { month: "2026-10", items: [budget] }
        : url === "/goals"
          ? { items: [goal] }
          : url === "/recurring"
            ? { items: [recurring] }
            : url === "/goals/goal/contributions"
              ? {
                  items: [
                    {
                      id: "contribution",
                      amount: 100000,
                      date: "2026-10-03T05:00:00Z",
                      notes: "Đã dành dụm",
                    },
                  ],
                  total: 1,
                  page: 1,
                  limit: 20,
                }
              : report,
  }));
});
afterEach(() => vi.unstubAllGlobals());
it("ngân sách chọn danh mục chi và kiểm tra số tiền", async () => {
  const post = vi.spyOn(apiClient, "post");
  wrap(<BudgetForm categories={categories} onClose={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Lưu ngân sách" }));
  expect(
    await screen.findByText("Vui lòng chọn danh mục."),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("option", { name: "Lương" }),
  ).not.toBeInTheDocument();
  expect(post).not.toHaveBeenCalled();
});
it("sửa ngân sách gửi giới hạn mới, không ghi đè khoản đã chi", async () => {
  const put = vi.spyOn(apiClient, "put").mockResolvedValue({ data: budget });
  wrap(
    <BudgetForm budget={budget} categories={categories} onClose={vi.fn()} />,
  );
  await userEvent.clear(screen.getByLabelText("Giới hạn chi (đ)"));
  await userEvent.type(screen.getByLabelText("Giới hạn chi (đ)"), "200000");
  await userEvent.click(screen.getByRole("button", { name: "Lưu ngân sách" }));
  await waitFor(() =>
    expect(put).toHaveBeenCalledWith("/budgets/budget", {
      categoryId: "food",
      month: "2026-10",
      amount: 200000,
    }),
  );
});
it("mục tiêu kiểm tra tên và số tiền trước khi gửi", async () => {
  wrap(<GoalForm onClose={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Lưu mục tiêu" }));
  expect(
    await screen.findByText("Vui lòng nhập tên mục tiêu."),
  ).toBeInTheDocument();
  expect(screen.getByText("Vui lòng nhập số tiền.")).toBeInTheDocument();
});
it("dành dụm gửi đúng khoản và giải thích không trừ ví", async () => {
  const post = vi
    .spyOn(apiClient, "post")
    .mockResolvedValue({ data: { goal } });
  wrap(<ContributionForm goal={goal} onClose={vi.fn()} />);
  expect(screen.getByText(/không trừ số dư ví/)).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("Số tiền dành dụm (đ)"), "100000");
  await userEvent.click(
    screen.getByRole("button", { name: "Ghi nhận dành dụm" }),
  );
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      "/goals/goal/contribute",
      expect.objectContaining({ amount: 100000 }),
    ),
  );
});
it("định kỳ chặn ngày kết thúc trước kỳ tiếp theo", async () => {
  const post = vi.spyOn(apiClient, "post");
  wrap(
    <RecurringForm
      recurring={recurring}
      wallets={wallets}
      categories={categories}
      onClose={vi.fn()}
    />,
  );
  await userEvent.type(
    screen.getByLabelText("Ngày kết thúc (tùy chọn)"),
    "2026-10-01",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Lưu lịch định kỳ" }),
  );
  expect(
    await screen.findByText("Ngày kết thúc phải sau hoặc bằng kỳ tiếp theo."),
  ).toBeInTheDocument();
  expect(post).not.toHaveBeenCalled();
});
it("định kỳ sửa đúng ngày và giữ mảng nhãn", async () => {
  const put = vi.spyOn(apiClient, "put").mockResolvedValue({ data: recurring });
  wrap(
    <RecurringForm
      recurring={recurring}
      wallets={wallets}
      categories={categories}
      onClose={vi.fn()}
    />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Lưu lịch định kỳ" }),
  );
  await waitFor(() =>
    expect(put).toHaveBeenCalledWith(
      "/recurring/recurring",
      expect.objectContaining({
        nextDate: "2026-10-31",
        frequency: "monthly",
        tags: [],
        endDate: null,
      }),
    ),
  );
});
it("ngân sách hiển thị nhắc 80% và đổi tháng truy vấn", async () => {
  wrap(
    <PlanningPanel
      section="budgets"
      wallets={wallets}
      categories={categories}
    />,
  );
  expect(await screen.findByText(/Đã dùng từ 80%/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Tháng xem ngân sách"), {
    target: { value: "2026-11" },
  });
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenLastCalledWith("/budgets", {
      params: { month: "2026-11" },
    }),
  );
});
it("dashboard có tiến độ ngân sách và link quản lý", async () => {
  wrap(<BudgetPreview />);
  expect(await screen.findByText("Ăn uống")).toBeInTheDocument();
  expect(screen.getByRole("progressbar", { name: "Ăn uống" })).toHaveAttribute(
    "aria-valuenow",
    "80",
  );
  expect(
    screen.getByRole("link", { name: "Quản lý ngân sách" }),
  ).toHaveAttribute("href", "/finance?tab=budgets");
});
it("lịch sử dành dụm cần xác nhận trước hoàn tác", async () => {
  const remove = vi.spyOn(apiClient, "delete").mockResolvedValue({});
  wrap(
    <PlanningPanel section="goals" wallets={wallets} categories={categories} />,
  );
  await userEvent.click(await screen.findByRole("button", { name: "Lịch sử" }));
  await userEvent.click(
    await screen.findByRole("button", { name: "Hoàn tác" }),
  );
  expect(remove).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole("button", { name: "Xác nhận hoàn tác" }),
  );
  await waitFor(() =>
    expect(remove).toHaveBeenCalledWith(
      "/goals/goal/contributions/contribution",
    ),
  );
});
it("xóa mục tiêu có hộp xác nhận và giữ số dư ví", async () => {
  const remove = vi.spyOn(apiClient, "delete").mockResolvedValue({});
  wrap(
    <PlanningPanel section="goals" wallets={wallets} categories={categories} />,
  );
  await userEvent.click(
    await screen.findByRole("button", { name: "Xóa mục tiêu Đà Lạt" }),
  );
  expect(remove).not.toHaveBeenCalled();
  expect(screen.getByText(/Số dư ví không thay đổi/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Xác nhận xóa" }));
  await waitFor(() => expect(remove).toHaveBeenCalledWith("/goals/goal"));
});
it("tạm dừng lịch và chạy kỳ đến hạn dùng API thật", async () => {
  const put = vi.spyOn(apiClient, "put").mockResolvedValue({ data: recurring }),
    post = vi
      .spyOn(apiClient, "post")
      .mockResolvedValue({ data: { created: 1, error: null } });
  wrap(
    <PlanningPanel
      section="recurring"
      wallets={wallets}
      categories={categories}
    />,
  );
  expect(await screen.findByText("Ví không đủ tiền.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Tạm dừng" }));
  await waitFor(() =>
    expect(put).toHaveBeenCalledWith("/recurring/recurring", {
      enabled: false,
    }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Chạy kỳ đến hạn" }),
  );
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith("/recurring/recurring/run", {}),
  );
});
it("báo cáo có bảng số liệu và đổi 12 tháng", async () => {
  wrap(<PlanningReports />);
  expect(await screen.findByRole("table")).toBeInTheDocument();
  expect(screen.getByText("2026-09")).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText("Khoảng xem"), "12");
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenLastCalledWith("/reports/monthly", {
      params: expect.objectContaining({ months: 12 }),
    }),
  );
});
it("CSV dùng bộ lọc hiện tại và response blob", async () => {
  Object.defineProperty(URL, "createObjectURL", {
    value: vi.fn(() => "blob:qa"),
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: vi.fn(),
    configurable: true,
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const get = vi
    .spyOn(apiClient, "get")
    .mockResolvedValue({ data: new Blob(["CSV"]) });
  wrap(
    <ExportHistoryButton
      filters={{ search: "Cà phê", type: "expense", walletId: "" }}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Xuất CSV" }));
  await waitFor(() =>
    expect(get).toHaveBeenCalledWith("/transactions/export", {
      params: { search: "Cà phê", type: "expense" },
      responseType: "blob",
    }),
  );
});
it("lỗi máy chủ hiển thị trong biểu mẫu ngân sách", async () => {
  vi.spyOn(apiClient, "post").mockRejectedValue({
    isAxiosError: true,
    response: {
      data: { error: { message: "Danh mục đã có ngân sách cho tháng này." } },
    },
  });
  wrap(
    <BudgetForm budget={undefined} categories={categories} onClose={vi.fn()} />,
  );
  await userEvent.selectOptions(screen.getByLabelText("Danh mục chi"), "food");
  await userEvent.type(screen.getByLabelText("Giới hạn chi (đ)"), "100000");
  await userEvent.click(screen.getByRole("button", { name: "Lưu ngân sách" }));
  expect(
    await screen.findByText("Danh mục đã có ngân sách cho tháng này."),
  ).toBeInTheDocument();
});

it("lưu ghi chú mẫu định kỳ đã kết thúc mà không bị chặn bởi kỳ sau", async () => {
  vi.spyOn(apiClient, "put").mockResolvedValue({ data: {} });
  wrap(
    <RecurringForm
      recurring={{
        ...recurring,
        enabled: false,
        nextDate: "2026-11-30",
        endDate: "2026-10-31",
      }}
      wallets={wallets}
      categories={categories}
      onClose={vi.fn()}
    />,
  );
  await userEvent.type(screen.getByLabelText("Ghi chú"), "Đã hoàn tất");
  await userEvent.click(
    screen.getByRole("button", { name: "Lưu lịch định kỳ" }),
  );
  await waitFor(() =>
    expect(apiClient.put).toHaveBeenCalledWith(
      "/recurring/recurring",
      expect.objectContaining({ enabled: false, notes: "Đã hoàn tất" }),
    ),
  );
});
