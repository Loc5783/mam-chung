import { useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui";
import { apiClient, errorMessage } from "../../../lib/apiClient";
import { useAuthStore } from "../../auth/store";
import { useTaskMutation, useTasksQuery } from "../api";
import { TaskSkeleton } from "./TaskGroup";
import type { Task } from "../types";

export type CommentPage = {
  items: { id: string; authorName: string; text: string; createdAt: string }[];
  total: number;
  readOnly: boolean;
};

export function TaskCommentsModal({
  task,
  onClose,
}: {
  task: Task;
  onClose: () => void;
}) {
  const zone = useAuthStore((s) => s.user!.timezone);
  const [page, setPage] = useState(1);
  const [text, setText] = useState("");
  const q = useTasksQuery<CommentPage>(`/tasks/${task.id}/comments`, {
    page,
    limit: 20,
  });
  const add = useTaskMutation(
    async () =>
      apiClient.post(`/tasks/${task.id}/comments`, { text: text.trim() }),
    () => {
      setText("");
      if (q.data) setPage(Math.ceil((q.data.total + 1) / 20));
    },
  );

  return (
    <Modal
      title={`Bình luận · ${task.title}`}
      onClose={onClose}
      busy={add.isPending}
    >
      {q.isPending ? (
        <TaskSkeleton />
      ) : q.isError ? (
        <p role="alert" className="form-error">
          {errorMessage(q.error)}
        </p>
      ) : (
        <>
          <div className="task-comments">
            {q.data.items.map((c) => (
              <article key={c.id}>
                <b>{c.authorName}</b>
                <small>
                  {new Date(c.createdAt).toLocaleString("vi-VN", {
                    timeZone: zone,
                  })}
                </small>
                <p>{c.text}</p>
              </article>
            ))}
            {!q.data.total && <p>Chưa có bình luận.</p>}
          </div>
          <div className="pagination">
            <span>
              {q.data.total} bình luận · Trang {page}
            </span>
            <Button
              className="button-outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Trước
            </Button>
            <Button
              className="button-outline"
              disabled={page * 20 >= q.data.total}
              onClick={() => setPage(page + 1)}
            >
              Sau
            </Button>
          </div>
          {!q.data.readOnly && (
            <form
              className="settings-form finance-form task-form"
              onSubmit={(e) => {
                e.preventDefault();
                add.mutate();
              }}
            >
              <label>
                Bình luận ngắn
                <textarea
                  aria-label="Bình luận ngắn"
                  value={text}
                  maxLength={500}
                  disabled={add.isPending}
                  onChange={(e) => setText(e.target.value)}
                />
              </label>
              <Button disabled={!text.trim() || add.isPending}>
                Gửi bình luận
              </Button>
            </form>
          )}
        </>
      )}
      {add.isError && (
        <p role="alert" className="form-error">
          {errorMessage(add.error)}
        </p>
      )}
    </Modal>
  );
}
