import { useEffect, useState } from "react";
import { adminApi } from "./api";
import type { AdminOverview } from "./types";
import { Skeleton, Button, EmptyState } from "../../components/ui";
import { classifyError } from "../../lib/apiClient";
import {
  Users,
  Heart,
  ShieldCheck,
  RefreshCw,
  UserCheck,
  UserX,
  UserPlus,
} from "lucide-react";

export function OverviewTab() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const overview = await adminApi.getOverview();
      setData(overview);
    } catch (err) {
      const classified = classifyError(err);
      setError(classified.message || "Không thể tải dữ liệu tổng quan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="admin-overview-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="admin-metric-card">
            <Skeleton style={{ height: "1.2rem", width: "60%" }} />
            <Skeleton style={{ height: "2.2rem", width: "40%" }} />
          </div>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <EmptyState title="Không thể tải tổng quan">
          {error || "Đã xảy ra lỗi khi nạp số liệu quản trị."}
        </EmptyState>
        <Button
          className="button-outline"
          onClick={loadData}
          style={{ marginTop: "1rem" }}
        >
          <RefreshCw size={16} /> Thử lại
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "1rem",
        }}
      >
        <Button
          className="compact button-outline"
          onClick={loadData}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          <RefreshCw size={15} /> Làm mới
        </Button>
      </div>

      <div className="admin-overview-grid">
        <div className="admin-metric-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span className="admin-metric-label">Tổng tài khoản</span>
            <Users size={18} color="var(--color-accent, #7E9B57)" />
          </div>
          <span className="admin-metric-value">{data.totalUsers}</span>
        </div>

        <div className="admin-metric-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span className="admin-metric-label">Đang hoạt động (7 ngày)</span>
            <UserCheck size={18} color="#16A34A" />
          </div>
          <span className="admin-metric-value">{data.activeUsers7d}</span>
        </div>

        <div className="admin-metric-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span className="admin-metric-label">Tài khoản bị tạm khóa</span>
            <UserX size={18} color="#D97706" />
          </div>
          <span
            className="admin-metric-value"
            style={{ color: data.disabledUsers > 0 ? "#D97706" : undefined }}
          >
            {data.disabledUsers}
          </span>
        </div>

        <div className="admin-metric-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span className="admin-metric-label">Tài khoản mới (7 ngày)</span>
            <UserPlus size={18} color="#3B82F6" />
          </div>
          <span className="admin-metric-value">{data.newUsers7d}</span>
        </div>

        <div className="admin-metric-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span className="admin-metric-label">
              Không gian chung hoạt động
            </span>
            <Heart size={18} color="var(--color-rose, #E38FA9)" />
          </div>
          <span className="admin-metric-value">{data.activeCouples}</span>
        </div>

        <div className="admin-metric-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span className="admin-metric-label">Không gian đã lưu trữ</span>
            <ShieldCheck size={18} color="#64748B" />
          </div>
          <span className="admin-metric-value">{data.archivedCouples}</span>
        </div>
      </div>

      <div className="admin-metric-card" style={{ marginTop: "1rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h3
              style={{
                margin: "0 0 0.25rem 0",
                fontSize: "1rem",
                fontWeight: 600,
              }}
            >
              Cổng đăng ký tài khoản mới
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: "0.85rem",
                color: "var(--color-text-muted, #64748B)",
              }}
            >
              {data.registrationOpen
                ? "Hệ thống đang mở cho phép người dùng mới đăng ký."
                : "Hệ thống hiện đang tạm ngưng tiếp nhận đăng ký mới."}
            </p>
          </div>
          <span
            className={`status-badge ${data.registrationOpen ? "active" : "disabled"}`}
          >
            {data.registrationOpen ? "Đang mở" : "Tạm ngưng"}
          </span>
        </div>
      </div>
    </div>
  );
}
