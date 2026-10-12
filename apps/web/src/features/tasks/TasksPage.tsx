import { lazy, Suspense, useEffect, useState } from "react";
import { useFocusStore } from "./store/focus";
import { useUiStore } from "../../app/store";
import { BulkActionBar } from "./components/BulkActionBar";
import { SortableTaskList } from "./components/SortableTaskList";
import { QuickAddBar } from "./components/QuickAddBar";
import { SmartListSidebar, smartLists } from "./components/SmartListSidebar";
import { TaskRow } from "./components/TaskRow";
import { TaskHeader } from "./components/TaskHeader";
import { TaskGroup } from "./components/TaskGroup";
import { TaskDetailDrawer } from "./components/TaskDetailDrawer";
import { TemplatePicker } from "./components/TemplatePicker";
import { TaskCommentsModal } from "./components/TaskCommentsModal";
import { DeleteTaskModal } from "./components/DeleteTaskModal";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { VirtualTaskList } from "./components/VirtualTaskList";
import { groupTasks } from "./lib/dateLabels";
import { useOnline } from "./lib/useOnline";
import { useTaskUiStore } from "./store";
import { useTaskWrite } from "./useTaskWrite";
import { moveTabFocus } from "../../components/ui/tabs";
import { useSearchParams } from "react-router-dom";
import { Plus, ShoppingBag, SlidersHorizontal, RotateCcw } from "lucide-react";
import {
  Card,
  Button,
  EmptyState,
  Skeleton,
  ViewErrorBoundary,
} from "../../components/ui";
import { Modal } from "../../components/ui/Modal";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { localInputDate } from "../finance/api";
import { useAuthStore } from "../auth/store";
import {
  Task,
  TaskPage,
  TaskList,
  TaskListPage,
  Members,
  Status,
  statuses,
  priorities,
} from "./types";
import { useTaskMutation, useTasksQuery } from "./api";
import { KanbanView } from "./components/KanbanView";
import { TaskForm } from "./TaskForm";

const CalendarView = lazy(() =>
  import("./components/CalendarView").then((m) => ({
    default: m.CalendarView,
  })),
);
const FocusMode = lazy(() =>
  import("./components/FocusMode").then((m) => ({ default: m.FocusMode })),
);
const StatsPanel = lazy(() =>
  import("./components/StatsPanel").then((m) => ({ default: m.StatsPanel })),
);
const ShoppingView = lazy(() =>
  import("./components/ShoppingView").then((m) => ({
    default: m.ShoppingView,
  })),
);
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
export function TasksPage() {
  const [params, setParams] = useSearchParams();
  const cid = params.get("coupleId") ?? "";
  const scope = params.get("scope") ?? "all",
    status = params.get("status") ?? "",
    priority = params.get("priority") ?? "",
    search = params.get("search") ?? "",
    due = params.get("due") ?? "",
    from = params.get("from") ?? "",
    to = params.get("to") ?? "",
    sort = params.get("sort") ?? "deadline",
    kind = params.get("kind") ?? "",
    label = params.get("label") ?? "",
    view = params.get("view") ?? "list",
    smart = params.get("smart") ?? "all",
    listId = params.get("list") ?? "",
    groupBy = params.get("group") ?? "deadline";
  function update(name: string, value: string) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(name, value);
        else next.delete(name);
        return next;
      },
      { replace: true },
    );
  }
  const setScope = (v: string) => update("scope", v),
    setStatus = (v: string) => update("status", v),
    setPriority = (v: string) => update("priority", v),
    setSearch = (v: string) => update("search", v),
    setDue = (v: string) => update("due", v),
    setFrom = (v: string) => update("from", v),
    setTo = (v: string) => update("to", v),
    setSort = (v: string) => update("sort", v),
    setKind = (v: string) => update("kind", v),
    setLabel = (v: string) => update("label", v),
    setView = (v: string) => update("view", v);

  const activeFilterCount = [
    Boolean(scope && scope !== "all"),
    Boolean(status),
    Boolean(priority),
    Boolean(due),
    Boolean(from),
    Boolean(to),
    Boolean(label),
    Boolean(sort && sort !== "deadline"),
    Boolean(search),
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const key of [
          "scope",
          "status",
          "priority",
          "due",
          "from",
          "to",
          "label",
          "search",
          "sort",
        ]) {
          next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  };
  const [page, setPage] = useState(1),
    [editing, setEditing] = useState<Task | true | null>(null),
    [comments, setComments] = useState<Task | null>(null),
    [removing, setRemoving] = useState<Task | null>(null),
    [creatingList, setCreatingList] = useState(false),
    [listName, setListName] = useState(""),
    [listScope, setListScope] = useState("personal"),
    [listColor, setListColor] = useState("#7E9B57"),
    [undo, setUndo] = useState<{
      task: Task;
      status?: Status;
      restore?: boolean;
    } | null>(null),
    [selected, setSelected] = useState<Task | null>(null);
  const { selectedId, select } = useTaskUiStore();
  const [chosen, setChosen] = useState<string[]>([]);
  const [bulkUndo, setBulkUndo] = useState<{
    items: {
      id: string;
      revision: number;
      restore?: boolean;
      changes?: Record<string, unknown>;
    }[];
  } | null>(null);
  const undoBulk = useTaskMutation(
    async () => apiClient.patch("/tasks/bulk-undo", bulkUndo),
    () => setBulkUndo(null),
  );
  useEffect(() => {
    if (!bulkUndo) return;
    const timer = setTimeout(() => setBulkUndo(null), 5000);
    return () => clearTimeout(timer);
  }, [bulkUndo]);
  const online = useOnline();
  const archivedLists = params.get("archivedLists") === "1";
  useEffect(() => {
    select(null);
    return () => select(null);
  }, [select]);
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), 5000);
    return () => clearTimeout(timer);
  }, [undo]);
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
  const listsQuery = useTasksQuery<TaskListPage>("/task-lists", {
    ...context,
    limit: 100,
    archived: archivedLists ? "true" : "false",
  });
  const summary = useTasksQuery<{
    counts: Record<string, number>;
    lists: { id: string; count: number }[];
    labels: string[];
  }>("/tasks/summary", context);
  const detail = useTasksQuery<Task>(
    `/tasks/${selectedId ?? "none"}`,
    {},
    !!selectedId,
  );
  const lists = listsQuery.data?.items ?? [];
  const activeList = lists.find((l) => l.id === listId);
  const listReady = !listId || !!activeList;
  const createList = useTaskMutation(
    async () =>
      apiClient.post("/task-lists", {
        name: listName.trim(),
        scope: listScope,
        type: listType,
        color: listColor,
        icon: listScope === "shared" ? "Heart" : "ListTodo",
      }),
    () => {
      setCreatingList(false);
      setListName("");
    },
  );
  const archiveList = useTaskMutation(async (list: TaskList) =>
    apiClient.put(`/task-lists/${list.id}`, {
      revision: list.revision,
      archived: !list.archivedAt,
    }),
  );
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const filters = {
    scope,
    ...(smart !== "all" ? { smart } : {}),
    ...(listId ? { list: listId } : {}),
    status,
    priority,
    search: debouncedSearch,
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
  }, [
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
    cid,
    smart,
    listId,
  ]);
  useEffect(() => {
    if (q.data && page > Math.max(1, Math.ceil(q.data.total / 20)))
      setPage(Math.max(1, Math.ceil(q.data.total / 20)));
  }, [q.data, page]);
  const write = useTaskWrite((input, saved) => {
    if (input.remove) {
      setRemoving(null);
      setUndo({
        task: { ...input.task, revision: input.task.revision + 1 },
        restore: true,
      });
    } else if (input.status === "DONE" && saved)
      setUndo({ task: saved, status: input.task.status });
  });
  const undoAction = () => {
    if (!undo) return;
    write.mutate({
      task: undo.task,
      status: undo.status,
      restore: undo.restore,
    });
    setUndo(null);
  };
  const remove = {
    isPending: write.isPending,
    isError: write.isError,
    error: write.error,
    mutate: () => {
      if (removing) write.mutate({ task: removing, remove: true });
    },
  };
  useEffect(
    () => setChosen([]),
    [
      page,
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
      smart,
      listId,
    ],
  );
  const [quickDeadline, setQuickDeadline] = useState<string | null>(null);
  const [listType, setListType] = useState("normal");
  const [mobileQuick, setMobileQuick] = useState(false),
    [quickBusy, setQuickBusy] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const reschedule = useTaskMutation(
    async ({ task, deadline }: { task: Task; deadline: string }) => ({
      task,
      saved: (
        await apiClient.put<Task>(`/tasks/${task.id}`, {
          revision: task.revision,
          deadline,
        })
      ).data,
    }),
    (result) => {
      const { task, saved } = result as { task: Task; saved: Task };
      setUndo(null);
      setBulkUndo({
        items: [
          {
            id: saved.id,
            revision: saved.revision,
            changes: { deadline: task.deadline },
          },
        ],
      });
    },
  );
  const readOnly = (q.data?.readOnly ?? !!cid) || !!activeList?.readOnly;
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const target =
        event.target instanceof Element ? event.target : document.activeElement;
      if (
        target?.closest(
          "input,textarea,select,[contenteditable=true],[data-drag-controls]",
        ) ||
        document.querySelector('[role="dialog"]') ||
        event.altKey
      )
        return;
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "z" &&
        bulkUndo
      ) {
        event.preventDefault();
        if (!undoBulk.isPending) undoBulk.mutate();
        return;
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "z" &&
        undo
      ) {
        event.preventDefault();
        undoAction();
        return;
      }
      if (event.ctrlKey || event.metaKey) return;
      const key = event.key.toLowerCase();
      if (key === "?") {
        event.preventDefault();
        setShortcuts(true);
        return;
      }
      if (key === "n" && !readOnly && online && listReady) {
        event.preventDefault();
        document
          .querySelector<HTMLTextAreaElement>(
            'textarea[aria-label="Thêm nhanh công việc"]',
          )
          ?.focus();
        return;
      }
      if (key === "/") {
        event.preventDefault();
        const input = document.querySelector<HTMLInputElement>(
          'input[aria-label="Tìm công việc"]',
        );
        const details = input?.closest("details");
        if (details) details.open = true;
        input?.focus();
        return;
      }
      const rows = Array.from(
        document.querySelectorAll<HTMLElement>("[data-task-id]"),
      );
      const index = rows.findIndex((row) =>
        row.contains(document.activeElement),
      );
      if (key === "j" || key === "k") {
        event.preventDefault();
        rows[
          Math.max(0, Math.min(rows.length - 1, index + (key === "j" ? 1 : -1)))
        ]
          ?.querySelector<HTMLButtonElement>(".todo-title-button")
          ?.focus();
        return;
      }
      const task = q.data?.items.find(
        (t) => t.id === rows[index]?.dataset.taskId,
      );
      if (!task || task.readOnly || write.isPending || !online) return;
      if (key === "x") {
        event.preventDefault();
        write.mutate({
          task,
          status: task.status === "DONE" ? "TODO" : "DONE",
        });
      }
      if (key === "e") {
        event.preventDefault();
        setSelected(task);
        select(task.id);
      }
      if (key === "t") {
        event.preventDefault();
        reschedule.mutate({
          task,
          deadline: localInputDate(new Date(), user.timezone),
        });
      }
      if (key === "delete") {
        event.preventDefault();
        setRemoving(task);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  });
  const render = (task: Task, index = 0) => (
    <div
      key={task.id}
      data-task-id={task.id}
      className={`stagger-item ${write.isPending && write.variables?.task.id === task.id && write.variables?.remove ? "item-exit" : ""}`.trim()}
      style={{ "--i": Math.min(index, 12) } as React.CSSProperties}
      onClickCapture={(e) => {
        if (
          (e.ctrlKey || e.metaKey || e.shiftKey) &&
          !task.readOnly &&
          !write.isPending &&
          online &&
          !(e.target as HTMLElement).closest("input")
        ) {
          e.preventDefault();
          e.stopPropagation();
          if (e.shiftKey) {
            const rows = q.data?.items ?? [],
              last = rows.findIndex((t) => t.id === chosen.at(-1)),
              current = rows.findIndex((t) => t.id === task.id);
            if (last >= 0) {
              setChosen((old) => [
                ...new Set([
                  ...old,
                  ...rows
                    .slice(Math.min(last, current), Math.max(last, current) + 1)
                    .filter((t) => !t.readOnly)
                    .map((t) => t.id),
                ]),
              ]);
              return;
            }
          }
          setChosen((old) =>
            old.includes(task.id)
              ? old.filter((id) => id !== task.id)
              : [...old, task.id],
          );
        }
      }}
    >
      <label className="todo-select">
        <input
          type="checkbox"
          aria-label={`Chọn ${task.title}`}
          checked={chosen.includes(task.id)}
          onClick={(e) => {
            if (e.shiftKey) {
              const rows = q.data?.items ?? [];
              const last = rows.findIndex((t) => t.id === chosen.at(-1)),
                current = rows.findIndex((t) => t.id === task.id);
              if (last >= 0 && current >= 0) {
                e.preventDefault();
                setChosen((old) => [
                  ...new Set([
                    ...old,
                    ...rows
                      .slice(
                        Math.min(last, current),
                        Math.max(last, current) + 1,
                      )
                      .filter((t) => !t.readOnly)
                      .map((t) => t.id),
                  ]),
                ]);
              }
            }
          }}
          disabled={task.readOnly || write.isPending || !online}
          onChange={(e) =>
            setChosen((old) =>
              e.target.checked
                ? [...old, task.id]
                : old.filter((id) => id !== task.id),
            )
          }
        />{" "}
        Chọn
      </label>
      <TaskRow
        key={task.id}
        task={task}
        search={search}
        onTomorrow={() => {
          const now = new Date();
          const today = localInputDate(now, user.timezone);
          const next = new Date(today + "T12:00:00Z");
          next.setUTCDate(next.getUTCDate() + 1);
          reschedule.mutate({
            task,
            deadline: next.toISOString().slice(0, 10),
          });
        }}
        members={members.data ?? { items: [], readOnly: false }}
        listName={lists.find((l) => l.id === task.listId)?.name}
        busy={write.isPending || !online}
        onStatus={(status) => write.mutate({ task, status })}
        onEdit={() => {
          setSelected(task);
          select(task.id);
        }}
        onComments={() => setComments(task)}
        onDelete={() => {
          setRemoving(task);
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
    </div>
  );
  return (
    <>
      {shortcuts && <ShortcutsModal onClose={() => setShortcuts(false)} />}
      {bulkUndo && (
        <div className="todo-undo-toast" role="status">
          <span>Đã cập nhật nhóm việc.</span>
          <Button
            disabled={!online || undoBulk.isPending}
            onClick={() => undoBulk.mutate()}
          >
            Hoàn tác nhóm
          </Button>
          <button
            aria-label="Đóng hoàn tác nhóm"
            onClick={() => setBulkUndo(null)}
          >
            ×
          </button>
        </div>
      )}
      {summary.isError && (
        <p role="alert" className="form-error">
          Chưa tải được tiến độ.{" "}
          <button
            className="text-button"
            onClick={() => void summary.refetch()}
          >
            Tải lại tiến độ
          </button>
        </p>
      )}
      <TaskHeader
        name={user.name}
        timezone={user.timezone}
        counts={summary.data?.counts}
      />
      <div className="todo-workspace">
        <SmartListSidebar
          smart={smart}
          listId={listId}
          lists={lists}
          counts={summary.data?.counts}
          listCounts={summary.data?.lists}
          labels={summary.data?.labels ?? []}
          label={label}
          loading={listsQuery.isPending}
          error={listsQuery.isError}
          onRetry={() => void listsQuery.refetch()}
          archived={archivedLists}
          onToggleArchive={() =>
            update("archivedLists", archivedLists ? "" : "1")
          }
          historyReadOnly={!!cid}
          readOnly={readOnly}
          online={online}
          onSmart={(value) => {
            setParams(
              (previous) => {
                const next = new URLSearchParams(previous);
                next.set("smart", value);
                for (const key of ["list", "scope", "status", "due", "kind"])
                  next.delete(key);
                return next;
              },
              { replace: true },
            );
          }}
          onList={(list) => {
            setParams(
              (previous) => {
                const next = new URLSearchParams(previous);
                next.set("list", list.id);
                for (const key of ["smart", "scope", "status", "due", "kind"])
                  next.delete(key);
                return next;
              },
              { replace: true },
            );
          }}
          onLabel={setLabel}
          onNew={() => setCreatingList(true)}
          onArchive={(list) => {
            if (online) archiveList.mutate(list);
          }}
        />
        <div className="todo-main">
          <div className="todo-section-heading">
            <div>
              <h2>
                {activeList?.name ??
                  smartLists.find(([key]) => key === smart)?.[1] ??
                  "Công việc"}
              </h2>
              <small>{q.data?.total ?? "—"} việc</small>
            </div>
            {!readOnly && (
              <Button
                onClick={() => setEditing(true)}
                disabled={
                  !online || !listReady || members.isPending || members.isError
                }
              >
                <Plus size={18} />
                Thêm công việc
              </Button>
            )}
          </div>
          {!online && (
            <p className="todo-offline" role="status">
              Mất kết nối. Bạn vẫn có thể xem; kết nối mạng để lưu thay đổi.
            </p>
          )}
          {!readOnly && (
            <QuickAddBar
              disabled={!online || !listReady || members.isPending}
              context={{
                timezone: user.timezone,
                user: { id: user.id, name: user.name },
                members: members.data?.items ?? [],
                lists,
                scope:
                  activeList?.coupleId || scope === "shared"
                    ? "shared"
                    : "personal",
                listId: listId || undefined,
                deadline:
                  smart === "today"
                    ? localInputDate(new Date(), user.timezone)
                    : undefined,
              }}
            />
          )}
          {createList.isError && <Error error={createList.error} />}{" "}
          {archiveList.isError && <Error error={archiveList.error} />}
          {readOnly && (
            <p className="couple-archive-note">
              Đang xem công việc của hành trình đã lưu trữ · Chỉ đọc.
            </p>
          )}
          {!!chosen.length && (
            <BulkActionBar
              tasks={(q.data?.items ?? []).filter((t) => chosen.includes(t.id))}
              lists={lists}
              members={members.data ?? { items: [], readOnly: false }}
              disabled={!online || readOnly || write.isPending}
              onUndo={(payload) => {
                setUndo(null);
                setBulkUndo(payload);
              }}
              onClear={() => setChosen([])}
            />
          )}
          <p className="todo-swipe-hint">
            Trên điện thoại: vuốt phải để hoàn thành, vuốt trái để dời hạn hoặc
            xóa. Bấm ? để xem phím tắt.
          </p>
          <div className="task-toolbar">
            <div
              className="task-view-tabs"
              role="tablist"
              onKeyDown={moveTabFocus}
              aria-label="Cách xem"
            >
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
              {[
                ["calendar", "Lịch"],
                ["focus", "Focus"],
                ["stats", "Thống kê"],
              ].map(([key, name]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={view === key}
                  tabIndex={view === key ? 0 : -1}
                  onClick={() => setView(key)}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="task-toolbar-actions">
              <TemplatePicker
                listId={listId}
                disabled={!online || readOnly}
                onList={(id) => {
                  setParams(
                    (previous) => {
                      const next = new URLSearchParams(previous);
                      next.set("list", id);
                      next.set("view", "list");
                      next.delete("smart");
                      return next;
                    },
                    { replace: true },
                  );
                }}
              />
              <Button
                className={`button-outline ${kind === "shopping" ? "is-active" : ""}`}
                disabled={!user.coupleId && !cid}
                onClick={() => {
                  setParams(
                    (previous) => {
                      const next = new URLSearchParams(previous);
                      if (kind === "shopping") next.delete("kind");
                      else next.set("kind", "shopping");
                      next.set("scope", "shared");
                      next.delete("smart");
                      next.delete("list");
                      return next;
                    },
                    { replace: true },
                  );
                }}
              >
                <ShoppingBag size={17} />
                Mua sắm chung
              </Button>
            </div>
          </div>
          <Card className="todo-filters-card">
            <details
              className="todo-filters"
              open={activeFilterCount > 0 ? true : undefined}
            >
              <summary className="todo-filters-summary">
                <span className="todo-filters-summary-title">
                  <SlidersHorizontal size={14} />
                  <span>Lọc và sắp xếp</span>
                  {activeFilterCount > 0 && (
                    <span
                      className="todo-filter-badge"
                      aria-label={`${activeFilterCount} bộ lọc đang áp dụng`}
                    >
                      {activeFilterCount}
                    </span>
                  )}
                </span>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    className="todo-clear-filters-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      clearAllFilters();
                    }}
                  >
                    <RotateCcw size={12} />
                    Đặt lại bộ lọc
                  </button>
                )}
              </summary>
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
                    <option value="manual">Thứ tự thủ công</option>
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
              <div className="todo-filters-footer">
                <label className="todo-group-picker">
                  Nhóm theo
                  <select
                    aria-label="Nhóm công việc"
                    value={groupBy}
                    onChange={(e) => update("group", e.target.value)}
                  >
                    <option value="deadline">Hạn chót</option>
                    <option value="list">Danh sách</option>
                    <option value="priority">Ưu tiên</option>
                    <option value="assignee">Người thực hiện</option>
                  </select>
                </label>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    className="text-button todo-reset-link"
                    onClick={clearAllFilters}
                  >
                    Xóa tất cả điều kiện lọc
                  </button>
                )}
              </div>
            </details>
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
          {view !== "stats" && (
            <ViewErrorBoundary name="Thống kê nhanh">
              <Suspense fallback={<Skeleton className="h-12 w-full mb-3" />}>
                <StatsPanel
                  collapsible
                  defaultCollapsed
                  onFilterLate={(habit) => {
                    if (habit.type === "label") {
                      setLabel(habit.name);
                      setView("list");
                    } else {
                      update("list", habit.name);
                      setView("list");
                    }
                  }}
                />
              </Suspense>
            </ViewErrorBoundary>
          )}
          {view === "calendar" ? (
            <ViewErrorBoundary name="Lịch">
              <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                <CalendarView
                  filters={
                    Object.fromEntries(
                      Object.entries(filters).filter(([, v]) => v),
                    ) as Record<string, string>
                  }
                  disabled={
                    !online ||
                    readOnly ||
                    write.isPending ||
                    reschedule.isPending
                  }
                  onAdd={(date) => {
                    setQuickDeadline(date);
                    setMobileQuick(true);
                  }}
                  onOpen={(task) => {
                    setSelected(task);
                    select(task.id);
                  }}
                  onMove={(task, deadline) =>
                    reschedule.mutate({ task, deadline })
                  }
                />
              </Suspense>
            </ViewErrorBoundary>
          ) : view === "focus" ? (
            <ViewErrorBoundary name="Focus">
              <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                <FocusMode
                  tasks={q.data?.items ?? []}
                  disabled={!online || readOnly || write.isPending}
                  onCheck={(task, id, done) =>
                    write.mutate({
                      task,
                      checklist: task.checklist.map((i) =>
                        i.id === id ? { ...i, done } : i,
                      ),
                    })
                  }
                />
              </Suspense>
            </ViewErrorBoundary>
          ) : view === "stats" ? (
            <ViewErrorBoundary name="Thống kê">
              <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                <StatsPanel
                  onFilterLate={(habit) => {
                    if (habit.type === "label") {
                      setLabel(habit.name);
                      setView("list");
                    } else {
                      update("list", habit.name);
                      setView("list");
                    }
                  }}
                />
              </Suspense>
            </ViewErrorBoundary>
          ) : q.isPending ? (
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
                  <EmptyState
                    title={
                      smart === "today"
                        ? "Hôm nay chưa có việc nào"
                        : smart === "overdue"
                          ? "Không có việc quá hạn"
                          : smart === "done"
                            ? "Chưa có việc hoàn thành"
                            : "Chưa có công việc phù hợp"
                    }
                  >
                    Thêm việc mới hoặc thay đổi bộ lọc để xem lại.
                  </EmptyState>
                  {!readOnly && (
                    <Button
                      className="button-outline"
                      disabled={!online}
                      onClick={() => setEditing(true)}
                    >
                      Thêm việc đầu tiên
                    </Button>
                  )}
                </Card>
              ) : view === "kanban" ? (
                <ViewErrorBoundary name="Kanban">
                  <p className="muted">
                    Bảng hiển thị tối đa 20 việc của trang hiện tại. Kéo tay nắm
                    sang cột khác hoặc chọn trạng thái trên thẻ.
                  </p>
                  <KanbanView
                    tasks={q.data.items}
                    render={render}
                    disabled={!online || readOnly || write.isPending}
                    onStatus={(task, status) => write.mutate({ task, status })}
                  />
                </ViewErrorBoundary>
              ) : activeList?.type === "shopping" && sort !== "manual" ? (
                <ViewErrorBoundary name="Mua sắm">
                  <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                    <ShoppingView tasks={q.data.items} render={render} />
                  </Suspense>
                </ViewErrorBoundary>
              ) : sort === "manual" && listId ? (
                <SortableTaskList
                  tasks={q.data.items}
                  render={render}
                  disabled={readOnly || !online || write.isPending}
                />
              ) : (
                <div className="todo-groups">
                  {groupTasks(
                    q.data.items,
                    new Date(),
                    user.timezone,
                    groupBy,
                  ).map(([key, tasks]) => (
                    <TaskGroup
                      key={key}
                      name={
                        groupBy === "list"
                          ? (lists.find((l) => l.id === key)?.name ??
                            (key === "inbox" ? "Hộp thư vào" : key))
                          : groupBy === "assignee"
                            ? (members.data?.items.find((m) => m.id === key)
                                ?.name ??
                              (key === "unassigned" ? "Chưa giao" : key))
                            : key
                      }
                      count={tasks.length}
                    >
                      <VirtualTaskList
                        tasks={tasks}
                        render={(t, idx) => render(t, idx)}
                        threshold={200}
                      />
                    </TaskGroup>
                  ))}
                </div>
              )}
              <Pager page={page} total={q.data.total} onPage={setPage} />
            </>
          )}
        </div>
      </div>
      {selectedId && selected && (
        <ViewErrorBoundary name="Chi tiết công việc">
          <TaskDetailDrawer
            key={selectedId}
            busy={write.isPending}
            onUndo={undo?.task.id === selectedId ? undoAction : undefined}
            onFocus={() => {
              const task = detail.data?.id
                ? detail.data
                : (q.data?.items.find((t) => t.id === selectedId) ?? selected!);
              const current = useFocusStore.getState().session;
              if (current && current.taskId !== task.id)
                useUiStore
                  .getState()
                  .notify(
                    "Bạn đang có một phiên tập trung. Lưu hoặc kết thúc phiên đó trước khi chọn việc khác.",
                  );
              else if (!current)
                useFocusStore.getState().set({
                  userId: user.id,
                  taskId: task.id,
                  title: task.title,
                  phase: "work",
                  workMinutes: 25,
                  restMinutes: 5,
                  elapsedMs: 0,
                  runningSince: null,
                  sessionId: crypto.randomUUID(),
                  pendingSeconds: null,
                });
              select(null);
              setSelected(null);
              setView("focus");
            }}
            task={
              detail.data?.id
                ? detail.data
                : (q.data?.items.find((t) => t.id === selectedId) ?? selected)
            }
            members={members.data ?? { items: [], readOnly: false }}
            lists={lists}
            onClose={() => {
              select(null);
              setSelected(null);
            }}
            onStatus={(status) => {
              const current = detail.data?.id
                ? detail.data
                : (q.data?.items.find((t) => t.id === selectedId) ?? selected);
              write.mutate({ task: current, status });
            }}
            onComments={() => {
              select(null);
              setComments(detail.data?.id ? detail.data : selected);
            }}
          />
        </ViewErrorBoundary>
      )}
      {undo && undo.task.id !== selectedId && (
        <div className="todo-undo-toast" role="status">
          <span>
            {undo.restore ? "Đã xóa công việc." : "Đã hoàn thành công việc 🌱"}
          </span>
          <Button
            className="button-outline"
            disabled={write.isPending || !online}
            onClick={() => {
              undoAction();
            }}
          >
            Hoàn tác
          </Button>
          <button aria-label="Đóng hoàn tác" onClick={() => setUndo(null)}>
            ×
          </button>
        </div>
      )}
      {creatingList && (
        <Modal
          title="Danh sách mới"
          onClose={() => setCreatingList(false)}
          busy={createList.isPending}
        >
          <form
            className="settings-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (listName.trim() && online) createList.mutate();
            }}
          >
            <label>
              Loại danh sách
              <select
                aria-label="Loại danh sách"
                value={listType}
                onChange={(e) => setListType(e.target.value)}
              >
                <option value="normal">Công việc</option>
                <option value="shopping">Mua sắm</option>
              </select>
            </label>
            <label>
              Tên danh sách
              <input
                aria-label="Tên danh sách"
                maxLength={80}
                value={listName}
                onChange={(e) => setListName(e.target.value)}
              />
            </label>
            <label>
              Không gian
              <select
                aria-label="Không gian danh sách"
                value={listScope}
                onChange={(e) => setListScope(e.target.value)}
              >
                <option value="personal">Cá nhân</option>
                <option value="shared" disabled={!user.coupleId}>
                  Chung
                </option>
              </select>
            </label>
            <label>
              Màu danh sách
              <select
                aria-label="Màu danh sách"
                value={listColor}
                onChange={(e) => setListColor(e.target.value)}
              >
                <option value="#7E9B57">Xanh cốm</option>
                <option value="#57713A">Xanh đậm</option>
                <option value="#E38FA9">Hồng</option>
                <option value="#B3577A">Hồng đậm</option>
                <option value="#75806B">Xám</option>
              </select>
            </label>
            {createList.isError && <Error error={createList.error} />}
            <Button
              disabled={!listName.trim() || createList.isPending || !online}
            >
              Tạo danh sách
            </Button>
          </form>
        </Modal>
      )}
      {!readOnly && (
        <button
          className="quick-add"
          aria-label="Thêm công việc nhanh"
          disabled={
            !online || !listReady || members.isPending || members.isError
          }
          onClick={() => setMobileQuick(true)}
        >
          <Plus size={23} />
        </button>
      )}
      {mobileQuick && (
        <Modal
          title="Thêm nhanh công việc"
          variant="drawer"
          busy={quickBusy}
          onClose={() => {
            setMobileQuick(false);
            setQuickDeadline(null);
          }}
        >
          <div className="todo-mobile-quick-sheet">
            <QuickAddBar
              disabled={!online || !listReady || members.isPending}
              onBusy={setQuickBusy}
              onAdded={() => {
                setMobileQuick(false);
                setQuickDeadline(null);
              }}
              context={{
                timezone: user.timezone,
                user: { id: user.id, name: user.name },
                members: members.data?.items ?? [],
                lists,
                scope:
                  activeList?.coupleId || scope === "shared"
                    ? "shared"
                    : "personal",
                listId: listId || undefined,
                deadline:
                  quickDeadline ??
                  (smart === "today"
                    ? localInputDate(new Date(), user.timezone)
                    : undefined),
              }}
            />
          </div>
        </Modal>
      )}
      {editing && members.data && !readOnly && listReady && (
        <TaskForm
          task={editing === true ? undefined : editing}
          members={members.data}
          shopping={kind === "shopping"}
          list={activeList}
          onClose={() => setEditing(null)}
        />
      )}{" "}
      {comments && (
        <TaskCommentsModal task={comments} onClose={() => setComments(null)} />
      )}{" "}
      {removing && (
        <DeleteTaskModal
          task={removing}
          busy={remove.isPending}
          error={remove.error}
          onClose={() => setRemoving(null)}
          onConfirm={() => remove.mutate()}
        />
      )}
    </>
  );
}
