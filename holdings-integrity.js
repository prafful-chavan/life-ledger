/**
 * Life Ledger — holdings integrity (pure; no DOM, no network).
 *
 * Mutual funds, stocks and US stocks are imported from the Excel sheet on Drive ("Sync Holdings"). Three things keep that safe
 * across several devices:
 *  1. STABLE IDS — an imported row's id is a hash of its content (plus its position among identical rows), so importing the same
 *     sheet twice produces the same ids. Nothing is deleted-and-recreated, so an old copy of the app can never bring the "deleted"
 *     rows back next to their replacements.
 *  2. GHOST COLLAPSE — if a legacy random-id row has the same content as a stable-id row, the stable-id row is the imported one
 *     and the legacy row is a leftover from an older import: it is dropped.
 *  3. SURGE GUARD — before pushing, compare with what the cloud already holds; a sudden pile of extra identical rows is refused.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerHoldingsIntegrity = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const COLLS = { mutualFunds: "mf", stocks: "stk", usstocks: "uss" };
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const iso = (v) => String(v || "").slice(0, 10);

  /** What makes a lot "the same lot": never includes live prices. */
  function fingerprint(coll, r) {
    if (!r) return "";
    if (coll === "mutualFunds") {
      const t = /^red/i.test(String(r.transactionType || "")) ? "R" : "P";
      return [r.fundName, r.owner || "Me", r.demat || "", iso(r.purchaseDate || r.date), num(r.units).toFixed(4), num(r.invested).toFixed(2), t].join("|");
    }
    return [String(r.symbol || r.company || "").toUpperCase(), r.owner || "Me", r.demat || "", iso(r.purchaseDate || r.date), num(r.quantity).toFixed(4), num(r.invested).toFixed(2)].join("|");
  }

  /** 64-bit-ish content hash as 16 hex chars (two independent FNV-1a passes). */
  function hash16(str) {
    let a = 0x811c9dc5, b = 0x9747b28c;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      a ^= c; a = Math.imul(a, 16777619);
      b ^= c + i; b = Math.imul(b, 2246822519);
    }
    const hex = (x) => (x >>> 0).toString(16).padStart(8, "0");
    return hex(a) + hex(b);
  }

  const isStableId = (id) => /^(mf|stk|uss)-h-[0-9a-f]{16}$/.test(String(id || ""));

  /** Give every imported row a content-derived id; identical rows get #0, #1, … so they stay distinct. */
  function assignStableIds(coll, rows) {
    const prefix = COLLS[coll];
    if (!prefix) return rows;
    const seen = new Map();
    return (rows || []).map((r) => {
      const fp = fingerprint(coll, r), n = seen.get(fp) || 0;
      seen.set(fp, n + 1);
      return { ...r, id: `${prefix}-h-${hash16(fp + "#" + n)}` };
    });
  }

  /** Drops legacy-id rows whose content is already present as a stable-id (imported) row. Returns { data, removed }. */
  function collapseImportGhosts(data) {
    const out = { ...data };
    let removed = 0;
    for (const coll of Object.keys(COLLS)) {
      const rows = Array.isArray(data[coll]) ? data[coll] : null;
      if (!rows) continue;
      const stable = new Map();
      for (const r of rows) if (isStableId(r.id)) { const fp = fingerprint(coll, r); stable.set(fp, (stable.get(fp) || 0) + 1); }
      if (!stable.size) continue;
      const kept = rows.filter((r) => isStableId(r.id) || !stable.has(fingerprint(coll, r)));
      removed += rows.length - kept.length;
      out[coll] = kept;
    }
    return { data: out, removed };
  }

  /** Share of rows whose content appears more than once, per collection. A healthy book has a few; a doubled one has ~all. */
  function duplicateReport(data) {
    const report = [];
    for (const coll of Object.keys(COLLS)) {
      const rows = Array.isArray(data && data[coll]) ? data[coll] : [];
      const count = new Map();
      for (const r of rows) { const fp = fingerprint(coll, r); count.set(fp, (count.get(fp) || 0) + 1); }
      let dupRows = 0, groups = 0;
      for (const c of count.values()) if (c > 1) { dupRows += c; groups++; }
      report.push({ coll, rows: rows.length, rowsInDuplicateGroups: dupRows, groups, ratio: rows.length ? dupRows / rows.length : 0 });
    }
    return report;
  }

  /** True when a collection looks doubled: at least 10 rows and 20%+ of them share content with another row. */
  const looksDuplicated = (r) => r.rows >= 10 && r.ratio >= 0.2;

  /**
   * Removes the surplus copies from a doubled collection. If every lot appears twice as often as it should, keeping
   * ceil(m/2) of each content group restores the original exactly (a genuine pair that was doubled to four keeps its two).
   * Prefers stable-id rows, then the lowest ids, so the result is deterministic on every device.
   */
  function halveDuplicates(coll, rows) {
    const groups = new Map();
    for (const r of rows || []) { const fp = fingerprint(coll, r); (groups.get(fp) || groups.set(fp, []).get(fp)).push(r); }
    const keep = new Set();
    for (const list of groups.values()) {
      const sorted = list.slice().sort((a, b) => (isStableId(b.id) - isStableId(a.id)) || String(a.id).localeCompare(String(b.id)));
      sorted.slice(0, list.length > 1 ? Math.ceil(list.length / 2) : 1).forEach((r) => keep.add(r));
    }
    return (rows || []).filter((r) => keep.has(r));
  }

  /**
   * Compare what we are about to push with what the cloud holds. Returns the collections that grew by a pile of extra copies
   * of rows the cloud already has (≥5 and ≥20% of its size). Normal changes (a few new lots) never trigger it.
   */
  function duplicateSurge(base, next) {
    const hits = [];
    for (const coll of Object.keys(COLLS)) {
      const b = Array.isArray(base && base[coll]) ? base[coll] : [], n = Array.isArray(next && next[coll]) ? next[coll] : [];
      if (!b.length) continue;
      const bc = new Map();
      for (const r of b) { const fp = fingerprint(coll, r); bc.set(fp, (bc.get(fp) || 0) + 1); }
      const nc = new Map();
      for (const r of n) { const fp = fingerprint(coll, r); nc.set(fp, (nc.get(fp) || 0) + 1); }
      let extra = 0;
      for (const [fp, c] of nc) if (bc.has(fp)) extra += Math.max(0, c - bc.get(fp));
      if (extra >= 5 && extra >= 0.2 * b.length) hits.push({ coll, extra, baseRows: b.length, nextRows: n.length });
    }
    return hits;
  }


  // ── preview of a Sync Holdings import ───────────────────────────────────────────────────────
  const LABEL = { mutualFunds: "Mutual funds", stocks: "Stocks & ETFs", usstocks: "US stocks" };
  const inr = (v) => "₹" + Math.round(num(v)).toLocaleString("en-IN");
  const rowText = (coll, r) => coll === "mutualFunds"
    ? `${r.fundName || "?"} · ${iso(r.purchaseDate || r.date)} · ${inr(r.invested)}${/^red/i.test(String(r.transactionType || "")) ? " (sale)" : ""} · ${r.owner || "Me"}`
    : `${r.symbol || r.company || "?"} · ${num(r.quantity)} × · ${iso(r.purchaseDate || r.date)} · ${r.owner || "Me"}`;

  /** What changes if `incoming` replaces `current`, matching rows by content (never by id, which a re-import regenerates). */
  function diffHoldings(coll, current, incoming) {
    const group = (rows) => { const m = new Map(); for (const r of rows || []) { const fp = fingerprint(coll, r); (m.get(fp) || m.set(fp, []).get(fp)).push(r); } return m; };
    const cur = group(current), inc = group(incoming);
    const added = [], removed = [];
    let unchanged = 0;
    for (const [fp, rows] of inc) { const c = (cur.get(fp) || []).length; unchanged += Math.min(c, rows.length); if (rows.length > c) added.push(...rows.slice(c)); }
    for (const [fp, rows] of cur) { const n = (inc.get(fp) || []).length; if (rows.length > n) removed.push(...rows.slice(n)); }
    return { added, removed, unchanged, before: (current || []).length, after: (incoming || []).length };
  }

  /**
   * Summarises an import and decides whether it needs the user's OK first: a few new lots are routine, but a sheet that
   * would remove or add many rows, shrink a book by 5%+, or empty one is a bigger event than a normal daily sync.
   */
  function importSummary(state, incoming) {
    const byColl = {}, reasons = [];
    for (const coll of Object.keys(COLLS)) {
      const d = diffHoldings(coll, state && state[coll], incoming && incoming[coll]);
      byColl[coll] = d;
      if (!d.before && !d.after) continue;
      const changed = d.added.length + d.removed.length;
      if (d.before > 0 && d.after === 0) reasons.push(`${LABEL[coll]}: the sheet has none, but you hold ${d.before}`);
      else if (d.before > 0 && (d.removed.length >= 5 || d.added.length >= 5 || changed / d.before >= 0.05)) reasons.push(`${LABEL[coll]}: ${d.added.length} new and ${d.removed.length} removed against ${d.before} held`);
    }
    return { byColl, needsConfirm: reasons.length > 0, reasons };
  }

  /** Plain-language lines for a dialog or toast. */
  function describeImport(summary, { examples = 4 } = {}) {
    const lines = [];
    for (const coll of Object.keys(COLLS)) {
      const d = summary.byColl[coll];
      if (!d || (!d.before && !d.after)) continue;
      const bits = [];
      if (d.added.length) bits.push(`+${d.added.length} new`);
      if (d.removed.length) bits.push(`−${d.removed.length} removed`);
      lines.push(`${LABEL[coll]}: ${d.before} → ${d.after}${bits.length ? " (" + bits.join(", ") + ")" : " (no change)"}`);
    }
    const sample = (title, key) => {
      const out = [];
      for (const coll of Object.keys(COLLS)) for (const r of (summary.byColl[coll] || {})[key] || []) out.push(rowText(coll, r));
      return out.length ? [title, ...out.slice(0, examples).map((t) => "   • " + t), ...(out.length > examples ? [`   … and ${out.length - examples} more`] : [])] : [];
    };
    return { lines, details: [...sample("New:", "added"), ...sample("Removed:", "removed")] };
  }

  return { COLLS, fingerprint, hash16, isStableId, assignStableIds, collapseImportGhosts, duplicateReport, looksDuplicated, halveDuplicates, duplicateSurge, diffHoldings, importSummary, describeImport };
});
