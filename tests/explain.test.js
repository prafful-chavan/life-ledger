// "How was this calculated?": every explanation's lines add up to the figure it explains, and a mismatch shows.
const assert = require("assert");
const X = require("../explain.js");
const { household: H } = require("../tax-core.js");

// Net worth
{
  const snap = { netWorth: 1000, totalAssets: 1100, liabilities: 100, mutualFunds: 500, stocks: 300, usStocks: 100, gold: 150, fd: 50, settled: { mutualFunds: true, stocks: false }, asOf: { mutualFunds: "2026-10-20T10:38:00.000Z" }, fxRate: 94.93 };
  const e = X.netWorth(snap);
  assert.ok(e.check.ok, "the classes minus the loans give the net worth");
  assert.deepStrictEqual(e.lines.map((l) => l.label), ["Mutual funds", "Indian shares & ETFs", "US shares", "Gold", "Fixed deposits", "Loans and dues"], "only classes held, then what is owed");
  assert.ok(/locked at the official close/.test(e.lines[0].note) && /live prices/.test(e.lines[1].note) && /₹94\.93 a dollar/.test(e.lines[2].note));
  assert.strictEqual(X.netWorth({ ...snap, netWorth: 999 }).check.ok, true, "₹1 of rounding is fine");
  assert.strictEqual(X.netWorth({ ...snap, netWorth: 900 }).check.ok, false, "a net worth the parts do not give is flagged");
}

// Savings rate
{
  const e = X.savings({ salaryRows: [{ who: "Prafful", date: "2026-09-30", amount: 199884 }, { who: "Archana", date: "2026-09-30", amount: 56986 }], spent: 138312, count: 59, monthLabel: "October 2026", salaryLabel: "Sept 2026", rate: 46 });
  assert.ok(e.check.ok);
  assert.deepStrictEqual([e.result.value, e.result.extra], [118558, "46%"], "₹2,56,870 − ₹1,38,312 = ₹1,18,558, 46%");
  assert.strictEqual(X.savings({ salaryRows: [{ who: "P", date: "x", amount: 100 }], spent: 60, count: 1, monthLabel: "m", rate: 50 }).check.ok, false, "the screen's 50% against 40% from the lines: flagged");
}

// Goal
{
  const e = X.goal({ name: "Home", target: 20000000, saved: 2000000, dueDate: "2028-05-26" }, { months: 20, perMonth: 900000 });
  assert.ok(e.check.ok);
  assert.ok(/₹1,80,00,000 ÷ 20 months to 2028-05-26/.test(e.formula) && e.result.extra === "₹9,00,000 a month");
  assert.strictEqual(X.goal({ name: "x", target: 100, saved: 0, dueDate: "d" }, { months: 2, perMonth: 80 }).check.ok, false, "a monthly need that does not fit is flagged");
}

// Tax: the explanation is the engine's own working, and its steps reproduce the total
{
  const inc = ["2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01"].map((d) => ({ id: d, person: "Me", date: d, type: "Salary", grossEarnings: 300000, basicSalary: 120000, taxTds: 50000, amount: 230000 }));
  const st = { income: inc, taxProfile: { otherIncome: { Me: 22300 } }, mutualFunds: [] };
  const m = H.build(st, "2026-10-20"), me = m.people.find((p) => p.who === "Me");
  const e = X.tax(me);
  assert.ok(e && e.check.ok, `the tax steps add up to ${me.plan.regimes[me.plan.better].tax}: ${e && JSON.stringify(e.check)}`);
  assert.strictEqual(e.result.value, me.plan.regimes[me.plan.better].tax, "the same figure the Tax page shows");
  assert.ok(e.sections[0].check.ok, "the income steps add up to the total income: " + JSON.stringify(e.sections[0].check));
  assert.ok(e.sections[0].lines.some((l) => l.label === "Standard deduction" && l.value === 75000), "₹75,000 standard deduction shown");
  assert.ok(e.sections[0].lines.some((l) => l.label === "Interest and dividends" && l.value === 22300));
  assert.strictEqual(e.after[0].value, me.plan.tdsProjected);
  assert.strictEqual(X.tax({ plan: null }), null, "no plan: nothing to explain");
}
console.log("explain tests passed");
