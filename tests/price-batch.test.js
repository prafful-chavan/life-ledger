const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ── Simulated Apps Script runtime + a fake Yahoo ────────────────────────────────────────────────
function makeRuntime(yahoo) {
  const calls = { fetch: [], fetchAll: [] };
  const store = new Map();
  const resp = (code, body) => ({ getResponseCode: () => code, getContentText: () => (typeof body === "string" ? body : JSON.stringify(body)) });
  const answer = (url) => {
    const m = url.match(/\/chart\/([^?]+)\?(.*)$/);
    if (!m) return resp(404, "");
    const sym = decodeURIComponent(m[1]);
    const kind = /interval=5m/.test(m[2]) ? "ext" : "day";
    const host = url.match(/https:\/\/([^/]+)/)[1];
    const fn = yahoo[sym];
    const body = fn ? fn(kind, host) : null;
    return body ? resp(200, body) : resp(404, "");
  };
  const ctx = {
    console, Math, JSON, Date, Object, Array, String, Number, RegExp, parseFloat, parseInt, isNaN, encodeURIComponent, decodeURIComponent,
    Logger: { log() {} },
    Utilities: { formatDate: () => "17 Oct 2026, 10:00 AM", sleep() {}, base64Encode: () => "", getUuid: () => "u" },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: (t) => ({ t, setMimeType() { return this; } }) },
    CacheService: { getScriptCache: () => ({
      getAll: (keys) => { const o = {}; keys.forEach((k) => { if (store.has(k)) o[k] = store.get(k); }); return o; },
      putAll: (obj) => { Object.keys(obj).forEach((k) => store.set(k, obj[k])); },
      get: (k) => (store.has(k) ? store.get(k) : null), put: (k, v) => store.set(k, v), remove: (k) => store.delete(k),
    }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
    UrlFetchApp: {
      fetch: (url) => { calls.fetch.push(url); return answer(url); },
      fetchAll: (reqs) => { calls.fetchAll.push(reqs.map((r) => r.url)); return reqs.map((r) => answer(r.url)); },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "stock-price-proxy.gs"), "utf8"), ctx, { filename: "stock-price-proxy.gs" });
  const get = (params) => JSON.parse(ctx.doGet({ parameter: params }).t);
  return { ctx, calls, get, store };
}

// Yahoo chart body: closes = recent daily closes (last = latest session), price = live price
const chart = (price, closes, extCloses) => (kind) => ({ chart: { result: [{
  meta: { regularMarketPrice: price, chartPreviousClose: closes[0] },
  indicators: { quote: [{ close: kind === "ext" ? (extCloses || [price]) : closes }] },
}] } });

// 1) Indian stocks arrive in ONE parallel batch, with the same numbers the one-by-one path produced
{
  const rt = makeRuntime({
    "TCS.NS": chart(3950, [3900, 3920, 3940, 3930, 3950]),
    "INFY.NS": chart(1620, [1600, 1610, 1630, 1640, 1620]),
    "WIPRO.NS": chart(330, [320, 325, 335, 340, 330]),
  });
  const r = rt.get({ symbols: "TCS,INFY,WIPRO" });
  assert.strictEqual(rt.calls.fetchAll.length, 1, "one parallel batch");
  assert.strictEqual(rt.calls.fetchAll[0].length, 3);
  assert.strictEqual(rt.calls.fetch.length, 0, "no one-by-one fetches needed");
  assert.strictEqual(r.TCS.price, 3950);
  assert.strictEqual(r.TCS.prevClose, 3930, "previous close = second-to-last daily close");
  assert.strictEqual(Math.round(r.TCS.change * 100) / 100, 20);
  assert.strictEqual(r.INFY.prevClose, 1640);
  assert.ok(r.INFY.change < 0 && r.INFY.changePct < 0);
  assert.strictEqual(r.WIPRO.source, "yahoo-chart");
}

// 2) US symbols: the extended-hours price wins when it differs from the regular close
{
  const rt = makeRuntime({ AAPL: chart(200, [195, 198, 200], [199, 201.5]) });
  const r = rt.get({ symbols: "AAPL", market: "US" });
  assert.strictEqual(rt.calls.fetchAll[0].length, 2, "daily + extended request, in parallel");
  assert.strictEqual(r.AAPL.price, 201.5);
  assert.strictEqual(r.AAPL.regularPrice, 200);
  assert.strictEqual(r.AAPL.source, "yahoo-chart-extended");
}

// 3) A symbol the batch misses falls back to the slower path (query2) and still resolves
{
  const rt = makeRuntime({
    "TCS.NS": chart(3950, [3900, 3930, 3950]),
    "FLAKY.NS": (kind, host) => (host === "query2.finance.yahoo.com" ? chart(50, [48, 49, 50])(kind) : null),
  });
  const r = rt.get({ symbols: "TCS,FLAKY" });
  assert.strictEqual(r.TCS.price, 3950);
  assert.strictEqual(r.FLAKY.price, 50, "resolved through the fallback host");
  assert.ok(rt.calls.fetch.length >= 1, "only the missing one used the sequential path");
  assert.ok(rt.calls.fetch.every((u) => /FLAKY/.test(u)), "TCS never went the slow way");
}

// 4) A repeat within a minute is served from the cache: no new Yahoo traffic, identical answer
{
  const rt = makeRuntime({ "TCS.NS": chart(3950, [3900, 3930, 3950]), "INFY.NS": chart(1620, [1600, 1640, 1620]) });
  const first = rt.get({ symbols: "TCS,INFY" });
  const n = rt.calls.fetchAll.length;
  const second = rt.get({ symbols: "TCS,INFY" });
  assert.strictEqual(rt.calls.fetchAll.length, n, "second call used the cache");
  assert.strictEqual(second.TCS.price, first.TCS.price);
  assert.strictEqual(second.INFY.prevClose, first.INFY.prevClose);
  // a new symbol only fetches itself
  rt.ctx.__x = 0;
  const third = rt.get({ symbols: "TCS,INFY" });
  assert.strictEqual(third.TCS.price, 3950);
}

// 5) A big portfolio goes out in chunks of 30, still all in parallel within a chunk
{
  const yahoo = {};
  const syms = [];
  for (let i = 0; i < 65; i++) { const s = "STK" + i; syms.push(s); yahoo[s + ".NS"] = chart(100 + i, [90, 95, 100 + i]); }
  const rt = makeRuntime(yahoo);
  const r = rt.get({ symbols: syms.join(",") });
  assert.strictEqual(rt.calls.fetchAll.length, 3, "65 symbols → 30 + 30 + 5");
  assert.deepStrictEqual(rt.calls.fetchAll.map((c) => c.length), [30, 30, 5]);
  assert.strictEqual(Object.keys(r).filter((k) => /^STK/.test(k)).length, 65);
  assert.strictEqual(r.STK64.price, 164);
  assert.strictEqual(rt.calls.fetch.length, 0);
}

// 6) fetchAll blowing up must not lose the prices: everything falls back to the one-by-one path
{
  const rt = makeRuntime({ "TCS.NS": chart(3950, [3900, 3930, 3950]) });
  rt.ctx.UrlFetchApp.fetchAll = () => { throw new Error("quota"); };
  const r = rt.get({ symbols: "TCS" });
  assert.strictEqual(r.TCS.price, 3950);
  assert.ok(rt.calls.fetch.length >= 1);
}

console.log("price-batch tests passed");

// ── Real tickers must never be rewritten to ones Yahoo doesn't have (this was leaving holdings unpriced/wrong) ──
{
  const real = {
    "SILVERBEES.NS": chart(199.94, [195, 198, 199.94]), "BAJAJCON.NS": chart(472, [460, 470, 472]), "JINDALSTEL.NS": chart(1045.2, [1000, 1040, 1045.2]),
    "GOLDBEES.NS": chart(120.2, [118, 119, 120.2]), "ICICIB22.NS": chart(108.39, [105, 107, 108.39]), "RATEGAIN.NS": chart(827.2, [800, 820, 827.2]), "BHARTIARTL.NS": chart(1905, [1880, 1900, 1905]),
  };
  const rt = makeRuntime(real);
  const r = rt.get({ symbols: "SILVERBEES,BAJAJCON,JINDALSTEL,GOLDBEES,ICICIB22,RATEGAIN,BHARTIARTL" });
  assert.strictEqual(rt.calls.fetchAll.length, 1, "all seven in one parallel batch");
  assert.strictEqual(rt.calls.fetch.length, 0, "none needed the slow path");
  assert.strictEqual(r.SILVERBEES.price, 199.94);
  assert.strictEqual(r.BAJAJCON.price, 472);
  assert.strictEqual(r.JINDALSTEL.price, 1045.2);
  assert.strictEqual(r.GOLDBEES.price, 120.2, "GOLDBEES is priced as GOLDBEES, not as GOLD1");
  assert.strictEqual(r.ICICIB22.price, 108.39);
  assert.strictEqual(r.RATEGAIN.price, 827.2);
  assert.strictEqual(r.BHARTIARTL.price, 1905);
  // the old names still find the same quote
  assert.strictEqual(r.NETFSILVER.price, 199.94);
  assert.strictEqual(r.BAJAJCORP.price, 472);
  assert.strictEqual(r.JINDALSTEEL.price, 1045.2);
  assert.strictEqual(r.GOLD1.price, 120.2);
  assert.strictEqual(r.BHARAT22.price, 108.39);
  // and asking by the nickname still resolves to the real ticker
  const rt2 = makeRuntime(real);
  const r2 = rt2.get({ symbols: "NETFSILVER,BAJAJCORP,BHARTI,GOLD1" });
  assert.strictEqual(r2.SILVERBEES.price, 199.94);
  assert.strictEqual(r2.BAJAJCON.price, 472);
  assert.strictEqual(r2.BHARTIARTL.price, 1905);
  assert.strictEqual(r2.GOLDBEES.price, 120.2);
}
console.log("price-alias tests passed");
