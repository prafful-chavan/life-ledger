/**
 * Life Ledger MCP — Indian tax working (pure): capital gains by lot (FIFO), tax if sold today, this year's realised gains,
 * and an income-tax estimate under both regimes. Rates are those in force as the author knew them (FY 2026-27) and are
 * listed in RULES so they are easy to check and change. Planning aid only — a CA should confirm before anything is filed.
 */
const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const r0 = (v) => Math.round(v);
const isoOf = (x) => String(x || "").slice(0, 10);

const RULES = {
  asOf: "FY 2026-27 (assessment year 2027-28) as understood by the author — confirm with a CA",
  equity: { holdMonths: 12, stcgRate: 20, ltcgRate: 12.5, yearlyExemption: 125000 },
  listedOther: { holdMonths: 12, ltcgRate: 12.5, note: "Listed gold/silver/overseas ETFs: short-term at slab, long-term 12.5% after 12 months, no ₹1.25L exemption" },
  unlistedOther: { holdMonths: 24, ltcgRate: 12.5, note: "Unlisted overseas/gold fund-of-funds: short-term at slab, long-term 12.5% after 24 months" },
  foreignShares: { holdMonths: 24, ltcgRate: 12.5, note: "Foreign shares: long-term after 24 months at 12.5%; the rupee gain includes currency movement" },
  debt: { note: "Debt funds bought on/after 1 Apr 2023 are always taxed at slab rate" },
  cess: 4,
  newRegime: { std: 75000, slabs: [[400000, 0], [800000, 5], [1200000, 10], [1600000, 15], [2000000, 20], [2400000, 25], [Infinity, 30]], rebateLimit: 1200000 },
  oldRegime: { std: 50000, slabs: [[250000, 0], [500000, 5], [1000000, 20], [Infinity, 30]], rebateLimit: 500000, cap80C: 150000, cap80CCD1B: 50000, capHomeLoanInterest: 200000 },
};

// Capital-gains lot logic lives in tax-core.js (shared with the app). Re-exported here under the same names.
const { taxCategory, buildLots, holding, unrealised, realisedThisFY, fyOf } = require("../tax-core.js").gains;

// ── income tax ───────────────────────────────────────────────────────────────────────────────
function slabTax(taxable, slabs) {
  let tax = 0, prev = 0;
  for (const [limit, rate] of slabs) {
    if (taxable > prev) tax += (Math.min(taxable, limit) - prev) * (rate / 100);
    prev = limit;
  }
  return tax;
}
const marginalRate = (taxable, slabs) => { for (const [limit, rate] of slabs) if (taxable <= limit) return rate; return slabs[slabs.length - 1][1]; };

/**
 * profile (all optional, per person, yearly ₹): { regime, rentPaidMonthly, metro, section80COther, section80D, nps80CCD1B, homeLoanInterest, otherIncome, advanceTaxPaid }
 * Salary figures come from the latest payslip in the vault, scaled to 12 months.
 */
function incomeTaxEstimate(state, who, profile = {}, capGains = { equityST: 0, equityLT: 0 }) {
  const rows = (state.income || []).filter((i) => (i.person || "Me") === who && (!i.type || /salary/i.test(i.type))).sort((a, b) => (a.date < b.date ? 1 : -1));
  const p = rows[0];
  if (!p) return { who, error: "No salary record found" };
  const gross = num(p.grossEarnings) * 12, basic = num(p.basicSalary) * 12, hra = num(p.hra) * 12;
  const pfEmployee = num(p.pf) * 12, tds = num(p.taxTds) * 12, pt = Math.min(num(p.professionalTax) * 12 || 2400, 2500);
  const other = num(profile.otherIncome);
  const specialGains = (g) => {
    const stcg = Math.max(0, g.equityST) * 0.20;
    const ltcg = Math.max(0, g.equityLT - RULES.equity.yearlyExemption) * 0.125;
    return stcg + ltcg;
  };
  const cess = (t) => t * (1 + RULES.cess / 100);

  const nTaxable = Math.max(0, gross - RULES.newRegime.std + other);
  let nTax = nTaxable <= RULES.newRegime.rebateLimit ? 0 : Math.min(slabTax(nTaxable, RULES.newRegime.slabs), nTaxable - RULES.newRegime.rebateLimit);
  const nTotal = cess(nTax + specialGains(capGains));

  const rentAnnual = num(profile.rentPaidMonthly) * 12;
  const hraExempt = rentAnnual > 0 ? Math.max(0, Math.min(hra, rentAnnual - 0.1 * basic, (profile.metro ? 0.5 : 0.4) * basic)) : 0;
  const c80C = Math.min(RULES.oldRegime.cap80C, pfEmployee + num(profile.section80COther));
  const ded = hraExempt + c80C + num(profile.section80D) + Math.min(RULES.oldRegime.cap80CCD1B, num(profile.nps80CCD1B)) + Math.min(RULES.oldRegime.capHomeLoanInterest, num(profile.homeLoanInterest));
  const oTaxable = Math.max(0, gross - RULES.oldRegime.std - pt - ded + other);
  let oTax = oTaxable <= RULES.oldRegime.rebateLimit ? 0 : slabTax(oTaxable, RULES.oldRegime.slabs);
  const oTotal = cess(oTax + specialGains(capGains));

  const better = oTotal < nTotal ? "old" : "new";
  const chosen = profile.regime === "old" || profile.regime === "new" ? profile.regime : better;
  const total = chosen === "old" ? oTotal : nTotal;
  const slabs = chosen === "old" ? RULES.oldRegime.slabs : RULES.newRegime.slabs;
  return {
    who, employer: p.organization || p.source, basedOnPayslip: p.date,
    annualGross: r0(gross), projectedTDS: r0(tds),
    newRegime: { taxable: r0(nTaxable), tax: r0(nTotal) },
    oldRegime: { taxable: r0(oTaxable), tax: r0(oTotal), deductionsAssumed: { hraExempt: r0(hraExempt), section80C: r0(c80C), section80D: r0(num(profile.section80D)), nps: r0(Math.min(RULES.oldRegime.cap80CCD1B, num(profile.nps80CCD1B))), homeLoanInterest: r0(Math.min(RULES.oldRegime.capHomeLoanInterest, num(profile.homeLoanInterest))), professionalTax: r0(pt) } },
    lowerTaxRegime: better, regimeUsed: chosen, regimeKnown: !!profile.regime,
    estimatedYearlyTax: r0(total), marginalSlabRatePct: marginalRate(chosen === "old" ? oTaxable : nTaxable, slabs),
    tdsVsTax: r0(tds - total), tdsVsTaxNote: tds - total >= 0 ? "Projected TDS covers the tax; a refund of about this much is likely" : "Projected TDS falls short by about this much — likely advance tax or self-assessment tax",
    capitalGainsTaxIncluded: r0(cess(specialGains(capGains))),
  };
}

/** What a CA would ask for, minus what the vault already answered. */
function needsFromUser(profile = {}) {
  const need = [];
  const ask = (key, q) => { if (profile[key] === undefined || profile[key] === null) need.push({ key, question: q }); };
  ask("regime", "Which regime does each employer deduct TDS under (old or new)? It is in the payslip or Form 12BB.");
  ask("rentPaidMonthly", "Monthly rent actually paid and whether the city is a metro (Mumbai/Delhi/Kolkata/Chennai only; Nagpur is not). Needed for the HRA exemption in the old regime.");
  ask("section80COther", "Yearly 80C investments besides the employee PF: ELSS (e.g. Axis ELSS SIPs), PPF deposits, LIC premiums, tuition fees, 5-year tax-saver FD.");
  ask("section80D", "Health insurance premium paid yearly for you, spouse and parents (80D).");
  ask("nps80CCD1B", "NPS contribution beyond the employer's (extra ₹50,000 deduction, old regime).");
  ask("homeLoanInterest", "Home-loan interest paid this year, if any.");
  ask("otherIncome", "Interest on FDs and savings, rent received, dividends, or any other income this year (FD interest is taxable at slab rate).");
  ask("advanceTaxPaid", "Any advance tax or self-assessment tax already paid this year.");
  need.push({ key: "ais", question: "Download Form 26AS / AIS from the income-tax portal once a year and compare it with this data; mismatches get notices." });
  return need;
}

module.exports = { RULES, taxCategory, buildLots, holding, unrealised, realisedThisFY, incomeTaxEstimate, needsFromUser, fyOf, slabTax };
