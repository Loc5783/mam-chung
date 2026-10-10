import { useRef } from "react";
import { useInView, usePrefersReducedMotion, formatPercent } from "../../lib/motion";

export interface ProgressRingProps {
  value: number; // 0 to 100
  size?: number; // Outer diameter in px
  strokeWidth?: number; // Ring thickness in px
  color?: string; // Foreground ring color
  trackColor?: string; // Background circle color
  label?: string; // Optional label beneath value
  showValueText?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function ProgressRing({
  value,
  size = 120,
  strokeWidth = 10,
  color = "#7E9B57",
  trackColor = "#E4E8D9",
  label,
  showValueText = true,
  className = "",
  children,
}: ProgressRingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { threshold: 0.2, once: true });
  const reduced = usePrefersReducedMotion();

  const clampedValue = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // If in view (or reduced motion), compute offset; otherwise start at 100% (empty ring)
  const animatedPercent = inView || reduced ? clampedValue : 0;
  const strokeDashoffset = circumference - (circumference * animatedPercent) / 100;

  return (
    <div
      ref={containerRef}
      className={`progress-ring-container relative inline-flex flex-col items-center justify-center ${className}`.trim()}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || `${clampedValue}%`}
    >
      <svg
        width={size}
        height={size}
        className="progress-ring-svg -rotate-90 transform"
      >
        {/* Track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress animated circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          style={{
            transition: reduced
              ? "none"
              : "stroke-dashoffset var(--dur-chart) var(--ease-out)",
          }}
        />
      </svg>

      {/* Center content */}
      <div className="progress-ring-center absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        {children ? (
          children
        ) : showValueText ? (
          <>
            <strong className="text-base font-bold tabular-nums text-ink">
              {formatPercent(clampedValue)}
            </strong>
            {label && <small className="text-xs text-muted mt-0.5">{label}</small>}
          </>
        ) : null}
      </div>
    </div>
  );
}
