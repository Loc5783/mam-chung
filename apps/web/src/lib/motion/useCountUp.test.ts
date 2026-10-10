import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCountUp } from "./useCountUp";
import { setMotionPreference } from "./usePrefersReducedMotion";

describe("useCountUp", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-motion");
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns final target immediately when reduced motion is preferred", () => {
    setMotionPreference("reduced");

    const { result } = renderHook(() =>
      useCountUp(1000, {
        duration: 500,
        format: (n) => `${n} đ`,
      }),
    );

    expect(result.current).toBe("1000 đ");
  });

  it("smoothly animates from start to target", () => {
    let frameId = 0;
    const callbacks: Array<{ id: number; cb: FrameRequestCallback }> = [];

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      frameId++;
      callbacks.push({ id: frameId, cb });
      return frameId;
    });

    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      const idx = callbacks.findIndex((c) => c.id === id);
      if (idx !== -1) callbacks.splice(idx, 1);
    });

    const { result } = renderHook(() =>
      useCountUp(100, {
        duration: 1000,
        start: 0,
        format: (n) => String(Math.round(n)),
      }),
    );

    // Initial render at start value 0
    expect(result.current).toBe("0");

    // Advance halfway
    act(() => {
      const item = callbacks.shift();
      item?.cb(0);
    });

    act(() => {
      const item = callbacks.shift();
      item?.cb(500); // 50% elapsed
    });

    // Should have incremented
    const midVal = Number(result.current);
    expect(midVal).toBeGreaterThan(0);
    expect(midVal).toBeLessThan(100);

    // Complete animation
    act(() => {
      const item = callbacks.shift();
      item?.cb(1000);
    });

    expect(result.current).toBe("100");
  });

  it("cleans up animation frame on unmount", () => {
    const cancelMock = vi.spyOn(window, "cancelAnimationFrame");

    const { unmount } = renderHook(() =>
      useCountUp(500, { duration: 1000 }),
    );

    unmount();
    expect(cancelMock).toHaveBeenCalled();
  });
});

