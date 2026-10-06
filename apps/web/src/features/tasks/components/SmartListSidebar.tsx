import { Heart, Plus, Sprout, Archive } from "lucide-react";
import type { TaskList } from "../types";
export const smartLists = [
  ["all", "Tất cả"],
  ["today", "Hôm nay"],
  ["upcoming", "Sắp tới (7 ngày)"],
  ["overdue", "Quá hạn"],
  ["mine", "Giao cho tôi"],
  ["partner", "Việc của người ấy"],
  ["shared", "Việc chung"],
  ["nodate", "Không có hạn"],
  ["done", "Đã hoàn thành"],
] as const;
export function SmartListSidebar({
  smart,
  listId,
  lists,
  counts,
  listCounts,
  labels,
  label,
  onSmart,
  onList,
  onLabel,
  onNew,
  onArchive,
  readOnly,
  loading,
  error,
  onRetry,
  archived,
  onToggleArchive,
  historyReadOnly,
}: {
  smart: string;
  listId: string;
  lists: TaskList[];
  counts?: Record<string, number>;
  listCounts?: { id: string; count: number }[];
  labels: string[];
  label: string;
  onSmart: (s: string) => void;
  onList: (l: TaskList) => void;
  onLabel: (s: string) => void;
  onNew: () => void;
  onArchive: (l: TaskList) => void;
  readOnly: boolean;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  archived: boolean;
  onToggleArchive: () => void;
  historyReadOnly: boolean;
}) {
  return (
    <aside className="todo-sidebar" aria-label="Danh sách công việc">
      <div className="todo-sidebar-title">
        <Sprout size={20} />
        <b>Góc việc nhỏ</b>
      </div>
      <nav className="todo-smart-nav" aria-label="Danh sách thông minh">
        {smartLists.map(([key, name]) => (
          <button
            key={key}
            aria-current={!listId && smart === key ? "page" : undefined}
            onClick={() => onSmart(key)}
          >
            <span>{name}</span>
            <small aria-label={`Số việc ${name}`}>{counts?.[key] ?? "—"}</small>
          </button>
        ))}
      </nav>
      <div className="todo-custom-lists">
        {loading && <p role="status">Đang tải danh sách…</p>}
        {error && (
          <p role="alert">
            Chưa tải được danh sách.{" "}
            <button className="text-button" onClick={onRetry}>
              Tải lại danh sách
            </button>
          </p>
        )}
        {[false, true].map((shared) => (
          <section key={String(shared)}>
            <h3>{shared ? "Danh sách chung" : "Danh sách của tôi"}</h3>
            {lists
              .filter((l) => !!l.coupleId === shared)
              .map((l) => (
                <div className="todo-list-link" key={l.id}>
                  <button
                    aria-current={listId === l.id ? "page" : undefined}
                    onClick={() => onList(l)}
                  >
                    <span
                      className="todo-list-color"
                      style={{ background: l.color }}
                    />
                    {shared && <Heart size={12} />}
                    <span>{l.name}</span>
                    <small>
                      {listCounts?.find((c) => c.id === l.id)?.count ?? "—"}
                    </small>
                  </button>
                  {!l.isDefault &&
                    !historyReadOnly &&
                    (!l.readOnly || !!l.archivedAt) && (
                      <button
                        aria-label={`${l.archivedAt ? "Mở lại" : "Lưu trữ"} ${l.name}`}
                        title={
                          l.archivedAt
                            ? "Mở lại danh sách"
                            : "Lưu trữ danh sách"
                        }
                        onClick={() => onArchive(l)}
                      >
                        <Archive size={14} />
                      </button>
                    )}
                </div>
              ))}
          </section>
        ))}
        {!readOnly && (
          <button className="todo-new-list" onClick={onNew}>
            <Plus size={15} />
            Danh sách mới
          </button>
        )}
      </div>
      <button className="todo-new-list" onClick={onToggleArchive}>
        <Archive size={15} />
        {archived ? "Danh sách đang dùng" : "Danh sách lưu trữ"}
      </button>
      {labels.length > 0 && (
        <section className="todo-sidebar-labels">
          <h3>Nhãn</h3>
          {labels.map((l) => (
            <button
              className={`todo-label ${label === l ? "is-selected" : ""}`}
              key={l}
              onClick={() => onLabel(label === l ? "" : l)}
            >
              #{l}
            </button>
          ))}
        </section>
      )}
    </aside>
  );
}
