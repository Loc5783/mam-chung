import { type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { apiClient } from "../../../lib/apiClient";
import { useTaskMutation } from "../api";
import type { TaskList, TaskListPage } from "../types";
function Row({
  list,
  children,
  disabled,
  move,
}: {
  list: TaskList;
  children: ReactNode;
  disabled: boolean;
  move: (direction: number) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition } =
    useSortable({ id: list.id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="todo-drag-controls" data-drag-controls>
        <button
          disabled={disabled}
          {...attributes}
          {...listeners}
          aria-label={`Kéo danh sách ${list.name}`}
        >
          ⠿
        </button>
        <button
          disabled={disabled}
          aria-label={`Danh sách ${list.name} lên`}
          onClick={() => move(-1)}
        >
          ↑
        </button>
        <button
          disabled={disabled}
          aria-label={`Danh sách ${list.name} xuống`}
          onClick={() => move(1)}
        >
          ↓
        </button>
      </div>
      {children}
    </div>
  );
}
export function SortableLists({
  lists,
  disabled,
  render,
}: {
  lists: TaskList[];
  disabled: boolean;
  render: (list: TaskList) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const reorder = useTaskMutation(
    async ({
      list,
      target,
      after,
    }: {
      list: TaskList;
      target: TaskList;
      after: boolean;
    }) => {
      const all: TaskList[] = [];
      let page = 1,
        total = Infinity;
      while (all.length < total) {
        const result = (
          await apiClient.get<TaskListPage>("/task-lists", {
            params: {
              limit: 100,
              page,
              scope: list.coupleId ? "shared" : "personal",
            },
          })
        ).data;
        all.push(...result.items);
        total = result.total;
        if (!result.items.length)
          throw new Error("Danh sách đã thay đổi. Tải lại trước khi sắp xếp.");
        page++;
      }
      const rows = all.filter(
          (l) =>
            l.id !== list.id &&
            !l.archivedAt &&
            l.coupleId === list.coupleId &&
            l.ownerId === list.ownerId,
        ),
        index = rows.findIndex((l) => l.id === target.id);
      if (index < 0) throw new Error("Danh sách đích đã thay đổi.");
      const at = index + (after ? 1 : 0);
      return apiClient.patch("/task-lists/reorder", {
        id: list.id,
        revision: list.revision,
        afterId: rows[at - 1]?.id ?? null,
        beforeId: rows[at]?.id ?? null,
      });
    },
  );
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (disabled || reorder.isPending || !over || active.id === over.id)
          return;
        const from = lists.findIndex((l) => l.id === active.id),
          to = lists.findIndex((l) => l.id === over.id);
        if (from >= 0 && to >= 0)
          reorder.mutate({
            list: lists[from],
            target: lists[to],
            after: from < to,
          });
      }}
    >
      <SortableContext
        items={lists.map((l) => l.id)}
        strategy={verticalListSortingStrategy}
      >
        {lists.map((list, index) => (
          <Row
            key={list.id}
            list={list}
            disabled={
              disabled ||
              list.readOnly ||
              !!list.archivedAt ||
              reorder.isPending
            }
            move={(direction) => {
              const target = lists[index + direction];
              if (target)
                reorder.mutate({ list, target, after: direction > 0 });
            }}
          >
            {render(list)}
          </Row>
        ))}
      </SortableContext>
    </DndContext>
  );
}
