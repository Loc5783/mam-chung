import { type ReactNode } from "react";
import { formatVND } from "../../lib/motion";

export interface ChartLegendItem {
  id?: string | number;
  categoryId?: string | number;
  name: string;
  amount?: number;
  value?: number;
  count?: number;
  color: string;
  percent?: number;
}

export interface ChartLegendProps {
  items: ChartLegendItem[];
  total?: number;
  activeId?: string | number | null;
  onHover?: (id: string | number | null) => void;
  formatter?: (val: number) => string;
  renderExtra?: (item: ChartLegendItem) => ReactNode;
  className?: string;
}

export function ChartLegend({
  items,
  total,
  activeId,
  onHover,
  formatter = (v) => formatVND(v),
  renderExtra,
  className = "",
}: ChartLegendProps) {
  const resolvedTotal =
    total ??
    items.reduce(
      (sum, it) => sum + (it.amount ?? it.value ?? it.count ?? 0),
      0,
    );

  return (
    <div className={`chart-interactive-legend ${className}`.trim()}>
      {items.map((item, index) => {
        const itemId = item.id ?? item.categoryId ?? item.name;
        const isActive =
          activeId !== undefined && activeId !== null && activeId === itemId;
        const isDimmed =
          activeId !== undefined && activeId !== null && !isActive;
        const val = item.amount ?? item.value ?? item.count ?? 0;
        const percent =
          item.percent !== undefined
            ? item.percent
            : resolvedTotal > 0
              ? Math.round((val / resolvedTotal) * 100)
              : 0;

        return (
          <div
            key={String(itemId || index)}
            className={`chart-legend-row flex items-center justify-between p-1.5 rounded-lg transition-all cursor-pointer ${
              isActive ? "bg-primary-lighter font-medium" : ""
            } ${isDimmed ? "opacity-50" : "opacity-100"}`}
            style={{
              transition: "all var(--dur-fast) var(--ease-out)",
            }}
            onMouseEnter={() => onHover?.(itemId)}
            onMouseLeave={() => onHover?.(null)}
          >
            <div className="flex items-center gap-2">
              <span
                className="legend-dot w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <div className="flex flex-col">
                <span className="text-xs text-ink leading-tight">
                  {item.name}
                </span>
                <small className="text-[11px] text-muted leading-tight">
                  {formatter(val)}
                </small>
              </div>
            </div>
            <div className="flex items-center gap-1.5 ml-2">
              <strong className="text-xs text-ink tabular-nums">
                {percent}%
              </strong>
              {renderExtra?.(item)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
