/**
 * Life Ledger — share profit and loss by person, broker and financial year (pure; no DOM, no network, no clock).
 *
 * Two sources are put side by side and never mixed up:
 *   the app      the recorded sales (state.sales), added up;
 *   the broker   what the broker's own report says for that year (state.brokerStatements), copied from the report file.
 *
 * The figure shown is the broker's, because that is the broker's account of the money. Where the two differ by a rupee or more it says so,
 * with the known reason if one was written down. Where the report ends before the latest recorded sale, it is out of date: the app's
 * figure is shown and the row says why. Where there is no report, the row says the figure is the app's own. Charges the reports do not
 * give are "not known", never zero.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerPnl = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const MATCH_WITHIN = 1;
  const r2 = (n) => Math.round(n * 100) / 100;
  const has = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
  const val = (v) => (has(v) ? r2(Number(v)) : null);
  const validISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
  const validFY = (s) => /^\d{4}-\d{2}$/.test(String(s || "")) && Number(String(s).slice(5)) === (Number(String(s).slice(0, 4)) + 1) % 100;
  const str = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

  /** "2025-01-31" → "2024-25" (April to March). */
  function fyOf(day) {
    if (!validISO(day)) return "";
    const y = Number(day.slice(0, 4)), a = Number(day.slice(5, 7)) >= 4 ? y : y - 1;
    return `${a}-${String((a + 1) % 100).padStart(2, "0")}`;
  }

  /** One broker report line, cleaned, or null when it cannot be placed. fy "" = a lifetime line that belongs to no single year. */
  function statement(s) {
    if (!s || !str(s.owner, 20) || !str(s.broker, 40)) return null;
    const fy = str(s.fy, 7);
    if (fy && !validFY(fy)) return null;
    const out = { owner: str(s.owner, 20), broker: str(s.broker, 40), fy, realised: val(s.realised), options: val(s.options), charges: val(s.charges), dividends: val(s.dividends), to: validISO(s.to) ? s.to : "", note: str(s.note, 300), source: str(s.source, 300) };
    if ([out.realised, out.options, out.charges, out.dividends].every((v) => v === null)) return null;
    out.id = str(s.id, 80) || `bst-${out.owner}-${out.broker}-${fy || "all"}`.replace(/\s+/g, "_");
    return out;
  }
  /** Clean lines, one per owner + broker + year: of two for the same year the one reaching later is kept. */
  function clean(list) {
    const map = new Map();
    for (const raw of Array.isArray(list) ? list : []) {
      const s = statement(raw);
      if (!s) continue;
      const k = `${s.owner}|${s.broker}|${s.fy}`, old = map.get(k);
      if (!old || s.to > old.to) map.set(k, s);
    }
    return [...map.values()];
  }

  const add = (a, b) => (b === null ? a : r2((a === null ? 0 : a) + b));
  function totalsOf(rows) {
    const t = { profit: 0, options: null, charges: null, dividends: null, sales: 0, chargesUnknown: 0, differs: 0 };
    for (const r of rows) {
      t.profit = r2(t.profit + (r.shown === null ? 0 : r.shown)); t.sales += r.count;
      t.options = add(t.options, r.options); t.charges = add(t.charges, r.charges); t.dividends = add(t.dividends, r.dividends);
      if (r.charges === null && r.count > 0) t.chargesUnknown++;
      if (r.status === "differs") t.differs++;
    }
    t.after = r2(t.profit + (t.options || 0) - (t.charges || 0));
    return t;
  }

  function yearRow(fy, sales, st) {
    const count = sales.length, app = count ? r2(sales.reduce((t, s) => t + (Number(s.gain) || 0), 0)) : null;
    const latest = sales.reduce((m, s) => (String(s.soldOn) > m ? String(s.soldOn) : m), "");
    const reported = st ? st.realised : null;
    const row = { fy, count, app, reported, shown: app, diff: null, status: "app", options: st ? st.options : null, charges: st ? st.charges : null, dividends: st ? st.dividends : null, to: st ? st.to : "", note: st ? st.note : "", latest };
    if (!fy) { row.status = "extra"; row.shown = reported; return row; }
    if (reported === null) { row.status = count ? "app" : "none"; return row; }
    if (latest && st.to < latest) { row.status = "older"; return row; }
    row.shown = reported;
    row.diff = r2((app === null ? 0 : app) - reported);
    row.status = Math.abs(row.diff) < MATCH_WITHIN ? "match" : "differs";
    return row;
  }

  /** → { people:[{ owner, brokers:[{ broker, years[], totals }], totals }], totals, years:[{ fy, byOwner:{}, total }] } */
  function build(sales, statements) {
    const sts = clean(statements), groups = new Map();
    const at = (owner, broker, fy) => {
      const o = groups.get(owner) || groups.set(owner, new Map()).get(owner);
      const b = o.get(broker) || o.set(broker, new Map()).get(broker);
      return b.get(fy) || b.set(fy, { sales: [], st: null }).get(fy);
    };
    for (const s of Array.isArray(sales) ? sales : []) if (s && fyOf(s.soldOn)) at(s.owner || "Me", s.demat || "Not named", fyOf(s.soldOn)).sales.push(s);
    for (const s of sts) at(s.owner, s.broker, s.fy).st = s;
    const quiet = (r) => r.count === 0 && !r.shown && !r.options && !r.charges && !r.dividends;
    const people = [], all = [], byYear = new Map();
    const owners = [...groups.keys()].sort((a, b) => (a === b ? 0 : a === "Me" ? -1 : b === "Me" ? 1 : a < b ? -1 : 1));
    for (const owner of owners) {
      const brokers = [], mine = [];
      for (const [broker, years] of [...groups.get(owner)].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
        const rows = [...years].map(([fy, g]) => yearRow(fy, g.sales, g.st)).filter((r) => !quiet(r)).sort((a, b) => (a.fy === "" ? 1 : b.fy === "" ? -1 : a.fy < b.fy ? 1 : -1));
        if (!rows.length) continue;
        brokers.push({ broker, years: rows, totals: totalsOf(rows) }); mine.push(...rows);
        for (const r of rows) if (r.fy) { const y = byYear.get(r.fy) || byYear.set(r.fy, { fy: r.fy, byOwner: {}, total: 0 }).get(r.fy); const p = (r.shown || 0) + (r.options || 0); y.byOwner[owner] = r2((y.byOwner[owner] || 0) + p); y.total = r2(y.total + p); }
      }
      if (!brokers.length) continue;
      people.push({ owner, brokers, totals: totalsOf(mine) }); all.push(...mine);
    }
    return { people, totals: totalsOf(all), years: [...byYear.values()].sort((a, b) => (a.fy < b.fy ? 1 : -1)) };
  }

  return { MATCH_WITHIN, fyOf, statement, clean, build };
});
