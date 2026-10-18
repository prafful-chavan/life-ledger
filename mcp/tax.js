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

// ── classification ───────────────────────────────────────────────────────────────────────────
function taxCategory(name, kind, category) {
  const n = String(name || "").toLowerCase();
  if (kind === "us") return "foreignShares";
  if (kind === "mf") {
    if (/liquid|overnight|money market|debt|gilt|bond|corporate bond|short duration|low duration|ultra short/.test(n)) return "debt";
    if (/gold|silver|nasdaq|s&p|us |overseas|international|global|hang seng|world/.test(n)) return "unlistedOther";
    if (/multi asset|hybrid|balanced|dynamic asset/.test(n)) return "hybrid";
    return "equity";
  }
  if (/gold|silver|nasdaq|s&p|hang seng|mafang|international|world|overseas/.test(n)) return "listedOther";
  return "equity";
}

// ── lots (FIFO) ──────────────────────────────────────────────────────────────────────────────
/** Returns { lots: open lots, realised: [{...}] } for mutual funds (with redemptions) and stocks/ETFs/US stocks. */
function buildLots(state, usdInr = 1) {
  const lots = [], realised = [];
  const mfRows = (state.mutualFunds || []).slice().sort((a, b) => (isoOf(a.purchaseDate || a.date) < isoOf(b.purchaseDate || b.date) ? -1 : 1));
  const groups = new Map();
  for (const t of mfRows) {
    const k = `${t.fundName}|${t.owner || "Me"}`;
    (groups.get(k) || groups.set(k, []).get(k)).push(t);
  }
  for (const [k, rows] of groups) {
    const [name, owner] = k.split("|");
    const nav = num([...rows].reverse().find((t) => num(t.latestNav))?.latestNav) || num(rows[rows.length - 1].nav);
    const open = [];
    for (const t of rows) {
      if (t.transactionType === "REDEMPTION") {
        let units = num(t.units);
        const proceedsPerUnit = num(t.invested) / (num(t.units) || 1);
        while (units > 1e-9 && open.length) {
          const l = open[0], take = Math.min(units, l.qty), costPer = l.cost / l.qty;
          realised.push({ kind: "mf", name, owner, category: l.cat, buyDate: l.date, sellDate: isoOf(t.purchaseDate || t.date), qty: take, cost: take * costPer, proceeds: take * proceedsPerUnit });
          l.cost -= take * costPer; l.qty -= take; units -= take;
          if (l.qty <= 1e-9) open.shift();
        }
      } else {
        open.push({ kind: "mf", name, owner, cat: taxCategory(name, "mf"), date: isoOf(t.purchaseDate || t.date), qty: num(t.units), cost: num(t.invested), price: nav });
      }
    }
    open.forEach((l) => lots.push(l));
  }
  const addStocks = (list, kind, fx) => {
    for (const s of list || []) {
      const qty = num(s.quantity);
      if (!(qty > 0)) continue;
      lots.push({ kind, name: s.company || s.symbol, symbol: s.symbol, owner: s.owner || "Me", cat: taxCategory(s.company || s.symbol, kind, s.category), date: isoOf(s.purchaseDate || s.date), qty, cost: num(s.invested) * fx, price: num(s.currentPrice) * fx });
    }
  };
  addStocks(state.stocks, "stock", 1);
  addStocks(state.usstocks, "us", num(usdInr) || 1);
  // Broker/sheet imports stamp every row with the import date, so a date shared by most rows is not a real buy date.
  for (const kind of ["stock", "us"]) {
    const ls = lots.filter((l) => l.kind === kind), count = {};
    ls.forEach((l) => { count[l.date] = (count[l.date] || 0) + 1; });
    const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
    if (top && ls.length >= 5 && top[1] / ls.length > 0.5) ls.forEach((l) => { if (l.date === top[0]) l.dateKnown = false; });
  }
  return { lots, realised };
}

const monthsBetween = (fromISO, toISO) => {
  const a = new Date(fromISO), b = new Date(toISO);
  let m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) m--;
  return m;
};

/** Is a lot long-term on `asOf`? (Debt: never.) */
function holding(lot, asOf, sellDate) {
  if (lot.dateKnown === false) return { long: null, months: null, rule: null, unknown: true };
  const cat = lot.cat || lot.category;
  const rule = cat === "equity" || cat === "hybrid" ? RULES.equity : cat === "listedOther" ? RULES.listedOther : cat === "debt" ? null : cat === "foreignShares" ? RULES.foreignShares : RULES.unlistedOther;
  const months = monthsBetween(lot.date || lot.buyDate, sellDate || asOf);
  return { long: !!rule && months >= rule.holdMonths, months, rule };
}

const fyOf = (iso) => { const y = +iso.slice(0, 4), m = +iso.slice(5, 7); return m >= 4 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`; };

/** Gains if every open lot were sold on `asOf`, split per owner into short/long and equity/other. */
function unrealised(lots, asOf) {
  const owners = {};
  const perLot = lots.map((l) => {
    const h = holding(l, asOf);
    const value = l.qty * l.price, gain = value - l.cost;
    const o = (owners[l.owner] ||= { equityST: 0, equityLT: 0, otherST: 0, otherLT: 0, debt: 0, unknownTermEquity: 0, unknownTermOther: 0 });
    if (h.unknown) { if (l.cat === "equity" || l.cat === "hybrid") o.unknownTermEquity += gain; else o.unknownTermOther += gain; }
    else if (l.cat === "debt") o.debt += gain;
    else if (l.cat === "equity" || l.cat === "hybrid") (h.long ? (o.equityLT += gain) : (o.equityST += gain));
    else (h.long ? (o.otherLT += gain) : (o.otherST += gain));
    return { ...l, value, gain, long: h.long, months: h.months, termUnknown: !!h.unknown };
  });
  return { owners, perLot };
}

/** This financial year's realised gains per owner (from redemptions). */
function realisedThisFY(realised, asOf) {
  const fy = fyOf(asOf), owners = {};
  const rows = realised.filter((r) => fyOf(r.sellDate) === fy).map((r) => {
    const h = holding({ date: r.buyDate, cat: r.category }, r.sellDate, r.sellDate);
    const gain = r.proceeds - r.cost;
    const o = (owners[r.owner] ||= { equityST: 0, equityLT: 0, otherST: 0, otherLT: 0 });
    const eq = r.category === "equity" || r.category === "hybrid";
    if (eq) (h.long ? (o.equityLT += gain) : (o.equityST += gain)); else (h.long ? (o.otherLT += gain) : (o.otherST += gain));
    return { owner: r.owner, name: r.name, sold: r.sellDate, bought: r.buyDate, proceeds: r0(r.proceeds), cost: r0(r.cost), gain: r0(gain), term: h.long ? "long" : "short", category: r.category };
  });
  return { fy, owners, rows };
}

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
