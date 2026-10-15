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
console.log("ai-context tests passed");
