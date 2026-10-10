import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "../../../components/ui";
import { localInputDate } from "../../finance/api";
import { useAuthStore } from "../../auth/store";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../lib/apiClient";
import { errorMessage } from "../../../lib/apiClient";
import type { Task, TaskPage } from "../types";
const add = (date: string, days: number) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
function Item({
  task,
  disabled,
  onOpen,
}: {
  task: Task;
  disabled: boolean;
  onOpen: () => void;
}) {
  const user = useAuthStore((s) => s.user)!;
  const { setNodeRef, attributes, listeners, transform } = useDraggable({
    id: task.id,
    disabled: disabled || task.readOnly,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`todo-calendar-task ${task.assignedTo && task.assignedTo !== user.id ? "is-partner" : ""}`}
    >
      <button
        data-drag-controls
        {...attributes}
        {...listeners}
        disabled={disabled || task.readOnly}
        aria-label={`Kéo ngày ${task.title}`}
      >
        ⠿
      </button>
      <button onClick={onOpen}>{task.title}</button>
    </div>
  );
}
function Day({
  date,
  tasks,
  disabled,
  onAdd,
  onOpen,
}: {
  date: string;
  tasks: Task[];
  disabled: boolean;
  onAdd: () => void;
  onOpen: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: date, disabled });
  return (
    <section ref={setNodeRef} className={isOver ? "todo-drop-active" : ""}>
      <button
        disabled={disabled}
        onClick={onAdd}
        aria-label={`Thêm việc ngày ${date}`}
      >
        {date.slice(8)}/{date.slice(5, 7)}
      </button>
      {tasks.map((t) => (
        <Item
          key={t.id}
          task={t}
          disabled={disabled}
          onOpen={() => onOpen(t)}
        />
      ))}
    </section>
  );
}
export function CalendarView({
  filters,
  disabled,
  onAdd,
  onOpen,
  onMove,
}: {
  filters: Record<string, string>;
  disabled: boolean;
  onAdd: (date: string) => void;
  onOpen: (task: Task) => void;
  onMove: (task: Task, date: string) => void;
}) {
  const user = useAuthStore((s) => s.user)!;
  const [anchor, setAnchor] = useState(() =>
      localInputDate(new Date(), user.timezone),
    ),
    [mode, setMode] = useState<"week" | "month">("week");
  const d = new Date(anchor + "T12:00:00Z"),
    start =
      mode === "week"
        ? add(anchor, -((d.getUTCDay() + 6) % 7))
        : anchor.slice(0, 8) + "01",
    end =
      mode === "week"
        ? add(start, 6)
        : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12))
            .toISOString()
            .slice(0, 10);
  const days: string[] = [];
  for (let date = start; date <= end; date = add(date, 1)) days.push(date);
  const calendarParams = { ...filters, from: start, to: end };
  const q = useQuery({
    queryKey: ["tasks", user.id, "calendar", calendarParams],
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const items: Task[] = [];
      let page = 1,
        total = Infinity;
      while (items.length < total) {
        const result = (
          await apiClient.get<TaskPage>("/tasks", {
            params: { ...calendarParams, limit: 100, page },
          })
        ).data;
        items.push(...result.items);
        total = result.total;
        if (!result.items.length) break;
        page++;
      }
      return { items, total };
    },
  });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const shift = (direction: number) => {
    if (mode === "week") setAnchor(add(anchor, direction * 7));
    else
      setAnchor(
        new Date(
          Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + direction, 1, 12),
        )
          .toISOString()
          .slice(0, 10),
      );
  };
  return (
    <div>
      <div className="todo-calendar-nav">
        <Button onClick={() => shift(-1)}>Trước</Button>
        <strong>
          {start} – {end}
        </strong>
        <Button onClick={() => shift(1)}>Sau</Button>
        <Button
          onClick={() => setAnchor(localInputDate(new Date(), user.timezone))}
        >
          Hôm nay
        </Button>
        <label>
          Kiểu lịch
          <select
            aria-label="Kiểu lịch"
            value={mode}
            onChange={(e) => setMode(e.target.value as "week" | "month")}
          >
            <option value="week">Tuần</option>
            <option value="month">Tháng</option>
          </select>
        </label>
      </div>
      {q.isPending ? (
        <p role="status">Đang tải lịch…</p>
      ) : q.isError ? (
        <p role="alert">
          {errorMessage(q.error)}{" "}
          <Button onClick={() => void q.refetch()}>Thử lại</Button>
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          onDragEnd={({ active, over }) => {
            const task = q.data?.items.find((t) => t.id === active.id);
            if (
              !disabled &&
              task &&
              !task.readOnly &&
              over &&
              days.includes(String(over.id))
            )
              onMove(task, String(over.id));
          }}
        >
          <div className={`todo-calendar-grid ${mode}`}>
            {days.map((date) => (
              <Day
                key={date}
                date={date}
                tasks={q.data!.items.filter((t) => t.deadline === date)}
                disabled={disabled}
                onAdd={() => onAdd(date)}
                onOpen={onOpen}
              />
            ))}
          </div>
        </DndContext>
      )}
    </div>
  );
}
