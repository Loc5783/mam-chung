import { useRef } from "react";
import {
  useInView,
  usePrefersReducedMotion,
  formatPercent,
} from "../../lib/motion";

export interface ProgressBarProps {
  value: number; // 0 to 100
  height?: number | string;
  color?: string;
  trackColor?: string;
  label?: string;
  showText?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  height = 8,
  color = "var(--primary, #7E9B57)",
  trackColor = "var(--primary-lighter, #f1f4eb)",
  label,
  showText = false,
  className = "",
}: ProgressBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { threshold: 0.1, once: true });
  const reduced = usePrefersReducedMotion();

  const clamped = Math.min(100, Math.max(0, value));
  const scale = inView || reduced ? clamped / 100 : 0;

  return (
    <div
      className={`progress-bar-wrapper flex flex-col gap-1.5 ${className}`.trim()}
    >
      {(label || showText) && (
        <div className="flex justify-between text-xs text-muted">
          {label && <span>{label}</span>}
          {showText && (
            <strong className="tabular-nums">{formatPercent(clamped)}</strong>
          )}
        </div>
      )}
      <div
        ref={containerRef}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || `${clamped}%`}
        className="progress-bar-track relative w-full overflow-hidden rounded-full"
        style={{
          height,
          backgroundColor: trackColor,
        }}
      >
        <div
          className="progress-bar-fill h-full w-full rounded-full"
          style={{
            backgroundColor: color,
            transformOrigin: "left center",
            transform: `scaleX(${scale})`,
            willChange: "transform",
            transition: reduced
              ? "none"
              : "transform var(--dur-chart) var(--ease-out)",
          }}
        />
      </div>
    </div>
  );
}
