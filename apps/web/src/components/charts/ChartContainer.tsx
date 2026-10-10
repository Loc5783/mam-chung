import { useRef, type ReactNode, type HTMLAttributes } from "react";
import { useInView } from "../../lib/motion";

export interface ChartContainerProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children: (inView: boolean) => ReactNode;
  minHeight?: number | string;
  className?: string;
  threshold?: number;
}

/**
 * Wraps chart elements to detect viewport entry via IntersectionObserver.
 * Ensures charts only animate when visible to the user and avoids layout shift.
 */
export function ChartContainer({
  children,
  minHeight = 240,
  className = "",
  threshold = 0.2,
  style,
  ...props
}: ChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { threshold, once: true });

  return (
    <div
      ref={containerRef}
      className={`chart-container ${className}`.trim()}
      style={{ minHeight, ...style }}
      {...props}
    >
      {children(inView)}
    </div>
  );
}
