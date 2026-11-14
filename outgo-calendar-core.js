/**
 * Life Ledger — the 12-month outgo calendar (pure; no DOM, no network, no clock).
 *
 * Every payment the household already knows about, laid out month by month for the next twelve months, so a heavy month is seen
 * before it arrives. It reads only what is recorded: insurance premiums (next due date + how often), loan EMIs (amount + day of the
 * month) and the recurring outgoings the household adds itself (rent, PPF, subscriptions, fees…). It never estimates: an item with
 * no amount is listed as "amount missing", and anything not recorded is not in the calendar.
 *
 *   build(items, today, { months })  → { months[{ key, label, total, cumulative, items[] }], total, perMonthAverage, heaviest[], overdue[], missing[], undated[], from, to }
 *   fromInsurance(rows) / fromLiabilities(rows, today) / fromOutgoings(rows) → items for build()
 *   An item is { id, name, kind, owner, amount, frequency: "Monthly"|"Quarterly"|"Half-yearly"|"Yearly"|"Once", nextDate: "YYYY-MM-DD", endDate?: "YYYY-MM-DD", source }.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerOutgo = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const STEP = { Monthly: 1, Quarterly: 3, "Half-yearly": 6, Yearly: 12 };
  const FREQUENCIES = ["Monthly", "Quarterly", "Half-yearly", "Yearly", "Once"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const r2 = (n) => Math.round(n * 100) / 100;
  const iso = (v) => String(v || "").slice(0, 10);
  const validISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && (() => { const t = Date.parse(s + "T00:00:00Z"); return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s; })();
  const lastDayOf = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();          // m is 1-12
  const ymd = (y, m, d) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const monthKey = (s) => s.slice(0, 7);
  const monthLabel = (key) => `${MONTHS[+key.slice(5, 7) - 1]} ${key.slice(0, 4)}`;
  /** The date k periods after the anchor, keeping the anchor's day of the month (31 Jan, +1 month → 28/29 Feb, +2 → 31 Mar). */
  function addMonthsAnchored(anchor, months) {
    const y0 = +anchor.slice(0, 4), m0 = +anchor.slice(5, 7), d0 = +anchor.slice(8, 10);
    const total = m0 - 1 + months, y = y0 + Math.floor(total / 12), m = (total % 12) + 1;
    return ymd(y, m, Math.min(d0, lastDayOf(y, m)));
  }
  const addMonthsToToday = (today, n) => addMonthsAnchored(today, n);

  /**
   * Every date an item falls due between `from` (inclusive) and `to` (inclusive), plus whether the first recorded date has already passed.
   * A recurring item whose recorded date is in the past is reported once as overdue (it was not marked paid), then rolled forward.
   */
  function dates(item, from, to) {
    const anchor = iso(item.nextDate);
    if (!validISO(anchor)) return { list: [], overdue: null };
    const end = validISO(iso(item.endDate)) ? iso(item.endDate) : null;
    const step = STEP[item.frequency];
    const within = (d) => d >= from && d <= to && (!end || d <= end);
    if (!step) return { list: within(anchor) ? [anchor] : [], overdue: anchor < from && (!end || anchor <= end) ? anchor : null };
    const list = [];
    let overdue = null;
    const fixedDay = Number.isInteger(item.dayOfMonth) && item.dayOfMonth >= 1 && item.dayOfMonth <= 31 ? item.dayOfMonth : null;
    for (let k = 0; k < 4000; k++) {
      let d = addMonthsAnchored(anchor, k * step);
      if (fixedDay) d = ymd(+d.slice(0, 4), +d.slice(5, 7), Math.min(fixedDay, lastDayOf(+d.slice(0, 4), +d.slice(5, 7))));
      if (end && d > end) break;
      if (d > to) break;
      if (d < from) { if (k === 0) overdue = d; continue; }
      list.push(d);
    }
    return { list, overdue };
  }

  /**
   * The calendar. today = "YYYY-MM-DD". months = how many calendar months to show, from the current month (default 12). The first month
   * holds only what is still to come (from today); earlier dates of an unpaid recurring item are in `overdue`.
   */
  function build(items, today, opts) {
    const n = opts && Number.isInteger(opts.months) && opts.months > 0 && opts.months <= 36 ? opts.months : 12;
    if (!validISO(iso(today))) return { months: [], total: 0, perMonthAverage: 0, heaviest: [], overdue: [], missing: [], undated: [], from: null, to: null };
    const from = iso(today), firstKey = monthKey(from);
    const lastMonth = addMonthsAnchored(firstKey + "-01", n - 1);
    const to = ymd(+lastMonth.slice(0, 4), +lastMonth.slice(5, 7), lastDayOf(+lastMonth.slice(0, 4), +lastMonth.slice(5, 7)));
    const months = [];
    for (let i = 0; i < n; i++) { const key = monthKey(addMonthsAnchored(firstKey + "-01", i)); months.push({ key, label: monthLabel(key), total: 0, cumulative: 0, items: [] }); }
    const byKey = new Map(months.map((m) => [m.key, m]));
    const overdue = [], missing = [], undated = [];
    for (const it of items || []) {
      if (!it) continue;
      const amount = num(it.amount), hasAmount = amount > 0;
      if (!validISO(iso(it.nextDate))) { undated.push({ id: it.id, name: it.name, kind: it.kind, amount, source: it.source }); continue; }
      const { list, overdue: od } = dates(it, from, to);
      if (od) overdue.push({ id: it.id, name: it.name, kind: it.kind, owner: it.owner, date: od, amount: hasAmount ? r2(amount) : null, source: it.source });
      if (!hasAmount && (list.length || od)) missing.push({ id: it.id, name: it.name, kind: it.kind, next: list[0] || od, source: it.source });
      for (const d of list) {
        const m = byKey.get(monthKey(d));
        if (!m) continue;
        m.items.push({ date: d, name: it.name, kind: it.kind, owner: it.owner, amount: hasAmount ? r2(amount) : null, frequency: it.frequency, source: it.source, id: it.id });
        if (hasAmount) m.total = r2(m.total + amount);
      }
    }
    let run = 0;
    for (const m of months) { m.items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.name < b.name ? -1 : 1)); run = r2(run + m.total); m.cumulative = run; }
    const total = run;
    const heaviest = months.filter((m) => m.total > 0).slice().sort((a, b) => b.total - a.total || (a.key < b.key ? -1 : 1)).slice(0, 3).map((m) => ({ key: m.key, label: m.label, total: m.total }));
    overdue.sort((a, b) => (a.date < b.date ? -1 : 1));
    return { months, total, perMonthAverage: r2(total / n), heaviest, overdue, missing, undated, from, to };
  }

  // ── turning what the app already holds into items ───────────────────────────────────────────
  const PREMIUM_FREQ = { Monthly: "Monthly", Quarterly: "Quarterly", "Half-yearly": "Half-yearly", Yearly: "Yearly" };
  function fromInsurance(rows) {
    return (rows || []).filter((p) => p && p.nextDue).map((p) => ({ id: "ins:" + p.id, name: [p.type, p.policyName || p.insurer].filter(Boolean).join(" · ") || "Insurance", kind: "Insurance", owner: p.person || "Me", amount: num(p.premium), frequency: PREMIUM_FREQ[p.frequency] || "Yearly", nextDate: iso(p.nextDue), source: "insurance" }));
  }
  /** A loan with an EMI amount and a day of the month: that day, every month, from the next one that is still to come. */
  function fromLiabilities(rows, today) {
    const t = iso(today);
    if (!validISO(t)) return [];
    const out = [];
    for (const l of rows || []) {
      const emi = num(l && l.emi), day = Math.round(num(l && l.emiDay));
      if (!(emi > 0) || !(day >= 1 && day <= 31)) continue;
      const y = +t.slice(0, 4), m = +t.slice(5, 7);
      const thisMonth = ymd(y, m, Math.min(day, lastDayOf(y, m)));
      let d = thisMonth;
      if (d < t) { const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1; d = ymd(ny, nm, Math.min(day, lastDayOf(ny, nm))); }
      out.push({ id: "loan:" + l.id, name: l.name || "Loan EMI", kind: "Loan EMI", owner: l.owner || "Me", amount: emi, frequency: "Monthly", dayOfMonth: day, nextDate: d, source: "liabilities" });
    }
    return out;
  }
  function fromOutgoings(rows) {
    return (rows || []).filter(Boolean).map((o) => ({ id: "out:" + o.id, name: o.name || "Outgoing", kind: o.kind || "Other", owner: o.owner || "Both", amount: num(o.amount), frequency: FREQUENCIES.includes(o.frequency) ? o.frequency : "Monthly", nextDate: iso(o.nextDate), endDate: iso(o.endDate), source: "outgoings" }));
  }
  /** Checks one outgoing typed in by the household. → list of problems (empty = fine). */
  function validateOutgoing(o) {
    const e = [], x = o || {};
    if (!String(x.name || "").trim()) e.push("What is it for?");
    if (!(num(x.amount) > 0)) e.push("Enter the amount each time it is paid.");
    if (!FREQUENCIES.includes(x.frequency)) e.push("How often is it paid?");
    if (!validISO(iso(x.nextDate))) e.push("Enter the next date it is due.");
    if (x.endDate && !validISO(iso(x.endDate))) e.push("The last date is not a real date.");
    if (x.endDate && validISO(iso(x.endDate)) && validISO(iso(x.nextDate)) && iso(x.endDate) < iso(x.nextDate)) e.push("The last date is before the next due date.");
    return e;
  }

  return { FREQUENCIES, STEP, addMonthsAnchored, dates, build, fromInsurance, fromLiabilities, fromOutgoings, validateOutgoing, validISO, monthLabel };
});
