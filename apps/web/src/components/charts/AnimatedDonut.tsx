import { useState, useRef } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Sector,
  type PieProps,
} from "recharts";
import {
  DUR,
  useCountUp,
  useInView,
  usePrefersReducedMotion,
} from "../../lib/motion";
import { formatVND } from "../../lib/motion";

export interface DonutDataItem {
  name: string;
  value?: number;
  amount?: number;
  count?: number;
  id?: string | number;
  categoryId?: string | number;
  color?: string;
  [key: string]: unknown;
}

export interface AnimatedDonutProps {
  data: DonutDataItem[];
  dataKey?: string;
  nameKey?: string;
  colors?: readonly string[] | string[];
  innerRadius?: number;
  outerRadius?: number;
  centerLabel?: string;
  centerValue?: number;
  centerFormatter?: (value: number) => string;
  height?: number | string;
  activeId?: string | number | null;
  onActiveChange?: (id: string | number | null) => void;
  tooltipFormatter?: (
    value: number,
    name?: string,
  ) => [string, string] | string;
  ariaLabel?: string;
  className?: string;
}

// Active shape renders the hovered slice with outerRadius + 6 for a gentle pop
function renderActiveSlice(props: unknown) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } =
    props as {
      cx: number;
      cy: number;
      innerRadius: number;
      outerRadius: number;
      startAngle: number;
      endAngle: number;
      fill: string;
    };

  return (
    <g className="donut-slice-active">
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{
          filter: "drop-shadow(0px 4px 10px rgba(43, 51, 36, 0.18))",
          transition: "all 160ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />
    </g>
  );
}

export function AnimatedDonut({
  data,
  dataKey = "amount",
  nameKey = "name",
  colors = ["#7e9b57", "#e38fa9", "#57713a", "#b3577a", "#b9cc9a"],
  innerRadius = 62,
  outerRadius = 86,
  centerLabel,
  centerValue,
  centerFormatter = (v) => formatVND(v),
  height = 240,
  activeId,
  onActiveChange,
  tooltipFormatter,
  ariaLabel,
  className = "",
}: AnimatedDonutProps) {
  const reduced = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { threshold: 0.2, once: true });
  const [internalHoverIndex, setInternalHoverIndex] = useState<number | null>(
    null,
  );

  // Sync external activeId if provided
  const activeIndex =
    activeId !== undefined && activeId !== null
      ? data.findIndex(
          (item) => (item.id ?? item.categoryId ?? item[nameKey]) === activeId,
        )
      : internalHoverIndex;

  const activeItem =
    activeIndex !== null && activeIndex >= 0 && data[activeIndex]
      ? data[activeIndex]
      : null;

  const resolvedCenterValue =
    centerValue ??
    data.reduce((sum, item) => {
      const val = Number(item[dataKey] ?? 0);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

  const displayCount = useCountUp(resolvedCenterValue, {
    format: centerFormatter,
    enabled: inView,
    duration: DUR.count,
  });

  const onPieEnter: PieProps["onMouseEnter"] = (_, index) => {
    setInternalHoverIndex(index);
    if (onActiveChange && data[index]) {
      const item = data[index];
      const fallbackId = (item[nameKey] as string | number | undefined) ?? null;
      onActiveChange(item.id ?? item.categoryId ?? fallbackId);
    }
  };

  const onPieLeave = () => {
    setInternalHoverIndex(null);
    if (onActiveChange) {
      onActiveChange(null);
    }
  };

  const hasData =
    data &&
    data.length > 0 &&
    data.some((item) => Number(item[dataKey] ?? 0) > 0);

  return (
    <div
      ref={containerRef}
      className={`animated-donut-wrapper relative ${className}`.trim()}
      style={{ height, minHeight: typeof height === "number" ? height : 200 }}
      {...(ariaLabel ? { role: "img", "aria-label": ariaLabel } : {})}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey={dataKey}
            nameKey={nameKey}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={data.length > 1 ? 3 : 0}
            startAngle={90}
            endAngle={-270}
            isAnimationActive={!reduced && inView}
            animationDuration={DUR.chart}
            animationEasing="ease-out"
            stroke="white"
            strokeWidth={1.5}
            activeIndex={
              activeIndex !== null && activeIndex >= 0 ? activeIndex : undefined
            }
            activeShape={renderActiveSlice}
            onMouseEnter={onPieEnter}
            onMouseLeave={onPieLeave}
          >
            {data.map((item, index) => {
              const sliceColor = item.color || colors[index % colors.length];
              const isHovered = activeIndex === index;
              const hasHover = activeIndex !== null && activeIndex >= 0;
              // Dim other slices when one slice is actively hovered
              const opacity = hasHover ? (isHovered ? 1 : 0.45) : 1;

              return (
                <Cell
                  key={`slice-${item.id ?? item.categoryId ?? index}`}
                  fill={sliceColor}
                  opacity={opacity}
                  style={{
                    transition: "opacity 160ms cubic-bezier(0.22, 1, 0.36, 1)",
                    cursor: "pointer",
                  }}
                />
              );
            })}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Floating callout box: Displays details of hovered slice in an easy-to-read top corner */}
      {activeItem &&
        (() => {
          const itemLabel = String(
            activeItem[nameKey] ?? activeItem.name ?? "",
          );
          const itemVal = Number(
            activeItem[dataKey] ?? activeItem.amount ?? activeItem.count ?? 0,
          );
          const itemColor =
            activeItem.color || colors[(activeIndex ?? 0) % colors.length];
          const itemPercent =
            resolvedCenterValue > 0
              ? Math.round((itemVal / resolvedCenterValue) * 100)
              : 0;
          return (
            <div className="donut-hover-callout" role="tooltip">
              <div className="donut-hover-callout-header">
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: itemColor,
                    display: "inline-block",
                  }}
                />
                <span>{itemLabel}</span>
                <span style={{ color: "var(--ink-muted)", fontWeight: 400 }}>
                  ({itemPercent}%)
                </span>
              </div>
              <div className="donut-hover-callout-body">
                {tooltipFormatter ? (
                  (() => {
                    const res = tooltipFormatter(itemVal, itemLabel);
                    if (Array.isArray(res)) {
                      return (
                        <>
                          {res[1]} : <strong>{res[0]}</strong>
                        </>
                      );
                    }
                    return <strong>{res}</strong>;
                  })()
                ) : (
                  <>
                    {centerLabel ? `${centerLabel} : ` : ""}
                    <strong>{centerFormatter(itemVal)}</strong>
                  </>
                )}
              </div>
            </div>
          );
        })()}

      {/* Donut Center Display: Always cleanly presents overall total without being obscured */}
      {hasData && (centerLabel || centerValue !== undefined) && (
        <div
          className="donut-center pointer-events-none select-none text-center"
          aria-hidden="true"
        >
          {centerLabel && (
            <small className="text-muted block truncate max-w-[110px]">
              {centerLabel}
            </small>
          )}
          <b className="tabular-nums font-bold text-ink block truncate max-w-[120px]">
            {displayCount}
          </b>
        </div>
      )}
    </div>
  );
}
