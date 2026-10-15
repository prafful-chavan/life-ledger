/**
 * Life Ledger — built-in knowledge modules for Hey Prafful (pure builders + registration).
 * These give whole-history briefings that would be tedious to assemble from raw queries.
 * Anything not covered here is still reachable through the generic query_data tool.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerKnowledgeModules = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const inr = (v) => "₹" + Math.round(num(v)).toLocaleString("en-IN");
  const day = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

  /** Income / expenses / savings for EVERY month and year on record, with category and person splits. */
  function cashflowHistory(state) {
    const months = new Map();
    const get = (m) => { if (!months.has(m)) months.set(m, { income: 0, expenses: 0, cats: {}, who: {} }); return months.get(m); };
    (state.income || []).forEach((x) => { const d = day(x.date); if (d) get(d.slice(0, 7)).income += num(x.amount); });
    (state.expenses || []).forEach((x) => {
      const d = day(x.date); if (!d) return;
      const m = get(d.slice(0, 7));
      m.expenses += num(x.amount);
      const c = x.category || "General"; m.cats[c] = (m.cats[c] || 0) + num(x.amount);
      const w = x.paidBy || "Both"; m.who[w] = (m.who[w] || 0) + num(x.amount);
    });
    const keys = [...months.keys()].sort();
    if (!keys.length) return "No income or expense history recorded.";
    const years = {};
    keys.forEach((k) => {
      const y = k.slice(0, 4); const m = months.get(k);
      const Y = (years[y] = years[y] || { income: 0, expenses: 0, months: 0, cats: {}, who: {} });
      Y.income += m.income; Y.expenses += m.expenses; Y.months++;
      Object.entries(m.cats).forEach(([c, v]) => { Y.cats[c] = (Y.cats[c] || 0) + v; });
      Object.entries(m.who).forEach(([w, v]) => { Y.who[w] = (Y.who[w] || 0) + v; });
    });
    const L = [`CASH-FLOW HISTORY (${keys[0]} to ${keys[keys.length - 1]}, ${keys.length} months of data)`, "", "YEARLY:"];
    Object.entries(years).forEach(([y, v]) => {
      const top = Object.entries(v.cats).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c, a]) => `${c} ${inr(a)}`).join(", ");
      const who = Object.entries(v.who).map(([w, a]) => `${w} ${inr(a)}`).join(", ");
      L.push(`- ${y}: income ${inr(v.income)}, expenses ${inr(v.expenses)} over ${v.months} months (avg ${inr(v.expenses / v.months)}/month), saved ${inr(v.income - v.expenses)} (${pct(v.income - v.expenses, v.income)}%). Top categories: ${top}. By payer: ${who}.`);
    });
    L.push("", "MONTHLY (income / expenses / saved):");
    keys.forEach((k) => { const m = months.get(k); L.push(`${k}: ${inr(m.income)} / ${inr(m.expenses)} / ${inr(m.income - m.expenses)}`); });
    return L.join("\n");
  }

  /** Every net-worth record condensed: totals, extremes, month-end series, growth. */
  function networthHistory(state) {
    const h = (state.netWorthHistory || []).filter((x) => day(x.date)).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    if (!h.length) return "No net worth records yet.";
    const first = h[0], last = h[h.length - 1];
    const L = [`NET WORTH HISTORY: ${h.length} daily records from ${first.date} to ${last.date}.`];
    L.push(`First ${inr(first.netWorth)}; latest ${inr(last.netWorth)}; change ${inr(last.netWorth - first.netWorth)} (${pct(last.netWorth - first.netWorth, Math.abs(first.netWorth))}%).`);
    const peak = h.reduce((m, x) => (x.netWorth > m.netWorth ? x : m), h[0]);
    const low = h.reduce((m, x) => (x.netWorth < m.netWorth ? x : m), h[0]);
    L.push(`Peak ${inr(peak.netWorth)} on ${peak.date}; lowest ${inr(low.netWorth)} on ${low.date}.`);
    const years = (new Date(last.date) - new Date(first.date)) / (365.25 * 86400000);
    if (years >= 0.5 && first.netWorth > 0 && last.netWorth > 0) L.push(`Compound annual growth of net worth over this period: ${Math.round((Math.pow(last.netWorth / first.netWorth, 1 / years) - 1) * 1000) / 10}%.`);
    let up = null, down = null;
    for (let i = 1; i < h.length; i++) {
      const d = h[i].netWorth - h[i - 1].netWorth;
      if (!up || d > up.d) up = { d, date: h[i].date };
      if (!down || d < down.d) down = { d, date: h[i].date };
    }
    if (up) L.push(`Biggest rise between records: ${inr(up.d)} (${up.date}); biggest fall: ${inr(down.d)} (${down.date}).`);
    const byMonth = new Map();
    h.forEach((x) => byMonth.set(x.date.slice(0, 7), x));
    L.push("", "MONTH-END NET WORTH (net worth / assets / liabilities):");
    [...byMonth.entries()].forEach(([m, x]) => L.push(`${m}: ${inr(x.netWorth)} / ${inr(x.totalAssets)} / ${inr(x.totalLiabilities)}`));
    return L.join("\n");
  }

  /** Exercise consistency from workouts + activities: active days, streaks, monthly volume, mix. */
  function fitnessOverview(state, todayISO) {
    const rows = [...(state.workouts || []).map((x) => ({ d: day(x.date), t: x.type || "Workout", min: num(x.minutes) })),
      ...(state.activities || []).map((x) => ({ d: day(x.date), t: x.type || "Activity", min: num(x.durationMin) }))].filter((x) => x.d);
    if (!rows.length) return "No exercise or activity history recorded.";
    const days = [...new Set(rows.map((r) => r.d))].sort();
    let best = 1, run = 1, bestEnd = days[0];
    for (let i = 1; i < days.length; i++) {
      const gap = (new Date(days[i]) - new Date(days[i - 1])) / 86400000;
      run = gap === 1 ? run + 1 : 1;
      if (run > best) { best = run; bestEnd = days[i]; }
    }
    const today = todayISO || days[days.length - 1];
    let cur = 0, cursor = new Date(today + "T00:00:00Z");
    const set = new Set(days);
    if (!set.has(cursor.toISOString().slice(0, 10))) cursor.setUTCDate(cursor.getUTCDate() - 1);
    while (set.has(cursor.toISOString().slice(0, 10))) { cur++; cursor.setUTCDate(cursor.getUTCDate() - 1); }
    const byMonth = {}, byType = {};
    rows.forEach((r) => { const m = r.d.slice(0, 7); (byMonth[m] = byMonth[m] || { days: new Set(), min: 0 }); byMonth[m].days.add(r.d); byMonth[m].min += r.min; byType[r.t] = (byType[r.t] || 0) + 1; });
    const L = [`EXERCISE OVERVIEW: ${rows.length} sessions on ${days.length} distinct days, ${days[0]} to ${days[days.length - 1]}.`,
      `Current streak ${cur} day(s); longest streak ${best} day(s) (ending ${bestEnd}).`,
      `Mix: ${Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(", ")}.`, "", "ACTIVE DAYS / MINUTES PER MONTH:"];
    Object.keys(byMonth).sort().forEach((m) => L.push(`${m}: ${byMonth[m].days.size} days, ${Math.round(byMonth[m].min)} min`));
    return L.join("\n");
  }

  /** Registers the built-in modules; `portfolioBuild` comes from the advisor (kept optional). */
  function register(K, getToday, portfolioBuild) {
    K.registerModule({ id: "cashflow_history", title: "Cash-flow history", description: "income, expenses and savings for every month and year, with category and payer splits", build: (s) => cashflowHistory(s) });
    K.registerModule({ id: "networth_history", title: "Net worth history", description: "all net worth records: growth, peak, lowest, month-end series", build: (s) => networthHistory(s) });
    K.registerModule({ id: "fitness_overview", title: "Exercise overview", description: "workout/activity consistency: streaks, active days per month, mix", build: (s) => fitnessOverview(s, getToday && getToday()) });
    if (portfolioBuild) K.registerModule({ id: "portfolio", title: "Portfolio analysis", description: "holdings with returns/XIRR/trend, advisor signals, allocation vs target, emergency fund, debts, goals, projections", build: (s) => portfolioBuild(s) });
  }

  return { cashflowHistory, networthHistory, fitnessOverview, register };
});
