import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  usePrefersReducedMotion,
  getMotionPreference,
  setMotionPreference,
  checkIsReducedMotion,
} from "./usePrefersReducedMotion";

describe("usePrefersReducedMotion", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-motion");
    vi.restoreAllMocks();
  });

  it("defaults to system preference when no local storage is present", () => {
    expect(getMotionPreference()).toBe("system");
  });

  it("sets and persists explicit reduced motion preference", () => {
    setMotionPreference("reduced");
    expect(getMotionPreference()).toBe("reduced");
    expect(document.documentElement.getAttribute("data-motion")).toBe(
      "reduced",
    );
    expect(checkIsReducedMotion()).toBe(true);
  });

  it("forces full motion when preference is 'full', overriding system", () => {
    // Mock system matchMedia as true (prefers-reduced-motion)
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes("prefers-reduced-motion: reduce"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    setMotionPreference("full");
    expect(document.documentElement.getAttribute("data-motion")).toBe("full");
    expect(checkIsReducedMotion()).toBe(false);
  });

  it("updates reactively when preference changes", () => {
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      setMotionPreference("reduced");
    });
    expect(result.current).toBe(true);

    act(() => {
      setMotionPreference("full");
    });
    expect(result.current).toBe(false);
  });
});
