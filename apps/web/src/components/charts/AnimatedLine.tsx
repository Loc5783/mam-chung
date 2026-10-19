import { useRef } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { DUR, useInView, usePrefersReducedMotion } from "../../lib/motion";

export interface LineConfig {
  key: string;
  name: string;
  color: string;
  strokeWidth?: number;
  connectNulls?: boolean;
}

export interface AnimatedLineProps {
  data: Record<string, unknown>[];
  lines: LineConfig[];
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

export function AnimatedLine({
  data,
  lines,
  xAxisKey = "date",
  xAxisFormatter,
  yAxisFormatter,
  yAxisWidth = 58,
  height = 260,
  tooltipFormatter,
  showGrid = true,
  showLegend = false,
  className = "",
  ariaLabel,
}: AnimatedLineProps) {
  const reduced = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { threshold: 0.2, once: true });

  return (
    <div
      ref={containerRef}
      className={`animated-line-chart-wrapper ${className}`.trim()}
      style={{ height, minHeight: typeof height === "number" ? height : 200 }}
      {...(ariaLabel ? { role: "img", "aria-label": ariaLabel } : {})}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 16, right: 16, left: 4, bottom: 8 }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e4e8d9"
              vertical={false}
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
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color}
              strokeWidth={line.strokeWidth ?? 2}
              connectNulls={line.connectNulls ?? false}
              isAnimationActive={!reduced && inView}
              animationDuration={DUR.chart}
              animationEasing="ease-out"
              dot={{ r: 3, fill: line.color, stroke: "white", strokeWidth: 1 }}
              activeDot={{
                r: 6,
                fill: line.color,
                stroke: "white",
                strokeWidth: 2,
                className: "chart-active-dot",
              }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
