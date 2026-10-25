// The choices behind the Salary and Spending dashboards: bad values never get through, setters never change their input.
const assert = require("assert");
const D = require("../dashboard-settings.js");

// ── inflation: 0 to 30, text or number ──
assert.strictEqual(D.parseInflation(5), 5); assert.strictEqual(D.parseInflation("7.5"), 7.5); assert.strictEqual(D.parseInflation("6%"), 6, "a % sign is fine");
assert.strictEqual(D.parseInflation(0), 0, "0% is a real choice"); assert.strictEqual(D.parseInflation("30"), 30, "30 is allowed"); assert.strictEqual(D.parseInflation("30.01"), null, "over 30 is not");
assert.strictEqual(D.parseInflation(-0.01), null, "below 0 is not"); assert.strictEqual(D.parseInflation(""), null); assert.strictEqual(D.parseInflation("  "), null); assert.strictEqual(D.parseInflation(null), null);
assert.strictEqual(D.parseInflation("abc"), null); assert.strictEqual(D.parseInflation(NaN), null); assert.strictEqual(D.parseInflation(Infinity), null);

// ── budget: whole rupees above 0 up to ₹10 crore ──
assert.strictEqual(D.parseBudget(15000), 15000); assert.strictEqual(D.parseBudget("₹1,50,000"), 150000, "rupee signs and commas are read"); assert.strictEqual(D.parseBudget("1234.6"), 1235, "rounded to whole rupees");
assert.strictEqual(D.parseBudget(0), null); assert.strictEqual(D.parseBudget(-5), null); assert.strictEqual(D.parseBudget("abc"), null); assert.strictEqual(D.parseBudget(""), null, "blank is not a budget"); assert.strictEqual(D.parseBudget(null), null);
assert.strictEqual(D.parseBudget(100000000), 100000000, "up to ₹10 crore"); assert.strictEqual(D.parseBudget(100000001), null);
assert.strictEqual(D.parseBudget(0.4), null, "under half a rupee rounds to nothing: not a budget"); assert.strictEqual(D.parseBudget(0.5), 1);

// ── clean ──
const empty = { salary: { marks: {}, inflationPct: 5 }, spending: { budgets: {}, fixed: {} }, portfolio: { reference: "target", includeOther: false } };
for (const junk of [undefined, null, 5, "x", [], {}, { salary: 3, spending: [] }]) assert.deepStrictEqual(D.clean(junk), empty, JSON.stringify(junk));
const dirty = { salary: { marks: { Me: { "2024-03": "oneoff", "2024-13": "oneoff", "bad": "regular", "2024-04": "maybe", "2024-05": "regular" }, Wife: "x", Nobody: { "2024-01": "x" } }, inflationPct: "99" },
  spending: { budgets: { Food: "5000", Bad: "abc", Zero: 0, "": 100, " ": 100 }, fixed: { Rent: true, Food: "yes", Gym: false, "": true } } };
assert.deepStrictEqual(D.clean(dirty), { salary: { marks: { Me: { "2024-03": "oneoff", "2024-05": "regular" } }, inflationPct: 5 }, spending: { budgets: { Food: 5000 }, fixed: { Rent: true, Gym: false } }, portfolio: { reference: "target", includeOther: false } });
assert.strictEqual(D.clean({ salary: { inflationPct: 0 } }).salary.inflationPct, 0, "0% survives cleaning");
const good = D.clean(dirty); assert.deepStrictEqual(D.clean(good), good, "cleaning twice changes nothing");

// ── setters: new object, input untouched ──
const frozen = JSON.parse(JSON.stringify(good)); const before = JSON.stringify(frozen);
let s = D.setMark(frozen, "Me", "2024-06", "oneoff"); assert.strictEqual(s.salary.marks.Me["2024-06"], "oneoff"); assert.strictEqual(JSON.stringify(frozen), before, "the input is not changed");
s = D.setMark(s, "Me", "2024-06", "regular"); assert.strictEqual(s.salary.marks.Me["2024-06"], "regular");
s = D.setMark(s, "Me", "2024-06", null); assert.strictEqual("2024-06" in s.salary.marks.Me, false, "null goes back to the automatic rule");
s = D.setMark(D.setMark({}, "Wife", "2025-02", "oneoff"), "Wife", "2025-02", null); assert.deepStrictEqual(s.salary.marks, {}, "a person with no marks left is removed");
assert.deepStrictEqual(D.setMark({}, "Me", "nonsense", "oneoff"), empty, "a bad month changes nothing"); assert.deepStrictEqual(D.setMark({}, "", "2025-02", "oneoff"), empty, "no person changes nothing");
assert.deepStrictEqual(D.setMark({}, "Me", "2025-02", "weird").salary.marks, {}, "an unknown mark is the same as clearing");
assert.strictEqual(D.setInflation({}, "8").salary.inflationPct, 8); assert.strictEqual(D.setInflation({ salary: { inflationPct: 8 } }, "abc").salary.inflationPct, 8, "an invalid value keeps the old one"); assert.strictEqual(D.setInflation({ salary: { inflationPct: 8 } }, "").salary.inflationPct, 8, "blank keeps the old one");
assert.strictEqual(D.setInflation({ salary: { inflationPct: 8 } }, 0).salary.inflationPct, 0);
s = D.setBudget({}, "Food", "6,000"); assert.strictEqual(s.spending.budgets.Food, 6000);
assert.strictEqual("Food" in D.setBudget(s, "Food", "").spending.budgets, false, "blank removes"); assert.strictEqual("Food" in D.setBudget(s, "Food", "0").spending.budgets, false, "zero removes"); assert.strictEqual("Food" in D.setBudget(s, "Food", null).spending.budgets, false);
assert.strictEqual(D.setBudget(s, "Food", "abc").spending.budgets.Food, 6000, "an invalid value keeps the old budget"); assert.strictEqual(D.setBudget(s, "Food", -4).spending.budgets.Food, 6000);
assert.deepStrictEqual(D.setBudget({}, "", 5), empty);
s = D.setFixed({}, "Gym", true); assert.strictEqual(s.spending.fixed.Gym, true); s = D.setFixed(s, "Gym", false); assert.strictEqual(s.spending.fixed.Gym, false, "false is a choice");
assert.strictEqual("Gym" in D.setFixed(s, "Gym", null).spending.fixed, false, "null goes back to the name rule"); assert.deepStrictEqual(D.setFixed({}, " ", true), empty);

// ── portfolio choices ──
for (const r of ["target", "balanced", "aggressive", "conservative", "age"]) assert.strictEqual(D.clean({ portfolio: { reference: r } }).portfolio.reference, r, r + " is a valid reference");
for (const bad of ["", "growth", null, 5, undefined, ["age"]]) assert.strictEqual(D.clean({ portfolio: { reference: bad } }).portfolio.reference, "target", "an unknown reference falls back: " + JSON.stringify(bad));
assert.strictEqual(D.clean({ portfolio: { includeOther: true } }).portfolio.includeOther, true); for (const bad of ["true", 1, null, "yes"]) assert.strictEqual(D.clean({ portfolio: { includeOther: bad } }).portfolio.includeOther, false, "only a real true counts: " + JSON.stringify(bad));
assert.deepStrictEqual(D.clean({ portfolio: "x" }).portfolio, { reference: "target", includeOther: false });
let ps = D.setPortfolio({}, { reference: "age" }); assert.strictEqual(ps.portfolio.reference, "age"); assert.strictEqual(ps.portfolio.includeOther, false);
ps = D.setPortfolio(ps, { includeOther: true }); assert.deepStrictEqual(ps.portfolio, { reference: "age", includeOther: true }, "changing one keeps the other");
ps = D.setPortfolio(ps, { reference: "nonsense", includeOther: "yes" }); assert.deepStrictEqual(ps.portfolio, { reference: "age", includeOther: true }, "invalid values change nothing"); assert.deepStrictEqual(D.setPortfolio(ps, null).portfolio, ps.portfolio);
ps = D.setPortfolio(ps, { includeOther: false }); assert.strictEqual(ps.portfolio.includeOther, false, "false is a choice");
const keep = JSON.stringify(ps); D.setPortfolio(ps, { reference: "balanced" }); assert.strictEqual(JSON.stringify(ps), keep, "the input is not changed");
assert.strictEqual(D.setMark(D.setPortfolio({}, { reference: "balanced" }), "Me", "2025-02", "oneoff").portfolio.reference, "balanced", "other setters keep the portfolio choice");
console.log("dashboard-settings: all checks passed");
