const assert = require("assert");
const { computeDeltas } = require("../networth-delta.js");

// Numbers taken from a real 3-day sequence (rounded): net worth fell slightly each day
// even though the market-move figure was positive.
const h = [
  { id: "a", date: "2026-10-11", netWorth: 13278997.14, totalAssets: 13419461.14, totalLiabilities: 140464, mutualFunds: 4340153.44, stocks: 1542825.24, usStocks: 198809.42, gold: 2405017.04, others: 4932656 },
  { id: "b", date: "2026-10-12", netWorth: 13266664.28, totalAssets: 13407128.28, totalLiabilities: 140464, mutualFunds: 4340153.44, stocks: 1537482.06, usStocks: 198809.42, gold: 2398027.36, others: 4932656 },
  { id: "c", date: "2026-10-13", netWorth: 13253527.64, totalAssets: 13393991.64, totalLiabilities: 140464, mutualFunds: 4341192.14, stocks: 1551780.31, usStocks: 197177.1, gold: 2371186.09, others: 4932656 },
];
// Order of input must not matter
const d = computeDeltas([h[2], h[0], h[1]]);
assert.strictEqual(d.has("a"), false, "first snapshot has nothing to compare with");
assert.strictEqual(d.get("b").change, -12332.86);
assert.strictEqual(d.get("c").change, -13136.64);
assert.strictEqual(d.get("b").prevDate, "2026-10-11");
assert.strictEqual(d.get("b").gapDays, 1);
assert.ok(d.get("b").pct < 0);
assert.strictEqual(d.get("c").parts.mutualFunds, 1038.7);
assert.strictEqual(d.get("c").parts.gold, -26841.27);

// The parts explain the whole change when nothing else moved
const sum = (p) => Object.values(p).reduce((s, v) => s + v, 0);
assert.ok(Math.abs(sum(d.get("c").parts) - d.get("c").change) < 0.05);

// Liabilities rising lowers net worth; gaps are reported
const g = computeDeltas([
  { date: "2026-10-01", netWorth: 100, totalLiabilities: 10 },
  { date: "2026-10-04", netWorth: 90, totalLiabilities: 20 },
]);
const e = g.get("2026-10-04");
assert.strictEqual(e.change, -10);
assert.strictEqual(e.parts.liabilities, -10);
assert.strictEqual(e.gapDays, 3);

console.log("networth-delta tests passed");
