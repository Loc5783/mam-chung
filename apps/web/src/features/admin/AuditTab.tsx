import { useState, useEffect, useCallback } from "react";
import { adminApi } from "./api";
import type { AdminAuditItem, AdminAuditResponse } from "./types";
import { Skeleton, Button, EmptyState } from "../../components/ui";
import { classifyError } from "../../lib/apiClient";
import { RefreshCw, History } from "lucide-react";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  admin_grant: { label: "Cấp quyền Admin", color: "#3B82F6" },
  admin_revoke: { label: "Gỡ quyền Admin", color: "#64748B" },
  lock_user: { label: "Khóa tài khoản", color: "#D97706" },
  unlock_user: { label: "Mở khóa tài khoản", color: "#16A34A" },
  delete_user: { label: "Xóa tài khoản", color: "#DC2626" },
  reset_password: { label: "Đặt lại mật khẩu", color: "#9333EA" },
  transfer_owner: { label: "Chuyển quyền chủ cặp", color: "#0D9488" },
  archive_couple: { label: "Lưu trữ không gian", color: "#475569" },
  change_setting: { label: "Thay đổi cài đặt", color: "#E11D48" },
};

export function AuditTab() {
  const [data, setData] = useState<AdminAuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [action, setAction] = useState<string>("");
  const [page, setPage] = useState(1);

  const loadAuditLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getAuditLogs({
        action: action || undefined,
        page,
        limit: 20,
      });
      setData(res);
    } catch (err) {
      const classified = classifyError(err);
      setError(classified.message || "Không thể nạp nhật ký thao tác.");
    } finally {
      setLoading(false);
    }
  }, [action, page]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  const renderActionBadge = (act: string) => {
    const meta = ACTION_LABELS[act] || { label: act, color: "#64748B" };
    return (
      <span
        style={{
          display: "inline-block",
          padding: "0.2rem 0.5rem",
          borderRadius: "9999px",
          fontSize: "0.75rem",
          fontWeight: 600,
          backgroundColor: `${meta.color}18`,
          color: meta.color,
          border: `1px solid ${meta.color}30`,
        }}
      >
        {meta.label}
      </span>
    );
  };

  const renderDetails = (item: AdminAuditItem) => {
    const parts: string[] = [];
    if (item.details?.email) parts.push(`Email: ${String(item.details.email)}`);
    if (item.details?.originalEmail)
      parts.push(`Email gốc: ${String(item.details.originalEmail)}`);
    if (item.details?.coupleName)
      parts.push(`Cặp: ${String(item.details.coupleName)}`);
    if (item.details?.name) parts.push(`Tên: ${String(item.details.name)}`);
    if (item.action === "change_setting" && item.after) {
      parts.push(`Cài đặt mới: ${JSON.stringify(item.after)}`);
    }

    if (parts.length > 0) {
      return <span>{parts.join(" · ")}</span>;
    }
    if (item.targetId) {
      return <span style={{ color: "#94A3B8" }}>ID: {item.targetId}</span>;
    }
    return <span style={{ color: "#94A3B8" }}>—</span>;
  };

  return (
    <div>
      {/* Filter Bar */}
      <div className="admin-filter-bar">
        <select
          className="admin-select"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          aria-label="Lọc theo loại hành động"
        >
          <option value="">Tất cả hành động</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>

        <Button
          className="compact button-outline"
          onClick={loadAuditLogs}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          <RefreshCw size={15} /> Làm mới
        </Button>
      </div>

      {loading ? (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={i}
              style={{ height: "3rem", borderRadius: "0.5rem" }}
            />
          ))}
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <EmptyState title="Không thể nạp dữ liệu">{error}</EmptyState>
          <Button
            className="button-outline"
            onClick={loadAuditLogs}
            style={{ marginTop: "1rem" }}
          >
            Thử lại
          </Button>
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="Chưa có nhật ký nào"
          icon={<History size={36} color="#94A3B8" />}
        >
          Chưa có thao tác quản trị nào được ghi lại trong khoảng này.
        </EmptyState>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Người thực hiện</th>
                  <th>Hành động</th>
                  <th>Đối tượng</th>
                  <th>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((log) => (
                  <tr key={log.id}>
                    <td
                      style={{
                        whiteSpace: "nowrap",
                        fontSize: "0.825rem",
                        color: "#64748B",
                      }}
                    >
                      {new Date(log.createdAt).toLocaleString("vi-VN")}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: "0.85rem" }}>
                        {log.adminEmail}
                      </div>
                      {log.ip && (
                        <small style={{ color: "#94A3B8" }}>IP: {log.ip}</small>
                      )}
                    </td>
                    <td>{renderActionBadge(log.action)}</td>
                    <td
                      style={{
                        textTransform: "capitalize",
                        fontSize: "0.85rem",
                      }}
                    >
                      {log.targetType === "user"
                        ? "Người dùng"
                        : log.targetType === "couple"
                          ? "Không gian chung"
                          : "Hệ thống"}
                    </td>
                    <td style={{ fontSize: "0.825rem", color: "#475569" }}>
                      {renderDetails(log)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Vertical Cards */}
          <div className="admin-mobile-cards">
            {data.items.map((log) => (
              <div key={log.id} className="admin-card-item">
                <div className="admin-card-header">
                  <div>{renderActionBadge(log.action)}</div>
                  <span style={{ fontSize: "0.775rem", color: "#94A3B8" }}>
                    {new Date(log.createdAt).toLocaleString("vi-VN")}
                  </span>
                </div>

                <div className="admin-card-details">
                  <div>
                    <b>Admin:</b> {log.adminEmail} {log.ip && `(${log.ip})`}
                  </div>
                  <div>
                    <b>Đối tượng:</b>{" "}
                    {log.targetType === "user"
                      ? "Người dùng"
                      : log.targetType === "couple"
                        ? "Không gian chung"
                        : "Hệ thống"}
                  </div>
                  <div>
                    <b>Chi tiết:</b> {renderDetails(log)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="admin-pagination">
            <span>
              Tổng số: <b>{data.total}</b> bản ghi (Trang {data.page}/
              {data.totalPages})
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <Button
                className="compact button-outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Trước
              </Button>
              <Button
                className="compact button-outline"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Sau
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
