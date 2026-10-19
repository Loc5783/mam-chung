import { useState, useEffect, useCallback } from "react";
import { adminApi } from "./api";
import type { AdminUserItem, AdminUsersResponse } from "./types";
import { AdminConfirmModal } from "./AdminConfirmModal";
import { TempPasswordModal } from "./TempPasswordModal";
import { Skeleton, Button, EmptyState } from "../../components/ui";
import { useUiStore } from "../../app/store";
import { classifyError } from "../../lib/apiClient";
import {
  Search,
  Lock,
  Unlock,
  KeyRound,
  Trash2,
  RotateCcw,
  RefreshCw,
  MoreVertical,
} from "lucide-react";

type ActionType =
  "lock" | "unlock" | "unlock-login" | "reset-password" | "delete";

export function UsersTab() {
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<
    "all" | "active" | "disabled" | "deleted"
  >("all");
  const [page, setPage] = useState(1);

  // Active action modal
  const [activeUser, setActiveUser] = useState<AdminUserItem | null>(null);
  const [activeAction, setActiveAction] = useState<ActionType | null>(null);
  const [busy, setBusy] = useState(false);

  // One-time temporary password modal
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [tempPasswordEmail, setTempPasswordEmail] = useState<string>("");

  // Mobile actions dropdown toggle
  const [openMenuUserId, setOpenMenuUserId] = useState<string | null>(null);

  const notify = useUiStore((s) => s.notify);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getUsers({
        query: query.trim() || undefined,
        status,
        page,
        limit: 15,
      });
      setData(res);
    } catch (err) {
      const classified = classifyError(err);
      setError(classified.message || "Không thể nạp danh sách tài khoản.");
    } finally {
      setLoading(false);
    }
  }, [query, status, page]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleAction = async (adminPassword: string) => {
    if (!activeUser || !activeAction) return;
    setBusy(true);
    try {
      if (activeAction === "lock") {
        await adminApi.lockUser(activeUser.id, adminPassword);
        notify(`Đã tạm khóa tài khoản ${activeUser.email}`);
      } else if (activeAction === "unlock") {
        await adminApi.unlockUser(activeUser.id, adminPassword);
        notify(`Đã mở khóa tài khoản ${activeUser.email}`);
      } else if (activeAction === "unlock-login") {
        await adminApi.unlockLogin(activeUser.id, adminPassword);
        notify(
          `Đã xóa trạng thái tạm khóa do sai mật khẩu cho ${activeUser.email}`,
        );
      } else if (activeAction === "reset-password") {
        const res = await adminApi.resetPassword(activeUser.id, adminPassword);
        setTempPassword(res.temporaryPassword);
        setTempPasswordEmail(activeUser.email);
        notify("Đã đặt lại mật khẩu thành công.");
      } else if (activeAction === "delete") {
        await adminApi.deleteUser(activeUser.id, adminPassword);
        notify(`Đã xóa tài khoản ${activeUser.email}`);
      }

      setActiveAction(null);
      setActiveUser(null);
      await loadUsers();
    } finally {
      setBusy(false);
    }
  };

  const renderStatusBadge = (user: AdminUserItem) => {
    if (user.status === "deleted") {
      return <span className="status-badge deleted">Đã xóa</span>;
    }
    if (user.status === "disabled") {
      return <span className="status-badge disabled">Tạm khóa</span>;
    }
    if (user.lockedUntil) {
      return <span className="status-badge locked">Khóa do sai pass</span>;
    }
    return <span className="status-badge active">Hoạt động</span>;
  };

  return (
    <div>
      {/* Search & Filter Bar */}
      <div className="admin-filter-bar">
        <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
          <Search
            size={16}
            style={{
              position: "absolute",
              left: "0.75rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#94A3B8",
            }}
          />
          <input
            className="admin-search-input"
            style={{ paddingLeft: "2.25rem", width: "100%" }}
            placeholder="Tìm theo email hoặc tên…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <select
          className="admin-select"
          value={status}
          onChange={(e) => {
            setStatus(
              e.target.value as "all" | "active" | "disabled" | "deleted",
            );
            setPage(1);
          }}
          aria-label="Lọc trạng thái tài khoản"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="disabled">Bị tạm khóa</option>
          <option value="deleted">Đã xóa</option>
        </select>

        <Button
          className="compact button-outline"
          onClick={loadUsers}
          title="Tải lại danh sách"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          <RefreshCw size={15} /> Làm mới
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton
              key={i}
              style={{ height: "3.5rem", borderRadius: "0.5rem" }}
            />
          ))}
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <EmptyState title="Không thể nạp dữ liệu">{error}</EmptyState>
          <Button
            className="button-outline"
            onClick={loadUsers}
            style={{ marginTop: "1rem" }}
          >
            Thử lại
          </Button>
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="Không tìm thấy tài khoản nào">
          Hãy thử đổi từ khóa tìm kiếm hoặc bỏ bộ lọc trạng thái.
        </EmptyState>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tài khoản</th>
                  <th>Trạng thái</th>
                  <th>Không gian chung</th>
                  <th>Ngày tạo / Đăng nhập gần nhất</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((user) => {
                  const isDeleted = user.status === "deleted";
                  return (
                    <tr key={user.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: "#1E293B" }}>
                          {user.name}{" "}
                          {user.role === "admin" && (
                            <span
                              className="admin-badge"
                              style={{ marginLeft: "0.25rem" }}
                            >
                              Admin
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "#64748B" }}>
                          {user.email}
                        </div>
                      </td>
                      <td>{renderStatusBadge(user)}</td>
                      <td>
                        {user.coupleName ? (
                          <div>
                            <span style={{ fontWeight: 500 }}>
                              {user.coupleName}
                            </span>{" "}
                            {user.coupleStatus === "archived" && (
                              <small style={{ color: "#94A3B8" }}>
                                (Lưu trữ)
                              </small>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "#94A3B8" }}>
                            Chưa tham gia
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: "0.8rem", color: "#475569" }}>
                          Tạo:{" "}
                          {new Date(user.createdAt).toLocaleDateString("vi-VN")}
                        </div>
                        <div style={{ fontSize: "0.775rem", color: "#94A3B8" }}>
                          {user.lastLoginAt
                            ? `Đăng nhập: ${new Date(user.lastLoginAt).toLocaleDateString("vi-VN")}`
                            : "Chưa từng đăng nhập"}
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {!isDeleted ? (
                          <div
                            style={{
                              display: "inline-flex",
                              gap: "0.25rem",
                              justifyContent: "flex-end",
                            }}
                          >
                            {user.status === "disabled" ? (
                              <Button
                                className="compact button-outline"
                                onClick={() => {
                                  setActiveUser(user);
                                  setActiveAction("unlock");
                                }}
                                title="Mở khóa tài khoản"
                              >
                                <Unlock size={14} /> Mở khóa
                              </Button>
                            ) : (
                              <Button
                                className="compact button-outline"
                                onClick={() => {
                                  setActiveUser(user);
                                  setActiveAction("lock");
                                }}
                                title="Tạm khóa tài khoản"
                              >
                                <Lock size={14} /> Khóa
                              </Button>
                            )}

                            {user.lockedUntil && (
                              <Button
                                className="compact button-outline"
                                onClick={() => {
                                  setActiveUser(user);
                                  setActiveAction("unlock-login");
                                }}
                                title="Gỡ tạm khóa mật khẩu"
                              >
                                <RotateCcw size={14} /> Gỡ khóa login
                              </Button>
                            )}

                            <Button
                              className="compact button-outline"
                              onClick={() => {
                                setActiveUser(user);
                                setActiveAction("reset-password");
                              }}
                              title="Đặt lại mật khẩu tạm"
                            >
                              <KeyRound size={14} /> Mật khẩu
                            </Button>

                            <Button
                              className="compact button-danger"
                              onClick={() => {
                                setActiveUser(user);
                                setActiveAction("delete");
                              }}
                              title="Xóa tài khoản"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        ) : (
                          <span
                            style={{ color: "#94A3B8", fontSize: "0.8rem" }}
                          >
                            Đã vô hiệu hóa
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Vertical Cards (screens <= 640px) */}
          <div className="admin-mobile-cards">
            {data.items.map((user) => {
              const isDeleted = user.status === "deleted";
              const isMenuOpen = openMenuUserId === user.id;

              return (
                <div key={user.id} className="admin-card-item">
                  <div className="admin-card-header">
                    <div>
                      <div className="admin-card-title">
                        {user.name}{" "}
                        {user.role === "admin" && (
                          <span className="admin-badge">Admin</span>
                        )}
                      </div>
                      <div className="admin-card-sub">{user.email}</div>
                    </div>
                    {renderStatusBadge(user)}
                  </div>

                  <div className="admin-card-details">
                    <div>
                      <b>Không gian:</b> {user.coupleName || "Chưa tham gia"}
                    </div>
                    <div>
                      <b>Ngày tạo:</b>{" "}
                      {new Date(user.createdAt).toLocaleDateString("vi-VN")}
                    </div>
                    <div>
                      <b>Đăng nhập gần nhất:</b>{" "}
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleDateString("vi-VN")
                        : "Chưa từng"}
                    </div>
                  </div>

                  {!isDeleted && (
                    <>
                      <div
                        style={{ display: "flex", justifyContent: "flex-end" }}
                      >
                        <Button
                          className="compact button-outline"
                          onClick={() =>
                            setOpenMenuUserId(isMenuOpen ? null : user.id)
                          }
                          style={{ padding: "0.25rem 0.5rem" }}
                        >
                          <MoreVertical size={16} /> Thao tác
                        </Button>
                      </div>

                      {isMenuOpen && (
                        <div className="admin-card-actions">
                          {user.status === "disabled" ? (
                            <Button
                              className="compact button-outline"
                              onClick={() => {
                                setActiveUser(user);
                                setActiveAction("unlock");
                                setOpenMenuUserId(null);
                              }}
                            >
                              <Unlock size={14} /> Mở khóa
                            </Button>
                          ) : (
                            <Button
                              className="compact button-outline"
                              onClick={() => {
                                setActiveUser(user);
                                setActiveAction("lock");
                                setOpenMenuUserId(null);
                              }}
                            >
                              <Lock size={14} /> Tạm khóa
                            </Button>
                          )}

                          {user.lockedUntil && (
                            <Button
                              className="compact button-outline"
                              onClick={() => {
                                setActiveUser(user);
                                setActiveAction("unlock-login");
                                setOpenMenuUserId(null);
                              }}
                            >
                              <RotateCcw size={14} /> Gỡ khóa login
                            </Button>
                          )}

                          <Button
                            className="compact button-outline"
                            onClick={() => {
                              setActiveUser(user);
                              setActiveAction("reset-password");
                              setOpenMenuUserId(null);
                            }}
                          >
                            <KeyRound size={14} /> Đặt lại pass
                          </Button>

                          <Button
                            className="compact button-danger"
                            onClick={() => {
                              setActiveUser(user);
                              setActiveAction("delete");
                              setOpenMenuUserId(null);
                            }}
                          >
                            <Trash2 size={14} /> Xóa tài khoản
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="admin-pagination">
            <span>
              Tổng số: <b>{data.total}</b> tài khoản (Trang {data.page}/
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

      {/* Confirmation Modals */}
      {activeUser && activeAction === "lock" && (
        <AdminConfirmModal
          title={`Tạm khóa tài khoản: ${activeUser.email}`}
          message="Khóa tài khoản này sẽ thu hồi toàn bộ phiên đăng nhập hiện có. Người dùng sẽ không thể đăng nhập hoặc làm mới token."
          actionLabel="Khóa tài khoản"
          isDanger={true}
          busy={busy}
          onClose={() => {
            setActiveUser(null);
            setActiveAction(null);
          }}
          onConfirm={handleAction}
        />
      )}

      {activeUser && activeAction === "unlock" && (
        <AdminConfirmModal
          title={`Mở khóa tài khoản: ${activeUser.email}`}
          message="Tài khoản này sẽ được mở khóa và cho phép đăng nhập lại bình thường."
          actionLabel="Mở khóa tài khoản"
          isDanger={false}
          busy={busy}
          onClose={() => {
            setActiveUser(null);
            setActiveAction(null);
          }}
          onConfirm={handleAction}
        />
      )}

      {activeUser && activeAction === "unlock-login" && (
        <AdminConfirmModal
          title={`Xóa trạng thái tạm khóa mật khẩu: ${activeUser.email}`}
          message="Xóa số lần nhập sai mật khẩu và hủy thời gian chờ 15 phút. Người dùng có thể thử đăng nhập lại ngay."
          actionLabel="Gỡ tạm khóa login"
          isDanger={false}
          busy={busy}
          onClose={() => {
            setActiveUser(null);
            setActiveAction(null);
          }}
          onConfirm={handleAction}
        />
      )}

      {activeUser && activeAction === "reset-password" && (
        <AdminConfirmModal
          title={`Đặt lại mật khẩu cho ${activeUser.email}`}
          message="Hệ thống sẽ tạo một mật khẩu tạm ngẫu nhiên mạnh và vô hiệu hóa mọi phiên đăng nhập cũ. Hãy sao chép mật khẩu tạm này và gửi riêng cho người dùng."
          actionLabel="Tạo mật khẩu tạm"
          isDanger={true}
          busy={busy}
          onClose={() => {
            setActiveUser(null);
            setActiveAction(null);
          }}
          onConfirm={handleAction}
        />
      )}

      {activeUser && activeAction === "delete" && (
        <AdminConfirmModal
          title={`Xác nhận xóa tài khoản: ${activeUser.email}`}
          message="Hành động xóa mềm sẽ ẩn danh thông tin email và tên của người dùng, thu hồi phiên đăng nhập và xử lý rời không gian chung an toàn."
          actionLabel="Xóa vĩnh viễn tài khoản"
          isDanger={true}
          requireEmailConfirmation={activeUser.email}
          busy={busy}
          onClose={() => {
            setActiveUser(null);
            setActiveAction(null);
          }}
          onConfirm={handleAction}
        />
      )}

      {/* One-time Temporary Password Modal */}
      {tempPassword && (
        <TempPasswordModal
          temporaryPassword={tempPassword}
          userEmail={tempPasswordEmail}
          onClose={() => {
            // Xóa ngay khỏi memory trạng thái khi đóng
            setTempPassword(null);
            setTempPasswordEmail("");
          }}
        />
      )}
    </div>
  );
}
