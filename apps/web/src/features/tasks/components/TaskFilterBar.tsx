import React from "react";
import { SlidersHorizontal, RotateCcw } from "lucide-react";
import { Card } from "../../../components/ui";
import { statuses, priorities } from "../types";

export function TaskFilterBar({
  scope,
  status,
  priority,
  due,
  from,
  to,
  label,
  sort,
  search,
  groupBy,
  kind,
  cid,
  hasCouple,
  activeFilterCount,
  onScopeChange,
  onStatusChange,
  onPriorityChange,
  onDueChange,
  onFromChange,
  onToChange,
  onLabelChange,
  onSortChange,
  onSearchChange,
  onGroupByChange,
  onClearKind,
  onClearAll,
}: {
  scope: string;
  status: string;
  priority: string;
  due: string;
  from: string;
  to: string;
  label: string;
  sort: string;
  search: string;
  groupBy: string;
  kind: string;
  cid: string;
  hasCouple: boolean;
  activeFilterCount: number;
  onScopeChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onDueChange: (value: string) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onLabelChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onGroupByChange: (value: string) => void;
  onClearKind: () => void;
  onClearAll: () => void;
}) {
  return (
    <Card className="todo-filters-card">
      <details
        className="todo-filters"
        open={activeFilterCount > 0 ? true : undefined}
      >
        <summary className="todo-filters-summary">
          <span className="todo-filters-summary-title">
            <SlidersHorizontal size={14} />
            <span>Lọc và sắp xếp</span>
            {activeFilterCount > 0 && (
              <span
                className="todo-filter-badge"
                aria-label={`${activeFilterCount} bộ lọc đang áp dụng`}
              >
                {activeFilterCount}
              </span>
            )}
          </span>
          {activeFilterCount > 0 && (
            <button
              type="button"
              className="todo-clear-filters-btn"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClearAll();
              }}
            >
              <RotateCcw size={12} />
              Đặt lại bộ lọc
            </button>
          )}
        </summary>
        <div className="history-filters task-filters">
          <label>
            Không gian
            <select
              aria-label="Lọc không gian"
              value={scope}
              onChange={(e) => onScopeChange(e.target.value)}
            >
              <option value="all">Tất cả</option>
              <option value="personal" disabled={!!cid}>
                Cá nhân
              </option>
              <option value="shared" disabled={!hasCouple && !cid}>
                Chung
              </option>
              <option value="mine">Giao cho tôi</option>
            </select>
          </label>
          <label>
            Trạng thái
            <select
              aria-label="Lọc trạng thái"
              value={status}
              onChange={(e) => onStatusChange(e.target.value)}
            >
              <option value="">Tất cả</option>
              {Object.entries(statuses).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ưu tiên
            <select
              aria-label="Lọc ưu tiên"
              value={priority}
              onChange={(e) => onPriorityChange(e.target.value)}
            >
              <option value="">Tất cả</option>
              {Object.entries(priorities).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Hạn chót
            <select
              aria-label="Lọc hạn chót"
              value={due}
              onChange={(e) => onDueChange(e.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="today">Hôm nay</option>
              <option value="overdue">Quá hạn</option>
            </select>
          </label>
          <label>
            Từ ngày
            <input
              type="date"
              aria-label="Từ ngày"
              value={from}
              onChange={(e) => onFromChange(e.target.value)}
            />
          </label>
          <label>
            Đến ngày
            <input
              type="date"
              aria-label="Đến ngày"
              value={to}
              onChange={(e) => onToChange(e.target.value)}
            />
          </label>
          <label>
            Nhãn
            <input
              aria-label="Lọc nhãn"
              value={label}
              maxLength={30}
              onChange={(e) => onLabelChange(e.target.value)}
            />
          </label>
          <label>
            Sắp xếp
            <select
              aria-label="Sắp xếp"
              value={sort}
              onChange={(e) => onSortChange(e.target.value)}
            >
              <option value="manual">Thứ tự thủ công</option>
              <option value="deadline">Hạn gần nhất</option>
              <option value="priority">Ưu tiên cao nhất</option>
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
            </select>
          </label>
          <label>
            Tìm kiếm
            <input
              aria-label="Tìm công việc"
              placeholder="Tiêu đề, mô tả, nhãn…"
              value={search}
              maxLength={160}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </label>
        </div>
        <div className="todo-filters-footer">
          <label className="todo-group-picker">
            Nhóm theo
            <select
              aria-label="Nhóm công việc"
              value={groupBy}
              onChange={(e) => onGroupByChange(e.target.value)}
            >
              <option value="deadline">Hạn chót</option>
              <option value="list">Danh sách</option>
              <option value="priority">Ưu tiên</option>
              <option value="assignee">Người thực hiện</option>
            </select>
          </label>
          {activeFilterCount > 0 && (
            <button
              type="button"
              className="text-button todo-reset-link"
              onClick={onClearAll}
            >
              Xóa tất cả điều kiện lọc
            </button>
          )}
        </div>
      </details>
      {kind === "shopping" && (
        <p>
          Đang lọc danh sách mua sắm.{" "}
          <button className="text-button" onClick={onClearKind}>
            Bỏ lọc mua sắm
          </button>
        </p>
      )}
    </Card>
  );
}
