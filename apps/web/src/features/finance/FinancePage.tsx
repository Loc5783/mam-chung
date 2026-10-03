import { FinanceIcon } from "./FinanceIcon";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Plus,
  ArrowLeftRight,
  Pencil,
  Trash2,
  Copy,
  Archive,
  ArchiveRestore,
  ShieldCheck,
  Search,
} from "lucide-react";
import { Card, Button, EmptyState, Skeleton } from "../../components/ui";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { formatMoney } from "../../lib/format";
import { useUiStore } from "../../app/store";
import { useAuthStore } from "../auth/store";
import { FinanceOverview } from "./FinanceOverview";
import {
  WalletForm,
  TransactionForm,
  CategoryForm,
  TransferForm,
} from "./FinanceForms";
import { DeleteDialog, ReconcileDialog } from "./FinanceActions";
import { useFinanceOptions, useInvalidateFinance, displayDate } from "./api";
import { Dialog, History, Wallet, Category } from "./types";
const tabs = [
  ["overview", "Tổng quan"],
  ["wallets", "Ví của tôi"],
  ["transactions", "Thu & chi"],
  ["categories", "Danh mục"],
] as const;
const walletTypes = {
  cash: "Tiền mặt",
  bank: "Ngân hàng",
  ewallet: "Ví điện tử",
};
export function FinancePage() {
  const [params, setParams] = useSearchParams();
  const tab = tabs.some(([key]) => key === params.get("tab"))
    ? params.get("tab")!
    : "overview";
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const { wallets, categories } = useFinanceOptions();
  const allWallets = wallets.data ?? [],
    allCategories = categories.data ?? [];
  const active = allWallets.filter((w) => !w.archived);
  const close = () => setDialog(null);
  const setTab = (value: string) => setParams({ tab: value });
  useEffect(() => {
    if (
      params.get("add") === "1" &&
      wallets.isSuccess &&
      categories.isSuccess
    ) {
      setDialog(
        tab === "wallets"
          ? { kind: "wallet" }
          : active.length
            ? { kind: "entry" }
            : { kind: "wallet" },
      );
      setParams({ tab }, { replace: true });
    }
  }, [
    params,
    tab,
    wallets.isSuccess,
    categories.isSuccess,
    active.length,
    setParams,
  ]);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">TỪNG ĐỒNG NHỎ, MỘT TƯƠNG LAI LỚN</span>
          <h1>Tài chính cá nhân</h1>
          <p>Hiểu tiền của mình, chăm chút những điều quan trọng.</p>
        </div>
        <div className="finance-heading-actions">
          <Button
            className="button-outline"
            disabled={active.length < 2}
            onClick={() => setDialog({ kind: "transfer" })}
          >
            <ArrowLeftRight size={17} />
            Chuyển tiền
          </Button>
          <Button
            disabled={!wallets.isSuccess || !categories.isSuccess}
            onClick={() =>
              setDialog(active.length ? { kind: "entry" } : { kind: "wallet" })
            }
          >
            <Plus size={18} />
            {active.length ? "Ghi giao dịch" : "Tạo ví đầu tiên"}
          </Button>
        </div>
      </div>
      <div
        className="finance-tabs"
        role="tablist"
        aria-label="Tài chính cá nhân"
      >
        {tabs.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={tabs.find(([key]) => key === tab)?.[1]}>
        {tab === "overview" ? (
          <FinanceOverview
            onAdd={() =>
              setDialog(active.length ? { kind: "entry" } : { kind: "wallet" })
            }
            onWallet={() => setDialog({ kind: "wallet" })}
          />
        ) : wallets.isPending || categories.isPending ? (
          <Skeleton />
        ) : wallets.isError || categories.isError ? (
          <Card>
            <p className="form-error" role="alert">
              Không tải được ví hoặc danh mục.
            </p>
            <Button
              onClick={() => {
                void wallets.refetch();
                void categories.refetch();
              }}
            >
              Thử lại
            </Button>
          </Card>
        ) : tab === "wallets" ? (
          <WalletList wallets={allWallets} onDialog={setDialog} />
        ) : tab === "categories" ? (
          <CategoryList categories={allCategories} onDialog={setDialog} />
        ) : (
          <TransactionHistory
            wallets={allWallets}
            categories={allCategories}
            onDialog={setDialog}
          />
        )}
      </div>
      {dialog?.kind === "wallet" && (
        <WalletForm wallet={dialog.wallet} onClose={close} />
      )}{" "}
      {dialog?.kind === "entry" && (
        <TransactionForm
          entry={dialog.entry}
          wallets={allWallets}
          categories={allCategories}
          onClose={close}
        />
      )}{" "}
      {dialog?.kind === "category" && (
        <CategoryForm category={dialog.category} onClose={close} />
      )}{" "}
      {dialog?.kind === "transfer" && (
        <TransferForm wallets={allWallets} onClose={close} />
      )}{" "}
      {dialog?.kind === "reconcile" && (
        <ReconcileDialog wallet={dialog.wallet} onClose={close} />
      )}{" "}
      {dialog &&
        (dialog.kind === "delete-wallet" ||
          dialog.kind === "delete-category" ||
          dialog.kind === "delete-entry") && (
          <DeleteDialog
            dialog={dialog}
            categories={allCategories}
            onClose={close}
          />
        )}
    </>
  );
}
function WalletList({
  wallets,
  onDialog,
}: {
  wallets: Wallet[];
  onDialog: (dialog: Dialog) => void;
}) {
  const [archived, setArchived] = useState(false);
  const invalidate = useInvalidateFinance(),
    notify = useUiStore((s) => s.notify);
  const mutation = useMutation({
    mutationFn: (wallet: Wallet) =>
      apiClient.put(`/wallets/${wallet.id}`, { archived: !wallet.archived }),
    onSuccess: async () => {
      await invalidate();
      notify("Đã cập nhật trạng thái ví.");
    },
  });
  const visible = wallets.filter((w) => w.archived === archived);
  return (
    <>
      <div className="section-heading finance-toolbar">
        <h2>{archived ? "Ví đã lưu trữ" : "Những chiếc ví của bạn"}</h2>
        <div className="finance-heading-actions">
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            Xem ví lưu trữ
          </label>
          <Button onClick={() => onDialog({ kind: "wallet" })}>
            <Plus size={16} />
            Tạo ví
          </Button>
        </div>
      </div>
      {mutation.error && (
        <p role="alert" className="form-error">
          {errorMessage(mutation.error)}
        </p>
      )}
      {visible.length ? (
        <div className="wallet-grid">
          {visible.map((w) => (
            <Card key={w.id} className="wallet-card">
              <div className="section-heading">
                <span className="wallet-symbol" style={{ background: w.color }}>
                  <FinanceIcon name={w.icon} size={23} />
                </span>
                <span className="wallet-kind">{walletTypes[w.type]}</span>
              </div>
              <h2>{w.name}</h2>
              <p className="wallet-balance">{formatMoney(w.balance)}</p>
              <small>
                {w.allowNegative
                  ? "Cho phép số dư âm"
                  : "Bảo vệ số dư · Không âm"}
              </small>
              <div className="wallet-card-actions">
                <button onClick={() => onDialog({ kind: "wallet", wallet: w })}>
                  <Pencil size={15} />
                  Sửa
                </button>
                <button
                  onClick={() => mutation.mutate(w)}
                  disabled={mutation.isPending}
                >
                  {w.archived ? (
                    <ArchiveRestore size={15} />
                  ) : (
                    <Archive size={15} />
                  )}{" "}
                  {w.archived ? "Khôi phục" : "Lưu trữ"}
                </button>
                <button
                  onClick={() => onDialog({ kind: "reconcile", wallet: w })}
                >
                  <ShieldCheck size={15} />
                  Đối soát
                </button>
                <button
                  aria-label={`Xóa ví ${w.name}`}
                  onClick={() => onDialog({ kind: "delete-wallet", wallet: w })}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            title={archived ? "Chưa có ví lưu trữ" : "Một chiếc ví để bắt đầu"}
          >
            {archived
              ? "Ví lưu trữ giữ nguyên số dư và lịch sử."
              : "Tạo ví tiền mặt, ngân hàng hoặc ví điện tử để ghi lại thu chi."}
          </EmptyState>
        </Card>
      )}
      <p className="finance-footnote">
        Ví lưu trữ vẫn được tính vào tổng số dư. Khôi phục ví để tiếp tục ghi
        hoặc sửa giao dịch.
      </p>
    </>
  );
}
function CategoryList({
  categories,
  onDialog,
}: {
  categories: Category[];
  onDialog: (dialog: Dialog) => void;
}) {
  return (
    <>
      <div className="section-heading finance-toolbar">
        <h2>Danh mục cho mọi khoản tiền</h2>
        <Button onClick={() => onDialog({ kind: "category" })}>
          <Plus size={16} />
          Tạo danh mục
        </Button>
      </div>
      <div className="finance-two-columns">
        {(["expense", "income"] as const).map((type) => (
          <Card key={type}>
            <h2>{type === "expense" ? "Khoản chi" : "Khoản thu"}</h2>
            <div className="category-list">
              {categories
                .filter((c) => c.type === type)
                .map((c) => (
                  <div key={c.id}>
                    <span className={`category-symbol ${type}`}>
                      <FinanceIcon name={c.icon} size={18} />
                    </span>
                    <b>{c.name}</b>
                    {c.isSystem ? (
                      <small>Mặc định</small>
                    ) : (
                      <div className="row-actions">
                        <button
                          aria-label={`Sửa danh mục ${c.name}`}
                          onClick={() =>
                            onDialog({ kind: "category", category: c })
                          }
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          aria-label={`Xóa danh mục ${c.name}`}
                          onClick={() =>
                            onDialog({ kind: "delete-category", category: c })
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </Card>
        ))}
      </div>
      <p className="finance-footnote">
        Danh mục mặc định được giữ nguyên. Danh mục riêng có lịch sử cần danh
        mục thay thế khi xóa.
      </p>
    </>
  );
}
export function TransactionHistory({
  wallets,
  categories,
  onDialog,
}: {
  wallets: Wallet[];
  categories: Category[];
  onDialog: (dialog: Dialog) => void;
}) {
  const user = useAuthStore((s) => s.user)!;
  const [filters, setFilters] = useState({
      from: "",
      to: "",
      walletId: "",
      categoryId: "",
      type: "",
      search: "",
      sort: "date_desc",
    }),
    [page, setPage] = useState(1);
  const invalidate = useInvalidateFinance(),
    notify = useUiStore((s) => s.notify);
  const query = useQuery({
    queryKey: ["finance", user.id, "history", filters, page],
    queryFn: async () =>
      (
        await apiClient.get<History>("/transactions", {
          params: {
            ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
            page,
            limit: 20,
          },
        })
      ).data,
  });
  const duplicate = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/transactions/${id}/duplicate`, {}),
    onSuccess: async () => {
      await invalidate();
      notify("Đã nhân bản giao dịch vào hôm nay và cập nhật số dư.");
    },
  });
  const change = (key: keyof typeof filters, value: string) => {
    setPage(1);
    setFilters({ ...filters, [key]: value });
  };
  const data = query.data;
  return (
    <>
      <Card className="history-filter-card">
        <div className="section-heading">
          <h2>Sổ thu & chi</h2>
          <span className="muted">Tìm lại từng khoản nhỏ</span>
        </div>
        <div className="history-filters">
          <label className="search-field">
            Tìm kiếm
            <div>
              <Search size={17} />
              <input
                value={filters.search}
                onChange={(e) => change("search", e.target.value)}
                placeholder="Mô tả, ghi chú hoặc nhãn"
                maxLength={100}
              />
            </div>
          </label>
          <label>
            Từ ngày
            <input
              type="date"
              value={filters.from}
              onChange={(e) => change("from", e.target.value)}
            />
          </label>
          <label>
            Đến ngày
            <input
              type="date"
              value={filters.to}
              onChange={(e) => change("to", e.target.value)}
            />
          </label>
          <label>
            Ví
            <select
              value={filters.walletId}
              onChange={(e) => change("walletId", e.target.value)}
            >
              <option value="">Tất cả ví</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.archived ? " (lưu trữ)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Danh mục
            <select
              value={filters.categoryId}
              onChange={(e) => change("categoryId", e.target.value)}
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Loại
            <select
              value={filters.type}
              onChange={(e) => change("type", e.target.value)}
            >
              <option value="">Tất cả loại</option>
              <option value="income">Thu</option>
              <option value="expense">Chi</option>
              <option value="transfer">Chuyển tiền</option>
              <option value="opening">Số dư ban đầu</option>
            </select>
          </label>
          <label>
            Sắp xếp
            <select
              value={filters.sort}
              onChange={(e) => change("sort", e.target.value)}
            >
              <option value="date_desc">Mới nhất</option>
              <option value="date_asc">Cũ nhất</option>
              <option value="amount_desc">Số tiền giảm dần</option>
              <option value="amount_asc">Số tiền tăng dần</option>
            </select>
          </label>
          <Button
            className="button-outline"
            onClick={() => {
              setFilters({
                from: "",
                to: "",
                walletId: "",
                categoryId: "",
                type: "",
                search: "",
                sort: "date_desc",
              });
              setPage(1);
            }}
          >
            Xóa bộ lọc
          </Button>
        </div>
      </Card>
      {data && (
        <div className="history-summary">
          <span>
            Thu{" "}
            <b className="income-text">{formatMoney(data.summary.income)}</b>
          </span>
          <span>
            Chi{" "}
            <b className="expense-text">{formatMoney(data.summary.expense)}</b>
          </span>
          <span>
            Chênh lệch <b>{formatMoney(data.summary.net)}</b>
          </span>
          <small>
            Toàn bộ kết quả lọc · Không tính chuyển tiền và số dư ban đầu
          </small>
        </div>
      )}
      {duplicate.error && (
        <p role="alert" className="form-error">
          {errorMessage(duplicate.error)}
        </p>
      )}
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <Card>
          <p role="alert" className="form-error">
            {errorMessage(query.error)}
          </p>
          <Button onClick={() => void query.refetch()}>Thử lại</Button>
        </Card>
      ) : data?.items.length ? (
        <Card className="history-card">
          <div className="table-scroll">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Giao dịch</th>
                  <th>Ví & danh mục</th>
                  <th>Số tiền</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <b>{entry.description}</b>
                      <small>
                        {displayDate(entry.date, user.timezone)}
                        {entry.kind === "transfer"
                          ? " · Chuyển tiền"
                          : entry.kind === "opening"
                            ? " · Số dư ban đầu"
                            : ""}
                      </small>
                      {entry.notes && (
                        <small className="entry-note">{entry.notes}</small>
                      )}
                      {entry.tags.length > 0 && (
                        <div className="entry-tags">
                          {entry.tags.map((tag) => (
                            <span key={tag}>{tag}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <b>{entry.walletName}</b>
                      <small>
                        {entry.categoryName}
                        {entry.walletArchived ? " · Ví lưu trữ" : ""}
                      </small>
                    </td>
                    <td
                      className={
                        entry.type === "income" ? "income-text" : "expense-text"
                      }
                    >
                      {entry.type === "income" ? "+" : "−"}
                      {formatMoney(entry.amount)}
                    </td>
                    <td>
                      <div className="row-actions">
                        {entry.kind === "transaction" &&
                          !entry.walletArchived && (
                            <>
                              <button
                                aria-label={`Sửa ${entry.description}`}
                                onClick={() =>
                                  onDialog({ kind: "entry", entry })
                                }
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                disabled={duplicate.isPending}
                                aria-label={`Nhân bản ${entry.description}`}
                                onClick={() => duplicate.mutate(entry.id)}
                              >
                                <Copy size={16} />
                              </button>
                            </>
                          )}
                        {entry.kind !== "opening" && !entry.walletArchived && (
                          <button
                            aria-label={`Xóa ${entry.description}`}
                            onClick={() =>
                              onDialog({ kind: "delete-entry", entry })
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="history-pagination">
            <span>
              {data.total} dòng · Trang {page}/
              {Math.max(1, Math.ceil(data.total / 20))}
            </span>
            <div>
              <Button
                className="button-outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Trước
              </Button>
              <Button
                className="button-outline"
                disabled={page * 20 >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Sau
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <EmptyState title="Chưa có giao dịch phù hợp">
            Thử thay bộ lọc hoặc ghi khoản thu, chi đầu tiên của bạn.
          </EmptyState>
        </Card>
      )}
      <p className="finance-footnote">
        Nhân bản tạo một giao dịch mới vào hôm nay và thay đổi số dư ví. Mỗi
        khoản chuyển tiền hiển thị hai dòng liên kết.
      </p>
    </>
  );
}
