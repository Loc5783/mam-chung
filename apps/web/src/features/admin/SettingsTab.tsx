import { useState, useEffect } from "react";
import { adminApi } from "./api";
import type { AdminSettings } from "./types";
import { AdminConfirmModal } from "./AdminConfirmModal";
import { Skeleton, Button, EmptyState } from "../../components/ui";
import { useUiStore } from "../../app/store";
import { classifyError } from "../../lib/apiClient";
import { RefreshCw, UserPlus, HeartHandshake } from "lucide-react";

export function SettingsTab() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pending change modal
  const [pendingChange, setPendingChange] = useState<{
    key: "registrationOpen" | "allowNewCouples";
    targetValue: boolean;
    title: string;
    message: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const notify = useUiStore((s) => s.notify);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getSettings();
      setSettings(data);
    } catch (err) {
      const classified = classifyError(err);
      setError(classified.message || "Không thể tải cài đặt hệ thống.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleConfirmChange = async (adminPassword: string) => {
    if (!pendingChange) return;
    setBusy(true);
    try {
      const updated = await adminApi.updateSettings({
        [pendingChange.key]: pendingChange.targetValue,
        adminPassword,
      });
      setSettings(updated);
      notify(
        pendingChange.key === "registrationOpen"
          ? pendingChange.targetValue
            ? "Đã mở cổng đăng ký tài khoản mới."
            : "Đã tạm ngưng đăng ký tài khoản mới."
          : pendingChange.targetValue
            ? "Đã mở cho phép tạo không gian chung mới."
            : "Đã tạm ngưng tạo không gian chung mới.",
      );
      setPendingChange(null);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <Skeleton style={{ height: "6rem", borderRadius: "0.75rem" }} />
        <Skeleton style={{ height: "6rem", borderRadius: "0.75rem" }} />
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <EmptyState title="Không thể tải cài đặt">{error}</EmptyState>
        <Button
          className="button-outline"
          onClick={loadSettings}
          style={{ marginTop: "1rem" }}
        >
          Thử lại
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.25rem",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: "1.1rem",
              fontWeight: 600,
              margin: "0 0 0.25rem 0",
            }}
          >
            Cấu hình cổng hệ thống
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "0.85rem",
              color: "var(--color-text-muted, #64748B)",
            }}
          >
            Các thay đổi ở đây ảnh hưởng trực tiếp đến người dùng và cần xác
            nhận bằng mật khẩu quản trị.
          </p>
        </div>
        <Button
          className="compact button-outline"
          onClick={loadSettings}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          <RefreshCw size={15} /> Làm mới
        </Button>
      </div>

      {/* Registration Open Toggle */}
      <div className="admin-settings-row">
        <div
          className="admin-settings-info"
          style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}
        >
          <div
            style={{
              padding: "0.5rem",
              borderRadius: "0.5rem",
              backgroundColor: settings.registrationOpen
                ? "#EBF3E6"
                : "#FEF3C7",
              color: settings.registrationOpen ? "#4A6B29" : "#92400E",
            }}
          >
            <UserPlus size={22} />
          </div>
          <div>
            <h3>Cho phép đăng ký tài khoản mới</h3>
            <p>
              Khi bật, khách mới có thể tự đăng ký tài khoản qua trang đăng ký.
              Khi tắt, trang đăng ký sẽ bị khóa và máy chủ từ chối tiếp nhận tài
              khoản mới.
            </p>
          </div>
        </div>

        <Button
          className={settings.registrationOpen ? "button-outline" : ""}
          onClick={() => {
            const next = !settings.registrationOpen;
            setPendingChange({
              key: "registrationOpen",
              targetValue: next,
              title: next ? "Mở cổng đăng ký mới" : "Đóng cổng đăng ký mới",
              message: next
                ? "Hệ thống sẽ cho phép người mới tạo tài khoản trở lại."
                : "Hệ thống sẽ tạm ngưng tiếp nhận người dùng mới. Các tài khoản cũ vẫn đăng nhập và sử dụng bình thường.",
            });
          }}
        >
          {settings.registrationOpen
            ? "Đang mở (Bấm để Đóng)"
            : "Đang đóng (Bấm để Mở)"}
        </Button>
      </div>

      {/* Allow New Couples Toggle */}
      <div className="admin-settings-row">
        <div
          className="admin-settings-info"
          style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}
        >
          <div
            style={{
              padding: "0.5rem",
              borderRadius: "0.5rem",
              backgroundColor: settings.allowNewCouples ? "#EBF3E6" : "#FEF3C7",
              color: settings.allowNewCouples ? "#4A6B29" : "#92400E",
            }}
          >
            <HeartHandshake size={22} />
          </div>
          <div>
            <h3>Cho phép tạo không gian chung mới</h3>
            <p>
              Khi bật, các tài khoản có thể khởi tạo không gian ghép đôi mới.
              Khi tắt, hệ thống tạm ngưng việc tạo thêm không gian đôi mới.
            </p>
          </div>
        </div>

        <Button
          className={settings.allowNewCouples ? "button-outline" : ""}
          onClick={() => {
            const next = !settings.allowNewCouples;
            setPendingChange({
              key: "allowNewCouples",
              targetValue: next,
              title: next
                ? "Mở tạo không gian chung"
                : "Đóng tạo không gian chung",
              message: next
                ? "Người dùng sẽ có thể tiếp tục tạo không gian ghép đôi mới."
                : "Người dùng sẽ tạm thời không thể khởi tạo không gian ghép đôi mới. Các không gian hiện có không bị ảnh hưởng.",
            });
          }}
        >
          {settings.allowNewCouples
            ? "Đang mở (Bấm để Đóng)"
            : "Đang đóng (Bấm để Mở)"}
        </Button>
      </div>

      {/* Confirm Password Modal for Setting Changes */}
      {pendingChange && (
        <AdminConfirmModal
          title={pendingChange.title}
          message={pendingChange.message}
          actionLabel="Xác nhận thay đổi"
          isDanger={!pendingChange.targetValue}
          busy={busy}
          onClose={() => setPendingChange(null)}
          onConfirm={handleConfirmChange}
        />
      )}
    </div>
  );
}
