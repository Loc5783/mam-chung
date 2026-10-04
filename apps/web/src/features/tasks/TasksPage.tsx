import { moveTabFocus } from "../../components/ui/tabs";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, ShoppingBag } from "lucide-react";
import { Card, Button, EmptyState, Skeleton } from "../../components/ui";
import { Modal } from "../../components/ui/Modal";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { localInputDate } from "../finance/api";
import { useAuthStore } from "../auth/store";
import { Task, TaskPage, Members, Status, statuses, priorities } from "./types";
import { useTaskMutation, useTasksQuery } from "./api";
import { TaskForm } from "./TaskForm";
type CommentPage = {
  items: { id: string; authorName: string; text: string; createdAt: string }[];
  total: number;
  readOnly: boolean;
};
function Comments({ task, onClose }: { task: Task; onClose: () => void }) {
  const zone = useAuthStore((s) => s.user!.timezone);
  const [page, setPage] = useState(1),
    [text, setText] = useState("");
  const q = useTasksQuery<CommentPage>(`/tasks/${task.id}/comments`, {
    page,
    limit: 20,
  });
  const add = useTaskMutation(
    async () =>
      apiClient.post(`/tasks/${task.id}/comments`, { text: text.trim() }),
    () => {
      setText("");
      if (q.data) setPage(Math.ceil((q.data.total + 1) / 20));
    },
  );
  return (
    <Modal
      title={`Bình luận · ${task.title}`}
      onClose={onClose}
      busy={add.isPending}
    >
      {q.isPending ? (
        <Skeleton />
      ) : q.isError ? (
        <Error error={q.error} />
      ) : (
        <>
          <div className="task-comments">
            {q.data.items.map((c) => (
              <article key={c.id}>
                <b>{c.authorName}</b>
                <small>
                  {new Date(c.createdAt).toLocaleString("vi-VN", {
                    timeZone: zone,
                  })}
                </small>
                <p>{c.text}</p>
              </article>
            ))}
            {!q.data.total && <p>Chưa có bình luận.</p>}
          </div>
          <Pager
            page={page}
            total={q.data.total}
            onPage={setPage}
            unit="bình luận"
          />
          {!q.data.readOnly && (
            <form
              className="settings-form finance-form task-form"
              onSubmit={(e) => {
                e.preventDefault();
                add.mutate();
              }}
            >
              <label>
                Bình luận ngắn
                <textarea
                  aria-label="Bình luận ngắn"
                  value={text}
                  maxLength={500}
                  disabled={add.isPending}
                  onChange={(e) => setText(e.target.value)}
                />
              </label>
              <Button disabled={!text.trim() || add.isPending}>
                Gửi bình luận
              </Button>
            </form>
          )}
        </>
      )}
      {add.isError && <Error error={add.error} />}
    </Modal>
  );
}
function Error({ error }: { error: unknown }) {
  return (
    <p role="alert" className="form-error">
      {errorMessage(error)}
    </p>
  );
}
function Pager({
  page,
  total,
  onPage,
  unit = "việc",
}: {
  page: number;
  total: number;
  onPage: (n: number) => void;
  unit?: string;
}) {
  return (
    <div className="pagination">
      <span>
        {total} {unit} · Trang {page}
      </span>
      <Button
        className="button-outline"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Trước
      </Button>
      <Button
        className="button-outline"
        disabled={page * 20 >= total}
        onClick={() => onPage(page + 1)}
      >
        Sau
      </Button>
    </div>
  );
}
function TaskCard({
  task,
  members,
  busy,
  onStatus,
  onEdit,
  onComments,
  onDelete,
  onCheck,
}: {
  task: Task;
  members: Members;
  busy: boolean;
  onStatus: (s: Status) => void;
  onEdit: () => void;
  onComments: () => void;
  onDelete: () => void;
  onCheck: (id: string, done: boolean) => void;
}) {
  const user = useAuthStore((s) => s.user)!;
  const today = localInputDate(new Date(), user.timezone);
  const late =
    !!task.deadline &&
    task.deadline < today &&
    !["DONE", "CANCELLED"].includes(task.status);
  return (
    <article className={`task-card ${late ? "task-overdue" : ""}`}>
      <div className="task-meta">
        <span
          className={`task-priority priority-${task.priority.toLowerCase()}`}
        >
          {priorities[task.priority]}
        </span>
        <span>
          {task.coupleId ? "Chung" : "Cá nhân"}{" "}
          {task.kind === "shopping" ? "· Mua sắm" : ""}
        </span>
      </div>
      <h3>{task.title}</h3>
      {task.description && (
        <p className="task-description">{task.description}</p>
      )}
      <div className="task-meta">
        <span>
          {task.deadline
            ? `Hạn ${task.deadline}${late ? " · Quá hạn" : ""}`
            : "Không hạn chót"}
        </span>
        <span>
          {task.assignedTo === user.id
            ? "Giao cho tôi"
            : (members.items.find((m) => m.id === task.assignedTo)?.name ??
              (task.assignedTo ? "Người tạo" : "Chưa giao"))}
        </span>
      </div>
      {task.recurrence !== "none" && (
        <small>
          Lặp{" "}
          {
            (
              {
                daily: "hằng ngày",
                weekly: "hằng tuần",
                monthly: "hằng tháng",
              } as const
            )[task.recurrence]
          }
        </small>
      )}
      {task.labels.length > 0 && (
        <div className="task-labels">
          {task.labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      )}
      {task.checklist.length > 0 && (
        <div className="task-checklist">
          <small>
            {task.checklist.filter((i) => i.done).length}/
            {task.checklist.length}{" "}
            {task.kind === "shopping" ? "món đã mua" : "việc con"}
          </small>
          {task.checklist.map((i) => (
            <label key={i.id} className="checkbox-label">
              <input
                type="checkbox"
                aria-label={`${task.title}: ${i.text}`}
                checked={i.done}
                disabled={task.readOnly || busy}
                onChange={(e) => onCheck(i.id, e.target.checked)}
              />
              <span className={i.done ? "task-checked" : ""}>{i.text}</span>
            </label>
          ))}
        </div>
      )}
      {task.completedAt && (
        <small>
          Hoàn thành{" "}
          {new Date(task.completedAt).toLocaleDateString("vi-VN", {
            timeZone: user.timezone,
          })}
        </small>
      )}
      <div className="task-actions">
        <label>
          Trạng thái
          <select
            aria-label={`Trạng thái ${task.title}`}
            disabled={task.readOnly || busy}
            value={task.status}
            onChange={(e) => onStatus(e.target.value as Status)}
          >
            {Object.entries(statuses).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        {!task.readOnly && (
          <>
            <Button className="button-outline" onClick={onEdit} disabled={busy}>
              Sửa
            </Button>
            <Button
              className="button-outline"
              onClick={onDelete}
              disabled={busy}
            >
              Xóa
            </Button>
          </>
        )}
        {task.coupleId && (
          <Button className="button-outline" onClick={onComments}>
            Bình luận
          </Button>
        )}
      </div>
    </article>
  );
}
export function TasksPage() {
  const [params, setParams] = useSearchParams();
  const cid = params.get("coupleId") ?? "";
  const [scope, setScope] = useState("all"),
    [status, setStatus] = useState(""),
    [priority, setPriority] = useState(""),
    [search, setSearch] = useState(""),
    [due, setDue] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [sort, setSort] = useState("deadline"),
    [kind, setKind] = useState(""),
    [label, setLabel] = useState(""),
    [view, setView] = useState("list"),
    [page, setPage] = useState(1),
    [editing, setEditing] = useState<Task | true | null>(null),
    [comments, setComments] = useState<Task | null>(null),
    [removing, setRemoving] = useState<Task | null>(null),
    [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (params.get("add") === "1" && !cid) {
      setEditing(true);
      const next = new URLSearchParams(params);
      next.delete("add");
      setParams(next, { replace: true });
    }
  }, [params, setParams, cid]);
  const user = useAuthStore((s) => s.user)!;
  const context: Record<string, string> = cid ? { coupleId: cid } : {};
  const members = useTasksQuery<Members>("/tasks/members", context);
  const filters = {
    scope,
    status,
    priority,
    search,
    due,
    from,
    to,
    sort,
    kind,
    label,
    ...context,
  };
  const q = useTasksQuery<TaskPage>("/tasks", {
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    page,
    limit: 20,
  });
  useEffect(() => {
    setPage(1);
  }, [scope, status, priority, search, due, from, to, sort, kind, label, cid]);
  useEffect(() => {
    if (q.data && page > Math.max(1, Math.ceil(q.data.total / 20)))
      setPage(Math.max(1, Math.ceil(q.data.total / 20)));
  }, [q.data, page]);
  const write = useTaskMutation(
    async (v: {
      task: Task;
      status?: Status;
      checklist?: Task["checklist"];
    }) =>
      v.status
        ? apiClient.patch(`/tasks/${v.task.id}/status`, {
            status: v.status,
            revision: v.task.revision,
          })
        : apiClient.put("/tasks/" + v.task.id, {
            checklist: v.checklist,
            revision: v.task.revision,
          }),
  );
  const remove = useTaskMutation(
    async () =>
      apiClient.delete("/tasks/" + removing!.id, {
        data: { revision: removing!.revision },
      }),
    () => {
      setRemoving(null);
      setConfirm(false);
    },
  );
  const readOnly = q.data?.readOnly ?? !!cid;
  const render = (task: Task) => (
    <TaskCard
      key={task.id}
      task={task}
      members={members.data ?? { items: [], readOnly: false }}
      busy={write.isPending}
      onStatus={(status) => write.mutate({ task, status })}
      onEdit={() => setEditing(task)}
      onComments={() => setComments(task)}
      onDelete={() => {
        setRemoving(task);
        setConfirm(false);
      }}
      onCheck={(id, done) =>
        write.mutate({
          task,
          checklist: task.checklist.map((i) =>
            i.id === id ? { ...i, done } : i,
          ),
        })
      }
    />
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">TỪNG VIỆC NHỎ, MỖI NGÀY</span>
          <h1>Công việc</h1>
          <p>Giữ việc riêng gọn gàng, cùng nhau hoàn thành việc chung.</p>
        </div>
        {!readOnly && (
          <Button
            onClick={() => setEditing(true)}
            disabled={members.isPending || members.isError}
          >
            <Plus size={18} />
            Thêm công việc
          </Button>
        )}
      </div>
      {readOnly && (
        <p className="couple-archive-note">
          Đang xem công việc của hành trình đã lưu trữ · Chỉ đọc.
        </p>
      )}
      <div className="task-toolbar">
        <div role="tablist" onKeyDown={moveTabFocus} aria-label="Cách xem">
          <button
            role="tab"
            aria-selected={view === "list"}
            tabIndex={view === "list" ? 0 : -1}
            onClick={() => setView("list")}
          >
            Danh sách
          </button>
          <button
            role="tab"
            aria-selected={view === "kanban"}
            tabIndex={view === "kanban" ? 0 : -1}
            onClick={() => setView("kanban")}
          >
            Kanban
          </button>
        </div>
        <Button
          className="button-outline"
          disabled={!user.coupleId && !cid}
          onClick={() => {
            setKind(kind === "shopping" ? "" : "shopping");
            setScope("shared");
          }}
        >
          <ShoppingBag size={17} />
          Mua sắm chung
        </Button>
      </div>
      <Card>
        <div className="history-filters task-filters">
          <label>
            Không gian
            <select
              aria-label="Lọc không gian"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              <option value="all">Tất cả</option>
              <option value="personal" disabled={!!cid}>
                Cá nhân
              </option>
              <option value="shared" disabled={!user.coupleId && !cid}>
                Chung
              </option>
              <option value="mine">Giao cho tôi</option>
            </select>
          </label>
          <label>
            Trạng thái
            <select
              aria-label="Lọc trạng thái"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Tất cả</option>
              {Object.entries(statuses).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ưu tiên
            <select
              aria-label="Lọc ưu tiên"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="">Tất cả</option>
              {Object.entries(priorities).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Hạn chót
            <select
              aria-label="Lọc hạn chót"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="today">Hôm nay</option>
              <option value="overdue">Quá hạn</option>
            </select>
          </label>
          <label>
            Từ ngày
            <input
              type="date"
              aria-label="Từ ngày"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            Đến ngày
            <input
              type="date"
              aria-label="Đến ngày"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label>
            Nhãn
            <input
              aria-label="Lọc nhãn"
              value={label}
              maxLength={30}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label>
            Sắp xếp
            <select
              aria-label="Sắp xếp"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="deadline">Hạn gần nhất</option>
              <option value="priority">Ưu tiên cao nhất</option>
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
            </select>
          </label>
          <label>
            Tìm kiếm
            <input
              aria-label="Tìm công việc"
              placeholder="Tiêu đề, mô tả, nhãn…"
              value={search}
              maxLength={160}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        {kind === "shopping" && (
          <p>
            Đang lọc danh sách mua sắm.{" "}
            <button className="text-button" onClick={() => setKind("")}>
              Bỏ lọc mua sắm
            </button>
          </p>
        )}
      </Card>
      {members.isError && <Error error={members.error} />}{" "}
      {write.isError && <Error error={write.error} />}{" "}
      {q.isPending ? (
        <Skeleton />
      ) : q.isError ? (
        <Card>
          <Error error={q.error} />
          <Button onClick={() => void q.refetch()}>Thử lại</Button>
        </Card>
      ) : (
        <>
          {q.data.items.length === 0 ? (
            <Card>
              <EmptyState title="Chưa có công việc phù hợp">
                Thêm việc mới hoặc thay đổi bộ lọc để xem lại.
              </EmptyState>
            </Card>
          ) : view === "kanban" ? (
            <>
              <p className="muted">
                Bảng hiển thị tối đa 20 việc của trang hiện tại. Chọn trạng thái
                trên thẻ để chuyển cột.
              </p>
              <div className="task-kanban">
                {Object.entries(statuses).map(([key, name]) => (
                  <section key={key}>
                    <h2>
                      {name}{" "}
                      <span>
                        {q.data.items.filter((t) => t.status === key).length}
                      </span>
                    </h2>
                    {q.data.items.filter((t) => t.status === key).map(render)}
                  </section>
                ))}
              </div>
            </>
          ) : (
            <div className="task-list">{q.data.items.map(render)}</div>
          )}
          <Pager page={page} total={q.data.total} onPage={setPage} />
        </>
      )}
      {editing && members.data && (
        <TaskForm
          task={editing === true ? undefined : editing}
          members={members.data}
          shopping={kind === "shopping"}
          onClose={() => setEditing(null)}
        />
      )}{" "}
      {comments && (
        <Comments task={comments} onClose={() => setComments(null)} />
      )}{" "}
      {removing && (
        <Modal
          title="Xóa công việc"
          onClose={() => setRemoving(null)}
          busy={remove.isPending}
        >
          <p>Xóa “{removing.title}”? Bản lặp đã tạo trước đó vẫn được giữ.</p>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
            />
            Tôi xác nhận xóa công việc này.
          </label>
          {remove.isError && <Error error={remove.error} />}
          <div className="modal-actions">
            <Button
              className="button-outline"
              onClick={() => setRemoving(null)}
            >
              Hủy
            </Button>
            <Button
              disabled={!confirm || remove.isPending}
              onClick={() => remove.mutate()}
            >
              Xác nhận xóa
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
