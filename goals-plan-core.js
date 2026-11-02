/**
 * Goal planning, pure (no page, no clock, no storage): what each money goal needs per day, what the household must earn per day
 * to fund all of them on their dates, and the import of the goals written in the household's salary sheet ("Our Goals - Needs").
 *
 * A goal may carry a `kind`: "save" (default; a pile of money by a date), "networth" (follows holdings, the big portfolio
 * target), "income" (target is a monthly or yearly income, not a pile) or "score" (no money; progress is typed in 0-100).
 * Only "save" and "networth" goals with an amount and a due date ask for money; the other two are listed, never added in.
 *
 * Numbers that are not in the household's own data are never made up: growth on the portfolio is 0 unless the household
 * sets it, and a goal with no amount is reported as "needs an amount" instead of being counted as zero.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerGoalsPlan = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const MONTH_DAYS = 30.4375, YEAR_DAYS = 365.25, DAY = 86400000;
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const iso = (s) => (/^\d{4}-\d{2}-\d{2}/.test(String(s || "")) ? String(s).slice(0, 10) : null);
  const dayNumber = (s) => { const d = iso(s); if (!d) return null; const t = Date.parse(d + "T00:00:00Z"); return Number.isFinite(t) ? t / DAY : null; };

  function kindOf(goal) {
    const k = goal && goal.kind;
    return k === "income" || k === "score" || k === "networth" ? k : "save";
  }
  const isMoney = (goal) => { const k = kindOf(goal); return k === "save" || k === "networth"; };

  /** Whole days from `today` to the due date; null with no usable date; 0 or below means it is due now or late. */
  function daysLeft(dueDate, today) {
    const a = dayNumber(dueDate), b = dayNumber(today);
    return a == null || b == null ? null : Math.round(a - b);
  }

  /**
   * What one money goal needs. `growthPct` (yearly) is used only for "networth" goals: what is held today grows, and the
   * regular saving needed is what the growth does not cover. Everything else needs the plain remainder spread over the days.
   */
  function perDay(goal, today, opts) {
    const g = goal || {}, growth = Math.max(0, num(opts && opts.growthPct));
    const target = num(g.target), saved = Math.max(0, num(g.saved));
    if (!isMoney(g) || !(target > 0)) return { counted: false, needsAmount: isMoney(g) && !(target > 0), remaining: 0, done: false, days: null, perDay: null, perMonth: null };
    const days = daysLeft(g.dueDate, today);
    const grows = kindOf(g) === "networth" && growth > 0 && days != null && days > 0;
    const future = grows ? saved * Math.pow(1 + growth / 100, days / YEAR_DAYS) : saved;
    const remaining = Math.max(0, Math.round(target - future));
    if (remaining === 0) return { counted: true, remaining: 0, done: true, days, perDay: 0, perMonth: 0 };
    if (days == null) return { counted: false, needsDate: true, remaining, done: false, days: null, perDay: null, perMonth: null };
    if (days <= 0) return { counted: true, remaining, done: false, overdue: true, days: 0, perDay: remaining, perMonth: remaining };
    let monthly;
    if (grows) {
      const r = Math.pow(1 + growth / 100, 1 / 12) - 1, n = days / MONTH_DAYS;
      monthly = (remaining * r) / (Math.pow(1 + r, n) - 1);
    } else monthly = (remaining / days) * MONTH_DAYS;
    return { counted: true, remaining, done: false, days, perDay: Math.ceil(monthly / MONTH_DAYS), perMonth: Math.ceil(monthly) };
  }

  /**
   * All goals together. `takeHomeMonthly` is what the household takes home in a month and `spendMonthly` what it spends (both
   * from the household's own payslips and expenses). The save-per-day figure is what the goals ask for; the earn-per-day figure
   * is that plus what already goes on living costs, set against what comes in today.
   */
  function plan(goals, today, opts) {
    const o = opts || {};
    const items = [], needsAmount = [], needsDate = [], notMoney = [];
    for (const g of goals || []) {
      if (!isMoney(g)) { notMoney.push({ id: g.id, name: g.name, kind: kindOf(g) }); continue; }
      const p = perDay(g, today, o);
      const row = { id: g.id, name: g.name, kind: kindOf(g), dueDate: g.dueDate || null, ...p };
      if (p.needsAmount) needsAmount.push(row);
      else if (p.needsDate) needsDate.push(row);
      else items.push(row);
    }
    const open = items.filter((x) => !x.done);
    const savePerMonth = open.reduce((s, x) => s + x.perMonth, 0);
    const savePerDay = open.reduce((s, x) => s + x.perDay, 0);
    const totalRemaining = open.reduce((s, x) => s + x.remaining, 0);
    const take = Math.max(0, num(o.takeHomeMonthly)), spend = Math.max(0, num(o.spendMonthly));
    const haveInputs = take > 0 && spend > 0;
    const needMonthly = spend + savePerMonth;
    const canSaveMonthly = haveInputs ? Math.max(0, take - spend) : null;
    return {
      items: items.sort((a, b) => (b.perDay || 0) - (a.perDay || 0)),
      needsAmount, needsDate, notMoney,
      savePerDay, savePerMonth, totalRemaining,
      earn: !haveInputs ? null : {
        needPerDay: Math.ceil(needMonthly / MONTH_DAYS), needPerMonth: Math.ceil(needMonthly),
        havePerDay: Math.round(take / MONTH_DAYS), havePerMonth: Math.round(take),
        spendPerDay: Math.round(spend / MONTH_DAYS), spendPerMonth: Math.round(spend),
        gapPerDay: Math.max(0, Math.ceil(needMonthly / MONTH_DAYS) - Math.round(take / MONTH_DAYS)),
        canSavePerMonth: Math.round(canSaveMonthly),
        // how long everything would take if the household kept saving what it saves now (no growth), in years
        yearsAtCurrentSaving: totalRemaining > 0 && canSaveMonthly > 0 ? Math.round((totalRemaining / (canSaveMonthly * 12)) * 10) / 10 : null,
        coveragePct: savePerMonth > 0 ? Math.min(100, Math.round((canSaveMonthly / savePerMonth) * 100)) : 100,
      },
    };
  }

  // ── the goals written in the household's salary sheet ("Our Goals - Needs"), added once ──────────────────────────────
  const BY = "2030-12-31";   // the sheet's heading: "Goal complete by 2030"
  const L = 100000, CR = 10000000;
  const SHEET_GOALS = [
    // health, family and personal: no money, progress typed in
    { key: "health-family", name: "Good health for all my family", category: "Health", owner: "Both", kind: "score" },
    { key: "weight-prafful", name: "Weight 70 kg (Prafful)", category: "Health", owner: "Me", kind: "score" },
    { key: "weight-archana", name: "Weight 42 kg (Archana)", category: "Health", owner: "Wife", kind: "score" },
    { key: "hair-face", name: "Good hair and face for both", category: "Health", owner: "Both", kind: "score" },
    { key: "healthy-food", name: "Focus on healthy food", category: "Health", owner: "Both", kind: "score" },
    { key: "love-less-fights", name: "More love, less fights", category: "Family", owner: "Both", kind: "score" },
    { key: "time-family", name: "More time for mummy, papa and didi", category: "Family", owner: "Both", kind: "score" },
    { key: "personality", name: "Personality development for both", category: "Personal", owner: "Both", kind: "score" },
    { key: "communication", name: "Communication skills for both", category: "Personal", owner: "Both", kind: "score" },
    { key: "ai-ml", name: "AI/ML knowledge and projects for both", category: "Career", owner: "Both", kind: "score" },
    { key: "freelancing", name: "Freelancing work for both", category: "Career", owner: "Both", kind: "score" },
    // income targets: the target is a monthly or yearly income, not a pile of money
    { key: "archana-salary", name: "Archana: next job switch at ₹20 lakh a year", category: "Career", owner: "Wife", kind: "income", target: 20 * L },
    { key: "archana-business", name: "Archana: business income ₹4 lakh a month", category: "Career", owner: "Wife", kind: "income", target: 4 * L },
    { key: "prafful-business", name: "Prafful: part-time business ₹1 lakh a month", category: "Career", owner: "Me", kind: "income", target: 1 * L },
    // money goals; the amounts are the household's planning estimates (editable in the app), not quotes
    { key: "portfolio-20cr", name: "₹20 Cr portfolio by the end of 2030", category: "Finance", owner: "Both", kind: "networth", track: "All my assets", target: 20 * CR },
    { key: "farmhouse", name: "Farmhouse (land and construction)", category: "Finance", owner: "Both", target: 2 * CR },
    { key: "farm-5-acre", name: "5 acre farm", category: "Finance", owner: "Both", target: 1.5 * CR },
    { key: "range-rover", name: "Range Rover", category: "Finance", owner: "Both", target: 1 * CR },
    { key: "plots-4", name: "4 plots in different cities", category: "Finance", owner: "Both", target: 1.2 * CR },
    { key: "interiors", name: "Home interiors for the farmhouse and the flat", category: "Finance", owner: "Both", target: 35 * L },
    { key: "luxury-watch", name: "1 luxury watch", category: "Finance", owner: "Me", target: 8 * L },
    { key: "home-theater", name: "Proper home theater", category: "Finance", owner: "Both", target: 3 * L },
    { key: "gaming", name: "Gaming controller setup", category: "Finance", owner: "Me", target: 1.5 * L },
    { key: "trips-intl", name: "2 international trips (Dubai and one more)", category: "Travel", owner: "Both", target: 8 * L },
    { key: "trips-india", name: "11 small trips in India", category: "Travel", owner: "Both", target: 6.5 * L },
    { key: "clothes-watches", name: "Good clothes for both and 7 watches for Archana", category: "Personal", owner: "Both", target: 4 * L },
    { key: "ring", name: "Ring gift for Archana", category: "Personal", owner: "Me", target: 1.5 * L },
    { key: "shoes", name: "2 proper pairs of shoes for both", category: "Personal", owner: "Both", target: 0.3 * L },
  ];
  /** The sheet's "1 proper flat 4bhk in Pune" is the app's existing "Home" goal; its target is raised to this. */
  const HOME_TARGET = 3 * CR;
  const isHome = (g) => /^\s*home\s*$/i.test(String(g && g.name || ""));

  /**
   * What importing the sheet would do to the goals already there: add what is missing, raise "Home" to the flat's price once.
   * Safe to run twice: a goal carrying the sheet key, or already having the same name, is left alone.
   */
  function planSheetImport(existing, today, idMaker) {
    const have = existing || [];
    const keys = new Set(have.map((g) => g && g.sheetKey).filter(Boolean));
    const names = new Set(have.map((g) => String(g && g.name || "").trim().toLowerCase()));
    const make = idMaker || ((k) => "sheet-" + k);
    const add = [], update = [], skipped = [];
    for (const s of SHEET_GOALS) {
      if (keys.has("sheet:" + s.key) || names.has(s.name.toLowerCase())) { skipped.push(s.name); continue; }
      const { key, ...rest } = s;
      add.push({ id: make(key), ...rest, saved: 0, dueDate: BY, sheetKey: "sheet:" + key, ...(rest.kind === "score" ? { target: 100 } : {}) });
    }
    const home = have.find((g) => isHome(g) && !g.sheetKey);
    if (home && num(home.target) < HOME_TARGET) update.push({ id: home.id, name: home.name, from: num(home.target), changes: { target: HOME_TARGET, sheetKey: "sheet:home" } });
    else if (!home && !have.some((g) => g && g.sheetKey === "sheet:home") && !names.has("home")) {
      add.push({ id: make("home"), name: "Home", category: "Finance", owner: "Both", target: HOME_TARGET, saved: 0, dueDate: "2028-05-26", sheetKey: "sheet:home" });
    }
    return { add, update, skipped };
  }

  return { MONTH_DAYS, kindOf, isMoney, daysLeft, perDay, plan, SHEET_GOALS, HOME_TARGET, planSheetImport };
});
