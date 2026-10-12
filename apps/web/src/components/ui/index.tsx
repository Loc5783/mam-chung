import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { X, Sprout } from "lucide-react";
import { useUiStore } from "../../app/store";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  sheen?: boolean;
}

export function Button({ sheen, className = "", ...props }: ButtonProps) {
  const isPrimary =
    !className.includes("button-outline") &&
    !className.includes("button-danger") &&
    !className.includes("button-ghost") &&
    !className.includes("icon-button") &&
    !className.includes("compact");
  const hasSheen = sheen ?? isPrimary;
  const sheenClass = hasSheen ? "button-sheen" : "";
  return (
    <button {...props} className={`button ${sheenClass} ${className}`.trim()} />
  );
}

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  children: ReactNode;
  className?: string;
  spotlight?: boolean;
  style?: React.CSSProperties;
}

export function Card({
  children,
  className = "",
  spotlight = true,
  style,
  ...props
}: CardProps) {
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    props.onPointerMove?.(e);
    if (!spotlight || e.pointerType === "touch") return;
    const currentTarget = e.currentTarget;
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
    }

    rafId.current = requestAnimationFrame(() => {
      const rect = currentTarget.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      currentTarget.style.setProperty("--mx", `${x}px`);
      currentTarget.style.setProperty("--my", `${y}px`);
    });
  };

  return (
    <section
      {...props}
      onPointerMove={handlePointerMove}
      data-spotlight={spotlight ? "true" : undefined}
      className={`card ${className}`.trim()}
      style={style}
    >
      {children}
    </section>
  );
}
export function EmptyState({
  title,
  children,
  icon,
}: {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon ? (
        <div className="empty-state-icon">{icon}</div>
      ) : (
        <Sprout size={36} className="empty-state-icon" />
      )}
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Skeleton({ className = "" }: { className?: string } = {}) {
  return (
    <div
      className={`skeleton ${className}`.trim()}
      aria-label="Đang tải"
      role="status"
    />
  );
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

export { ViewErrorBoundary } from "./ViewErrorBoundary";
