import { useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui";
import { Copy, Check, ShieldAlert } from "lucide-react";

export interface TempPasswordModalProps {
  temporaryPassword: string;
  userEmail: string;
  onClose: () => void;
}

export function TempPasswordModal({
  temporaryPassword,
  userEmail,
  onClose,
}: TempPasswordModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function"
      ) {
        await navigator.clipboard.writeText(temporaryPassword);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
    }
  };

  return (
    <Modal title="Mật khẩu tạm thời đã tạo" onClose={onClose}>
      <div style={{ lineHeight: 1.5 }}>
        <p
          style={{
            margin: "0 0 0.75rem",
            color: "var(--color-text-main, #334155)",
          }}
        >
          Mật khẩu mới cho tài khoản{" "}
          <b style={{ wordBreak: "break-all" }}>{userEmail}</b> đã được tạo
          thành công:
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.75rem 1rem",
            backgroundColor: "var(--color-bg-subtle, #F8FAFC)",
            border: "1px solid var(--color-border, #E2E8F0)",
            borderRadius: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          <code
            data-testid="temporary-password-display"
            style={{
              fontSize: "1.1rem",
              fontWeight: 600,
              fontFamily: "monospace",
              color: "var(--color-brand-dark, #2D3748)",
              userSelect: "all",
            }}
          >
            {temporaryPassword}
          </code>
          <Button
            type="button"
            className="compact button-outline"
            onClick={handleCopy}
            aria-label="Sao chép mật khẩu"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            {copied ? <Check size={16} color="#16A34A" /> : <Copy size={16} />}
            <span>{copied ? "Đã sao chép!" : "Sao chép"}</span>
          </Button>
        </div>

        <div
          style={{
            padding: "0.75rem",
            borderRadius: "0.375rem",
            backgroundColor: "var(--color-bg-amber, #FEF3C7)",
            color: "var(--color-text-amber, #92400E)",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "flex-start",
            gap: "0.5rem",
            marginBottom: "1.25rem",
          }}
        >
          <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <b>Chỉ hiện một lần.</b> Hãy gửi riêng cho người dùng và nhắc họ đổi
            mật khẩu ngay sau khi đăng nhập. Mật khẩu này sẽ không thể xem lại
            sau khi đóng hộp thoại này.
          </div>
        </div>

        <div
          className="modal-actions"
          style={{ display: "flex", justifyContent: "flex-end" }}
        >
          <Button type="button" onClick={onClose}>
            Đã lưu & Đóng
          </Button>
        </div>
      </div>
    </Modal>
  );
}
