import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "./store";
import { restoreSession } from "../../lib/apiClient";
import { Button, Card, Skeleton } from "../../components/ui";
export function AuthBootstrap() {
  useEffect(() => {
    if (useAuthStore.getState().status === "loading") void restoreSession();
  }, []);
  return null;
}
export function AuthGate() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();
  if (status === "loading")
    return (
      <main className="session-state">
        <Card>
          <h1>Đang mở không gian của bạn…</h1>
          <Skeleton />
        </Card>
      </main>
    );
  if (status === "error")
    return (
      <main className="session-state">
        <Card>
          <h1>Chưa kết nối được máy chủ</h1>
          <p>Vui lòng kiểm tra kết nối rồi thử lại.</p>
          <Button
            onClick={() => {
              useAuthStore.getState().setLoading();
              void restoreSession();
            }}
          >
            Thử lại
          </Button>
        </Card>
      </main>
    );
  if (status === "anonymous")
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <Outlet />;
}
