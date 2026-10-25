/**
 * Life Ledger — the household's choices for the Salary and Spending dashboards (pure; no DOM, no network).
 *
 * { salary:   { marks: { person: { "YYYY-MM": "oneoff" | "regular" } }, inflationPct },
 *   spending: { budgets: { category: monthlyRupees }, fixed: { category: true | false } },
 *   portfolio: { reference: "target" | "balanced" | "aggressive" | "conservative" | "age", includeOther: boolean } }
 *
 * `clean` accepts anything (an old vault, a hand-edited file) and returns only what is valid, so the dashboards never meet a
 * bad value. The `set…` functions return a new settings object and never change the one they are given.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerDashboardSettings = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const INFLATION_MIN = 0;
  const INFLATION_MAX = 30;
  const DEFAULT_INFLATION_PCT = 5;
  const BUDGET_MAX = 100000000;
  const isObject = (v) => v && typeof v === "object" && !Array.isArray(v);
  const validYm = (ym) => /^\d{4}-(0[1-9]|1[0-2])$/.test(ym);
  const MARKS = ["oneoff", "regular"];
  const REFERENCES = ["target", "balanced", "aggressive", "conservative", "age"];
  const DEFAULT_REFERENCE = "target";

  /** A yearly price rise from text or a number: a finite value from 0 to 30, else null. */
  function parseInflation(value) {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const n = Number(String(value).replace(/%/g, "").trim());
    return Number.isFinite(n) && n >= INFLATION_MIN && n <= INFLATION_MAX ? n : null;
  }

  /** A monthly budget from text or a number: a whole-rupee amount above 0 and up to ₹10 crore, else null. */
  function parseBudget(value) {
    if (value === null || value === undefined) return null;
    const n = Number(String(value).replace(/[₹,\s]/g, ""));
    const whole = Math.round(n);
    return Number.isFinite(n) && whole > 0 && whole <= BUDGET_MAX ? whole : null;
  }

  function clean(raw) {
    const src = isObject(raw) ? raw : {};
    const sal = isObject(src.salary) ? src.salary : {};
    const spend = isObject(src.spending) ? src.spending : {};
    const marks = {};
    if (isObject(sal.marks)) {
      for (const [person, byMonth] of Object.entries(sal.marks)) {
        if (!isObject(byMonth)) continue;
        const kept = {};
        for (const [ym, mark] of Object.entries(byMonth)) if (validYm(ym) && MARKS.includes(mark)) kept[ym] = mark;
        if (Object.keys(kept).length) marks[person] = kept;
      }
    }
    const budgets = {};
    if (isObject(spend.budgets)) for (const [cat, v] of Object.entries(spend.budgets)) { const b = parseBudget(v); if (b !== null && cat.trim()) budgets[cat] = b; }
    const fixed = {};
    if (isObject(spend.fixed)) for (const [cat, v] of Object.entries(spend.fixed)) if (typeof v === "boolean" && cat.trim()) fixed[cat] = v;
    const inflation = parseInflation(sal.inflationPct);
    const pf = isObject(src.portfolio) ? src.portfolio : {};
    const portfolio = { reference: REFERENCES.includes(pf.reference) ? pf.reference : DEFAULT_REFERENCE, includeOther: pf.includeOther === true };
    return { salary: { marks, inflationPct: inflation === null ? DEFAULT_INFLATION_PCT : inflation }, spending: { budgets, fixed }, portfolio };
  }

  /** Mark a month as a one-off, as regular, or (mark = null) back to the automatic rule. */
  function setMark(settings, person, ym, mark) {
    const s = clean(settings);
    if (!validYm(ym) || !String(person || "").trim()) return s;
    const mine = { ...(s.salary.marks[person] || {}) };
    if (MARKS.includes(mark)) mine[ym] = mark; else delete mine[ym];
    const marks = { ...s.salary.marks };
    if (Object.keys(mine).length) marks[person] = mine; else delete marks[person];
    return { ...s, salary: { ...s.salary, marks } };
  }

  /** Set the yearly price rise; an invalid value leaves the setting as it was. */
  function setInflation(settings, value) {
    const s = clean(settings), n = parseInflation(value);
    return n === null ? s : { ...s, salary: { ...s.salary, inflationPct: n } };
  }

  /** Set a category's monthly budget; blank or 0 removes it, an invalid value leaves it as it was. */
  function setBudget(settings, category, value) {
    const s = clean(settings);
    if (!String(category || "").trim()) return s;
    const budgets = { ...s.spending.budgets };
    if (value === null || value === undefined || String(value).trim() === "" || Number(String(value).replace(/[₹,\s]/g, "")) === 0) delete budgets[category];
    else { const b = parseBudget(value); if (b === null) return s; budgets[category] = b; }
    return { ...s, spending: { ...s.spending, budgets } };
  }

  /** Say whether a category is fixed (true), flexible (false) or goes by its name (null). */
  function setFixed(settings, category, value) {
    const s = clean(settings);
    if (!String(category || "").trim()) return s;
    const fixed = { ...s.spending.fixed };
    if (typeof value === "boolean") fixed[category] = value; else delete fixed[category];
    return { ...s, spending: { ...s.spending, fixed } };
  }

  /** Choose the reference mix and/or whether other assets (vehicles …) count in the portfolio. Anything invalid is ignored. */
  function setPortfolio(settings, patch) {
    const s = clean(settings), p = patch || {};
    const next = { ...s.portfolio };
    if (REFERENCES.includes(p.reference)) next.reference = p.reference;
    if (typeof p.includeOther === "boolean") next.includeOther = p.includeOther;
    return { ...s, portfolio: next };
  }

  return { REFERENCES, DEFAULT_REFERENCE, INFLATION_MIN, INFLATION_MAX, DEFAULT_INFLATION_PCT, BUDGET_MAX, parseInflation, parseBudget, clean, setMark, setInflation, setBudget, setFixed, setPortfolio };
});
