import { useId, useState } from "react";
import { moveTabFocus } from "../../components/ui/tabs";
import { BudgetPreview } from "../planning/PlanningPanel";
import { FinanceIcon } from "./FinanceIcon";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet as WalletIcon,
  ChevronRight,
  Plus,
  Sprout,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card, EmptyState, Skeleton, Button } from "../../components/ui";
import { AnimatedDonut } from "../../components/charts";
import { CountUp } from "../../lib/motion";
import { errorMessage } from "../../lib/apiClient";
import { formatMoney } from "../../lib/format";
import { useFinanceDashboard, displayDate } from "./api";
import { Budget } from "../planning/types";
import { FinanceDashboard, Entry } from "./types";
const colors = [
  "#7E9B57",
  "#E38FA9",
  "#B9CC9A",
  "#57713A",
  "#B3577A",
  "#E7EFDB",
];
export function EntryRows({
  items,
  timezone,
}: {
  items: Entry[];
  timezone: string;
}) {
  return (
    <div className="recent-entry-list">
      {items.map((entry, i) => (
        <div
          className="recent-entry stagger-item"
          key={entry.id}
          style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
        >
          <span
            className={`mini-icon ${entry.type === "expense" ? "pink" : ""}`}
          >
            <FinanceIcon name={entry.categoryIcon} size={18} />
          </span>
          <div>
            <b>{entry.description}</b>
            <small>
              {entry.categoryName} · {entry.walletName} ·{" "}
              {displayDate(entry.date, timezone)}
            </small>
          </div>
          <strong
            className={
              entry.type === "expense" ? "amount-expense" : "amount-income"
            }
          >
            {entry.type === "expense" ? "−" : "+"}
            {formatMoney(entry.amount)}
          </strong>
        </div>
      ))}
    </div>
  );
}
function Change({ value }: { value: number | null }) {
  return (
    <span className="stat-foot">
      {value === null
        ? "Chưa có dữ liệu tháng trước"
        : `${value > 0 ? "+" : ""}${value}% so với tháng trước`}
    </span>
  );
}
export function FinanceOverview({
  onAdd,
  onWallet,
  overview,
  budgets,
}: {
  onAdd: () => void;
  onWallet: () => void;
  overview?: FinanceDashboard;
  budgets?: Budget[];
}) {
  const [chartType, setChartType] = useState<"income" | "expense">("expense");
  const [activeCategory, setActiveCategory] = useState<string | number | null>(
    null,
  );
  const chartId = useId();
  const query = useFinanceDashboard(!overview);
  if (!overview && query.isPending)
    return (
      <div className="finance-loading">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    );
  if (!overview && query.isError)
    return (
      <Card>
        <div className="finance-error">
          <h2>Chưa tải được tài chính</h2>
          <p role="alert">{errorMessage(query.error)}</p>
          <Button onClick={() => void query.refetch()}>Thử lại</Button>
        </div>
      </Card>
    );
  const data = overview ?? query.data!;
  const label = `Tháng ${data.month.slice(5)}/${data.month.slice(0, 4)}`;
  const activeWallets = data.wallets.filter((w) => !w.archived);
  const showingIncome = chartType === "income";
  const chartTotal = showingIncome ? data.income : data.expense;
  const chartGroups =
    (showingIncome ? data.incomeByCategory : data.spending) ?? [];
  const chartLabel = showingIncome ? "Khoản thu" : "Khoản chi";
  return (
    <>
      <div className="summary-grid real-summary">
        <Card className="balance-card">
          <div className="stat-label">
            Tổng số dư cá nhân <WalletIcon size={19} />
          </div>
          <strong>
            <CountUp value={data.totalBalance} format={formatMoney} />
          </strong>
          <span className="stat-foot">
            {data.wallets.length} ví · bao gồm ví lưu trữ
          </span>
          <div className="balance-decoration" aria-hidden="true">
            <Sprout />
          </div>
        </Card>
        <Card>
          <div className="stat-label">
            Thu nhập · {label}
            <span className="mini-icon">
              <ArrowDownLeft size={18} />
            </span>
          </div>
          <strong>
            <CountUp value={data.income} format={formatMoney} />
          </strong>
          <Change value={data.incomeChange} />
        </Card>
        <Card>
          <div className="stat-label">
            Chi tiêu · {label}
            <span className="mini-icon pink">
              <ArrowUpRight size={18} />
            </span>
          </div>
          <strong>
            <CountUp value={data.expense} format={formatMoney} />
          </strong>
          <Change value={data.expenseChange} />
        </Card>
      </div>
      <div className="finance-overview-grid">
        <Card>
          <div className="section-heading">
            <div>
              <span className="eyebrow">NHÌN LẠI THÁNG NÀY</span>
              <h2>{showingIncome ? "Tiền đến từ đâu?" : "Tiền đã đi đâu?"}</h2>
            </div>
            <span className="subtle-chip">{label}</span>
          </div>
          <div
            className="finance-tabs finance-chart-tabs"
            role="tablist"
            aria-label="Biểu đồ thu và chi"
            onKeyDown={moveTabFocus}
          >
            {(["income", "expense"] as const).map((type) => (
              <button
                key={type}
                id={`${chartId}-${type}`}
                role="tab"
                aria-selected={chartType === type}
                aria-controls={`${chartId}-panel`}
                tabIndex={chartType === type ? 0 : -1}
                className={chartType === type ? "active" : ""}
                onClick={() => setChartType(type)}
              >
                {type === "income" ? "Khoản thu" : "Khoản chi"}
              </button>
            ))}
          </div>
          <div
            id={`${chartId}-panel`}
            role="tabpanel"
            aria-labelledby={`${chartId}-${chartType}`}
            key={chartType}
            className="filter-refresh"
          >
            {chartGroups.length === 0 ? (
              <>
                <EmptyState
                  title={
                    showingIncome
                      ? "Chưa có khoản thu nào"
                      : "Chưa có khoản chi nào"
                  }
                >
                  {showingIncome
                    ? "Ghi giao dịch loại Khoản thu để xem nguồn thu nhập trong tháng."
                    : "Ghi lại khoản chi đầu tiên để hiểu hơn về thói quen của bạn."}
                </EmptyState>
                <Button
                  className="empty-action"
                  onClick={activeWallets.length ? onAdd : onWallet}
                >
                  <Plus size={16} />
                  {activeWallets.length ? "Ghi giao dịch" : "Tạo ví đầu tiên"}
                </Button>
              </>
            ) : (
              <div className="real-spending">
                <div
                  className="real-donut"
                  role="img"
                  aria-label={`${chartLabel} tháng này ${formatMoney(chartTotal)}`}
                >
                  <AnimatedDonut
                    data={chartGroups}
                    dataKey="amount"
                    nameKey="name"
                    colors={colors}
                    innerRadius={62}
                    outerRadius={86}
                    centerLabel={showingIncome ? "Tổng thu" : "Tổng chi"}
                    centerValue={chartTotal}
                    centerFormatter={formatMoney}
                    height="100%"
                    activeId={activeCategory}
                    onActiveChange={setActiveCategory}
                    tooltipFormatter={(val) => [formatMoney(val), "Số tiền"]}
                  />
                </div>
                <div className="real-legend">
                  {chartGroups.map((item, i) => {
                    const isHovered = activeCategory === item.categoryId;
                    const isDimmed = activeCategory !== null && !isHovered;
                    return (
                      <div
                        key={item.categoryId}
                        className={`chart-legend-row ${isHovered ? "active" : ""}`}
                        style={{
                          opacity: isDimmed ? 0.45 : 1,
                          transition: "all var(--dur-fast) var(--ease-out)",
                          cursor: "pointer",
                          padding: "4px 8px",
                          borderRadius: "8px",
                          backgroundColor: isHovered
                            ? "var(--primary-lighter)"
                            : "transparent",
                        }}
                        onMouseEnter={() => setActiveCategory(item.categoryId)}
                        onMouseLeave={() => setActiveCategory(null)}
                      >
                        <span
                          className="legend-dot"
                          style={{ background: colors[i % colors.length] }}
                        />
                        <div>
                          <b>{item.name}</b>
                          <small>{formatMoney(item.amount)}</small>
                        </div>
                        <strong>
                          {chartTotal
                            ? Math.round((item.amount / chartTotal) * 100)
                            : 0}
                          %
                        </strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Card>
        <Card>
          <div className="section-heading">
            <div>
              <span className="eyebrow">NHỮNG CHIẾC VÍ CỦA BẠN</span>
              <h2>Mỗi ví, một mục đích</h2>
            </div>
            <Button className="button-outline compact" onClick={onWallet}>
              <Plus size={15} />
              Tạo ví
            </Button>
          </div>
          {data.wallets.length === 0 ? (
            <EmptyState title="Gieo chiếc ví đầu tiên">
              Tiền mặt, ngân hàng hay ví điện tử — bắt đầu từ nơi bạn giữ tiền.
            </EmptyState>
          ) : (
            <div className="overview-wallets">
              {data.wallets.map((wallet, i) => (
                <div
                  key={wallet.id}
                  className="stagger-item"
                  style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
                >
                  <span
                    className="wallet-color-dot"
                    style={{ background: wallet.color }}
                  />
                  <div>
                    <b>{wallet.name}</b>
                    <small>
                      {wallet.archived
                        ? "Đã lưu trữ"
                        : wallet.type === "cash"
                          ? "Tiền mặt"
                          : wallet.type === "bank"
                            ? "Ngân hàng"
                            : "Ví điện tử"}
                    </small>
                  </div>
                  <strong>{formatMoney(wallet.balance)}</strong>
                </div>
              ))}
            </div>
          )}
          <Link className="card-link" to="/finance?tab=wallets">
            Quản lý các ví <ChevronRight size={16} />
          </Link>
        </Card>
      </div>
      <BudgetPreview provided={budgets} />
      <Card className="recent-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">MỘT CHÚT MỖI NGÀY</span>
            <h2>Giao dịch gần đây</h2>
          </div>
          <Link className="card-link" to="/finance?tab=transactions">
            Xem lịch sử <ChevronRight size={16} />
          </Link>
        </div>
        {data.recent.length ? (
          <EntryRows items={data.recent} timezone={data.timezone} />
        ) : (
          <EmptyState title="Sổ giao dịch còn trống">
            Mỗi khoản thu, mỗi khoản chi đều là một bước hiểu rõ tài chính hơn.
          </EmptyState>
        )}
      </Card>
    </>
  );
}
