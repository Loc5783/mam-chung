import { useState } from "react";
import { Button } from "../../../components/ui";
import { Modal } from "../../../components/ui/Modal";
import { apiClient, errorMessage } from "../../../lib/apiClient";
import { useTasksQuery, useTaskMutation } from "../api";
export function TemplatePicker({
  listId,
  disabled,
  onList,
}: {
  listId: string;
  disabled: boolean;
  onList: (id: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [picked, setPicked] = useState("");
  const q = useTasksQuery<{
    items: { id: string; name: string; count: number; readOnly: boolean }[];
  }>("/task-templates", { limit: 100 }, open);
  const save = useTaskMutation(
    async () => apiClient.post("/task-templates", { listId, name }),
    () => setName(""),
  );
  const apply = useTaskMutation(
    async () =>
      apiClient.post<{ list: { id: string } }>(
        `/task-templates/${picked}/apply`,
        { name },
      ),
    (result) => {
      onList((result as { data: { list: { id: string } } }).data.list.id);
      setOpen(false);
      setName("");
    },
  );
  return (
    <>
      <Button className="button-outline" onClick={() => setOpen(true)}>
        Mẫu danh sách
      </Button>
      {open && (
        <Modal
          title="Mẫu danh sách"
          busy={save.isPending || apply.isPending}
          onClose={() => setOpen(false)}
        >
          <label>
            Tên mẫu / danh sách mới
            <input
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {listId && (
            <Button
              disabled={
                disabled || !name.trim() || save.isPending || apply.isPending
              }
              onClick={() => save.mutate()}
            >
              Lưu danh sách hiện tại thành mẫu
            </Button>
          )}
          {q.isPending ? (
            <p>Đang tải mẫu…</p>
          ) : q.isError ? (
            <p role="alert">
              {errorMessage(q.error)}{" "}
              <Button onClick={() => void q.refetch()}>Thử lại</Button>
            </p>
          ) : (
            <label>
              Chọn mẫu
              <select
                value={picked}
                onChange={(e) => setPicked(e.target.value)}
              >
                <option value="">Chọn…</option>
                {q.data?.items.map((t) => (
                  <option key={t.id} value={t.id} disabled={t.readOnly}>
                    {t.name} · {t.count} việc
                  </option>
                ))}
              </select>
            </label>
          )}
          <p>
            Mẫu giữ nội dung, nhãn và checklist; đặt lại việc con chưa xong.
            Việc thường không có hạn, việc lặp bắt đầu hôm nay.
          </p>
          <Button
            disabled={
              disabled ||
              !picked ||
              !name.trim() ||
              save.isPending ||
              apply.isPending
            }
            onClick={() => apply.mutate()}
          >
            Tạo danh sách từ mẫu
          </Button>
          {save.isError && <p role="alert">{errorMessage(save.error)}</p>}
          {apply.isError && <p role="alert">{errorMessage(apply.error)}</p>}
        </Modal>
      )}
    </>
  );
}
