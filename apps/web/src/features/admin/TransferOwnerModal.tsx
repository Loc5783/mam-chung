import { useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui";
import { classifyError } from "../../lib/apiClient";
import type { AdminCoupleItem } from "./types";

export interface TransferOwnerModalProps {
  couple: AdminCoupleItem;
  busy: boolean;
  onClose: () => void;
  onConfirm: (
    newOwnerId: string,
    adminPassword: string,
  ) => Promise<void> | void;
}

export function TransferOwnerModal({
  couple,
  busy,
  onClose,
  onConfirm,
}: TransferOwnerModalProps) {
  const eligibleMembers = couple.members.filter(
    (m) => m.active && m.role !== "owner",
  );
  const [selectedUserId, setSelectedUserId] = useState(
    eligibleMembers[0]?.userId ?? "",
  );
  const [adminPassword, setAdminPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setGeneralError("");

    if (!selectedUserId) {
      setGeneralError("Không có thành viên hợp lệ để chuyển quyền.");
      return;
    }

    if (!adminPassword) {
      setPasswordError("Vui lòng nhập mật khẩu quản trị viên để tiếp tục.");
      return;
    }

    try {
      await onConfirm(selectedUserId, adminPassword);
    } catch (err: unknown) {
      const classified = classifyError(err);
      if (classified.code === "ADMIN_PASSWORD_INVALID") {
        setPasswordError(
          classified.message || "Mật khẩu quản trị viên không chính xác.",
        );
      } else {
        setGeneralError(
          classified.message || "Đã xảy ra lỗi. Vui lòng thử lại.",
        );
      }
    }
  };

  return (
    <Modal
      title={`Chuyển quyền chủ không gian: ${couple.name}`}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={handleSubmit} noValidate>
        <p
          style={{
            margin: "0 0 1rem",
            color: "var(--color-text-main, #334155)",
            fontSize: "0.9rem",
          }}
        >
          Chọn thành viên sẽ trở thành chủ mới của không gian chung này:
        </p>

        {eligibleMembers.length === 0 ? (
          <div className="form-error" style={{ marginBottom: "1rem" }}>
            Không gian này hiện không có thành viên thứ hai đang hoạt động để
            chuyển quyền.
          </div>
        ) : (
          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="new-owner-select"
              style={{
                display: "block",
                marginBottom: "0.25rem",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              Thành viên nhận quyền
            </label>
            <select
              id="new-owner-select"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              disabled={busy}
              style={{
                width: "100%",
                padding: "0.5rem",
                borderRadius: "0.375rem",
                border: "1px solid var(--color-border, #CBD5E1)",
              }}
            >
              {eligibleMembers.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ marginBottom: "1rem" }}>
          <label
            htmlFor="transfer-admin-password"
            style={{
              display: "block",
              marginBottom: "0.25rem",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            Mật khẩu của bạn (Quản trị viên)
          </label>
          <input
            id="transfer-admin-password"
            type="password"
            value={adminPassword}
            onChange={(e) => {
              setAdminPassword(e.target.value);
              setPasswordError("");
            }}
            disabled={busy}
            placeholder="Nhập mật khẩu quản trị viên"
            autoComplete="current-password"
            aria-invalid={!!passwordError}
            aria-describedby={
              passwordError ? "transfer-password-error" : undefined
            }
            style={{
              width: "100%",
              borderColor: passwordError ? "#EF4444" : undefined,
            }}
          />
          {passwordError && (
            <span
              id="transfer-password-error"
              className="field-error"
              role="alert"
              style={{
                color: "#EF4444",
                fontSize: "0.85rem",
                marginTop: "0.25rem",
                display: "block",
              }}
            >
              {passwordError}
            </span>
          )}
        </div>

        {generalError && (
          <div
            className="form-error"
            role="alert"
            style={{ marginBottom: "1rem" }}
          >
            {generalError}
          </div>
        )}

        <div
          className="modal-actions"
          style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}
        >
          <Button
            type="button"
            className="button-outline"
            onClick={onClose}
            disabled={busy}
          >
            Hủy bỏ
          </Button>
          <Button
            type="submit"
            disabled={busy || !selectedUserId || !adminPassword}
          >
            {busy ? "Đang xử lý…" : "Xác nhận chuyển quyền"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
