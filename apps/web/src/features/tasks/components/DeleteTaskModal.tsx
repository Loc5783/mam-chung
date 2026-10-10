import { useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui";
import { errorMessage } from "../../../lib/apiClient";
import type { Task } from "../types";

export function DeleteTaskModal({
  task,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  task: Task;
  busy: boolean;
  error?: unknown;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [confirm, setConfirm] = useState(false);

  return (
    <Modal title="Xóa công việc" onClose={onClose} busy={busy}>
      <p>Xóa “{task.title}”? Bản lặp đã tạo trước đó vẫn được giữ.</p>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={confirm}
          onChange={(e) => setConfirm(e.target.checked)}
        />
        Tôi xác nhận xóa công việc này.
      </label>
      {Boolean(error) && (
        <p role="alert" className="form-error">
          {errorMessage(error)}
        </p>
      )}
      <div className="modal-actions">
        <Button className="button-outline" onClick={onClose}>
          Hủy
        </Button>
        <Button disabled={!confirm || busy} onClick={onConfirm}>
          Xác nhận xóa
        </Button>
      </div>
    </Modal>
  );
}
