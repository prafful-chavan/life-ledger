/**
 * Life Ledger — daily price history loader shared by the Wealth Advisor and the net worth finalizer.
 * Fetches closes through your Apps Script (?history=…), caches per symbol on this device.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(typeof localStorage !== "undefined" ? localStorage : null, typeof fetch !== "undefined" ? fetch : null);
  else root.LifeLedgerPriceHistory = factory(root.localStorage, function () { return root.fetch.apply(root, arguments); });
})(typeof self !== "undefined" ? self : this, function (storage, fetchFn) {
  const KEY = "lifeLedgerAdvisorHistory:v1";
  const DEFAULT_MAX_AGE = 12 * 60 * 60 * 1000;
  let status = "";
  const env = { storage, fetch: fetchFn };

  const read = () => { try { return JSON.parse(env.storage.getItem(KEY) || "null") || { at: 0, t: {}, series: {} }; } catch { return { at: 0, t: {}, series: {} }; } };
  const write = (c) => { try { env.storage.setItem(KEY, JSON.stringify(c)); } catch { /* quota: refetch next time */ } };
  function proxyUrl() {
    try { return (env.storage.getItem("lifeLedgerStockProxyUrl") || "").trim().replace(/^["']|["']$/g, "").replace(/\?+$/, ""); } catch { return ""; }
  }
  const toSeries = (s) => (s && s.d && s.c ? { dates: s.d, closes: s.c } : null);

  /**
   * keys: Yahoo tickers ("TCS.NS", "AAPL", "INR=X") and "mf:<AMFI code>".
   * network=false → cache only. maxAgeMs → how stale a cached series may be.
   */
  async function load(keys, opts = {}) {
    const { network = true, maxAgeMs = DEFAULT_MAX_AGE } = opts;
    const cache = read();
    if (!cache.t) cache.t = {};
    if (!network) return cache.series;
    const now = Date.now();
    const need = keys.filter((k) => !cache.series[k] || now - (cache.t[k] || cache.at || 0) > maxAgeMs);
    const url = proxyUrl();
    if (!need.length) return cache.series;
    if (!url) { status = "Add your Apps Script link in Settings to compare each investment with the market."; return cache.series; }
    status = "Loading price history…";
    for (let i = 0; i < need.length; i += 40) {
      const chunk = need.slice(i, i + 40);
      try {
        const res = await env.fetch(`${url}?history=${encodeURIComponent(chunk.join(","))}&days=400`, { redirect: "follow" });
        const json = await res.json();
        if (json && json.series) {
          Object.assign(cache.series, json.series);
          Object.keys(json.series).forEach((k) => { cache.t[k] = now; });
        }
      } catch { status = "Price history is unavailable right now, so some judgements are paused."; }
    }
    cache.at = now;
    write(cache);
    if (status.startsWith("Loading")) status = "";
    return cache.series;
  }

  return { load, toSeries, status: () => status, _env: env };
});
