import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "../app/App";
import { AuthPage } from "../features/auth/AuthPage";
import { useAuthStore, Profile } from "../features/auth/store";
import { apiClient } from "../lib/apiClient";
import { AdminConfirmModal } from "../features/admin/AdminConfirmModal";
import { TempPasswordModal } from "../features/admin/TempPasswordModal";
import { OverviewTab } from "../features/admin/OverviewTab";
import { UsersTab } from "../features/admin/UsersTab";
import { CouplesTab } from "../features/admin/CouplesTab";
import { SettingsTab } from "../features/admin/SettingsTab";

const normalUser: Profile = {
  id: "user-1",
  email: "normal@example.test",
  name: "Người Dùng",
  avatar: null,
  timezone: "Asia/Ho_Chi_Minh",
  coupleId: null,
  role: "user",
  createdAt: "2026-10-02T00:00:00Z",
};

const adminUser: Profile = {
  id: "admin-1",
  email: "admin@example.test",
  name: "Quản Trị Viên",
  avatar: null,
  timezone: "Asia/Ho_Chi_Minh",
  coupleId: null,
  role: "admin",
  createdAt: "2026-10-01T00:00:00Z",
};

function renderApp(path = "/", user: Profile | null = null) {
  if (user) {
    useAuthStore.getState().setSession("mock-token", user);
  } else {
    useAuthStore.getState().clear();
  }
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

describe("Admin Web Interface (Giai đoạn 4)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clear();
    // Default apiClient mock để tránh unhandled network calls trong jsdom
    vi.spyOn(apiClient, "get").mockImplementation(async (path) => {
      if (path === "/auth/registration-status") {
        return { data: { open: true } };
      }
      return { data: {} };
    });
  });

  describe("Điều hướng và cổng chặn phân quyền", () => {
    it("mục Quản trị ẩn với người dùng thường (role: user)", async () => {
      renderApp("/", normalUser);
      expect(screen.queryByTestId("nav-admin")).toBeNull();
      expect(screen.queryByText("Quản trị")).toBeNull();
    });

    it("mục Quản trị hiển thị trong điều hướng khi là admin (role: admin)", async () => {
      renderApp("/", adminUser);
      expect(screen.getByTestId("nav-admin")).toBeInTheDocument();
      expect(screen.getByText("Quản trị")).toBeInTheDocument();
    });

    it("người dùng thường truy cập /admin bị chuyển hướng về trang chủ", async () => {
      vi.spyOn(apiClient, "get").mockImplementation(async (path) => {
        if (path === "/dashboard") {
          return { data: { recent: [], spending: [], incomeByCategory: [] } };
        }
        return { data: {} };
      });

      renderApp("/admin", normalUser);

      // Chuyển về trang chủ, không hiển thị trang quản trị
      await waitFor(() => {
        expect(screen.queryByText("Quản trị hệ thống")).toBeNull();
      });
    });
  });

  describe("Hộp thoại xác nhận và bảo mật step-up", () => {
    it("AdminConfirmModal bắt buộc nhập mật khẩu admin", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      const onClose = vi.fn();

      render(
        <AdminConfirmModal
          title="Xác nhận tạm khóa"
          message="Hành động này sẽ tạm khóa tài khoản."
          busy={false}
          onClose={onClose}
          onConfirm={onConfirm}
        />,
      );

      // Nút xác nhận bị disable khi chưa nhập mật khẩu
      const submitBtn = screen.getByRole("button", { name: "Xác nhận" });
      expect(submitBtn).toBeDisabled();

      // Nhập mật khẩu
      const passInput = screen.getByPlaceholderText(
        "Nhập mật khẩu quản trị viên",
      );
      await user.type(passInput, "Secret123");
      expect(submitBtn).not.toBeDisabled();

      // Submit
      await user.click(submitBtn);
      expect(onConfirm).toHaveBeenCalledWith("Secret123");
    });

    it("với thao tác xóa, yêu cầu gõ lại đúng email người dùng", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      const onClose = vi.fn();

      render(
        <AdminConfirmModal
          title="Xác nhận xóa tài khoản"
          message="Hành động này sẽ xóa mềm tài khoản."
          requireEmailConfirmation="victim@example.com"
          actionLabel="Xác nhận xóa"
          busy={false}
          onClose={onClose}
          onConfirm={onConfirm}
        />,
      );

      const submitBtn = screen.getByRole("button", { name: "Xác nhận xóa" });
      const emailInput = screen.getByPlaceholderText("victim@example.com");
      const passInput = screen.getByPlaceholderText(
        "Nhập mật khẩu quản trị viên",
      );

      await user.type(passInput, "AdminPassword");
      // Chưa gõ đúng email -> nút submit bị disabled
      expect(submitBtn).toBeDisabled();

      // Gõ sai email
      await user.type(emailInput, "wrong@example.com");
      expect(submitBtn).toBeDisabled();

      // Gõ đúng email
      await user.clear(emailInput);
      await user.type(emailInput, "victim@example.com");
      expect(submitBtn).not.toBeDisabled();

      await user.click(submitBtn);
      expect(onConfirm).toHaveBeenCalledWith("AdminPassword");
    });

    it("hiển thị lỗi ADMIN_PASSWORD_INVALID ngay tại ô mật khẩu", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn().mockRejectedValue({
        response: {
          status: 403,
          data: {
            error: {
              code: "ADMIN_PASSWORD_INVALID",
              message: "Mật khẩu quản trị viên không chính xác.",
            },
          },
        },
      });

      render(
        <AdminConfirmModal
          title="Xác nhận"
          message="Thông điệp thử nghiệm."
          busy={false}
          onClose={vi.fn()}
          onConfirm={onConfirm}
        />,
      );

      const passInput = screen.getByPlaceholderText(
        "Nhập mật khẩu quản trị viên",
      );
      await user.type(passInput, "WrongPassword");
      await user.click(screen.getByRole("button", { name: "Xác nhận" }));

      await waitFor(() => {
        expect(
          screen.getByText("Mật khẩu quản trị viên không chính xác."),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Hộp mật khẩu tạm một lần (TempPasswordModal)", () => {
    it("hiển thị mật khẩu tạm và cảnh báo chỉ hiện một lần, có nút sao chép", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const copySpy = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: copySpy },
        configurable: true,
      });

      render(
        <TempPasswordModal
          temporaryPassword="TempPassword123!"
          userEmail="target@example.com"
          onClose={onClose}
        />,
      );

      // Hiển thị mật khẩu tạm
      expect(
        screen.getByTestId("temporary-password-display"),
      ).toHaveTextContent("TempPassword123!");
      // Hiển thị cảnh báo
      expect(screen.getByText(/Chỉ hiện một lần/)).toBeInTheDocument();

      // Bấm nút sao chép
      const copyBtn = screen.getByRole("button", { name: "Sao chép mật khẩu" });
      await user.click(copyBtn);
      expect(copySpy).toHaveBeenCalledWith("TempPassword123!");

      // Bấm nút đóng
      const closeBtn = screen.getByRole("button", { name: "Đã lưu & Đóng" });
      await user.click(closeBtn);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("Trang đăng ký khi cổng đăng ký đóng (4.5)", () => {
    it("khi registration-status.open = false, hiện cảnh báo 'Hiện chưa mở đăng ký' và khóa form", async () => {
      vi.spyOn(apiClient, "get").mockImplementation(async (path) => {
        if (path === "/auth/registration-status") {
          return { data: { open: false } };
        }
        return { data: {} };
      });

      render(
        <MemoryRouter>
          <AuthPage registerMode={true} />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText(/Hiện chưa mở đăng ký/i)).toBeInTheDocument();
      });

      // Các input và button đều bị disable
      expect(screen.getByPlaceholderText("Tên của bạn")).toBeDisabled();
      expect(screen.getByPlaceholderText("ban@example.com")).toBeDisabled();
      expect(
        screen.getByPlaceholderText("Ít nhất 8 ký tự, có chữ và số"),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Tạo tài khoản" }),
      ).toBeDisabled();

      // Vẫn có liên kết chuyển sang đăng nhập
      expect(
        screen.getByRole("link", { name: "Đăng nhập" }),
      ).toBeInTheDocument();
    });

    it("khi registration-status.open = true, form đăng ký mở bình thường", async () => {
      vi.spyOn(apiClient, "get").mockImplementation(async (path) => {
        if (path === "/auth/registration-status") {
          return { data: { open: true } };
        }
        return { data: {} };
      });

      render(
        <MemoryRouter>
          <AuthPage registerMode={true} />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Tên của bạn")).not.toBeDisabled();
        expect(
          screen.getByRole("button", { name: "Tạo tài khoản" }),
        ).not.toBeDisabled();
        expect(screen.queryByText(/Hiện chưa mở đăng ký/i)).toBeNull();
      });
    });
  });

  describe("Cách ly dữ liệu và quyền riêng tư (CouplesTab)", () => {
    it("thẻ cặp đôi trong tab couples KHÔNG render bất kỳ trường tài chính/việc/sức khỏe nào", async () => {
      vi.spyOn(apiClient, "get").mockImplementation(async (path) => {
        if (path === "/admin/couples") {
          return {
            data: {
              items: [
                {
                  id: "couple-1",
                  name: "Tổ Ấm Nhỏ",
                  status: "active",
                  createdAt: "2026-10-01T00:00:00.000Z",
                  memberCount: 2,
                  activeInviteCount: 1,
                  members: [
                    { userId: "u-1", name: "Anh", role: "owner", active: true },
                    { userId: "u-2", name: "Em", role: "member", active: true },
                  ],
                },
              ],
              total: 1,
              page: 1,
              totalPages: 1,
            },
          };
        }
        return { data: {} };
      });

      const { container } = render(<CouplesTab />);

      await waitFor(() => {
        expect(screen.getAllByText("Tổ Ấm Nhỏ")[0]).toBeInTheDocument();
      });

      // Tên thành viên và số lượng mã mời hiển thị
      expect(screen.getAllByText("Anh")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Em")[0]).toBeInTheDocument();
      expect(screen.getAllByText("1")[0]).toBeInTheDocument();

      // Quét DOM: Tuyệt đối không chứa bất kỳ từ khóa nào về nội dung người dùng
      const htmlContent = container.innerHTML.toLowerCase();
      expect(htmlContent).not.toMatch(
        /vnd|giao dịch|ví|nhiệm vụ|cân nặng|số đo/i,
      );
    });
  });

  describe("Quản lý người dùng (UsersTab)", () => {
    it("hiển thị danh sách người dùng và cho phép tìm kiếm", async () => {
      const getSpy = vi
        .spyOn(apiClient, "get")
        .mockImplementation(async (path) => {
          if (path === "/admin/users") {
            return {
              data: {
                items: [
                  {
                    id: "u-1",
                    name: "Nguyễn Văn A",
                    email: "a@example.com",
                    role: "user",
                    status: "active",
                    lockedUntil: null,
                    coupleName: "Tổ Ấm",
                    coupleStatus: "active",
                    createdAt: "2026-10-01T00:00:00Z",
                    lastLoginAt: "2026-10-18T00:00:00Z",
                  },
                ],
                total: 1,
                page: 1,
                totalPages: 1,
              },
            };
          }
          return { data: {} };
        });

      render(<UsersTab />);

      await waitFor(() => {
        expect(screen.getAllByText("Nguyễn Văn A")[0]).toBeInTheDocument();
        expect(screen.getAllByText("a@example.com")[0]).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        "Tìm theo email hoặc tên…",
      );
      const user = userEvent.setup();
      await user.type(searchInput, "a@example.com");

      await waitFor(() => {
        expect(getSpy).toHaveBeenCalledWith(
          "/admin/users",
          expect.objectContaining({
            params: expect.objectContaining({ query: "a@example.com" }),
          }),
        );
      });
    });
  });

  describe("Tổng quan hệ thống (OverviewTab)", () => {
    it("hiển thị đầy đủ các chỉ số siêu dữ liệu và trạng thái cổng đăng ký", async () => {
      vi.spyOn(apiClient, "get").mockImplementation(async (path) => {
        if (path === "/admin/overview") {
          return {
            data: {
              totalUsers: 12,
              activeUsers7d: 8,
              disabledUsers: 1,
              newUsers7d: 3,
              activeCouples: 4,
              archivedCouples: 1,
              registrationOpen: true,
            },
          };
        }
        return { data: {} };
      });

      render(<OverviewTab />);

      await waitFor(() => {
        expect(screen.getByText("Tổng tài khoản")).toBeInTheDocument();
        expect(screen.getByText("12")).toBeInTheDocument();
        expect(screen.getByText("8")).toBeInTheDocument();
        expect(screen.getByText("Đang mở")).toBeInTheDocument();
      });
    });
  });

  describe("Cài đặt hệ thống (SettingsTab)", () => {
    it("hiển thị cấu hình và yêu cầu xác nhận mật khẩu khi bật/tắt cổng đăng ký", async () => {
      const user = userEvent.setup();
      vi.spyOn(apiClient, "get").mockImplementation(async (path) => {
        if (path === "/admin/settings") {
          return {
            data: {
              registrationOpen: true,
              allowNewCouples: true,
              updatedAt: "2026-10-18T00:00:00Z",
              updatedBy: "admin-1",
            },
          };
        }
        return { data: {} };
      });

      const patchSpy = vi.spyOn(apiClient, "patch").mockResolvedValue({
        data: {
          registrationOpen: false,
          allowNewCouples: true,
          updatedAt: "2026-10-19T00:00:00Z",
          updatedBy: "admin-1",
        },
      });

      render(<SettingsTab />);

      await waitFor(() => {
        expect(
          screen.getByText("Cho phép đăng ký tài khoản mới"),
        ).toBeInTheDocument();
      });

      // Bấm nút đóng cổng đăng ký (nút đầu tiên trong 2 nút switch)
      const toggleBtns = screen.getAllByRole("button", {
        name: "Đang mở (Bấm để Đóng)",
      });
      await user.click(toggleBtns[0]);

      // Modal xác nhận xuất hiện
      expect(screen.getByText("Đóng cổng đăng ký mới")).toBeInTheDocument();

      // Nhập mật khẩu admin
      const passInput = screen.getByPlaceholderText(
        "Nhập mật khẩu quản trị viên",
      );
      await user.type(passInput, "SuperSecret");

      const confirmBtn = screen.getByRole("button", {
        name: "Xác nhận thay đổi",
      });
      await user.click(confirmBtn);

      expect(patchSpy).toHaveBeenCalledWith("/admin/settings", {
        registrationOpen: false,
        adminPassword: "SuperSecret",
      });
    });
  });
});
