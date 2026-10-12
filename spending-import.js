/**
 * Life Ledger — Spending Tracker import (browser side).
 * Apps Script fetches the newest Dropbox backup (SQLite); this reads it with
 * sql.js, converts rows to expenses via LifeLedgerSpendingCore and merges them.
 */
(function () {
  const SQLJS_BASE = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/";
  const AUTO_CHECK_KEY = "lifeLedgerSpendingLastCheck";
  const AUTO_EVERY_MS = 6 * 60 * 60 * 1000;
  const QUERY =
    "SELECT t.Z_PK AS pk, t.ZAMOUNT AS amount, t.ZDATE AS date, t.ZDISPLAYNAME AS name, t.ZNOTE AS note, c.ZNAME AS category " +
    "FROM ZTRANSACTION t LEFT JOIN ZCATEGORY c ON c.Z_PK = t.ZCATEGORY WHERE t.ZTYPE = 'Expense' ORDER BY t.ZDATE, t.Z_PK";

  let sqlPromise = null;
  let busy = false;
  const $ = (id) => document.getElementById(id);

  function say(text) {
    const el = $("spendingSyncStatus");
    if (el) el.textContent = text;
  }

  function loadSqlJs() {
    if (sqlPromise) return sqlPromise;
    sqlPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SQLJS_BASE + "sql-wasm.js";
      s.onload = () => window.initSqlJs({ locateFile: (f) => SQLJS_BASE + f }).then(resolve, reject);
      s.onerror = () => reject(new Error("Could not load the SQLite reader (check your connection)."));
      document.head.appendChild(s);
    }).catch((e) => { sqlPromise = null; throw e; });
    return sqlPromise;
  }

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function readRows(SQL, bytes) {
    const db = new SQL.Database(bytes);
    try {
      const res = db.exec(QUERY);
      if (!res.length) return [];
      const cols = res[0].columns;
      return res[0].values.map((v) => Object.fromEntries(cols.map((c, i) => [c, v[i]])));
    } finally {
      db.close();
    }
  }

  function stamp() {
    try { localStorage.setItem(AUTO_CHECK_KEY, String(Date.now())); } catch { /* ignore */ }
  }

  /** opts.manual: user clicked the button (may confirm and force). */
  async function run(opts) {
    const manual = Boolean(opts && opts.manual);
    if (busy) return;
    const Sync = window.LifeLedgerSync;
    const app = window.LifeLedgerApp;
    const Core = window.LifeLedgerSpendingCore;
    if (!Sync || !app || !Core || !Sync.isConfigured()) { say("Needs the Apps Script URL and sync gateway."); return; }
    busy = true;
    try {
      say("Checking Dropbox…");
      const state = app.getState();
      const prev = state.spendingImport || { ids: [], file: "", importedAt: null };
      const metaRes = await Sync.call("spendingMeta");
      const file = metaRes.file;
      stamp();
      if (!manual && prev.file === file.hash) { say("Up to date · " + describe(prev)); return; }
      if (!manual && !prev.ids.length) { say("Backup found (" + file.name + "). Tap “Import now” to do the first import."); return; }

      say("Downloading " + file.name + "…");
      const full = await Sync.call("spendingLatest");
      say("Reading backup…");
      const SQL = await loadSqlJs();
      const rows = readRows(SQL, b64ToBytes(full.data));
      const incoming = Core.rowsToExpenses(rows);
      const plan = Core.planImport(state.expenses || [], incoming, prev.ids);

      if (manual && !prev.ids.length) {
        const ok = confirm(
          "Spending app backup: " + incoming.length + " expenses.\n\n" +
          "• " + plan.toAdd.length + " will be added\n" +
          "• " + plan.matchedExisting + " already exist in Life Ledger (same date and amount) and are skipped\n\n" +
          "Import now?"
        );
        if (!ok) { say("Import cancelled."); return; }
      }

      const live = app.getState();
      live.expenses = (live.expenses || []).concat(plan.toAdd);
      live.spendingImport = {
        ids: (live.spendingImport && live.spendingImport.ids || []).concat(plan.handledIds),
        file: file.hash,
        importedAt: new Date().toISOString(),
      };
      app.renderAll();
      await app.saveData(true);
      say(plan.toAdd.length
        ? "Imported " + plan.toAdd.length + " new expense" + (plan.toAdd.length === 1 ? "" : "s") + " · " + file.name
        : "Up to date · no new expenses in " + file.name);
    } catch (err) {
      say("Import failed: " + err.message);
    } finally {
      busy = false;
    }
  }

  function describe(prev) {
    return prev.importedAt ? "last import " + new Date(prev.importedAt).toLocaleString() : "no import yet";
  }

  function autoCheckDue() {
    try { return Date.now() - Number(localStorage.getItem(AUTO_CHECK_KEY) || 0) > AUTO_EVERY_MS; } catch { return true; }
  }

  window.LifeLedgerSpending = { run };

  window.addEventListener("load", () => {
    $("spendingSyncNowButton")?.addEventListener("click", () => run({ manual: true }));
    // Once this session, after the first successful vault sync, check for a newer backup.
    let armed = true;
    window.LifeLedgerSync?.onStatus((st) => {
      if (armed && st.state === "synced" && autoCheckDue()) {
        armed = false;
        setTimeout(() => run({ manual: false }), 1500);
      }
    });
  });
})();
