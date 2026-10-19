import { Navigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../auth/store";
import { ViewErrorBoundary } from "../../components/ui/ViewErrorBoundary";
import { OverviewTab } from "./OverviewTab";
import { UsersTab } from "./UsersTab";
import { CouplesTab } from "./CouplesTab";
import { SettingsTab } from "./SettingsTab";
import { AuditTab } from "./AuditTab";
import {
  ShieldAlert,
  LayoutDashboard,
  Users,
  Heart,
  Sliders,
  History,
} from "lucide-react";
import "./admin.css";

type TabKey = "overview" | "users" | "couples" | "settings" | "audit";

const TABS: { key: TabKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "Tổng quan", icon: LayoutDashboard },
  { key: "users", label: "Tài khoản", icon: Users },
  { key: "couples", label: "Cặp đôi", icon: Heart },
  { key: "settings", label: "Cài đặt", icon: Sliders },
  { key: "audit", label: "Nhật ký", icon: History },
];

export function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const [searchParams, setSearchParams] = useSearchParams();

  const currentTab = (searchParams.get("tab") as TabKey) || "overview";
  const activeTab: TabKey = TABS.some((t) => t.key === currentTab)
    ? currentTab
    : "overview";

  // Frontend guard: Redirect non-admin to home page
  if (!user || user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  const setTab = (tab: TabKey) => {
    setSearchParams({ tab });
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1>
            <ShieldAlert size={28} color="var(--color-accent, #7E9B57)" />
            Quản trị hệ thống
          </h1>
          <p
            style={{
              margin: "0.25rem 0 0",
              color: "var(--color-text-muted, #64748B)",
              fontSize: "0.9rem",
            }}
          >
            Quản lý tài khoản, cặp đôi và bảo mật hệ thống. Dữ liệu riêng tư của
            người dùng được cách ly tuyệt đối.
          </p>
        </div>
        <span className="admin-badge">
          🛡️ Quyền quản trị viên: {user.email}
        </span>
      </div>

      <nav className="admin-tabs" aria-label="Các mục quản trị">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={`admin-tab-button ${activeTab === key ? "active" : ""}`}
            onClick={() => setTab(key)}
            aria-selected={activeTab === key}
            role="tab"
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="admin-tab-content">
        {activeTab === "overview" && (
          <ViewErrorBoundary name="admin-overview">
            <OverviewTab />
          </ViewErrorBoundary>
        )}
        {activeTab === "users" && (
          <ViewErrorBoundary name="admin-users">
            <UsersTab />
          </ViewErrorBoundary>
        )}
        {activeTab === "couples" && (
          <ViewErrorBoundary name="admin-couples">
            <CouplesTab />
          </ViewErrorBoundary>
        )}
        {activeTab === "settings" && (
          <ViewErrorBoundary name="admin-settings">
            <SettingsTab />
          </ViewErrorBoundary>
        )}
        {activeTab === "audit" && (
          <ViewErrorBoundary name="admin-audit">
            <AuditTab />
          </ViewErrorBoundary>
        )}
      </div>
    </div>
  );
}
