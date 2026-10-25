// The Salary tab's rules: which income rows are salary, totals, the table's rows and a month's largest components.
// (The growth dashboard's rules are tested in salary-insights-core.test.js.)
const assert = require("assert");
const Sal = require("../salary-core.js");

const num = (v) => { const n = Number(String(v == null ? "" : v).replace(/[^0-9.-]/g, "")); return Number.isFinite(n) ? n : 0; };
const row = (o) => ({ type: "Salary", ...o });

// ── what counts as salary ──
assert.strictEqual(Sal.isSalary({ type: "Salary" }), true); assert.strictEqual(Sal.isSalary({ type: "salary credit" }), true, "case-insensitive, anywhere in the type");
assert.strictEqual(Sal.isSalary({}), true, "no type: salary"); assert.strictEqual(Sal.isSalary({ type: "" }), true);
assert.strictEqual(Sal.isSalary({ type: "Interest" }), false); assert.strictEqual(Sal.isSalary({ type: "Dividend" }), false);
assert.strictEqual(Sal.isSalary({ type: "Interest", netSalary: 5 }), true, "a payslip figure makes it salary whatever the type"); assert.strictEqual(Sal.isSalary({ type: "Bonus", grossEarnings: 9 }), true); assert.strictEqual(Sal.isSalary({ type: "Other", basicSalary: 1 }), true);
assert.strictEqual(Sal.isSalary({ type: "Interest", netSalary: 0, grossEarnings: 0, basicSalary: 0 }), false, "zero payslip figures do not");

// ── net pay of a row ──
assert.strictEqual(Sal.netOf({ netSalary: 100, amount: 999 }, num), 100, "net salary first"); assert.strictEqual(Sal.netOf({ amount: 999 }, num), 999, "else the amount");
assert.strictEqual(Sal.netOf({ netSalary: 0, amount: 50 }, num), 50, "a zero net falls back to the amount"); assert.strictEqual(Sal.netOf({}, num), 0); assert.strictEqual(Sal.netOf(null, num), 0);
assert.strictEqual(Sal.netOf({ netSalary: "₹1,99,884" }, num), 199884, "text amounts are read as numbers");

// ── totals ──
let s = Sal.summary([row({ netSalary: 100, taxTds: 10 }), row({ amount: 300 }), row({ netSalary: 200, taxTds: "5" })], num);
assert.deepStrictEqual(s, { totalNet: 600, totalTds: 15, months: 3, avgNet: 200 });
assert.deepStrictEqual(Sal.summary([], num), { totalNet: 0, totalTds: 0, months: 0, avgNet: 0 }, "no rows: zeros, no division by zero");
assert.strictEqual(Sal.summary([row({ netSalary: 7 })], num).avgNet, 7);

// ── the table: newest first, at most 160 ──
const t = (r) => Date.parse(r.date + "T00:00:00Z") || 0;
const tr = Sal.tableRows([{ id: "a", date: "2026-01-01" }, { id: "b", date: "2026-03-01" }, { id: "c", date: "2026-02-01" }, { id: "n", date: "" }], t);
assert.deepStrictEqual(tr.map((r) => r.id), ["b", "c", "a", "n"], "newest first; no date last");
assert.deepStrictEqual(Sal.tableRows([{ id: "x", date: "2026-01-01" }, { id: "y", date: "2026-01-01" }], t).map((r) => r.id), ["x", "y"], "the same day keeps its order");
const many = Array.from({ length: 200 }, (_, i) => ({ id: "m" + i, date: new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10) }));
assert.strictEqual(Sal.tableRows(many, t).length, 160, "160 rows at most"); assert.strictEqual(Sal.tableRows(many, t)[0].id, "m199", "the newest 160"); assert.strictEqual(Sal.tableRows(many, t, 5).length, 5, "any limit");
const src = [{ id: "a", date: "2026-01-01" }, { id: "b", date: "2026-02-01" }]; Sal.tableRows(src, t); assert.deepStrictEqual(src.map((r) => r.id), ["a", "b"], "the list is not reordered in place");

// ── a month's largest components ──
const fields = [["basicSalary", "Basic"], ["hra", "HRA"], ["lta", "LTA"], ["bonus", "Bonus"], ["food", "Food"]];
assert.deepStrictEqual(Sal.componentParts({ basicSalary: 80000, hra: 64000, lta: 5000, bonus: 20000, food: 0 }, fields, num), [{ label: "Basic", value: 80000 }, { label: "HRA", value: 64000 }, { label: "Bonus", value: 20000 }], "top three, largest first; zeros and the fourth are dropped");
assert.deepStrictEqual(Sal.componentParts({ lta: 1, hra: 1 }, fields, num).map((p) => p.label), ["HRA", "LTA"], "equal values keep the field order");
assert.deepStrictEqual(Sal.componentParts({}, fields, num), [], "nothing"); assert.deepStrictEqual(Sal.componentParts({ basicSalary: -5 }, fields, num), [], "negative is not a component"); assert.deepStrictEqual(Sal.componentParts({ hra: "₹1,200" }, fields, num), [{ label: "HRA", value: 1200 }]);

console.log("salary-core tests passed");
