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
    { key: "me", label: "Your Spending app", paidBy: "Me", idPrefix: "sp-", matchExisting: true, poolFilter: (e) => !/wife/i.test(e.paidBy || "") },
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
    // The gateway must say which Dropbox account answered. An outdated gateway ignores the
    // request and always answers with yours, which would import your data as hers.
    if (src.key !== "me" && metaRes.source !== src.key) {
      throw new Error("the Apps Script gateway is outdated — paste the latest sync-gateway.gs and spending-sync.gs, then Deploy → New version");
    }
    const file = metaRes.file;
    if (src.key !== "me" && file.hash === (prev.sources || {}).meFileHash) {
      throw new Error("her backup is the same file as yours — re-link her Dropbox");
    }
    if (!manual && !wiped && sourceFile(prev, src) === file.hash) { summary.push(src.label + ": up to date"); return; }
    if (!manual && !sourceIds.length) { summary.push(src.label + ": backup found — tap “Import now” for the first import"); return; }

    say("Downloading " + src.label + "…");
    const full = await Sync.call("spendingLatest", { source: src.key });
    const SQL = await loadSqlJs();
    const rows = readRows(SQL, b64ToBytes(full.data));
    let incoming = Core.rowsToExpenses(rows, { paidBy: src.paidBy, idPrefix: src.idPrefix });
    // The two Spending apps are separate datasets, so rows are never filtered by content.
    // If the second backup is (almost) entirely the first one's data it is the same account
    // linked twice: refuse rather than double every expense.
    const totalRows = incoming.length;
    if (src.key !== "me" && totalRows >= 20) {
      const ratio = Core.overlapRatio(incoming, prev.ids.filter((id) => id.startsWith("sp-")));
      if (ratio >= 0.8) {
        throw new Error("her backup is " + Math.round(ratio * 100) + "% identical to yours — it looks like the same account. Re-link her Dropbox");
      }
    }
    const today = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
    const plan = Core.planImport(state.expenses || [], incoming, knownIds, {
      matchExisting: src.matchExisting, poolFilter: src.poolFilter, today,
    });

    // Nothing unique to this source: record it silently instead of asking.
    const nothingNew = !plan.toAdd.length && !plan.matchedExisting;
    if (manual && !sourceIds.length && !nothingNew) {
      const ok = confirm(
        src.label + ": " + totalRows + " expenses in the backup (paid by " + src.paidBy + ").\n\n" +
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
    if (src.key === "me") { next.file = file.hash; next.importedAt = at; next.sources = { ...(cur.sources || {}), meFileHash: file.hash }; }
    else next.sources = { ...(next.sources || cur.sources || {}), wife: { file: file.hash, importedAt: at } };
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

  /**
   * Deterministic repair: snapshot, clear every expense, then import both Spending apps fresh.
   * Result depends only on the two backups, so duplicates from any older import path vanish.
   */
  async function rebuild() {
    const app = window.LifeLedgerApp;
    const Sync = window.LifeLedgerSync;
    if (!app || !Sync || busy) return;
    const live = app.getState();
    const n = (live.expenses || []).length;
    if (!confirm(
      "Rebuild ALL expenses from your two Spending apps?\n\n" +
      "• A safety snapshot is saved first (Settings → Version history can restore it)\n" +
      "• All " + n + " current expenses are removed, including any typed in by hand\n" +
      "• Your backup and your wife's backup are then imported fresh (Me / Wife)\n\nContinue?"
    )) return;
    try {
      say("Saving a safety snapshot…");
      await Sync.snapshotNow();
    } catch (err) {
      say("Rebuild stopped — could not save a safety snapshot: " + err.message);
      return;
    }
    live.expenses = [];
    live.spendingImport = { ids: [], file: "", importedAt: null, sources: {}, tagMigrated: true };
    app.renderAll();
    await app.saveData(true);
    await run({ manual: true });
  }

  // Rows imported earlier from your backup were tagged "Both"; your Spending app is yours alone.
  function migrateMeTag() {
    const app = window.LifeLedgerApp;
    const live = app && app.getState();
    if (!live || !live.spendingImport || live.spendingImport.tagMigrated) return false;
    for (const e of live.expenses || []) {
      if (typeof e.id === "string" && e.id.startsWith("sp-") && e.paidBy === "Both") e.paidBy = "Me";
    }
    live.spendingImport = { ...live.spendingImport, tagMigrated: true };
    return true;
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
      if (migrateMeTag()) { window.LifeLedgerApp.renderAll(); await window.LifeLedgerApp.saveData(true); }
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

  window.LifeLedgerSpending = { run, rebuild };

  window.addEventListener("load", () => {
    $("spendingSyncNowButton")?.addEventListener("click", () => run({ manual: true }));
    $("spendingResetWifeButton")?.addEventListener("click", resetWife);
    $("spendingRebuildButton")?.addEventListener("click", rebuild);
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
