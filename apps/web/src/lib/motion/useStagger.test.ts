import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useStagger, getStaggerDelay } from "./useStagger";
import { setMotionPreference } from "./usePrefersReducedMotion";

describe("useStagger", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-motion");
  });

  it("calculates correct delay up to max elements", () => {
    expect(getStaggerDelay(0)).toBe(0);
    expect(getStaggerDelay(1)).toBe(45);
    expect(getStaggerDelay(5)).toBe(225);
    expect(getStaggerDelay(11)).toBe(495);

    // Items >= max (12) return 0 to avoid waiting indefinitely
    expect(getStaggerDelay(12)).toBe(0);
    expect(getStaggerDelay(20)).toBe(0);
    expect(getStaggerDelay(-1)).toBe(0);
  });

  it("returns delay string from hook", () => {
    const { result } = renderHook(() => useStagger(2, { step: 50 }));
    expect(result.current.animationDelay).toBe("100ms");
    expect(result.current.style.animationDelay).toBe("100ms");
  });

  it("returns 0ms when reduced motion is active", () => {
    setMotionPreference("reduced");
    const { result } = renderHook(() => useStagger(3));
    expect(result.current.animationDelay).toBe("0ms");
  });
});
