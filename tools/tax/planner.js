/**
 * Life Ledger — forward tax planner (pure). For the coming/current year: old vs new regime on the household's real figures,
 * what each lever is worth (employer NPS, gains harvesting, deductions), advance-tax instalments and the filing calendar.
 *
 * p = { fy, person, grossSalary, basic, hraReceived, rentPaid, metro, professionalTax, otherIncome, employerNps (current),
 *       gains: { stcgAfter, ltcgAfter } (further gains expected), realisedLtcgYtd / realisedStcgYtd (already booked this year), deductionsPaid: { "80C", "80D_self", "80D_parents", "80CCD1B", homeLoanInterest },
 *       parentsSenior, tdsProjected, hasForeignAssets, hasShareSales }
 */
const E = require("./engine");
const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const r0 = (v) => Math.round(v);

function plan(p, asOf = new Date().toISOString().slice(0, 10)) {
  const y = E.yearRules(p.fy);
  const fyStart = +p.fy.slice(0, 4);
  const npsCap = r0((y.newRegime ? y.newRegime.cap80CCD2Pct : 10) / 100 * num(p.basic));
  const hra = E.hraExemption({ hraReceived: p.hraReceived, rentPaid: p.rentPaid, basic: p.basic, metro: p.metro });
  const capped = E.capDeductions(p.deductionsPaid || {}, { parentsSenior: p.parentsSenior, basic: p.basic });
  const oldDed = capped["80C"] + capped["80CCD1B"] + capped["80D"] + capped.homeLoanInterest;
  const gains = { ...(p.gains || {}) };
  if (num(p.realisedLtcgYtd) || num(p.realisedStcgYtd)) { gains.ltcgAfter = num(gains.ltcgAfter) + num(p.realisedLtcgYtd); gains.stcgAfter = num(gains.stcgAfter) + num(p.realisedStcgYtd); }
  const base = { fy: p.fy, grossSalary: p.grossSalary, professionalTax: p.professionalTax, otherIncome: p.otherIncome, employerNps: p.employerNps, basic: p.basic, gains };
  const cmp = E.compareRegimes(base, { old: { exemptAllowances: hra, deductions: oldDed }, newer: { exemptAllowances: 0, deductions: 0 } });
  const chosen = cmp.better;
  const current = cmp[chosen];

  const levers = [];
  // Employer NPS up to the cap
  if (num(p.employerNps) < npsCap) {
    const t = E.computeTax({ ...base, regime: chosen, exemptAllowances: chosen === "old" ? hra : 0, deductions: chosen === "old" ? oldDed : 0, employerNps: npsCap });
    levers.push({ id: "employer-nps", title: "Employer NPS (80CCD(2)) up to the cap", yearlySaving: current.totalTax - t.totalTax, detail: `Ask the employer to route up to ₹${npsCap.toLocaleString("en-IN")} a year (${y.newRegime ? y.newRegime.cap80CCD2Pct : 10}% of basic) to NPS. Needs your own NPS account (PRAN). Locked until 60.` });
  }
  // Long-term gains harvesting (₹1.25L exemption, 12.5%)
  const exemptionLeft = Math.max(0, E.RULES.equity.exemptionFromFY2425 - Math.max(0, num(p.realisedLtcgYtd)));
  if (exemptionLeft > 0) levers.push({ id: "ltcg-harvest", title: `Book ₹${exemptionLeft.toLocaleString("en-IN")} more of long-term equity gains tax-free`, yearlySaving: r0(exemptionLeft * E.RULES.equity.ltcgAfter / 100 * 1.04), detail: `${num(p.realisedLtcgYtd) > 0 ? `₹${r0(p.realisedLtcgYtd).toLocaleString("en-IN")} of the ₹1.25L exemption is already used this year. ` : ""}Sell and buy back the same day before 31 March; resets your cost so future tax is lower. Leave out funds with exit loads.` });
  // Holding period
  if (num(p.gains?.stcgAfter) > 0) levers.push({ id: "hold-12m", title: "Hold equity 12+ months", yearlySaving: r0(num(p.gains.stcgAfter) * (E.RULES.equity.stcgAfter - E.RULES.equity.ltcgAfter) / 100 * 1.04), detail: "Short-term 20% vs long-term 12.5% (first ₹1.25L free)." });
  for (let i = levers.length - 1; i >= 0; i--) if (!(levers[i].yearlySaving > 0)) levers.splice(i, 1);
  levers.sort((a, b) => b.yearlySaving - a.yearlySaving);

  // Advance tax: due if tax not covered by TDS exceeds ₹10,000
  const shortfall = current.totalTax - num(p.tdsProjected);
  const advance = shortfall > 10000 ? [[`${fyStart}-06-15`, 15], [`${fyStart}-09-15`, 45], [`${fyStart}-12-15`, 75], [`${fyStart + 1}-03-15`, 100]].map(([date, pct]) => ({ date, cumulativePct: pct, cumulativeAmount: r0(shortfall * pct / 100) })) : [];

  const form = p.hasForeignAssets || p.hasShareSales || num(p.grossSalary) > 50 * 1e5 ? "ITR-2" : "ITR-1";
  const calendar = [
    { date: `${fyStart}-04-30`, what: "Tell the employer your regime; start/confirm employer NPS" },
    ...advance.map((a) => ({ date: a.date, what: `Advance tax: ${a.cumulativePct}% (₹${a.cumulativeAmount.toLocaleString("en-IN")} cumulative)` })),
    { date: `${fyStart + 1}-03-15`, what: "Gains harvesting and loss booking; insurance renewals" },
    { date: `${fyStart + 1}-06-15`, what: "Form 16 arrives; download AIS/TIS, 26AS, broker and INDmoney reports; run the audit" },
    ...(p.hasForeignAssets ? [{ date: `${fyStart + 1}-07-15`, what: "File Form 67 (credit for US tax on dividends) before the return" }] : []),
    { date: `${fyStart + 1}-07-31`, what: `File ${form} (${chosen} regime)` },
    { date: `${fyStart + 1}-12-31`, what: "Last date for a revised/belated return" },
  ];

  calendar.sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const c of calendar) c.status = c.date < asOf ? "past" : "upcoming";
  // An instalment date already gone means interest u/s 234C; paying the cumulative amount by the next date limits it.
  const nextAdvance = advance.find((a) => a.date >= asOf) || null;
  const missedAdvance = advance.filter((a) => a.date < asOf).length > 0;

  return {
    fy: p.fy, person: p.person, asOf, assumedRules: !!y.assumed, nextAdvance, missedAdvance,
    regimes: { old: { tax: cmp.old.totalTax, hraExempt: r0(hra), deductions: r0(oldDed), taxable: cmp.old.totalIncome }, new: cmp.new && { tax: cmp.new.totalTax, taxable: cmp.new.totalIncome } },
    better: chosen, saving: cmp.saving, marginalRatePct: current.marginalRatePct,
    tdsProjected: r0(num(p.tdsProjected)), balance: r0(num(p.tdsProjected) - current.totalTax),
    form, levers, advanceTax: advance, calendar,
  };
}

module.exports = { plan };
