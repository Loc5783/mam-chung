import {
  NavLink,
  Link,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import {
  Sprout,
  LayoutDashboard,
  Wallet,
  Heart,
  CheckSquare,
  Dumbbell,
  Settings,
  LogIn,
  ChevronRight,
  Plus,
} from "lucide-react";
import { AuthPage } from "../features/auth/AuthPage";
import { Dashboard } from "../features/dashboard/Dashboard";
import { Card, EmptyState, Toast } from "../components/ui";
import { AuthBootstrap, AuthGate } from "../features/auth/AuthGate";
import { useAuthStore } from "../features/auth/store";
import { SettingsPage } from "../features/settings/SettingsPage";
import { AccountHome } from "../features/dashboard/AccountHome";
import { Avatar } from "../components/ui/Avatar";
const navigation = [
  { to: "/", label: "Tổng quan", icon: LayoutDashboard },
  { to: "/finance", label: "Tài chính cá nhân", icon: Wallet },
  { to: "/couple", label: "Không gian chung", icon: Heart },
  { to: "/tasks", label: "Công việc", icon: CheckSquare },
  { to: "/fitness", label: "Tập luyện", icon: Dumbbell },
];
function Layout({ preview = false }: { preview?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const current =
    location.pathname === "/preview"
      ? "Tổng quan mẫu"
      : navigation.find((n) => n.to === location.pathname)?.label || "Cài đặt";
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <Link className="brand" to={preview ? "/preview" : "/"}>
          <span className="brand-icon">
            <Sprout />
          </span>
          Mầm Chung<span className="brand-dot">.</span>
        </Link>
        <span className="sidebar-caption">CÙNG NHAU LỚN LÊN</span>
        <nav aria-label="Điều hướng chính">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end>
              <Icon size={20} />
              {label}
              {to === "/couple" && <span className="nav-heart">♡</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-growth">
          <Sprout size={32} />
          <b>
            Gieo hôm nay,
            <br />
            gặt ngày mai.
          </b>
          <p>Những thói quen nhỏ tạo nên một cuộc sống tốt đẹp.</p>
        </div>
        <div className="sidebar-bottom">
          <NavLink to="/settings">
            <Settings size={20} />
            Cài đặt
          </NavLink>
          <Link to={user ? "/settings" : "/login"} className="profile">
            <Avatar user={user} />
            <span>
              <b>{user?.name || "Chào bạn"}</b>
              <small>{user ? "Hồ sơ của bạn" : "Đăng nhập để bắt đầu"}</small>
            </span>
            <LogIn size={17} />
          </Link>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            Mầm Chung <ChevronRight size={13} /> <b>{current}</b>
          </span>
          <span className="topbar-right">
            <span className="preview-indicator" />{" "}
            {preview ? "Giao diện mẫu" : "Không gian cá nhân"}{" "}
            <Avatar user={user} small />
          </span>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Điều hướng trên điện thoại">
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink end to={to} key={to}>
            <Icon size={21} />
            <span>
              {label === "Tài chính cá nhân"
                ? "Tài chính"
                : label === "Không gian chung"
                  ? "Chung"
                  : label}
            </span>
          </NavLink>
        ))}
      </nav>
      <Link
        to="/login"
        className="quick-add"
        aria-label="Đăng nhập để thêm nhanh"
      >
        <Plus size={23} />
      </Link>
    </div>
  );
}
function FeaturePage({ title }: { title: string }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MẦM CHUNG</span>
          <h1>{title}</h1>
        </div>
      </div>
      <Card>
        <EmptyState title={`${title} đang chờ được vun đắp`}>
          Chức năng này sẽ được triển khai ở giai đoạn tiếp theo của tài liệu.
        </EmptyState>
        <Link className="button empty-action" to="/">
          Về tổng quan
        </Link>
      </Card>
    </>
  );
}
export function App() {
  return (
    <>
      <AuthBootstrap />
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<AuthPage registerMode />} />
        <Route path="/preview" element={<Layout preview />}>
          <Route index element={<Dashboard />} />
        </Route>
        <Route element={<AuthGate />}>
          <Route element={<Layout />}>
            <Route index element={<AccountHome />} />
            <Route path="/settings" element={<SettingsPage />} />
            {[
              ["finance", "Tài chính cá nhân"],
              ["couple", "Không gian chung"],
              ["tasks", "Công việc"],
              ["fitness", "Tập luyện"],
            ].map(([path, title]) => (
              <Route
                key={path}
                path={path}
                element={<FeaturePage title={title} />}
              />
            ))}
            <Route
              path="*"
              element={<FeaturePage title="Không tìm thấy trang" />}
            />
          </Route>
        </Route>
      </Routes>
      <Toast />
    </>
  );
}
