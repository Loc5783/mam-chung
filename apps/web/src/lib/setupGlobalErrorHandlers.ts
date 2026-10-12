import { useUiStore } from "../app/store";

let initialized = false;

export function setupGlobalErrorHandlers() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    // Don't toast for user cancellation, Axios canceled requests, or navigation redirects
    if (
      reason?.name === "CanceledError" ||
      reason?.code === "ERR_CANCELED" ||
      reason?.message?.includes("canceled")
    ) {
      return;
    }
    console.error("[Unhandled Promise Rejection]:", reason);
    const msg =
      typeof reason === "string"
        ? reason
        : reason?.message ||
          "Đã xảy ra sự cố không mong muốn. Dữ liệu của bạn vẫn an toàn.";
    useUiStore.getState().notify(msg);
  });

  window.addEventListener("error", (event) => {
    // Suppress benign loop warnings like ResizeObserver in dev/tests
    if (
      event.message?.includes("ResizeObserver loop") ||
      event.message?.includes("ResizeObserver")
    ) {
      return;
    }
    console.error("[Global Window Error]:", event.error || event.message);
    useUiStore
      .getState()
      .notify("Đã xảy ra lỗi giao diện. Vui lòng tải lại nếu cần.");
  });
}
