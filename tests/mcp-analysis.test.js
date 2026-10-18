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
