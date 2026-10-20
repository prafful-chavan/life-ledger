const assert = require("assert");
const AI = require("../ai-agent.js");

const state = { income: [], expenses: [], assets: [], liabilities: [], mutualFunds: [], stocks: [], usstocks: [], goals: [], tasks: [], studies: [], workouts: [], activities: [], habits: [], chat: [], fitnessGoals: { dailySteps: 10000, activeCalories: 500, activeMinutes: 45, weeklyCyclingKm: 50 } };

const base = AI.buildDataContext(state);
assert.ok(base.includes("COMPLETE LIFE DATA"));

AI.setContextProvider(() => "=== PORTFOLIO INTELLIGENCE ===\nHOLDINGS: test");
const withExtra = AI.buildDataContext(state);
assert.ok(withExtra.startsWith(base), "base context is unchanged");
assert.ok(withExtra.includes("PORTFOLIO INTELLIGENCE"), "advisor briefing is appended");

AI.setContextProvider(() => { throw new Error("boom"); });
assert.strictEqual(AI.buildDataContext(state), base, "a failing provider never breaks the chat");
AI.setContextProvider(() => "");
assert.strictEqual(AI.buildDataContext(state), base, "empty briefing adds nothing");
AI.setContextProvider(null);

const payload = AI.buildGeminiPayload("should I add to TCS?", "CTX");
assert.ok(payload.systemInstruction.parts[0].text.includes("HOW TO ANSWER PORTFOLIO & INVESTMENT QUESTIONS"));
assert.ok(payload.systemInstruction.parts[0].text.includes("SEBI-registered"));
// The AI must quote the same net worth as every screen (single source), not its own recomputation.
global.window = { LifeLedgerApp: { getNetWorthSnapshot: () => ({ netWorth: 12345678, totalAssets: 12500000, totalLiabilities: 154322, mutualFunds: 5000000, stocks: 7500000 }) } };
const official = AI.buildDataContext(state);
assert.ok(official.includes("Net Worth: ₹1,23,45,678"), "uses the app's net worth: " + official.slice(0, 400));
assert.ok(official.includes("Stocks: ₹75,00,000"), "uses the app's class values");
global.window = { LifeLedgerApp: { getNetWorthSnapshot: () => { throw new Error("x"); } } };
assert.ok(AI.buildDataContext(state).includes("Net Worth:"), "falls back when the app figure is unavailable");
delete global.window;
// Salary-cycle rule: no income yet this month -> the latest month's salary is set against this month's spending
{
  const d = new Date(), ym = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
  const cur = ym(d.getFullYear(), d.getMonth() + 1), pd = new Date(d.getFullYear(), d.getMonth() - 1, 15), prev = ym(pd.getFullYear(), pd.getMonth() + 1);
  const s = { ...state, income: [{ date: `${prev}-28`, amount: 200000, person: "Me" }, { date: `${prev}-30`, amount: 50000, person: "Wife" }], expenses: [{ date: `${cur}-05`, amount: 100000, category: "Rent" }] };
  const ctx = AI.buildDataContext(s);
  assert.ok(ctx.includes("Income: ₹2,50,000") && ctx.includes(`${prev} salary, which pays for this month's spending`), "latest salary used: " + ctx.slice(ctx.indexOf("THIS MONTH"), ctx.indexOf("THIS MONTH") + 260));
  assert.ok(ctx.includes("Savings Rate: 60%"), "savings rate from that salary");
  const withNow = AI.buildDataContext({ ...s, income: [...s.income, { date: `${cur}-01`, amount: 10, person: "Me" }] });
  assert.ok(withNow.includes("Income: ₹10 (1 entries)"), "income credited this month is used as is");
}
console.log("ai-context tests passed");
