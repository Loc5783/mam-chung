import { createPortal } from "react-dom";
import { useEffect, useRef, useId, type ReactNode } from "react";
import { X } from "lucide-react";
let count = 0;
let originalOverflow = "",
  originalInert = false;
export function Modal({
  title,
  children,
  onClose,
  busy = false,
  variant = "modal",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  variant?: "modal" | "drawer";
}) {
  const panel = useRef<HTMLDivElement>(null),
    titleId = useId();
  const latest = useRef({ onClose, busy });
  latest.current = { onClose, busy };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = panel.current;
    const select = () =>
      Array.from(
        element?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[href],[tabindex="0"]',
        ) ?? [],
      );
    const firstInput = select().find((el) => el.tagName === "INPUT");
    (firstInput ?? select()[0] ?? element)?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !latest.current.busy)
        latest.current.onClose();
      if (event.key === "Tab") {
        const items = select();
        const first = items[0],
          last = items.at(-1);
        if (!items.length) {
          event.preventDefault();
          element?.focus();
          return;
        }
        if (!element?.contains(document.activeElement)) {
          event.preventDefault();
          first?.focus();
          return;
        }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    const root = document.getElementById("root");
    if (count++ === 0) {
      originalOverflow = document.body.style.overflow;
      originalInert = root?.hasAttribute("inert") ?? false;
      root?.setAttribute("inert", "");
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handler);
      if (--count === 0) {
        document.body.style.overflow = originalOverflow;
        if (!originalInert) root?.removeAttribute("inert");
      }
      previous?.focus();
    };
  }, []);
  return createPortal(
    <div
      className={`modal-backdrop ${variant === "drawer" ? "todo-drawer-backdrop" : ""}`}
    >
      <div
        className={`modal-panel ${variant === "drawer" ? "todo-detail-drawer" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={panel}
      >
        <div className="section-heading">
          <h2 id={titleId}>{title}</h2>
          <button
            className="icon-button"
            aria-label="Đóng hộp thoại"
            onClick={onClose}
            disabled={busy}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
