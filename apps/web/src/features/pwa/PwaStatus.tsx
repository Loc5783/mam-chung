import { useEffect, useState } from "react";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export function PwaStatus() {
  const [online, setOnline] = useState(navigator.onLine),
    [install, setInstall] = useState<InstallEvent | null>(null),
    [waiting, setWaiting] = useState<ServiceWorker | null>(null),
    [busy, setBusy] = useState(false),
    [installError, setInstallError] = useState(false);
  useEffect(() => {
    const connection = () => setOnline(navigator.onLine),
      prompt = (e: Event) => {
        e.preventDefault();
        setInstall(e as InstallEvent);
      },
      installed = () => setInstall(null);
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    window.addEventListener("beforeinstallprompt", prompt);
    window.addEventListener("appinstalled", installed);
    let cancelled = false;
    let reg: ServiceWorkerRegistration | undefined;
    const update = () => {
      if (reg?.waiting && !cancelled) setWaiting(reg.waiting);
    };
    const found = () => {
      const worker = reg?.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller)
          update();
      });
    };
    if (import.meta.env.PROD && "serviceWorker" in navigator)
      void navigator.serviceWorker
        .register("/sw.js")
        .then((r) => {
          reg = r;
          if (cancelled) return;
          update();
          r.addEventListener("updatefound", found);
        })
        .catch(() => {
          /* Website remains usable without installation. */
        });
    return () => {
      cancelled = true;
      reg?.removeEventListener("updatefound", found);
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
      window.removeEventListener("beforeinstallprompt", prompt);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  const installApp = async () => {
    if (!install) return;
    setBusy(true);
    try {
      await install.prompt();
      await install.userChoice;
    } catch {
      setInstallError(true);
    } finally {
      setInstall(null);
      setBusy(false);
    }
  };
  const update = () => {
    if (!waiting) return;
    setBusy(true);
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => window.location.reload(),
      { once: true },
    );
    waiting.postMessage({ type: "SKIP_WAITING" });
  };
  if (online && !install && !waiting && !installError) return null;
  return (
    <aside className="pwa-status" aria-label="Trạng thái ứng dụng">
      <p role="status">
        {!online
          ? "Bạn đang mất mạng. Cần kết nối để tải và lưu dữ liệu."
          : waiting
            ? "Có phiên bản mới. Lưu việc đang làm trước khi cập nhật."
            : installError
              ? "Chưa cài được ứng dụng. Bạn vẫn có thể sử dụng website."
              : "Bạn có thể cài Mầm Chung để mở nhanh từ màn hình chính."}
      </p>
      {online && waiting ? (
        <button className="button" disabled={busy} onClick={update}>
          Cập nhật ứng dụng
        </button>
      ) : online && install ? (
        <button
          className="button"
          disabled={busy}
          onClick={() => void installApp()}
        >
          Cài ứng dụng
        </button>
      ) : null}
    </aside>
  );
}
