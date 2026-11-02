/**
 * How goals that are not plain money are measured, pure (no page, no clock, no storage).
 *
 * Every goal belongs to a category and has its own unit: money in rupees, income in rupees a month or year, body in kg or
 * days a week, time with people and skills in hours a week or counts a month or year. This file works out progress in that
 * unit and what each category asks per day or per month. Money goals themselves are planned in goals-plan-core.js.
 *
 * A measured goal carries: cat, unit, target, and optionally direction ("down" for weight, "atMost" for a ceiling such as
 * fights a month), heightCm, start, current, and log: [{ date, value }] for goals counted per week, month or year.
 * Nothing here is advice; the healthy BMI band is the usual 18.5 to 24.9 and only used to flag a target, never to change it.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerGoalsMeasure = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const MONTH_DAYS = 30.4375, DAY = 86400000;
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const has = (v) => v != null && v !== "" && Number.isFinite(Number(v));
  const iso = (s) => (/^\d{4}-\d{2}-\d{2}/.test(String(s || "")) ? String(s).slice(0, 10) : null);
  const dayNumber = (s) => { const d = iso(s); if (!d) return null; const t = Date.parse(d + "T00:00:00Z"); return Number.isFinite(t) ? t / DAY : null; };
  const dateOf = (n) => new Date(n * DAY).toISOString().slice(0, 10);
  const round = (n, d) => { const f = Math.pow(10, d); return Math.round(n * f) / f; };

  const CATEGORIES = [
    { id: "money", label: "Money", unit: "₹" },
    { id: "income", label: "Income", unit: "₹ a month or year" },
    { id: "body", label: "Body and health", unit: "kg, days a week" },
    { id: "people", label: "Time with people", unit: "hours a week" },
    { id: "skills", label: "Skills and work", unit: "hours a week" },
    { id: "other", label: "Other", unit: "" },
  ];
  const ORDER = Object.fromEntries(CATEGORIES.map((c, i) => [c.id, i]));
  const labelOf = (id) => (CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1]).label;

  /** The goal's category: what it says, else money for money kinds, income for income goals, otherwise "other". */
  function categoryOf(goal) {
    const g = goal || {};
    if (g.cat && ORDER[g.cat] != null) return g.cat;
    if (g.kind === "income") return "income";
    if (g.kind === "networth") return "money";
    if (g.kind === "score" || g.kind === "measure") return "other";
    return "money";
  }

  // ── body: weight and BMI from height ──
  const BMI_LOW = 18.5, BMI_HIGH = 24.9;
  function bmi(kg, cm) {
    if (!(num(kg) > 0) || !(num(cm) > 0)) return null;
    const m = num(cm) / 100;
    return round(num(kg) / (m * m), 1);
  }
  /** The weights that give a BMI of 18.5 and 24.9 at this height. */
  function healthyRange(cm) {
    if (!(num(cm) > 0)) return null;
    const m2 = Math.pow(num(cm) / 100, 2);
    return { minKg: round(BMI_LOW * m2, 1), maxKg: round(BMI_HIGH * m2, 1) };
  }

  const daysLeft = (due, today) => { const a = dayNumber(due), b = dayNumber(today); return a == null || b == null ? null : Math.round(a - b); };

  /**
   * A weight-loss goal ("down"): how far, how fast, and where the target sits against the usual healthy band at this height.
   * `current` is whatever the household last measured or typed; with none it says so rather than guessing.
   */
  function weightPlan(goal, today) {
    const g = goal || {}, target = num(g.target), cm = num(g.heightCm);
    if (!has(g.current) || !(num(g.current) > 0)) return { needsCurrent: true, target, bmiTarget: bmi(target, cm), range: healthyRange(cm) };
    const current = num(g.current);
    const start = has(g.start) && num(g.start) > 0 ? num(g.start) : current;
    const remaining = Math.max(0, round(current - target, 1));
    const days = daysLeft(g.dueDate, today);
    const months = days == null ? null : Math.max(0, days / MONTH_DAYS);
    const perMonth = remaining === 0 ? 0 : months == null ? null : months <= 0 ? remaining : round(remaining / months, 2);
    const span = start - target;
    const pct = remaining === 0 ? 100 : span > 0 ? Math.max(0, Math.min(100, Math.round(((start - current) / span) * 100))) : 0;
    const range = healthyRange(cm), bmiTarget = bmi(target, cm);
    return {
      current, start, target, remaining, done: remaining === 0, pct,
      perMonth, perWeek: perMonth == null ? null : round(perMonth * 12 / 52, 2),
      bmiNow: bmi(current, cm), bmiTarget, range,
      targetBelowBand: bmiTarget != null && bmiTarget < BMI_LOW,
      targetAboveBand: bmiTarget != null && bmiTarget > BMI_HIGH,
      tooFast: perMonth != null && perMonth > 4,
    };
  }

  // ── time: goals counted per week, month or year, from a log ──
  const PERIODS = { "hours/week": "week", "days/week": "week", "count/month": "month", "count/year": "year", "check-ups/year": "year" };
  const periodOf = (unit) => PERIODS[unit] || null;

  /** The period containing `today`: weeks run Monday to Sunday. */
  function windowFor(period, today) {
    const n = dayNumber(today);
    if (n == null || !period) return null;
    if (period === "week") { const dow = new Date(n * DAY).getUTCDay(); const s = n - ((dow + 6) % 7); return { start: dateOf(s), end: dateOf(s + 6) }; }
    const d = new Date(n * DAY), y = d.getUTCFullYear(), m = d.getUTCMonth();
    if (period === "month") return { start: dateOf(Date.UTC(y, m, 1) / DAY), end: dateOf(Date.UTC(y, m + 1, 0) / DAY) };
    return { start: y + "-01-01", end: y + "-12-31" };
  }

  /** What has been logged in the current period against the target; "atMost" goals are met while the total stays at or under it. */
  function periodProgress(goal, today) {
    const g = goal || {}, period = periodOf(g.unit), target = num(g.target), win = windowFor(period, today);
    if (!win) return { counted: false };
    const sum = round((Array.isArray(g.log) ? g.log : []).reduce((s, e) => (e && iso(e.date) && e.date.slice(0, 10) >= win.start && e.date.slice(0, 10) <= win.end ? s + num(e.value) : s), 0), 2);
    const atMost = g.direction === "atMost";
    const met = atMost ? sum <= target : sum >= target;
    const pct = atMost ? (sum <= target ? 100 : Math.max(0, Math.round((target / sum) * 100))) : target > 0 ? Math.min(100, Math.round((sum / target) * 100)) : 0;
    return { counted: true, period, start: win.start, end: win.end, sum, target, met, pct, atMost };
  }

  // ── income: now against the target, in the goal's own unit ──
  function incomeProgress(goal) {
    const g = goal || {}, target = num(g.target), cur = Math.max(0, num(g.current != null ? g.current : g.saved));
    const yearly = g.unit === "₹/year";
    const gap = Math.max(0, target - cur);
    return { current: cur, target, yearly, pct: target > 0 ? Math.min(100, Math.round((cur / target) * 100)) : 0, done: target > 0 && cur >= target, gapPerMonth: Math.round(yearly ? gap / 12 : gap) };
  }

  /**
   * One goal as the page shows it, in its own unit. `inr` formats rupees; the page passes its own formatter.
   * Returns { cat, type, pct, done, headline, detail, notes[] }.
   */
  function view(goal, today, opts) {
    const o = opts || {}, inr = o.inr || ((n) => "₹" + Math.round(n)), g = goal || {}, cat = categoryOf(g);
    const kg = (n) => round(n, 1) + " kg";
    if (g.unit === "kg") {
      const w = weightPlan(g, today);
      if (w.needsCurrent) return { cat, type: "weight", pct: 0, done: false, headline: "Enter your weight to start", detail: `Target ${kg(w.target)}${w.bmiTarget != null ? ` (BMI ${w.bmiTarget})` : ""}`, notes: [] };
      const notes = [];
      if (w.range) notes.push(`Healthy range at this height: ${w.range.minKg} to ${w.range.maxKg} kg.`);
      if (w.targetBelowBand) notes.push(`${kg(w.target)} is a BMI of ${w.bmiTarget}, a little under the usual 18.5 floor. Worth checking the target with a doctor.`);
      if (w.targetAboveBand) notes.push(`${kg(w.target)} is a BMI of ${w.bmiTarget}, above the usual 24.9 ceiling.`);
      if (w.tooFast) notes.push(`That is ${w.perMonth} kg a month, faster than the usual 0.25 to 1 kg a week.`);
      return {
        cat, type: "weight", pct: w.pct, done: w.done,
        headline: w.done ? `${kg(w.current)}: target reached` : `${kg(w.current)} now, target ${kg(w.target)}`,
        detail: `BMI ${w.bmiNow} now${w.bmiTarget != null ? `, ${w.bmiTarget} at target` : ""}${w.done ? "" : `. ${kg(w.remaining)} to go${w.perMonth != null ? `, about ${w.perMonth} kg a month` : ""}`}`,
        notes,
      };
    }
    if (g.kind === "income") {
      const p = incomeProgress(g);
      return { cat, type: "income", pct: p.pct, done: p.done, headline: `Now ${inr(p.current)} ${p.yearly ? "a year" : "a month"}, target ${inr(p.target)}`, detail: p.done ? "Target reached" : `${inr(p.gapPerMonth)} a month still to add`, notes: [] };
    }
    if (periodOf(g.unit)) {
      const p = periodProgress(g, today);
      const per = { week: "this week", month: "this month", year: "this year" }[p.period];
      const unit = { "hours/week": "h", "days/week": "days", "count/month": "", "count/year": "", "check-ups/year": "check-ups" }[g.unit];
      const sum = `${p.sum}${unit ? " " + unit : ""}`, tgt = `${p.target}${unit ? " " + unit : ""}`;
      return { cat, type: "periodic", pct: p.pct, done: p.met, headline: p.atMost ? `${sum} ${per}, at most ${tgt}` : `${sum} of ${tgt} ${per}`, detail: p.atMost ? (p.met ? "Within the limit" : "Over the limit") : p.met ? "Done for this period" : `${round(Math.max(0, p.target - p.sum), 2)}${unit ? " " + unit : ""} to go ${per}`, notes: [], period: p.period };
    }
    return { cat, type: "other", pct: Math.min(100, Math.round(num(g.saved))), done: num(g.saved) >= 100, headline: `${Math.round(num(g.saved))} of 100 done`, detail: "", notes: [] };
  }

  /**
   * What each category asks per day or per month, from the goals: hours a day for time and skills goals, the kg a month each
   * person must lose, and the rupees a month still to add to income. Money is planned in goals-plan-core.js.
   */
  function needs(goals, today) {
    let hoursPerWeek = 0, gapPerMonth = 0;
    const weights = [];
    for (const g of goals || []) {
      const cat = categoryOf(g);
      if (g.unit === "hours/week" && g.direction !== "atMost") hoursPerWeek += num(g.target);
      else if (g.unit === "kg") { const w = weightPlan(g, today); if (!w.needsCurrent && !w.done && w.perMonth != null) weights.push({ id: g.id, name: g.name, kgPerMonth: w.perMonth, remaining: w.remaining }); }
      else if (g.kind === "income" && cat === "income") gapPerMonth += incomeProgress(g).gapPerMonth;
    }
    return { hoursPerWeek: round(hoursPerWeek, 1), hoursPerDay: round(hoursPerWeek / 7, 2), weights, incomeGapPerMonth: gapPerMonth };
  }

  /** Groups goals by category in the page's order; the goals inside keep their order. */
  function groupByCategory(goals) {
    const groups = new Map();
    for (const g of goals || []) { const c = categoryOf(g); if (!groups.has(c)) groups.set(c, []); groups.get(c).push(g); }
    return [...groups.entries()].sort((a, b) => ORDER[a[0]] - ORDER[b[0]]).map(([id, list]) => ({ id, label: labelOf(id), unit: (CATEGORIES.find((c) => c.id === id) || {}).unit || "", goals: list }));
  }

  return { CATEGORIES, categoryOf, labelOf, bmi, healthyRange, weightPlan, periodOf, windowFor, periodProgress, incomeProgress, view, needs, groupByCategory, BMI_LOW, BMI_HIGH };
});
