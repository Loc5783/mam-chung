import { useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui";
import { classifyError } from "../../lib/apiClient";

export interface AdminConfirmModalProps {
  title: string;
  message: string;
  actionLabel?: string;
  isDanger?: boolean;
  requireEmailConfirmation?: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (adminPassword: string) => Promise<void> | void;
}

export function AdminConfirmModal({
  title,
  message,
  actionLabel = "Xác nhận",
  isDanger = false,
  requireEmailConfirmation,
  busy,
  onClose,
  onConfirm,
}: AdminConfirmModalProps) {
  const [adminPassword, setAdminPassword] = useState("");
  const [typedEmail, setTypedEmail] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setGeneralError("");

    if (
      requireEmailConfirmation &&
      typedEmail.trim() !== requireEmailConfirmation.trim()
    ) {
      setGeneralError(
        `Vui lòng nhập chính xác email: ${requireEmailConfirmation}`,
      );
      return;
    }

    if (!adminPassword) {
      setPasswordError("Vui lòng nhập mật khẩu quản trị viên để tiếp tục.");
      return;
    }

    try {
      await onConfirm(adminPassword);
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

  const isEmailMatch =
    !requireEmailConfirmation ||
    typedEmail.trim() === requireEmailConfirmation.trim();
  const canSubmit = !busy && adminPassword.length > 0 && isEmailMatch;

  return (
    <Modal title={title} onClose={onClose} busy={busy}>
      <form onSubmit={handleSubmit} noValidate>
        <div
          style={{
            marginBottom: "1rem",
            lineHeight: 1.5,
            color: "var(--color-text-main, #334155)",
          }}
        >
          <p style={{ margin: "0 0 0.5rem" }}>{message}</p>
          {isDanger && (
            <p
              style={{
                margin: "0.5rem 0",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                backgroundColor: "var(--color-bg-amber, #FEF3C7)",
                color: "var(--color-text-amber, #92400E)",
                fontSize: "0.85rem",
              }}
            >
              ⚠️ Thao tác này sẽ áp dụng ngay lập tức và ghi lại trong nhật ký
              bảo mật.
            </p>
          )}
        </div>

        {requireEmailConfirmation && (
          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="confirm-email-input"
              style={{
                display: "block",
                marginBottom: "0.25rem",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              Gõ lại email người dùng để xác nhận:{" "}
              <code style={{ color: "#E11D48" }}>
                {requireEmailConfirmation}
              </code>
            </label>
            <input
              id="confirm-email-input"
              type="text"
              value={typedEmail}
              onChange={(e) => setTypedEmail(e.target.value)}
              disabled={busy}
              placeholder={requireEmailConfirmation}
              autoComplete="off"
              style={{ width: "100%" }}
            />
          </div>
        )}

        <div style={{ marginBottom: "1rem" }}>
          <label
            htmlFor="admin-password-input"
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
            id="admin-password-input"
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
              passwordError ? "admin-password-error" : undefined
            }
            style={{
              width: "100%",
              borderColor: passwordError ? "#EF4444" : undefined,
            }}
          />
          {passwordError && (
            <span
              id="admin-password-error"
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
            disabled={!canSubmit}
            className={isDanger ? "button-danger" : ""}
            style={
              isDanger
                ? { backgroundColor: "#E11D48", color: "#FFFFFF" }
                : undefined
            }
          >
            {busy ? "Đang xử lý…" : actionLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
