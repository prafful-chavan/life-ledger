const assert = require("assert");
const AI = require("../advisor-ai.js");

const result = {
  asOf: "2026-10-15", score: 72,
  metrics: { total: 1000000, allocation: { equity: 70 } },
  holdings: Array.from({ length: 40 }, (_, i) => ({ key: "h" + i, name: "H" + i, value: 1000 - i })),
  signals: [
    { id: "conc-AAA", severity: "act", action: "TRIM", actionLabel: "Reduce", title: "AAA is 20%", why: ["A single stock above 10% adds risk."], confidence: "high", assetKey: "AAA" },
    { id: "drift-equity", severity: "watch", action: "REBALANCE", actionLabel: "Balance", title: "Equity over target", why: ["Now 70% vs 65%."], confidence: "high" },
  ],
  pillars: [{ id: "safety", label: "Safety net", score: 80, line: "ok" }], strengths: ["Good savings"], profileSet: true,
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
const good = { summary: "Solid base, one stock is too big.", good: ["You save well"], watchOut: ["AAA is large"], moves: [
  { priority: 2, signalIds: ["drift-equity"], action: "rebalance", title: "Put new money elsewhere", whatToDo: "Steer new SIPs to debt/gold", why: "Equity is 70% vs your 65% plan.", risk: "Cash drag.", confidence: "high" },
  { priority: 1, signalIds: ["conc-AAA"], action: "TRIM", title: "AAA is too big", whatToDo: "Reduce in stages", why: "20% of your money.", risk: "Tax on gains.", confidence: "medium", evidence: ["MODEL MADE THIS UP: stock will double"] },
], perHolding: [{ key: "h1", comment: "Doing fine; keep holding." }, { key: "not-real", comment: "invented" }], nextMonthPlan: ["Keep the SIP", "Add to debt"], taxNote: "Check STCG before selling." };
let v = AI.validateReview(good, result);
assert.strictEqual(v.review.moves.length, 2);
assert.strictEqual(v.review.moves[0].action, "TRIM", "sorted by priority");
assert.strictEqual(v.review.moves[0].actionLabel, "Reduce", "friendly label comes from the engine");
assert.ok(!JSON.stringify(v.review).includes("MODEL MADE THIS UP"), "model-supplied evidence is ignored");
assert.deepStrictEqual(JSON.parse(JSON.stringify(v.review.moves[0].evidence)), ["A single stock above 10% adds risk."]);
assert.strictEqual(v.review.moves[1].action, "REBALANCE", "action names are normalised");
assert.deepStrictEqual(JSON.parse(JSON.stringify(Object.keys(v.review.holdingNotes))), ["h1"], "notes for unknown holdings are dropped");
assert.strictEqual(v.review.summary, "Solid base, one stock is too big.");
assert.ok(v.review.disclaimer.includes("not SEBI"));
// the earlier schema (actions/headline) still loads
v = AI.validateReview({ headline: "Old style", actions: [{ signalIds: ["conc-AAA"], action: "TRIM", summary: "Trim", rationale: "r" }] }, result);
assert.strictEqual(v.review.summary, "Old style");
assert.strictEqual(v.review.moves[0].title, "Trim");

// invented or ungrounded moves are dropped
v = AI.validateReview({ summary: "x", moves: [
  { signalIds: ["made-up"], action: "ADD", title: "XYZ" },
  { signalIds: [], action: "ADD" },
  { signalIds: ["conc-AAA"], action: "MOONSHOT" },
  { signalIds: ["conc-AAA"], action: "TRIM", why: "r".repeat(5000) },
] }, result);
assert.strictEqual(v.review.moves.length, 1);
assert.strictEqual(v.dropped.length, 3);
assert.ok(v.review.moves[0].why.length <= 480, "overlong text is trimmed");

// junk is an error, not a crash
assert.throws(() => AI.validateReview(null, result));
assert.throws(() => AI.validateReview({ moves: [{ signalIds: ["nope"], action: "ADD" }] }, result));

// fingerprint: stable for noise, changes for real movement
const fp = AI.fingerprint(result);
assert.strictEqual(AI.fingerprint({ ...result, metrics: { ...result.metrics, total: 1000200 } }), fp, "0.02% move is noise");
assert.notStrictEqual(AI.fingerprint({ ...result, metrics: { ...result.metrics, total: 1030000 } }), fp, "3% move matters");
assert.notStrictEqual(AI.fingerprint({ ...result, signals: result.signals.slice(1) }), fp, "a different signal set matters");
{
  const m = { total: 1000000, allocation: { equity: 45.4, gold: 17.6 } };
  const base = AI.fingerprint({ ...result, metrics: m });
  assert.strictEqual(AI.fingerprint({ ...result, metrics: { ...m, allocation: { equity: 45.1, gold: 17.8 } } }), base, "fractions of a % are noise");
  assert.notStrictEqual(AI.fingerprint({ ...result, metrics: { ...m, allocation: { equity: 43.3, gold: 19.8 } } }), base, "a real shift in the asset mix refreshes the advice");
  const g = (title) => ({ ...result, metrics: m, signals: [...result.signals, { id: "goal-X", severity: "info", title }] });
  assert.notStrictEqual(AI.fingerprint(g("needs ₹6,15,385 a month")), AI.fingerprint(g("needs ₹6,58,162 a month")), "goal figures matter");
}

assert.ok(AI.SYSTEM_PROMPT.includes("Never invent prices"));
assert.ok(AI.SYSTEM_PROMPT.includes("BUSY NON-EXPERT") && AI.SYSTEM_PROMPT.includes("Do not quote the health score"));
assert.ok(brief.pillars && brief.strengths && brief.planSetByUser === true);
console.log("advisor-ai tests passed");
