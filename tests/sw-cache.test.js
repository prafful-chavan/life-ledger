const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

// Run sw.js against a tiny fake of the service-worker environment
function makeWorker() {
  const store = new Map();                       // url -> response
  const listeners = {};
  const net = { calls: [], files: {} };          // what the "server" has
  class Req { constructor(u, o) { this.url = u instanceof Req ? u.url : u; this.method = (o && o.method) || "GET"; } }
  const cache = {
    match: async (req) => { const r = store.get(req.url || req); return r ? r.clone() : undefined; },
    put: async (req, res) => { store.set(req.url || req, res); },
    keys: async () => [...store.keys()].map((url) => ({ url })),
    delete: async (k) => store.delete(k.url || k),
    add: async () => {},
  };
  const mkRes = (body) => ({ ok: true, body, clone() { return mkRes(body); } });
  const ctx = {
    self: { addEventListener: (t, f) => { listeners[t] = f; }, location: { origin: "https://app.test" }, skipWaiting() {}, clients: { claim() {} } },
    caches: { open: async () => cache, keys: async () => [], delete: async () => {}, match: async (r) => cache.match(r) },
    Request: Req, URL, Promise,
    fetch: async (req) => { const url = req.url || req; net.calls.push(url); if (net.files[url] === undefined) throw new Error("offline"); return mkRes(net.files[url]); },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/../sw.js", "utf8"), ctx);
  const request = async (url) => {
    let answer;
    listeners.fetch({ request: new Req(url), respondWith: (p) => { answer = p; } });
    return answer ? answer : null;
  };
  return { request, net, store };
}

(async () => {
  const w = makeWorker();
  w.net.files["https://app.test/app.js?v=1"] = "code-1";
  w.net.files["https://app.test/index.html"] = "page-1";

  // first use of a versioned file: fetched once, then served from the cache with no network
  assert.strictEqual((await (await w.request("https://app.test/app.js?v=1"))).body, "code-1");
  const callsAfterFirst = w.net.calls.length;
  assert.strictEqual((await (await w.request("https://app.test/app.js?v=1"))).body, "code-1");
  assert.strictEqual(w.net.calls.length, callsAfterFirst, "versioned file is not re-fetched");

  // a new release (new ?v=) is fetched, and the old copy is dropped
  w.net.files["https://app.test/app.js?v=2"] = "code-2";
  assert.strictEqual((await (await w.request("https://app.test/app.js?v=2"))).body, "code-2");
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(!w.store.has("https://app.test/app.js?v=1"), "old version removed");
  assert.ok(w.store.has("https://app.test/app.js?v=2"));

  // the page itself is always checked on the network, so new releases arrive
  await (await w.request("https://app.test/index.html"));
  const n1 = w.net.calls.length;
  w.net.files["https://app.test/index.html"] = "page-2";
  assert.strictEqual((await (await w.request("https://app.test/index.html"))).body, "page-2");
  assert.ok(w.net.calls.length > n1, "index.html goes to the network");

  // offline: the page falls back to its cached copy
  delete w.net.files["https://app.test/index.html"];
  assert.strictEqual((await (await w.request("https://app.test/index.html"))).body, "page-2");

  // other origins are never touched
  assert.strictEqual(await w.request("https://script.google.com/macros/x"), null);
  console.log("sw-cache tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
