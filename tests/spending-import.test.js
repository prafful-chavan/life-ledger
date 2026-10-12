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

function harness(files) {
  const state = { expenses: [], spendingImport: { ids: [], file: "", importedAt: null } };
  const status = { text: "" };
  const handlers = {};
  const els = {};
  const getEl = (id) => (els[id] ||= { id, textContent: "", addEventListener: (t, fn) => { handlers[id + ":" + t] = fn; } });
  const win = {
    addEventListener: (t, fn) => { if (t === "load") win.__load = fn; },
    LifeLedgerSync: {
      isConfigured: () => true,
      onStatus() {},
      call: async (op, extra) => {
        const f = files[(extra && extra.source) || "me"];
        if (!f) throw new Error("Dropbox source 'wife' is not connected yet.");
        if (op === "spendingMeta") return { ok: true, file: { name: "Auto", hash: f.hash } };
        return { ok: true, file: { name: "Auto", hash: f.hash }, data: f.bytes.toString("base64") };
      },
    },
    LifeLedgerApp: {
      getState: () => state,
      renderAll() {},
      saveData: async () => {},
    },
  };
  const ctx = {
    window: win, console, atob: (s) => Buffer.from(s, "base64").toString("binary"), confirm: () => true,
    localStorage: { getItem: () => null, setItem() {} }, Date, Math, JSON, Promise, Uint8Array, Object, Error, String, Number, Array, Set, Map, RegExp,
    document: {
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
  return { win, state, status, els, handlers };
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

  console.log("spending-import tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
