/**
 * Life Ledger — "How was this calculated?" (pure builders, UMD).
 *
 * Each builder turns the figures a screen already shows into the steps behind them: what each line is, where it
 * came from, and the result. Every builder checks that its own lines add up to the result it explains; if they do
 * not, the explanation says so instead of hiding it (`check.ok === false`), so a wrong figure cannot look explained.
 * Line: { label, value (₹ number or text), note?, sign?: "+"|"−"|"=" }
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerExplain = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const sumOf = (lines) => lines.reduce((t, l) => t + (l.sign === "−" ? -num(l.value) : l.sign === "+" || !l.sign ? num(l.value) : 0), 0);
  const checked = (lines, result, tolerance = 1) => {
    const total = sumOf(lines);
    return { ok: Math.abs(total - num(result)) <= tolerance, total, result: num(result) };
  };

  const CLASSES = [["Mutual funds", "mutualFunds", true], ["Indian shares & ETFs", "stocks", true], ["US shares", "usStocks", true], ["Gold", "gold", true],
    ["Silver", "silver"], ["Crypto", "crypto"], ["Fixed deposits", "fd"], ["EPF", "epf"], ["PPF", "ppf"], ["Bonds", "bonds"], ["Bank savings", "bankSaving"], ["Others (incl. vehicles)", "others"]];

  /** Net worth from today's record: each class, how it was priced, minus what is owed. */
  function netWorth(snap, opts = {}) {
    const time = opts.timeOf || ((iso) => String(iso || "").slice(11, 16));
    const lines = [];
    for (const [label, key, market] of CLASSES) {
      const v = num(snap[key]);
      if (!v) continue;
      let note = "";
      if (market) note = snap.settled && snap.settled[key] ? `locked at the official close${snap.asOf && snap.asOf[key] ? ` (prices of ${time(snap.asOf[key])})` : ""}` : "live prices";
      if (key === "usStocks" && snap.fxRate) note += ` · at ₹${num(snap.fxRate).toFixed(2)} a dollar`;
      lines.push({ label, value: v, note, sign: "+" });
    }
    const owed = num(snap.liabilities != null ? snap.liabilities : snap.totalLiabilities);
    if (owed) lines.push({ label: "Loans and dues", value: owed, sign: "−", note: "what is still owed" });
    return { title: "Net worth", formula: "Everything you own − everything you owe", lines, result: { label: "Net worth", value: num(snap.netWorth) }, check: checked(lines, snap.netWorth) };
  }

  /**
   * Savings rate: the salary that pays this month's spending, minus the spending so far.
   * salaryRows: [{ who, date, amount }]; spent: ₹; count: number of expense rows
   */
  function savings({ salaryRows, spent, count, monthLabel, salaryLabel, rate }) {
    const lines = (salaryRows || []).map((r) => ({ label: `Salary · ${r.who}`, value: num(r.amount), note: `credited ${r.date}${salaryLabel ? `; pays for ${monthLabel}` : ""}`, sign: "+" }));
    lines.push({ label: `Spent in ${monthLabel}`, value: num(spent), note: `${count} entr${count === 1 ? "y" : "ies"} so far`, sign: "−" });
    const salary = (salaryRows || []).reduce((t, r) => t + num(r.amount), 0), left = salary - num(spent);
    const pct = salary ? Math.round((left / salary) * 100) : 0;
    const out = { title: "Savings rate", formula: `(salary − spending) ÷ salary = ${salary ? `₹${Math.round(left).toLocaleString("en-IN")} ÷ ₹${Math.round(salary).toLocaleString("en-IN")}` : "no salary yet"}`,
      lines, result: { label: "Left from the salary", value: left, extra: `${pct}%` }, check: checked(lines, left) };
    if (rate != null && rate !== pct) out.check = { ...out.check, ok: false, note: `The screen shows ${rate}%; these lines give ${pct}%.` };
    return out;
  }

  /** A person's tax for the year, from the engine's own working (plan.breakdown / plan.breakdownInput). */
  function tax(person) {
    const p = person.plan, b = p && p.breakdown, inp = p && p.breakdownInput, sal = person.salary || {};
    if (!b || !inp) return null;
    const income = [];
    income.push({ label: "Salary for the year", value: num(inp.grossSalary), note: sal.method ? `${sal.method}${sal.variableMonths && sal.variableMonths.length ? `; variable pay in ${sal.variableMonths.join(", ")}` : ""}` : "", sign: "+" });
    const std = num(inp.grossSalary) - num(inp.exemptAllowances) - (b.regime === "old" ? Math.min(2500, num(inp.professionalTax)) : 0) - num(b.salaryIncome);
    if (num(inp.exemptAllowances)) income.push({ label: "Exempt allowances (HRA etc.)", value: num(inp.exemptAllowances), sign: "−" });
    if (std) income.push({ label: "Standard deduction", value: std, sign: "−" });
    if (b.regime === "old" && num(inp.professionalTax)) income.push({ label: "Professional tax", value: Math.min(2500, num(inp.professionalTax)), sign: "−" });
    if (num(inp.otherIncome)) income.push({ label: "Interest and dividends", value: num(inp.otherIncome), sign: "+" });
    if (num(b.chapterVIA)) income.push({ label: b.regime === "old" ? "Deductions (80C, 80D, NPS…)" : "Employer NPS (80CCD(2))", value: num(b.chapterVIA), sign: "−" });
    const gainsIncome = num(b.totalIncome) - (num(b.salaryIncome) + num(inp.otherIncome) + num(inp.speculativeIncome) - num(b.chapterVIA));
    if (Math.abs(gainsIncome) >= 5) income.push({ label: "Capital gains in the year", value: gainsIncome, sign: "+", note: "the whole long-term gain counts in total income; the ₹1.25L only lowers its tax" });
    const lines = [
      { label: "Tax on the slabs", value: num(b.normalTax), sign: "+", note: `on ₹${Math.round(num(b.normalIncome)).toLocaleString("en-IN")} at the ${b.regime} regime's rates` },
    ];
    if (num(b.rebate87A)) lines.push({ label: "Rebate (sec 87A)", value: num(b.rebate87A), sign: "−", note: b.totalIncome > 1200000 ? "marginal relief" : "income within the rebate limit" });
    if (num(b.specialRateTax)) lines.push({ label: "Tax on capital gains", value: num(b.specialRateTax), sign: "+", note: "20% short-term, 12.5% long-term above ₹1.25L" });
    if (num(b.surcharge)) lines.push({ label: "Surcharge", value: num(b.surcharge), sign: "+" });
    lines.push({ label: "Health & education cess (4%)", value: num(b.cess), sign: "+" });
    return {
      title: `Tax · ${person.name} · FY ${p.fy}`, formula: `Total income ₹${Math.round(num(b.totalIncome)).toLocaleString("en-IN")} → tax`,
      sections: [{ title: "Total income", lines: income, result: { label: "Total income", value: num(b.totalIncome) }, check: checked(income, b.totalIncome, 10) }],
      lines, result: { label: `Tax for the year (${b.regime} regime)`, value: num(b.totalTax) },
      after: [{ label: "TDS expected by March", value: num(p.tdsProjected), note: sal.tdsAssumption || "" }, Math.round(num(p.balance)) === 0 ? { label: "Nothing to pay or refund", value: 0 } : { label: p.balance < 0 ? "Left to pay" : "Refund expected", value: Math.abs(num(p.balance)) }],
      check: checked(lines, b.totalTax, 2),
    };
  }

  /** What a goal needs each month: what is left, over the months to its due date. */
  function goal(g, plan) {
    const lines = [{ label: "Target", value: num(g.target), sign: "+" }, { label: g.track && g.track !== "Entered by me" ? `Saved (follows ${g.track.toLowerCase()})` : "Saved so far", value: num(g.saved), sign: "−" }];
    const remaining = num(g.target) - num(g.saved);
    const out = { title: g.name || "Goal", formula: plan && plan.months ? `₹${Math.round(Math.max(0, remaining)).toLocaleString("en-IN")} ÷ ${plan.months} month${plan.months === 1 ? "" : "s"} to ${g.dueDate}` : "No due date", lines,
      result: { label: "Still to save", value: Math.max(0, remaining), extra: plan && plan.perMonth != null ? `₹${Math.round(plan.perMonth).toLocaleString("en-IN")} a month` : "" },
      check: checked(lines, Math.max(0, remaining)) };
    if (plan && plan.months && plan.perMonth != null && Math.abs(Math.ceil(Math.max(0, remaining) / plan.months) - plan.perMonth) > 1) out.check = { ...out.check, ok: false, note: "The monthly figure does not match what is left over the months." };
    return out;
  }

  return { netWorth, savings, tax, goal, sumOf };
});
