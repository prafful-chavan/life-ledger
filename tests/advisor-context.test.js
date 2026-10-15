const assert = require("assert");
const Engine = require("../advisor-engine.js");
const Ctx = require("../advisor-context.js");

// projection maths: lump only, and SIP only, against known values
assert.strictEqual(Ctx.projection(100000, 0, 10, 1), 110000);
assert.strictEqual(Ctx.projection(0, 10000, 12, 1), 126825, "12 monthly SIPs at 1%/month");
assert.strictEqual(Ctx.projection(0, 10000, 0, 2), 240000);

const input = {
  now: "2026-10-15",
  holdings: [
    { key: "a", cls: "mf", name: "UTI Nifty 50 Index Fund", value: 700000, invested: 600000 },
    { key: "b", cls: "stock", name: "TCS", value: 100000, invested: 80000 },
    { key: "c", cls: "bank", name: "Savings", value: 200000, invested: 200000 },
  ],
  cash: { monthlyIncome: 150000, monthlyExpenses: 90000, savingsRate: 40, topCategories: [["Rent", 45000]] },
  liabilities: [{ name: "Car loan", owner: "Me", value: 400000, emi: 16300, rate: 9.5 }],
  goals: [{ name: "Home", target: 5000000, saved: 1000000, dueDate: "2030-10-15" }],
  profile: { monthlyInvestable: 50000, sipTarget: 100000, risk: "moderate" },
  series: {}, benchmarks: {}, mfThisMonth: 40000,
};
const result = Engine.analyze(input);
const extras = {
  monthly: [{ month: "2026-09", income: 150000, expenses: 88000, saved: 62000, expensesByOwner: { Me: 50000, Wife: 38000 } }, { month: "2026-10", income: 150000, expenses: 30000, saved: 120000, expensesByOwner: {}, partial: true }],
  thisMonthCategories: [["Rent", 45000]], sipThisMonth: { Me: 40000 }, sipTargets: { Me: 50000, Wife: 50000 },
  nwHistory: [{ date: "2026-10-15", netWorth: 1000000 }, { date: "2026-10-08", netWorth: 980000 }, { date: "2026-09-15", netWorth: 900000 }],
};
const text = Ctx.build({ result, input, extras, review: { headline: "Solid base", actions: [{ priority: 1, action: "BUILD", asset: "Emergency", summary: "Add to cash" }] } });

for (const must of ["PORTFOLIO INTELLIGENCE", "UTI Nifty 50 Index Fund", "ALLOCATION vs TARGET", "ADVISOR SIGNALS", "MONTHLY TREND", "2026-09", "Wife ₹38,000", "LIABILITIES", "Car loan", "interest ≈ ₹38,000/year", "GOALS", "needs ≈", "NET WORTH RECORDS", "Net worth change vs 2026-10-08: ₹20,000", "ILLUSTRATIVE PROJECTION", "LATEST AI REVIEW: Solid base", "SIP THIS MONTH"]) {
  assert.ok(text.includes(must), "briefing includes: " + must);
}
assert.ok(text.includes("₹10,00,000") || text.includes("₹1,000,000") || /₹[\d,]+/.test(text), "Indian number formatting");
assert.strictEqual(Ctx.build({}), "", "no data → empty (never throws)");
// compact briefing (rides along with every chat message) is much smaller and points to the full module
{
  const many = { ...input, holdings: Array.from({ length: 60 }, (_, i) => ({ key: "h" + i, cls: "mf", name: "Fund " + i, value: 50000 + i, invested: 40000 })) };
  const big = Engine.analyze(many);
  const full = Ctx.build({ result: big, input: many, extras });
  const small = Ctx.build({ result: big, input: many, extras, compact: true });
  assert.ok(small.length < 10000 && small.length < full.length, "compact stays small (" + small.length + " vs " + full.length + ")");
  assert.ok(small.includes("get_module") && small.includes("portfolio"), "tells the model where the rest is");
  assert.ok(small.includes("Fund 59"), "keeps the biggest holdings");
  assert.ok(small.includes("REMAINING 48 POSITIONS") && small.includes("Fund 20 | mf |"), "every other position still carries its official verdict");
  assert.ok(!small.includes("Fund 20 | mf/") , "but only the verdict line, not the full table row");
}

console.log("advisor-context tests passed");
