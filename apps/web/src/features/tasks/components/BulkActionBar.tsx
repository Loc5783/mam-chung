import { useState } from "react";
import { Button } from "../../../components/ui";
import { Modal } from "../../../components/ui/Modal";
import { apiClient, errorMessage } from "../../../lib/apiClient";
import { useTaskMutation } from "../api";
import { type Task, type TaskList, type Members, priorities } from "../types";
export function BulkActionBar({
  tasks,
  lists,
  members,
  disabled,
  onClear,
  onUndo,
}: {
  tasks: Task[];
  lists: TaskList[];
  members: Members;
  disabled: boolean;
  onClear: () => void;
  onUndo: (payload: {
    items: {
      id: string;
      revision: number;
      restore?: boolean;
      changes?: Record<string, unknown>;
    }[];
  }) => void;
}) {
  const [date, setDate] = useState(""),
    [labels, setLabels] = useState(""),
    [confirm, setConfirm] = useState(false);
  const update = useTaskMutation(
    async (changes: Record<string, unknown>) => {
      const snapshots = tasks.map((t) => ({ ...t }));
      const response = await apiClient.patch<{ items: Task[] }>("/tasks/bulk", {
        action: "update",
        items: snapshots.map((t) => ({ id: t.id, revision: t.revision })),
        changes,
      });
      return { response, snapshots, changes };
    },
    (result) => {
      const { response, snapshots, changes } = result as {
        response: { data: { items: Task[] } };
        snapshots: Task[];
        changes: Record<string, unknown>;
      };
      if (Array.isArray(response.data.items))
        onUndo({
          items: snapshots.map((t) => ({
            id: t.id,
            revision: response.data.items.find((r) => r.id === t.id)!.revision,
            changes: Object.fromEntries(
              Object.keys(changes).map((key) => {
                const name = key === "addLabels" ? "labels" : key;
                return [name, t[name as keyof Task]];
              }),
            ),
          })),
        });
      onClear();
    },
  );
  const remove = useTaskMutation(
    async () => {
      const snapshots = tasks.map((t) => ({ ...t }));
      const response = await apiClient.patch<{ items: Task[] }>("/tasks/bulk", {
        action: "delete",
        items: snapshots.map((t) => ({ id: t.id, revision: t.revision })),
      });
      return { response, snapshots };
    },
    (result) => {
      const { response, snapshots } = result as {
        response: { data: { items: Task[] } };
        snapshots: Task[];
      };
      if (Array.isArray(response.data.items))
        onUndo({
          items: snapshots.map((t) => ({
            id: t.id,
            revision: response.data.items.find((r) => r.id === t.id)!.revision,
            restore: true,
          })),
        });
      setConfirm(false);
      onClear();
    },
  );
  const blocked = disabled || update.isPending || remove.isPending;
  const compatible = lists.filter(
    (l) =>
      !l.readOnly &&
      !l.archivedAt &&
      tasks.every((t) => t.coupleId === l.coupleId),
  );
  return (
    <section className="todo-bulk" aria-label="Thao tác hàng loạt">
      <strong>Đã chọn {tasks.length} việc</strong>
      <Button
        disabled={blocked}
        onClick={() => update.mutate({ status: "DONE" })}
      >
        Hoàn thành đã chọn
      </Button>
      <label>
        Ưu tiên
        <select
          aria-label="Ưu tiên hàng loạt"
          disabled={blocked}
          value=""
          onChange={(e) => update.mutate({ priority: e.target.value })}
        >
          <option value="">Chọn…</option>
          {Object.entries(priorities).map(([value, name]) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Hạn
        <input
          type="date"
          value={date}
          disabled={blocked}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <Button
        disabled={blocked || !date}
        onClick={() => update.mutate({ deadline: date })}
      >
        Đặt hạn
      </Button>
      <label>
        Giao việc
        <select
          aria-label="Giao việc hàng loạt"
          value=""
          disabled={blocked}
          onChange={(e) =>
            update.mutate({
              assignedTo: e.target.value === "none" ? null : e.target.value,
            })
          }
        >
          <option value="">Chọn…</option>
          <option value="none">Chưa giao</option>
          {members.items.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Chuyển danh sách
        <select
          aria-label="Danh sách hàng loạt"
          value=""
          disabled={blocked}
          onChange={(e) => update.mutate({ listId: e.target.value })}
        >
          <option value="">Chọn…</option>
          {compatible.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Thêm nhãn
        <input
          value={labels}
          maxLength={310}
          disabled={blocked}
          placeholder="nhà, cuối-tuần"
          onChange={(e) => setLabels(e.target.value)}
        />
      </label>
      <Button
        disabled={blocked || !labels.trim()}
        onClick={() =>
          update.mutate({
            addLabels: labels
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
      >
        Gắn nhãn
      </Button>
      <Button disabled={blocked} onClick={() => setConfirm(true)}>
        Xóa đã chọn
      </Button>
      <Button disabled={blocked} onClick={onClear}>
        Bỏ chọn
      </Button>
      {update.isError && <p role="alert">{errorMessage(update.error)}</p>}
      {remove.isError && <p role="alert">{errorMessage(remove.error)}</p>}
      {confirm && (
        <Modal
          title={`Xóa ${tasks.length} việc?`}
          busy={remove.isPending}
          onClose={() => setConfirm(false)}
        >
          <p>Các việc được xóa mềm và có thể khôi phục trong 30 ngày.</p>
          <Button disabled={blocked} onClick={() => remove.mutate()}>
            Xác nhận xóa đã chọn
          </Button>
        </Modal>
      )}
    </section>
  );
}
