import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect, vi, afterEach } from "vitest";
import { Modal } from "../components/ui/Modal";
import { moveTabFocus } from "../components/ui/tabs";
import { PwaStatus } from "../features/pwa/PwaStatus";
afterEach(() => vi.restoreAllMocks());
it("dialog keeps input focus across renders and invokes the latest close handler", async () => {
  const first = vi.fn(),
    next = vi.fn();
  const view = render(
    <Modal title="Thử" onClose={first}>
      <input aria-label="Tên" />
      <button>Lưu</button>
    </Modal>,
  );
  const input = screen.getByLabelText("Tên");
  expect(input).toHaveFocus();
  await userEvent.type(input, "Minh");
  view.rerender(
    <Modal title="Thử" onClose={next}>
      <input aria-label="Tên" />
      <button>Lưu</button>
    </Modal>,
  );
  expect(input).toHaveFocus();
  expect(input).toHaveValue("Minh");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(next).toHaveBeenCalledOnce();
  expect(first).not.toHaveBeenCalled();
});
it("dialog wraps Tab and Shift+Tab and Escape cannot close while saving", async () => {
  const close = vi.fn();
  render(
    <Modal title="Thử" onClose={close} busy>
      <input aria-label="Tên" />
      <button>Lưu</button>
    </Modal>,
  );
  const input = screen.getByLabelText("Tên"),
    last = screen.getByRole("button", { name: "Lưu" });
  last.focus();
  await userEvent.tab();
  expect(input).toHaveFocus();
  await userEvent.tab({ shift: true });
  expect(last).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(close).not.toHaveBeenCalled();
});
it("dialog inerts app content, restores scroll and returns focus after unmount", () => {
  const root = document.createElement("div");
  root.id = "root";
  document.body.append(root);
  const trigger = document.createElement("button");
  trigger.textContent = "Mở";
  root.append(trigger);
  trigger.focus();
  const view = render(
    <Modal title="Thử" onClose={() => {}}>
      <button>Lưu</button>
    </Modal>,
  );
  expect(root).toHaveAttribute("inert");
  expect(document.body.style.overflow).toBe("hidden");
  expect(screen.getByRole("dialog")).toHaveAccessibleName("Thử");
  view.unmount();
  expect(root).not.toHaveAttribute("inert");
  expect(document.body.style.overflow).not.toBe("hidden");
  expect(trigger).toHaveFocus();
  root.remove();
});
it("empty busy dialog keeps keyboard focus inside its panel", () => {
  render(
    <Modal title="Đang lưu" busy onClose={() => {}}>
      Đang xử lý
    </Modal>,
  );
  fireEvent.keyDown(document, { key: "Tab" });
  expect(screen.getByRole("dialog")).toHaveFocus();
});
it("tablist supports arrows, Home and End without moving focus on unrelated keys", () => {
  const clicked = vi.fn();
  render(
    <div role="tablist" onKeyDown={moveTabFocus}>
      <button role="tab" onClick={() => clicked(0)}>
        A
      </button>
      <button role="tab" onClick={() => clicked(1)}>
        B
      </button>
      <button role="tab" disabled>
        C
      </button>
    </div>,
  );
  const [a, b] = screen.getAllByRole("tab");
  a.focus();
  fireEvent.keyDown(a, { key: "ArrowRight" });
  expect(b).toHaveFocus();
  expect(clicked).toHaveBeenLastCalledWith(1);
  fireEvent.keyDown(b, { key: "ArrowRight" });
  expect(a).toHaveFocus();
  fireEvent.keyDown(a, { key: "End" });
  expect(b).toHaveFocus();
  fireEvent.keyDown(b, { key: "Home" });
  expect(a).toHaveFocus();
  fireEvent.keyDown(a, { key: "Enter" });
  expect(a).toHaveFocus();
});
it("offline status clearly says writes require connection and clears after reconnect", () => {
  const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  render(<PwaStatus />);
  expect(screen.getByRole("status")).toHaveTextContent(
    "Cần kết nối để tải và lưu dữ liệu",
  );
  onLine.mockReturnValue(true);
  act(() => window.dispatchEvent(new Event("online")));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
it("install prompt is shown only on supported browsers and invoked only on click", async () => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  render(<PwaStatus />);
  expect(
    screen.queryByRole("button", { name: "Cài ứng dụng" }),
  ).not.toBeInTheDocument();
  const prompt = vi.fn().mockResolvedValue(undefined),
    e = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });
  act(() => window.dispatchEvent(e));
  expect(e.defaultPrevented).toBe(true);
  expect(prompt).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Cài ứng dụng" }));
  expect(prompt).toHaveBeenCalledOnce();
  expect(
    screen.queryByRole("button", { name: "Cài ứng dụng" }),
  ).not.toBeInTheDocument();
});
it("appinstalled hides install control", () => {
  render(<PwaStatus />);
  act(() =>
    window.dispatchEvent(
      Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: "accepted" }),
      }),
    ),
  );
  expect(
    screen.getByRole("button", { name: "Cài ứng dụng" }),
  ).toBeInTheDocument();
  act(() => window.dispatchEvent(new Event("appinstalled")));
  expect(
    screen.queryByRole("button", { name: "Cài ứng dụng" }),
  ).not.toBeInTheDocument();
});
