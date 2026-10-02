import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { X, Sprout } from "lucide-react";
import { useUiStore } from "../../app/store";
export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`button ${props.className || ""}`} />;
}
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Sprout size={36} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Skeleton() {
  return <div className="skeleton" aria-label="Đang tải" role="status" />;
}
export function Toast() {
  const { toast, dismiss } = useUiStore();
  useEffect(() => {
    if (toast) {
      const id = setTimeout(dismiss, 5500);
      return () => clearTimeout(id);
    }
  }, [toast, dismiss]);
  return toast ? (
    <div className="toast" role="status">
      {toast}
      <button aria-label="Đóng thông báo" onClick={dismiss}>
        <X size={18} />
      </button>
    </div>
  ) : null;
}
