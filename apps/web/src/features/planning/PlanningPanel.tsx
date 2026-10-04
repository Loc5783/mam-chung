import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Plus,
  Pencil,
  Trash2,
  PiggyBank,
  CalendarClock,
  Pause,
  Play,
  History as HistoryIcon,
  Download,
  Target,
} from "lucide-react";
import { Card, Button, EmptyState, Skeleton } from "../../components/ui";
import { Modal } from "../../components/ui/Modal";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { formatMoney } from "../../lib/format";
import { useUiStore } from "../../app/store";
import { useAuthStore } from "../auth/store";
import { Wallet, Category, Page } from "../finance/types";
import { FinanceIcon } from "../finance/FinanceIcon";
import { useInvalidateFinance, displayDate } from "../finance/api";
import { Budget, Goal, Recurring, Contribution } from "./types";
import {
  useBudgets,
  useGoals,
  useRecurring,
  useCurrentMonth,
  usePlanningQuery,
  downloadCsv,
} from "./api";
import {
  BudgetForm,
  GoalForm,
  ContributionForm,
  RecurringForm,
} from "./PlanningForms";
import { PlanningReports } from "./PlanningReports";
export function Progress({
  value,
  label,
  status = "healthy",
}: {
  value: number;
  label: string;
  status?: string;
}) {
  return (
    <div
      className={`plan-progress ${status}`}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.min(100, Math.max(0, value))}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
function QueryState({
  pending,
  error,
  onRetry,
}: {
  pending: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  return pending ? (
    <Skeleton />
  ) : error ? (
    <Card>
      <p role="alert" className="form-error">
        {errorMessage(error)}
      </p>
      <Button onClick={onRetry}>Thử lại</Button>
    </Card>
  ) : null;
}
export function BudgetPreview({ provided }: { provided?: Budget[] }) {
  const query = useBudgets(undefined, !provided);
  const items = provided ?? query.data?.items ?? [];
  return (
    <Card className="budget-preview">
      <div className="section-heading">
        <div>
          <span className="eyebrow">GIỮ NHỊP CHI TIÊU</span>
          <h2>Ngân sách tháng này</h2>
        </div>
        <Link className="card-link" to="/finance?tab=budgets">
          Quản lý ngân sách
        </Link>
      </div>
      {!provided && query.isPending ? (
        <Skeleton />
      ) : !provided && query.isError ? (
        <p className="muted">
          Chưa tải được tiến độ.{" "}
          <button className="text-button" onClick={() => void query.refetch()}>
            Thử lại
          </button>
        </p>
      ) : items.length ? (
        <div className="budget-preview-grid">
          {items.map((b) => (
            <div key={b.id}>
              <div className="plan-inline">
                <b>{b.categoryName}</b>
                <span>{b.progress}%</span>
              </div>
              <Progress
                value={b.progress}
                label={b.categoryName}
                status={b.status}
              />
              <small>
                {formatMoney(b.spent)} / {formatMoney(b.amount)}
                {b.status === "warning"
                  ? " · Đã dùng từ 80%"
                  : b.status === "exceeded"
                    ? " · Đã chạm/vượt ngân sách"
                    : ""}
              </small>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Chi tiêu có một nhịp riêng">
          Đặt ngân sách theo danh mục để theo dõi mức 80% và nhận thông báo khi
          chạm 100%.
        </EmptyState>
      )}
    </Card>
  );
}
export function PlanningPanel({
  section,
  wallets,
  categories,
}: {
  section: string;
  wallets: Wallet[];
  categories: Category[];
}) {
  return section === "budgets" ? (
    <Budgets categories={categories} />
  ) : section === "goals" ? (
    <Goals />
  ) : section === "recurring" ? (
    <RecurringList wallets={wallets} categories={categories} />
  ) : (
    <PlanningReports />
  );
}
function DeletePlanning({
  path,
  label,
  onClose,
  help,
}: {
  path: string;
  label: string;
  onClose: () => void;
  help: string;
}) {
  const invalidate = useInvalidateFinance(),
    notify = useUiStore((s) => s.notify);
  const mutation = useMutation({
    mutationFn: () => apiClient.delete(path),
    onSuccess: async () => {
      await invalidate();
      onClose();
      notify("Đã cập nhật dữ liệu.");
    },
  });
  return (
    <Modal title={`Xóa ${label}?`} onClose={onClose} busy={mutation.isPending}>
      <p className="settings-description">{help}</p>
      {mutation.error && (
        <p role="alert" className="form-error">
          {errorMessage(mutation.error)}
        </p>
      )}
      <div className="modal-actions">
        <Button
          className="button-outline"
          onClick={onClose}
          disabled={mutation.isPending}
        >
          Hủy
        </Button>
        <Button
          className="button-danger"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Đang xóa…" : "Xác nhận xóa"}
        </Button>
      </div>
    </Modal>
  );
}
function Budgets({ categories }: { categories: Category[] }) {
  const current = useCurrentMonth(),
    [month, setMonth] = useState(current),
    [edit, setEdit] = useState<Budget | true | null>(null),
    [remove, setRemove] = useState<Budget | null>(null);
  const query = useBudgets(month);
  return (
    <>
      <div className="section-heading finance-toolbar">
        <div>
          <h2>Mỗi tháng, một kế hoạch</h2>
          <p className="muted">
            Theo dõi khoản chi thường; chuyển tiền và số dư ban đầu được loại
            trừ.
          </p>
        </div>
        <div className="finance-heading-actions">
          <label className="compact-filter">
            Tháng
            <input
              type="month"
              aria-label="Tháng xem ngân sách"
              value={month}
              onChange={(e) => {
                if (e.target.value) setMonth(e.target.value);
              }}
            />
          </label>
          <Button onClick={() => setEdit(true)}>
            <Plus size={17} />
            Đặt ngân sách
          </Button>
        </div>
      </div>
      <QueryState
        pending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
      {query.data &&
        (query.data.items.length ? (
          <div className="wallet-grid budget-grid">
            {query.data.items.map((b) => (
              <Card key={b.id} className={`budget-card ${b.status}`}>
                <div className="section-heading">
                  <span className="category-symbol expense">
                    <FinanceIcon name={b.categoryIcon} />
                  </span>
                  <div className="row-actions">
                    <button
                      aria-label={`Sửa ngân sách ${b.categoryName}`}
                      onClick={() => setEdit(b)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      aria-label={`Xóa ngân sách ${b.categoryName}`}
                      onClick={() => setRemove(b)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <h2>{b.categoryName}</h2>
                <div className="plan-inline">
                  <strong>{formatMoney(b.spent)}</strong>
                  <span>{b.progress}%</span>
                </div>
                <Progress
                  value={b.progress}
                  label={`Ngân sách ${b.categoryName}`}
                  status={b.status}
                />
                <p className="muted">Giới hạn {formatMoney(b.amount)}</p>
                <p className={`budget-status ${b.status}`}>
                  {b.status === "exceeded"
                    ? b.remaining === 0
                      ? "Đã chạm ngân sách · Còn 0 đ"
                      : `Đã vượt ngân sách · ${formatMoney(-b.remaining)} vượt`
                    : b.status === "warning"
                      ? `Đã dùng từ 80% · Còn ${formatMoney(b.remaining)}`
                      : `Còn ${formatMoney(b.remaining)} để chi`}
                </p>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState title="Bắt đầu một tháng có kế hoạch">
              Bạn chưa đặt ngân sách cho tháng này. Chọn một danh mục chi và số
              tiền phù hợp.
            </EmptyState>
          </Card>
        ))}
      {edit && (
        <BudgetForm
          budget={edit === true ? undefined : edit}
          categories={categories}
          onClose={() => setEdit(null)}
        />
      )}{" "}
      {remove && (
        <DeletePlanning
          path={`/budgets/${remove.id}`}
          label={`ngân sách ${remove.categoryName}`}
          help="Xóa kế hoạch ngân sách này. Lịch sử giao dịch và số dư ví được giữ nguyên."
          onClose={() => setRemove(null)}
        />
      )}
    </>
  );
}
function Goals() {
  const query = useGoals(),
    [edit, setEdit] = useState<Goal | true | null>(null),
    [contribute, setContribute] = useState<Goal | null>(null),
    [history, setHistory] = useState<Goal | null>(null),
    [remove, setRemove] = useState<Goal | null>(null);
  return (
    <>
      <div className="section-heading finance-toolbar">
        <div>
          <h2>Những điều bạn đang dành dụm</h2>
          <p className="muted">
            Ghi nhận tiền để riêng cho mục tiêu; không tự trừ số dư ví.
          </p>
        </div>
        <Button onClick={() => setEdit(true)}>
          <Plus size={17} />
          Tạo mục tiêu
        </Button>
      </div>
      <QueryState
        pending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
      {query.data &&
        (query.data.items.length ? (
          <div className="wallet-grid goal-grid">
            {query.data.items.map((g) => (
              <Card key={g.id} className="goal-card">
                <div className="section-heading">
                  <span
                    className="wallet-symbol"
                    style={{ background: g.color }}
                  >
                    <Target size={23} />
                  </span>
                  <div className="row-actions">
                    <button
                      aria-label={`Sửa mục tiêu ${g.name}`}
                      onClick={() => setEdit(g)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      aria-label={`Xóa mục tiêu ${g.name}`}
                      onClick={() => setRemove(g)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <h2>{g.name}</h2>
                <div className="plan-inline">
                  <strong>{formatMoney(g.savedAmount)}</strong>
                  <span>{g.progress}%</span>
                </div>
                <Progress value={g.progress} label={g.name} />
                <p className="muted">
                  Mục tiêu {formatMoney(g.targetAmount)}
                  {g.deadline
                    ? ` · Hạn ${g.deadline.split("-").reverse().join("/")}`
                    : ""}
                </p>
                {g.progress >= 100 && (
                  <span className="goal-complete">Đã đạt mục tiêu 🌱</span>
                )}
                {g.notes && <p className="goal-note">{g.notes}</p>}
                <div className="goal-actions">
                  <Button onClick={() => setContribute(g)}>
                    <PiggyBank size={17} />
                    Dành dụm
                  </Button>
                  <Button
                    className="button-outline"
                    onClick={() => setHistory(g)}
                  >
                    <HistoryIcon size={16} />
                    Lịch sử
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState title="Gieo một ước muốn nhỏ">
              Chuyến đi, chiếc máy tính hay khoản dự phòng — mỗi mục tiêu bắt
              đầu từ một chút dành dụm.
            </EmptyState>
          </Card>
        ))}
      {edit && (
        <GoalForm
          goal={edit === true ? undefined : edit}
          onClose={() => setEdit(null)}
        />
      )}{" "}
      {contribute && (
        <ContributionForm
          goal={contribute}
          onClose={() => setContribute(null)}
        />
      )}{" "}
      {history && (
        <ContributionHistory goal={history} onClose={() => setHistory(null)} />
      )}{" "}
      {remove && (
        <DeletePlanning
          path={`/goals/${remove.id}`}
          label={`mục tiêu ${remove.name}`}
          help="Mục tiêu sẽ được lưu vào dữ liệu đã xóa, giữ lịch sử dành dụm. Số dư ví không thay đổi."
          onClose={() => setRemove(null)}
        />
      )}
    </>
  );
}
function ContributionHistory({
  goal,
  onClose,
}: {
  goal: Goal;
  onClose: () => void;
}) {
  const zone = useAuthStore((s) => s.user!.timezone),
    [page, setPage] = useState(1),
    [undo, setUndo] = useState<Contribution | null>(null);
  const query = usePlanningQuery<Page<Contribution>>(
    `goal-history-${goal.id}`,
    `/goals/${goal.id}/contributions`,
    { page, limit: 20 },
  );
  const invalidate = useInvalidateFinance();
  const mutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/goals/${goal.id}/contributions/${id}`),
    onSuccess: async () => {
      setUndo(null);
      setPage(1);
      await invalidate();
    },
  });
  return (
    <Modal
      title={`Lịch sử · ${goal.name}`}
      onClose={onClose}
      busy={mutation.isPending}
    >
      <QueryState
        pending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
      {query.data &&
        (query.data.items.length ? (
          <>
            <div className="contribution-list">
              {query.data.items.map((c) => (
                <div key={c.id}>
                  <div>
                    <b>{formatMoney(c.amount)}</b>
                    <small>
                      {displayDate(c.date, zone)}
                      {c.notes ? ` · ${c.notes}` : ""}
                    </small>
                  </div>
                  <button
                    className="text-button"
                    disabled={mutation.isPending}
                    onClick={() => setUndo(c)}
                  >
                    Hoàn tác
                  </button>
                </div>
              ))}
            </div>
            <div className="history-pagination">
              <span>{query.data.total} lần ghi</span>
              <Button
                className="button-outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Trước
              </Button>
              <Button
                className="button-outline"
                disabled={page * 20 >= query.data!.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Sau
              </Button>
            </div>
          </>
        ) : (
          <EmptyState title="Chưa có lần dành dụm nào">
            Ghi nhận khoản tiền đầu tiên để theo dõi hành trình.
          </EmptyState>
        ))}
      {undo && (
        <div className="inline-confirm">
          <p>
            Hoàn tác lần dành dụm {formatMoney(undo.amount)}? Tiến độ sẽ giảm
            tương ứng.
          </p>
          <Button
            className="button-outline"
            disabled={mutation.isPending}
            onClick={() => setUndo(null)}
          >
            Hủy
          </Button>
          <Button
            className="button-danger"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(undo.id)}
          >
            Xác nhận hoàn tác
          </Button>
        </div>
      )}
      {mutation.error && (
        <p role="alert" className="form-error">
          {errorMessage(mutation.error)}
        </p>
      )}
    </Modal>
  );
}
function RecurringList({
  wallets,
  categories,
}: {
  wallets: Wallet[];
  categories: Category[];
}) {
  const query = useRecurring(),
    [edit, setEdit] = useState<Recurring | true | null>(null),
    [remove, setRemove] = useState<Recurring | null>(null);
  const invalidate = useInvalidateFinance(),
    notify = useUiStore((s) => s.notify);
  const mutation = useMutation({
    mutationFn: ({ r, run }: { r: Recurring; run: boolean }) =>
      run
        ? apiClient.post<{ created: number; error: string | null }>(
            `/recurring/${r.id}/run`,
            {},
          )
        : apiClient.put(`/recurring/${r.id}`, { enabled: !r.enabled }),
    onSuccess: async (response, variables) => {
      await invalidate();
      notify(
        variables.run
          ? (response.data.error ??
              `Đã ghi ${response.data.created} kỳ đến hạn.`)
          : "Đã cập nhật lịch định kỳ.",
      );
    },
  });
  return (
    <>
      <div className="section-heading finance-toolbar">
        <div>
          <h2>Những khoản tiền đều đặn</h2>
          <p className="muted">
            Tự ghi theo tuần hoặc tháng khi máy chủ hoạt động; mỗi kỳ chỉ một
            lần.
          </p>
        </div>
        <Button
          disabled={!wallets.some((w) => !w.archived)}
          onClick={() => setEdit(true)}
        >
          <Plus size={17} />
          Tạo lịch định kỳ
        </Button>
      </div>
      <QueryState
        pending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
      {mutation.error && (
        <p role="alert" className="form-error">
          {errorMessage(mutation.error)}
        </p>
      )}
      {query.data &&
        (query.data.items.length ? (
          <div className="recurring-grid">
            {query.data.items.map((r) => (
              <Card key={r.id} className="recurring-card">
                <div className="section-heading">
                  <span className={`category-symbol ${r.type}`}>
                    <CalendarClock size={21} />
                  </span>
                  <span className={`subtle-chip ${r.enabled ? "" : "paused"}`}>
                    {r.enabled ? "Đang bật" : "Tạm dừng"}
                  </span>
                </div>
                <h2>{r.description}</h2>
                <strong
                  className={
                    r.type === "income" ? "income-text" : "expense-text"
                  }
                >
                  {r.type === "income" ? "+" : "−"}
                  {formatMoney(r.amount)}
                </strong>
                <p className="muted">
                  {wallets.find((w) => w.id === r.walletId)?.name ?? "Ví"} ·{" "}
                  {categories.find((c) => c.id === r.categoryId)?.name ??
                    "Danh mục"}
                </p>
                <p>
                  {r.frequency === "monthly" ? "Hằng tháng" : "Hằng tuần"} · Kỳ
                  tiếp theo {r.nextDate.split("-").reverse().join("/")}
                </p>
                {r.endDate && (
                  <small>
                    Kết thúc {r.endDate.split("-").reverse().join("/")}
                  </small>
                )}
                {r.lastError && (
                  <p className="form-error" role="alert">
                    {r.lastError}
                  </p>
                )}
                <div className="wallet-card-actions">
                  <button
                    aria-label={`Sửa lịch ${r.description}`}
                    onClick={() => setEdit(r)}
                  >
                    <Pencil size={15} />
                    Sửa
                  </button>
                  <button
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate({ r, run: false })}
                  >
                    {r.enabled ? <Pause size={15} /> : <Play size={15} />}{" "}
                    {r.enabled ? "Tạm dừng" : "Bật lại"}
                  </button>
                  <button
                    disabled={mutation.isPending || !r.enabled}
                    onClick={() => mutation.mutate({ r, run: true })}
                  >
                    <CalendarClock size={15} />
                    Chạy kỳ đến hạn
                  </button>
                  <button
                    aria-label={`Xóa lịch ${r.description}`}
                    onClick={() => setRemove(r)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState title="Để các khoản đều đặn được nhớ">
              Tạo lịch lương, tiền nhà hoặc hóa đơn. Cần ít nhất một ví đang
              hoạt động để bắt đầu.
            </EmptyState>
          </Card>
        ))}
      <p className="finance-footnote">
        Ngày 29–31 sẽ dùng ngày cuối tháng nếu tháng ngắn hơn, rồi trở lại ngày
        gốc ở tháng sau. Kỳ thiếu tiền được giữ để bạn nạp thêm và thử lại. Tạm
        dừng không xóa giao dịch đã ghi.
      </p>
      {edit && (
        <RecurringForm
          recurring={edit === true ? undefined : edit}
          wallets={wallets}
          categories={categories}
          onClose={() => setEdit(null)}
        />
      )}{" "}
      {remove && (
        <DeletePlanning
          path={`/recurring/${remove.id}`}
          label={`lịch ${remove.description}`}
          help="Dừng và xóa lịch này. Những giao dịch đã sinh và số dư ví được giữ nguyên."
          onClose={() => setRemove(null)}
        />
      )}
    </>
  );
}
export function ExportHistoryButton({
  filters,
}: {
  filters: Record<string, string>;
}) {
  const notify = useUiStore((s) => s.notify);
  const mutation = useMutation({
    mutationFn: () =>
      downloadCsv(
        Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      ),
    onSuccess: () => notify("Đã xuất CSV theo bộ lọc hiện tại."),
  });
  return (
    <div>
      <Button
        className="button-outline"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        <Download size={16} />
        {mutation.isPending ? "Đang xuất…" : "Xuất CSV"}
      </Button>
      {mutation.error && (
        <p role="alert" className="form-error">
          {errorMessage(mutation.error)}
        </p>
      )}
    </div>
  );
}
