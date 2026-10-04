// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { it, expect, vi } from "vitest";
const template = readFileSync(
  new URL("../../sw-template.js", import.meta.url),
  "utf8",
);
function worker() {
  const handlers: Record<string, (event: Record<string, unknown>) => void> = {};
  const match = vi.fn().mockResolvedValue("cached public asset"),
    addAll = vi.fn().mockResolvedValue(undefined),
    cache = { match, addAll };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi.fn().mockResolvedValue(["mam-chung-public-old", "another-app"]),
    delete: vi.fn().mockResolvedValue(true),
  };
  const fetch = vi.fn().mockResolvedValue("network response");
  const self = {
    location: { origin: "http://localhost" },
    clients: { claim: vi.fn() },
    skipWaiting: vi.fn(),
    addEventListener: (
      name: string,
      fn: (event: Record<string, unknown>) => void,
    ) => {
      handlers[name] = fn;
    },
  };
  runInNewContext(
    template
      .replace("__VERSION__", "test")
      .replace(
        "__PRECACHE__",
        JSON.stringify(["/assets/main-abcd.js", "/offline.html"]),
      ),
    { self, caches, fetch, URL, Set },
  );
  const event = (url: string, method = "GET", mode = "cors") => {
    const respondWith = vi.fn();
    handlers.fetch({ request: { url, method, mode }, respondWith });
    return respondWith;
  };
  return { handlers, self, caches, fetch, match, addAll, event };
}
it("worker never intercepts API, auth, mutations, cross-origin or unlisted files", () => {
  const w = worker();
  for (const [url, method] of [
    ["http://localhost/api/dashboard", "GET"],
    ["http://localhost/api/auth/refresh", "POST"],
    ["http://localhost/api/notifications", "GET"],
    ["http://localhost/assets/main-abcd.js", "POST"],
    ["https://other.test/assets/main-abcd.js", "GET"],
    ["http://localhost/private-export.csv", "GET"],
    ["http://localhost/assets/main-abcd.js?token=secret", "GET"],
  ])
    expect(w.event(url, method)).not.toHaveBeenCalled();
  expect(w.caches.open).not.toHaveBeenCalled();
});
it("offline navigation uses generic offline page; never cached private page", async () => {
  const w = worker();
  w.fetch.mockRejectedValueOnce(new Error("offline"));
  const r = w.event("http://localhost/settings", "GET", "navigate");
  expect(await r.mock.calls[0][0]).toBe("cached public asset");
  expect(w.match).toHaveBeenCalledWith("/offline.html");
});
it("online navigation always fetches and is not written into cache", async () => {
  const w = worker();
  const r = w.event("http://localhost/finance", "GET", "navigate");
  expect(await r.mock.calls[0][0]).toBe("network response");
  expect(w.caches.open).not.toHaveBeenCalled();
});
it("only public precached assets can be served offline", async () => {
  const w = worker();
  const r = w.event("http://localhost/assets/main-abcd.js");
  expect(await r.mock.calls[0][0]).toBe("cached public asset");
  expect(w.fetch).not.toHaveBeenCalled();
  expect(w.match).toHaveBeenCalledWith("/assets/main-abcd.js");
});
it("missing public asset falls through to network", async () => {
  const w = worker();
  w.match.mockResolvedValueOnce(undefined);
  const r = w.event("http://localhost/assets/main-abcd.js");
  expect(await r.mock.calls[0][0]).toBe("network response");
  expect(w.fetch).toHaveBeenCalledOnce();
});
it("install caches only allowlist and does not force update", async () => {
  const w = worker(),
    waitUntil = vi.fn();
  w.handlers.install({ waitUntil });
  await waitUntil.mock.calls[0][0];
  expect(w.addAll).toHaveBeenCalledWith([
    "/assets/main-abcd.js",
    "/offline.html",
  ]);
  expect(w.self.skipWaiting).not.toHaveBeenCalled();
});
it("activate removes only older caches belonging to this app", async () => {
  const w = worker(),
    waitUntil = vi.fn();
  w.handlers.activate({ waitUntil });
  await waitUntil.mock.calls[0][0];
  expect(w.caches.delete).toHaveBeenCalledWith("mam-chung-public-old");
  expect(w.self.clients.claim).toHaveBeenCalledOnce();
});
it("new worker activates only after explicit update message", () => {
  const w = worker();
  w.handlers.message({ data: { type: "OTHER" } });
  expect(w.self.skipWaiting).not.toHaveBeenCalled();
  w.handlers.message({ data: { type: "SKIP_WAITING" } });
  expect(w.self.skipWaiting).toHaveBeenCalledOnce();
});
