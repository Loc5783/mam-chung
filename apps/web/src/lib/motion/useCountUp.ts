import { useEffect, useRef, useState } from "react";
import { DUR } from "./tokens";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export interface UseCountUpOptions {
  duration?: number;
  format?: (value: number) => string;
  start?: number;
  enabled?: boolean;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Tweens a number smoothly from current value to target using requestAnimationFrame.
 * If reduced motion is requested, returns the target immediately.
 */
export function useCountUp(
  target: number,
  options: UseCountUpOptions = {},
): string {
  const {
    duration = DUR.count,
    format = (n) => String(Math.round(n)),
    start = 0,
    enabled = true,
  } = options;

  const reduced = usePrefersReducedMotion();

  // If reduced motion is active or disabled, return target immediately
  const [currentValue, setCurrentValue] = useState<number>(() => {
    return reduced || !enabled ? target : start;
  });

  const valueRef = useRef<number>(currentValue);
  valueRef.current = currentValue;

  const targetRef = useRef<number>(target);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    targetRef.current = target;

    if (reduced || !enabled) {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      setCurrentValue(target);
      return;
    }

    const startVal = valueRef.current;
    const diff = target - startVal;

    // If already at target or duration is 0, set directly
    if (diff === 0 || duration <= 0) {
      setCurrentValue(target);
      return;
    }

    let startTime: number | null = null;

    const step = (timestamp: number) => {
      if (startTime === null) {
        startTime = timestamp;
      }

      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(progress);
      const nextVal = Math.round(startVal + diff * eased);

      setCurrentValue(nextVal);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        setCurrentValue(target);
        animFrameRef.current = null;
      }
    };

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [target, duration, reduced, enabled]);

  return format(Math.round(currentValue));
}
