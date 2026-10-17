const assert = require("assert");
const H = require("../hero-series.js");

const hist = [
  { date: "2026-10-12", netWorth: 13273577 },
  { date: "2026-10-10", netWorth: 13286401 },
  { date: "2026-09-01", netWorth: 12500000 },
  { date: "2025-09-01", netWorth: 10000000 },
  { date: "bad", netWorth: 5 },
  { date: "2026-10-11", netWorth: "oops" },
  null,
];

// Sorted oldest first, junk dropped
let all = H.buildSeries(hist, null, "2026-10-17", "All");
assert.deepStrictEqual(all.map((p) => p.date), ["2025-09-01", "2026-09-01", "2026-10-10", "2026-10-12"]);

// Today is always the live value (replaces a stored row of the same day)
const withToday = H.buildSeries([...hist, { date: "2026-10-17", netWorth: 1 }], 13382623, "2026-10-17", "All");
assert.strictEqual(withToday[withToday.length - 1].date, "2026-10-17");
assert.strictEqual(withToday[withToday.length - 1].value, 13382623);

// Ranges cut by calendar days
assert.deepStrictEqual(H.buildSeries(hist, 13382623, "2026-10-17", "1W").map((p) => p.date), ["2026-10-10", "2026-10-12", "2026-10-17"]);
assert.deepStrictEqual(H.buildSeries(hist, 13382623, "2026-10-17", "1M").map((p) => p.date), ["2026-10-10", "2026-10-12", "2026-10-17"], "1 Sep is older than 30 days");
assert.strictEqual(H.buildSeries(hist, 13382623, "2026-10-17", "1Y").length, 4, "2025-09-01 is over a year ago");
assert.strictEqual(H.buildSeries(hist, 13382623, "2026-10-17", "3M").length, 4);

// Nothing / bad input never throws
assert.deepStrictEqual(H.buildSeries(null, null, "2026-10-17", "1M"), []);
assert.deepStrictEqual(H.buildSeries([], NaN, "2026-10-17", "All"), []);
assert.strictEqual(H.summarize([]), null);
assert.strictEqual(H.summarize([{ date: "2026-10-01", value: 5 }]), null);

// Summary
const s = H.summarize([{ date: "2026-10-10", value: 100 }, { date: "2026-10-12", value: 90 }, { date: "2026-10-17", value: 110 }]);
assert.strictEqual(s.change, 10);
assert.strictEqual(Math.round(s.pct * 10) / 10, 10);
assert.strictEqual(s.from, "2026-10-10");
assert.strictEqual(H.summarize([{ date: "a", value: 0 }, { date: "b", value: 5 }]).pct, null, "no percentage from a zero start");

assert.strictEqual(H.addDays("2026-03-01", -1), "2026-02-28");
assert.strictEqual(H.addDays("2026-12-31", 1), "2027-01-01");
console.log("hero-series tests passed");
