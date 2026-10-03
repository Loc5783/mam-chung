import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "../app/App";
import { useAuthStore, Profile } from "../features/auth/store";
import { apiClient } from "../lib/apiClient";
vi.mock("../lib/apiClient", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/apiClient")>(
      "../lib/apiClient",
    );
  return { ...actual, restoreSession: vi.fn() };
});
const profile: Profile = {
  id: "test-user",
  email: "minh@example.test",
  name: "Minh",
  avatar: null,
  timezone: "Asia/Ho_Chi_Minh",
  coupleId: null,
  createdAt: "2026-10-02T00:00:00Z",
};
function renderApp(path = "/", authenticated = false) {
  if (authenticated) useAuthStore.getState().setSession("token", profile);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[path]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(apiClient, "get").mockResolvedValue({
    data: {
      month: "2026-10",
      timezone: "Asia/Ho_Chi_Minh",
      totalBalance: 0,
      income: 0,
      expense: 0,
      incomeChange: null,
      expenseChange: null,
      wallets: [],
      spending: [],
      recent: [],
      items: [],
      total: 0,
    },
  });
  useAuthStore.getState().clear();
});
describe("Tài khoản và giao diện", () => {
  it("xem dữ liệu mẫu tại trang preview", () => {
    renderApp("/preview");
    expect(screen.getByText(/Các số liệu bên dưới/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Chi tiêu của bạn" }),
    ).toBeInTheDocument();
  });
  it("yêu cầu đăng nhập khi chưa có phiên", () => {
    renderApp("/settings");
    expect(
      screen.getByRole("button", { name: "Đăng nhập" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Hồ sơ & cài đặt" }),
    ).not.toBeInTheDocument();
  });
  it("biểu mẫu đăng ký hiển thị lỗi ngay dưới trường", async () => {
    renderApp("/register");
    await userEvent.click(
      screen.getByRole("button", { name: "Tạo tài khoản" }),
    );
    expect(
      await screen.findByText("Tên cần ít nhất 2 ký tự."),
    ).toBeInTheDocument();
    expect(screen.getByText("Vui lòng nhập email hợp lệ.")).toBeInTheDocument();
  });
  it("đăng nhập thành công lưu phiên và mở không gian thật", async () => {
    const post = vi
      .spyOn(apiClient, "post")
      .mockResolvedValue({ data: { accessToken: "new-token", user: profile } });
    renderApp("/login");
    await userEvent.type(screen.getByLabelText("Email"), "minh@example.test");
    await userEvent.type(screen.getByLabelText("Mật khẩu"), "Secret12345");
    await userEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
    expect(
      await screen.findByRole("heading", { name: /Chào Minh/ }),
    ).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith("/auth/login", {
      email: "minh@example.test",
      password: "Secret12345",
    });
    expect(useAuthStore.getState().accessToken).toBe("new-token");
    expect(screen.queryByText("24.500.000 đ")).not.toBeInTheDocument();
  });
  it("lỗi đăng nhập hiện trên form, không mở route riêng tư", async () => {
    vi.spyOn(apiClient, "post").mockRejectedValue({
      isAxiosError: true,
      response: {
        data: { error: { message: "Email hoặc mật khẩu không đúng." } },
        status: 401,
      },
    });
    renderApp("/login");
    await userEvent.type(screen.getByLabelText("Email"), "minh@example.test");
    await userEvent.type(screen.getByLabelText("Mật khẩu"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email hoặc mật khẩu không đúng.",
    );
    expect(useAuthStore.getState().status).toBe("anonymous");
  });
  it("điều hướng công việc sau đăng nhập", async () => {
    renderApp("/", true);
    await userEvent.click(
      screen.getAllByRole("link", { name: "Công việc" })[0],
    );
    expect(
      screen.getByRole("heading", { name: "Công việc đang chờ được vun đắp" }),
    ).toBeInTheDocument();
  });
  it("cập nhật tên hồ sơ và thông tin trên sidebar", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: profile });
    const put = vi
      .spyOn(apiClient, "put")
      .mockResolvedValue({ data: { ...profile, name: "Minh mới" } });
    renderApp("/settings", true);
    const input = await screen.findByLabelText("Họ và tên");
    await userEvent.clear(input);
    await userEvent.type(input, "Minh mới");
    await userEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() =>
      expect(useAuthStore.getState().user?.name).toBe("Minh mới"),
    );
    expect(put).toHaveBeenCalledWith("/users/me", {
      name: "Minh mới",
      avatar: null,
      timezone: "Asia/Ho_Chi_Minh",
    });
  });
  it("chặn mật khẩu xác nhận chưa khớp trước khi gọi máy chủ", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: profile });
    const post = vi.spyOn(apiClient, "post");
    renderApp("/settings", true);
    await screen.findByLabelText("Họ và tên");
    await userEvent.type(
      screen.getByLabelText("Mật khẩu hiện tại"),
      "Secret12345",
    );
    await userEvent.type(
      screen.getByLabelText("Mật khẩu mới", { exact: true }),
      "Updated12345",
    );
    await userEvent.type(
      screen.getByLabelText("Nhập lại mật khẩu mới"),
      "Mismatch123",
    );
    await userEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));
    expect(
      await screen.findByText("Mật khẩu nhập lại chưa khớp."),
    ).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
  it("đổi mật khẩu xong xóa phiên và yêu cầu đăng nhập lại", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: profile });
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({ status: 204 });
    renderApp("/settings", true);
    await screen.findByLabelText("Họ và tên");
    await userEvent.type(
      screen.getByLabelText("Mật khẩu hiện tại"),
      "Secret12345",
    );
    await userEvent.type(
      screen.getByLabelText("Mật khẩu mới", { exact: true }),
      "Updated12345",
    );
    await userEvent.type(
      screen.getByLabelText("Nhập lại mật khẩu mới"),
      "Updated12345",
    );
    await userEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));
    expect(
      await screen.findByRole("button", { name: "Đăng nhập" }),
    ).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith("/auth/change-password", {
      currentPassword: "Secret12345",
      newPassword: "Updated12345",
    });
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
  it("hộp thoại xóa yêu cầu mật khẩu, cho phép hủy", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: profile });
    const remove = vi.spyOn(apiClient, "delete");
    renderApp("/settings", true);
    await screen.findByLabelText("Họ và tên");
    await userEvent.click(
      screen.getByRole("button", { name: "Xóa tài khoản" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xác nhận xóa" })).toBeDisabled();
    await userEvent.click(
      screen.getByRole("button", { name: "Giữ tài khoản" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(remove).not.toHaveBeenCalled();
  });
  it("xóa tài khoản xong xóa phiên trong trình duyệt", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: profile });
    const remove = vi
      .spyOn(apiClient, "delete")
      .mockResolvedValue({ status: 204 });
    renderApp("/settings", true);
    await screen.findByLabelText("Họ và tên");
    await userEvent.click(
      screen.getByRole("button", { name: "Xóa tài khoản" }),
    );
    await userEvent.type(
      screen.getByLabelText("Mật khẩu xác nhận"),
      "Secret12345",
    );
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận xóa" }));
    expect(
      await screen.findByRole("button", { name: "Đăng nhập" }),
    ).toBeInTheDocument();
    expect(remove).toHaveBeenCalledWith("/users/me", {
      data: { password: "Secret12345" },
    });
    expect(useAuthStore.getState().user).toBeNull();
  });
  it("đăng xuất gọi API thu hồi cookie và mở trang đăng nhập", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: profile });
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({ status: 204 });
    renderApp("/settings", true);
    await screen.findByLabelText("Họ và tên");
    await userEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
    expect(
      await screen.findByRole("button", { name: "Đăng nhập" }),
    ).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith("/auth/logout");
    expect(useAuthStore.getState().status).toBe("anonymous");
  });
});
