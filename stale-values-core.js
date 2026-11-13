/**
 * Life Ledger — values typed in by hand that have gone out of date (pure; no DOM, no network).
 *
 * Shares, funds and gold are re-priced by the app; a bank balance, an FD, EPF, PPF, silver, crypto, an SGB or a piece of
 * jewellery is only as true as the day somebody typed it. Net worth quietly keeps adding the old number. This lists the typed-in
 * values older than a limit, oldest first, and builds the one-tap update (a new value, or "still correct" which only moves the date).
 *
 * The limits are rules, shown on the page: a balance or a crypto price moves in days, an FD or EPF passbook moves slowly.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerStaleValues = factory();
})(typeof self !== "undefined" ? self : this, function () {
  /** coll = the key in the app's data; days = how old (in days) a value may be before it is called out of date. */
  const KINDS = [
    { coll: "banksaving", label: "Bank savings", days: 30 },
    { coll: "crypto", label: "Crypto", days: 30 },
    { coll: "silver", label: "Silver", days: 30 },
    { coll: "bonds", label: "Bonds / SGB", days: 30 },
    { coll: "fd", label: "Fixed deposits", days: 90 },
    { coll: "epf", label: "EPF", days: 90 },
    { coll: "ppf", label: "PPF", days: 90 },
    { coll: "others", label: "Other assets", days: 90 },
  ];
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const DAY = 86400000;
  const validISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && (() => { const t = Date.parse(s + "T00:00:00Z"); return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s; })();

  /** Whole days from `from` to `to` (both YYYY-MM-DD); null when either is not a real date. */
  function daysBetween(from, to) {
    const a = String(from || "").slice(0, 10), b = String(to || "").slice(0, 10);
    if (!validISO(a) || !validISO(b)) return null;
    return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY);
  }

  /**
   * Typed-in values that are out of date on `today`. limits = optional { coll: days } to override KINDS.
   * → { rows: [{ coll, id, kind, owner, name, value, asOf, ageDays, limit, undated }], checked, fresh, worth }
   * A value is out of date when it is MORE than `limit` days old (exactly the limit is still fine). A record with no usable date is
   * listed too (undated: true, ageDays: null) because its age cannot be told. A value of 0 is skipped: it adds nothing to net worth.
   * Oldest first, undated first of all. `worth` = the rupees that are standing on out-of-date numbers.
   */
  function find(state, today, limits) {
    const s = state || {}, rows = [];
    let checked = 0;
    for (const k of KINDS) {
      const limit = limits && Number.isFinite(Number(limits[k.coll])) && Number(limits[k.coll]) >= 0 ? Number(limits[k.coll]) : k.days;
      for (const r of Array.isArray(s[k.coll]) ? s[k.coll] : []) {
        if (!r || !(num(r.value) > 0)) continue;
        checked++;
        const age = daysBetween(r.date, today);
        if (age !== null && age <= limit) continue;
        rows.push({ coll: k.coll, id: r.id, kind: k.label, owner: r.owner || "Me", name: String(r.note || r.name || k.label), value: num(r.value), asOf: validISO(String(r.date || "").slice(0, 10)) ? String(r.date).slice(0, 10) : "", ageDays: age, limit, undated: age === null });
      }
    }
    rows.sort((a, b) => (a.ageDays === null ? 1 : 0) === (b.ageDays === null ? 1 : 0) ? (b.ageDays || 0) - (a.ageDays || 0) : a.ageDays === null ? -1 : 1);
    return { rows, checked, fresh: checked - rows.length, worth: rows.reduce((t, r) => t + r.value, 0) };
  }

  /**
   * The one-tap update. change = { value } sets a new value; {} (no value) means "still correct" and only moves the date.
   * Returns { ok: true, list } (a new list; the input is untouched) or { ok: false, error }.
   */
  function refresh(list, id, change, today) {
    const arr = Array.isArray(list) ? list : [];
    const i = arr.findIndex((r) => r && r.id === id);
    if (i < 0) return { ok: false, error: "That record no longer exists." };
    if (!validISO(String(today || ""))) return { ok: false, error: "Today's date is missing." };
    const c = change || {};
    const next = { ...arr[i], date: today };
    if (c.value !== undefined && c.value !== null && c.value !== "") {
      const v = Number(c.value);
      if (!Number.isFinite(v) || v < 0) return { ok: false, error: "Enter a value of zero or more." };
      next.value = v;
    }
    return { ok: true, list: arr.map((r, j) => (j === i ? next : r)) };
  }

  return { KINDS, daysBetween, find, refresh };
});
