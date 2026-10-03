import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, it, expect, vi } from "vitest";
import { SharedForm, Dialog } from "../features/shared/SharedForm";
import { SharedFinancePage } from "../features/shared/SharedFinancePage";
import { apiClient } from "../lib/apiClient";
import { useAuthStore } from "../features/auth/store";
import {
  SharedFunds,
  SharedDashboard,
  Settlement,
  SharedTransaction,
} from "../features/shared/types";
const wallet = {
  id: "fund",
  name: "Sinh hoạt",
  balance: 500000,
  archived: false,
  createdAt: "2026-10-03T00:00:00Z",
};
const members = [
  { id: "minh", name: "Minh", active: true },
  { id: "lan", name: "Lan", active: true },
];
const categories = [
  {
    id: "food",
    name: "Ăn uống",
    type: "expense" as const,
    isSystem: true,
    icon: "Utensils",
  },
];
const goal = {
  id: "goal",
  name: "Du lịch",
  targetAmount: 1000000,
  savedAmount: 200000,
  progress: 20,
  deadline: null,
  notes: "",
};
const row: Settlement = {
  id: "debt",
  fromUserId: "lan",
  toUserId: "minh",
  fromName: "Lan",
  toName: "Minh",
  amount: 50,
  status: "pending_confirm",
  sourceTransactionId: "tx",
  notes: "Đã chuyển",
  createdAt: "2026-10-03T05:00:00Z",
  markedAt: "2026-10-03T06:00:00Z",
  paidAt: null,
};
const tx: SharedTransaction = {
  id: "tx",
  sharedWalletId: "fund",
  walletName: "Sinh hoạt",
  payerId: "minh",
  payerName: "Minh",
  createdBy: "minh",
  amount: 101,
  date: "2026-10-03T05:00:00Z",
  description: "Ăn chung",
  categoryId: "food",
  categoryName: "Ăn uống",
  splitType: "equal",
  paidFrom: "personal",
  splits: [
    { userId: "minh", name: "Minh", shareAmount: 51 },
    { userId: "lan", name: "Lan", shareAmount: 50 },
  ],
};
let funds: SharedFunds, dashboard: SharedDashboard, settlements: Settlement[];
function wrap(node: React.ReactNode, path = "/shared") {
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
        initialEntries={[path]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        {node}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
function form(dialog: Dialog) {
  wrap(
    <SharedForm
      dialog={dialog}
      wallets={[wallet]}
      members={members}
      categories={categories}
      onClose={vi.fn()}
    />,
  );
}
beforeEach(() => {
  vi.restoreAllMocks();
  useAuthStore.getState().setSession("token", {
    id: "minh",
    name: "Minh",
    email: "minh@test.local",
    coupleId: "couple",
    avatar: null,
    timezone: "Asia/Ho_Chi_Minh",
    createdAt: "2026-10-03T00:00:00Z",
  });
  funds = {
    items: [wallet],
    members,
    readOnly: false,
    coupleId: "couple",
    role: "owner",
  };
  dashboard = {
    month: "2026-10",
    readOnly: false,
    totalBalance: 500000,
    monthExpense: 101,
    categories: [{ categoryId: "food", name: "Ăn uống", amount: 101 }],
    summary: {
      amount: 50,
      fromUserId: "lan",
      toUserId: "minh",
      fromName: "Lan",
      toName: "Minh",
      outstandingCount: 1,
      pendingConfirmation: 1,
    },
    recent: [tx],
    goals: [goal],
  };
  settlements = [row];
  vi.spyOn(apiClient, "get").mockImplementation(async (url) => ({
    data:
      url === "/shared-wallets"
        ? funds
        : url === "/shared/dashboard"
          ? dashboard
          : url === "/categories"
            ? { items: categories }
            : url === "/shared-transactions"
              ? {
                  items: [tx],
                  total: 1,
                  page: 1,
                  limit: 20,
                  readOnly: funds.readOnly,
                }
              : url === "/settlements"
                ? {
                    items: settlements,
                    total: settlements.length,
                    page: 1,
                    limit: 20,
                    readOnly: funds.readOnly,
                  }
                : {
                    items: [
                      {
                        id: "contrib",
                        actorName: "Minh",
                        userId: "minh",
                        amount: 100000,
                        date: "2026-10-03T05:00:00Z",
                        notes: "Dành dụm",
                      },
                    ],
                    total: 1,
                    page: 1,
                    limit: 20,
                    readOnly: funds.readOnly,
                  },
  }));
  vi.spyOn(apiClient, "post").mockResolvedValue({ data: {} });
  vi.spyOn(apiClient, "put").mockResolvedValue({ data: {} });
  vi.spyOn(apiClient, "delete").mockResolvedValue({ data: {} });
});
it("quỹ mới kiểm tra tên, không nhập số dư tùy ý", async () => {
  form({ kind: "wallet" });
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  expect(await screen.findByText("Tên cần 1–100 ký tự.")).toBeInTheDocument();
  expect(apiClient.post).not.toHaveBeenCalled();
  await userEvent.type(screen.getByLabelText("Tên"), "Du lịch");
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith("/shared-wallets", {
      name: "Du lịch",
    }),
  );
  expect(screen.queryByLabelText("Số dư")).not.toBeInTheDocument();
});
it("nạp quỹ là ghi nhận tiền, gửi số tiền nguyên và ngày", async () => {
  form({ kind: "deposit", wallet });
  await userEvent.type(screen.getByLabelText("Số tiền (đ)"), "10000");
  await userEvent.type(screen.getByLabelText("Ghi chú"), "Nạp thực tế");
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith(
      "/shared-wallets/fund/contribute",
      expect.objectContaining({ amount: 10000, notes: "Nạp thực tế" }),
    ),
  );
  expect(screen.getByText(/không tự trừ ví cá nhân/)).toBeInTheDocument();
});
it("equal gửi nguồn tiền và payer, không gửi split giả", async () => {
  form({ kind: "expense" });
  await userEvent.type(screen.getByLabelText("Số tiền (đ)"), "101");
  await userEvent.type(screen.getByLabelText("Mô tả"), "Ăn chung");
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith(
      "/shared-transactions",
      expect.objectContaining({
        amount: 101,
        splitType: "equal",
        paidFrom: "personal",
        payerId: "minh",
      }),
    ),
  );
  expect(vi.mocked(apiClient.post).mock.calls[0][1]).not.toHaveProperty(
    "splits",
  );
});
it("custom sai tổng chặn trước khi gửi; đúng tổng gồm phần 0", async () => {
  form({ kind: "expense" });
  await userEvent.type(screen.getByLabelText("Số tiền (đ)"), "101");
  await userEvent.type(screen.getByLabelText("Mô tả"), "Ăn chung");
  await userEvent.selectOptions(screen.getByLabelText("Cách chia"), "custom");
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  expect(await screen.findByText(/Tổng hai phần chia/)).toBeInTheDocument();
  expect(apiClient.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Minh (đ)"), {
    target: { value: "0" },
  });
  fireEvent.change(screen.getByLabelText("Lan (đ)"), {
    target: { value: "101" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith(
      "/shared-transactions",
      expect.objectContaining({
        splits: [
          { userId: "minh", shareAmount: 0 },
          { userId: "lan", shareAmount: 101 },
        ],
      }),
    ),
  );
});
it("percent tổng sai hoặc nhiều thập phân bị chặn", async () => {
  form({ kind: "expense" });
  await userEvent.type(screen.getByLabelText("Số tiền (đ)"), "101");
  await userEvent.type(screen.getByLabelText("Mô tả"), "Ăn chung");
  await userEvent.selectOptions(screen.getByLabelText("Cách chia"), "percent");
  fireEvent.change(screen.getByLabelText("Minh (%)"), {
    target: { value: "33.333" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  expect(
    await screen.findByText(/Tổng tỷ lệ phải bằng 100%/),
  ).toBeInTheDocument();
  expect(apiClient.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Minh (%)"), {
    target: { value: "33.33" },
  });
  fireEvent.change(screen.getByLabelText("Lan (%)"), {
    target: { value: "66.67" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith(
      "/shared-transactions",
      expect.objectContaining({
        splitType: "percent",
        splits: [
          { userId: "minh", percent: 33.33 },
          { userId: "lan", percent: 66.67 },
        ],
      }),
    ),
  );
});
it("lỗi thiếu quỹ hiện trên form", async () => {
  vi.mocked(apiClient.post).mockRejectedValue({
    isAxiosError: true,
    response: {
      data: { error: { message: "Quỹ không đủ tiền cho khoản chi này." } },
    },
  });
  form({ kind: "expense" });
  await userEvent.type(screen.getByLabelText("Số tiền (đ)"), "999999");
  await userEvent.type(screen.getByLabelText("Mô tả"), "Chi lớn");
  await userEvent.selectOptions(screen.getByLabelText("Nguồn tiền"), "fund");
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  expect(
    await screen.findByText("Quỹ không đủ tiền cho khoản chi này."),
  ).toBeInTheDocument();
});
it("action cần xác nhận rõ ràng và có ghi chú", async () => {
  form({
    kind: "action",
    path: "/settlements/debt/confirm",
    method: "put",
    title: "Xác nhận nhận tiền",
    message: "Chỉ khi đã nhận đủ ngoài ứng dụng.",
    settlement: row,
  });
  await userEvent.click(screen.getByRole("button", { name: "Xác nhận" }));
  expect(apiClient.put).not.toHaveBeenCalled();
  await userEvent.click(screen.getByLabelText("Tôi xác nhận nội dung trên"));
  await userEvent.type(screen.getByLabelText("Ghi chú"), "Đã nhận");
  await userEvent.click(screen.getByRole("button", { name: "Xác nhận" }));
  await waitFor(() =>
    expect(apiClient.put).toHaveBeenCalledWith("/settlements/debt/confirm", {
      notes: "Đã nhận",
    }),
  );
});
it("mục tiêu chung và dành dụm không chuyển tiền", async () => {
  form({ kind: "goal-deposit", goal });
  await userEvent.type(screen.getByLabelText("Số tiền (đ)"), "50000");
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith(
      "/shared-goals/goal/contribute",
      expect.objectContaining({ amount: 50000 }),
    ),
  );
  expect(screen.getByText(/không trừ quỹ hoặc ví/)).toBeInTheDocument();
});
it("dashboard hiện quỹ và số ròng, nạp quỹ và lịch sử có người góp", async () => {
  wrap(<SharedFinancePage />);
  expect(await screen.findByText("Lan nợ Minh 50 đ")).toBeInTheDocument();
  expect(screen.getByText("Sinh hoạt")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Lịch sử nạp" }));
  expect(await screen.findByText("Minh · 100.000 đ")).toBeInTheDocument();
});
it("người nhận có confirm/reject, không có Tôi đã trả", async () => {
  wrap(<SharedFinancePage />);
  await userEvent.click(await screen.findByRole("tab", { name: "Công nợ" }));
  expect(
    await screen.findByRole("button", { name: "Đã nhận tiền" }),
  ).toBeEnabled();
  expect(screen.getByRole("button", { name: "Từ chối" })).toBeEnabled();
  expect(
    screen.queryByRole("button", { name: "Tôi đã trả" }),
  ).not.toBeInTheDocument();
});
it("người nợ chỉ thấy Tôi đã trả khi pending", async () => {
  settlements = [
    { ...row, status: "pending", fromUserId: "minh", toUserId: "lan" },
  ];
  wrap(<SharedFinancePage />);
  await userEvent.click(await screen.findByRole("tab", { name: "Công nợ" }));
  expect(
    await screen.findByRole("button", { name: "Tôi đã trả" }),
  ).toBeEnabled();
  expect(
    screen.queryByRole("button", { name: "Đã nhận tiền" }),
  ).not.toBeInTheDocument();
});
it("archive chỉ đọc và mọi query scoped coupleId", async () => {
  funds = {
    ...funds,
    readOnly: true,
    members: members.map((m) => ({ ...m, active: false })),
  };
  wrap(<SharedFinancePage />, "/shared?coupleId=archived");
  expect(await screen.findByText(/Hành trình đã lưu trữ/)).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Nạp quỹ" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Tạo quỹ" }),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("tab", { name: "Công nợ" }));
  expect(await screen.findByText("Lan → Minh")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Đã nhận tiền" }),
  ).not.toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith("/settlements", {
    params: expect.objectContaining({ coupleId: "couple" }),
  });
});
it("phần chia chi tiết luôn hiện tổng chính xác", async () => {
  wrap(<SharedFinancePage />);
  await userEvent.click(
    await screen.findByRole("tab", { name: "Sổ chi chung" }),
  );
  await userEvent.click(
    await screen.findByRole("button", { name: "Phần chia" }),
  );
  expect(await screen.findByText("Tổng 101 đ")).toBeInTheDocument();
  expect(screen.getByText(/51 đ/)).toBeInTheDocument();
});
it("chưa có couple hiện hướng dẫn, không tạo số tiền giả", async () => {
  vi.mocked(apiClient.get).mockRejectedValue({
    isAxiosError: true,
    response: { data: { error: { message: "Không có quyền dữ liệu chung." } } },
  });
  wrap(<SharedFinancePage />);
  expect(
    await screen.findByRole("link", { name: /Tạo hoặc tham gia/ }),
  ).toBeInTheDocument();
  expect(screen.queryByText("Đã cân bằng")).not.toBeInTheDocument();
});
