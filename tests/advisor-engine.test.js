const assert = require("assert");
const A = require("../advisor-engine.js");

const NOW = "2026-10-15";
const DAY = 86400000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);

// daily series ending at NOW; f(i, n) gives the close for day i of n
function series(n, f) {
  const end = new Date(NOW).getTime();
  const dates = [], closes = [];
  for (let i = 0; i < n; i++) { dates.push(iso(end - (n - 1 - i) * DAY)); closes.push(f(i, n)); }
  return { dates, closes };
}
const flat = (v) => series(400, () => v);
const ramp = (a, b) => series(400, (i, n) => a + ((b - a) * i) / (n - 1));
// rises to a peak at `peakAt` then falls to `end`
const peakThen = (start, peak, end, peakAt = 300) => series(400, (i, n) => (i <= peakAt ? start + ((peak - start) * i) / peakAt : peak + ((end - peak) * (i - peakAt)) / (n - 1 - peakAt)));

const H = (o) => ({ cls: "stock", owner: "Me", invested: o.value, ...o });
// A balanced portfolio on the default target (65 equity / 10 gold / 20 debt / 5 cash), ₹10 lakh
const base = (over = {}) => ({
  now: NOW,
  holdings: [
    H({ key: "BANK", cls: "bank", name: "Savings", value: 50000 }),
    H({ key: "FD1", cls: "fd", name: "FD", value: 200000 }),
    H({ key: "GOLD1", cls: "gold", name: "Sovereign Gold Bond", value: 100000 }),
    H({ key: "NIFTYBEES", cls: "mf", name: "Nifty 50 Index Fund", value: 600000 }),
    H({ key: "TCS", cls: "stock", name: "TCS", value: 50000 }),
  ],
  series: {}, benchmarks: { nifty: ramp(100, 110) },
  cash: { monthlyIncome: 150000, monthlyExpenses: 30000, savingsRate: 60, topCategories: [["Rent", 20000]] },
  liabilities: [], goals: [], profile: {}, mfThisMonth: 0,
  ...over,
});
const ids = (r) => r.signals.map((s) => s.id);
const find = (r, id) => r.signals.find((s) => s.id === id);

// ── maths ─────────────────────────────────────────────────────────────
const x = A.xirr([{ date: "2025-10-15", amount: -100000 }], 121000, NOW);
assert.ok(Math.abs(x - 21) < 0.5, "xirr ≈ 21%");
assert.strictEqual(A.xirr([{ date: "2025-10-15", amount: -100 }], 0, NOW), null, "a total loss has no defined XIRR");
const m = A.momentum(peakThen(100, 200, 120), NOW);
assert.ok(Math.abs(m.drawdown - -40) < 1, "drawdown ≈ -40%");
assert.ok(m.r6m < 0, "falling for the last ~100 days");
assert.ok(m.r1y > 0, "still up over the year");
assert.strictEqual(A.groupOf({ cls: "mf", name: "HDFC Liquid Fund" }), "debt");
assert.strictEqual(A.groupOf({ cls: "mf", name: "ICICI Balanced Advantage" }), "hybrid");
assert.strictEqual(A.kindOf({ cls: "mf", name: "UTI Nifty 50 Index Fund" }), "index");
assert.strictEqual(A.kindOf({ cls: "mf", name: "Parag Parikh Flexi Cap" }), "active");

// ── healthy baseline: nothing urgent ──────────────────────────────────
let r = A.analyze(base());
assert.ok(!r.signals.some((s) => s.severity === "act"), "baseline has no urgent signal");
assert.ok(r.score >= 85);

// ── emergency fund ────────────────────────────────────────────────────
r = A.analyze(base({ holdings: [H({ key: "BANK", cls: "bank", name: "Savings", value: 60000 }), H({ key: "X", cls: "mf", name: "Flexi Cap", value: 1000000 })] }));
assert.strictEqual(find(r, "emergency-fund").severity, "act");
assert.strictEqual(find(r, "emergency-fund").action, "BUILD");
r = A.analyze(base({ holdings: [H({ key: "BANK", cls: "bank", name: "Savings", value: 120000 }), H({ key: "X", cls: "mf", name: "Flexi Cap", value: 1000000 })] }));
assert.strictEqual(find(r, "emergency-fund").severity, "watch");

// ── debt cost ─────────────────────────────────────────────────────────
r = A.analyze(base({ liabilities: [{ name: "Personal loan", value: 300000, rate: 14 }, { name: "Car loan", value: 500000, rate: 9 }, { name: "Home loan", value: 3000000, rate: 7 }] }));
assert.strictEqual(find(r, "debt-Personal loan").action, "PREPAY");
assert.strictEqual(find(r, "debt-Personal loan").severity, "act");
assert.strictEqual(find(r, "debt-Car loan").severity, "watch");
assert.ok(!find(r, "debt-Home loan"), "cheap debt is left alone");

// ── concentration + allocation drift ──────────────────────────────────
r = A.analyze(base({ holdings: [H({ key: "BANK", cls: "bank", name: "Savings", value: 200000 }), H({ key: "AAA", cls: "stock", name: "AAA Ltd", value: 500000 }), H({ key: "IDX", cls: "mf", name: "Nifty Index", value: 1300000 })] }));
assert.strictEqual(find(r, "conc-AAA").action, "TRIM");
assert.strictEqual(find(r, "conc-AAA").severity, "act");
const drift = find(r, "drift-equity");
assert.ok(drift && drift.title.includes("over"));
assert.ok(find(r, "drift-debt").title.includes("under"));

// ── trend signals need history ────────────────────────────────────────
const deepFall = peakThen(100, 200, 110);
r = A.analyze(base({ holdings: [...base().holdings, H({ key: "FALL", cls: "stock", name: "Falling Co", value: 100000, invested: 150000 })], series: { FALL: deepFall }, benchmarks: { nifty: ramp(100, 112) } }));
assert.strictEqual(find(r, "trend-FALL").severity, "act");
assert.strictEqual(find(r, "trend-FALL").action, "REVIEW");
assert.ok(find(r, "trend-FALL").why.join(" ").includes("exit candidate"), "explains what would justify an exit");
assert.ok(find(r, "trend-FALL").title.includes("thesis"));

const shortHistory = series(60, (i) => 200 - i); // only 60 days
r = A.analyze(base({ holdings: [...base().holdings, H({ key: "NEW", cls: "stock", name: "New Co", value: 100000 })], series: { NEW: shortHistory } }));
assert.ok(!find(r, "trend-NEW"), "no trend call on thin history");

// index fund dip = opportunity (ADD in tranches), never a panic signal
r = A.analyze(base({ series: { NIFTYBEES: peakThen(100, 130, 115) } }));
assert.strictEqual(find(r, "dip-NIFTYBEES").action, "ADD");
assert.strictEqual(find(r, "dip-NIFTYBEES").severity, "info");

// active fund lagging Nifty
r = A.analyze(base({ holdings: [...base().holdings, H({ key: "ACT", cls: "mf", name: "Some Active Equity Fund", value: 200000 })], series: { ACT: flat(100) }, benchmarks: { nifty: ramp(100, 125) } }));
assert.strictEqual(find(r, "lag-ACT").severity, "act");

// stretched stock
r = A.analyze(base({ holdings: [H({ key: "BANK", cls: "bank", name: "Savings", value: 600000 }), H({ key: "IDX", cls: "mf", name: "Nifty Index", value: 400000 }), H({ key: "HOT", cls: "stock", name: "Hot Co", value: 100000 })], series: { HOT: series(400, (i) => (i < 300 ? 100 : 100 + (i - 300) * 4)) } }));
assert.strictEqual(find(r, "ext-HOT").action, "HOLD");

// gold dip while under target
r = A.analyze(base({ holdings: base().holdings.map((h) => (h.key === "GOLD1" ? { ...h, value: 30000 } : h)), benchmarks: { nifty: ramp(100, 110), gold: peakThen(100, 150, 135) } }));
assert.strictEqual(find(r, "gold-dip").action, "ADD");

// ── cash-flow behaviour ───────────────────────────────────────────────
r = A.analyze(base({ cash: { monthlyIncome: 100000, monthlyExpenses: 90000, savingsRate: 10, topCategories: [["Rent", 40000]] } }));
assert.strictEqual(find(r, "savings-low").action, "BUILD");
r = A.analyze(base({ profile: { sipTarget: 100000 }, mfThisMonth: 20000 }));
assert.strictEqual(find(r, "sip-gap").severity, "watch");
r = A.analyze(base({ goals: [{ name: "Car", target: 1200000, saved: 0, dueDate: "2027-01-15" }] }));
assert.ok(find(r, "goal-Car"), "an unrealistic goal date is flagged");

// ── scoring and ordering ──────────────────────────────────────────────
const bad = A.analyze(base({ holdings: [H({ key: "BANK", cls: "bank", name: "Savings", value: 50000 }), H({ key: "AAA", cls: "stock", name: "AAA", value: 2000000 })], liabilities: [{ name: "PL", value: 400000, rate: 16 }] }));
assert.ok(bad.score < 70, "multiple urgent problems lower the score");
assert.strictEqual(bad.signals[0].severity, "act", "urgent signals come first");

// output is plain data (safe to send to an AI or store)
JSON.parse(JSON.stringify(bad));
assert.ok(bad.metrics.allocation.equity > 90);

console.log("advisor-engine tests passed");
