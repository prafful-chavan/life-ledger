/* Life Ledger service worker — network-first so code is never stale, with an
 * offline fallback. Bump CACHE_VERSION on releases that change cached shell files. */
const CACHE_VERSION = "ll-shell-v1";
const SHELL = ["./", "./index.html", "./styles.css", "./app.js", "./auth.js", "./sync-engine.js", "./sync-client.js", "./vault-store.js", "./drive-sync.js", "./ui-polish.js", "./manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // prices, Drive, gateway: never intercept
  event.respondWith(
    fetch(req, { cache: "no-cache" })
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: false }).then((hit) => hit || caches.match(req, { ignoreSearch: true })))
  );
});
