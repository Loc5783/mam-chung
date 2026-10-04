import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../auth/store";
import { apiClient, errorMessage, getSessionEpoch } from "../../lib/apiClient";
import { Button, Skeleton } from "../../components/ui";
import { Modal } from "../../components/ui/Modal";
export type Notice = {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string;
  payload: { sourceId: string };
  readAt: string | null;
  createdAt: string;
};
export type NoticePage = {
  items: Notice[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
};
export function NotificationBell() {
  const user = useAuthStore((s) => s.user)!,
    client = useQueryClient(),
    navigate = useNavigate();
  const [open, setOpen] = useState(false),
    [page, setPage] = useState(1),
    [unread, setUnread] = useState(false);
  const params = { page, limit: 20, ...(unread ? { unread: "true" } : {}) };
  const q = useQuery({
    queryKey: ["notifications", user.id, params],
    queryFn: async () =>
      (await apiClient.get<NoticePage>("/notifications", { params })).data,
    refetchInterval: 15000,
  });
  useEffect(() => {
    if (q.data)
      setPage((p) => Math.min(p, Math.max(1, Math.ceil(q.data.total / 20))));
  }, [q.data]);
  const read = useMutation({
    mutationFn: async (id: string | null) =>
      id
        ? apiClient.patch("/notifications/" + id + "/read", {})
        : apiClient.post("/notifications/read-all", {}),
    onMutate: () => ({ epoch: getSessionEpoch(), id: user.id }),
    onSuccess: (_r, _v, c) => {
      if (c?.epoch !== getSessionEpoch()) return;
      void client.invalidateQueries({ queryKey: ["notifications", c.id] });
    },
    onError: (_r, _v, c) => {
      if (c?.epoch === getSessionEpoch())
        void client.invalidateQueries({ queryKey: ["notifications", c.id] });
    },
  });
  const count = q.data?.unreadCount ?? 0;
  const visit = async (n: Notice) => {
    const epoch = getSessionEpoch();
    try {
      await read.mutateAsync(n.id);
      if (epoch !== getSessionEpoch()) return;
      if (/^\/(couple|shared|finance|tasks)(\?|$)/.test(n.href)) {
        setOpen(false);
        navigate(n.href);
      }
    } catch {
      /* Error displayed below. */
    }
  };
  return (
    <>
      <button
        className="notification-bell"
        aria-label={`Thông báo, ${count} chưa đọc`}
        onClick={() => setOpen(true)}
      >
        <Bell size={21} />
        {count > 0 && (
          <span className="notification-badge">
            {count > 99 ? "99+" : count}
          </span>
        )}
        {q.isError && (
          <span className="notification-error" aria-hidden="true">
            !
          </span>
        )}
      </button>
      {open && (
        <Modal
          title="Thông báo"
          onClose={() => setOpen(false)}
          busy={read.isPending}
        >
          <div className="notification-controls">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={unread}
                onChange={(e) => {
                  setUnread(e.target.checked);
                  setPage(1);
                }}
              />
              Chỉ chưa đọc
            </label>
            <Button
              className="button-outline"
              disabled={!count || read.isPending}
              onClick={() => read.mutate(null)}
            >
              Đọc tất cả
            </Button>
          </div>
          <p className="muted">
            {count} thông báo chưa đọc. Các nhắc nhở đã hết hiệu lực sẽ tự ẩn.
          </p>
          {q.isPending ? (
            <Skeleton />
          ) : q.isError ? (
            <>
              <p role="alert">{errorMessage(q.error)}</p>
              <Button onClick={() => void q.refetch()}>Thử lại</Button>
            </>
          ) : q.data.items.length ? (
            <div className="notification-list">
              {q.data.items.map((n) => (
                <article key={n.id} className={n.readAt ? "read" : "unread"}>
                  <h3>{n.title}</h3>
                  <p>{n.message}</p>
                  <small>
                    {new Intl.DateTimeFormat("vi-VN", {
                      dateStyle: "short",
                      timeStyle: "short",
                      timeZone: user.timezone,
                    }).format(new Date(n.createdAt))}
                  </small>
                  <div className="fitness-actions">
                    <Link
                      to={n.href}
                      onClick={(e) => {
                        e.preventDefault();
                        void visit(n);
                      }}
                    >
                      Xem chi tiết
                    </Link>
                    {!n.readAt && (
                      <Button
                        className="button-outline"
                        disabled={read.isPending}
                        onClick={() => read.mutate(n.id)}
                      >
                        Đánh dấu đã đọc
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p>Không có thông báo trong bộ lọc này.</p>
          )}
          {read.isError && <p role="alert">{errorMessage(read.error)}</p>}
          <div className="pagination">
            <span>
              {q.data?.total ?? 0} thông báo · Trang {page}
            </span>
            <Button
              className="button-outline"
              disabled={page === 1 || read.isPending}
              onClick={() => setPage((p) => p - 1)}
            >
              Trước
            </Button>
            <Button
              className="button-outline"
              disabled={!q.data || page * 20 >= q.data.total || read.isPending}
              onClick={() => setPage((p) => p + 1)}
            >
              Sau
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
