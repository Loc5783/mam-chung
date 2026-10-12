import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QuickAddBar } from "../features/tasks/components/QuickAddBar";
import { TaskForm } from "../features/tasks/TaskForm";
import { TaskDetailDrawer } from "../features/tasks/components/TaskDetailDrawer";
import { BulkActionBar } from "../features/tasks/components/BulkActionBar";
import { useAuthStore } from "../features/auth/store";
import { apiClient } from "../lib/apiClient";
import type { Task, Members } from "../features/tasks/types";

const mockUser = {
  id: "user-1",
  name: "Minh",
  email: "minh@test.com",
  avatar: null,
  timezone: "Asia/Ho_Chi_Minh",
  coupleId: "couple-1",
  createdAt: "2026-10-01T00:00:00Z",
};

const mockMembers: Members = {
  items: [
    { id: "user-1", name: "Minh" },
    { id: "user-2", name: "Lan" },
  ],
  readOnly: false,
};

const mockTask: Task = {
  id: "task-100",
  title: "Soạn tài liệu cuộc họp",
  description: "Chuẩn bị slide và báo cáo chi tiêu",
  deadline: "2026-10-15",
  startDate: "2026-10-10",
  deadlineHasTime: false,
  deadlineTime: null,
  deadlineTimezone: null,
  estimateMinutes: 45,
  priority: "HIGH",
  status: "TODO",
  assignedTo: "user-1",
  createdBy: "user-1",
  creatorName: "Minh",
  coupleId: "couple-1",
  kind: "task",
  labels: ["công-việc", "họp"],
  checklist: [{ id: "sub-1", text: "In tài liệu", done: false }],
  recurrence: "none",
  completedAt: null,
  sourceTaskId: null,
  revision: 2,
  createdAt: "2026-10-01T00:00:00Z",
  readOnly: false,
};

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
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

describe("Phase B2: Vá các lỗi người dùng có thể mắc (Frontend Error Hardening)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().setSession("test-token", mockUser);
  });

  describe("(1) QuickAddBar: Dán nhiều dòng, giới hạn 50 việc, và cắt việc an toàn", () => {
    it("hiển thị cảnh báo khi dán >50 dòng và cho phép bấm nút 'Chỉ giữ 50 việc đầu tiên'", async () => {
      renderWithProviders(
        <QuickAddBar
          context={{
            user: mockUser,
            timezone: "Asia/Ho_Chi_Minh",
            members: mockMembers.items,
            lists: [],
            scope: "personal",
          }}
          disabled={false}
        />,
      );

      const textarea = screen.getByLabelText("Thêm nhanh công việc");
      const lines55 = Array.from({ length: 55 }, (_, i) => `Công việc số ${i + 1}`).join("\r\n");
      fireEvent.change(textarea, { target: { value: lines55 } });

      expect(await screen.findByText("Tối đa 50 việc mỗi lần.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Thêm" })).toBeDisabled();

      // Bấm nút "Chỉ giữ 50 việc đầu tiên"
      const trimButton = screen.getByRole("button", { name: "Chỉ giữ 50 việc đầu tiên" });
      fireEvent.click(trimButton);

      // Sau khi bấm, cảnh báo >50 biến mất và nút Thêm mở lại
      await waitFor(() => {
        expect(screen.queryByText("Tối đa 50 việc mỗi lần.")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Thêm" })).not.toBeDisabled();
        expect(screen.getByText("50 việc · kiểm tra trước khi thêm.")).toBeInTheDocument();
      });
    });

    it("bỏ qua dòng trống, khoảng trắng thừa, và nhận diện đúng các nhãn/ưu tiên trên từng dòng", async () => {
      const postSpy = vi.spyOn(apiClient, "post").mockResolvedValue({ data: {} });

      renderWithProviders(
        <QuickAddBar
          context={{
            user: mockUser,
            timezone: "Asia/Ho_Chi_Minh",
            members: mockMembers.items,
            lists: [],
            scope: "personal",
          }}
          disabled={false}
        />,
      );

      const textarea = screen.getByLabelText("Thêm nhanh công việc");
      // Gồm dòng trống, khoảng trắng, Windows \r\n, nhãn # và ưu tiên !
      const rawText = "   \r\nĐi chợ mua cá #bếp !cao\r\n\r\n   \r\nQuét dọn phòng khách #nhà\r\n   ";
      fireEvent.change(textarea, { target: { value: rawText } });

      expect(screen.getByText("2 việc · kiểm tra trước khi thêm.")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Thêm" }));

      expect(await screen.findByRole("heading", { name: "Tạo 2 việc?" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Xác nhận thêm" }));

      await waitFor(() => {
        expect(postSpy).toHaveBeenCalledWith(
          "/tasks/quick-add",
          expect.objectContaining({
            items: expect.arrayContaining([
              expect.objectContaining({ title: "Đi chợ mua cá", priority: "HIGH" }),
              expect.objectContaining({ title: "Quét dọn phòng khách" }),
            ]),
          }),
        );
      });
    });
  });

  describe("(2) TaskForm: Xử lý nhãn, hạn chót quá khứ, phím Enter trong checklist và giữ nháp khi lỗi", () => {
    it("tự động gỡ dấu # ở đầu nhãn và loại bỏ nhãn trùng lặp khi lưu", async () => {
      const postSpy = vi.spyOn(apiClient, "post").mockResolvedValue({ data: { id: "new-task" } });
      const onClose = vi.fn();

      renderWithProviders(
        <TaskForm members={mockMembers} onClose={onClose} />,
      );

      await userEvent.type(screen.getByLabelText("Tiêu đề"), "Mua nguyên liệu");
      // Người dùng nhập lẫn lộn dấu # và nhãn trùng
      await userEvent.type(screen.getByLabelText("Nhãn"), "#chợ, chợ, #nấu-ăn, ##chợ");
      await userEvent.click(screen.getByRole("button", { name: "Lưu" }));

      await waitFor(() => {
        expect(postSpy).toHaveBeenCalledWith(
          "/tasks",
          expect.objectContaining({
            labels: ["chợ", "nấu-ăn"],
          }),
        );
      });
      expect(onClose).toHaveBeenCalled();
    });

    it("chặn gửi và báo lỗi rõ ràng nếu nhập quá 10 nhãn", async () => {
      const postSpy = vi.spyOn(apiClient, "post").mockResolvedValue({ data: {} });
      renderWithProviders(
        <TaskForm members={mockMembers} onClose={vi.fn()} />,
      );

      await userEvent.type(screen.getByLabelText("Tiêu đề"), "Việc nhiều nhãn");
      // 11 nhãn
      await userEvent.type(screen.getByLabelText("Nhãn"), "n1, n2, n3, n4, n5, n6, n7, n8, n9, n10, n11");
      await userEvent.click(screen.getByRole("button", { name: "Lưu" }));

      expect(await screen.findByText("Tối đa 10 nhãn.")).toBeInTheDocument();
      expect(postSpy).not.toHaveBeenCalled();
    });

    it("bấm Enter trong ô 'Nội dung việc con' sẽ thêm mục checklist thay vì submit toàn bộ form", async () => {
      const postSpy = vi.spyOn(apiClient, "post").mockResolvedValue({ data: {} });
      renderWithProviders(
        <TaskForm members={mockMembers} onClose={vi.fn()} />,
      );

      const checklistInput = screen.getByLabelText("Nội dung việc con");
      await userEvent.type(checklistInput, "Rửa rau{enter}");

      // Mục việc con đã được thêm vào checklist
      expect(await screen.findByText("Rửa rau")).toBeInTheDocument();
      // Input đã được reset sạch
      expect(checklistInput).toHaveValue("");
      // Form chưa bị submit sớm
      expect(postSpy).not.toHaveBeenCalled();
    });

    it("hiển thị lưu ý nhẹ khi hạn chót ở quá khứ", async () => {
      renderWithProviders(
        <TaskForm members={mockMembers} onClose={vi.fn()} />,
      );

      const deadlineInput = screen.getByLabelText("Hạn chót");
      fireEvent.change(deadlineInput, { target: { value: "2020-01-01" } });

      expect(
        await screen.findByText("Lưu ý: Hạn chót đã qua so với hôm nay."),
      ).toBeInTheDocument();
    });

    it("giữ nguyên nháp và không đóng form khi backend trả về HTTP 500", async () => {
      vi.spyOn(apiClient, "post").mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 500,
          data: { error: { code: "SERVER_ERROR", message: "Máy chủ bận" } },
        },
      });
      const onClose = vi.fn();

      renderWithProviders(
        <TaskForm members={mockMembers} onClose={onClose} />,
      );

      await userEvent.type(screen.getByLabelText("Tiêu đề"), "Việc quan trọng cần giữ");
      await userEvent.type(screen.getByLabelText("Mô tả"), "Chi tiết không được mất");
      await userEvent.click(screen.getByRole("button", { name: "Lưu" }));

      // Form hiện thông báo lỗi
      expect(await screen.findByRole("alert")).toBeInTheDocument();
      // Modal không bị đóng
      expect(onClose).not.toHaveBeenCalled();
      // Dữ liệu người dùng gõ vẫn giữ nguyên
      expect(screen.getByLabelText("Tiêu đề")).toHaveValue("Việc quan trọng cần giữ");
      expect(screen.getByLabelText("Mô tả")).toHaveValue("Chi tiết không được mất");
    });
  });

  describe("(3) TaskDetailDrawer: Xử lý xung đột 409, ngày bắt đầu sau hạn chót, và chống vô tình đóng", () => {
    it("giữ nguyên nội dung và thông báo khi gặp xung đột sửa đổi (409 revision)", async () => {
      vi.spyOn(apiClient, "put").mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 409,
          data: { error: { code: "CONFLICT", message: "Công việc đã được người khác cập nhật." } },
        },
      });
      const onClose = vi.fn();

      renderWithProviders(
        <TaskDetailDrawer
          task={mockTask}
          members={mockMembers}
          lists={[]}
          onClose={onClose}
          onStatus={vi.fn()}
          onComments={vi.fn()}
        />,
      );

      const titleInput = screen.getByLabelText("Tiêu đề công việc");
      fireEvent.change(titleInput, { target: { value: "Tiêu đề mới vừa sửa" } });

      const saveNowButton = await screen.findByRole("button", { name: "Lưu ngay" });
      fireEvent.click(saveNowButton);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Nội dung đang nhập được giữ");
      });
      // Drawer không bị đóng
      expect(onClose).not.toHaveBeenCalled();
      // Nội dung người dùng gõ vẫn còn nguyên
      expect(screen.getByLabelText("Tiêu đề công việc")).toHaveValue("Tiêu đề mới vừa sửa");
    });

    it("chặn lưu và báo lỗi khi ngày bắt đầu sau hạn chót", async () => {
      renderWithProviders(
        <TaskDetailDrawer
          task={mockTask}
          members={mockMembers}
          lists={[]}
          onClose={vi.fn()}
          onStatus={vi.fn()}
          onComments={vi.fn()}
        />,
      );

      const startInput = screen.getByLabelText("Ngày bắt đầu");
      const deadlineInput = screen.getByLabelText("Hạn chót công việc");

      fireEvent.change(startInput, { target: { value: "2026-10-20" } });
      fireEvent.change(deadlineInput, { target: { value: "2026-10-10" } });

      expect(
        await screen.findByText("Ngày bắt đầu phải trước hoặc bằng hạn chót."),
      ).toBeInTheDocument();
      // Nút "Lưu ngay" bị vô hiệu hóa khi form không hợp lệ
      expect(screen.getByRole("button", { name: "Lưu ngay" })).toBeDisabled();
    });
  });

  describe("(4) BulkActionBar: Gắn nhãn hàng loạt và giới hạn nhãn", () => {
    it("tự động gỡ dấu # và giới hạn tối đa 10 nhãn khi gắn nhãn hàng loạt", async () => {
      const patchSpy = vi.spyOn(apiClient, "patch").mockResolvedValue({
        data: { items: [mockTask] },
      });
      const onClear = vi.fn();
      const onUndo = vi.fn();

      renderWithProviders(
        <BulkActionBar
          tasks={[mockTask]}
          lists={[]}
          members={mockMembers}
          disabled={false}
          onClear={onClear}
          onUndo={onUndo}
        />,
      );

      const labelsInput = screen.getByPlaceholderText("nhà, cuối-tuần");
      fireEvent.change(labelsInput, { target: { value: "#nhà, #chợ, #cuối-tuần" } });

      const tagButton = screen.getByRole("button", { name: "Gắn nhãn" });
      fireEvent.click(tagButton);

      await waitFor(() => {
        expect(patchSpy).toHaveBeenCalledWith(
          "/tasks/bulk",
          expect.objectContaining({
            action: "update",
            changes: {
              addLabels: ["nhà", "chợ", "cuối-tuần"],
            },
          }),
        );
      });
      expect(onClear).toHaveBeenCalled();
    });

    it("không bỏ chọn các công việc nếu thao tác hàng loạt bị lỗi", async () => {
      vi.spyOn(apiClient, "patch").mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 500,
          data: { error: { message: "Không thể cập nhật hàng loạt." } },
        },
      });
      const onClear = vi.fn();

      renderWithProviders(
        <BulkActionBar
          tasks={[mockTask]}
          lists={[]}
          members={mockMembers}
          disabled={false}
          onClear={onClear}
          onUndo={vi.fn()}
        />,
      );

      const completeButton = screen.getByRole("button", { name: "Hoàn thành đã chọn" });
      fireEvent.click(completeButton);

      expect(await screen.findByRole("alert")).toHaveTextContent("Không thể cập nhật hàng loạt.");
      // onClear KHÔNG được gọi khi mutation lỗi -> bảo toàn danh sách việc đang chọn
      expect(onClear).not.toHaveBeenCalled();
    });
  });
});
