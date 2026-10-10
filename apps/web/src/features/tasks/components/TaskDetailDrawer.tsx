import { TaskExtras } from "./TaskExtras";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { CheckCircle2, Heart } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui";
import {
  apiClient,
  errorMessage,
  getSessionEpoch,
} from "../../../lib/apiClient";
import { useAuthStore } from "../../auth/store";
import { useOnline } from "../lib/useOnline";
import { Task, TaskList, Members, statuses, priorities } from "../types";
const schema = z
  .object({
    title: z.string().trim().min(1, "Nhập tiêu đề công việc.").max(160),
    description: z.string().max(2000),
    deadline: z.string(),
    startDate: z.string(),
    deadlineHasTime: z.boolean(),
    deadlineTime: z.string(),
    estimateMinutes: z
      .string()
      .refine(
        (v) =>
          !v ||
          (Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) <= 525600),
        "Ước lượng thời gian không hợp lệ.",
      ),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
    recurrence: z.enum(["none", "daily", "weekly", "monthly"]),
    assignedTo: z.string(),
    listId: z.string(),
    labels: z.string(),
  })
  .refine(
    (v) => v.recurrence === "none" || !!v.deadline,
    "Việc lặp lại cần hạn chót.",
  )
  .refine(
    (v) => !v.startDate || !v.deadline || v.startDate <= v.deadline,
    "Ngày bắt đầu phải trước hoặc bằng hạn chót.",
  )
  .refine(
    (v) =>
      !v.deadlineHasTime ||
      (!!v.deadline && /^([01]\d|2[0-3]):[0-5]\d$/.test(v.deadlineTime)),
    "Hạn có giờ cần ngày và giờ hợp lệ.",
  );
const initial = (task: Task) => ({
  title: task.title,
  description: task.description,
  deadline: task.deadline ?? "",
  startDate: task.startDate ?? "",
  deadlineHasTime: task.deadlineHasTime ?? false,
  deadlineTime: task.deadlineTime ?? "",
  estimateMinutes: task.estimateMinutes?.toString() ?? "",
  priority: task.priority,
  recurrence: task.recurrence,
  assignedTo: task.assignedTo ?? "",
  listId: task.listId ?? "",
  labels: task.labels.join(", "),
});
export function TaskDetailDrawer({
  task,
  members,
  lists,
  onClose,
  onStatus,
  onComments,
  busy = false,
  onUndo,
  onFocus,
}: {
  task: Task;
  members: Members;
  lists: TaskList[];
  onClose: () => void;
  onStatus: (status: Task["status"]) => void;
  onComments: () => void;
  busy?: boolean;
  onUndo?: () => void;
  onFocus?: () => void;
}) {
  const user = useAuthStore((s) => s.user)!,
    online = useOnline(),
    client = useQueryClient();
  const [draft, setDraft] = useState(() => initial(task)),
    [baseline, setBaseline] = useState(() => JSON.stringify(initial(task))),
    [items, setItems] = useState(task.checklist),
    [itemBaseline, setItemBaseline] = useState(() =>
      JSON.stringify(task.checklist),
    ),
    [newItem, setNewItem] = useState(""),
    [failed, setFailed] = useState(false),
    [saved, setSaved] = useState(false);
  const server = useRef(task),
    alive = useRef(true),
    epoch = useRef(getSessionEpoch());
  const dirty =
    JSON.stringify(draft) !== baseline ||
    JSON.stringify(items) !== itemBaseline;
  const parsed = schema.safeParse(draft);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!dirty && task.revision > server.current.revision) {
      server.current = task;
      const value = initial(task);
      setDraft(value);
      setBaseline(JSON.stringify(value));
      setItems(task.checklist);
      setItemBaseline(JSON.stringify(task.checklist));
    }
  }, [task, dirty]);
  const save = useMutation({
    networkMode: "always",
    mutationFn: async () => {
      if (epoch.current !== getSessionEpoch())
        throw new Error("Phiên đăng nhập đã thay đổi.");
      if (!navigator.onLine)
        throw new Error("Mất kết nối. Nội dung chưa được lưu.");
      const v = schema.parse(draft),
        { deadlineHasTime, deadlineTime, estimateMinutes, ...rest } = v;
      const response = await apiClient.put<Task>(`/tasks/${task.id}`, {
        ...rest,
        deadline: v.deadline || null,
        startDate: v.startDate || null,
        listId: v.listId || null,
        assignedTo: v.assignedTo || null,
        labels: v.labels
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        deadlineHasTime,
        deadlineTime: deadlineHasTime ? deadlineTime : null,
        deadlineTimezone: deadlineHasTime
          ? (server.current.deadlineTimezone ?? user.timezone)
          : null,
        estimateMinutes: estimateMinutes ? Number(estimateMinutes) : null,
        checklist: items,
        revision: server.current.revision,
      });
      return {
        task: response.data,
        draft: JSON.stringify(draft),
        items: JSON.stringify(items),
      };
    },
    onSuccess: ({ task: updated, draft: sent, items: sentItems }) => {
      if (!alive.current || epoch.current !== getSessionEpoch()) return;
      if (updated.id) server.current = updated;
      setBaseline(sent);
      setItemBaseline(sentItems);
      setSaved(true);
      setFailed(false);
      for (const key of ["tasks", "dashboard", "notifications", "couple"])
        void client.invalidateQueries({ queryKey: [key, user.id] });
    },
    onError: () => {
      if (alive.current && epoch.current === getSessionEpoch()) setFailed(true);
    },
  });
  const run = save.mutate;
  useEffect(() => {
    if (
      !dirty ||
      save.isPending ||
      busy ||
      failed ||
      task.readOnly ||
      !online ||
      !parsed.success
    )
      return;
    const timer = setTimeout(() => run(), 650);
    return () => clearTimeout(timer);
  }, [
    dirty,
    draft,
    items,
    save.isPending,
    busy,
    failed,
    task.readOnly,
    online,
    parsed.success,
    run,
  ]);
  const change = (key: keyof typeof draft, value: string | boolean) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  };
  const disabled = task.readOnly || save.isPending || busy || !online;
  const safeClose = () => {
    if (!dirty && !save.isPending && !busy) onClose();
  };
  return (
    <Modal
      title="Chi tiết công việc"
      variant="drawer"
      onClose={safeClose}
      busy={dirty || save.isPending || busy}
    >
      <div className="todo-detail-context">
        {task.coupleId ? (
          <>
            <Heart size={14} />
            Việc chung
          </>
        ) : (
          "Việc cá nhân"
        )}
        <span role="status">
          {task.readOnly ? (
            "Chỉ đọc"
          ) : !online ? (
            "Mất kết nối · Chưa lưu"
          ) : save.isPending ? (
            "Đang lưu…"
          ) : dirty ? (
            "Có thay đổi chưa lưu"
          ) : saved ? (
            <>
              <CheckCircle2 size={14} />
              Đã lưu
            </>
          ) : (
            "Tự động lưu khi chỉnh sửa"
          )}
        </span>
      </div>
      <fieldset disabled={disabled} className="todo-detail-fields">
        <label>
          Tiêu đề
          <input
            aria-label="Tiêu đề công việc"
            value={draft.title}
            maxLength={160}
            onChange={(e) => change("title", e.target.value)}
          />
        </label>
        <label>
          Mô tả
          <textarea
            aria-label="Mô tả công việc"
            value={draft.description}
            maxLength={2000}
            rows={4}
            onChange={(e) => change("description", e.target.value)}
          />
        </label>
        <div className="form-two-columns">
          <label>
            Trạng thái
            <select
              aria-label="Trạng thái trong chi tiết"
              value={task.status}
              disabled={disabled || dirty}
              onChange={(e) => onStatus(e.target.value as Task["status"])}
            >
              {Object.entries(statuses).map(([key, name]) => (
                <option value={key} key={key}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ưu tiên
            <select
              aria-label="Ưu tiên công việc"
              value={draft.priority}
              onChange={(e) => change("priority", e.target.value)}
            >
              {Object.entries(priorities).map(([key, name]) => (
                <option value={key} key={key}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ngày bắt đầu
            <input
              type="date"
              aria-label="Ngày bắt đầu"
              value={draft.startDate}
              onChange={(e) => change("startDate", e.target.value)}
            />
          </label>
          <label>
            Hạn chót
            <input
              type="date"
              aria-label="Hạn chót công việc"
              value={draft.deadline}
              onChange={(e) => change("deadline", e.target.value)}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={draft.deadlineHasTime}
              onChange={(e) => change("deadlineHasTime", e.target.checked)}
            />
            Có giờ hạn chót
          </label>
          {draft.deadlineHasTime && (
            <label>
              Giờ hạn chót
              <input
                type="time"
                aria-label="Giờ hạn chót"
                value={draft.deadlineTime}
                onChange={(e) => change("deadlineTime", e.target.value)}
              />
            </label>
          )}
          <label>
            Ước lượng (phút)
            <input
              aria-label="Ước lượng thời gian"
              type="number"
              min={1}
              max={525600}
              value={draft.estimateMinutes}
              onChange={(e) => change("estimateMinutes", e.target.value)}
            />
          </label>
          <label>
            Lặp lại
            <select
              aria-label="Lặp lại công việc"
              value={draft.recurrence}
              onChange={(e) => change("recurrence", e.target.value)}
            >
              <option value="none">Không lặp</option>
              <option value="daily">Hằng ngày</option>
              <option value="weekly">Hằng tuần</option>
              <option value="monthly">Hằng tháng</option>
            </select>
          </label>
          <label>
            Danh sách
            <select
              aria-label="Danh sách công việc"
              value={draft.listId}
              onChange={(e) => change("listId", e.target.value)}
            >
              <option value="">Hộp thư mặc định</option>
              {lists
                .filter(
                  (l) => !!l.coupleId === !!task.coupleId && !l.archivedAt,
                )
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Người thực hiện
            <select
              aria-label="Người thực hiện công việc"
              value={draft.assignedTo}
              onChange={(e) => change("assignedTo", e.target.value)}
            >
              <option value="">Chưa giao</option>
              {(task.coupleId
                ? members.items
                : [{ id: user.id, name: user.name }]
              ).map((m) => (
                <option value={m.id} key={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Nhãn
          <input
            aria-label="Nhãn công việc"
            value={draft.labels}
            placeholder="Ngăn cách bằng dấu phẩy"
            onChange={(e) => change("labels", e.target.value)}
          />
        </label>
        <h3>
          Việc con · {items.filter((i) => i.done).length}/{items.length}
        </h3>
        <progress
          max={items.length || 1}
          value={items.filter((i) => i.done).length}
          aria-label="Tiến độ việc con"
        />
        {items.map((item) => (
          <div className="todo-detail-subtask" key={item.id}>
            <input
              aria-label={`Hoàn thành ${item.text}`}
              type="checkbox"
              checked={item.done}
              onChange={(e) =>
                setItems((all) =>
                  all.map((i) =>
                    i.id === item.id ? { ...i, done: e.target.checked } : i,
                  ),
                )
              }
            />
            <input
              aria-label={`Nội dung ${item.text}`}
              value={item.text}
              maxLength={200}
              onChange={(e) =>
                setItems((all) =>
                  all.map((i) =>
                    i.id === item.id ? { ...i, text: e.target.value } : i,
                  ),
                )
              }
            />
            <button
              aria-label={`Bỏ ${item.text}`}
              onClick={() =>
                setItems((all) => all.filter((i) => i.id !== item.id))
              }
            >
              ×
            </button>
          </div>
        ))}
        <form
          className="task-add-item"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newItem.trim() || items.length >= 100) return;
            setItems((all) => [
              ...all,
              { id: crypto.randomUUID(), text: newItem.trim(), done: false },
            ]);
            setNewItem("");
          }}
        >
          <input
            aria-label="Thêm việc con"
            value={newItem}
            maxLength={200}
            onChange={(e) => setNewItem(e.target.value)}
          />
          <Button disabled={!newItem.trim() || items.length >= 100}>
            Thêm mục
          </Button>
        </form>
      </fieldset>
      {dirty && !parsed.success && (
        <p role="alert" className="form-error">
          {parsed.error.issues[0].message}
        </p>
      )}
      {save.isError && (
        <p role="alert" className="form-error">
          {errorMessage(save.error)} Nội dung đang nhập được giữ. Nếu có xung
          đột, sao chép nội dung rồi đóng và mở lại để tải phiên bản mới.
        </p>
      )}
      <div className="todo-detail-footer">
        {onUndo && (
          <Button
            className="button-outline"
            disabled={dirty || disabled}
            onClick={onUndo}
          >
            Hoàn tác
          </Button>
        )}
        {task.coupleId && (
          <Button
            className="button-outline"
            disabled={dirty || save.isPending}
            onClick={onComments}
          >
            Bình luận
          </Button>
        )}
        {dirty && (
          <>
            <Button
              disabled={disabled || !parsed.success}
              onClick={() => {
                setFailed(false);
                run();
              }}
            >
              Lưu ngay
            </Button>
            <Button
              className="button-outline"
              disabled={save.isPending}
              onClick={onClose}
            >
              Bỏ thay đổi và đóng
            </Button>
          </>
        )}
      </div>
      <TaskExtras
        task={server.current}
        disabled={task.readOnly || !online || dirty || save.isPending || busy}
        onFocus={onFocus}
      />
    </Modal>
  );
}
