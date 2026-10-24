// The Expenses tab's rules: grouping by month, which month is shown, owner and search filters, sorting, totals and paging.
const assert = require("assert");
const E = require("../expenses-core.js");

// The same helpers the app passes in
const monthKey = (d) => { const m = /^(\d{4})-(\d{2})-\d{2}/.exec(String(d || "")); return m ? `${m[1]}-${m[2]}` : ""; };
const num = (v) => { const n = Number(String(v == null ? "" : v).replace(/[^0-9.-]/g, "")); return Number.isFinite(n) ? n : 0; };
const category = (e) => String((e && e.category) || "").trim() || "General";
const normalizeOwner = (v) => { const t = String(v || "").trim().toLowerCase(); return t === "wife" ? "Wife" : t === "both" ? "Both" : "Me"; };
const time = (e) => Date.parse(String(e.date || "") + "T00:00:00Z") || 0;
const d = { monthKey, num, category };
const ex = (id, date, amount, cat, paidBy, note) => ({ id, date, amount, category: cat, paidBy, note });

const list = [
  ex("a", "2026-10-02", 18000, "Rent", "Me", "flat rent"),
  ex("b", "2026-10-10", 16300, "EMI", "Me", "Car EMI"),
  ex("c", "2026-10-10", "₹1,200", "Groceries", "Wife", "Vegetables"),
  ex("d", "2026-09-30", 500, "Eating Out", "Wife", "Chai"),
  ex("e", "2026-10-15", 700, "Groceries", "Both", "Shared"),
  ex("f", "", 999, "Rent", "Me", "no date"),
  ex("g", "garbage", 999, "Rent", "Me", "unreadable date"),
  ex("h", "2026-10-20", 50, "", "Me", "no category"),
];

// ── grouping ──
const idx = E.monthIndex(list, d);
assert.deepStrictEqual([...idx.keys()].sort(), ["2026-09", "2026-10"], "expenses with no readable date belong to no month");
const oct = idx.get("2026-10");
assert.strictEqual(oct.total, 18000 + 16300 + 1200 + 700 + 50, "text amounts are read as numbers");
assert.deepStrictEqual(oct.categories, { Rent: 18000, EMI: 16300, Groceries: 1900, General: 50 }, "empty category is General; same category adds up");
assert.deepStrictEqual(oct.rows.map((r) => r.id), ["a", "b", "c", "e", "h"], "rows keep their order");
assert.deepStrictEqual(E.monthIndex([], d).size, 0); assert.deepStrictEqual(E.monthIndex(null, d).size, 0, "no list: no months");

// ── which month ──
assert.deepStrictEqual(E.listMonths(idx), ["2026-10", "2026-09"], "newest first");
assert.deepStrictEqual(E.listMonths(new Map([["2025-12", 1], ["2026-01", 1], ["2025-02", 1]])), ["2026-01", "2025-12", "2025-02"], "across years");
assert.strictEqual(E.pickMonth(["2026-10", "2026-09"], "2026-09"), "2026-09", "the chosen month stays");
assert.strictEqual(E.pickMonth(["2026-10", "2026-09"], "2025-01"), "2026-10", "a month that no longer has expenses falls back to the newest");
assert.strictEqual(E.pickMonth(["2026-10"], ""), "2026-10"); assert.strictEqual(E.pickMonth([], "2026-10"), "", "no months: none");

// ── the month's rows ──
const view = (rows, o = {}) => E.monthView(rows, { owner: "Both", search: "", page: 0, pageSize: 80, normalizeOwner, category, num, time, ...o });
let v = view(oct.rows);
assert.strictEqual(v.total, 36250); assert.strictEqual(v.count, 5); assert.strictEqual(v.average, 36250 / 5);
assert.deepStrictEqual(v.categories, [["Rent", 18000], ["EMI", 16300], ["Groceries", 1900], ["General", 50]], "largest first");
assert.deepStrictEqual(v.top, { name: "Rent", value: 18000 });
assert.deepStrictEqual(v.pageRows.map((r) => r.id), ["h", "e", "b", "c", "a"], "newest first; the same day keeps the original order (b before c)");
// owner: "Both" shows under each person; each person sees their own and the shared ones
v = view(oct.rows, { owner: "Me" }); assert.deepStrictEqual(v.pageRows.map((r) => r.id).sort(), ["a", "b", "e", "h"]); assert.strictEqual(v.total, 18000 + 16300 + 700 + 50);
v = view(oct.rows, { owner: "Wife" }); assert.deepStrictEqual(v.pageRows.map((r) => r.id).sort(), ["c", "e"]); assert.strictEqual(v.total, 1900);
// the three views together: Me + Wife − shared (counted twice) = all
assert.strictEqual(view(oct.rows, { owner: "Me" }).total + view(oct.rows, { owner: "Wife" }).total - 700, view(oct.rows).total);
// search: category, note, who paid, amount, date; case-insensitive; trimmed
const found = (s) => view(oct.rows, { search: s }).pageRows.map((r) => r.id).sort().join("");
assert.strictEqual(found("RENT"), "a", "category and note, any case"); assert.strictEqual(found("  chai "), "", "trimmed, no match in October");
assert.strictEqual(found("wife"), "c", "who paid"); assert.strictEqual(found("16300"), "b", "amount"); assert.strictEqual(found("2026-10-10"), "bc", "date");
assert.strictEqual(found("zzz"), "", "no match: no rows"); assert.deepStrictEqual(view(oct.rows, { search: "zzz" }).top, { name: "-", value: 0 }); assert.strictEqual(view(oct.rows, { search: "zzz" }).average, 0);
assert.ok(E.matchesSearch({ amount: 0, date: "2026-10-01" }, "10"), "a zero amount does not hide the date"); assert.ok(!E.matchesSearch({ amount: 0, note: "x" }, "0"), "a zero amount is not the text 0");
assert.ok(E.matchesSearch({}, ""), "empty search matches everything");

// ── paging: 80 per page, the page is kept inside the pages that exist ──
const many = Array.from({ length: 170 }, (_, i) => ex("m" + i, `2026-10-${String(1 + (i % 28)).padStart(2, "0")}`, 10, "Misc", "Me", "n"));
v = view(many, { page: 0 }); assert.deepStrictEqual([v.page, v.totalPages, v.pageRows.length], [0, 3, 80]);
v = view(many, { page: 2 }); assert.deepStrictEqual([v.page, v.pageRows.length], [2, 10], "last page holds the rest");
v = view(many, { page: 9 }); assert.strictEqual(v.page, 2, "past the end: last page"); v = view(many, { page: -4 }); assert.strictEqual(v.page, 0, "before the start: first page");
v = view(many.slice(0, 80)); assert.deepStrictEqual([v.totalPages, v.pageRows.length], [1, 80], "exactly one page"); v = view(many.slice(0, 81)); assert.strictEqual(v.totalPages, 2, "one more row opens a second page");
v = view([]); assert.deepStrictEqual([v.count, v.totalPages, v.page, v.pageRows.length], [0, 1, 0, 0], "no rows: one empty page");
v = view(many, { pageSize: 0 }); assert.strictEqual(v.pageRows.length, 80, "no page size given: 80"); v = view(many, { pageSize: -5 }); assert.strictEqual(v.pageRows.length, 1, "a page holds at least one row"); v = view(many, { pageSize: 25 }); assert.deepStrictEqual([v.totalPages, v.pageRows.length], [7, 25], "any page size");
// the first page really is the newest rows
v = view(many, { page: 0 }); assert.ok(v.pageRows.every((r, i, a) => i === 0 || time(a[i - 1]) >= time(r)), "newest first within a page");

// categories are sorted by amount whatever order the expenses came in; one category alone is still the top
v = view([ex("x1", "2026-10-01", 10, "Small", "Me", ""), ex("x2", "2026-10-02", 500, "Big", "Me", ""), ex("x3", "2026-10-03", 90, "Mid", "Me", "")]);
assert.deepStrictEqual(v.categories, [["Big", 500], ["Mid", 90], ["Small", 10]]); assert.deepStrictEqual(v.top, { name: "Big", value: 500 });
v = view([ex("y1", "2026-10-01", 70, "Only", "Me", "")]); assert.deepStrictEqual(v.top, { name: "Only", value: 70 }); assert.deepStrictEqual(v.categories, [["Only", 70]]);
v = view([ex("z1", "2026-10-01", 10, "Same", "Me", ""), ex("z2", "2026-10-02", 10, "Other", "Me", "")]); assert.deepStrictEqual(v.categories.map((c) => c[0]), ["Same", "Other"], "equal amounts keep their order");

console.log("expenses-core tests passed");
