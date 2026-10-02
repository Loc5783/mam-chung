import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "../app/App";
describe("Giao diện nền tảng", () => {
  it("hiển thị tổng quan và ghi rõ dữ liệu minh họa", () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Các số liệu bên dưới/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Chi tiêu của bạn" }),
    ).toBeInTheDocument();
  });
  it("chuyển đến trang công việc từ điều hướng", async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    await userEvent.click(
      screen.getAllByRole("link", { name: "Công việc" })[0],
    );
    expect(
      screen.getByRole("heading", { name: "Công việc đang chờ được vun đắp" }),
    ).toBeInTheDocument();
  });
  it("hiển thị lỗi dưới các trường đăng ký", async () => {
    render(
      <MemoryRouter initialEntries={["/register"]}>
        <App />
      </MemoryRouter>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Tạo tài khoản mẫu" }),
    );
    expect(
      await screen.findByText("Tên cần ít nhất 2 ký tự."),
    ).toBeInTheDocument();
    expect(screen.getByText("Vui lòng nhập email hợp lệ.")).toBeInTheDocument();
  });
});
