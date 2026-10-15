const assert = require("assert");
const M = require("../knowledge-modules.js");
const K = require("../knowledge.js");

const state = {
  income: [{ date: "2021-03-01", amount: 100000 }, { date: "2021-04-01", amount: 100000 }, { date: "2022-01-01", amount: 120000 }],
  expenses: [
    { date: "2021-03-05", category: "Rent", paidBy: "Me", amount: 40000 }, { date: "2021-03-09", category: "Eating Out", paidBy: "Wife", amount: 10000 },
    { date: "2021-04-05", category: "Rent", paidBy: "Me", amount: 40000 }, { date: "2022-01-05", category: "Rent", paidBy: "Me", amount: 45000 },
  ],
  netWorthHistory: [
    { date: "2025-01-31", netWorth: 1000000, totalAssets: 1100000, totalLiabilities: 100000 },
    { date: "2025-02-10", netWorth: 1100000, totalAssets: 1200000, totalLiabilities: 100000 },
    { date: "2025-02-28", netWorth: 1050000, totalAssets: 1150000, totalLiabilities: 100000 },
    { date: "2026-01-31", netWorth: 1500000, totalAssets: 1600000, totalLiabilities: 100000 },
  ],
  workouts: [{ date: "2026-10-12", type: "Strength", minutes: 45 }, { date: "2026-10-13", type: "Yoga", minutes: 30 }, { date: "2026-10-14", type: "Strength", minutes: 40 }, { date: "2026-10-01", type: "Yoga", minutes: 20 }],
  activities: [{ date: "2026-10-14", type: "running", durationMin: 25 }],
};

const cf = M.cashflowHistory(state);
assert.ok(cf.includes("2021-03 to 2022-01"));
assert.ok(cf.includes("2021: income ₹2,00,000, expenses ₹90,000"), "yearly totals");
assert.ok(cf.includes("saved ₹1,10,000 (55%)"));
assert.ok(cf.includes("By payer: Me ₹80,000, Wife ₹10,000"));
assert.ok(cf.includes("2021-03: ₹1,00,000 / ₹50,000 / ₹50,000"), "every month is listed");
assert.ok(cf.includes("2022-01"), "all years, not just the last 12 months");
assert.strictEqual(M.cashflowHistory({}), "No income or expense history recorded.");

const nw = M.networthHistory(state);
assert.ok(nw.includes("4 daily records from 2025-01-31 to 2026-01-31"));
assert.ok(nw.includes("Peak ₹15,00,000 on 2026-01-31"));
assert.ok(nw.includes("Compound annual growth"));
assert.ok(nw.includes("2025-02: ₹10,50,000"), "month-end value wins over mid-month");
assert.ok(nw.includes("Biggest rise between records: ₹4,50,000"));

const fit = M.fitnessOverview(state, "2026-10-14");
assert.ok(fit.includes("5 sessions on 4 distinct days"));
assert.ok(fit.includes("Current streak 3 day(s); longest streak 3 day(s)"));
assert.ok(fit.includes("2026-10: 4 days, 160 min"));
assert.ok(M.fitnessOverview({}).includes("No exercise"));

// registration plugs into the knowledge layer and is callable as a tool
M.register(K, () => "2026-10-14", () => "portfolio text");
const cat = K.catalog(state);
assert.deepStrictEqual(cat.modules.map((m) => m.id).sort(), ["cashflow_history", "fitness_overview", "networth_history", "portfolio"]);
assert.strictEqual(K.runTool("get_module", { id: "portfolio" }, state).text, "portfolio text");
assert.ok(K.runTool("get_module", { id: "cashflow_history" }, state).text.includes("CASH-FLOW HISTORY"));
["cashflow_history", "fitness_overview", "networth_history", "portfolio"].forEach((id) => K.unregisterModule(id));

console.log("knowledge-modules tests passed");
