import { type ReactNode } from "react";
import { formatVND } from "../../lib/motion";

export interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number | string;
    color?: string;
    payload?: Record<string, unknown>;
  }>;
  label?: string | number;
  formatter?: (value: number) => string;
  renderExtra?: (payload: Record<string, unknown>) => ReactNode;
}

export function ChartTooltip({
  active,
  payload,
  label,
  formatter = (v) => formatVND(Number(v)),
  renderExtra,
}: ChartTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="chart-tooltip" role="tooltip">
      {label && <b className="chart-tooltip-label">{label}</b>}
      <div className="chart-tooltip-list">
        {payload.map((entry, index) => {
          const val =
            typeof entry.value === "number"
              ? formatter(entry.value)
              : entry.value;
          return (
            <div key={`${entry.name || index}`} className="chart-tooltip-item">
              {entry.color && (
                <span
                  className="chart-tooltip-dot"
                  style={{ backgroundColor: entry.color }}
                />
              )}
              <span className="chart-tooltip-name">
                {entry.name || "Giá trị"}:
              </span>
              <strong className="chart-tooltip-val tabular-nums">{val}</strong>
              {entry.payload && renderExtra?.(entry.payload)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
