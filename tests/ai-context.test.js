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
console.log("ai-context tests passed");
