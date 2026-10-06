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
import type { Task, TaskPage } from "../types";
function SortableItem({
  task,
  children,
  disabled,
  onMove,
}: {
  task: Task;
  children: ReactNode;
  disabled: boolean;
  onMove: (direction: number) => void;
}) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 3 : undefined,
        position: "relative",
      }}
      className={isDragging ? "todo-dragging" : ""}
    >
      <div className="todo-drag-controls" data-drag-controls>
        <button
          type="button"
          disabled={disabled}
          {...attributes}
          {...listeners}
          aria-label={`Kéo sắp xếp ${task.title}`}
        >
          ⠿
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-label={`Đưa ${task.title} lên`}
          onClick={() => onMove(-1)}
        >
          ↑
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-label={`Đưa ${task.title} xuống`}
          onClick={() => onMove(1)}
        >
          ↓
        </button>
      </div>
      {children}
    </div>
  );
}
export function SortableTaskList({
  tasks,
  render,
  disabled,
}: {
  tasks: Task[];
  render: (task: Task) => ReactNode;
  disabled: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const move = useTaskMutation(
    async ({
      task,
      target,
      after,
    }: {
      task: Task;
      target: Task;
      after: boolean;
    }) => {
      if (!task.listId || task.listId !== target.listId)
        throw new Error("Chỉ sắp xếp trong cùng danh sách.");
      const all: Task[] = [];
      let page = 1,
        total = Infinity;
      while (all.length < total) {
        const result = (
          await apiClient.get<TaskPage>("/tasks", {
            params: { list: task.listId, sort: "manual", limit: 100, page },
          })
        ).data;
        all.push(...result.items);
        total = result.total;
        if (!result.items.length)
          throw new Error("Danh sách đã đổi. Tải lại trước khi sắp xếp.");
        page++;
      }
      const remaining = all.filter((t) => t.id !== task.id),
        index = remaining.findIndex((t) => t.id === target.id);
      if (index < 0)
        throw new Error("Việc đích đã thay đổi. Tải lại trước khi sắp xếp.");
      const insertion = index + (after ? 1 : 0);
      return apiClient.patch("/tasks/reorder", {
        id: task.id,
        revision: task.revision,
        afterId: remaining[insertion - 1]?.id ?? null,
        beforeId: remaining[insertion]?.id ?? null,
      });
    },
  );
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (disabled || move.isPending || !over || active.id === over.id)
          return;
        const from = tasks.findIndex((t) => t.id === active.id),
          to = tasks.findIndex((t) => t.id === over.id);
        if (from >= 0 && to >= 0)
          move.mutate({
            task: tasks[from],
            target: tasks[to],
            after: from < to,
          });
      }}
    >
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        {tasks.map((task, index) => (
          <SortableItem
            key={task.id}
            task={task}
            disabled={disabled || move.isPending}
            onMove={(direction) => {
              const target = tasks[index + direction];
              if (target) move.mutate({ task, target, after: direction > 0 });
            }}
          >
            {render(task)}
          </SortableItem>
        ))}
      </SortableContext>
    </DndContext>
  );
}
