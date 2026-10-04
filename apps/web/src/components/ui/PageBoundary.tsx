import { Component, useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
export class PageBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section className="card">
        <h1>Chưa mở được trang</h1>
        <p role="alert">
          Có thể ứng dụng vừa cập nhật hoặc kết nối bị gián đoạn. Tải lại để
          tiếp tục.
        </p>
        <button className="button" onClick={() => window.location.reload()}>
          Tải lại ứng dụng
        </button>
      </section>
    ) : (
      this.props.children
    );
  }
}
export function RouteFocus() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}
