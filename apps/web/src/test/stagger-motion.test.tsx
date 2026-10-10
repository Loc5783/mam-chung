import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CountUp, getStaggerDelay } from "../lib/motion";

describe("Phase E: Stagger & CountUp & Route Transitions", () => {
  describe("CountUp Component", () => {
    it("renders with tabular-nums class and formatted value", () => {
      render(
        <CountUp
          value={1500000}
          duration={0}
          format={(n) => `${n.toLocaleString("vi-VN")} đ`}
          className="stat-number"
        />
      );

      const el = screen.getByText(/1\.500\.000 đ/);
      expect(el).toBeInTheDocument();
      expect(el).toHaveClass("tabular-nums");
      expect(el).toHaveClass("stat-number");
    });
  });

  describe("getStaggerDelay utility", () => {
    it("calculates incrementing delay up to 12 items", () => {
      expect(getStaggerDelay(0, { step: 45, max: 12 })).toBe(0);
      expect(getStaggerDelay(1, { step: 45, max: 12 })).toBe(45);
      expect(getStaggerDelay(2, { step: 45, max: 12 })).toBe(90);
      expect(getStaggerDelay(11, { step: 45, max: 12 })).toBe(495);
    });

    it("returns 0ms delay for items from index 12 onwards to avoid waiting", () => {
      expect(getStaggerDelay(12, { step: 45, max: 12 })).toBe(0);
      expect(getStaggerDelay(13, { step: 45, max: 12 })).toBe(0);
      expect(getStaggerDelay(99, { step: 45, max: 12 })).toBe(0);
    });
  });
});
