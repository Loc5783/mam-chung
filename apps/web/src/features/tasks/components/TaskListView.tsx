import React, { Suspense, lazy } from "react";
import {
  Card,
  Button,
  EmptyState,
  Skeleton,
  ViewErrorBoundary,
} from "../../../components/ui";
import { KanbanView } from "./KanbanView";
import { SortableTaskList } from "./SortableTaskList";
import { TaskGroup } from "./TaskGroup";
import { VirtualTaskList } from "./VirtualTaskList";
import { groupTasks } from "../lib/dateLabels";
import type { Task, TaskList, Status } from "../types";

const ShoppingView = lazy(() =>
  import("./ShoppingView").then((m) => ({
    default: m.ShoppingView,
  })),
);

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

export function TaskListView({
  view,
  tasks,
  total,
  page,
  onPage,
  smart,
  readOnly,
  online,
  isWritePending,
  onAddFirst,
  renderTask,
  onStatusChange,
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
  isWritePending: boolean;
  onAddFirst: () => void;
  renderTask: (task: Task, index?: number) => React.ReactNode;
  onStatusChange: (task: Task, status: Status) => void;
  activeList?: TaskList;
  sort: string;
  listId: string;
  groupBy: string;
  userTimezone: string;
  lists: TaskList[];
  memberItems: { id: string; name: string }[];
}) {
  if (tasks.length === 0) {
    return (
      <>
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
              onClick={onAddFirst}
            >
              Thêm việc đầu tiên
            </Button>
          )}
        </Card>
        <Pager page={page} total={total} onPage={onPage} />
      </>
    );
  }

  if (view === "kanban") {
    return (
      <ViewErrorBoundary name="Kanban">
        <p className="muted">
          Bảng hiển thị tối đa 20 việc của trang hiện tại. Kéo tay nắm sang cột
          khác hoặc chọn trạng thái trên thẻ.
        </p>
        <KanbanView
          tasks={tasks}
          render={renderTask}
          disabled={!online || readOnly || isWritePending}
          onStatus={onStatusChange}
        />
        <Pager page={page} total={total} onPage={onPage} />
      </ViewErrorBoundary>
    );
  }

  if (activeList?.type === "shopping" && sort !== "manual") {
    return (
      <ViewErrorBoundary name="Mua sắm">
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <ShoppingView tasks={tasks} render={renderTask} />
        </Suspense>
        <Pager page={page} total={total} onPage={onPage} />
      </ViewErrorBoundary>
    );
  }

  if (sort === "manual" && listId) {
    return (
      <>
        <SortableTaskList
          tasks={tasks}
          render={renderTask}
          disabled={readOnly || !online || isWritePending}
        />
        <Pager page={page} total={total} onPage={onPage} />
      </>
    );
  }

  return (
    <>
      <div className="todo-groups">
        {groupTasks(tasks, new Date(), userTimezone, groupBy).map(
          ([key, groupItems]) => (
            <TaskGroup
              key={key}
              name={
                groupBy === "list"
                  ? (lists.find((l) => l.id === key)?.name ??
                    (key === "inbox" ? "Hộp thư vào" : key))
                  : groupBy === "assignee"
                    ? (memberItems.find((m) => m.id === key)?.name ??
                      (key === "unassigned" ? "Chưa giao" : key))
                    : key
              }
              count={groupItems.length}
            >
              <VirtualTaskList
                tasks={groupItems}
                render={(t, idx) => renderTask(t, idx)}
                threshold={200}
              />
            </TaskGroup>
          ),
        )}
      </div>
      <Pager page={page} total={total} onPage={onPage} />
    </>
  );
}
