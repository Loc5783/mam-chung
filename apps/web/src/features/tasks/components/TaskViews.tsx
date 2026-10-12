import { lazy, Suspense, ReactNode } from "react";
import { Card, Button, Skeleton, ViewErrorBoundary } from "../../../components/ui";
import { errorMessage } from "../../../lib/apiClient";
import { TaskListView } from "./TaskListView";
import type { Task, TaskList, Status } from "../types";

const CalendarView = lazy(() =>
  import("./CalendarView").then((m) => ({ default: m.CalendarView })),
);
const FocusMode = lazy(() =>
  import("./FocusMode").then((m) => ({ default: m.FocusMode })),
);
const StatsPanel = lazy(() =>
  import("./StatsPanel").then((m) => ({ default: m.StatsPanel })),
);

export function TaskViews({
  view,
  tasks,
  total,
  page,
  onPage,
  smart,
  readOnly,
  online,
  writePending,
  reschedulePending,
  queryPending,
  queryError,
  onRetryQuery,
  queryFilters,
  onAddFirst,
  renderTask,
  onStatusChange,
  onCheckTask,
  onFilterLate,
  onCalendarAdd,
  onCalendarMove,
  onOpenTask,
  activeList,
  sort,
  listId,
  groupBy,
  userTimezone,
  lists,
  memberItems,
}: {
  view: string;
  tasks: Task[];
  total: number;
  page: number;
  onPage: (p: number) => void;
  smart: string;
  readOnly: boolean;
  online: boolean;
  writePending: boolean;
  reschedulePending: boolean;
  queryPending: boolean;
  queryError: unknown;
  onRetryQuery: () => void;
  queryFilters: Record<string, string>;
  onAddFirst: () => void;
  renderTask: (task: Task, index?: number) => ReactNode;
  onStatusChange: (task: Task, status: Status) => void;
  onCheckTask: (task: Task, id: string, done: boolean) => void;
  onFilterLate: (habit: { type: string; name: string }) => void;
  onCalendarAdd: (date: string) => void;
  onCalendarMove: (task: Task, deadline: string) => void;
  onOpenTask: (task: Task) => void;
  activeList?: TaskList;
  sort: string;
  listId: string;
  groupBy: string;
  userTimezone: string;
  lists: TaskList[];
  memberItems: { id: string; name: string }[];
}) {
  return (
    <>
      {view !== "stats" && (
        <ViewErrorBoundary name="Thống kê nhanh">
          <Suspense fallback={<Skeleton className="h-12 w-full mb-3" />}>
            <StatsPanel
              collapsible
              defaultCollapsed
              onFilterLate={onFilterLate}
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
                  Object.entries(queryFilters).filter(([, v]) => v),
                ) as Record<string, string>
              }
              disabled={
                !online || readOnly || writePending || reschedulePending
              }
              onAdd={onCalendarAdd}
              onOpen={onOpenTask}
              onMove={onCalendarMove}
            />
          </Suspense>
        </ViewErrorBoundary>
      ) : view === "focus" ? (
        <ViewErrorBoundary name="Focus">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <FocusMode
              tasks={tasks}
              disabled={!online || readOnly || writePending}
              onCheck={onCheckTask}
            />
          </Suspense>
        </ViewErrorBoundary>
      ) : view === "stats" ? (
        <ViewErrorBoundary name="Thống kê">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <StatsPanel onFilterLate={onFilterLate} />
          </Suspense>
        </ViewErrorBoundary>
      ) : queryPending ? (
        <Skeleton />
      ) : queryError ? (
        <Card>
          <p role="alert" className="form-error">
            {errorMessage(queryError)}
          </p>
          <Button onClick={onRetryQuery}>Thử lại</Button>
        </Card>
      ) : (
        <TaskListView
          view={view}
          tasks={tasks}
          total={total}
          page={page}
          onPage={onPage}
          smart={smart}
          readOnly={readOnly}
          online={online}
          isWritePending={writePending}
          onAddFirst={onAddFirst}
          renderTask={renderTask}
          onStatusChange={onStatusChange}
          activeList={activeList}
          sort={sort}
          listId={listId}
          groupBy={groupBy}
          userTimezone={userTimezone}
          lists={lists}
          memberItems={memberItems}
        />
      )}
    </>
  );
}
