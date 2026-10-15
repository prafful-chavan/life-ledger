/**
 * Life Ledger — Spending Tracker import core (pure; no DOM, no network).
 *
 * Turns rows read from the Spending app's Core Data SQLite backup into Life
 * Ledger expenses, and plans an idempotent import:
 *  - ids are derived from row content, so re-importing never duplicates;
 *  - ids already imported are remembered, so rows you delete stay deleted;
 *  - rows that match an expense you already have (same date + amount) are
 *    treated as already present instead of being added twice.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerSpendingCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const CORE_DATA_EPOCH = 978307200; // 2001-01-01T00:00:00Z in unix seconds
  const IST_OFFSET_MS = 330 * 60 * 1000;
  const ID_PREFIX = "sp-";
  const IMPORTED_ID = /^sp[a-z]?-/; // sp- (you), spw- (wife)

  /** Core Data stores midnight IST as 18:30 UTC the day before; shift to IST. */
  function coreDataToISODate(seconds) {
    const ms = (CORE_DATA_EPOCH + Number(seconds)) * 1000 + IST_OFFSET_MS;
    return new Date(ms).toISOString().slice(0, 10);
  }

  function hash32(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  const clean = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();

  /**
   * rows: [{ pk, amount, date, name, note, category }]  (date = Core Data seconds)
   * Returns expenses with content-derived ids (n-th identical row gets "-n").
   */
  function rowsToExpenses(rows, opts) {
    const paidBy = (opts && opts.paidBy) || "Both";
    const prefix = (opts && opts.idPrefix) || ID_PREFIX;
    const seen = new Map();
    const out = [];
    for (const r of rows) {
      const amount = Math.abs(Number(r.amount) || 0);
      const date = coreDataToISODate(r.date);
      const category = clean(r.category) || "General";
      const name = clean(r.name);
      const extra = clean(r.note);
      const note = extra && extra !== name ? (name ? name + " — " + extra : extra) : name;
      const base = hash32([date, amount, category, name, extra].join("|"));
      const n = (seen.get(base) || 0) + 1;
      seen.set(base, n);
      out.push({ id: prefix + base + (n > 1 ? "-" + n : ""), date, category, paidBy, amount, note });
    }
    return out;
  }

  /**
   * existing: current expenses; incoming: output of rowsToExpenses;
   * importedIds: ids this feature has handled before (array or Set).
   */
  function planImport(existing, incoming, importedIds, opts) {
    const done = new Set(importedIds || []);
    const matchExisting = !opts || opts.matchExisting !== false;
    const poolFilter = (opts && opts.poolFilter) || (() => true);
    const today = opts && opts.today; // ISO date; rows after it (future recurring) wait until their day
    const pool = new Map();
    for (const e of matchExisting ? existing || [] : []) {
      if (typeof e.id === "string" && IMPORTED_ID.test(e.id)) continue;
      if (!poolFilter(e)) continue;
      const k = e.date + "|" + Math.abs(Number(e.amount) || 0);
      pool.set(k, (pool.get(k) || 0) + 1);
    }
    const toAdd = [];
    const handledIds = [];
    let alreadyImported = 0;
    let matchedExisting = 0;
    let skippedFuture = 0;
    for (const item of incoming) {
      if (done.has(item.id)) { alreadyImported++; continue; }
      if (today && item.date > today) { skippedFuture++; continue; }
      const k = item.date + "|" + item.amount;
      if ((pool.get(k) || 0) > 0) {
        pool.set(k, pool.get(k) - 1);
        matchedExisting++;
        handledIds.push(item.id);
        continue;
      }
      toAdd.push(item);
      handledIds.push(item.id);
    }
    return { toAdd, handledIds, alreadyImported, matchedExisting, skippedFuture };
  }

  /**
   * Mirror step: imported rows (this source's id prefix) that are no longer in the Spending backup were
   * edited or deleted there. Returns them as `stale` — the caller decides whether it is safe to remove them.
   * Rows you typed in yourself never carry the import prefix, so they are never candidates.
   */
  function planRemovals(existing, incoming, idPrefix, opts) {
    const have = new Set((incoming || []).map((e) => e.id));
    const mine = (existing || []).filter((e) => typeof e.id === "string" && e.id.startsWith(idPrefix));
    const stale = mine.filter((e) => !have.has(e.id));
    const limit = opts && Number.isFinite(opts.limit) ? opts.limit : Math.max(20, Math.ceil(mine.length * 0.02));
    return {
      stale,
      total: mine.length,
      limit,
      large: stale.length > limit,                                                   // unusually many: ask, never auto-apply
      tooFewRows: mine.length >= 20 && (incoming || []).length < mine.length * 0.5,  // backup looks incomplete
    };
  }

  const baseId = (id) => String(id).replace(IMPORTED_ID, "");

  /**
   * Fraction of `incoming` rows whose content already appears among `otherIds`
   * (another source's imported ids). Used to detect "wife's backup is really mine".
   */
  function overlapRatio(incoming, otherIds) {
    if (!incoming.length) return 0;
    const other = new Set((otherIds || []).map(baseId));
    let hit = 0;
    for (const e of incoming) if (other.has(baseId(e.id))) hit++;
    return hit / incoming.length;
  }

  /** Sum of amounts for a "YYYY-MM" month, optionally ignoring rows after `today`. */
  function monthTotal(items, ym, today) {
    let t = 0;
    for (const e of items) if (e.date.startsWith(ym) && (!today || e.date <= today)) t += e.amount;
    return Math.round(t);
  }

  /** Remove every expense imported for a source prefix and forget its ids (for a clean re-import). */
  function resetSource(expenses, ids, prefix) {
    return {
      expenses: (expenses || []).filter((e) => !(typeof e.id === "string" && e.id.startsWith(prefix))),
      ids: (ids || []).filter((id) => !id.startsWith(prefix)),
    };
  }

  return { overlapRatio, baseId, monthTotal, resetSource, coreDataToISODate, rowsToExpenses, planImport, planRemovals, hash32, ID_PREFIX };
});
