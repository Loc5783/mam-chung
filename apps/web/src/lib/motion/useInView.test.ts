import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInView } from "./useInView";

describe("useInView", () => {
  let originalObserver: typeof IntersectionObserver;

  beforeEach(() => {
    originalObserver = window.IntersectionObserver;
  });

  afterEach(() => {
    window.IntersectionObserver = originalObserver;
    vi.restoreAllMocks();
  });

  it("falls back to true when IntersectionObserver is not defined", () => {
    // @ts-expect-error simulating missing API
    delete window.IntersectionObserver;

    const div = document.createElement("div");
    const ref = { current: div };

    const { result } = renderHook(() => useInView(ref));
    expect(result.current).toBe(true);
  });

  it("observes element and triggers once when element enters viewport", () => {
    let callback: (entries: IntersectionObserverEntry[]) => void = () => {};
    const observeMock = vi.fn();
    const disconnectMock = vi.fn();

    // Mock IntersectionObserver
    window.IntersectionObserver = vi.fn().mockImplementation((cb) => {
      callback = cb;
      return {
        observe: observeMock,
        disconnect: disconnectMock,
        unobserve: vi.fn(),
      };
    });

    const div = document.createElement("div");
    const ref = { current: div };

    const { result } = renderHook(() => useInView(ref, { threshold: 0.35, once: true }));
    expect(observeMock).toHaveBeenCalledWith(div);
    expect(result.current).toBe(false);

    // Simulate entry
    act(() => {
      callback([
        {
          isIntersecting: true,
          target: div,
          intersectionRatio: 0.5,
        } as unknown as IntersectionObserverEntry,
      ]);
    });

    expect(result.current).toBe(true);
    expect(disconnectMock).toHaveBeenCalled();
  });
});

