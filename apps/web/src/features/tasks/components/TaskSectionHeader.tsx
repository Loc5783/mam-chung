import { Plus, HelpCircle } from "lucide-react";
import { Button } from "../../../components/ui";

export function TaskSectionHeader({
  title,
  total,
  readOnly,
  canAdd,
  onOpenShortcuts,
  onAddTask,
}: {
  title: string;
  total?: number;
  readOnly: boolean;
  canAdd: boolean;
  onOpenShortcuts: () => void;
  onAddTask: () => void;
}) {
  return (
    <div className="todo-section-heading">
      <div className="todo-heading-info">
        <h2>{title}</h2>
        <small>{total ?? "—"} việc</small>
      </div>
      <div className="todo-heading-actions">
        <button
          type="button"
          className="button-icon-subtle"
          aria-label="Hướng dẫn phím tắt & cử chỉ"
          title="Hướng dẫn phím tắt & cử chỉ (?)"
          onClick={onOpenShortcuts}
        >
          <HelpCircle size={18} />
        </button>
        {!readOnly && (
          <Button onClick={onAddTask} disabled={!canAdd}>
            <Plus size={18} />
            Thêm công việc
          </Button>
        )}
      </div>
    </div>
  );
}
