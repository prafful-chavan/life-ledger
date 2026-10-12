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

  // "me" keeps its original ids/tag so already-imported rows are untouched.
  const SOURCES = [
    { key: "me", label: "Your Spending app", paidBy: "Both", idPrefix: "sp-", matchExisting: true, poolFilter: (e) => !/wife/i.test(e.paidBy || "") },
    { key: "wife", label: "Wife's Spending app", paidBy: "Wife", idPrefix: "spw-", matchExisting: true, poolFilter: (e) => /wife/i.test(e.paidBy || ""), optional: true },
  ];

  function sourceFile(prev, src) {
    return src.key === "me" ? prev.file : ((prev.sources || {}).wife || {}).file || "";
  }

  async function importSource(src, manual, summary) {
    const Sync = window.LifeLedgerSync;
    const app = window.LifeLedgerApp;
    const Core = window.LifeLedgerSpendingCore;
    const state = app.getState();
    const prev = state.spendingImport || { ids: [], file: "", importedAt: null };
    // If expenses were reset/wiped (none of this source's imported rows remain) the remembered
    // ids are stale: forget them so the import starts fresh. A single deleted row doesn't trigger this.
    const stillHasRows = (state.expenses || []).some((e) => typeof e.id === "string" && e.id.startsWith(src.idPrefix));
    const wiped = !stillHasRows && prev.ids.some((id) => id.startsWith(src.idPrefix));
    const knownIds = wiped ? prev.ids.filter((id) => !id.startsWith(src.idPrefix)) : prev.ids;
    const sourceIds = knownIds.filter((id) => id.startsWith(src.idPrefix));

    let metaRes;
    try {
      metaRes = await Sync.call("spendingMeta", { source: src.key });
    } catch (err) {
      if (src.optional && /not connected/i.test(err.message)) return; // wife not linked yet
      throw err;
    }
    const file = metaRes.file;
    if (!manual && !wiped && sourceFile(prev, src) === file.hash) { summary.push(src.label + ": up to date"); return; }
    if (!manual && !sourceIds.length) { summary.push(src.label + ": backup found — tap “Import now” for the first import"); return; }

    say("Downloading " + src.label + "…");
    const full = await Sync.call("spendingLatest", { source: src.key });
    const SQL = await loadSqlJs();
    const rows = readRows(SQL, b64ToBytes(full.data));
    const incoming = Core.rowsToExpenses(rows, { paidBy: src.paidBy, idPrefix: src.idPrefix });
    const today = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
    // Safety: a second source whose rows are (mostly) the same as the first source's is almost
    // certainly the same Dropbox data linked twice. Importing it would double every expense.
    if (src.key !== "me") {
      const mineIds = prev.ids.filter((id) => id.startsWith("sp-"));
      const same = file.hash === ((prev.sources || {}).me || {}).file || Core.overlapRatio(incoming, mineIds) > 0.5;
      if (same) {
        summary.push(src.label + ": SKIPPED — this backup contains the same transactions as your own, so it looks like the same Dropbox account. Re-link the wife's Dropbox (see README).");
        return;
      }
    }
    const plan = Core.planImport(state.expenses || [], incoming, knownIds, {
      matchExisting: src.matchExisting, poolFilter: src.poolFilter, today,
    });

    if (manual && !sourceIds.length) {
      const ok = confirm(
        src.label + ": " + incoming.length + " expenses (paid by " + src.paidBy + ").\n\n" +
        "• " + plan.toAdd.length + " will be added\n" +
        "• " + plan.matchedExisting + " already exist (same date and amount) and are skipped\n" +
        (plan.skippedFuture ? "• " + plan.skippedFuture + " are dated in the future (recurring) and wait for their day\n" : "") +
        "\nThis month in that backup: ₹" + Core.monthTotal(incoming, today.slice(0, 7), today).toLocaleString("en-IN") +
        " (compare with the Spending app's own month total)\n\nImport now?"
      );
      if (!ok) { summary.push(src.label + ": import cancelled"); return; }
    }

    const live = app.getState();
    live.expenses = (live.expenses || []).concat(plan.toAdd);
    const cur = live.spendingImport || { ids: [], file: "", importedAt: null };
    const baseIds = wiped ? (cur.ids || []).filter((id) => !id.startsWith(src.idPrefix)) : (cur.ids || []);
    const next = { ...cur, ids: baseIds.concat(plan.handledIds) };
    const at = new Date().toISOString();
    if (src.key === "me") { next.file = file.hash; next.importedAt = at; }
    else next.sources = { ...(cur.sources || {}), wife: { file: file.hash, importedAt: at } };
    live.spendingImport = next;
    app.renderAll();
    await app.saveData(true);
    summary.push(src.label + ": " + (plan.toAdd.length ? plan.toAdd.length + " new expense" + (plan.toAdd.length === 1 ? "" : "s") : "no new expenses"));
  }

  async function resetWife() {
    const app = window.LifeLedgerApp;
    const Core = window.LifeLedgerSpendingCore;
    if (!app || !Core || busy) return;
    const live = app.getState();
    const count = (live.expenses || []).filter((e) => typeof e.id === "string" && e.id.startsWith("spw-")).length;
    if (!confirm("Remove the " + count + " expenses imported from your wife's Spending app and import them again?\n\nOnly rows imported by this feature are removed; everything you typed in yourself stays.")) return;
    const r = Core.resetSource(live.expenses, (live.spendingImport || {}).ids, "spw-");
    live.expenses = r.expenses;
    live.spendingImport = { ...(live.spendingImport || {}), ids: r.ids, sources: { ...((live.spendingImport || {}).sources || {}), wife: { file: "", importedAt: null } } };
    app.renderAll();
    await app.saveData(true);
    await run({ manual: true });
  }

  /** opts.manual: user clicked the button (may confirm and force). */
  async function run(opts) {
    const manual = Boolean(opts && opts.manual);
    if (busy) return;
    const Sync = window.LifeLedgerSync;
    if (!Sync || !window.LifeLedgerApp || !window.LifeLedgerSpendingCore || !Sync.isConfigured()) {
      say("Needs the Apps Script URL and sync gateway.");
      return;
    }
    busy = true;
    const summary = [];
    try {
      say("Checking Dropbox…");
      stamp();
      for (const src of SOURCES) {
        try {
          await importSource(src, manual, summary);
        } catch (err) {
          summary.push(src.label + " failed: " + err.message);
        }
      }
      say(summary.length ? summary.join(" · ") : "Up to date.");
    } finally {
      busy = false;
    }
  }

  function autoCheckDue() {
    try { return Date.now() - Number(localStorage.getItem(AUTO_CHECK_KEY) || 0) > AUTO_EVERY_MS; } catch { return true; }
  }

  window.LifeLedgerSpending = { run };

  window.addEventListener("load", () => {
    $("spendingSyncNowButton")?.addEventListener("click", () => run({ manual: true }));
    $("spendingResetWifeButton")?.addEventListener("click", resetWife);
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
