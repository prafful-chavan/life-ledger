// The Salary tab's rules: which income rows are salary, totals, each person's growth, the household's combined pay,
// the progression summary and a month's largest components.
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

// ── a card per person ──
const inc = [
  row({ person: "Me", date: "2024-01-01", netSalary: 100000, source: "Acme" }), row({ person: "Me", date: "2026-09-01", netSalary: 150000, source: "TCS" }), row({ person: "Me", date: "2025-01-01", netSalary: 120000 }),
  row({ person: "Wife", date: "2025-06-01", netSalary: 50000, source: "Ascent" }), row({ person: "Wife", date: "2026-09-01", netSalary: 60000, source: "Ascent" }),
  { type: "Interest", person: "Me", date: "2026-09-02", amount: 999 },
];
let pc = Sal.personCards(inc, num);
assert.deepStrictEqual(pc.people.map((p) => p.person), ["Me", "Wife"], "in order of first appearance; interest is not salary");
assert.deepStrictEqual([pc.people[0].firstNet, pc.people[0].latestNet, pc.people[0].growthPct], [100000, 150000, 50], "first and latest by date, whatever the order of the rows");
assert.strictEqual(pc.people[0].latestRow.source, "TCS"); assert.strictEqual(pc.people[0].firstRow.date, "2024-01-01");
assert.deepStrictEqual([pc.people[1].firstNet, pc.people[1].latestNet, pc.people[1].growthPct], [50000, 60000, 20]);
assert.deepStrictEqual(pc.household, { monthly: 210000, yearly: 2520000 }, "combined latest net, times 12");
pc = Sal.personCards([row({ person: "Me", date: "2026-01-01", netSalary: 90 })], num); assert.strictEqual(pc.household, null, "one person: no household line"); assert.strictEqual(pc.people[0].growthPct, 0, "a single payslip: no growth");
pc = Sal.personCards([row({ person: "Me", date: "2026-01-01", netSalary: 0, amount: 0 }), row({ person: "Wife", date: "2026-01-01", netSalary: 0, amount: 0 })], num); assert.strictEqual(pc.household, null, "no pay at all: no household line");
pc = Sal.personCards([row({ date: "2026-01-01", netSalary: 5 }), row({ person: "", date: "2026-02-01", netSalary: 8 })], num); assert.deepStrictEqual(pc.people.map((p) => p.person), ["Me"], "no person means Me"); assert.strictEqual(pc.people[0].growthPct, 60);
pc = Sal.personCards([row({ person: "Me", date: "2026-01-01", netSalary: 100 }), row({ person: "Me", date: "2026-02-01", netSalary: 80 })], num); assert.strictEqual(pc.people[0].growthPct, -20, "a drop is negative growth");
pc = Sal.personCards([row({ person: "Me", date: "2026-01-01", netSalary: 0, amount: 0 }), row({ person: "Me", date: "2026-02-01", netSalary: 80 })], num); assert.strictEqual(pc.people[0].growthPct, 0, "no first pay: growth cannot be worked out, so 0");
assert.deepStrictEqual(Sal.personCards([], num), { people: [], household: null }); assert.deepStrictEqual(Sal.personCards(null, num), { people: [], household: null });
const keep = inc.slice(); Sal.personCards(inc, num); assert.deepStrictEqual(inc.map((r) => r.date), keep.map((r) => r.date), "the rows are not reordered in place");

// ── progression: your own salary when there is any ──
let pg = Sal.progression(inc, num);
assert.deepStrictEqual(pg.rows.map((r) => r.date), ["2024-01-01", "2025-01-01", "2026-09-01"], "only Me, oldest first");
assert.strictEqual(pg.latest.netSalary, 150000); assert.strictEqual(pg.first.netSalary, 100000); assert.strictEqual(pg.highestNet.netSalary, 150000);
assert.deepStrictEqual(pg.orgs, ["Acme", "Salary", "TCS"], "organisations in order; a row without one is 'Salary'"); assert.strictEqual(pg.growthPct, 50);
assert.deepStrictEqual([pg.firstNet, pg.latestNet], [100000, 150000]);
pg = Sal.progression(inc.filter((r) => r.person === "Wife"), num); assert.deepStrictEqual(pg.rows.map((r) => r.person), ["Wife", "Wife"], "only Archana's rows: they are used");
pg = Sal.progression([row({ person: "Archana's wife account", date: "2026-01-01", netSalary: 1 }), row({ person: "Me", date: "2026-02-01", netSalary: 2 })], num); assert.strictEqual(pg.rows.length, 1, "anything with 'wife' in the name is not yours");
assert.strictEqual(Sal.progression([], num), null); assert.strictEqual(Sal.progression([{ type: "Interest", amount: 5 }], num), null, "no salary rows: nothing");
pg = Sal.progression([row({ date: "2026-01-01", netSalary: 100, source: "A" }), row({ date: "2026-02-01", netSalary: 300, source: "A" }), row({ date: "2026-03-01", netSalary: 200, organization: "B" })], num);
assert.strictEqual(pg.highestNet.date, "2026-02-01", "the highest net month, not the latest"); assert.deepStrictEqual(pg.orgs, ["A", "B"], "a repeated organisation once; 'organization' is read too"); assert.strictEqual(pg.growthPct, 100);
pg = Sal.progression([row({ date: "2026-01-01", netSalary: 100 }), row({ date: "2026-02-01", netSalary: 100 })], num); assert.strictEqual(pg.highestNet.date, "2026-01-01", "a tie keeps the earlier month");
pg = Sal.progression([row({ date: "2026-01-01", amount: 0, netSalary: 0, grossEarnings: 5 })], num); assert.strictEqual(pg.growthPct, 0, "no first net: growth 0");

// ── a month's largest components ──
const fields = [["basicSalary", "Basic"], ["hra", "HRA"], ["lta", "LTA"], ["bonus", "Bonus"], ["food", "Food"]];
assert.deepStrictEqual(Sal.componentParts({ basicSalary: 80000, hra: 64000, lta: 5000, bonus: 20000, food: 0 }, fields, num), [{ label: "Basic", value: 80000 }, { label: "HRA", value: 64000 }, { label: "Bonus", value: 20000 }], "top three, largest first; zeros and the fourth are dropped");
assert.deepStrictEqual(Sal.componentParts({ lta: 1, hra: 1 }, fields, num).map((p) => p.label), ["HRA", "LTA"], "equal values keep the field order");
assert.deepStrictEqual(Sal.componentParts({}, fields, num), [], "nothing"); assert.deepStrictEqual(Sal.componentParts({ basicSalary: -5 }, fields, num), [], "negative is not a component"); assert.deepStrictEqual(Sal.componentParts({ hra: "₹1,200" }, fields, num), [{ label: "HRA", value: 1200 }]);

// small amounts still count
pc = Sal.personCards([row({ person: "Me", date: "2026-01-01", netSalary: 0.5 }), row({ person: "Wife", date: "2026-01-01", netSalary: 0.5 })], num); assert.deepStrictEqual(pc.household, { monthly: 1, yearly: 12 }, "₹1 a month combined is still a household line");
pg = Sal.progression([row({ date: "2026-01-01", netSalary: 0, amount: 0, grossEarnings: 9 }), row({ date: "2026-02-01", netSalary: 0, amount: 0, grossEarnings: 9 })], num); assert.strictEqual(pg.highestNet.date, "2026-01-01", "all zero: the earlier month");
pg = Sal.progression([row({ date: "2026-01-01", netSalary: 0, amount: 0, grossEarnings: 9 }), row({ date: "2026-02-01", netSalary: 1 })], num); assert.strictEqual(pg.highestNet.date, "2026-02-01", "₹1 beats zero");
pg = Sal.progression([row({ date: "2026-01-01", netSalary: 1 }), row({ date: "2026-02-01", netSalary: 1 })], num); assert.strictEqual(pg.highestNet.date, "2026-01-01", "₹1 vs ₹1: the earlier");

console.log("salary-core tests passed");
