import { Modal } from "../../../components/ui/Modal";
import { useState } from "react";
import { Button } from "../../../components/ui";
import { apiClient, errorMessage } from "../../../lib/apiClient";
import { useAuthStore } from "../../auth/store";
import { useTasksQuery, useTaskMutation } from "../api";
import type { Task } from "../types";
export function TaskExtras({
  task,
  disabled,
  onFocus,
}: {
  task: Task;
  disabled: boolean;
  onFocus?: () => void;
}) {
  const user = useAuthStore((s) => s.user)!,
    [mode, setMode] = useState("60"),
    [local, setLocal] = useState("");
  const [confirmScope, setConfirmScope] = useState(false);
  const moveScope = useTaskMutation(
    async () =>
      apiClient.post(`/tasks/${task.id}/scope`, {
        revision: task.revision,
        scope: task.coupleId ? "personal" : "shared",
      }),
    () => setConfirmScope(false),
  );
  const activity = useTasksQuery<{
    items: {
      id: string;
      actorName: string;
      message: string;
      createdAt: string;
    }[];
  }>(`/tasks/${task.id}/activity`, { limit: 20 });
  const nudge = useTaskMutation(async () =>
    apiClient.post(`/tasks/${task.id}/nudge`, {}),
  );
  const duplicate = useTaskMutation(async () =>
    apiClient.post(`/tasks/${task.id}/duplicate`, {}),
  );
  const reminder = useTaskMutation(async () =>
    apiClient.post(`/tasks/${task.id}/reminder`, {
      revision: task.revision,
      ...(mode === "off"
        ? { mode: "off" }
        : mode === "custom"
          ? { mode: "custom", local }
          : { mode: "before", minutes: Number(mode) }),
    }),
  );
  const promote = useTaskMutation(async (id: string) =>
    apiClient.post(`/tasks/${task.id}/subtasks/${id}/promote`, {
      revision: task.revision,
    }),
  );
  const blocked =
    disabled ||
    nudge.isPending ||
    duplicate.isPending ||
    reminder.isPending ||
    promote.isPending ||
    moveScope.isPending;
  return (
    <section className="todo-extras">
      <h3>Nhắc hẹn và tập trung</h3>
      {task.reminderAt && (
        <p>
          Nhắc lúc{" "}
          {new Intl.DateTimeFormat("vi-VN", {
            timeZone: user.timezone,
            dateStyle: "short",
            timeStyle: "short",
          }).format(new Date(task.reminderAt))}
        </p>
      )}
      <label>
        Nhắc trước
        <select
          aria-label="Kiểu nhắc công việc"
          value={mode}
          disabled={blocked}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="10">10 phút</option>
          <option value="60">1 giờ</option>
          <option value="1440">1 ngày</option>
          <option value="custom">Tùy chỉnh</option>
          <option value="off">Tắt nhắc</option>
        </select>
      </label>
      {mode === "custom" && (
        <label>
          Thời điểm ({user.timezone})
          <input
            aria-label="Thời điểm nhắc"
            type="datetime-local"
            value={local}
            disabled={blocked}
            onChange={(e) => setLocal(e.target.value)}
          />
        </label>
      )}
      <p>
        Hạn không có giờ dùng 18:00 theo múi giờ tài khoản. Thông báo xuất hiện
        trong ứng dụng khi máy chủ đang chạy.
      </p>
      <Button
        disabled={blocked || (mode === "custom" && !local)}
        onClick={() => reminder.mutate()}
      >
        Lưu nhắc hẹn
      </Button>
      {onFocus && (
        <Button disabled={blocked} onClick={onFocus}>
          Tập trung việc này
        </Button>
      )}
      {task.coupleId && task.assignedTo && task.assignedTo !== user.id && (
        <Button
          disabled={blocked || ["DONE", "CANCELLED"].includes(task.status)}
          onClick={() => nudge.mutate()}
        >
          Nhắc nhẹ 💌
        </Button>
      )}
      <Button disabled={blocked} onClick={() => duplicate.mutate()}>
        Nhân bản việc
      </Button>
      <Button
        disabled={blocked || (!!task.coupleId && task.createdBy !== user.id)}
        onClick={() => setConfirmScope(true)}
      >
        {task.coupleId
          ? "Chuyển thành việc cá nhân"
          : "Chuyển thành việc chung"}
      </Button>
      {confirmScope && (
        <Modal
          title="Chuyển không gian công việc?"
          busy={moveScope.isPending}
          onClose={() => setConfirmScope(false)}
        >
          <p>
            {task.coupleId
              ? "Việc chuyển về Hộp thư vào cá nhân. Người ấy sẽ không còn thấy việc này."
              : "Người ấy sẽ thấy và có thể sửa việc này. Việc chuyển vào Hộp thư vào chung."}{" "}
            Người thực hiện sẽ được đặt là bạn.
          </p>
          <Button disabled={blocked} onClick={() => moveScope.mutate()}>
            Xác nhận chuyển
          </Button>
          {moveScope.isError && (
            <p role="alert">{errorMessage(moveScope.error)}</p>
          )}
        </Modal>
      )}
      {task.checklist.length > 0 && (
        <details>
          <summary>Chuyển việc con thành việc riêng</summary>
          {task.checklist.map((item) => (
            <Button
              key={item.id}
              disabled={blocked}
              onClick={() => promote.mutate(item.id)}
            >
              Chuyển: {item.text}
            </Button>
          ))}
        </details>
      )}
      {[nudge, duplicate, reminder, promote].map(
        (m, index) =>
          m.isError && (
            <p key={index} role="alert">
              {errorMessage(m.error)}
            </p>
          ),
      )}
      <details>
        <summary>Dòng thời gian hoạt động</summary>
        {activity.isPending ? (
          <p>Đang tải…</p>
        ) : activity.isError ? (
          <p role="alert">
            {errorMessage(activity.error)}{" "}
            <Button onClick={() => void activity.refetch()}>Thử lại</Button>
          </p>
        ) : activity.data?.items.length ? (
          <ol>
            {activity.data.items.map((row) => (
              <li key={row.id}>
                {row.actorName} {row.message} ·{" "}
                {new Date(row.createdAt).toLocaleString("vi-VN", {
                  timeZone: user.timezone,
                })}
              </li>
            ))}
          </ol>
        ) : (
          <p>Chưa có hoạt động được ghi nhận.</p>
        )}
      </details>
    </section>
  );
}
