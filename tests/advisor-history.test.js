const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const store = new Map();
const calls = [];
const yahoo = JSON.stringify({ chart: { result: [{ timestamp: [1760000000, 1760086400, 1760172800, 1760259200], indicators: { quote: [{ close: [100.123, null, 102.5, 101] }] } }] } });
const mf = JSON.stringify({ data: [{ date: "13-10-2026", nav: "52.1234" }, { date: "12-10-2026", nav: "51.5" }, { date: "09-10-2026", nav: "bad" }, { date: "08-10-2026", nav: "50.0" }] });
const ctx = {
  console, JSON, Date, Math, Number, String, Object, Array,
  Utilities: { formatDate: (d) => d.toISOString().slice(0, 10) },
  CacheService: { getScriptCache: () => ({
    getAll: (keys) => Object.fromEntries(keys.filter((k) => store.has(k)).map((k) => [k, store.get(k)])),
    putAll: (obj) => Object.entries(obj).forEach(([k, v]) => store.set(k, v)),
  }) },
  UrlFetchApp: { fetchAll: (reqs) => { calls.push(reqs.map((r) => r.url)); return reqs.map((r) => ({
    getResponseCode: () => (r.url.includes("MISSING") ? 404 : 200),
    getContentText: () => (r.url.includes("mfapi") ? mf : yahoo),
  })); } },
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "advisor-history.gs"), "utf8"), ctx);

const out = ctx.readHistory("TCS.NS, mf:119551 ,MISSING.NS,TCS.NS", "400");
assert.strictEqual(out.ok, true);
assert.deepStrictEqual(JSON.parse(JSON.stringify(Object.keys(out.series).sort())), ["TCS.NS", "mf:119551"], "duplicates collapse; failed symbols are reported, not fatal");
assert.deepStrictEqual(JSON.parse(JSON.stringify(out.missing)), ["MISSING.NS"]);
assert.strictEqual(out.series["TCS.NS"].d.length, 3, "null closes are dropped");
assert.strictEqual(out.series["TCS.NS"].c[0], 100.12);
assert.deepStrictEqual(JSON.parse(JSON.stringify(out.series["mf:119551"].d)), ["2026-10-08", "2026-10-12", "2026-10-13"], "mfapi dates reversed to ascending and bad rows skipped");

// second call is served from the cache (no new fetch for the same keys)
const before = calls.length;
ctx.readHistory("TCS.NS,mf:119551", "400");
assert.strictEqual(calls.length, before, "cached");
// days are trimmed
assert.strictEqual(ctx.readHistory("TCS.NS", "30").series["TCS.NS"].d.length <= 3, true);

console.log("advisor-history tests passed");
