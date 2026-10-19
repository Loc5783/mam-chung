import { type HTMLAttributes } from "react";
import { useCountUp } from "./useCountUp";

export interface CountUpProps extends Omit<
  HTMLAttributes<HTMLSpanElement>,
  "children"
> {
  value: number;
  duration?: number;
  format?: (value: number) => string;
  start?: number;
  enabled?: boolean;
}

/**
 * Renders an animated numeric counter tweening smoothly to target value.
 * Uses tabular numbers to guarantee zero layout shift during transitions.
 */
export function CountUp({
  value,
  duration,
  format,
  start,
  enabled,
  className = "",
  ...props
}: CountUpProps) {
  const display = useCountUp(value, { duration, format, start, enabled });

  return (
    <span className={`tabular-nums ${className}`.trim()} {...props}>
      {display}
    </span>
  );
}
