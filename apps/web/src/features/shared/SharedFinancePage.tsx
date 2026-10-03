import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Wallet,
  HeartHandshake,
  Plus,
  ArrowRight,
  PiggyBank,
} from "lucide-react";
import { Card, Button, EmptyState, Skeleton } from "../../components/ui";
import { Modal } from "../../components/ui/Modal";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { useAuthStore } from "../auth/store";
import { displayDate } from "../finance/api";
import { Category } from "../finance/types";
import { useSharedQuery, useSharedMutation } from "./api";
import { SharedForm, Dialog } from "./SharedForm";
import {
  SharedFunds,
  SharedDashboard,
  SharedPage,
  SharedTransaction,
  Settlement,
  Contribution,
  SharedGoal,
} from "./types";
const money = (v: number) => v.toLocaleString("vi-VN") + " đ";
function Debt({ summary }: { summary: SharedDashboard["summary"] }) {
  return (
    <>
      <b>
        {summary.amount
          ? `${summary.fromName} nợ ${summary.toName} ${money(summary.amount)}`
          : "Đã cân bằng"}
      </b>
      <p className="settings-description">
        {summary.outstandingCount} khoản chưa hoàn tất ·{" "}
        {summary.pendingConfirmation} chờ xác nhận. Số ròng chỉ để tổng hợp;
        từng khoản vẫn cần xử lý riêng.
      </p>
    </>
  );
}
function ErrorBox({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <Card>
      <p className="form-error" role="alert">
        {errorMessage(error)}
      </p>
      <Button onClick={retry}>Thử lại</Button>
    </Card>
  );
}
export function SharedFinancePage() {
  const [params] = useSearchParams(),
    coupleId = params.get("coupleId") ?? undefined;
  const funds = useSharedQuery<SharedFunds>(
    "/shared-wallets",
    coupleId ? { coupleId } : {},
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CÙNG NHAU VUN ĐẮP</span>
          <h1>Tài chính chung</h1>
          <p>Quỹ rõ ràng, chia sẻ nhẹ nhàng, cùng hướng về những mục tiêu.</p>
        </div>
        <Link className="button button-outline" to="/couple">
          Không gian chung
        </Link>
      </div>
      {funds.isPending ? (
        <Skeleton />
      ) : funds.isError ? (
        <>
          <ErrorBox error={funds.error} retry={() => void funds.refetch()} />
          <Link className="card-link" to="/couple">
            Tạo hoặc tham gia không gian chung <ArrowRight size={16} />
          </Link>
        </>
      ) : (
        <SharedContent key={funds.data.coupleId} funds={funds.data} />
      )}
    </>
  );
}
function SharedContent({ funds }: { funds: SharedFunds }) {
  const [tab, setTab] = useState("funds"),
    [dialog, setDialog] = useState<Dialog | null>(null),
    [history, setHistory] = useState<{
      kind: "wallet" | "goal";
      id: string;
      name: string;
    } | null>(null);
  const params: Record<string, string> = funds.readOnly
    ? { coupleId: funds.coupleId }
    : {};
  const dash = useSharedQuery<SharedDashboard>("/shared/dashboard", params);
  const cats = useSharedQuery<{ items: Category[] }>("/categories", {
    limit: 100,
    type: "expense",
  });
  const user = useAuthStore((s) => s.user)!;
  const archive = useSharedMutation(
    async (raw) => {
      const w = raw as SharedFunds["items"][number];
      return apiClient.put("/shared-wallets/" + w.id, {
        archived: !w.archived,
      });
    },
    () => {},
    "Đã cập nhật trạng thái quỹ.",
  );
  const action = (
    path: string,
    method: "put" | "delete",
    title: string,
    message: string,
    settlement?: Settlement,
  ) => setDialog({ kind: "action", path, method, title, message, settlement });
  return (
    <>
      {funds.readOnly && (
        <div className="account-note">
          <HeartHandshake size={20} />
          <span>
            Hành trình đã lưu trữ. Quỹ, chi tiêu, công nợ và mục tiêu chỉ đọc.
          </span>
        </div>
      )}
      {dash.isPending ? (
        <Skeleton />
      ) : dash.isError ? (
        <ErrorBox error={dash.error} retry={() => void dash.refetch()} />
      ) : (
        <>
          <div className="shared-stats">
            <Card>
              <span>Tổng số dư quỹ</span>
              <h2>{money(dash.data.totalBalance)}</h2>
              <Wallet size={24} />
            </Card>
            <Card>
              <span>
                Chi chung tháng {dash.data.month.split("-").reverse().join("/")}
              </span>
              <h2>{money(dash.data.monthExpense)}</h2>
              <small>Gồm chi quỹ và tiền ứng cá nhân</small>
            </Card>
            <Card className="shared-debt">
              <span>Công nợ ròng</span>
              <Debt summary={dash.data.summary} />
            </Card>
          </div>
          {dash.data.categories.length > 0 && (
            <Card>
              <h2>Chi chung theo danh mục</h2>
              <div className="shared-category-list">
                {dash.data.categories.map((c) => (
                  <div key={c.categoryId}>
                    <span>{c.name}</span>
                    <b>{money(c.amount)}</b>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
      <div className="finance-tabs" role="tablist" aria-label="Tài chính chung">
        {[
          ["funds", "Quỹ chung"],
          ["transactions", "Sổ chi chung"],
          ["settlements", "Công nợ"],
          ["goals", "Mục tiêu chung"],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            className={tab === id ? "active" : ""}
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "funds" && (
        <>
          <div className="section-heading">
            <h2>Những quỹ của chúng mình</h2>
            {!funds.readOnly && (
              <Button onClick={() => setDialog({ kind: "wallet" })}>
                <Plus size={16} />
                Tạo quỹ
              </Button>
            )}
          </div>
          {archive.error && (
            <p className="form-error" role="alert">
              {errorMessage(archive.error)}
            </p>
          )}
          {funds.items.length ? (
            <div className="shared-fund-grid">
              {funds.items.map((w) => (
                <Card key={w.id}>
                  <span className="eyebrow">
                    {w.archived ? "ĐÃ LƯU TRỮ" : "QUỸ CHUNG"}
                  </span>
                  <h2>{w.name}</h2>
                  <strong className="shared-balance">{money(w.balance)}</strong>
                  <div className="shared-actions">
                    <Button
                      className="button-outline"
                      onClick={() =>
                        setHistory({ kind: "wallet", id: w.id, name: w.name })
                      }
                    >
                      Lịch sử nạp
                    </Button>
                    {!funds.readOnly && (
                      <>
                        <Button
                          disabled={w.archived}
                          onClick={() =>
                            setDialog({ kind: "deposit", wallet: w })
                          }
                        >
                          Nạp quỹ
                        </Button>
                        <Button
                          className="button-outline"
                          onClick={() =>
                            setDialog({ kind: "wallet", wallet: w })
                          }
                        >
                          Sửa tên
                        </Button>
                        <Button
                          className="button-outline"
                          disabled={archive.isPending}
                          onClick={() => archive.mutate(w)}
                        >
                          {w.archived ? "Mở lại" : "Lưu trữ"}
                        </Button>
                        <Button
                          className="button-outline"
                          onClick={() =>
                            action(
                              "/shared-wallets/" + w.id,
                              "delete",
                              "Xóa quỹ",
                              "Chỉ quỹ chưa có lịch sử mới xóa được. Quỹ có lịch sử cần lưu trữ.",
                            )
                          }
                        >
                          Xóa quỹ
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState title="Một quỹ cho những điều chung">
                Tạo quỹ sinh hoạt hoặc du lịch, rồi ghi nhận khoản tiền hai
                người đã nạp.
              </EmptyState>
            </Card>
          )}
        </>
      )}
      {tab === "transactions" && (
        <Transactions
          funds={funds}
          params={params}
          onAdd={() => setDialog({ kind: "expense" })}
          onDelete={(id) =>
            action(
              "/shared-transactions/" + id,
              "delete",
              "Xóa khoản chi chung",
              "Khoản chi từ quỹ được hoàn lại số dư. Công nợ chưa trả được thu hồi; khoản đã trả hoặc chờ xác nhận sẽ bị chặn.",
            )
          }
        />
      )}
      {tab === "settlements" && (
        <Settlements
          params={params}
          readOnly={funds.readOnly}
          onAction={action}
        />
      )}
      {tab === "goals" &&
        (dash.data ? (
          <>
            <div className="section-heading">
              <h2>Cùng hướng về một mục tiêu</h2>
              {!funds.readOnly && (
                <Button onClick={() => setDialog({ kind: "goal" })}>
                  <PiggyBank size={18} />
                  Tạo mục tiêu
                </Button>
              )}
            </div>
            {dash.data.goals.length ? (
              <div className="shared-fund-grid">
                {dash.data.goals.map((g) => (
                  <GoalCard
                    key={g.id}
                    goal={g}
                    readOnly={funds.readOnly}
                    onHistory={() =>
                      setHistory({ kind: "goal", id: g.id, name: g.name })
                    }
                    onEdit={() => setDialog({ kind: "goal", goal: g })}
                    onDeposit={() =>
                      setDialog({ kind: "goal-deposit", goal: g })
                    }
                    onDelete={() =>
                      action(
                        "/shared-goals/" + g.id,
                        "delete",
                        "Xóa mục tiêu chung",
                        "Mục tiêu sẽ được ẩn khỏi danh sách. Lịch sử vẫn được giữ; thao tác không thay đổi tiền quỹ.",
                      )
                    }
                  />
                ))}
              </div>
            ) : (
              <Card>
                <EmptyState title="Một mục tiêu để cùng cố gắng">
                  Ghi nhận khoản tiền hai người đã dành riêng; không tự trừ quỹ.
                </EmptyState>
              </Card>
            )}
          </>
        ) : (
          <Skeleton />
        ))}
      {dialog && (
        <SharedForm
          dialog={dialog}
          wallets={funds.items}
          members={funds.members.filter((m) => m.active)}
          categories={(cats.data?.items ?? []).filter((c) => c.isSystem)}
          onClose={() => setDialog(null)}
        />
      )}
      {history && (
        <HistoryModal
          history={history}
          params={params}
          readOnly={funds.readOnly}
          owner={funds.role === "owner"}
          userId={user.id}
          onClose={() => setHistory(null)}
          onUndo={(id) => {
            const path = `/shared-goals/${history.id}/contributions/${id}`;
            setHistory(null);
            action(
              path,
              "delete",
              "Hoàn tác tiền dành dụm",
              "Số tiền sẽ được trừ khỏi tiến độ mục tiêu. Quỹ và ví không đổi.",
            );
          }}
        />
      )}
    </>
  );
}
function GoalCard({
  goal: g,
  readOnly,
  onHistory,
  onEdit,
  onDeposit,
  onDelete,
}: {
  goal: SharedGoal;
  readOnly: boolean;
  onHistory: () => void;
  onEdit: () => void;
  onDeposit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card>
      <h2>{g.name}</h2>
      <p>
        {money(g.savedAmount)} / {money(g.targetAmount)}
      </p>
      <progress
        max={100}
        value={Math.min(100, g.progress)}
        aria-label={"Tiến độ " + g.name}
      />
      <p>
        {g.progress}%
        {g.deadline
          ? " · Hạn " + g.deadline.split("-").reverse().join("/")
          : ""}
      </p>
      {g.notes && <p>{g.notes}</p>}
      <div className="shared-actions">
        <Button className="button-outline" onClick={onHistory}>
          Lịch sử dành dụm
        </Button>
        {!readOnly && (
          <>
            <Button onClick={onDeposit}>Dành dụm</Button>
            <Button className="button-outline" onClick={onEdit}>
              Sửa
            </Button>
            <Button className="button-outline" onClick={onDelete}>
              Xóa
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
function Pager({
  page,
  total,
  setPage,
}: {
  page: number;
  total: number;
  setPage: (p: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {total} dòng · Trang {page}
      </span>
      <Button
        className="button-outline"
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
      >
        Trước
      </Button>
      <Button
        className="button-outline"
        disabled={page * 20 >= total}
        onClick={() => setPage(page + 1)}
      >
        Sau
      </Button>
    </div>
  );
}
function Transactions({
  funds,
  params,
  onAdd,
  onDelete,
}: {
  funds: SharedFunds;
  params: Record<string, string>;
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  const user = useAuthStore((s) => s.user)!;
  const [page, setPage] = useState(1),
    [filters, setFilters] = useState({ from: "", to: "", sharedWalletId: "" }),
    [detail, setDetail] = useState<SharedTransaction | null>(null);
  const q = useSharedQuery<SharedPage<SharedTransaction>>(
    "/shared-transactions",
    {
      ...params,
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      page,
      limit: 20,
    },
  );
  useEffect(() => {
    if (q.data && page > Math.max(1, Math.ceil(q.data.total / 20)))
      setPage(Math.max(1, Math.ceil(q.data.total / 20)));
  }, [q.data, page]);
  const change = (key: keyof typeof filters, v: string) => {
    setPage(1);
    setFilters({ ...filters, [key]: v });
  };
  return (
    <>
      <div className="section-heading">
        <h2>Sổ chi chung</h2>
        {!funds.readOnly && (
          <Button
            disabled={
              funds.members.filter((m) => m.active).length !== 2 ||
              !funds.items.some((w) => !w.archived)
            }
            onClick={onAdd}
          >
            <Plus size={16} />
            Ghi khoản chi
          </Button>
        )}
      </div>
      {!funds.readOnly &&
        funds.members.filter((m) => m.active).length !== 2 && (
          <p>Cần đủ hai thành viên để chia khoản chi.</p>
        )}
      <Card>
        <div className="history-filters">
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
            Quỹ
            <select
              value={filters.sharedWalletId}
              onChange={(e) => change("sharedWalletId", e.target.value)}
            >
              <option value="">Tất cả quỹ</option>
              {funds.items.map((w) => (
                <option value={w.id} key={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>
      {q.isPending ? (
        <Skeleton />
      ) : q.isError ? (
        <ErrorBox error={q.error} retry={() => void q.refetch()} />
      ) : (
        <Card>
          {q.data.items.length ? (
            <div className="shared-records">
              {q.data.items.map((t) => (
                <article key={t.id}>
                  <div>
                    <b>{t.description}</b>
                    <p>
                      {t.walletName} · {t.categoryName} ·{" "}
                      {displayDate(t.date, user.timezone)}
                    </p>
                    <small>
                      {t.payerName} ·{" "}
                      {t.paidFrom === "fund" ? "Trả từ quỹ" : "Ứng cá nhân"}
                    </small>
                  </div>
                  <div>
                    <b>{money(t.amount)}</b>
                    <div className="shared-actions">
                      <Button
                        className="button-outline"
                        onClick={() => setDetail(t)}
                      >
                        Phần chia
                      </Button>
                      {!funds.readOnly &&
                        (t.createdBy === user.id || funds.role === "owner") && (
                          <Button
                            className="button-outline"
                            onClick={() => onDelete(t.id)}
                          >
                            Xóa
                          </Button>
                        )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Chưa có khoản chi trong bộ lọc">
              Mỗi khoản chi sẽ ghi rõ nguồn tiền và phần của từng người.
            </EmptyState>
          )}
          <Pager page={page} total={q.data.total} setPage={setPage} />
        </Card>
      )}
      {detail && (
        <Modal title={detail.description} onClose={() => setDetail(null)}>
          <p>
            {detail.paidFrom === "fund"
              ? "Quỹ thanh toán — không tạo công nợ."
              : "Người trả ứng tiền cá nhân — phần của người kia là công nợ."}
          </p>
          {detail.splits.map((s) => (
            <p key={s.userId}>
              <b>{s.name}</b>: {money(s.shareAmount)}
            </p>
          ))}
          <p>Tổng {money(detail.amount)}</p>
          <Button onClick={() => setDetail(null)}>Đóng</Button>
        </Modal>
      )}
    </>
  );
}
function Settlements({
  params,
  readOnly,
  onAction,
}: {
  params: Record<string, string>;
  readOnly: boolean;
  onAction: (
    path: string,
    method: "put" | "delete",
    title: string,
    message: string,
    row?: Settlement,
  ) => void;
}) {
  const user = useAuthStore((s) => s.user)!;
  const [page, setPage] = useState(1),
    [filters, setFilters] = useState({ status: "", from: "", to: "" });
  const q = useSharedQuery<SharedPage<Settlement>>("/settlements", {
    ...params,
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    page,
    limit: 20,
  });
  useEffect(() => {
    if (q.data && page > Math.max(1, Math.ceil(q.data.total / 20)))
      setPage(Math.max(1, Math.ceil(q.data.total / 20)));
  }, [q.data, page]);
  const change = (k: keyof typeof filters, v: string) => {
    setPage(1);
    setFilters({ ...filters, [k]: v });
  };
  return (
    <>
      <h2>Công nợ & hoàn tiền</h2>
      <p className="settings-description">
        Chuyển tiền ngoài ứng dụng rồi báo đã trả. Chỉ người nhận được xác nhận.
        Đây là sổ ghi nhận, không thực hiện chuyển tiền.
      </p>
      <Card>
        <div className="history-filters">
          <label>
            Trạng thái
            <select
              value={filters.status}
              onChange={(e) => change("status", e.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="pending">Chưa thanh toán</option>
              <option value="pending_confirm">Chờ xác nhận</option>
              <option value="paid">Đã thanh toán</option>
            </select>
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
        </div>
      </Card>
      {q.isPending ? (
        <Skeleton />
      ) : q.isError ? (
        <ErrorBox error={q.error} retry={() => void q.refetch()} />
      ) : (
        <Card>
          {q.data.items.length ? (
            <div className="shared-records">
              {q.data.items.map((row) => (
                <article key={row.id}>
                  <div>
                    <b>
                      {row.fromName} → {row.toName}
                    </b>
                    <p>
                      {row.status === "paid"
                        ? "Đã thanh toán"
                        : row.status === "pending_confirm"
                          ? "Chờ người nhận xác nhận"
                          : "Chưa thanh toán"}{" "}
                      · {displayDate(row.createdAt, user.timezone)}
                    </p>
                    {row.notes && <p>Ghi chú: {row.notes}</p>}
                    {row.paidAt && (
                      <small>
                        Đã xác nhận {displayDate(row.paidAt, user.timezone)}
                      </small>
                    )}
                  </div>
                  <div>
                    <b>{money(row.amount)}</b>
                    {!readOnly && (
                      <div className="shared-actions">
                        {row.status === "pending" &&
                          row.fromUserId === user.id && (
                            <Button
                              onClick={() =>
                                onAction(
                                  `/settlements/${row.id}/mark-paid`,
                                  "put",
                                  "Báo đã hoàn tiền",
                                  "Chỉ xác nhận nếu bạn đã chuyển khoản tiền này ngoài ứng dụng. Người nhận sẽ kiểm tra và xác nhận.",
                                  row,
                                )
                              }
                            >
                              Tôi đã trả
                            </Button>
                          )}
                        {row.status === "pending_confirm" &&
                          row.toUserId === user.id && (
                            <>
                              <Button
                                onClick={() =>
                                  onAction(
                                    `/settlements/${row.id}/confirm`,
                                    "put",
                                    "Xác nhận đã nhận tiền",
                                    "Chỉ xác nhận nếu bạn đã nhận đủ tiền ngoài ứng dụng. Khoản này sẽ vào lịch sử thanh toán.",
                                    row,
                                  )
                                }
                              >
                                Đã nhận tiền
                              </Button>
                              <Button
                                className="button-outline"
                                onClick={() =>
                                  onAction(
                                    `/settlements/${row.id}/reject`,
                                    "put",
                                    "Từ chối xác nhận",
                                    "Khoản nợ trở lại chưa thanh toán. Bạn có thể ghi lý do để người kia kiểm tra.",
                                    row,
                                  )
                                }
                              >
                                Từ chối
                              </Button>
                            </>
                          )}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Không có khoản công nợ trong bộ lọc">
              Khoản chi từ quỹ không sinh công nợ.
            </EmptyState>
          )}
          <Pager page={page} total={q.data.total} setPage={setPage} />
        </Card>
      )}
    </>
  );
}
function HistoryModal({
  history,
  params,
  readOnly,
  owner,
  userId,
  onClose,
  onUndo,
}: {
  history: { kind: "wallet" | "goal"; id: string; name: string };
  params: Record<string, string>;
  readOnly: boolean;
  owner: boolean;
  userId: string;
  onClose: () => void;
  onUndo: (id: string) => void;
}) {
  const [page, setPage] = useState(1);
  const q = useSharedQuery<SharedPage<Contribution>>(
    `/${history.kind === "wallet" ? "shared-wallets" : "shared-goals"}/${history.id}/contributions`,
    { ...params, page, limit: 20 },
  );
  return (
    <Modal title={"Lịch sử " + history.name} onClose={onClose}>
      {q.isPending ? (
        <Skeleton />
      ) : q.isError ? (
        <p role="alert">{errorMessage(q.error)}</p>
      ) : (
        <>
          {q.data.items.length ? (
            q.data.items.map((r) => (
              <div className="shared-history-row" key={r.id}>
                <b>
                  {r.actorName} · {money(r.amount)}
                </b>
                <p>
                  {displayDate(r.date, useAuthStore.getState().user!.timezone)}
                  {r.notes ? " · " + r.notes : ""}
                </p>
                {history.kind === "goal" &&
                  !readOnly &&
                  (owner || r.userId === userId) && (
                    <Button
                      className="button-outline"
                      onClick={() => onUndo(r.id)}
                    >
                      Hoàn tác
                    </Button>
                  )}
              </div>
            ))
          ) : (
            <p>Chưa có khoản đóng góp.</p>
          )}
          <Pager page={page} total={q.data.total} setPage={setPage} />
        </>
      )}
      <Button className="button-outline" onClick={onClose}>
        Đóng
      </Button>
    </Modal>
  );
}
export function SharedPreview() {
  const user = useAuthStore((s) => s.user);
  return user?.coupleId ? <ActivePreview /> : null;
}
function ActivePreview() {
  const q = useSharedQuery<SharedDashboard>("/shared/dashboard");
  return (
    <Card>
      <div className="section-heading">
        <h2>Tài chính chung</h2>
        <HeartHandshake size={24} />
      </div>
      {q.isPending ? (
        <Skeleton />
      ) : q.isError ? (
        <p role="alert">{errorMessage(q.error)}</p>
      ) : (
        <>
          <p>
            Số dư quỹ: <b>{money(q.data.totalBalance)}</b>
          </p>
          <Debt summary={q.data.summary} />
        </>
      )}
      <Link className="card-link" to="/shared">
        Mở quỹ và công nợ <ArrowRight size={16} />
      </Link>
    </Card>
  );
}
