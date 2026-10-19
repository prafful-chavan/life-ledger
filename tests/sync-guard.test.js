/** Runs the REAL sync-client.js against an in-memory gateway: an out-of-date device holding doubled rows must not push them. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");
const E = require("../sync-engine.js");
const H = require("../holdings-integrity.js");

const lot = (i) => ({ fundName: "Fund " + (i % 5), owner: "Me", demat: "Groww", transactionType: "PURCHASE", units: 10 + i, invested: 1000 + i * 3, purchaseDate: "2026-0" + (1 + (i % 9)) + "-12", latestNav: 100, currentValue: 1000 });
const stableBook = (n) => H.assignStableIds("mutualFunds", Array.from({ length: n }, (_, i) => lot(i)));

function makeWorld(cloudData) {
  const gateway = { rev: 1, vault: null, pushes: 0 };
  const meta0 = E.stamp({}, cloudData, E.emptyMeta(), 1000);
  gateway.vault = { inner: { data: cloudData, sync: meta0 } };
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Array, Object, Promise, Error, URL, Set, Map,
    setTimeout, clearTimeout, setInterval, clearInterval, TextEncoder, crypto: globalThis.crypto,
    navigator: { onLine: true }, document: { addEventListener() {}, hidden: false, activeElement: null },
    localStorage: (() => { const m = new Map([["lifeLedgerStockProxyUrl", "https://script.example/exec"]]); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; })(),
    fetch: async (url, init) => {
      const body = JSON.parse(init.body);
      let out;
      if (body.op === "pull") out = body.sinceRev === gateway.rev ? { ok: true, rev: gateway.rev, unchanged: true } : { ok: true, rev: gateway.rev, vault: gateway.vault };
      else if (body.op === "push") {
        if (body.baseRev !== gateway.rev) out = { ok: true, conflict: true, rev: gateway.rev, vault: gateway.vault };
        else { gateway.rev++; gateway.pushes++; gateway.vault = body.vault; out = { ok: true, rev: gateway.rev }; }
      } else out = { ok: false, error: "unsupported" };
      return { ok: true, status: 200, json: async () => out };
    },
  };
  ctx.window = ctx; ctx.addEventListener = () => {};
  vm.createContext(ctx);
  ctx.LifeLedgerSyncEngine = E; ctx.LifeLedgerHoldingsIntegrity = H;
  vm.runInContext(fs.readFileSync(path.join(root, "sync-client.js"), "utf8"), ctx);
  return { gateway, sync: ctx.LifeLedgerSync };
}

function device(sync, localData, localMeta) {
  const dev = { data: localData, meta: localMeta };
  sync.init({
    isReady: () => true, getPassword: () => "pw", getLocal: () => ({ data: dev.data, meta: dev.meta, vault: { inner: { data: dev.data, sync: dev.meta } } }),
    decryptVault: async (v) => v.inner,
    mergeRemote: async (remote) => {
      const m = E.merge({ data: dev.data, meta: dev.meta }, remote, 5000);
      dev.data = m.data; dev.meta = m.meta;
      return { data: m.data, meta: m.meta, vault: { inner: { data: m.data, sync: m.meta } }, remoteBehind: !E.dataEquals(m.data, remote.data) };
    },
  });
  return dev;
}

(async () => {
  // 1. The cloud is clean (20 lots). A stale device holds those 20 plus 20 leftover copies with different ids.
  const clean = { mutualFunds: stableBook(20) };
  let w = makeWorld(clean);
  const ghosts = clean.mutualFunds.map((r, i) => ({ ...r, id: "mf-legacy-" + i }));
  const staleData = { mutualFunds: [...clean.mutualFunds, ...ghosts] };
  const staleMeta = E.stamp({}, staleData, E.emptyMeta(), 4000);                      // the stale copy's rows look freshly edited
  const dev = device(w.sync, staleData, staleMeta);
  w.sync.markDirty(); await w.sync.sync("test");
  assert.strictEqual(w.gateway.pushes, 0, "the doubled push was refused");
  assert.strictEqual(w.gateway.vault.inner.data.mutualFunds.length, 20, "the cloud still holds 20 lots");
  const st = w.sync.getStatus();
  assert.strictEqual(st.state, "error"); assert.ok(/paused to protect your data/i.test(st.detail), st.detail);

  // 2. After the extra copies are removed on that device, it syncs normally again
  dev.data = { mutualFunds: H.halveDuplicates("mutualFunds", dev.data.mutualFunds) };
  dev.meta = E.stamp(staleData, dev.data, dev.meta, 6000);
  assert.strictEqual(dev.data.mutualFunds.length, 20);
  w.sync.markDirty(); await w.sync.sync("test");
  assert.notStrictEqual(w.sync.getStatus().state, "error", "no longer blocked: " + w.sync.getStatus().detail);

  // 3. Ordinary use is never blocked: a few genuinely new lots go through
  w = makeWorld(clean);
  const more = { mutualFunds: [...clean.mutualFunds, ...H.assignStableIds("mutualFunds", [lot(100), lot(101), lot(102)])] };
  device(w.sync, more, E.stamp(clean, more, E.stamp({}, clean, E.emptyMeta(), 1000), 5000));
  w.sync.markDirty(); await w.sync.sync("test");
  assert.strictEqual(w.gateway.pushes, 1, "three new lots are pushed");
  assert.strictEqual(w.gateway.vault.inner.data.mutualFunds.length, 23);

  // 4. A repeat Sync Holdings (same sheet, same ids) is a no-op for the cloud
  w = makeWorld(clean);
  const same = { mutualFunds: H.assignStableIds("mutualFunds", clean.mutualFunds.map(({ id, ...r }) => r)) };
  device(w.sync, same, E.stamp(clean, same, E.stamp({}, clean, E.emptyMeta(), 1000), 5000));
  w.sync.markDirty(); await w.sync.sync("test");
  assert.strictEqual(w.gateway.vault.inner.data.mutualFunds.length, 20, "still 20 after a repeat import");
  console.log("sync-guard tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
