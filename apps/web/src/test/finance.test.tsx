import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import {
  WalletForm,
  TransactionForm,
  CategoryForm,
  TransferForm,
} from "../features/finance/FinanceForms";
import {
  FinancePage,
  TransactionHistory,
} from "../features/finance/FinancePage";
import {
  DeleteDialog,
  ReconcileDialog,
} from "../features/finance/FinanceActions";
import { FinanceOverview } from "../features/finance/FinanceOverview";
import { useAuthStore } from "../features/auth/store";
import { apiClient } from "../lib/apiClient";
import { Category, Entry, Wallet } from "../features/finance/types";
const wallets: Wallet[] = [
  {
    id: "wallet-one",
    name: "Tiền mặt",
    type: "cash",
    currency: "VND",
    balance: 500000,
    allowNegative: false,
    archived: false,
    color: "#7E9B57",
    icon: "Wallet",
    createdAt: "2026-10-02T00:00:00Z",
  },
  {
    id: "wallet-two",
    name: "Ngân hàng",
    type: "bank",
    currency: "VND",
    balance: 1000000,
    allowNegative: false,
    archived: false,
    color: "#E38FA9",
    icon: "Landmark",
    createdAt: "2026-10-02T00:00:00Z",
  },
];
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
  {
    id: "coffee",
    name: "Cà phê",
    type: "expense",
    icon: "Coffee",
    isSystem: false,
  },
];
const entry: Entry = {
  id: "entry-one",
  type: "expense",
  kind: "transaction",
  amount: 50000,
  walletId: "wallet-one",
  walletName: "Tiền mặt",
  walletColor: "#7E9B57",
  walletArchived: false,
  categoryId: "food",
  categoryName: "Ăn uống",
  categoryIcon: "Utensils",
  date: "2026-10-02T05:00:00Z",
  description: "Bữa trưa",
  notes: "Cùng bạn",
  tags: ["học tập"],
  transferId: null,
  counterWalletId: null,
};
const dashboard = {
  month: "2026-10",
  timezone: "Asia/Ho_Chi_Minh",
  totalBalance: 1500000,
  income: 1000000,
  expense: 50000,
  incomeChange: null,
  expenseChange: 10,
  wallets,
  spending: [],
  recent: [entry],
};
function wrap(node: React.ReactNode, path = "/finance") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[path]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        {node}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.restoreAllMocks();
  useAuthStore.getState().setSession("token", {
    id: "qa",
    email: "qa@example.test",
    name: "QA",
    avatar: null,
    timezone: "Asia/Ho_Chi_Minh",
    coupleId: null,
    createdAt: "2026-10-02T00:00:00Z",
  });
  vi.spyOn(apiClient, "get").mockImplementation(async (url) => ({
    data:
      url === "/wallets"
        ? { items: wallets, total: 2 }
        : url === "/categories"
          ? { items: categories, total: 3 }
          : url === "/transactions"
            ? {
                items: [entry],
                total: 21,
                page: 1,
                limit: 20,
                summary: { income: 1000000, expense: 50000, net: 950000 },
              }
            : dashboard,
  }));
});
it("ví mới kiểm tra tên và số dư trước khi gửi", async () => {
  const post = vi.spyOn(apiClient, "post");
  wrap(<WalletForm onClose={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Tạo ví" }));
  expect(await screen.findByText("Vui lòng nhập tên ví.")).toBeInTheDocument();
  expect(post).not.toHaveBeenCalled();
});
it("tạo ví gửi số tiền nguyên và tùy chọn bảo vệ", async () => {
  const close = vi.fn(),
    post = vi.spyOn(apiClient, "post").mockResolvedValue({ data: wallets[0] });
  wrap(<WalletForm onClose={close} />);
  await userEvent.type(screen.getByLabelText("Tên ví"), "Ví mới");
  const balance = screen.getByLabelText(/Số dư ban đầu/);
  await userEvent.clear(balance);
  await userEvent.type(balance, "75000");
  await userEvent.click(screen.getByRole("button", { name: "Tạo ví" }));
  await waitFor(() => expect(close).toHaveBeenCalled());
  expect(post).toHaveBeenCalledWith(
    "/wallets",
    expect.objectContaining({
      initialBalance: 75000,
      allowNegative: false,
      name: "Ví mới",
    }),
  );
});
it("sửa ví không gửi số dư để tránh ghi đè sổ", async () => {
  const put = vi
    .spyOn(apiClient, "put")
    .mockResolvedValue({ data: wallets[0] });
  wrap(<WalletForm wallet={wallets[0]} onClose={vi.fn()} />);
  expect(screen.queryByLabelText(/Số dư ban đầu/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await waitFor(() => expect(put).toHaveBeenCalled());
  expect(put.mock.calls[0][1]).not.toHaveProperty("initialBalance");
});
it("giao dịch kiểm tra số tiền, danh mục và mô tả", async () => {
  const post = vi.spyOn(apiClient, "post");
  wrap(
    <TransactionForm
      wallets={wallets}
      categories={categories}
      onClose={vi.fn()}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Lưu giao dịch" }));
  expect(await screen.findByText("Vui lòng nhập số tiền.")).toBeInTheDocument();
  expect(screen.getByText("Vui lòng chọn danh mục.")).toBeInTheDocument();
  expect(post).not.toHaveBeenCalled();
});
it("đổi loại chỉ hiển thị danh mục phù hợp", async () => {
  wrap(
    <TransactionForm
      wallets={wallets}
      categories={categories}
      onClose={vi.fn()}
    />,
  );
  await userEvent.selectOptions(screen.getByLabelText("Danh mục"), "food");
  await userEvent.selectOptions(
    screen.getByLabelText("Loại giao dịch"),
    "income",
  );
  expect(screen.getByLabelText("Danh mục")).toHaveValue("");
  expect(screen.getByRole("option", { name: "Lương" })).toBeInTheDocument();
  expect(
    screen.queryByRole("option", { name: "Ăn uống" }),
  ).not.toBeInTheDocument();
});
it("sửa giao dịch giữ nhãn và cập nhật cùng số dư qua API", async () => {
  const put = vi.spyOn(apiClient, "put").mockResolvedValue({ data: entry });
  wrap(
    <TransactionForm
      entry={entry}
      wallets={wallets}
      categories={categories}
      onClose={vi.fn()}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await waitFor(() =>
    expect(put).toHaveBeenCalledWith(
      "/transactions/entry-one",
      expect.objectContaining({
        amount: 50000,
        tags: ["học tập"],
        date: "2026-10-02",
      }),
    ),
  );
});
it("lỗi thiếu số dư hiển thị trong hộp thoại", async () => {
  vi.spyOn(apiClient, "put").mockRejectedValue({
    isAxiosError: true,
    response: { data: { error: { message: "Ví không đủ số dư." } } },
  });
  wrap(
    <TransactionForm
      entry={entry}
      wallets={wallets}
      categories={categories}
      onClose={vi.fn()}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  expect(await screen.findByText("Ví không đủ số dư.")).toBeInTheDocument();
});
it("chặn chuyển tiền về cùng một ví", async () => {
  const post = vi.spyOn(apiClient, "post");
  wrap(<TransferForm wallets={wallets} onClose={vi.fn()} />);
  await userEvent.selectOptions(screen.getByLabelText("Đến ví"), "wallet-one");
  await userEvent.type(screen.getByLabelText("Số tiền chuyển (đ)"), "10000");
  await userEvent.click(
    screen.getByRole("button", { name: "Ghi chuyển tiền" }),
  );
  expect(
    await screen.findByText("Ví nhận phải khác ví gửi."),
  ).toBeInTheDocument();
  expect(post).not.toHaveBeenCalled();
});
it("danh mục riêng kiểm tra tên", async () => {
  wrap(<CategoryForm onClose={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Lưu danh mục" }));
  expect(
    await screen.findByText("Vui lòng nhập tên danh mục."),
  ).toBeInTheDocument();
});
it("lịch sử gửi bộ lọc, phân trang và hiển thị tổng toàn kết quả", async () => {
  wrap(
    <TransactionHistory
      wallets={wallets}
      categories={categories}
      onDialog={vi.fn()}
    />,
  );
  expect(await screen.findByText("Bữa trưa")).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText("Ví"), "wallet-two");
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenLastCalledWith(
      "/transactions",
      expect.objectContaining({
        params: expect.objectContaining({ walletId: "wallet-two", page: 1 }),
      }),
    ),
  );
  await userEvent.click(screen.getByRole("button", { name: "Sau" }));
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenLastCalledWith(
      "/transactions",
      expect.objectContaining({ params: expect.objectContaining({ page: 2 }) }),
    ),
  );
  expect(screen.getByText(/Không tính chuyển tiền/)).toBeInTheDocument();
});
it("nhân bản là thao tác API thực sự và có thông báo rõ", async () => {
  const post = vi.spyOn(apiClient, "post").mockResolvedValue({ data: entry });
  wrap(
    <TransactionHistory
      wallets={wallets}
      categories={categories}
      onDialog={vi.fn()}
    />,
  );
  await userEvent.click(
    await screen.findByRole("button", { name: "Nhân bản Bữa trưa" }),
  );
  expect(post).toHaveBeenCalledWith("/transactions/entry-one/duplicate", {});
});
it("xóa danh mục gửi danh mục thay thế được chọn", async () => {
  const remove = vi.spyOn(apiClient, "delete").mockResolvedValue({});
  wrap(
    <DeleteDialog
      dialog={{ kind: "delete-category", category: categories[2] }}
      categories={categories}
      onClose={vi.fn()}
    />,
  );
  await userEvent.selectOptions(
    screen.getByLabelText("Danh mục thay thế"),
    "food",
  );
  await userEvent.click(screen.getByRole("button", { name: "Xác nhận xóa" }));
  await waitFor(() =>
    expect(remove).toHaveBeenCalledWith("/categories/coffee", {
      data: { replacementId: "food" },
    }),
  );
});
it("đối soát chỉ sửa sau xác nhận riêng", async () => {
  const post = vi.spyOn(apiClient, "post").mockResolvedValue({
    data: {
      walletId: "wallet-one",
      actualBalance: 5,
      expectedBalance: 10,
      difference: -5,
      matched: false,
      repaired: false,
    },
  });
  wrap(<ReconcileDialog wallet={wallets[0]} onClose={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Kiểm tra số dư" }));
  await userEvent.click(
    await screen.findByRole("button", { name: "Sửa theo sổ" }),
  );
  expect(post).toHaveBeenCalledTimes(1);
  await userEvent.click(
    screen.getByRole("button", { name: "Xác nhận sửa số dư" }),
  );
  await waitFor(() =>
    expect(post).toHaveBeenLastCalledWith("/wallets/wallet-one/reconcile", {
      repair: true,
    }),
  );
});
it("tài khoản chưa có ví thấy trạng thái trống và nút tạo ví", async () => {
  vi.spyOn(apiClient, "get").mockResolvedValue({
    data: {
      ...dashboard,
      wallets: [],
      recent: [],
      income: 0,
      expense: 0,
      totalBalance: 0,
    },
  });
  wrap(<FinanceOverview onAdd={vi.fn()} onWallet={vi.fn()} />);
  expect(await screen.findByText("Gieo chiếc ví đầu tiên")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Tạo ví đầu tiên" }),
  ).toBeInTheDocument();
});
it("không cho sửa hoặc xóa danh mục hệ thống", async () => {
  wrap(<FinancePage />, "/finance?tab=categories");
  expect(await screen.findByText("Ăn uống")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Sửa danh mục Ăn uống" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Sửa danh mục Cà phê" }),
  ).toBeInTheDocument();
});

it.each([
  { label: "chưa có ví", items: [] },
  { label: "chỉ có một ví", items: [wallets[0]] },
  {
    label: "ví thứ hai đã lưu trữ",
    items: [wallets[0], { ...wallets[1], archived: true }],
  },
])(
  "giải thích chuyển tiền chưa sẵn sàng khi $label và cho thêm ví",
  async ({ items }) => {
    const originalGet = vi.mocked(apiClient.get).getMockImplementation()!;
    vi.mocked(apiClient.get).mockImplementation(async (...args) =>
      args[0] === "/wallets"
        ? { data: { items, total: items.length } }
        : originalGet(...args),
    );
    wrap(<FinancePage />, "/finance?tab=wallets");
    expect(
      await screen.findByText(/Cần ít nhất 2 ví đang hoạt động/),
    ).toBeInTheDocument();
    const transfer = screen.getByRole("button", {
      name: "Chuyển tiền",
    });
    expect(transfer).toBeDisabled();
    expect(transfer).toHaveAccessibleDescription(/Cần ít nhất 2 ví/);
    await userEvent.click(screen.getByRole("button", { name: "Thêm ví" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Tên ví")).toBeInTheDocument();
  },
);
it("hai ví hoạt động mở biểu mẫu chuyển tiền và gửi đúng ví/tiền", async () => {
  const post = vi.spyOn(apiClient, "post").mockResolvedValue({ data: {} });
  wrap(<FinancePage />, "/finance?tab=wallets");
  const transfer = screen.getByRole("button", {
    name: "Chuyển tiền",
  });
  await waitFor(() => expect(transfer).toBeEnabled());
  expect(
    screen.queryByText(/Cần ít nhất 2 ví đang hoạt động/),
  ).not.toBeInTheDocument();
  await userEvent.click(transfer);
  expect(screen.getByRole("combobox", { name: /^Từ ví/ })).toHaveValue(
    "wallet-one",
  );
  expect(screen.getByLabelText("Đến ví")).toHaveValue("wallet-two");
  await userEvent.type(screen.getByLabelText("Số tiền chuyển (đ)"), "10000");
  await userEvent.click(
    screen.getByRole("button", { name: "Ghi chuyển tiền" }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(post).toHaveBeenCalledWith(
    "/wallets/transfer",
    expect.objectContaining({
      fromWalletId: "wallet-one",
      toWalletId: "wallet-two",
      amount: 10000,
    }),
  );
});
