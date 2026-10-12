import { Button } from "../../../components/ui";
import type { Task } from "../types";

export function TaskUndoToasts({
  bulkUndo,
  undo,
  selectedId,
  online,
  isWritePending,
  isBulkUndoPending,
  onTriggerBulkUndo,
  onDismissBulkUndo,
  onTriggerSingleUndo,
  onDismissSingleUndo,
}: {
  bulkUndo: { items: { id: string }[] } | null;
  undo: { task: Task; status?: string; restore?: boolean } | null;
  selectedId: string | null;
  online: boolean;
  isWritePending: boolean;
  isBulkUndoPending: boolean;
  onTriggerBulkUndo: () => void;
  onDismissBulkUndo: () => void;
  onTriggerSingleUndo: () => void;
  onDismissSingleUndo: () => void;
}) {
  return (
    <>
      {bulkUndo && (
        <div className="todo-undo-toast" role="status">
          <span>Đã cập nhật nhóm việc.</span>
          <Button
            disabled={!online || isBulkUndoPending}
            onClick={onTriggerBulkUndo}
          >
            Hoàn tác nhóm
          </Button>
          <button aria-label="Đóng hoàn tác nhóm" onClick={onDismissBulkUndo}>
            ×
          </button>
        </div>
      )}

      {undo && undo.task.id !== selectedId && (
        <div className="todo-undo-toast" role="status">
          <span>
            {undo.restore ? "Đã xóa công việc." : "Đã hoàn thành công việc 🌱"}
          </span>
          <Button
            className="button-outline"
            disabled={isWritePending || !online}
            onClick={onTriggerSingleUndo}
          >
            Hoàn tác
          </Button>
          <button aria-label="Đóng hoàn tác" onClick={onDismissSingleUndo}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
