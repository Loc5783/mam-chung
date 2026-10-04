/* Built with an explicit public-file allowlist. Never cache API responses or user pages. */
const VERSION = "__VERSION__";
const FILES = __PRECACHE__;
const CACHE = "mam-chung-public-" + VERSION;
const allowed = new Set(FILES);
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("mam-chung-public-") && key !== CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname === "/api" ||
    url.pathname.startsWith("/api/")
  )
    return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.open(CACHE).then((cache) => cache.match("/offline.html")),
      ),
    );
    return;
  }
  if (url.search || !allowed.has(url.pathname)) return;
  event.respondWith(
    caches
      .open(CACHE)
      .then(
        async (cache) => (await cache.match(url.pathname)) || fetch(request),
      ),
  );
});
