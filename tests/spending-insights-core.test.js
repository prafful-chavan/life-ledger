// The Spending dashboard's rules: tracked months, savings rate against last month's pay, categories and their movement,
// fixed and flexible spending, budgets and pace, unusual items and months, and who paid. Limits are tested on both sides.
const assert = require("assert");
const S = require("../spending-insights-core.js");

const num = (v) => { const n = Number(String(v == null ? "" : v).replace(/[^0-9.-]/g, "")); return Number.isFinite(n) ? n : 0; };
const catOf = (e) => String((e && e.category) || "").trim() || "General";
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg || ""} expected ${b}, got ${a}`);
let uid = 0;
const ex = (date, amount, category, o) => ({ id: "e" + ++uid, date, amount, category: category || "Food", paidBy: "Me", note: "", ...o });
/** one expense a month for each month from `start` */
const monthly = (start, amounts, category, o) => amounts.map((a, i) => ex(S.shiftYm(start, i) + "-10", a, category, o));
const run = (expenses, o) => S.analyze(expenses, { num, catOf, today: "2027-01-15", incomeByMonth: {}, budgets: {}, fixed: {}, ...o });

// ── helpers ──
assert.strictEqual(S.daysInMonth("2026-02"), 28); assert.strictEqual(S.daysInMonth("2028-02"), 29); assert.strictEqual(S.daysInMonth("2026-12"), 31); assert.strictEqual(S.daysInMonth("2026-04"), 30);
assert.strictEqual(S.shiftYm("2026-01", -1), "2025-12");
assert.strictEqual(S.median([]), null); assert.strictEqual(S.median([3, 1, 2]), 2); assert.strictEqual(S.median([1, 2, 3, 4]), 2.5);

// ── fixed or flexible: the household's choice first, then the words in the name ──
for (const name of ["EMI- Car, Home, policy", "PG-Rent or Flat Rent Stuff", "Recharges, OTT, Wifi", "Insurance", "Home loan", "School fees", "Netflix subscription"]) assert.strictEqual(S.isFixed(name, {}), true, name);
for (const name of ["Groceries", "Eating Out", "Medical", "Premium dining", "Parent", "Fuel and Maintenance", "Home"]) assert.strictEqual(S.isFixed(name, {}), false, name);
assert.strictEqual(S.isFixed("Groceries", { Groceries: true }), true, "chosen fixed"); assert.strictEqual(S.isFixed("Rent", { Rent: false }), false, "chosen flexible");
assert.strictEqual(S.isFixed("Rent", { Rent: "yes" }), true, "a non-boolean choice is ignored"); assert.strictEqual(S.isFixed("Rent", null), true);

// ── which months are really tracked ──
let t = S.trackedMonths({ "2026-01": 100, "2026-02": 100, "2026-03": 100 });
assert.deepStrictEqual(t, { start: "2026-01", months: ["2026-01", "2026-02", "2026-03"] });
t = S.trackedMonths({ "2025-01": 50, "2025-02": 50, "2026-01": 100, "2026-02": 100 });
assert.strictEqual(t.start, "2026-01", "only the unbroken run up to the latest month");
t = S.trackedMonths({ "2026-01": 19, "2026-02": 100, "2026-03": 100, "2026-04": 100 });
assert.strictEqual(t.start, "2026-02", "a start-up month under 20% of what follows is dropped");
t = S.trackedMonths({ "2026-01": 20, "2026-02": 100, "2026-03": 100, "2026-04": 100 });
assert.strictEqual(t.start, "2026-01", "exactly 20% stays");
t = S.trackedMonths({ "2026-01": 5, "2026-02": 15, "2026-03": 100, "2026-04": 100, "2026-05": 100, "2026-06": 100, "2026-07": 100, "2026-08": 100 });
assert.strictEqual(t.start, "2026-03", "more than one start-up month can go");
assert.deepStrictEqual(S.trackedMonths({}), { start: null, months: [] }); assert.deepStrictEqual(S.trackedMonths({ "2026-01": 0 }), { start: null, months: [] }, "a zero month is not spending");
assert.deepStrictEqual(S.trackedMonths({ "2026-01": 100 }), { start: "2026-01", months: ["2026-01"] }, "a single month stays");
assert.deepStrictEqual(S.trackedMonths({ "2026-12": 100, "2027-01": 100 }).months, ["2026-12", "2027-01"], "across a year end");

// ── a month's total, split, and the savings rate against LAST month's pay ──
const base = [...monthly("2026-01", [60000, 50000, 80000]), ex("2026-02-15", 10000, "Rent"), ex("2026-03-05", 5000, "Rent")];
let r = run(base, { today: "2026-06-01", incomeByMonth: { "2025-12": 100000, "2026-01": 120000, "2026-02": 120000 } });
assert.deepStrictEqual(r.months.map((m) => m.total), [60000, 60000, 85000]);
assert.strictEqual(r.months[0].pay, 100000, "January's spending is set against December's pay"); near(r.months[0].savingsRatePct, 40);
assert.strictEqual(r.months[1].pay, 120000); near(r.months[1].savingsRatePct, 50); assert.strictEqual(r.months[1].saved, 60000);
assert.strictEqual(r.months[2].pay, 120000, "March against February's pay"); near(r.months[2].savingsRatePct, (120000 - 85000) / 1200);
assert.deepStrictEqual([r.months[1].fixed, r.months[1].flexible], [10000, 50000], "rent is fixed");
r = run(base, { today: "2026-06-01", incomeByMonth: { "2026-01": 120000 } });
assert.strictEqual(r.months[0].pay, null, "no pay on record for December: no rate, not a guess"); assert.strictEqual(r.months[0].savingsRatePct, null); assert.strictEqual(r.months[0].saved, null);
r = run(base, { today: "2026-06-01", incomeByMonth: { "2025-12": 0 } }); assert.strictEqual(r.months[0].pay, null, "zero pay is no pay");
r = run(base, { today: "2026-06-01", incomeByMonth: { "2025-12": 50000 } }); assert.strictEqual(r.months[0].saved, -10000); assert.ok(r.months[0].savingsRatePct < 0, "spending more than the pay is a negative rate");
assert.strictEqual(r.savings.overspent, 1);

// ── rows that cannot count ──
r = run([ex("2026-01-05", 100), ex("2026-01-06", 0), ex("2026-01-07", -50), ex("bad", 100), ex("", 100), ex("2026-01-08", "abc")]);
assert.strictEqual(r.months[0].total, 100, "zero, negative, text and undated rows are left out");
assert.strictEqual(run([]).months.length, 0); assert.strictEqual(run(null).months.length, 0); assert.strictEqual(run([]).savings.ratePct, null);
assert.strictEqual(run([{ ...ex("2026-01-05", 100), category: "" }]).categories[0].name, "General", "no category: General");
assert.strictEqual(run([ex("2026-01-05", 100, "Food", { paidBy: "" })]).paidBy[0].person, "Both", "no payer: Both");

// ── the part-month ──
r = run(monthly("2026-01", [100, 100, 100, 100]), { today: "2026-04-20" });
assert.deepStrictEqual([r.tracked.latest, r.tracked.partial, r.tracked.count, r.tracked.complete], ["2026-04", "2026-04", 4, 3], "the current month is partial");
assert.strictEqual(r.months[3].partial, true); assert.deepStrictEqual(r.window, ["2026-01", "2026-02", "2026-03"], "partial months stay out of the averages");
r = run(monthly("2026-01", [100, 100, 100, 100]), { today: "2026-05-02" }); assert.strictEqual(r.tracked.partial, null, "a month that has ended is complete"); assert.strictEqual(r.window.length, 4);

// ── twelve months window and the usual month ──
const year = monthly("2025-01", [100, 110, 90, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]);
r = run(year, { today: "2026-06-01" });
assert.strictEqual(r.window.length, 12); assert.strictEqual(r.window[0], "2025-03", "the last twelve complete months");
assert.strictEqual(r.usualMonth, 100); assert.strictEqual(run(monthly("2026-01", [100, 100, 100, 100, 100]), { today: "2026-12-01" }).usualMonth, null, "five months are too few to say what is usual");
assert.strictEqual(run(monthly("2026-01", [100, 100, 100, 100, 100, 100]), { today: "2026-12-01" }).usualMonth, 100, "six are enough");

// ── unusual months: 1.4× the usual of the months before ──
const steady = monthly("2025-01", Array(8).fill(1000));
const withNext = (n) => run([...steady, ex("2025-09-10", n, "Food")], { today: "2026-06-01" }).months.at(-1);
assert.strictEqual(withNext(1400).unusual, true, "exactly 1.4× the usual"); assert.strictEqual(withNext(1399).unusual, false, "just under");
assert.strictEqual(withNext(1400).usualTotal, 1000);
assert.strictEqual(run(monthly("2025-01", [1000, 1000, 1000, 1000, 1000, 5000]), { today: "2026-06-01" }).months.at(-1).unusual, false, "fewer than six months before: cannot say");
assert.strictEqual(run([...steady, ex("2025-09-10", 9000)], { today: "2025-09-20" }).months.at(-1).unusual, false, "the part-month is never called unusual");
assert.strictEqual(run([...steady, ex("2025-09-10", 9000)], { today: "2025-09-20" }).months.at(-1).partial, true);

// ── unusual items: ₹25,000 and 3× the category's usual payment ──
const small = Array.from({ length: 8 }, (_, i) => ex(`2025-0${i + 1}-03`, 1000, "Shop"));
const itemRun = (amount, category) => run([...small, ex("2025-08-20", amount, category || "Shop")], { today: "2026-06-01" }).unusualItems;
assert.strictEqual(itemRun(25000).length, 1, "exactly ₹25,000 and far above the usual"); assert.strictEqual(itemRun(24999).length, 0, "a rupee under the floor");
const big = Array.from({ length: 8 }, (_, i) => ex(`2025-0${i + 1}-03`, 10000, "Shop"));
const bigRun = (amount) => run([...big, ex("2025-08-20", amount, "Shop")], { today: "2026-06-01" }).unusualItems;
assert.strictEqual(bigRun(30000).length, 1, "3× the usual 10,000 and over the floor"); assert.strictEqual(bigRun(29999).length, 0, "a rupee under 3× the usual");
assert.strictEqual(bigRun(30000)[0].usual, 10000);
assert.strictEqual(run([ex("2025-08-20", 90000, "Brand new category")], { today: "2026-06-01" }).unusualItems.length, 1, "a category with no history: the amount alone decides");
const filler = monthly("2025-01", Array(8).fill(10), "Filler");
const four = Array.from({ length: 4 }, (_, i) => ex(`2025-0${i + 1}-03`, 40000, "Rare")); const five = [...four, ex("2025-05-03", 40000, "Rare")];
assert.strictEqual(run([...filler, ...four.slice(0, 3), ex("2025-08-20", 45000, "Rare")], { today: "2026-06-01" }).unusualItems.filter((u) => u.date === "2025-08-20").length, 1, "four payments in the category counting this one: amount alone decides");
assert.strictEqual(run([...filler, ...five, ex("2025-08-20", 45000, "Rare")], { today: "2026-06-01" }).unusualItems.filter((u) => u.date === "2025-08-20").length, 0, "five payments counting this one, all about that size: not unusual");
const sorted = run([ex("2025-08-01", 30000, "A"), ex("2025-08-02", 90000, "B"), ex("2025-08-03", 50000, "C")], { today: "2026-06-01" }).unusualItems;
assert.deepStrictEqual(sorted.map((u) => u.amount), [90000, 50000, 30000], "largest first");
// what the unusual items explain
r = run([...steady, ex("2025-09-10", 500, "Food"), ex("2025-09-11", 60000, "Gadget")], { today: "2026-06-01" });
const sep = r.months.at(-1); assert.strictEqual(sep.unusual, true); assert.strictEqual(sep.unusualItemsTotal, 60000); assert.strictEqual(sep.everydayTotal, 500);

// ── savings over the last twelve months ──
const inc = {}; for (let i = 0; i < 14; i++) inc[S.shiftYm("2024-12", i)] = 200;
r = run(monthly("2025-01", Array(14).fill(100)), { today: "2026-06-01", incomeByMonth: inc });
assert.strictEqual(r.savings.months, 12); near(r.savings.ratePct, 50); assert.strictEqual(r.savings.saved, 1200); assert.strictEqual(r.savings.pay, 2400); assert.strictEqual(r.savings.spent, 1200);
near(r.savings.typicalPct, 50); assert.strictEqual(r.savings.overspent, 0);
delete inc[S.shiftYm("2024-12", 5)]; r = run(monthly("2025-01", Array(14).fill(100)), { today: "2026-06-01", incomeByMonth: inc });
assert.strictEqual(r.savings.months, 11, "a month with no pay on record is left out of the rate, not counted as zero");
const varied = monthly("2025-01", [50, 100, 150, 100, 100, 100, 100, 100, 100, 100, 100, 100]); const inc2 = {}; for (let i = 0; i < 12; i++) inc2[S.shiftYm("2024-12", i)] = 200;
r = run(varied, { today: "2026-06-01", incomeByMonth: inc2 });
assert.strictEqual(r.savings.best, "2025-01"); assert.strictEqual(r.savings.worst, "2025-03");

// ── categories: share, average, six months against six ──
const cats = [...monthly("2025-01", Array(12).fill(1000), "Rent"), ...monthly("2025-01", [1000, 1000, 1000, 1000, 1000, 1000, 4000, 4000, 4000, 4000, 4000, 4000], "Food"), ...monthly("2025-01", [2000, 2000, 2000, 2000, 2000, 2000, 500, 500, 500, 500, 500, 500], "Shop")];
r = run(cats, { today: "2026-06-01" });
assert.deepStrictEqual(r.categories.map((c) => c.name), ["Food", "Shop", "Rent"], "largest first");
const food = r.categories.find((c) => c.name === "Food"); assert.strictEqual(food.total, 30000); near(food.monthlyAvg, 2500); near(food.changePct, 300); assert.strictEqual(food.recentAvg, 4000); assert.strictEqual(food.beforeAvg, 1000);
near(r.categories.reduce((t, c) => t + c.sharePct, 0), 100, "shares add to 100"); assert.strictEqual(food.series.length, 12);
assert.deepStrictEqual(r.risers.map((c) => c.name), ["Food"]); assert.deepStrictEqual(r.fallers.map((c) => c.name), ["Shop"]);
assert.strictEqual(r.categories.find((c) => c.name === "Rent").changePct === 0, true, "unchanged: 0%");
r = run(monthly("2025-01", [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000], "Food"), { today: "2026-06-01" }); assert.strictEqual(r.categories[0].changePct, null, "under twelve months: no comparison"); assert.deepStrictEqual(r.risers, []);
// a small shift (under ₹500 a month) is not a mover
const tiny = [...monthly("2025-01", [100, 100, 100, 100, 100, 100, 599, 599, 599, 599, 599, 599], "Tea")];
assert.strictEqual(run(tiny, { today: "2026-06-01" }).risers.length, 0, "₹499 more a month is not a riser"); 
assert.strictEqual(run(monthly("2025-01", [100, 100, 100, 100, 100, 100, 600, 600, 600, 600, 600, 600], "Tea"), { today: "2026-06-01" }).risers.length, 1, "₹500 more a month is");
assert.strictEqual(run(monthly("2025-01", [600, 600, 600, 600, 600, 600, 100, 100, 100, 100, 100, 100], "Tea"), { today: "2026-06-01" }).fallers.length, 1);
// at most three
const many = ["A", "B", "C", "D", "E"].flatMap((c, i) => monthly("2025-01", [100, 100, 100, 100, 100, 100, ...Array(6).fill(1000 + i * 100)], c));
r = run(many, { today: "2026-06-01" }); assert.strictEqual(r.risers.length, 3); assert.deepStrictEqual(r.risers.map((c) => c.name), ["E", "D", "C"], "the biggest rises first");
// categories with only older spending are not listed
assert.strictEqual(run([...monthly("2025-01", Array(14).fill(100), "Food"), ex("2025-01-05", 900, "Old")], { today: "2026-06-01" }).categories.some((c) => c.name === "Old"), false, "no spending in the last twelve months: not listed");

// ── fixed against flexible ──
r = run([...monthly("2025-01", Array(12).fill(3000), "EMI car"), ...monthly("2025-01", Array(12).fill(1000), "Food")], { today: "2026-06-01" });
assert.deepStrictEqual([r.fixedFlexible.fixed, r.fixedFlexible.flexible], [36000, 12000]); near(r.fixedFlexible.fixedSharePct, 75); assert.strictEqual(r.fixedFlexible.fixedMonthly, 3000); assert.strictEqual(r.fixedFlexible.flexibleMonthly, 1000);
r = run([...monthly("2025-01", Array(12).fill(3000), "EMI car"), ...monthly("2025-01", Array(12).fill(1000), "Food")], { today: "2026-06-01", fixed: { Food: true, "EMI car": false } });
assert.deepStrictEqual([r.fixedFlexible.fixed, r.fixedFlexible.flexible], [12000, 36000], "the household's choices flip them"); assert.strictEqual(r.categories.find((c) => c.name === "Food").fixed, true);
assert.strictEqual(run([], {}).fixedFlexible.fixedSharePct, null);

// ── budgets ──
const bud = (spent, today, budget) => run([...monthly("2026-01", [500, 500, 500], "Food"), ex("2026-04-" + (today === "2026-04-30" ? "20" : "03"), spent, "Food")], { today, budgets: { Food: budget === undefined ? 1000 : budget } }).budgets[0];
assert.strictEqual(bud(1000, "2026-04-30").status, "near", "exactly on budget is used up but not over");
assert.strictEqual(bud(1001, "2026-04-30").status, "over", "a rupee over");
assert.strictEqual(bud(800, "2026-04-30").status, "near", "80% used"); assert.strictEqual(bud(799, "2026-04-30").status, "ok", "just under 80%");
// pace: only from the 5th; projects the month
let b = bud(300, "2026-04-05"); assert.strictEqual(b.status, "pace"); near(b.projected, 300 / 5 * 30, "300 in five days is 1800 for April");
b = bud(300, "2026-04-06"); near(b.projected, 300 / 6 * 30); assert.strictEqual(b.status, "pace", "1800 projected");
b = run([...monthly("2026-01", [500, 500, 500], "Food"), ex("2026-04-03", 300, "Food")], { today: "2026-04-04", budgets: { Food: 1000 } }).budgets[0]; assert.strictEqual(b.projected, null, "too early to project"); assert.strictEqual(b.status, "ok", "no pace warning before the 5th");
b = run([...monthly("2026-01", [500, 500, 500], "Food"), ex("2026-04-03", 100, "Food")], { today: "2026-04-10", budgets: { Food: 1000 } }).budgets[0]; assert.strictEqual(b.status, "ok"); near(b.projected, 100 / 10 * 30);
b = run([...monthly("2026-01", [500, 500, 500], "Food"), ex("2026-04-03", 100, "Food")], { today: "2026-04-10", budgets: { Food: 1000 } }).budgets[0]; near(b.usedPct, 10);
// history: the three months before; a hit is within budget
b = run([...monthly("2026-01", [500, 1000, 1001], "Food"), ex("2026-04-03", 100, "Food")], { today: "2026-04-10", budgets: { Food: 1000 } }).budgets[0];
assert.deepStrictEqual(b.history.map((h) => h.spent), [1001, 1000, 500], "the three months before, newest first"); assert.strictEqual(b.hits, 2);
// a category with no spending this month still shows 0 used
b = run([...monthly("2026-01", [500, 500, 500], "Food"), ex("2026-04-03", 50, "Other")], { today: "2026-04-10", budgets: { Food: 1000 } }).budgets[0]; assert.strictEqual(b.spent, 0); assert.strictEqual(b.usedPct, 0);
// budgets that are not numbers are skipped; sorted by how much is used
r = run([...monthly("2026-01", [500, 500, 500], "Food"), ex("2026-04-03", 900, "Food"), ex("2026-04-04", 100, "Shop")], { today: "2026-04-30", budgets: { Food: 1000, Shop: 1000, Bad: "abc", Zero: 0, Neg: -5 } });
assert.deepStrictEqual(r.budgets.map((x) => x.name), ["Food", "Shop"], "most used first; zero, negative and text budgets are ignored");
// with no spending yet this month the latest complete month is judged
r = run(monthly("2026-01", [500, 500, 900], "Food"), { today: "2026-04-02", budgets: { Food: 1000 } });
assert.strictEqual(r.budgetMonth, "2026-03"); assert.strictEqual(r.budgets[0].partial, false); assert.strictEqual(r.budgets[0].projected, null); assert.strictEqual(r.budgets[0].spent, 900);
assert.deepStrictEqual(run([], { budgets: { Food: 1 } }).budgets, [], "no spending: no budgets to judge");
// suggestions: the average of the last three months, to the nearest ₹500
r = run(monthly("2025-01", [0, ...Array(11).fill(1), 1100, 1300, 1900].map((v) => v + 1), "Food"), { today: "2026-06-01" });
assert.strictEqual(r.suggestions.Food, 1500, "average 1434 rounds to 1500"); 
assert.strictEqual(run(monthly("2025-01", [1249, 1249, 1249], "Food"), { today: "2026-06-01" }).suggestions.Food, 1000, "1249 rounds down"); assert.strictEqual(run(monthly("2025-01", [1250, 1250, 1250], "Food"), { today: "2026-06-01" }).suggestions.Food, 1500, "1250 rounds up");

// ── who paid ──
r = run([...monthly("2025-01", Array(12).fill(1000), "Food", { paidBy: "Me" }), ...monthly("2025-01", Array(12).fill(500), "Gift", { paidBy: "Wife" }), ...monthly("2025-01", Array(12).fill(100), "Food", { paidBy: "Wife" })], { today: "2026-06-01" });
assert.deepStrictEqual(r.paidBy.map((p) => [p.person, p.total, p.count]), [["Me", 12000, 12], ["Wife", 7200, 24]]); near(r.paidBy[0].sharePct + r.paidBy[1].sharePct, 100);
assert.deepStrictEqual(r.paidBy[1].top.map((x) => x.name), ["Gift", "Food"]); assert.strictEqual(r.paidBy[1].series.length, 12); assert.strictEqual(r.paidBy[1].series[0], 600);
r = run(monthly("2025-01", Array(14).fill(100), "Food"), { today: "2026-06-01" }); assert.strictEqual(r.paidBy[0].total, 1200, "only the last twelve complete months");
assert.strictEqual(run([ex("2025-01-05", 100, "A", { paidBy: "Me" }), ex("2025-01-06", 100, "B", { paidBy: "Me" }), ex("2025-01-07", 100, "C", { paidBy: "Me" }), ex("2025-01-08", 100, "D", { paidBy: "Me" })], { today: "2026-06-01" }).paidBy[0].top.length, 3, "top three");

// ── not-tracked months are reported ──
r = run([ex("2019-06-01", 10000), ...monthly("2026-01", [100, 100, 100])], { today: "2026-06-01" }); assert.deepStrictEqual(r.tracked.notTracked, ["2019-06"]);

// ── details found by mutation testing ──
assert.strictEqual(run([ex("2026-01-05", 1)]).months[0].total, 1, "a one-rupee payment counts");
assert.strictEqual(run([ex("2026-01-05", 100)], { incomeByMonth: { "2025-12": 1 } }).months[0].pay, 1, "a pay of ₹1 is still pay");
assert.strictEqual(run([...monthly("2026-01", [500, 500, 500], "Food"), ex("2026-04-03", 10, "Food")], { today: "2026-04-10", budgets: { Food: 1 } }).budgets.length, 1, "a ₹1 budget is a budget");
// pay is shown against spending without the unusual items
r = run([...steady, ex("2025-09-10", 500, "Food"), ex("2025-09-11", 60000, "Gadget")], { today: "2026-06-01", incomeByMonth: { "2025-08": 100000 } });
near(r.months.at(-1).savingsRatePct, 39.5); near(r.months.at(-1).savingsRateEveryday, 99.5, "the rate without the one big purchase");
assert.strictEqual(r.months.at(-2).unusualItemsTotal, 0);
assert.strictEqual(r.months.at(-2).everydayTotal, 1000, "no unusual items: everyday equals the total");
// best and worst months: the earlier one wins a tie; exactly breaking even is not overspending
const tie = monthly("2025-01", [100, 100, 100, 100, 100, 100], "Food"); const tieInc = {}; for (let i = 0; i < 6; i++) tieInc[S.shiftYm("2024-12", i)] = 200;
r = run(tie, { today: "2026-06-01", incomeByMonth: tieInc }); assert.strictEqual(r.savings.best, "2025-01"); assert.strictEqual(r.savings.worst, "2025-01");
r = run(tie, { today: "2026-06-01", incomeByMonth: { ...tieInc, "2024-12": 100 } }); assert.strictEqual(r.savings.overspent, 0, "spending exactly the pay is not overspending"); assert.strictEqual(r.savings.worst, "2025-01");
// order of fallers and budgets and payers' top categories
const fall = ["A", "B", "C", "D"].flatMap((c, i) => monthly("2025-01", [...Array(6).fill(2000 + i * 500), ...Array(6).fill(1000)], c));
r = run(fall, { today: "2026-06-01" }); assert.deepStrictEqual(r.fallers.map((c) => c.name), ["D", "C", "B"], "the biggest drops first, three at most");
r = run([...monthly("2026-01", [500, 500, 500], "Food"), ex("2026-04-03", 300, "Food"), ex("2026-04-04", 900, "Shop"), ex("2026-04-05", 600, "Fuel")], { today: "2026-04-30", budgets: { Food: 1000, Shop: 1000, Fuel: 1000 } });
assert.deepStrictEqual(r.budgets.map((x) => x.name), ["Shop", "Fuel", "Food"], "most used first");
r = run([ex("2025-01-05", 300, "A", { paidBy: "Me" }), ex("2025-01-06", 900, "B", { paidBy: "Me" }), ex("2025-01-07", 600, "C", { paidBy: "Me" }), ex("2025-01-08", 100, "D", { paidBy: "Me" })], { today: "2026-06-01" });
assert.deepStrictEqual(r.paidBy[0].top, [{ name: "B", value: 900 }, { name: "C", value: 600 }, { name: "A", value: 300 }], "exact amounts, largest first");
r = run([...monthly("2025-01", Array(3).fill(100), "Food", { paidBy: "Me" }), ...monthly("2025-01", Array(3).fill(900), "Gift", { paidBy: "Wife" })], { today: "2026-06-01" }); assert.deepStrictEqual(r.paidBy.map((x) => x.person), ["Wife", "Me"], "the bigger payer first");
// a category that is not in every month still adds up exactly, and zero months are zero
r = run([...monthly("2025-01", Array(12).fill(100), "Food"), ...monthly("2025-07", Array(6).fill(1000), "Trip")], { today: "2026-06-01" });
const trip = r.categories.find((c) => c.name === "Trip"); assert.strictEqual(trip.total, 6000); assert.deepStrictEqual(trip.series, [0, 0, 0, 0, 0, 0, 1000, 1000, 1000, 1000, 1000, 1000]); near(trip.monthlyAvg, 500);
assert.strictEqual(trip.beforeAvg, 0); assert.strictEqual(trip.changePct, null, "from nothing: no percentage"); assert.strictEqual(trip.recentAvg, 1000);
assert.strictEqual(r.risers.length, 0, "a percentage cannot be given, so it is not listed as a riser");
r = run([...monthly("2026-01", [500, 500, 500], "Food"), ...monthly("2026-02", [10, 10], "Shop"), ex("2026-04-03", 100, "Food")], { today: "2026-04-10", budgets: { Shop: 1000 } });
assert.deepStrictEqual(r.budgets[0].history.map((h) => h.spent), [10, 10, 0], "a month with nothing in the category is 0");
near(r.budgets[0].hits, 3);
// exactly six earlier months are enough to say what is usual; five are not
const six = monthly("2025-01", Array(6).fill(1000)); const six7 = (n) => run([...six, ex("2025-07-10", n)], { today: "2026-06-01" }).months.at(-1);
assert.strictEqual(six7(5000).unusual, true, "six months before"); assert.strictEqual(six7(5000).usualTotal, 1000);
assert.strictEqual(run([...monthly("2025-01", Array(5).fill(1000)), ex("2025-06-10", 5000)], { today: "2026-06-01" }).months.at(-1).usualTotal, null, "five months before");
// five payments in the category's history: its usual payment is used
assert.strictEqual(run([...filler, ...four, ex("2025-08-20", 45000, "Rare")], { today: "2026-06-01" }).unusualItems.filter((u) => u.date === "2025-08-20").length, 0, "five payments counting this one");
// start-up month: judged against the next six months only
assert.strictEqual(S.trackedMonths({ "2026-01": 30, "2026-02": 100, "2026-03": 100, "2026-04": 100, "2026-05": 100, "2026-06": 100, "2026-07": 100, "2026-08": 10000 }).start, "2026-01", "the seven months after do not count");
assert.strictEqual(S.trackedMonths({ "2026-01": 40, "2026-02": 1000, "2026-03": 100, "2026-04": 100, "2026-05": 100, "2026-06": 100, "2026-07": 100 }).start, "2026-02", "the month right after counts: 40 is under 20% of 250");
assert.strictEqual(S.trackedMonths({ "2026-01": 1 }).start, "2026-01", "a lone month is kept");
assert.deepStrictEqual(S.trackedMonths({ "2026-01": 1, "2026-02": 100 }).months, ["2026-02"], "two months: the first is a start-up");
assert.strictEqual(S.trackedMonths({ "2026-01": 1 }).months.length, 1);
assert.deepStrictEqual(S.trackedMonths({ "2026-01": 1, "2026-03": 1 }).months, ["2026-03"], "a gap ends the run");
// the usual payment only looks at the last twelve months
const old = [...monthly("2024-01", Array(12).fill(40000), "Rare"), ...monthly("2025-01", Array(12).fill(1000), "Rare"), ex("2025-12-20", 40000, "Rare")];
assert.strictEqual(run(old, { today: "2026-06-01" }).unusualItems.filter((u) => u.date === "2025-12-20").length, 1, "40,000 against a usual of 1,000 in the last year");

assert.strictEqual(run(monthly("2025-01", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 10, 30000].map((v) => v + 1), "Lumpy"), { today: "2026-06-01" }).suggestions.Lumpy, 10000, "a lumpy category is suggested by its average, not its middle month");
console.log("spending-insights-core: all checks passed");
