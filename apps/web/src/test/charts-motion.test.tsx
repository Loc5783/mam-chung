import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import {
  AnimatedDonut,
  AnimatedLine,
  AnimatedBar,
  ProgressRing,
  ProgressBar,
  ChartLegend,
  ChartTooltip,
} from "../components/charts";

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver =
    ResizeObserverMock as unknown as typeof ResizeObserver;
});

describe("Charts Motion Components", () => {
  describe("ProgressRing", () => {
    it("renders with correct accessibility attributes and clamped value", () => {
      render(<ProgressRing value={75} label="Mục tiêu tuần" />);
      const ring = screen.getByRole("progressbar");
      expect(ring).toBeInTheDocument();
      expect(ring).toHaveAttribute("aria-valuenow", "75");
      expect(screen.getByText("75%")).toBeInTheDocument();
      expect(screen.getByText("Mục tiêu tuần")).toBeInTheDocument();
    });

    it("clamps value between 0 and 100", () => {
      const { rerender } = render(<ProgressRing value={140} />);
      let ring = screen.getByRole("progressbar");
      expect(ring).toHaveAttribute("aria-valuenow", "100");

      rerender(<ProgressRing value={-20} />);
      ring = screen.getByRole("progressbar");
      expect(ring).toHaveAttribute("aria-valuenow", "0");
    });
  });

  describe("ProgressBar", () => {
    it("renders with transform scaleX instead of width animation", () => {
      const { container } = render(
        <ProgressBar value={60} label="Ngân sách ăn uống" showText />,
      );
      const bar = screen.getByRole("progressbar");
      expect(bar).toBeInTheDocument();
      expect(bar).toHaveAttribute("aria-valuenow", "60");
      expect(screen.getByText("Ngân sách ăn uống")).toBeInTheDocument();
      expect(screen.getByText("60%")).toBeInTheDocument();

      const fill = container.querySelector(".progress-bar-fill") as HTMLElement;
      expect(fill).toBeInTheDocument();
      expect(fill.style.transform).toBe("scaleX(0.6)");
    });
  });

  describe("ChartLegend", () => {
    const items = [
      { id: "1", name: "Ăn uống", amount: 3000000, color: "#7E9B57" },
      { id: "2", name: "Đi lại", amount: 1000000, color: "#E38FA9" },
    ];

    it("renders legend rows and triggers onHover callbacks", () => {
      const onHover = vi.fn();
      render(
        <ChartLegend
          items={items}
          total={4000000}
          activeId={null}
          onHover={onHover}
        />,
      );

      expect(screen.getByText("Ăn uống")).toBeInTheDocument();
      expect(screen.getByText("75%")).toBeInTheDocument();
      expect(screen.getByText("Đi lại")).toBeInTheDocument();
      expect(screen.getByText("25%")).toBeInTheDocument();

      const rows = screen.getAllByText(/Ăn uống|Đi lại/);
      const rowContainer = rows[0].closest(".chart-legend-row");
      expect(rowContainer).toBeInTheDocument();

      fireEvent.mouseEnter(rowContainer!);
      expect(onHover).toHaveBeenCalledWith("1");

      fireEvent.mouseLeave(rowContainer!);
      expect(onHover).toHaveBeenCalledWith(null);
    });
  });

  describe("ChartTooltip", () => {
    it("renders formatted tooltip entries", () => {
      render(
        <ChartTooltip
          active={true}
          label="Tháng 10/2026"
          payload={[
            { name: "Thu nhập", value: 15000000, color: "#7E9B57" },
            { name: "Chi tiêu", value: 8000000, color: "#E38FA9" },
          ]}
        />,
      );

      expect(screen.getByText("Tháng 10/2026")).toBeInTheDocument();
      expect(screen.getByText(/Thu nhập/)).toBeInTheDocument();
      expect(screen.getByText("15.000.000 đ")).toBeInTheDocument();
      expect(screen.getByText(/Chi tiêu/)).toBeInTheDocument();
      expect(screen.getByText("8.000.000 đ")).toBeInTheDocument();
    });

    it("renders nothing when inactive or payload is empty", () => {
      const { container } = render(
        <ChartTooltip active={false} payload={[]} />,
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe("AnimatedDonut", () => {
    it("renders center value and accessible container", () => {
      render(
        <AnimatedDonut
          data={[
            { categoryId: "c1", name: "Ăn uống", amount: 500000 },
            { categoryId: "c2", name: "Di chuyển", amount: 200000 },
          ]}
          centerLabel="Tổng chi"
          centerValue={700000}
          ariaLabel="Biểu đồ chi tiêu tháng này"
        />,
      );

      expect(
        screen.getByRole("img", { name: "Biểu đồ chi tiêu tháng này" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Tổng chi")).toBeInTheDocument();
    });
  });

  describe("AnimatedLine & AnimatedBar", () => {
    it("renders AnimatedLine wrapper with aria-label", () => {
      render(
        <AnimatedLine
          data={[{ date: "01/10", val: 50 }]}
          lines={[{ key: "val", name: "Điểm", color: "#7E9B57" }]}
          ariaLabel="Biểu đồ tập luyện"
        />,
      );
      expect(
        screen.getByRole("img", { name: "Biểu đồ tập luyện" }),
      ).toBeInTheDocument();
    });

    it("renders AnimatedBar wrapper with aria-label", () => {
      render(
        <AnimatedBar
          data={[{ month: "2026-10", income: 1000, expense: 500 }]}
          bars={[
            { key: "income", name: "Thu", color: "#7E9B57" },
            { key: "expense", name: "Chi", color: "#E38FA9" },
          ]}
          ariaLabel="Biểu đồ thu chi"
        />,
      );
      expect(
        screen.getByRole("img", { name: "Biểu đồ thu chi" }),
      ).toBeInTheDocument();
    });
  });
});
