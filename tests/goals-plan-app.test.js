const assert = require("assert");
const app = require("../app.js");

// Household with two salaries and steady spending; goals include a portfolio goal that follows all assets
const income = [];
for (const m of ["2026-08", "2026-09", "2026-10"]) {
  income.push({ person: "Me", type: "Salary", date: m + "-28", netSalary: 200000 });
  income.push({ person: "Wife", type: "Salary", date: m + "-28", netSalary: 60000 });
}
const expenses = [];   // the six full months before whatever month it is now, so the test never depends on the date
const now = new Date(Date.now() + 5.5 * 3600e3);   // India date, as the app uses
for (let i = 1; i <= 6; i++) expenses.push({ date: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 10)).toISOString().slice(0, 10), amount: 90000, category: "Home" });
app.__setStateForTest({
  income, expenses, mutualFunds: [], stocks: [], gold: [], assets: [], liabilities: [],
  ruleSettings: {},
  goals: [
    { id: "f", name: "Farm", owner: "Both", target: 15000000, saved: 0, dueDate: "2030-12-31" },
    { id: "w", name: "Weight", owner: "Me", kind: "score", target: 100, saved: 10 },
    { id: "i", name: "Business", owner: "Wife", kind: "income", target: 400000, saved: 0 },
    { id: "g", name: "Gaming", owner: "Me", target: 0, saved: 0, dueDate: "2030-12-31" },
  ],
});
const o = app.goalsPlanOptions();
assert.strictEqual(o.takeHomeMonthly, 260000, "both salaries, the steady month");
assert.strictEqual(o.spendMonthly, 90000, "average of the last six full months");
assert.strictEqual(o.growthPct, 0, "no growth unless the household sets it");
const p = app.goalsPlan();
assert.strictEqual(p.items.length, 1);
assert.strictEqual(p.notMoney.length, 2);
assert.strictEqual(p.needsAmount.length, 1);
assert.ok(p.savePerDay > 0 && p.earn.needPerMonth === 90000 + p.savePerMonth);
assert.strictEqual(p.earn.canSavePerMonth, 170000);

// the growth setting is read from the household's settings
app.__setStateForTest({ income, expenses, mutualFunds: [], stocks: [], gold: [], assets: [], liabilities: [], ruleSettings: { goalGrowthPct: 12 }, goals: [] });
assert.strictEqual(app.goalsPlanOptions().growthPct, 12);
console.log("goals-plan-app tests passed");
