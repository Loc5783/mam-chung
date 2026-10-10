import { useRef } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { DUR, useInView, usePrefersReducedMotion } from "../../lib/motion";

export interface BarConfig {
  key: string;
  name: string;
  color: string;
  radius?: [number, number, number, number];
}

export interface AnimatedBarProps {
  data: Record<string, unknown>[];
  bars: BarConfig[];
  xAxisKey?: string;
  xAxisFormatter?: (val: string) => string;
  yAxisFormatter?: (val: number) => string;
  yAxisWidth?: number;
  height?: number | string;
  tooltipFormatter?: (val: number, name: string) => [string, string] | string;
  showGrid?: boolean;
  showLegend?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function AnimatedBar({
  data,
  bars,
  xAxisKey = "month",
  xAxisFormatter,
  yAxisFormatter,
  yAxisWidth = 58,
  height = 260,
  tooltipFormatter,
  showGrid = true,
  showLegend = true,
  className = "",
  ariaLabel,
}: AnimatedBarProps) {
  const reduced = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { threshold: 0.2, once: true });

  return (
    <div
      ref={containerRef}
      className={`animated-bar-chart-wrapper ${className}`.trim()}
      style={{ height, minHeight: typeof height === "number" ? height : 200 }}
      {...(ariaLabel ? { role: "img", "aria-label": ariaLabel } : {})}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 12, left: 4, bottom: 10 }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#E4E8D9"
            />
          )}
          <XAxis
            dataKey={xAxisKey}
            tickFormatter={xAxisFormatter}
            tick={{ fontSize: 11 }}
            stroke="#859178"
          />
          <YAxis
            width={yAxisWidth}
            tickFormatter={yAxisFormatter}
            tick={{ fontSize: 11 }}
            stroke="#859178"
          />
          <Tooltip
            formatter={
              tooltipFormatter
                ? (val, name) => tooltipFormatter(Number(val), String(name))
                : undefined
            }
            animationDuration={DUR.fast}
            animationEasing="ease-out"
          />
          {showLegend && <Legend />}
          {bars.map((bar, index) => (
            <Bar
              key={bar.key}
              dataKey={bar.key}
              name={bar.name}
              fill={bar.color}
              radius={bar.radius ?? [6, 6, 0, 0]}
              isAnimationActive={!reduced && inView}
              animationDuration={DUR.chart}
              animationBegin={Math.min(index * 60, 480)}
              animationEasing="ease-out"
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
