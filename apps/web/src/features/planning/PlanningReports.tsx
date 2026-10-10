import { useState } from "react";
import { Card, Button, Skeleton, EmptyState } from "../../components/ui";
import { AnimatedBar, AnimatedLine } from "../../components/charts";
import { formatMoney } from "../../lib/format";
import { errorMessage } from "../../lib/apiClient";
import { useReports, useCurrentMonth } from "./api";
const colors = ["#7E9B57", "#E38FA9", "#57713A", "#B3577A", "#B9CC9A"];
export function PlanningReports() {
  const current = useCurrentMonth(),
    [months, setMonths] = useState(6),
    [endMonth, setEndMonth] = useState(current);
  const query = useReports(months, endMonth);
  const data = query.data;
  const lines = data?.categories.slice(0, 5) ?? [];
  const chart =
    data?.months.map((month, i) => ({
      ...month,
      ...Object.fromEntries(lines.map((c) => [c.categoryId, c.months[i]])),
    })) ?? [];
  return (
    <>
      <div className="section-heading finance-toolbar">
        <div>
          <h2>Nhìn lại để bước tiếp</h2>
          <p className="muted">
            Thu chi và xu hướng theo múi giờ hồ sơ; không tính chuyển tiền hoặc
            số dư ban đầu.
          </p>
        </div>
        <div className="report-filters">
          <label>
            Khoảng xem
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
            >
              <option value={6}>6 tháng</option>
              <option value={12}>12 tháng</option>
            </select>
          </label>
          <label>
            Đến tháng
            <input
              type="month"
              value={endMonth}
              onChange={(e) => {
                if (e.target.value) setEndMonth(e.target.value);
              }}
            />
          </label>
        </div>
      </div>
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <Card>
          <p role="alert" className="form-error">
            {errorMessage(query.error)}
          </p>
          <Button onClick={() => void query.refetch()}>Thử lại</Button>
        </Card>
      ) : (
        data && (
          <div key={`${months}-${endMonth}`} className="filter-refresh">
            <div className="history-summary report-summary">
              <span>
                Tổng thu{" "}
                <b className="income-text">{formatMoney(data.totalIncome)}</b>
              </span>
              <span>
                Tổng chi{" "}
                <b className="expense-text">{formatMoney(data.totalExpense)}</b>
              </span>
              <span>
                Thu tháng cuối{" "}
                <b>
                  {data.comparison.incomeChange === null
                    ? "Chưa có mốc so sánh"
                    : `${data.comparison.incomeChange > 0 ? "+" : ""}${data.comparison.incomeChange}%`}
                </b>
              </span>
              <span>
                Chi tháng cuối{" "}
                <b>
                  {data.comparison.expenseChange === null
                    ? "Chưa có mốc so sánh"
                    : `${data.comparison.expenseChange > 0 ? "+" : ""}${data.comparison.expenseChange}%`}
                </b>
              </span>
              <small>Hai tỷ lệ so với tháng trước đó</small>
            </div>
            <Card className="report-chart-card">
              <div className="section-heading">
                <h2>Nhịp thu & chi</h2>
                <span className="subtle-chip">{months} tháng</span>
              </div>
              <div
                className="report-chart"
                role="img"
                aria-label={`Biểu đồ thu chi ${months} tháng, tổng thu ${formatMoney(data.totalIncome)}, tổng chi ${formatMoney(data.totalExpense)}`}
              >
                <AnimatedBar
                  data={chart}
                  bars={[
                    { key: "income", name: "Thu nhập", color: "#7E9B57", radius: [5, 5, 0, 0] },
                    { key: "expense", name: "Chi tiêu", color: "#E38FA9", radius: [5, 5, 0, 0] },
                  ]}
                  xAxisKey="month"
                  xAxisFormatter={(v) => `${v.slice(5)}/${v.slice(2, 4)}`}
                  yAxisFormatter={(v) => `${Math.round(v / 1000)}k`}
                  tooltipFormatter={(v) => formatMoney(Number(v))}
                  height="100%"
                  ariaLabel={`Biểu đồ thu chi ${months} tháng, tổng thu ${formatMoney(data.totalIncome)}, tổng chi ${formatMoney(data.totalExpense)}`}
                />
              </div>
              <div className="table-scroll">
                <table className="history-table report-table">
                  <caption className="sr-only">
                    Số liệu thu chi từng tháng
                  </caption>
                  <thead>
                    <tr>
                      <th>Tháng</th>
                      <th>Thu</th>
                      <th>Chi</th>
                      <th>Chênh lệch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.months.map((m) => (
                      <tr key={m.month}>
                        <td>{m.month}</td>
                        <td>{formatMoney(m.income)}</td>
                        <td>{formatMoney(m.expense)}</td>
                        <td>{formatMoney(m.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card className="report-chart-card">
              <div className="section-heading">
                <h2>Xu hướng chi theo danh mục</h2>
                <span className="subtle-chip">Top 5</span>
              </div>
              {lines.length ? (
                <>
                  <div
                    className="report-chart"
                    role="img"
                    aria-label="Xu hướng chi của 5 danh mục có tổng chi cao nhất"
                  >
                    <AnimatedLine
                      data={chart}
                      lines={lines.map((c, i) => ({
                        key: c.categoryId,
                        name: c.name,
                        color: colors[i % colors.length],
                      }))}
                      xAxisKey="month"
                      xAxisFormatter={(v) => `${v.slice(5)}/${v.slice(2, 4)}`}
                      yAxisFormatter={(v) => `${Math.round(v / 1000)}k`}
                      tooltipFormatter={(v) => formatMoney(Number(v))}
                      showLegend
                      height="100%"
                      ariaLabel="Xu hướng chi của 5 danh mục có tổng chi cao nhất"
                    />
                  </div>
                  <div className="report-category-list">
                    {data.categories.map((c, i) => (
                      <div key={c.categoryId}>
                        <span
                          className="legend-dot"
                          style={{ background: colors[i % colors.length] }}
                        />
                        <b>{c.name}</b>
                        <span>{formatMoney(c.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState title="Chưa có chi tiêu trong khoảng này">
                  Khoản chi đầu tiên sẽ mở ra biểu đồ xu hướng của bạn.
                </EmptyState>
              )}
            </Card>
          </div>
        )
      )}
    </>
  );
}
