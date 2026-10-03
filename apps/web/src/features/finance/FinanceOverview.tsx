import { FinanceIcon } from "./FinanceIcon";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet as WalletIcon,
  ChevronRight,
  Plus,
  Sprout,
} from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Link } from "react-router-dom";
import { Card, EmptyState, Skeleton, Button } from "../../components/ui";
import { errorMessage } from "../../lib/apiClient";
import { formatMoney } from "../../lib/format";
import { useFinanceDashboard, displayDate } from "./api";
import { Entry } from "./types";
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
      {items.map((entry) => (
        <div className="recent-entry" key={entry.id}>
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
}: {
  onAdd: () => void;
  onWallet: () => void;
}) {
  const query = useFinanceDashboard();
  if (query.isPending)
    return (
      <div className="finance-loading">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    );
  if (query.isError)
    return (
      <Card>
        <div className="finance-error">
          <h2>Chưa tải được tài chính</h2>
          <p role="alert">{errorMessage(query.error)}</p>
          <Button onClick={() => void query.refetch()}>Thử lại</Button>
        </div>
      </Card>
    );
  const data = query.data;
  const label = `Tháng ${data.month.slice(5)}/${data.month.slice(0, 4)}`;
  const activeWallets = data.wallets.filter((w) => !w.archived);
  return (
    <>
      <div className="summary-grid real-summary">
        <Card className="balance-card">
          <div className="stat-label">
            Tổng số dư cá nhân <WalletIcon size={19} />
          </div>
          <strong>{formatMoney(data.totalBalance)}</strong>
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
          <strong>{formatMoney(data.income)}</strong>
          <Change value={data.incomeChange} />
        </Card>
        <Card>
          <div className="stat-label">
            Chi tiêu · {label}
            <span className="mini-icon pink">
              <ArrowUpRight size={18} />
            </span>
          </div>
          <strong>{formatMoney(data.expense)}</strong>
          <Change value={data.expenseChange} />
        </Card>
      </div>
      <div className="finance-overview-grid">
        <Card>
          <div className="section-heading">
            <div>
              <span className="eyebrow">NHÌN LẠI THÁNG NÀY</span>
              <h2>Tiền đã đi đâu?</h2>
            </div>
            <span className="subtle-chip">{label}</span>
          </div>
          {data.spending.length === 0 ? (
            <>
              <EmptyState title="Chưa có khoản chi nào">
                Ghi lại khoản chi đầu tiên để hiểu hơn về thói quen của bạn.
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
                aria-label={`Chi tiêu tháng này ${formatMoney(data.expense)}`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.spending}
                      dataKey="amount"
                      nameKey="name"
                      innerRadius={62}
                      outerRadius={86}
                      paddingAngle={3}
                      isAnimationActive={false}
                      stroke="white"
                    >
                      {data.spending.map((item, i) => (
                        <Cell key={item.categoryId} fill={colors[i]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [
                        formatMoney(Number(value)),
                        "Số tiền",
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <small>Tổng chi</small>
                  <b>{formatMoney(data.expense)}</b>
                </div>
              </div>
              <div className="real-legend">
                {data.spending.map((item, i) => (
                  <div key={item.categoryId}>
                    <span
                      className="legend-dot"
                      style={{ background: colors[i] }}
                    />
                    <div>
                      <b>{item.name}</b>
                      <small>{formatMoney(item.amount)}</small>
                    </div>
                    <strong>
                      {data.expense
                        ? Math.round((item.amount / data.expense) * 100)
                        : 0}
                      %
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}
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
              {data.wallets.map((wallet) => (
                <div key={wallet.id}>
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
