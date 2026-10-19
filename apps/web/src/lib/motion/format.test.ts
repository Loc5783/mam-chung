import { describe, it, expect } from "vitest";
import { formatVND, formatPercent } from "./format";

describe("motion formatting", () => {
  it("formats VND properly with đ suffix", () => {
    // vi-VN format uses dots or non-breaking spaces
    const formatted = formatVND(1250000);
    expect(formatted).toContain("1.250.000");
    expect(formatted).toContain("đ");
  });

  it("formats percent with requested decimals", () => {
    expect(formatPercent(45)).toBe("45%");
    // In vi-VN, decimal separator is comma ','
    expect(formatPercent(12.5, 1)).toBe("12,5%");
  });
});
