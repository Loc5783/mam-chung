import { useMemo } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export interface StaggerOptions {
  step?: number; // Delay increment in ms (default: 45)
  max?: number;  // Maximum items to stagger (default: 12)
}

/**
 * Calculates animation delay in milliseconds for a given index.
 * Only staggers up to `max` items (default 12), remaining items appear immediately.
 */
export function getStaggerDelay(
  index: number,
  { step = 45, max = 12 }: StaggerOptions = {},
): number {
  if (index < 0 || index >= max) return 0;
  return index * step;
}

/**
 * Hook to provide staggered animation delay CSS property for list items.
 * Returns 0ms if reduced motion is requested or index >= max.
 */
export function useStagger(
  index: number,
  options: StaggerOptions = {},
): { animationDelay: string; style: { animationDelay: string } } {
  const reduced = usePrefersReducedMotion();

  return useMemo(() => {
    if (reduced) {
      return { animationDelay: "0ms", style: { animationDelay: "0ms" } };
    }
    const delayMs = getStaggerDelay(index, options);
    const delayStr = `${delayMs}ms`;
    return {
      animationDelay: delayStr,
      style: { animationDelay: delayStr },
    };
  }, [index, options.step, options.max, reduced]);
}

