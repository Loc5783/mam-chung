import { type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { type Task, type Status, statuses } from "../types";
function Card({
  task,
  children,
  disabled,
}: {
  task: Task;
  children: ReactNode;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        position: "relative",
        zIndex: isDragging ? 3 : undefined,
      }}
    >
      <button
        data-drag-controls
        disabled={disabled}
        className="todo-kanban-handle"
        {...attributes}
        {...listeners}
        aria-label={`Di chuyển ${task.title}`}
      >
        ⠿ Di chuyển
      </button>
      {children}
    </div>
  );
}
function Column({
  status,
  tasks,
  render,
  disabled,
}: {
  status: Status;
  tasks: Task[];
  render: (task: Task) => ReactNode;
  disabled: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled });
  return (
    <section ref={setNodeRef} className={isOver ? "todo-drop-active" : ""}>
      <h2>
        {statuses[status]} <span>{tasks.length}</span>
      </h2>
      {tasks.map((t) => (
        <Card key={t.id} task={t} disabled={disabled || t.readOnly}>
          {render(t)}
        </Card>
      ))}
    </section>
  );
}
export function KanbanView({
  tasks,
  render,
  disabled,
  onStatus,
}: {
  tasks: Task[];
  render: (task: Task) => ReactNode;
  disabled: boolean;
  onStatus: (task: Task, status: Status) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );
  return (
    <DndContext
      sensors={sensors}
      onDragEnd={({ active, over }) => {
        const task = tasks.find((t) => t.id === active.id);
        if (
          !disabled &&
          task &&
          !task.readOnly &&
          over &&
          over.id in statuses &&
          task.status !== over.id
        )
          onStatus(task, over.id as Status);
      }}
    >
      <div className="task-kanban">
        {(Object.keys(statuses) as Status[]).map((status) => (
          <Column
            key={status}
            status={status}
            tasks={tasks.filter((t) => t.status === status)}
            render={render}
            disabled={disabled}
          />
        ))}
      </div>
    </DndContext>
  );
}
