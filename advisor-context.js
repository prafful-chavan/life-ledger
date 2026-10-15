/**
 * Life Ledger — "portfolio intelligence" briefing for the Hey Prafful chat agent (pure).
 * Everything numeric is computed here; the model only reads and explains it.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerAdvisorContext = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const inr = (v) => "₹" + Math.round(num(v)).toLocaleString("en-IN");
  const pc = (v) => (v == null ? "n/a" : (v >= 0 ? "+" : "") + v + "%");
  const r1 = (v) => Math.round(v * 10) / 10;

  /** Future value of a lump sum plus monthly contributions (illustrative, not a forecast). */
  function projection(portfolio, monthly, ratePct, years) {
    const r = ratePct / 100;
    const m = r / 12;
    const lump = portfolio * Math.pow(1 + r, years);
    const sip = m > 0 ? monthly * ((Math.pow(1 + m, years * 12) - 1) / m) : monthly * years * 12;
    return Math.round(lump + sip);
  }

  function build({ result, input, extras, review }) {
    if (!result || !input) return "";
    const L = [];
    const m = result.metrics;
    L.push(`=== PORTFOLIO INTELLIGENCE (computed by the app from live prices; as of ${result.asOf}) ===`);
    L.push("Definitions: weight = % of the investable portfolio; return = vs cost; XIRR = annualised return on dated cash flows (mutual funds only); drawdown = distance below the 52-week high; vs Nifty = 1-year return minus Nifty's; confidence reflects how much price history exists.");

    L.push(`\nPORTFOLIO: value ${inr(m.total)}, invested ${inr(m.invested)}, overall return ${pc(m.returnPct)}, ${m.positions} positions, top-5 holdings = ${m.top5Weight}% of portfolio, health score ${result.score}/100.`);
    const a = m.allocation, t = m.target;
    L.push(`ALLOCATION vs TARGET: equity ${a.equity}% (target ${t.equity}%), gold ${a.gold}% (${t.gold}%), debt ${a.debt}% (${t.debt}%), cash ${a.cash}% (${t.cash}%), other ${a.other}%.`);
    if (m.emergencyMonths != null) L.push(`EMERGENCY FUND: liquid savings cover ${m.emergencyMonths} months of expenses (target ${(input.profile && input.profile.emergencyMonths) || 6}).`);
    if (m.savingsRate != null) L.push(`SAVINGS RATE (6-month average): ${m.savingsRate}%.`);

    const hs = (result.holdings || []).slice().sort((x, y) => y.value - x.value).slice(0, 40);
    L.push("\nHOLDINGS (top 40 by value): name | class/kind | value | weight | invested | return | XIRR | 1m / 3m / 6m / 1y | drawdown | vs Nifty 1y | history days");
    hs.forEach((h) => {
      L.push(`- ${h.name} | ${h.cls}/${h.kind} | ${inr(h.value)} | ${h.weight}% | ${inr(h.invested)} | ${pc(h.returnPct)} | ${h.xirr != null ? pc(h.xirr) : "n/a"} | ${[h.r1m, h.r3m, h.r6m, h.r1y].map((v) => (v == null ? "n/a" : pc(v))).join(" / ")} | ${h.drawdown != null ? h.drawdown + "%" : "n/a"} | ${h.vs1yBenchmark != null ? (h.vs1yBenchmark >= 0 ? "+" : "") + h.vs1yBenchmark + "pp" : "n/a"} | ${h.historyDays}`);
    });
    if ((result.holdings || []).length > hs.length) L.push(`(+${result.holdings.length - hs.length} smaller positions not listed)`);

    L.push("\nADVISOR SIGNALS (rule-based; use these ids when explaining):");
    (result.signals || []).forEach((s) => L.push(`- [${s.severity.toUpperCase()}] ${s.action}: ${s.title} (id ${s.id}, confidence ${s.confidence}) — ${(s.why || []).join(" ")}`));
    if (!(result.signals || []).length) L.push("- none right now");

    if (review && review.headline) {
      L.push(`\nLATEST AI REVIEW: ${review.headline}`);
      (review.actions || []).forEach((x) => L.push(`- (${x.priority}) ${x.action} ${x.asset}: ${x.summary}`));
    }

    const c = input.cash || {};
    L.push(`\nCASH FLOW (6-month average): income ${inr(c.monthlyIncome)}/month, expenses ${inr(c.monthlyExpenses)}/month. Largest recurring spends: ${(c.topCategories || []).map(([k, v]) => `${k} ${inr(v)}`).join(", ") || "n/a"}.`);

    if (extras && extras.monthly) {
      L.push("MONTHLY TREND (income / expenses / saved; last 12 months, current month is partial):");
      extras.monthly.forEach((x) => {
        const who = Object.entries(x.expensesByOwner || {}).map(([k, v]) => `${k} ${inr(v)}`).join(", ");
        L.push(`- ${x.month}${x.partial ? " (so far)" : ""}: ${inr(x.income)} / ${inr(x.expenses)} / ${inr(x.saved)}${who ? ` | spent by: ${who}` : ""}`);
      });
      if (extras.thisMonthCategories && extras.thisMonthCategories.length) L.push(`THIS MONTH BY CATEGORY: ${extras.thisMonthCategories.map(([k, v]) => `${k} ${inr(v)}`).join(", ")}.`);
      const sip = extras.sipThisMonth || {};
      const tg = extras.sipTargets || {};
      L.push(`SIP THIS MONTH: Me ${inr(sip.Me)} of ${inr(tg.Me)}, Wife ${inr(sip.Wife)} of ${inr(tg.Wife)}.`);
    }

    const debts = input.liabilities || [];
    if (debts.length) {
      const emi = debts.reduce((s, d) => s + num(d.emi), 0);
      L.push(`\nLIABILITIES: total ${inr(debts.reduce((s, d) => s + num(d.value), 0))}; monthly EMI ${inr(emi)}${c.monthlyIncome ? ` (${r1((emi / c.monthlyIncome) * 100)}% of income)` : ""}.`);
      debts.forEach((d) => L.push(`- ${d.name} (${d.owner}): outstanding ${inr(d.value)}, EMI ${inr(d.emi)}, rate ${d.rate ? d.rate + "%" : "unknown"}${d.rate ? `, interest ≈ ${inr((d.value * d.rate) / 100)}/year` : ""}`));
    }

    if ((input.goals || []).length) {
      L.push("\nGOALS:");
      input.goals.forEach((g) => {
        const need = num(g.target) - num(g.saved);
        const months = g.dueDate ? Math.round((new Date(g.dueDate) - new Date(result.asOf)) / (30.44 * 86400000)) : null;
        L.push(`- ${g.name}: ${inr(g.saved)} of ${inr(g.target)} (${need > 0 ? inr(need) + " to go" : "reached"})${months != null ? `, due ${g.dueDate} (${months} months)` : ""}${need > 0 && months > 0 ? `, needs ≈ ${inr(need / months)}/month` : ""}`);
      });
    }

    if (extras && extras.nwHistory && extras.nwHistory.length) {
      const h = extras.nwHistory;
      const pick = (days) => h.find((x) => (new Date(h[0].date) - new Date(x.date)) / 86400000 >= days);
      const d7 = pick(7), d30 = pick(28);
      L.push(`\nNET WORTH RECORDS (newest first; ${h.length} shown): ` + h.slice(0, 10).map((x) => `${x.date} ${inr(x.netWorth)}`).join("; ") + ".");
      if (d7) L.push(`Net worth change vs ${d7.date}: ${inr(h[0].netWorth - d7.netWorth)}.`);
      if (d30) L.push(`Net worth change vs ${d30.date}: ${inr(h[0].netWorth - d30.netWorth)}.`);
    }

    const p = input.profile || {};
    const monthly = num(p.monthlyInvestable) || num(p.sipTarget) || num(c.monthlyIncome) - num(c.monthlyExpenses);
    if (m.total > 0 || monthly > 0) {
      L.push(`\nILLUSTRATIVE PROJECTION (not a forecast): starting ${inr(m.total)} with ${inr(Math.max(0, monthly))}/month invested. Future value of the portfolio at assumed annual returns:`);
      [8, 10, 12].forEach((r) => L.push(`- at ${r}%: ` + [5, 10, 15, 20].map((y) => `${y}y ${inr(projection(m.total, Math.max(0, monthly), r, y))}`).join(", ")));
    }

    L.push(`\nPROFILE: risk ${p.risk || "n/a"}, horizon ${p.horizonYears || "n/a"} years, monthly investable ${inr(p.monthlyInvestable)}, SIP target ${inr(p.sipTarget)}.`);
    return L.join("\n");
  }

  return { build, projection };
});
