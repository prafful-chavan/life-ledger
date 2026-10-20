const assert = require("assert");
const T = require("../mcp/technicals.js");
const Tax = require("../mcp/tax.js");
const H = require("../mcp/holdings.js");
const F = require("../mcp/fitness.js");
const C = require("../mcp/calendar.js");

const iso = (i) => new Date(Date.UTC(2025, 9, 1) + i * 86400000).toISOString().slice(0, 10);
const rising = (n, start = 100, step = 0.5) => ({ dates: Array.from({ length: n }, (_, i) => iso(i)), closes: Array.from({ length: n }, (_, i) => start + i * step) });

// ── technicals ──
assert.strictEqual(Math.round(T.rsi(rising(40).closes)), 100, "a series that only rises has RSI 100");
const up = T.technicals(rising(300));
assert.strictEqual(up.trend, "Uptrend");
assert.ok(up.rsi14 >= 70 && /Overbought/.test(up.rsiNote));
assert.strictEqual(T.technicals(rising(10)), null, "too little history is refused, not guessed");
const lv = T.levels(up);
assert.ok(lv.reviewBelow < up.last && lv.firstTarget > up.last && lv.stretchTarget >= lv.firstTarget, "levels bracket the price");
const down = T.technicals({ dates: rising(300).dates, closes: rising(300).closes.reverse() });
assert.strictEqual(down.trend, "Downtrend");

// ── tax: FIFO sale, holding periods, regimes ──
const state = {
  mutualFunds: [
    { fundName: "Test Equity Fund", owner: "Me", transactionType: "PURCHASE", units: 100, invested: 10000, purchaseDate: "2024-01-10", latestNav: 150, nav: 100 },
    { fundName: "Test Equity Fund", owner: "Me", transactionType: "PURCHASE", units: 100, invested: 20000, purchaseDate: "2026-03-10", latestNav: 150, nav: 200 },
    { fundName: "Test Equity Fund", owner: "Me", transactionType: "REDEMPTION", units: 50, invested: 7500, purchaseDate: "2026-08-06", latestNav: 150 },
  ],
  stocks: [{ symbol: "AAA", company: "Triple A", owner: "Wife", quantity: 10, invested: 1000, currentPrice: 90, purchaseDate: "2026-01-01" }],
  usstocks: [],
};
const { lots, realised } = Tax.buildLots(state, 90);
assert.strictEqual(realised.length, 1);
assert.strictEqual(Math.round(realised[0].cost), 5000, "FIFO: the sold units come from the OLDEST lot (₹100 a unit)");
assert.strictEqual(Math.round(realised[0].proceeds - realised[0].cost), 2500);
const re = Tax.realisedThisFY(realised, "2026-10-18");
assert.strictEqual(re.fy, "2026-27");
assert.strictEqual(re.owners.Me.equityLT, 2500, "bought Jan 2024, sold Aug 2026 → long-term");
const un = Tax.unrealised(lots, "2026-10-18");
assert.strictEqual(Math.round(un.owners.Me.equityLT), 2500, "50 old units left: 50×150 − 5000");
assert.strictEqual(Math.round(un.owners.Me.equityST), -5000, "recent lot is short-term and at a loss");
assert.strictEqual(Tax.holding({ date: "2025-10-17", cat: "equity" }, "2026-10-18").long, true, "12 months and a day is long-term (sec 2(42A): more than 12 months)");
assert.strictEqual(Tax.holding({ date: "2025-10-18", cat: "equity" }, "2026-10-18").long, false, "exactly 12 months is still short-term");
assert.strictEqual(Tax.holding({ date: "2024-01-01", cat: "debt" }, "2026-10-18").long, false, "debt funds bought from April 2023 are always at slab (sec 50AA)");
assert.strictEqual(Tax.holding({ date: "2022-01-01", cat: "debt" }, "2026-10-18").long, true, "a debt fund bought before April 2023 is long-term after 24 months");
assert.strictEqual(Tax.holding({ date: "2025-01-01", cat: "foreignShares" }, "2026-10-18").long, false, "foreign shares need 24 months");
assert.strictEqual(Tax.taxCategory("Motilal Oswal Nasdaq 100 ETF", "stock"), "listedOther");
assert.strictEqual(Tax.taxCategory("Nippon India ETF Nifty 50 BeES", "stock"), "equity");
assert.strictEqual(Tax.taxCategory("Parag Parikh Flexi Cap Fund", "mf"), "equity");
assert.strictEqual(Tax.taxCategory("Axis Liquid Fund", "mf"), "debt");

const income = { income: [{ person: "Me", date: "2026-09-30", type: "Salary", grossEarnings: 100000, basicSalary: 40000, hra: 20000, pf: 4800, taxTds: 10000, organization: "ACME" }] };
const est = Tax.incomeTaxEstimate(income, "Me", {});
assert.strictEqual(est.annualGross, 1200000);
// new regime: taxable 12,00,000 − 75,000 = 11,25,000 → within the ₹12L rebate limit → nil
assert.strictEqual(est.newRegime.tax, 0, "87A rebate makes income up to ₹12L tax-free in the new regime");
const rich = Tax.incomeTaxEstimate({ income: [{ person: "Me", date: "2026-09-30", type: "Salary", grossEarnings: 300000, basicSalary: 100000, hra: 50000, pf: 12000, taxTds: 50000 }] }, "Me", { regime: "new" });
// taxable = 36,00,000 − 75,000 = 35,25,000; tax = 20k+40k+60k+80k+100k + 30%×11.25L = 300k+337.5k = 6,37,500; ×1.04
assert.strictEqual(rich.newRegime.tax, Math.round(637500 * 1.04));
const withHra = Tax.incomeTaxEstimate({ income: [{ person: "Me", date: "2026-09-30", type: "Salary", grossEarnings: 300000, basicSalary: 100000, hra: 50000, pf: 12000 }] }, "Me", { rentPaidMonthly: 40000 });
assert.strictEqual(withHra.oldRegime.deductionsAssumed.hraExempt, 480000 - 120000, "HRA: rent − 10% of basic (non-metro 40% cap is higher)");
assert.ok(Tax.needsFromUser({}).length >= 7 && Tax.needsFromUser({ regime: "new", rentPaidMonthly: 1, section80COther: 0, section80D: 0, nps80CCD1B: 0, homeLoanInterest: 0, otherIncome: 0, advanceTaxPaid: 0 }).length === 1, "answered questions drop off the list");

// Imported stock rows share one date → buy dates are unknown, tax is a range, nothing is called short-term by guess
const imp = { stocks: Array.from({ length: 6 }, (_, i) => ({ symbol: "S" + i, company: "Stock " + i, owner: "Me", quantity: 10, invested: 1000, currentPrice: 150, purchaseDate: "2026-10-15" })), mutualFunds: [], usstocks: [] };
const impLots = Tax.buildLots(imp).lots;
assert.ok(impLots.every((l) => l.dateKnown === false));
assert.strictEqual(Tax.holding(impLots[0], "2026-10-18").long, null);
assert.ok(Tax.unrealised(impLots, "2026-10-18").owners.Me.unknownTermEquity > 0 && Tax.unrealised(impLots, "2026-10-18").owners.Me.equityST === 0);
const impTbl = H.holdingsTable(imp, "stocks", { today: "2026-10-18", fx: 1, series: {}, lots: impLots, slabRate: { Me: 30 } });
assert.ok(impTbl.rows[0].taxIfSoldTodayApprox.ifAllShortTerm > impTbl.rows[0].taxIfSoldTodayApprox.ifAllLongTerm);
assert.strictEqual(impTbl.rows[0].ageDays, null);
assert.ok(impTbl.rows[0].flags.some((f) => /Buy dates/.test(f)));

// ── holdings table ──
const hs = {
  stocks: [{ symbol: "AAA", company: "Triple A", owner: "Me", quantity: 10, invested: 1000, currentPrice: 150, prevClose: 148, purchaseDate: "2024-06-01", category: "Stock" }],
  mutualFunds: [], usstocks: [],
};
assert.ok(H.historyKeys(hs).includes("AAA.NS") && H.historyKeys(hs).includes("^NSEI"));
const s300 = rising(300, 100, 0.2);
const tbl = H.holdingsTable(hs, "stocks", { today: s300.dates[299], fx: 1, series: { "AAA.NS": { d: s300.dates, c: s300.closes }, "^NSEI": { d: s300.dates, c: s300.closes } }, lots: Tax.buildLots(hs).lots, slabRate: { Me: 30 } });
assert.strictEqual(tbl.rows.length, 1);
const row = tbl.rows[0];
assert.strictEqual(row.value, 1500);
assert.ok(row.levels.reviewBelow.holdingValue < 1500 && row.levels.firstTarget.holdingValue >= 1500, "value of the holding is shown at each level");
assert.ok(row.taxIfSoldTodayApprox > 0 && row.longTermSharePct === 100);
const noHist = H.holdingsTable(hs, "stocks", { today: "2026-10-18", fx: 1, series: {}, lots: [], slabRate: {} });
assert.deepStrictEqual(noHist.withoutHistory, ["Triple A"], "missing price history is reported, never invented");
assert.strictEqual(noHist.rows[0].levels, null);

// ── fitness, milestones, calendar ──
const fit = F.fitnessReport({ bodyMetrics: [{ date: "2025-10-10", weight: 90, bodyFat: 26 }, { date: "2026-08-06", weight: 85, bodyFat: 24 }], workouts: [{ date: "2026-10-01", minutes: 30 }], activities: [{ date: "2026-10-17", type: "steps", steps: 9000 }], habits: [{ name: "PRIVATE NAME", streak: 3, bestStreak: 5 }], fitnessGoals: { dailySteps: 10000 } }, "2026-10-18");
assert.strictEqual(fit.body.stale, true, "73-day-old body measurement is flagged");
assert.strictEqual(fit.body.weightChange.vs365d, -5);
assert.ok(!JSON.stringify(fit).includes("PRIVATE NAME"), "habit names never leave");
assert.strictEqual(F.milestones(13248312, []).next, 15000000);
const ms = F.milestones(10000000, [{ date: "2026-01-01", netWorth: 9000000 }, { date: "2026-07-01", netWorth: 9900000 }]);
assert.ok(ms.monthsAtThatPace > 0 && ms.next === 12500000);
const cal = C.calendar({ people: { me: { dob: "1995-10-22" } }, insurance: [{ person: "Me", type: "Health", policyName: "Fam", nextDue: "2026-11-05", premium: 20000 }] }, "2026-10-18");
assert.deepStrictEqual(cal.slice(0, 3).map((i) => i.kind), ["birthday", "salary", "renewal"]);
assert.ok(cal.some((i) => /Advance tax/.test(i.what)));
const sip = C.sipProgress({ mfMonthlyTarget: { me: 50000, wife: 50000 }, mutualFunds: [{ owner: "Me", invested: 20000, purchaseDate: "2026-10-05" }, { owner: "Me", invested: 999, purchaseDate: "2026-09-05" }] }, "2026-10-18");
assert.strictEqual(sip.investedMe, 20000);
console.log("mcp-market tests passed");
