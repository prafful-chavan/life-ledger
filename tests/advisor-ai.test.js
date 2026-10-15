const assert = require("assert");
const AI = require("../advisor-ai.js");

const result = {
  asOf: "2026-10-15", score: 72,
  metrics: { total: 1000000, allocation: { equity: 70 } },
  holdings: Array.from({ length: 40 }, (_, i) => ({ key: "h" + i, name: "H" + i, value: 1000 - i })),
  signals: [
    { id: "conc-AAA", severity: "act", action: "TRIM", title: "AAA is 20%", why: ["A single stock above 10% adds risk."], confidence: "high", assetKey: "AAA" },
    { id: "drift-equity", severity: "watch", action: "REBALANCE", title: "Equity over target", why: ["Now 70% vs 65%."], confidence: "high" },
  ],
};
const input = { cash: { monthlyIncome: 100 }, liabilities: [], goals: [], profile: {}, mfThisMonth: 1234.7 };

// brief: capped holdings, signals carried with ids
const brief = AI.buildBrief(result, input);
assert.strictEqual(brief.holdings.length, 30);
assert.strictEqual(brief.moreHoldings, 10);
assert.strictEqual(brief.signals[0].id, "conc-AAA");
assert.strictEqual(brief.mfInvestedThisMonth, 1235);
JSON.parse(JSON.stringify(brief));
assert.ok(!/email|phone|account number/i.test(JSON.stringify(brief)), "no identifiers in the brief");

// a good answer is accepted; evidence comes from the engine, not the model
const good = { headline: "Equity-heavy with one concentrated stock", healthComment: "Fine overall.", actions: [
  { priority: 2, signalIds: ["drift-equity"], action: "rebalance", asset: "Equity", summary: "Steer new SIPs to debt/gold", rationale: "Equity is 70% vs 65% target.", risk: "Cash drag.", confidence: "high" },
  { priority: 1, signalIds: ["conc-AAA"], action: "TRIM", asset: "AAA", summary: "Trim in stages", rationale: "20% of portfolio.", risk: "Tax on gains.", confidence: "medium", evidence: ["MODEL MADE THIS UP: stock will double"] },
], nextMonthPlan: ["Keep the SIP", "Add to debt"], taxNote: "Check STCG before selling." };
let v = AI.validateReview(good, result);
assert.strictEqual(v.review.actions.length, 2);
assert.strictEqual(v.review.actions[0].action, "TRIM", "sorted by priority");
assert.ok(!JSON.stringify(v.review).includes("MODEL MADE THIS UP"), "model-supplied evidence is ignored");
assert.deepStrictEqual(JSON.parse(JSON.stringify(v.review.actions[0].evidence)), ["A single stock above 10% adds risk."]);
assert.strictEqual(v.review.actions[1].action, "REBALANCE", "action names are normalised");
assert.ok(v.review.disclaimer.includes("not SEBI"));

// invented or ungrounded actions are dropped
v = AI.validateReview({ headline: "x", actions: [
  { signalIds: ["made-up"], action: "ADD", asset: "XYZ" },
  { signalIds: [], action: "ADD" },
  { signalIds: ["conc-AAA"], action: "MOONSHOT" },
  { signalIds: ["conc-AAA"], action: "TRIM", rationale: "r".repeat(5000) },
] }, result);
assert.strictEqual(v.review.actions.length, 1);
assert.strictEqual(v.dropped.length, 3);
assert.ok(v.review.actions[0].rationale.length <= 600, "overlong text is trimmed");

// junk is an error, not a crash
assert.throws(() => AI.validateReview(null, result));
assert.throws(() => AI.validateReview({ actions: [{ signalIds: ["nope"], action: "ADD" }] }, result));

// fingerprint: stable for noise, changes for real movement
const fp = AI.fingerprint(result);
assert.strictEqual(AI.fingerprint({ ...result, metrics: { total: 1000200 } }), fp, "0.02% move is noise");
assert.notStrictEqual(AI.fingerprint({ ...result, metrics: { total: 1030000 } }), fp, "3% move matters");
assert.notStrictEqual(AI.fingerprint({ ...result, signals: result.signals.slice(1) }), fp, "a different signal set matters");

assert.ok(AI.SYSTEM_PROMPT.includes("Never invent prices"));
console.log("advisor-ai tests passed");
