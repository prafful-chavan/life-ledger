const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

// ── Apps Script runtime stubs (in-memory Drive) ─────────────────────────────
function makeGatewayRuntime() {
  const files = new Map(); // id -> {name, content, created}
  let seq = 0;
  const mkFile = (name, content) => {
    const id = "f" + ++seq;
    const rec = { id, name, content, created: new Date(Date.now() + seq) };
    files.set(id, rec);
    return fileApi(rec);
  };
  const fileApi = (rec) => ({
    getName: () => rec.name,
    getId: () => rec.id,
    getBlob: () => ({ getDataAsString: () => rec.content }),
    setContent: (c) => { rec.content = c; },
    setTrashed: (t) => { if (t) files.delete(rec.id); },
    getDateCreated: () => rec.created,
    getSize: () => rec.content.length,
    getParents: () => { let d = false; return { hasNext: () => !d, next: () => { d = true; return { getId: () => "folder" }; } }; },
  });
  const folder = {
    getId: () => "folder",
    getFilesByName(name) {
      const l = [...files.values()].filter((f) => f.name === name).map(fileApi);
      let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] };
    },
    getFiles() { const l = [...files.values()].map(fileApi); let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; },
    createFile: (name, content) => mkFile(name, content),
  };
  const locks = { n: 0 };
  const props = new Map();
  const ctx = {
    console, JSON, Date, Math, String, Number, Array, Object,
    MimeType: { PLAIN_TEXT: "text/plain" },
    DriveApp: {
      getFoldersByName: () => { let d = false; return { hasNext: () => !d, next: () => { d = true; return folder; } }; },
      createFolder: () => folder,
      getFileById: (id) => fileApi(files.get(id)),
    },
    LockService: { getScriptLock: () => { locks.n++; return { waitLock() {}, releaseLock() {} }; } },
    Logger: { log() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props.get(k) || null, setProperty: (k, v) => props.set(k, v) }) },
    Utilities: {
      getUuid: () => require("crypto").randomUUID(),
      DigestAlgorithm: { SHA_256: "sha256" },
      computeDigest: (_a, s) => [...require("crypto").createHash("sha256").update(s).digest()].map((b) => (b > 127 ? b - 256 : b)),
      formatDate: (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, ""),
    },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: (t) => ({ t, setMimeType() { return this; } }) },
  };
  vm.createContext(ctx);
  vm.runInContext("function createJsonResponse(d){return ContentService.createTextOutput(JSON.stringify(d)).setMimeType(ContentService.MimeType.JSON);}", ctx);
  vm.runInContext(read("sync-gateway.gs"), ctx);
  vm.runInContext(read("fitness-ingest.gs"), ctx);
  return {
    files, locks, props,
    run: (code) => vm.runInContext(code, ctx),
    call: (body) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).t),
    meta: () => JSON.parse(vm.runInContext("JSON.stringify(syncMeta_())", ctx)),
  };
}

// ── Device: real sync-client + sync-engine with a plaintext "vault" ─────────
function makeDevice(gw, name) {
  const store = new Map();
  store.set("lifeLedgerStockProxyUrl", "https://gw.test/exec");
  const win = { addEventListener() {} };
  const ctx = {
    window: win, console, JSON, Date, Math, setTimeout, clearTimeout, setInterval, clearInterval,
    TextEncoder, Uint8Array, Promise, String, Number, Array, Object, Error,
    crypto: require("crypto").webcrypto,
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    navigator: { onLine: true },
    document: { hidden: false, activeElement: null, addEventListener() {} },
    fetch: async (url, opts) => {
      const out = gw.call(JSON.parse(opts.body));
      return { ok: true, status: 200, json: async () => out };
    },
  };
  ctx.self = win;
  vm.createContext(ctx);
  vm.runInContext(read("sync-engine.js"), ctx);
  win.LifeLedgerSyncEngine = ctx.LifeLedgerSyncEngine || win.LifeLedgerSyncEngine;
  vm.runInContext(read("sync-client.js"), ctx);
  const Engine = win.LifeLedgerSyncEngine;
  const Sync = win.LifeLedgerSync;

  const dev = { name, data: { expenses: [] }, meta: Engine.emptyMeta(), vault: null, clock: 1000, Sync, Engine };
  const buildVault = () => ({
    salt: "s", iv: "i", ciphertext: JSON.stringify({ data: dev.data, sync: dev.meta }),
    entryCount: Engine.countRecords(dev.data),
  });
  dev.vault = buildVault();
  Sync.init({
    isReady: () => true,
    getPassword: () => "pw",
    getLocal: () => ({ data: dev.data, meta: dev.meta, vault: dev.vault }),
    decryptVault: async (v) => { if (dev.decryptDelay) await new Promise((r) => setTimeout(r, dev.decryptDelay)); return JSON.parse(v.ciphertext); },
    // like auth.js: merge the device's CURRENT data with the remote copy in one synchronous step
    mergeRemote: async (remote) => {
      const m = Engine.merge({ data: dev.data, meta: dev.meta }, remote);
      const remoteBehind = !Engine.dataEquals(m.data, remote.data);
      dev.data = m.data; dev.meta = m.meta; dev.vault = buildVault();
      return { data: m.data, meta: m.meta, vault: dev.vault, remoteBehind };
    },
  });
  dev.edit = (fn) => {
    const next = JSON.parse(JSON.stringify(dev.data));
    fn(next);
    dev.meta = Engine.stamp(dev.data, next, dev.meta, ++dev.clock + (name === "phone" ? 5 : 0));
    dev.data = next;
    dev.vault = buildVault();
    win.LifeLedgerSync.markDirty();
    clearTimeout(win.LifeLedgerSync._debounce);
  };
  return dev;
}

(async () => {
  const gw = makeGatewayRuntime();

  // Unauthenticated meta exposes existence + salt only
  assert.strictEqual(gw.meta().exists, false);

  const mac = makeDevice(gw, "mac");
  const phone = makeDevice(gw, "phone");

  mac.edit((d) => { d.expenses.push({ id: "e1", v: 1 }); });
  await mac.Sync.sync("t");
  assert.strictEqual(gw.meta().rev, 1);
  assert.strictEqual(gw.meta().exists, true);

  // Phone starts empty, pulls mac's data, then adds its own
  await phone.Sync.sync("t");
  assert.strictEqual(phone.data.expenses.map((r) => r.id).join(","), "e1");
  phone.edit((d) => { d.expenses.push({ id: "e2", v: 2 }); });

  // Concurrent: mac edits before seeing phone's push → CAS conflict → merge, no loss
  mac.edit((d) => { d.expenses.push({ id: "e3", v: 3 }); });
  await phone.Sync.sync("t");
  await mac.Sync.sync("t");
  await phone.Sync.sync("t");
  const ids = (d) => d.data.expenses.map((r) => r.id).sort().join(",");
  assert.strictEqual(ids(mac), "e1,e2,e3");
  assert.strictEqual(ids(phone), "e1,e2,e3");

  // Delete propagates and is not resurrected
  phone.edit((d) => { d.expenses = d.expenses.filter((r) => r.id !== "e1"); });
  await phone.Sync.sync("t");
  await mac.Sync.sync("t");
  assert.strictEqual(ids(mac), "e2,e3");

  // An edit made WHILE a sync is decrypting the other device's copy must survive and reach the other device
  phone.edit((d) => { d.expenses.push({ id: "e-from-phone", v: 5 }); });
  await phone.Sync.sync("t");                       // phone's change is on the gateway
  mac.decryptDelay = 200;
  const running = mac.Sync.sync("t");               // mac starts pulling phone's change…
  await new Promise((r) => setTimeout(r, 60));
  mac.edit((d) => { d.expenses.push({ id: "e-mid-sync", v: 6 }); }); // …and edits during the decrypt window
  await running;
  mac.decryptDelay = 0;
  assert.ok(mac.data.expenses.some((r) => r.id === "e-mid-sync"), "edit made during sync is not lost");
  assert.ok(mac.data.expenses.some((r) => r.id === "e-from-phone"), "remote change still arrives");
  await mac.Sync.sync("t");
  await phone.Sync.sync("t");
  assert.ok(phone.data.expenses.some((r) => r.id === "e-mid-sync"), "and the mid-sync edit reaches the other device");

  // Wrong token is rejected
  const bad = gw.call({ op: "pull", token: "nope" });
  assert.strictEqual(bad.ok, false);

  // Direct CAS: stale baseRev returns the current vault instead of overwriting
  const cur = gw.meta().rev;
  const stale = gw.call({ op: "push", token: require("crypto").createHash("sha256").update("x").digest("hex"), baseRev: 0, vault: { ciphertext: "x" } });
  assert.strictEqual(stale.ok, false); // token mismatch guards first

  // Shrink triggers a backup and backups can be listed + fetched
  const t = (await mac.Sync.listBackups.call(mac.Sync).catch(() => null));
  assert.ok(Array.isArray(t));
  assert.ok(cur >= 4);

  // Only writes take the global script lock; reads and slow Dropbox lookups must never queue behind it
  const before = gw.locks.n;
  const anyToken = "0".repeat(64);
  gw.call({ op: "pull", token: anyToken, sinceRev: 0 });
  gw.call({ op: "listBackups", token: anyToken });
  gw.call({ op: "spendingMeta", token: anyToken, source: "me" });
  assert.strictEqual(gw.locks.n, before, "pull / listBackups / spending ops take no lock");
  gw.call({ op: "push", token: anyToken, baseRev: 0, vault: { ciphertext: "x" } });
  gw.call({ op: "snapshotNow", token: anyToken });
  assert.strictEqual(gw.locks.n, before + 2, "push and snapshotNow still take the lock");

  // ── Apple Health upload (iPhone Shortcut) ──
  {
    const key = gw.run("fitnessSetupKey()");
    assert.ok(key.length >= 40, "a long random key is generated");
    assert.strictEqual(gw.run("fitnessSetupKey()"), key, "running setup again keeps the same key");
    const day = { date: "2026-10-15", steps: "8,234", walkKm: 5.9, cycleKm: 12.3, activeKcal: 540 };
    assert.strictEqual(gw.call({ op: "fitnessIngest", key: "wrong", ...day }).error, "unauthorized");
    assert.strictEqual(gw.call({ op: "fitnessIngest", ...day }).error, "unauthorized", "no key, no upload");
    const ok = gw.call({ op: "fitnessIngest", key, ...day });
    assert.ok(ok.ok && ok.saved === 1, JSON.stringify(ok));
    // same day again replaces it; another day adds
    gw.call({ op: "fitnessIngest", key, ...day, steps: 9000 });
    gw.call({ op: "fitnessIngest", key, days: [{ date: "2026-10-14", steps: 4000 }, { date: "bad", steps: 1 }, { date: "2026-10-13" }] });
    // reading needs the vault token, never the upload key
    assert.strictEqual(gw.call({ op: "fitnessPull", token: "nope" }).ok, false, "wrong token cannot read");
    assert.strictEqual(gw.call({ op: "fitnessPull", key }).ok, false, "the upload key cannot read");
    // junk is cleaned, not stored
    const junk = gw.call({ op: "fitnessIngest", key, date: "2026-10-12", steps: 99999999, walkKm: -3, workouts: "x" });
    assert.strictEqual(junk.ok, false, "implausible numbers are rejected");
    const stored = JSON.parse([...gw.files.values()].find((f) => f.name === "fitness.json").content);
    assert.deepStrictEqual(Object.keys(stored.days).sort(), ["2026-10-14", "2026-10-15"]);
    assert.strictEqual(stored.days["2026-10-15"].steps, 9000);
    assert.strictEqual(stored.days["2026-10-15"].cycleKm, 12.3);
    // A device that owns the vault (its token is on file) can read the days back
    const owner = makeGatewayRuntime();
    const tok = "t".repeat(64);
    assert.ok(owner.call({ op: "push", token: tok, baseRev: 0, vault: { ciphertext: "c" } }).ok);
    const k2 = owner.run("fitnessSetupKey()");
    owner.call({ op: "fitnessIngest", key: k2, days: [{ date: "2026-10-14", steps: 4000 }, { date: "2026-10-15", steps: 9000, workouts: [{ type: "Cycling", minutes: 45, km: 12.3, kcal: 300 }] }] });
    const back = owner.call({ op: "fitnessPull", token: tok });
    assert.strictEqual(back.days.length, 2);
    assert.strictEqual(back.days[1].workouts[0].type, "Cycling");
    assert.strictEqual(owner.call({ op: "fitnessPull", token: tok, since: "2026-10-15" }).days.length, 1);
    const before = owner.locks.n;
    owner.call({ op: "fitnessPull", token: tok });
    assert.strictEqual(owner.locks.n, before, "reading takes no lock");
  }

  console.log("sync-gateway tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
