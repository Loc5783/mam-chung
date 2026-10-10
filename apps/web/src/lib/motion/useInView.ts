import { useEffect, useState, type RefObject } from "react";

export interface UseInViewOptions {
  threshold?: number | number[];
  once?: boolean;
  rootMargin?: string;
}

/**
 * Hook to detect whether an element is visible in the viewport.
 * Defaults to triggering only once when at least 35% visible.
 * Falls back to true if IntersectionObserver is not supported.
 */
export function useInView(
  ref: RefObject<Element | null>,
  { threshold = 0.35, once = true, rootMargin = "0px" }: UseInViewOptions = {},
): boolean {
  const [inView, setInView] = useState<boolean>(() => {
    // If IntersectionObserver is not available, default to visible
    return typeof IntersectionObserver === "undefined";
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    let isDisposed = false;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isDisposed) return;
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setInView(true);
          if (once) {
            observer.disconnect();
          }
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(element);

    return () => {
      isDisposed = true;
      observer.disconnect();
    };
  }, [ref, threshold, once, rootMargin]);

  return inView;
}

