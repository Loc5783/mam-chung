import { useState, useEffect, useCallback } from "react";
import { adminApi } from "./api";
import type { AdminCoupleItem, AdminCouplesResponse } from "./types";
import { AdminConfirmModal } from "./AdminConfirmModal";
import { TransferOwnerModal } from "./TransferOwnerModal";
import { Skeleton, Button, EmptyState } from "../../components/ui";
import { useUiStore } from "../../app/store";
import { classifyError } from "../../lib/apiClient";
import { RefreshCw, Archive, UserCheck, Heart } from "lucide-react";

export function CouplesTab() {
  const [data, setData] = useState<AdminCouplesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<"all" | "active" | "archived">("all");
  const [page, setPage] = useState(1);

  // Modals
  const [archiveCoupleTarget, setArchiveCoupleTarget] =
    useState<AdminCoupleItem | null>(null);
  const [transferCoupleTarget, setTransferCoupleTarget] =
    useState<AdminCoupleItem | null>(null);
  const [busy, setBusy] = useState(false);

  const notify = useUiStore((s) => s.notify);

  const loadCouples = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getCouples({
        status,
        page,
        limit: 15,
      });
      setData(res);
    } catch (err) {
      const classified = classifyError(err);
      setError(
        classified.message || "Không thể nạp danh sách không gian chung.",
      );
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    loadCouples();
  }, [loadCouples]);

  const handleArchive = async (adminPassword: string) => {
    if (!archiveCoupleTarget) return;
    setBusy(true);
    try {
      await adminApi.archiveCouple(archiveCoupleTarget.id, adminPassword);
      notify(`Đã lưu trữ không gian chung: ${archiveCoupleTarget.name}`);
      setArchiveCoupleTarget(null);
      await loadCouples();
    } finally {
      setBusy(false);
    }
  };

  const handleTransferOwner = async (
    newOwnerId: string,
    adminPassword: string,
  ) => {
    if (!transferCoupleTarget) return;
    setBusy(true);
    try {
      await adminApi.transferCoupleOwner(
        transferCoupleTarget.id,
        newOwnerId,
        adminPassword,
      );
      notify(`Đã chuyển quyền chủ không gian chung thành công.`);
      setTransferCoupleTarget(null);
      await loadCouples();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {/* Filter Bar */}
      <div className="admin-filter-bar">
        <select
          className="admin-select"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "all" | "active" | "archived");
            setPage(1);
          }}
          aria-label="Lọc trạng thái không gian chung"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="archived">Đã lưu trữ</option>
        </select>

        <Button
          className="compact button-outline"
          onClick={loadCouples}
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
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton
              key={i}
              style={{ height: "4rem", borderRadius: "0.5rem" }}
            />
          ))}
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <EmptyState title="Không thể nạp dữ liệu">{error}</EmptyState>
          <Button
            className="button-outline"
            onClick={loadCouples}
            style={{ marginTop: "1rem" }}
          >
            Thử lại
          </Button>
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="Không có không gian chung nào"
          icon={<Heart size={36} color="#E38FA9" />}
        >
          Chưa có cặp đôi nào phù hợp với bộ lọc.
        </EmptyState>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tên không gian</th>
                  <th>Trạng thái</th>
                  <th>Thành viên</th>
                  <th>Mã mời còn hiệu lực</th>
                  <th>Ngày tạo</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((couple) => {
                  const isArchived = couple.status === "archived";
                  const canTransfer =
                    !isArchived &&
                    couple.members.filter((m) => m.active).length >= 2;

                  return (
                    <tr key={couple.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: "#1E293B" }}>
                          {couple.name}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                          ID: {couple.id}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`status-badge ${couple.status === "active" ? "active" : "deleted"}`}
                        >
                          {couple.status === "active"
                            ? "Hoạt động"
                            : "Đã lưu trữ"}
                        </span>
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.15rem",
                          }}
                        >
                          {couple.members.map((m) => (
                            <div key={m.userId} style={{ fontSize: "0.85rem" }}>
                              <b>{m.name}</b>{" "}
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  color:
                                    m.role === "owner" ? "#D97706" : "#64748B",
                                }}
                              >
                                ({m.role === "owner" ? "Chủ" : "Thành viên"})
                              </span>
                              {!m.active && (
                                <small style={{ color: "#EF4444" }}>
                                  {" "}
                                  [Đã rời]
                                </small>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 500 }}>
                          {couple.activeInviteCount}
                        </span>{" "}
                        mã
                      </td>
                      <td style={{ fontSize: "0.85rem", color: "#475569" }}>
                        {new Date(couple.createdAt).toLocaleDateString("vi-VN")}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {!isArchived ? (
                          <div
                            style={{
                              display: "inline-flex",
                              gap: "0.25rem",
                              justifyContent: "flex-end",
                            }}
                          >
                            {canTransfer && (
                              <Button
                                className="compact button-outline"
                                onClick={() => setTransferCoupleTarget(couple)}
                                title="Chuyển quyền chủ không gian"
                              >
                                <UserCheck size={14} /> Đổi chủ
                              </Button>
                            )}
                            <Button
                              className="compact button-danger"
                              onClick={() => setArchiveCoupleTarget(couple)}
                              title="Lưu trữ không gian chung"
                            >
                              <Archive size={14} /> Lưu trữ
                            </Button>
                          </div>
                        ) : (
                          <span
                            style={{ color: "#94A3B8", fontSize: "0.8rem" }}
                          >
                            Không khả dụng
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Vertical Cards */}
          <div className="admin-mobile-cards">
            {data.items.map((couple) => {
              const isArchived = couple.status === "archived";
              const canTransfer =
                !isArchived &&
                couple.members.filter((m) => m.active).length >= 2;

              return (
                <div key={couple.id} className="admin-card-item">
                  <div className="admin-card-header">
                    <div>
                      <div className="admin-card-title">{couple.name}</div>
                      <div className="admin-card-sub">
                        Tạo ngày:{" "}
                        {new Date(couple.createdAt).toLocaleDateString("vi-VN")}
                      </div>
                    </div>
                    <span
                      className={`status-badge ${couple.status === "active" ? "active" : "deleted"}`}
                    >
                      {couple.status === "active" ? "Hoạt động" : "Đã lưu trữ"}
                    </span>
                  </div>

                  <div className="admin-card-details">
                    <div>
                      <b>Thành viên ({couple.memberCount}):</b>
                      {couple.members.map((m) => (
                        <div key={m.userId} style={{ paddingLeft: "0.5rem" }}>
                          • {m.name} (
                          {m.role === "owner" ? "Chủ" : "Thành viên"}){" "}
                          {!m.active && "[Đã rời]"}
                        </div>
                      ))}
                    </div>
                    <div>
                      <b>Mã mời còn hiệu lực:</b> {couple.activeInviteCount} mã
                    </div>
                  </div>

                  {!isArchived && (
                    <div className="admin-card-actions">
                      {canTransfer && (
                        <Button
                          className="compact button-outline"
                          onClick={() => setTransferCoupleTarget(couple)}
                        >
                          <UserCheck size={14} /> Đổi chủ
                        </Button>
                      )}
                      <Button
                        className="compact button-danger"
                        onClick={() => setArchiveCoupleTarget(couple)}
                      >
                        <Archive size={14} /> Lưu trữ
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="admin-pagination">
            <span>
              Tổng số: <b>{data.total}</b> không gian (Trang {data.page}/
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

      {/* Archive Confirm Modal */}
      {archiveCoupleTarget && (
        <AdminConfirmModal
          title={`Lưu trữ không gian: ${archiveCoupleTarget.name}`}
          message="Lưu trữ không gian chung sẽ thu hồi toàn bộ mã mời đang hoạt động và chuyển trạng thái cặp thành đã lưu trữ."
          actionLabel="Xác nhận lưu trữ"
          isDanger={true}
          busy={busy}
          onClose={() => setArchiveCoupleTarget(null)}
          onConfirm={handleArchive}
        />
      )}

      {/* Transfer Owner Modal */}
      {transferCoupleTarget && (
        <TransferOwnerModal
          couple={transferCoupleTarget}
          busy={busy}
          onClose={() => setTransferCoupleTarget(null)}
          onConfirm={handleTransferOwner}
        />
      )}
    </div>
  );
}
