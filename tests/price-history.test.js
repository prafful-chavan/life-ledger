const assert = require("assert");
const PH = require("../price-history.js");

const mem = new Map([["lifeLedgerStockProxyUrl", '"https://proxy.test/exec"']]);
PH._env.storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };
const calls = [];
PH._env.fetch = async (url) => {
  calls.push(decodeURIComponent(url));
  const keys = decodeURIComponent(url.split("history=")[1].split("&")[0]).split(",");
  return { json: async () => ({ ok: true, series: Object.fromEntries(keys.filter((k) => k !== "BAD").map((k) => [k, { d: ["2026-10-14"], c: [100] }])) }) };
};

(async () => {
  let s = await PH.load(["TCS.NS", "INR=X", "BAD"]);
  assert.deepStrictEqual(Object.keys(s).sort(), ["INR=X", "TCS.NS"], "failed symbols are simply absent");
  assert.strictEqual(calls.length, 1);
  assert.ok(calls[0].includes("https://proxy.test/exec?history="), "quotes around the saved URL are stripped");

  await PH.load(["TCS.NS", "INR=X"]);
  assert.strictEqual(calls.length, 1, "fresh cache: no new request");

  // a stricter freshness requirement refetches
  const cache = JSON.parse(mem.get("lifeLedgerAdvisorHistory:v1"));
  cache.t["TCS.NS"] = Date.now() - 3 * 3600 * 1000; mem.set("lifeLedgerAdvisorHistory:v1", JSON.stringify(cache));
  await PH.load(["TCS.NS", "INR=X"], { maxAgeMs: 2 * 3600 * 1000 });
  assert.strictEqual(calls.length, 2);
  assert.ok(calls[1].includes("history=TCS.NS") && !calls[1].includes("INR=X"), "only the stale symbol is refetched");

  // cache-only mode never touches the network
  await PH.load(["NEW.NS"], { network: false });
  assert.strictEqual(calls.length, 2);
  assert.deepStrictEqual(PH.toSeries({ d: ["a"], c: [1] }), { dates: ["a"], closes: [1] });
  assert.strictEqual(PH.toSeries(null), null);

  // no proxy → explains itself instead of failing
  mem.delete("lifeLedgerStockProxyUrl");
  await PH.load(["ZZZ.NS"]);
  assert.ok(PH.status().includes("Apps Script link"));
  console.log("price-history tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
