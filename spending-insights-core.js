/**
 * Life Ledger — Spending dashboard logic (pure; no DOM, no network).
 *
 * Turns the expense list (and what the household earned) into what the Spending dashboard draws: which months are really
 * tracked, spend and savings rate per month, categories and how they move, fixed against flexible spending, budgets against
 * this month's pace, unusual items and months, and who paid for what.
 *
 * Salary credited at the end of month M−1 pays for month M, so a month's spending is set against the previous month's pay.
 * Nothing is guessed: a rate with no pay on record, a pace with too few days, a median with too few months are null.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerSpendingInsights = factory();
})(typeof self !== "undefined" ? self : this, function () {
  /** A month with less than this share of the usual month in the first stretch of tracking is the start of a ramp, not tracking. */
  const RAMP_SHARE = 0.2;
  /** How many months the "usual" is worked out from, and how many are needed. */
  const USUAL_MONTHS = 12;
  const USUAL_MIN = 6;
  /** A month this much above the usual is an unusual month. */
  const UNUSUAL_MONTH = 1.4;
  /** A single payment is unusual from this amount, and when it is also this many times the category's usual payment. */
  const ITEM_FLOOR = 25000;
  const ITEM_TIMES = 3;
  const ITEM_HISTORY_MIN = 5;
  /** A budget counts as close at this share used. A pace is only worked out from this day of the month. */
  const NEAR_SHARE = 0.8;
  const PACE_FROM_DAY = 5;
  /** Categories that recur at about the same amount every month, unless the household says otherwise. */
  const FIXED_WORDS = /\b(emi|rent|pg|insurance|policy|recharges?|ott|wifi|subscription|loan|fees?)\b/i;

  const median = (list) => {
    if (!list.length) return null;
    const sorted = list.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const ymOf = (date) => String(date || "").slice(0, 7);
  const validYm = (ym) => /^\d{4}-(0[1-9]|1[0-2])$/.test(ym);
  const ymIndex = (ym) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;
  const fromIndex = (i) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
  const shiftYm = (ym, delta) => fromIndex(ymIndex(ym) + delta);
  const daysInMonth = (ym) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
  const pct = (from, to) => (from ? ((to - from) / from) * 100 : null);

  /** Is a category fixed? The household's choice first ({category: true|false}), else the name. */
  function isFixed(category, overrides) {
    const o = overrides || {};
    if (Object.prototype.hasOwnProperty.call(o, category) && typeof o[category] === "boolean") return o[category];
    return FIXED_WORDS.test(category);
  }

  /**
   * The months that are really tracked: the unbroken run of months with spending that ends at the latest month, minus a
   * start-up month that holds less than 20% of what the next six months hold on average (a part-month at the start of
   * tracking). totals = { ym: total }. Returns { start, months } (oldest first), or { start: null, months: [] }.
   */
  function trackedMonths(totals) {
    const yms = Object.keys(totals).filter((ym) => validYm(ym) && totals[ym] > 0).sort();
    if (!yms.length) return { start: null, months: [] };
    let run = [yms[yms.length - 1]];
    for (let i = yms.length - 2; i >= 0; i--) {
      if (ymIndex(yms[i]) === ymIndex(run[0]) - 1) run.unshift(yms[i]);
      else break;
    }
    while (run.length > 1) {
      const next = run.slice(1, 7).map((ym) => totals[ym]);
      const avg = next.reduce((t, v) => t + v, 0) / next.length;
      if (totals[run[0]] < avg * RAMP_SHARE) run = run.slice(1);
      else break;
    }
    return { start: run[0], months: run };
  }

  /** Item amounts per category in the twelve months before and including `asOfYm`: used to tell what a normal payment is. */
  function categoryNorms(items, asOfYm) {
    const from = ymIndex(asOfYm) - 11;
    const by = new Map();
    for (const it of items) {
      const i = ymIndex(it.ym);
      if (i < from || i > ymIndex(asOfYm)) continue;
      if (!by.has(it.category)) by.set(it.category, []);
      by.get(it.category).push(it.amount);
    }
    const norms = new Map();
    for (const [cat, list] of by) norms.set(cat, { count: list.length, median: median(list) });
    return norms;
  }

  /**
   * Everything the dashboard needs.
   * expenses  = the expense rows ({ date, category, paidBy, amount, note, id? }).
   * o.num     = text → number; o.catOf(row) → the category's one spelling.
   * o.incomeByMonth = { ym: household net pay credited in that month } (months without pay are absent).
   * o.today   = "YYYY-MM-DD".
   * o.budgets = { category: monthly rupees }, o.fixed = { category: true|false }.
   */
  function analyze(expenses, o) {
    const num = o.num, catOf = o.catOf, today = String(o.today || "");
    const todayYm = validYm(ymOf(today)) ? ymOf(today) : null;
    const items = [];
    for (const e of expenses || []) {
      const ym = ymOf(e.date);
      const amount = num(e.amount);
      if (!validYm(ym) || !(amount > 0)) continue;
      items.push({ ...e, ym, amount, category: catOf(e), paidBy: e.paidBy || "Both" });
    }
    const totals = {};
    for (const it of items) totals[it.ym] = (totals[it.ym] || 0) + it.amount;
    const tracked = trackedMonths(totals);
    const trackedSet = new Set(tracked.months);
    const latestYm = tracked.months.length ? tracked.months[tracked.months.length - 1] : null;
    const partialYm = latestYm && todayYm && latestYm === todayYm ? latestYm : null;
    const completeYms = tracked.months.filter((ym) => ym !== partialYm);
    const lastComplete = completeYms.length ? completeYms[completeYms.length - 1] : null;
    const window12 = completeYms.slice(-USUAL_MONTHS);

    const catNames = [...new Set(items.filter((it) => trackedSet.has(it.ym)).map((it) => it.category))];
    const fixedOf = (cat) => isFixed(cat, o.fixed);
    const income = o.incomeByMonth || {};

    const monthRows = tracked.months.map((ym) => {
      const mine = items.filter((it) => it.ym === ym);
      const byCategory = {};
      let fixed = 0;
      for (const it of mine) { byCategory[it.category] = (byCategory[it.category] || 0) + it.amount; if (fixedOf(it.category)) fixed += it.amount; }
      const total = totals[ym];
      const pay = income[shiftYm(ym, -1)];
      const hasPay = Number.isFinite(pay) && pay > 0;
      return {
        ym, total, byCategory, fixed, flexible: total - fixed, partial: ym === partialYm,
        pay: hasPay ? pay : null,
        saved: hasPay ? pay - total : null,
        savingsRatePct: hasPay ? ((pay - total) / pay) * 100 : null,
      };
    });
    const rowOf = new Map(monthRows.map((r) => [r.ym, r]));

    // unusual items, judged against the category's own usual payment
    const norms = lastComplete ? categoryNorms(items.filter((it) => trackedSet.has(it.ym)), lastComplete) : new Map();
    const unusualItems = [];
    for (const it of items) {
      if (!trackedSet.has(it.ym) || it.amount < ITEM_FLOOR) continue;
      const norm = norms.get(it.category);
      const usual = norm && norm.count >= ITEM_HISTORY_MIN ? norm.median : null;
      if (usual === null || it.amount >= usual * ITEM_TIMES) {
        unusualItems.push({ id: it.id || null, ym: it.ym, date: it.date, category: it.category, amount: it.amount, note: it.note || "", paidBy: it.paidBy, usual });
      }
    }
    unusualItems.sort((a, b) => b.amount - a.amount);
    const unusualByMonth = new Map();
    for (const u of unusualItems) unusualByMonth.set(u.ym, (unusualByMonth.get(u.ym) || 0) + u.amount);

    // unusual months: well above the usual month, with how much the unusual items explain
    for (const r of monthRows) {
      const before = completeYms.filter((ym) => ymIndex(ym) < ymIndex(r.ym)).slice(-USUAL_MONTHS).map((ym) => totals[ym]);
      r.usualTotal = before.length >= USUAL_MIN ? median(before) : null;
      r.unusual = !r.partial && r.usualTotal !== null && r.total >= r.usualTotal * UNUSUAL_MONTH;
      r.unusualItemsTotal = unusualByMonth.get(r.ym) || 0;
      r.everydayTotal = r.total - r.unusualItemsTotal;
      r.savingsRateEveryday = r.pay !== null ? ((r.pay - r.everydayTotal) / r.pay) * 100 : null;
    }

    // savings across the last twelve complete months
    const rated = window12.map((ym) => rowOf.get(ym)).filter((r) => r.pay !== null);
    const sumPay = rated.reduce((t, r) => t + r.pay, 0), sumSpent = rated.reduce((t, r) => t + r.total, 0);
    const savings = {
      months: rated.length,
      ratePct: rated.length ? ((sumPay - sumSpent) / sumPay) * 100 : null,
      typicalPct: rated.length ? median(rated.map((r) => r.savingsRatePct)) : null,
      saved: rated.length ? sumPay - sumSpent : null,
      pay: rated.length ? sumPay : null,
      spent: rated.length ? sumSpent : null,
      best: rated.length ? rated.reduce((b, r) => (r.savingsRatePct > b.savingsRatePct ? r : b)).ym : null,
      worst: rated.length ? rated.reduce((b, r) => (r.savingsRatePct < b.savingsRatePct ? r : b)).ym : null,
      overspent: rated.filter((r) => r.saved < 0).length,
    };

    // categories: twelve-month total and share, and the last six months against the six before
    const total12 = window12.reduce((t, ym) => t + totals[ym], 0);
    const last6 = window12.slice(-6), prev6 = window12.slice(-12, -6);
    const categories = catNames.map((name) => {
      const series = window12.map((ym) => rowOf.get(ym).byCategory[name] || 0);
      const total = series.reduce((t, v) => t + v, 0);
      const sum6 = (yms) => yms.reduce((t, ym) => t + (rowOf.get(ym).byCategory[name] || 0), 0);
      const recent = last6.length === 6 ? sum6(last6) / 6 : null;
      const before = prev6.length === 6 ? sum6(prev6) / 6 : null;
      return {
        name, fixed: fixedOf(name), total, sharePct: total12 ? (total / total12) * 100 : 0,
        monthlyAvg: window12.length ? total / window12.length : 0, series,
        recentAvg: recent, beforeAvg: before, changePct: recent !== null && before ? pct(before, recent) : null,
      };
    }).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
    const movers = categories.filter((c) => c.changePct !== null && Math.abs(c.recentAvg - c.beforeAvg) >= 500);
    const risers = movers.filter((c) => c.changePct > 0).sort((a, b) => (b.recentAvg - b.beforeAvg) - (a.recentAvg - a.beforeAvg)).slice(0, 3);
    const fallers = movers.filter((c) => c.changePct < 0).sort((a, b) => (a.recentAvg - a.beforeAvg) - (b.recentAvg - b.beforeAvg)).slice(0, 3);

    const fixed12 = window12.reduce((t, ym) => t + rowOf.get(ym).fixed, 0);
    const fixedFlexible = {
      fixed: fixed12, flexible: total12 - fixed12,
      fixedSharePct: total12 ? (fixed12 / total12) * 100 : null,
      fixedMonthly: window12.length ? fixed12 / window12.length : null,
      flexibleMonthly: window12.length ? (total12 - fixed12) / window12.length : null,
    };

    // budgets: this month so far (or the latest complete month when the current month has no spending yet)
    const budgets = [];
    const budgetMonth = partialYm || lastComplete;
    const day = partialYm && today.length >= 10 ? Number(today.slice(8, 10)) : null;
    const budgetSet = o.budgets || {};
    if (budgetMonth) {
      const span = [1, 2, 3].map((n) => shiftYm(budgetMonth, -n)).filter((ym) => rowOf.has(ym) && ym !== partialYm);
      for (const [name, raw] of Object.entries(budgetSet)) {
        const budget = num(raw);
        if (!(budget > 0)) continue;
        const spent = rowOf.get(budgetMonth).byCategory[name] || 0;
        const projected = partialYm && day >= PACE_FROM_DAY ? (spent * daysInMonth(partialYm)) / day : null;
        const usedPct = (spent / budget) * 100;
        let status = "ok";
        if (spent > budget) status = "over";
        else if (projected !== null && projected > budget) status = "pace";
        else if (spent >= budget * NEAR_SHARE) status = "near";
        const history = span.map((ym) => ({ ym, spent: rowOf.get(ym).byCategory[name] || 0 }));
        budgets.push({
          name, budget, spent, usedPct, projected, status, month: budgetMonth, partial: Boolean(partialYm), history,
          hits: history.filter((h) => h.spent <= budget).length,
        });
      }
      budgets.sort((a, b) => b.usedPct - a.usedPct);
    }
    const suggestions = {};
    for (const c of categories) {
      const last3 = window12.slice(-3).map((ym) => rowOf.get(ym).byCategory[c.name] || 0);
      if (last3.length === 3) suggestions[c.name] = Math.round(last3.reduce((t, v) => t + v, 0) / 3 / 500) * 500;
    }

    // who paid
    const people = {};
    for (const it of items) {
      if (!window12.includes(it.ym)) continue;
      const p = (people[it.paidBy] = people[it.paidBy] || { person: it.paidBy, total: 0, count: 0, byCategory: {}, series: window12.map(() => 0) });
      p.total += it.amount; p.count += 1;
      p.byCategory[it.category] = (p.byCategory[it.category] || 0) + it.amount;
      p.series[window12.indexOf(it.ym)] += it.amount;
    }
    const paidBy = Object.values(people).map((p) => ({
      ...p, sharePct: total12 ? (p.total / total12) * 100 : 0,
      top: Object.entries(p.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, value]) => ({ name, value })),
    })).sort((a, b) => b.total - a.total);

    return {
      tracked: { start: tracked.start, latest: latestYm, partial: partialYm, count: tracked.months.length, complete: completeYms.length, notTracked: Object.keys(totals).filter((ym) => !trackedSet.has(ym)).sort() },
      months: monthRows, window: window12, total12, usualMonth: window12.length >= USUAL_MIN ? median(window12.map((ym) => totals[ym])) : null,
      savings, categories, risers, fallers, fixedFlexible,
      budgets, budgetMonth, suggestions, unusualItems, paidBy,
    };
  }

  return {
    RAMP_SHARE, USUAL_MONTHS, USUAL_MIN, UNUSUAL_MONTH, ITEM_FLOOR, ITEM_TIMES, ITEM_HISTORY_MIN, NEAR_SHARE, PACE_FROM_DAY,
    median, shiftYm, daysInMonth, isFixed, trackedMonths, categoryNorms, analyze,
  };
});
