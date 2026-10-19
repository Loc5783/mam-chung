import { useEffect, useState } from "react";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { localInputDate } from "../finance/api";
import { useAuthStore } from "../auth/store";
import { useTaskMutation, useTasksQuery } from "./api";
import { useOnline } from "./lib/useOnline";
import { useTaskUiStore } from "./store";
import { useTaskWrite } from "./useTaskWrite";
import { useTaskFilters } from "./hooks/useTaskFilters";
import { useTaskSelection } from "./hooks/useTaskSelection";
import { useTaskUndo } from "./hooks/useTaskUndo";
import { useTaskKeyboard } from "./hooks/useTaskKeyboard";
import { BulkActionBar } from "./components/BulkActionBar";
import { QuickAddBar } from "./components/QuickAddBar";
import { SmartListSidebar, smartLists } from "./components/SmartListSidebar";
import { SelectableTaskRow } from "./components/SelectableTaskRow";
import { TaskHeader } from "./components/TaskHeader";
import { TaskSectionHeader } from "./components/TaskSectionHeader";
import { TaskFilterBar } from "./components/TaskFilterBar";
import { TaskToolbar } from "./components/TaskToolbar";
import { TaskViews } from "./components/TaskViews";
import { TaskModals } from "./components/TaskModals";
import { TaskUndoToasts } from "./components/TaskUndoToasts";
import type { Task, TaskPage, TaskList, TaskListPage, Members } from "./types";

function Error({ error }: { error: unknown }) {
  return (
    <p role="alert" className="form-error">
      {errorMessage(error)}
    </p>
  );
}

export function TasksPage() {
  const {
    params,
    setParams,
    cid,
    view,
    smart,
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
    listId,
    groupBy,
    archivedLists,
    activeFilterCount,
    clearAllFilters,
    update,
    setScope,
    setStatus,
    setPriority,
    setSearch,
    setDue,
    setFrom,
    setTo,
    setSort,
    setKind,
    setLabel,
    setView,
    setGroupBy,
    selectSmart,
    selectList,
    toggleShopping,
    selectTemplateList,
    page,
    setPage,
    context,
    queryFilters,
  } = useTaskFilters();

  const [editing, setEditing] = useState<Task | true | null>(null),
    [comments, setComments] = useState<Task | null>(null),
    [removing, setRemoving] = useState<Task | null>(null),
    [creatingList, setCreatingList] = useState(false),
    [selected, setSelected] = useState<Task | null>(null),
    [shortcuts, setShortcuts] = useState(false),
    [quickDeadline, setQuickDeadline] = useState<string | null>(null),
    [mobileQuick, setMobileQuick] = useState(false),
    [quickBusy, setQuickBusy] = useState(false);

  const { selectedId, select } = useTaskUiStore();
  const { chosen, setChosen, handleRowClickCapture } = useTaskSelection();
  const online = useOnline();
  const user = useAuthStore((s) => s.user)!;

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

  const {
    undo,
    setUndo,
    bulkUndo,
    setBulkUndo,
    undoBulkMutation,
    triggerSingleUndo,
    triggerBulkUndo,
    dismissSingleUndo,
    dismissBulkUndo,
  } = useTaskUndo(write.mutate);

  useEffect(() => {
    select(null);
    return () => select(null);
  }, [select]);

  useEffect(() => {
    if (params.get("add") === "1" && !cid) {
      setEditing(true);
      const next = new URLSearchParams(params);
      next.delete("add");
      setParams(next, { replace: true });
    }
  }, [params, setParams, cid]);

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

  const archiveList = useTaskMutation(async (list: TaskList) =>
    apiClient.put(`/task-lists/${list.id}`, {
      revision: list.revision,
      archived: !list.archivedAt,
    }),
  );

  const q = useTasksQuery<TaskPage>("/tasks", {
    ...Object.fromEntries(Object.entries(queryFilters).filter(([, v]) => v)),
    page,
    limit: 20,
  });

  useEffect(() => {
    if (q.data && page > Math.max(1, Math.ceil(q.data.total / 20)))
      setPage(Math.max(1, Math.ceil(q.data.total / 20)));
  }, [q.data, page, setPage]);

  useEffect(() => {
    setChosen((prev) => (prev.length > 0 ? [] : prev));
  }, [page, listId, queryFilters, setChosen]);

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

  useTaskKeyboard({
    items: q.data?.items ?? [],
    readOnly,
    online,
    listReady,
    userTimezone: user.timezone,
    isWritePending: write.isPending,
    writeMutate: write.mutate,
    rescheduleMutate: reschedule.mutate,
    hasBulkUndo: Boolean(bulkUndo),
    triggerBulkUndo,
    hasSingleUndo: Boolean(undo),
    triggerSingleUndo,
    onOpenShortcuts: () => setShortcuts(true),
    onOpenDetail: (task) => {
      setSelected(task);
      select(task.id);
    },
    onSetRemoving: (task) => setRemoving(task),
  });

  const checkTask = (task: Task, id: string, done: boolean) =>
    write.mutate({
      task,
      checklist: task.checklist.map((i) => (i.id === id ? { ...i, done } : i)),
    });

  const render = (task: Task, index = 0) => (
    <SelectableTaskRow
      key={task.id}
      task={task}
      index={index}
      search={search}
      userTimezone={user.timezone}
      members={members.data ?? { items: [], readOnly: false }}
      listName={lists.find((l) => l.id === task.listId)?.name}
      isChosen={chosen.includes(task.id)}
      isWritePending={write.isPending}
      isExitAnimation={Boolean(
        write.isPending &&
        write.variables?.task.id === task.id &&
        write.variables?.remove,
      )}
      online={online}
      onToggleChosen={(c) =>
        setChosen((old) =>
          c ? [...old, task.id] : old.filter((id) => id !== task.id),
        )
      }
      onTomorrow={(deadline) => reschedule.mutate({ task, deadline })}
      onStatus={(s) => write.mutate({ task, status: s })}
      onEdit={() => {
        setSelected(task);
        select(task.id);
      }}
      onComments={() => setComments(task)}
      onDelete={() => setRemoving(task)}
      onCheck={(id, done) => checkTask(task, id, done)}
      onClickCapture={(e) =>
        handleRowClickCapture(
          e,
          task,
          q.data?.items ?? [],
          write.isPending,
          online,
        )
      }
    />
  );

  const title =
    activeList?.name ??
    smartLists.find(([k]) => k === smart)?.[1] ??
    "Công việc";

  return (
    <>
      <TaskUndoToasts
        bulkUndo={bulkUndo}
        undo={undo}
        selectedId={selectedId}
        online={online}
        isWritePending={write.isPending}
        isBulkUndoPending={undoBulkMutation.isPending}
        onTriggerBulkUndo={triggerBulkUndo}
        onDismissBulkUndo={dismissBulkUndo}
        onTriggerSingleUndo={triggerSingleUndo}
        onDismissSingleUndo={dismissSingleUndo}
      />

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
          onSmart={selectSmart}
          onList={(list) => selectList(list.id)}
          onLabel={setLabel}
          onNew={() => setCreatingList(true)}
          onArchive={(list) => {
            if (online) archiveList.mutate(list);
          }}
        />

        <div className="todo-main">
          <TaskSectionHeader
            title={title}
            total={q.data?.total}
            readOnly={readOnly}
            canAdd={
              online && listReady && !members.isPending && !members.isError
            }
            onOpenShortcuts={() => setShortcuts(true)}
            onAddTask={() => setEditing(true)}
          />

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

          <TaskToolbar
            view={view}
            onViewChange={setView}
            listId={listId}
            readOnly={readOnly}
            online={online}
            hasCouple={Boolean(user.coupleId || cid)}
            isShoppingKind={kind === "shopping"}
            onToggleShopping={toggleShopping}
            onSelectTemplateList={selectTemplateList}
          />

          <TaskFilterBar
            scope={scope}
            status={status}
            priority={priority}
            due={due}
            from={from}
            to={to}
            label={label}
            sort={sort}
            search={search}
            groupBy={groupBy}
            kind={kind}
            cid={cid}
            hasCouple={Boolean(user.coupleId)}
            activeFilterCount={activeFilterCount}
            onScopeChange={setScope}
            onStatusChange={setStatus}
            onPriorityChange={setPriority}
            onDueChange={setDue}
            onFromChange={setFrom}
            onToChange={setTo}
            onLabelChange={setLabel}
            onSortChange={setSort}
            onSearchChange={setSearch}
            onGroupByChange={setGroupBy}
            onClearKind={() => setKind("")}
            onClearAll={clearAllFilters}
          />

          {members.isError && <Error error={members.error} />}
          {write.isError && <Error error={write.error} />}

          <TaskViews
            view={view}
            tasks={q.data?.items ?? []}
            total={q.data?.total ?? 0}
            page={page}
            onPage={setPage}
            smart={smart}
            readOnly={readOnly}
            online={online}
            writePending={write.isPending}
            reschedulePending={reschedule.isPending}
            queryPending={q.isPending}
            queryError={q.isError ? q.error : null}
            onRetryQuery={() => void q.refetch()}
            queryFilters={queryFilters}
            onAddFirst={() => setEditing(true)}
            renderTask={render}
            onStatusChange={(task, s) => write.mutate({ task, status: s })}
            onCheckTask={checkTask}
            onFilterLate={(habit) => {
              if (habit.type === "label") setLabel(habit.name);
              else update("list", habit.name);
              setView("list");
            }}
            onCalendarAdd={(date) => {
              setQuickDeadline(date);
              setMobileQuick(true);
            }}
            onCalendarMove={(task, deadline) =>
              reschedule.mutate({ task, deadline })
            }
            onOpenTask={(task) => {
              setSelected(task);
              select(task.id);
            }}
            activeList={activeList}
            sort={sort}
            listId={listId}
            groupBy={groupBy}
            userTimezone={user.timezone}
            lists={lists}
            memberItems={members.data?.items ?? []}
          />
        </div>
      </div>

      <TaskModals
        shortcuts={shortcuts}
        onCloseShortcuts={() => setShortcuts(false)}
        selectedId={selectedId}
        selectedTask={selected}
        detailTask={detail.data}
        members={members.data ?? { items: [], readOnly: false }}
        lists={lists}
        isWritePending={write.isPending}
        onCloseDetail={() => {
          select(null);
          setSelected(null);
        }}
        onStatusTask={(task, s) => write.mutate({ task, status: s })}
        onOpenComments={(task) => setComments(task)}
        onUndoDetail={
          undo?.task.id === selectedId ? triggerSingleUndo : undefined
        }
        onViewFocus={() => setView("focus")}
        editing={editing}
        onCloseEditing={() => setEditing(null)}
        activeList={activeList}
        isShoppingKind={kind === "shopping"}
        listReady={listReady}
        readOnly={readOnly}
        comments={comments}
        onCloseComments={() => setComments(null)}
        removing={removing}
        removePending={write.isPending}
        removeError={write.error}
        onCloseRemoving={() => setRemoving(null)}
        onConfirmRemoving={() => {
          if (removing) write.mutate({ task: removing, remove: true });
        }}
        creatingList={creatingList}
        onCloseCreatingList={() => setCreatingList(false)}
        mobileQuick={mobileQuick}
        onCloseMobileQuick={() => {
          setMobileQuick(false);
          setQuickDeadline(null);
        }}
        quickBusy={quickBusy}
        setQuickBusy={setQuickBusy}
        quickDeadline={quickDeadline}
        user={user}
        hasCouple={Boolean(user.coupleId)}
        scope={scope}
        smart={smart}
        listId={listId}
        online={online}
      />
    </>
  );
}
