const assert = require("assert");
const A = require("../mcp/analysis.js");

const state = () => ({
  fx: { usdInr: 90 },
  mutualFunds: [
    { fundName: "Axis Large Cap Fund Direct Growth", owner: "Me", transactionType: "PURCHASE", units: 100, invested: 100000, currentValue: 150000, latestNav: 1500, prevNav: 1490, purchaseDate: "2024-01-01" },
    { fundName: "Axis Large Cap Fund Direct Growth", owner: "Me", transactionType: "REDEMPTION", units: 20, invested: 20000, currentValue: 30000, latestNav: 1500, prevNav: 1490, purchaseDate: "2025-06-01" },
    { fundName: "Parag Parikh Flexi Cap", owner: "Wife", transactionType: "PURCHASE", units: 10, invested: 50000, currentValue: 40000, latestNav: 4000, prevNav: 4010, purchaseDate: "2024-03-01" },
  ],
  stocks: [{ symbol: "AAA", company: "Triple A", owner: "Me", quantity: 10, invested: 1000, currentValue: 1500, currentPrice: 150, prevClose: 140, purchaseDate: "2023-01-01" }],
  usstocks: [{ symbol: "META", owner: "Me", quantity: 1, invested: 100, currentValue: 120, currentPrice: 120, prevClose: 118, purchaseDate: "2024-01-01" }],
  gold: [{ value: 5000 }], silver: [{ value: 100 }], crypto: [], fd: [{ value: 20000 }], epf: [{ value: 3000 }], ppf: [], bonds: [], banksaving: [{ value: 10000 }],
  others: [{ value: 500 }], vehicles: [{ value: 1500 }], liabilities: [{ value: 2000, emi: 100 }],
  income: [
    { person: "Me", date: "2026-09-30", type: "Salary", netSalary: 100000 },
    { person: "Wife", date: "2026-09-30", type: "Salary", netSalary: 50000 },
    { person: "Me", date: "2026-08-31", type: "Salary", netSalary: 90000 },
  ],
  expenses: [
    { date: "2026-10-03", category: "Groceries", amount: 30000 }, { date: "2026-10-05", category: "EMI- Car, Home, policy", amount: 20000 },
    { date: "2026-09-04", category: "Groceries", amount: 25000 }, { date: "2026-09-10", category: "Gromming", amount: 5000 },
  ],
  insurance: [], people: { me: { dob: "1995-10-22" } }, netWorthHistory: [],
});

const s = state();
// Net worth: a redemption is subtracted, US stocks use the vault rate, vehicles count under others
const nw = A.netWorth(s);
assert.strictEqual(nw.classes.mutualFunds.value, 150000 - 30000 + 40000, "redemption value is subtracted");
assert.strictEqual(nw.classes.usStocks.value, 120 * 90);
assert.strictEqual(nw.classes.others.value, 2000, "vehicles are in others");
assert.strictEqual(nw.netWorth, nw.assets - 2000);

// Change vs the last recorded day is explained class by class (edits vs market moves)
const sc = state();
sc.netWorthHistory = [{ date: "2020-01-01", netWorth: 1000, mutualFunds: 160000, stocks: 1500, usStocks: 10800, gold: 5000, silver: 100, crypto: 0, fd: 20000, epf: 3000, ppf: 0, bonds: 0, bankSaving: 10000, others: 4000, liabilities: 2000 }];
const chg = A.netWorth(sc).changeVsPrevious;
assert.strictEqual(chg.byClass.others, -2000, "an edit to a manual asset shows up under others");
assert.strictEqual(chg.marketLikeMoves, 0);
assert.ok(!("mutualFunds" in chg.byClass), "unchanged classes are left out");
assert.strictEqual(A.netWorth(state()).changeVsPrevious, undefined, "no history, no comparison");

// A class the app locked at today's close keeps the locked value (same net worth as the app); a what-if rate does not
{
  const today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
  const sl = state();
  sl.netWorthHistory = [{ date: today, usStocks: 120 * 91, stocks: 999999, settled: { usStocks: true, stocks: false } }];
  const l = A.netWorth(sl);
  assert.strictEqual(l.classes.usStocks.value, 120 * 91, "locked US value used");
  assert.deepStrictEqual(l.lockedAtClose, ["usStocks"], "an unlocked class stays live");
  assert.strictEqual(A.netWorth(sl, 100).classes.usStocks.value, 120 * 100, "an explicit rate is a what-if, not the lock");
  sl.netWorthHistory[0].usStocks = 120 * 200;
  assert.strictEqual(A.netWorth(sl).classes.usStocks.value, 120 * 90, "a lock far from the holdings (rows changed) is ignored");
}


// Integrity: bulk duplicate rows and unexplained jumps are caught; normal data is quiet
{
  const lots = Array.from({ length: 12 }, (_, i) => ({ id: "mf-" + i, fundName: "F" + i, owner: "Me", demat: "G", units: 10 + i, invested: 1000 + i, purchaseDate: "2026-01-01", transactionType: "PURCHASE", latestNav: 10, currentValue: 100 }));
  const healthy = { ...state(), mutualFunds: lots };
  assert.deepStrictEqual(A.integrity(healthy), { ok: true, alerts: [] }, "healthy data raises nothing");
  const doubled = { ...state(), mutualFunds: [...lots, ...lots.map((l) => ({ ...l, id: l.id + "-copy" }))] };
  const bad = A.integrity(doubled);
  assert.strictEqual(bad.ok, false); assert.strictEqual(bad.alerts[0].topic, "Repeated holdings"); assert.ok(/Remove the extra copies/.test(bad.alerts[0].text));
  // The previous day is built from the book's own class values, so the only thing that differs is what we change on purpose
  const book = state(), cur = A.netWorth(book), c = cur.classes;
  const prevDay = (over) => ({ date: "2020-01-01", mutualFunds: c.mutualFunds.value, stocks: c.stocks.value, usStocks: c.usStocks.value, gold: c.gold.value, silver: c.silver.value, crypto: c.crypto.value, fd: c.fd.value, epf: c.epf.value, ppf: c.ppf.value, bonds: c.bonds.value, bankSaving: c.bankSaving.value, others: c.others.value, liabilities: cur.liabilities, netWorth: cur.netWorth, ...over });
  const quiet = A.integrity({ ...book, netWorthHistory: [prevDay({})] });
  assert.ok(quiet.ok && !quiet.alerts.length, "no change since yesterday raises nothing");
  // FD and Others were empty yesterday and now hold money: not markets → critical (>= 6%)
  const unexplained = A.integrity({ ...book, netWorthHistory: [prevDay({ fd: 0, others: 0, netWorth: cur.netWorth - c.fd.value - c.others.value })] });
  assert.ok(unexplained.alerts.some((a) => a.topic === "Unexplained jump" && a.level === "critical") && !unexplained.ok, JSON.stringify(unexplained));
  // The same size of move caused by funds (markets) is only a watch, and not a data fault
  const marketDriven = A.integrity({ ...book, netWorthHistory: [prevDay({ mutualFunds: c.mutualFunds.value - 60000, netWorth: cur.netWorth - 60000 })] });
  assert.ok(marketDriven.ok, "a big but market-driven move is not a data fault");
  assert.ok(marketDriven.alerts.every((a) => a.level === "watch"));
}

// Mutual funds: redemption reduces invested and units; best/worst only count meaningful sizes
const mf = A.mutualFundReport(s, "2026-10-18");
const axis = mf.funds.find((f) => /Axis/.test(f.fund));
assert.strictEqual(axis.invested, 80000);
assert.strictEqual(axis.value, 120000);
assert.strictEqual(axis.gainPct, 50);
assert.ok(mf.funds.find((f) => /Parag/.test(f.fund)).gain < 0);
assert.strictEqual(mf.totalValue, 160000);
assert.strictEqual(A.fundKind("Motilal Oswal Midcap Fund Direct Growth"), "Mid cap");
assert.strictEqual(A.fundKind("UTI Nifty 50 Index Fund"), "Index");

// Gold follows the live rate, not the stale saved value
const g = { ...state(), gold: [{ weightGrams: 10, carat: "22K", value: 1 }, { weightGrams: 5, carat: "24K", value: 1 }, { value: 700 }], goldPrice: { price22k: 100, price24k: 110 } };
assert.strictEqual(A.netWorth(g).classes.gold.value, 1000 + 550 + 700, "weight × carat rate; rows without weight keep their saved value");
assert.strictEqual(A.netWorth({ ...state(), gold: [{ weightGrams: 10, carat: "22K", value: 5000 }] }).classes.gold.value, 5000, "no live rate available → saved value");

// Stocks
const st = A.stockReport(s);
assert.strictEqual(st.holdings[0].gainPct, 50);
assert.strictEqual(st.dayChange, 100);
assert.strictEqual(A.usStockReport(s).totalValue, 10800);

// Salary cycle: September salary pays October spending
const ex = A.expenseReport(s, "2026-10");
assert.strictEqual(ex.salaryThatPaysIt.net, 150000, "latest salary per person, credited in the previous month");
assert.strictEqual(ex.spent, 50000);
assert.strictEqual(ex.leftFromSalary, 100000);
assert.ok(Math.abs(ex.savingsRatePct - 66.7) < 0.1);
assert.ok(ex.categories.find((c) => c.category === "EMI - Car, Home, policy"), "category spellings are merged");
assert.strictEqual(A.expenseReport(s, "2026-09").salaryThatPaysIt.net, 90000, "August salary pays September");

// Health check and freshness never throw on a sparse household
const h = A.healthCheck(s, "2026-10-18");
assert.ok(h.flags.length >= 4);
assert.ok(A.healthCheck({ ...state(), expenses: [], income: [] }, "2026-10-18").flags.length >= 1);
assert.strictEqual(A.freshness(s, Date.now()).mutualFundsHoursOld, null);
console.log("mcp-analysis tests passed");
