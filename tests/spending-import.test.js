const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const { DatabaseSync } = require("node:sqlite");
const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

// Synthetic Spending-app backup (same Core Data schema, made-up rows)
function makeBackup(rows) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ll-spend-")), "b.sqlite");
  const db = new DatabaseSync(file);
  db.exec("CREATE TABLE ZCATEGORY (Z_PK INTEGER PRIMARY KEY, ZNAME VARCHAR);");
  db.exec("CREATE TABLE ZTRANSACTION (Z_PK INTEGER PRIMARY KEY, ZAMOUNT FLOAT, ZDATE TIMESTAMP, ZDISPLAYNAME VARCHAR, ZNOTE VARCHAR, ZTYPE VARCHAR, ZCATEGORY INTEGER);");
  db.exec("INSERT INTO ZCATEGORY VALUES (1,'Groceries'),(2,'Travel');");
  const ins = db.prepare("INSERT INTO ZTRANSACTION (ZAMOUNT,ZDATE,ZDISPLAYNAME,ZNOTE,ZTYPE,ZCATEGORY) VALUES (?,?,?,?, 'Expense', ?)");
  for (const r of rows) ins.run(r.amount, r.date, r.name, "", r.cat);
  db.close();
  return fs.readFileSync(file);
}
const day = (iso) => (Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - 330 * 60000) / 1000 - 978307200;

function harness(files, opts) {
  const state = { expenses: [], spendingImport: { ids: [], file: "", importedAt: null } };
  const status = { text: "" };
  const handlers = {};
  const els = {};
  const getEl = (id) => (els[id] ||= { id, textContent: "", addEventListener: (t, fn) => { handlers[id + ":" + t] = fn; } });
  const win = {
    addEventListener: (t, fn) => { if (t === "load") win.__load = fn; },
    LifeLedgerAuth: { isUnlocked: () => true },
    LifeLedgerSync: {
      isConfigured: () => true,
      snapshotNow: async () => { win.__snapshots = (win.__snapshots || 0) + 1; },
      onStatus() {},
      call: async (op, extra) => {
        const f = files[(extra && extra.source) || "me"];
        if (!f) throw new Error("Dropbox source 'wife' is not connected yet.");
        if (f.devices) {
          // several active devices: meta lists them all, latest downloads one by id
          const metas = f.devices.map((d, i) => ({ id: "d" + i, name: "Auto " + i, hash: d.hash, modified: new Date().toISOString() }));
          if (op === "spendingMeta") return { ok: true, source: (extra && extra.source) || "me", file: metas[0], files: metas };
          const d = f.devices[Number(String(extra.fileId).slice(1))];
          return { ok: true, source: (extra && extra.source) || "me", file: metas[0], data: d.bytes.toString("base64") };
        }
        const source = (opts && opts.oldGateway) ? undefined : ((extra && extra.source) || "me");
        // an outdated gateway ignores `source` and always answers with the first account
        const g = (opts && opts.oldGateway) ? files.me : f;
        if (op === "spendingMeta") return { ok: true, source, file: { name: "Auto", hash: g.hash } };
        return { ok: true, source, file: { name: "Auto", hash: g.hash }, data: g.bytes.toString("base64") };
      },
    },
    LifeLedgerApp: {
      getState: () => state,
      renderAll() {},
      saveData: async () => {},
    },
  };
  const ctx = {
    window: win, console, setInterval: () => 0, setTimeout, atob: (s) => Buffer.from(s, "base64").toString("binary"), confirm: () => true,
    localStorage: (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; })(), Date, Math, JSON, Promise, Uint8Array, Object, Error, String, Number, Array, Set, Map, RegExp,
    document: {
      hidden: false, activeElement: null, addEventListener() {}, querySelector: () => null,
      getElementById: getEl,
      createElement: () => ({}),
      head: { appendChild(el) { setTimeout(() => el.onload(), 0); } },
    },
  };
  // sql.js stand-in backed by node:sqlite
  win.initSqlJs = async () => ({
    Database: class {
      constructor(bytes) {
        this.file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ll-db-")), "x.sqlite");
        fs.writeFileSync(this.file, Buffer.from(bytes));
        this.db = new DatabaseSync(this.file, { readOnly: true });
      }
      exec(q) {
        const stmt = this.db.prepare(q);
        const rows = stmt.all();
        if (!rows.length) return [];
        const columns = Object.keys(rows[0]);
        return [{ columns, values: rows.map((r) => columns.map((c) => r[c])) }];
      }
      close() { this.db.close(); }
    },
  });
  ctx.self = win;
  vm.createContext(ctx);
  vm.runInContext(read("spending-core.js"), ctx);
  win.LifeLedgerSpendingCore = ctx.LifeLedgerSpendingCore || win.LifeLedgerSpendingCore;
  vm.runInContext(read("spending-import.js"), ctx);
  win.__load();
  return { win, state, status, els, handlers, ls: ctx.localStorage };
}

(async () => {
  const mine = makeBackup([
    { amount: 100, date: day("2026-10-01"), name: "Milk", cat: 1 },
    { amount: 250, date: day("2026-10-02"), name: "Bus", cat: 2 },
  ]);
  const hers = makeBackup([
    { amount: 400, date: day("2026-10-03"), name: "Veg", cat: 1 },
    { amount: 999, date: day("2099-01-01"), name: "Future rent", cat: 2 }, // recurring, in the future
  ]);
  const h = harness({ me: { hash: "h1", bytes: mine }, wife: { hash: "w1", bytes: hers } });
  const run = () => h.win.LifeLedgerSpending.run({ manual: true });

  await run();
  const mineRows = h.state.expenses.filter((e) => e.id.startsWith("sp-"));
  const wifeRows = h.state.expenses.filter((e) => e.id.startsWith("spw-"));
  assert.strictEqual(mineRows.length, 2);
  assert.strictEqual(wifeRows.length, 1, "future-dated row is held back");
  assert.strictEqual(wifeRows[0].paidBy, "Wife");

  // Re-running adds nothing
  await run();
  assert.strictEqual(h.state.expenses.length, 3);

  // User resets all expenses in the app (stale remembered ids must not block a fresh import)
  h.state.expenses = [];
  await run();
  assert.strictEqual(h.state.expenses.filter((e) => e.id.startsWith("sp-")).length, 2, "mine re-imported after reset");
  assert.strictEqual(h.state.expenses.filter((e) => e.id.startsWith("spw-")).length, 1, "wife's re-imported after reset");
  assert.strictEqual(h.state.spendingImport.ids.length, 3, "ids not duplicated");

  // A single deleted row stays deleted
  h.state.expenses = h.state.expenses.filter((e) => e.amount !== 100);
  await run();
  assert.ok(!h.state.expenses.some((e) => e.amount === 100));

  // Wife earlier entered by hand: not duplicated; yours (tagged Me) never matched against hers
  const h2 = harness({ me: { hash: "h1", bytes: mine }, wife: { hash: "w1", bytes: hers } });
  h2.state.expenses = [
    { id: "exp-1", date: "2026-10-03", amount: 400, paidBy: "Wife", category: "Groceries" },
    { id: "exp-2", date: "2026-10-03", amount: 400, paidBy: "Me", category: "Groceries" },
  ];
  await h2.win.LifeLedgerSpending.run({ manual: true });
  assert.strictEqual(h2.state.expenses.filter((e) => e.id.startsWith("spw-")).length, 0, "her earlier manual entry absorbed the row");

  // Separate datasets: hers imports as Wife, yours as Me, even if one row matches
  const herOwn = makeBackup([
    { amount: 100, date: day("2026-10-01"), name: "Milk", cat: 1 }, // coincidentally same as mine
    { amount: 77, date: day("2026-10-04"), name: "Her own", cat: 1 },
    ...Array.from({ length: 30 }, (_, i) => ({ amount: 10 + i, date: day("2026-09-" + String((i % 27) + 1).padStart(2, "0")), name: "Her " + i, cat: 2 })),
  ]);
  const h4 = harness({ me: { hash: "h1", bytes: mine }, wife: { hash: "w2", bytes: herOwn } });
  await h4.win.LifeLedgerSpending.run({ manual: true });
  assert.strictEqual(h4.state.expenses.filter((e) => e.id.startsWith("sp-") && e.paidBy === "Me").length, 2);
  assert.strictEqual(h4.state.expenses.filter((e) => e.id.startsWith("spw-") && e.paidBy === "Wife").length, 32, "her rows are all hers, including the coincidental match");

  // An outdated gateway (ignores `source`) must NOT import your data as hers
  const h5 = harness({ me: { hash: "h1", bytes: mine }, wife: { hash: "w2", bytes: herOwn } }, { oldGateway: true });
  await h5.win.LifeLedgerSpending.run({ manual: true });
  assert.strictEqual(h5.state.expenses.filter((e) => e.id.startsWith("spw-")).length, 0);
  assert.strictEqual(h5.state.expenses.filter((e) => e.id.startsWith("sp-")).length, 2);
  assert.ok(/outdated/.test(h5.els.spendingSyncStatus.textContent), "user is told to update the gateway");

  // The same account linked twice (≥80% identical rows) is refused
  const bigMine = makeBackup(Array.from({ length: 40 }, (_, i) => ({ amount: 5 + i, date: day("2026-08-" + String((i % 27) + 1).padStart(2, "0")), name: "Row " + i, cat: 1 })));
  const h6 = harness({ me: { hash: "h1", bytes: bigMine }, wife: { hash: "w3", bytes: bigMine } });
  await h6.win.LifeLedgerSpending.run({ manual: true });
  assert.strictEqual(h6.state.expenses.filter((e) => e.id.startsWith("spw-")).length, 0);
  assert.strictEqual(h6.state.expenses.filter((e) => e.id.startsWith("sp-")).length, 40);

  // Earlier imports tagged "Both" are switched to "Me" once
  const h7 = harness({ me: { hash: "h1", bytes: mine } });
  h7.state.expenses = [{ id: "sp-old", date: "2026-10-01", amount: 1, paidBy: "Both" }, { id: "exp-x", date: "2026-10-01", amount: 2, paidBy: "Both" }];
  h7.state.spendingImport = { ids: ["sp-old"], file: "", importedAt: null };
  await h7.win.LifeLedgerSpending.run({ manual: false });
  assert.strictEqual(h7.state.expenses.find((e) => e.id === "sp-old").paidBy, "Me");
  assert.strictEqual(h7.state.expenses.find((e) => e.id === "exp-x").paidBy, "Both", "manual entries untouched");

  // Rebuild: wipes every expense (any origin, any duplicates) and imports both sources fresh
  const h8 = harness({ me: { hash: "h1", bytes: mine }, wife: { hash: "w2", bytes: herOwn } });
  await h8.win.LifeLedgerSpending.run({ manual: true });
  h8.state.expenses = h8.state.expenses.concat(h8.state.expenses.map((e) => ({ ...e, id: "exp-dup-" + e.id, paidBy: "Me" }))); // simulate CSV duplicates
  assert.strictEqual(h8.state.expenses.length, 68);
  await h8.win.LifeLedgerSpending.rebuild();
  assert.strictEqual(h8.win.__snapshots, 1, "snapshot taken first");
  assert.strictEqual(h8.state.expenses.length, 34, "exactly the two backups, no duplicates");
  assert.strictEqual(h8.state.expenses.filter((e) => e.paidBy === "Me").length, 2);
  assert.strictEqual(h8.state.expenses.filter((e) => e.paidBy === "Wife").length, 32);

  // Two active devices whose backups lag each other: rows from BOTH are imported, once each
  const devA = makeBackup([
    { amount: 100, date: day("2026-10-01"), name: "Milk", cat: 1 },
    { amount: 250, date: day("2026-10-02"), name: "Bus", cat: 2 },
    { amount: 40, date: day("2026-10-12"), name: "Only on A", cat: 1 },
  ]);
  const devB = makeBackup([
    { amount: 100, date: day("2026-10-01"), name: "Milk", cat: 1 },
    { amount: 250, date: day("2026-10-02"), name: "Bus", cat: 2 },
    { amount: 90, date: day("2026-10-13"), name: "Only on B (newest day)", cat: 1 },
  ]);
  const h9 = harness({ me: { devices: [{ hash: "a1", bytes: devA }, { hash: "b1", bytes: devB }] } });
  await h9.win.LifeLedgerSpending.run({ manual: true });
  const got = h9.state.expenses.filter((e) => e.id.startsWith("sp-")).map((e) => e.amount).sort((x, y) => x - y);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(got)), [40, 90, 100, 250], "rows from both devices, shared rows once");
  await h9.win.LifeLedgerSpending.run({ manual: true });
  assert.strictEqual(h9.state.expenses.filter((e) => e.id.startsWith("sp-")).length, 4, "re-running adds nothing");

  // Automatic checks: pick up new rows on their own, but throttled, and never while hidden or typing
  const devA2 = makeBackup([{ amount: 100, date: day("2026-10-01"), name: "Milk", cat: 1 }]);
  const files = { me: { hash: "x1", bytes: devA2 } };
  const h10 = harness(files);
  await h10.win.LifeLedgerSpending.run({ manual: true });          // first import (manual, confirmed)
  assert.strictEqual(h10.state.expenses.length, 1);
  files.me = { hash: "x2", bytes: makeBackup([
    { amount: 100, date: day("2026-10-01"), name: "Milk", cat: 1 },
    { amount: 55, date: day("2026-10-13"), name: "New today", cat: 1 },
  ]) };
  h10.ls.setItem("lifeLedgerSpendingLastCheck", "0");               // pretend the last check was long ago
  h10.win.LifeLedgerSpending.autoCheck();                           // not hidden, unlocked, due → imports
  await new Promise((r) => setTimeout(r, 300));
  assert.strictEqual(h10.state.expenses.length, 2, "automatic check imported the new row");
  files.me = { hash: "x3", bytes: makeBackup([
    { amount: 100, date: day("2026-10-01"), name: "Milk", cat: 1 },
    { amount: 55, date: day("2026-10-13"), name: "New today", cat: 1 },
    { amount: 12, date: day("2026-10-14"), name: "Even newer", cat: 1 },
  ]) };
  h10.win.LifeLedgerSpending.autoCheck();                           // inside the 30-minute throttle
  await new Promise((r) => setTimeout(r, 300));
  assert.strictEqual(h10.state.expenses.length, 2, "throttled: no second Dropbox check so soon");

  console.log("spending-import tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
