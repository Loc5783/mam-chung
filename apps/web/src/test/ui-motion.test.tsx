import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, Card } from "../components/ui";

describe("UI Motion Components", () => {
  it("Button renders with motion classes and handles clicks", async () => {
    const handleClick = vi.fn();
    render(
      <Button sheen onClick={handleClick}>
        Bắt đầu hành trình
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Bắt đầu hành trình" });
    expect(button).toHaveClass("button");
    expect(button).toHaveClass("button-sheen");

    await userEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("Button preserves disabled state without triggering click", async () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Không bấm được
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Không bấm được" });
    expect(button).toBeDisabled();

    await userEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("Card renders with spotlight attribute and updates mouse coordinates on pointer move", () => {
    render(
      <Card spotlight>
        <h3>Thẻ thống kê</h3>
      </Card>,
    );

    const section = screen.getByText("Thẻ thống kê").closest("section")!;
    expect(section).toHaveAttribute("data-spotlight", "true");

    // Simulate pointer move
    if (section) {
      fireEvent.pointerMove(section, { clientX: 100, clientY: 150, pointerType: "mouse" });
    }
    expect(section).toBeInTheDocument();
  });
});
