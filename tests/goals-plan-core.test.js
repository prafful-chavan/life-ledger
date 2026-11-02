const assert = require("assert");
const G = require("../goals-plan-core.js");
const TODAY = "2026-11-02";

// ── kinds ──
assert.strictEqual(G.kindOf({}), "save");
assert.strictEqual(G.kindOf({ kind: "income" }), "income");
assert.strictEqual(G.kindOf({ kind: "score" }), "score");
assert.strictEqual(G.kindOf({ kind: "networth" }), "networth");
assert.strictEqual(G.kindOf({ kind: "nonsense" }), "save", "an unknown kind is a normal money goal");
assert.strictEqual(G.kindOf(null), "save");
assert.strictEqual(G.isMoney({ kind: "income" }), false);
assert.strictEqual(G.isMoney({ kind: "score" }), false);
assert.strictEqual(G.isMoney({ kind: "networth" }), true);

// ── days left ──
assert.strictEqual(G.daysLeft("2026-11-03", TODAY), 1);
assert.strictEqual(G.daysLeft("2026-11-02", TODAY), 0);
assert.strictEqual(G.daysLeft("2026-11-01", TODAY), -1);
assert.strictEqual(G.daysLeft("2030-12-31", TODAY), 1520);
assert.strictEqual(G.daysLeft("garbage", TODAY), null);
assert.strictEqual(G.daysLeft(undefined, TODAY), null);

// ── one goal, no growth: remainder spread over the days ──
const farm = G.perDay({ target: 15000000, saved: 0, dueDate: "2030-12-31" }, TODAY);
assert.strictEqual(farm.remaining, 15000000);
assert.strictEqual(farm.days, 1520);
assert.strictEqual(farm.perDay, Math.ceil((15000000 / 1520 * 30.4375) / 30.4375));   // 9,869
assert.strictEqual(farm.perDay, 9869);
assert.strictEqual(farm.perMonth, Math.ceil(15000000 / 1520 * 30.4375));
// saved reduces it
assert.strictEqual(G.perDay({ target: 100000, saved: 40000, dueDate: "2027-11-02" }, TODAY).remaining, 60000);
// done at exactly the target and above it
assert.strictEqual(G.perDay({ target: 100, saved: 100, dueDate: "2027-01-01" }, TODAY).done, true);
assert.strictEqual(G.perDay({ target: 100, saved: 101, dueDate: "2027-01-01" }, TODAY).done, true);
assert.strictEqual(G.perDay({ target: 100, saved: 99, dueDate: "2027-01-01" }, TODAY).done, false);
// due today or late: the whole remainder is due now
const late = G.perDay({ target: 5000, saved: 1000, dueDate: "2026-11-01" }, TODAY);
assert.strictEqual(late.overdue, true); assert.strictEqual(late.perDay, 4000);
const dueToday = G.perDay({ target: 5000, saved: 1000, dueDate: TODAY }, TODAY);
assert.strictEqual(dueToday.overdue, true);
// one day left: not overdue, one day's worth is the whole remainder
const tomorrow = G.perDay({ target: 5000, saved: 1000, dueDate: "2026-11-03" }, TODAY);
assert.strictEqual(tomorrow.overdue, undefined); assert.strictEqual(tomorrow.perDay, 4000);
// no due date or no amount: not counted, and said why
const noDate = G.perDay({ target: 5000, saved: 0 }, TODAY);
assert.strictEqual(noDate.counted, false); assert.strictEqual(noDate.needsDate, true); assert.strictEqual(noDate.remaining, 5000);
const noAmount = G.perDay({ target: 0, saved: 0, dueDate: "2030-12-31" }, TODAY);
assert.strictEqual(noAmount.needsAmount, true); assert.strictEqual(noAmount.counted, false);
assert.strictEqual(G.perDay({ kind: "score", target: 100, dueDate: "2030-12-31" }, TODAY).counted, false);
assert.strictEqual(G.perDay({ kind: "score", target: 100, dueDate: "2030-12-31" }, TODAY).needsAmount, false);
assert.strictEqual(G.perDay({ kind: "income", target: 400000, dueDate: "2030-12-31" }, TODAY).counted, false);
// bad input never throws
assert.strictEqual(G.perDay(null, TODAY).counted, false);
assert.strictEqual(G.perDay({ target: "abc", saved: "x" }, TODAY).counted, false);
assert.strictEqual(G.perDay({ target: 1000, saved: -50, dueDate: "2027-11-02" }, TODAY).remaining, 1000, "negative progress counts as nothing saved");

// ── growth only moves the portfolio goal, and only when set ──
const nw = { kind: "networth", target: 200000000, saved: 13000000, dueDate: "2030-12-31" };
const flat = G.perDay(nw, TODAY, { growthPct: 0 });
const grown = G.perDay(nw, TODAY, { growthPct: 12 });
assert.strictEqual(flat.remaining, 187000000);
assert.ok(grown.perDay < flat.perDay, "growth lowers the saving needed");
assert.ok(grown.remaining < flat.remaining, "what is held grows");
assert.ok(grown.perDay > 0);
assert.deepStrictEqual(G.perDay(nw, TODAY), G.perDay(nw, TODAY, { growthPct: 0 }), "no setting means no growth");
assert.deepStrictEqual(G.perDay(nw, TODAY, { growthPct: -5 }), flat, "negative growth is ignored");
const ordinary = { target: 200000000, saved: 13000000, dueDate: "2030-12-31" };
assert.deepStrictEqual(G.perDay(ordinary, TODAY, { growthPct: 12 }), G.perDay(ordinary, TODAY, { growthPct: 0 }), "growth never applies to an ordinary goal");
// growth far enough ahead can finish the goal on its own
assert.strictEqual(G.perDay({ kind: "networth", target: 1000, saved: 900, dueDate: "2030-12-31" }, TODAY, { growthPct: 50 }).done, true);

// ── all goals together ──
const goals = [
  { id: "a", name: "Farm", target: 15000000, saved: 0, dueDate: "2030-12-31" },
  { id: "b", name: "Gaming", target: 0, saved: 0, dueDate: "2030-12-31" },
  { id: "c", name: "Open", target: 5000, saved: 0 },
  { id: "d", name: "Done", target: 100, saved: 100, dueDate: "2027-01-01" },
  { id: "e", name: "Salary", kind: "income", target: 2000000, saved: 0 },
  { id: "f", name: "Weight", kind: "score", target: 100, saved: 10 },
];
const P = G.plan(goals, TODAY, { takeHomeMonthly: 300000, spendMonthly: 100000 });
assert.deepStrictEqual(P.items.map((x) => x.id), ["a", "d"]);
assert.deepStrictEqual(P.needsAmount.map((x) => x.id), ["b"]);
assert.deepStrictEqual(P.needsDate.map((x) => x.id), ["c"]);
assert.deepStrictEqual(P.notMoney.map((x) => x.id), ["e", "f"]);
assert.strictEqual(P.savePerDay, 9869, "the done goal asks for nothing");
assert.strictEqual(P.earn.needPerMonth, 100000 + P.savePerMonth);
assert.strictEqual(P.earn.needPerDay, Math.ceil((100000 + P.savePerMonth) / 30.4375));
assert.strictEqual(P.earn.havePerDay, Math.round(300000 / 30.4375));
assert.strictEqual(P.earn.gapPerDay, Math.max(0, P.earn.needPerDay - P.earn.havePerDay));
assert.strictEqual(P.earn.canSavePerMonth, 200000);
assert.strictEqual(P.earn.coveragePct, Math.round(200000 / P.savePerMonth * 100));
// covered goals show 100%, never above
const small = G.plan([{ id: "x", target: 30000, saved: 0, dueDate: "2027-11-02" }], TODAY, { takeHomeMonthly: 300000, spendMonthly: 100000 });
assert.strictEqual(small.earn.coveragePct, 100);
assert.strictEqual(small.earn.gapPerDay, 0);
// without income or spending the earn figure is withheld, never guessed
assert.strictEqual(G.plan(goals, TODAY, {}).earn, null);
assert.strictEqual(G.plan(goals, TODAY, { takeHomeMonthly: 300000 }).earn, null);
assert.strictEqual(G.plan(goals, TODAY, { spendMonthly: 100000 }).earn, null);
assert.strictEqual(G.plan(null, TODAY, {}).savePerDay, 0);
// nothing owed means nothing to earn beyond living costs
const none = G.plan([], TODAY, { takeHomeMonthly: 300000, spendMonthly: 100000 });
assert.strictEqual(none.earn.needPerMonth, 100000);
assert.strictEqual(none.earn.coveragePct, 100);
// spending above take-home: nothing can be saved, coverage 0
const broke = G.plan([{ id: "x", target: 30000, saved: 0, dueDate: "2027-11-02" }], TODAY, { takeHomeMonthly: 90000, spendMonthly: 100000 });
assert.strictEqual(broke.earn.canSavePerMonth, 0);
assert.strictEqual(broke.earn.coveragePct, 0);

// ── the sheet's goals ──
const sheetKeys = G.SHEET_GOALS.map((s) => s.key);
assert.strictEqual(new Set(sheetKeys).size, sheetKeys.length, "keys are unique");
assert.strictEqual(new Set(G.SHEET_GOALS.map((s) => s.name.toLowerCase())).size, G.SHEET_GOALS.length, "names are unique");
const home = { id: "goal-1", name: "Home", category: "Finance", owner: "Both", target: 20000000, saved: 2000000, dueDate: "2028-05-26" };
const first = G.planSheetImport([home], TODAY);
assert.strictEqual(first.add.length, G.SHEET_GOALS.length, "every sheet goal is added once");
assert.deepStrictEqual(first.update, [{ id: "goal-1", name: "Home", from: 20000000, changes: { target: 30000000, sheetKey: "sheet:home" } }]);
assert.ok(first.add.every((g) => g.dueDate === "2030-12-31" && g.sheetKey && g.id), "all carry the due date, a key and an id");
assert.ok(first.add.filter((g) => g.kind === "score").every((g) => g.target === 100 && g.saved === 0));
assert.strictEqual(first.add.find((g) => g.sheetKey === "sheet:portfolio-20cr").track, "All my assets");
assert.strictEqual(first.add.find((g) => g.sheetKey === "sheet:prafful-business").target, 100000, "part-time business: ₹1 lakh a month");
assert.strictEqual(first.add.find((g) => g.sheetKey === "sheet:farmhouse").target, 20000000, "farmhouse: ₹2 Cr as the household said");
// the money goals total the household's estimate (without the flat and the portfolio)
const spendTotal = first.add.filter((g) => G.kindOf(g) === "save").reduce((s, g) => s + g.target, 0);
assert.strictEqual(spendTotal, 20000000 + 15000000 + 10000000 + 12000000 + 3500000 + 800000 + 300000 + 150000 + 800000 + 650000 + 400000 + 150000 + 30000);
// running it again changes nothing
const applied = [home, ...first.add].map((g) => (first.update.find((u) => u.id === g.id) ? { ...g, ...first.update[0].changes } : g));
const second = G.planSheetImport(applied, TODAY);
assert.strictEqual(second.add.length, 0); assert.strictEqual(second.update.length, 0);
assert.strictEqual(second.skipped.length, G.SHEET_GOALS.length);
// a goal the household typed with the same name is not duplicated
const typed = G.planSheetImport([home, { id: "t", name: "5 acre farm", target: 1 }], TODAY);
assert.strictEqual(typed.add.length, G.SHEET_GOALS.length - 1);
// Home already at or above the flat's price is not lowered
assert.strictEqual(G.planSheetImport([{ ...home, target: 30000000 }], TODAY).update.length, 0);
assert.strictEqual(G.planSheetImport([{ ...home, target: 35000000 }], TODAY).update.length, 0);
assert.strictEqual(G.planSheetImport([{ ...home, target: 29999999 }], TODAY).update.length, 1);
// no Home at all: it is added
assert.ok(G.planSheetImport([], TODAY).add.some((g) => g.sheetKey === "sheet:home" && g.target === 30000000));
assert.strictEqual(G.planSheetImport(null, TODAY).add.length, G.SHEET_GOALS.length + 1);

// ── the household's real goals today (2 Nov 2026), planned with the sheet's goals ──
const real = [
  { ...home, target: 30000000 },
  { id: "mf", name: "Mutual Fund Portfolio", target: 10000000, saved: 4413696, dueDate: "2027-10-22", track: "Mutual funds" },
  { id: "em", name: "Emergency fund", target: 200000, saved: 150000, dueDate: "2027-03-31" },
  ...first.add.map((g) => (g.kind === "networth" ? { ...g, saved: 13300000 } : g)),
];
const R = G.plan(real, TODAY, { takeHomeMonthly: 0, spendMonthly: 0 });
const byName = (n) => R.items.find((x) => x.name === n);
assert.strictEqual(byName("Home").remaining, 28000000);
assert.strictEqual(byName("Home").days, G.daysLeft("2028-05-26", TODAY));
assert.strictEqual(byName("₹20 Cr portfolio by the end of 2030").remaining, 200000000 - 13300000);
assert.strictEqual(R.notMoney.length, 14, "eleven personal goals and three income goals are listed, not added in");
assert.strictEqual(R.needsAmount.length, 0, "every money goal in the sheet now has an amount");

// ── blind spots closed after the mutation run ──
// a ₹1 goal is a real goal; a goal with no amount, or not a money goal, reports exactly what it should
assert.strictEqual(G.perDay({ target: 1, saved: 0, dueDate: "2026-12-12" }, TODAY).counted, true);
assert.strictEqual(G.perDay({ target: 1, saved: 0, dueDate: "2026-12-12" }, TODAY).perMonth, 1);
assert.strictEqual(G.perDay({ target: 1 }, TODAY).needsDate, true);
assert.deepStrictEqual(G.perDay({ target: 0, dueDate: "2030-12-31" }, TODAY), { counted: false, needsAmount: true, remaining: 0, done: false, days: null, perDay: null, perMonth: null });
assert.deepStrictEqual(G.perDay({ kind: "income", target: 5 }, TODAY), { counted: false, needsAmount: false, remaining: 0, done: false, days: null, perDay: null, perMonth: null });
assert.deepStrictEqual(G.perDay({ target: 100, saved: 100, dueDate: "2027-01-01" }, TODAY), { counted: true, remaining: 0, done: true, days: 60, perDay: 0, perMonth: 0 });
assert.deepStrictEqual(G.perDay({ target: 5000, saved: 1000, dueDate: "2026-11-01" }, TODAY), { counted: true, remaining: 4000, done: false, overdue: true, days: 0, perDay: 4000, perMonth: 4000 });

// growth, checked against the formula written out independently
(function () {
  const target = 100000000, saved = 10000000, days = 1000, pct = 12;
  const r = Math.pow(1 + pct / 100, 1 / 12) - 1, n = days / 30.4375;
  const remaining = Math.round(target - saved * Math.pow(1 + pct / 100, days / 365.25));
  const monthly = remaining * r / (Math.pow(1 + r, n) - 1);
  const got = G.perDay({ kind: "networth", target, saved, dueDate: "2029-07-29" }, "2026-11-02", { growthPct: pct });
  assert.strictEqual(G.daysLeft("2029-07-29", "2026-11-02"), days);
  assert.strictEqual(got.remaining, remaining);
  assert.strictEqual(got.perMonth, Math.ceil(monthly));
  assert.strictEqual(got.perDay, Math.ceil(monthly / 30.4375));
  // 1% growth already counts; one day left with growth still uses the growth formula
  assert.ok(G.perDay({ kind: "networth", target, saved, dueDate: "2029-07-29" }, "2026-11-02", { growthPct: 1 }).remaining < target - saved);
  const oneDay = G.perDay({ kind: "networth", target: 1000000000, saved: 500000000, dueDate: "2026-11-03" }, TODAY, { growthPct: 12 });
  assert.ok(oneDay.remaining < 500000000, "growth over a single day is counted");
  assert.ok(G.perDay({ kind: "networth", target, saved, dueDate: TODAY }, TODAY, { growthPct: 12 }).overdue, "due today is overdue even with growth");
})();

// the inputs for the earn figure: any positive amount counts
assert.notStrictEqual(G.plan([], TODAY, { takeHomeMonthly: 1, spendMonthly: 100 }).earn, null);
assert.notStrictEqual(G.plan([], TODAY, { takeHomeMonthly: 100, spendMonthly: 1 }).earn, null);
assert.strictEqual(G.plan([], TODAY, { takeHomeMonthly: 0, spendMonthly: 100 }).earn, null);
// biggest ask first
const order = G.plan([
  { id: "small", target: 10000, saved: 0, dueDate: "2027-11-02" },
  { id: "big", target: 9000000, saved: 0, dueDate: "2027-11-02" },
  { id: "mid", target: 300000, saved: 0, dueDate: "2027-11-02" },
  { id: "done", target: 5, saved: 5, dueDate: "2027-11-02" },
], TODAY, {}).items.map((x) => x.id);
assert.deepStrictEqual(order, ["big", "mid", "small", "done"]);
// coverage: equal to what the household can save over what the goals ask, exactly
(function () {
  const g = [{ id: "x", target: 1200000, saved: 0, dueDate: "2027-11-02" }];
  const sp = G.plan(g, TODAY, {}).savePerMonth;
  const can = Math.round(sp * 0.9);
  const res = G.plan(g, TODAY, { takeHomeMonthly: 100000 + can, spendMonthly: 100000 });
  assert.strictEqual(res.earn.coveragePct, Math.round(can / sp * 100));
  assert.strictEqual(res.earn.canSavePerMonth, can);
})();
// take-home equal to spending: nothing is saved, and a tiny goal is not covered
assert.strictEqual(G.plan([{ id: "x", target: 1, saved: 0, dueDate: "2026-12-12" }], TODAY, { takeHomeMonthly: 100000, spendMonthly: 100000 }).earn.coveragePct, 0);
assert.strictEqual(G.plan([], TODAY, { takeHomeMonthly: 100000, spendMonthly: 100000 }).earn.coveragePct, 100, "nothing owed is fully covered");

// import: a renamed goal that carries the sheet key is not added again; a renamed Home is not re-added
const renamed = G.planSheetImport([{ id: "r", name: "My farm", sheetKey: "sheet:farm-5-acre" }, { id: "h", name: "Flat", sheetKey: "sheet:home", target: 30000000 }], TODAY);
assert.ok(!renamed.add.some((g) => g.sheetKey === "sheet:farm-5-acre"));
assert.ok(!renamed.add.some((g) => g.sheetKey === "sheet:home"));
assert.strictEqual(G.planSheetImport([{ id: "h", name: "Flat", sheetKey: "sheet:home", target: 30000000 }], TODAY).add.some((g) => g.sheetKey === "sheet:home"), false);
assert.deepStrictEqual(G.planSheetImport([], TODAY, (k) => "id-" + k).add.find((g) => g.sheetKey === "sheet:home"), { id: "id-home", name: "Home", category: "Finance", owner: "Both", target: 30000000, saved: 0, dueDate: "2028-05-26", sheetKey: "sheet:home" });

// how long at today's saving: remaining over what can be saved each year, one decimal; none when nothing is saved or nothing is owed
(function () {
  const g = [{ id: "x", target: 2400000, saved: 0, dueDate: "2027-11-02" }];
  const r = G.plan(g, TODAY, { takeHomeMonthly: 300000, spendMonthly: 200000 });
  assert.strictEqual(r.totalRemaining, 2400000);
  assert.strictEqual(r.earn.yearsAtCurrentSaving, 2);          // 2,400,000 / (100,000 x 12)
  assert.strictEqual(G.plan(g, TODAY, { takeHomeMonthly: 200000, spendMonthly: 200000 }).earn.yearsAtCurrentSaving, null, "nothing saved: no answer");
  assert.strictEqual(G.plan([], TODAY, { takeHomeMonthly: 300000, spendMonthly: 200000 }).earn.yearsAtCurrentSaving, null, "nothing owed: no answer");
  const odd = G.plan([{ id: "y", target: 3500000, saved: 0, dueDate: "2027-11-02" }], TODAY, { takeHomeMonthly: 300000, spendMonthly: 200000 });
  assert.strictEqual(odd.earn.yearsAtCurrentSaving, 2.9);
  assert.strictEqual(G.plan([{ id: "z", target: 1, saved: 0, dueDate: "2027-11-02" }], TODAY, { takeHomeMonthly: 300000, spendMonthly: 200000 }).earn.yearsAtCurrentSaving, 0, "a rupee left is under a tenth of a year, not 'no answer'");
  assert.strictEqual(G.plan(g, TODAY, { takeHomeMonthly: 200001, spendMonthly: 200000 }).earn.yearsAtCurrentSaving, 200000, "saving a single rupee a month still gives an answer");      // 35 / 12 = 2.916 -> 2.9
})();
console.log("goals-plan-core tests passed");
