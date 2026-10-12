import { useState } from "react";
import { Button, Card } from "../../../components/ui";
import { AnimatedBar, AnimatedDonut } from "../../../components/charts";
import { safeStorage } from "../../../lib/safeStorage";
import { useTasksQuery } from "../api";
import type { TaskStats } from "../types";

const SCOPE_STORAGE_KEY = "mam_chung_tasks_stats_scope";

export interface StatsPanelProps {
  onFilterLate?: (habit: { name: string; type: "label" | "list" }) => void;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
}

export function StatsPanel({
  onFilterLate,
  collapsible = false,
  defaultCollapsed = false,
  className = "",
}: StatsPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const [scope, setScope] = useState<"personal" | "shared" | "all">(() => {
    const stored = safeStorage.getItem(SCOPE_STORAGE_KEY);
    if (stored === "personal" || stored === "shared" || stored === "all") {
      return stored;
    }
    return "all";
  });

  const handleScopeChange = (nextScope: "personal" | "shared" | "all") => {
    setScope(nextScope);
    safeStorage.setItem(SCOPE_STORAGE_KEY, nextScope);
  };

  const { data, isPending, isError, error, refetch } = useTasksQuery<TaskStats>(
    "/tasks/stats",
    { range, scope },
  );

  return (
    <div
      className={`stats-panel-root flex flex-col gap-4 ${className}`.trim()}
      data-testid="stats-panel"
    >
      {/* Header with Controls & Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl" role="img" aria-label="Thống kê">
            📊
          </span>
          <h2 className="text-lg font-semibold text-gray-800">
            Thống kê công việc
          </h2>
          {collapsible && (
            <button
              type="button"
              className="text-xs text-muted hover:text-gray-700 ml-2 py-1 px-2 rounded border border-gray-200"
              onClick={() => setCollapsed(!collapsed)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Mở rộng thống kê" : "Thu gọn thống kê"}
            >
              {collapsed ? "Mở rộng ▼" : "Thu gọn ▲"}
            </button>
          )}
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Scope Selector */}
          <div
            role="group"
            aria-label="Phạm vi thống kê"
            className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-xs shadow-sm"
          >
            {(
              [
                ["all", "Tất cả"],
                ["personal", "Cá nhân"],
                ["shared", "Chung"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  scope === val
                    ? "bg-[#7E9B57] text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                onClick={() => handleScopeChange(val)}
                aria-pressed={scope === val}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Range Selector */}
          <div
            role="group"
            aria-label="Khoảng thời gian"
            className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-xs shadow-sm"
          >
            {(
              [
                ["7d", "7 ngày"],
                ["30d", "30 ngày"],
                ["90d", "90 ngày"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  range === val
                    ? "bg-[#7E9B57] text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                onClick={() => setRange(val)}
                aria-pressed={range === val}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!collapsed && (
        <>
          {isPending ? (
            <Card className="p-6">
              <div
                className="animate-pulse flex flex-col gap-4"
                data-testid="stats-loading"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="h-20 bg-gray-100 rounded-lg" />
                  <div className="h-20 bg-gray-100 rounded-lg" />
                  <div className="h-20 bg-gray-100 rounded-lg" />
                </div>
                <div className="h-56 bg-gray-100 rounded-lg" />
              </div>
            </Card>
          ) : isError ? (
            <Card className="p-6 text-center">
              <p className="text-sm text-red-600 mb-3">
                Không thể tải số liệu thống kê:{" "}
                {(error as Error)?.message || "Đã xảy ra lỗi"}
              </p>
              <Button onClick={() => void refetch()} className="text-xs">
                Thử lại
              </Button>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Top KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. On-Time Rate */}
                <Card className="p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted font-medium">
                      Tỷ lệ đúng hạn
                    </span>
                    <span className="text-sm" role="img" aria-label="Đúng hạn">
                      ⏱️
                    </span>
                  </div>
                  <div className="mt-2">
                    {data.onTimeRate !== null ? (
                      <div className="flex items-baseline gap-2">
                        <span
                          className={`text-2xl font-bold tabular-nums ${
                            data.onTimeRate >= 0.8
                              ? "text-[#7E9B57]"
                              : data.onTimeRate < 0.7
                                ? "text-amber-600"
                                : "text-gray-800"
                          }`}
                        >
                          {`${Math.round(data.onTimeRate * 100)}%`}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            data.onTimeRate >= 0.8
                              ? "bg-[#7E9B57]/15 text-[#7E9B57]"
                              : data.onTimeRate < 0.7
                                ? "bg-amber-100 text-amber-800"
                                : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {data.onTimeRate >= 0.8
                            ? "Rất tốt"
                            : data.onTimeRate < 0.7
                              ? "Cần chú ý"
                              : "Ổn định"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted">
                        Chưa có việc có hạn
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted mt-1">
                    Tính trên các việc có đặt hạn
                  </p>
                </Card>

                {/* 2. Streak */}
                <Card className="p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted font-medium">
                      Chuỗi ngày hoàn thành
                    </span>
                    <span
                      className="text-lg"
                      role="img"
                      aria-label="Mầm chuỗi ngày"
                    >
                      {data.streak.current >= 7 ? "🌳" : "🌱"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold tabular-nums text-gray-800">
                      {data.streak.current}
                    </span>
                    <span className="text-xs text-muted">ngày liên tiếp</span>
                  </div>
                  <p className="text-[11px] text-muted mt-1">
                    {`Kỷ lục tốt nhất: ${data.streak.best} ngày • `}
                    {data.streak.current >= 7
                      ? "Mầm lớn vươn xa 🌳"
                      : "Mầm xanh đang lớn 🌱"}
                  </p>
                </Card>

                {/* 3. Completed Volume */}
                <Card className="p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted font-medium">
                      Việc đã hoàn thành
                    </span>
                    <span className="text-sm" role="img" aria-label="Hoàn tất">
                      ✨
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold tabular-nums text-[#7E9B57]">
                      {data.completed.today}
                    </span>
                    <span className="text-xs text-muted">hôm nay</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted mt-1">
                    <span>
                      Tuần này:{" "}
                      <strong className="text-gray-700">
                        {data.completed.thisWeek}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      Tháng này:{" "}
                      <strong className="text-gray-700">
                        {data.completed.thisMonth}
                      </strong>
                    </span>
                  </div>
                </Card>
              </div>

              {/* Couple Contribution Card (only if shared/all and couple data exists) */}
              {scope !== "personal" &&
                data.couple &&
                data.couple.members.length > 0 && (
                  <Card
                    className="p-4 bg-gradient-to-r from-emerald-50/40 via-white to-pink-50/40"
                    data-testid="stats-couple-card"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span role="img" aria-label="Cặp đôi">
                          🌱
                        </span>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Đóng góp không gian chung
                        </h3>
                      </div>
                      <span className="text-xs text-muted tabular-nums">
                        {`Tổng cộng: ${data.couple.total} việc`}
                      </span>
                    </div>

                    {/* Dual Contribution Bar */}
                    {data.couple.total > 0 ? (
                      (() => {
                        const m1 = data.couple.members[0];
                        const m2 = data.couple.members[1];
                        const p1 = Math.round(
                          (m1.completed / data.couple.total) * 100,
                        );
                        const p2 = 100 - p1;

                        return (
                          <div className="flex flex-col gap-2 mt-2">
                            <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
                              <div
                                style={{ width: `${p1}%` }}
                                className="bg-[#7E9B57] h-full transition-all duration-500"
                                title={`${m1.name}: ${m1.completed} việc (${p1}%)`}
                              />
                              <div
                                style={{ width: `${p2}%` }}
                                className="bg-[#E38FA9] h-full transition-all duration-500"
                                title={`${m2?.name || "Người ấy"}: ${m2?.completed ?? 0} việc (${p2}%)`}
                              />
                            </div>
                            <div className="flex justify-between items-center text-xs text-gray-600">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#7E9B57] inline-block" />
                                <strong>{m1.name}</strong>
                                {`: ${m1.completed} việc (${p1}%)`}
                              </span>
                              {m2 && (
                                <span className="flex items-center gap-1.5">
                                  <strong>{m2.name}</strong>
                                  {`: ${m2.completed} việc (${p2}%)`}
                                  <span className="w-2.5 h-2.5 rounded-full bg-[#E38FA9] inline-block" />
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <p className="text-xs text-muted mt-1">
                        Chưa có việc chung nào hoàn thành trong khoảng thời gian
                        này.
                      </p>
                    )}
                    <p className="text-[11px] text-muted mt-2 italic">
                      Cả hai cùng nhau xây dựng không gian sống và thói quen
                      tích cực 🌱
                    </p>
                  </Card>
                )}

              {/* Main Charts & Habits */}
              {data.byDay.every((d) => d.completed === 0) ? (
                <Card className="p-8 text-center" data-testid="stats-empty">
                  <span className="text-3xl" role="img" aria-label="Mầm non">
                    🌱
                  </span>
                  <p className="text-sm font-medium text-gray-700 mt-2">
                    Chưa có dữ liệu thống kê trong khoảng thời gian này
                  </p>
                  <p className="text-xs text-muted mt-1">
                    Hãy hoàn thành thêm công việc để xem biểu đồ và nhịp điệu
                    của bạn.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Left Column: By Day Chart (2 spans) */}
                  <Card className="p-4 lg:col-span-2 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800 mb-1">
                        Số việc hoàn thành theo ngày
                      </h3>
                      <p className="text-xs text-muted mb-3">
                        Nhịp độ làm việc trong{" "}
                        {range === "7d" ? "7" : range === "90d" ? "90" : "30"}{" "}
                        ngày qua
                      </p>
                    </div>

                    <div className="w-full">
                      <AnimatedBar
                        data={data.byDay.map((d) => ({
                          date: d.date.slice(5),
                          completed: d.completed,
                          rawDate: d.date,
                        }))}
                        bars={[
                          {
                            key: "completed",
                            name: "Việc xong",
                            color: "#7E9B57",
                            radius: [4, 4, 0, 0],
                          },
                        ]}
                        xAxisKey="date"
                        height={230}
                        showLegend={false}
                        tooltipFormatter={(val) => [`${val} việc`, "Đã xong"]}
                        ariaLabel="Biểu đồ số việc hoàn thành theo ngày"
                      />
                    </div>
                  </Card>

                  {/* Right Column: By List Donut (1 span) */}
                  <Card className="p-4 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800 mb-1">
                        Phân bố theo danh sách
                      </h3>
                      <p className="text-xs text-muted mb-3">
                        Tỷ trọng các danh sách được hoàn thành
                      </p>
                    </div>

                    {data.byList.length > 0 ? (
                      <div className="w-full flex flex-col items-center">
                        <AnimatedDonut
                          data={data.byList.map((l) => ({
                            name: l.name,
                            value: l.count,
                            color: l.color || "#7E9B57",
                          }))}
                          dataKey="value"
                          nameKey="name"
                          centerLabel="Tổng việc"
                          centerValue={data.byList.reduce(
                            (acc, l) => acc + l.count,
                            0,
                          )}
                          height={210}
                          ariaLabel="Biểu đồ phân bố theo danh sách"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <span className="text-2xl mb-1">📁</span>
                        <p className="text-xs text-muted">
                          Chưa có việc hoàn thành thuộc danh sách nào
                        </p>
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {/* Late Habits Section */}
              <Card className="p-4" data-testid="stats-late-habits">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <span role="img" aria-label="Đồng hồ nhắc">
                      ⏳
                    </span>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                      Thói quen cần lưu ý: Việc hay trễ hạn
                    </h3>
                  </div>
                  <span className="text-xs text-muted">
                    Top danh sách & nhãn dễ trễ
                  </span>
                </div>

                {data.lateHabits.length > 0 ? (
                  <div className="flex flex-col divide-y divide-gray-100">
                    {data.lateHabits.map((habit, idx) => (
                      <div
                        key={`${habit.type}-${habit.name}-${idx}`}
                        className="py-2.5 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                              habit.type === "label"
                                ? "bg-purple-50 text-purple-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {habit.type === "label"
                              ? `# ${habit.name}`
                              : `📁 ${habit.name}`}
                          </span>
                          <span className="text-gray-500">
                            {`• ${habit.lateCount} việc trễ (${Math.round(habit.rate * 100)}%)`}
                          </span>
                        </div>

                        {onFilterLate && (
                          <button
                            type="button"
                            className="text-[#7E9B57] hover:underline font-medium text-xs whitespace-nowrap"
                            onClick={() => onFilterLate(habit)}
                          >
                            Xem các việc này →
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted py-2">
                    Không có thói quen trễ hạn nào đáng chú ý trong khoảng thời
                    gian này. Tuyệt vời! 🎉
                  </p>
                )}
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
