/* Life Ledger service worker — network-first so code is never stale, with an
 * offline fallback. Bump CACHE_VERSION on releases that change cached shell files. */
const CACHE_VERSION = "ll-shell-v11";
const SHELL = ["./", "./index.html", "./styles.css", "./app.js", "./expenses-core.js", "./networth-snapshot.js", "./salary-core.js", "./salary-insights-core.js", "./spending-insights-core.js", "./dashboard-settings.js", "./dashboard-charts.js", "./dashboard-views.js", "./networth-weekly.js", "./mf-panel-core.js", "./stocks-panel-core.js", "./remember-core.js", "./auth.js", "./sync-engine.js", "./sync-client.js", "./app-version.js", "./vault-store.js", "./drive-sync.js", "./ui-polish.js", "./manifest.webmanifest"];

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
  // Files that carry a ?v= release number never change under that URL, so serve them straight from the cache:
  // no per-file network check on every start. index.html (below) stays network-first, so a new release's
  // new ?v= numbers always arrive and the old ones are dropped.
  if (url.searchParams.has("v") && /\.(js|css)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_VERSION).then((cache) =>
        cache.match(req).then((hit) => hit || fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            cache.put(req, copy).then(() => cache.keys()).then((keys) => Promise.all(
              keys.filter((k) => { const u = new URL(k.url); return u.pathname === url.pathname && u.search !== url.search; }).map((k) => cache.delete(k))
            )).catch(() => {});
          }
          return res;
        }))
      )
    );
    return;
  }
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
