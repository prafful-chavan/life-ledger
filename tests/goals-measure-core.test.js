const assert = require("assert");
const M = require("../goals-measure-core.js");
const TODAY = "2026-11-02";   // a Monday

// ── categories ──
assert.strictEqual(M.categoryOf({ cat: "body" }), "body");
assert.strictEqual(M.categoryOf({ cat: "nonsense", kind: "income" }), "income", "an unknown category falls back to the kind");
assert.strictEqual(M.categoryOf({ kind: "income" }), "income");
assert.strictEqual(M.categoryOf({ kind: "networth" }), "money");
assert.strictEqual(M.categoryOf({ kind: "score" }), "other");
assert.strictEqual(M.categoryOf({ kind: "measure" }), "other");
assert.strictEqual(M.categoryOf({}), "money");
assert.strictEqual(M.categoryOf(null), "money");
assert.strictEqual(M.labelOf("people"), "Time with people");
assert.strictEqual(M.labelOf("zzz"), "Other");

// ── BMI and the healthy band, from the heights the household gave ──
const P_CM = 170.18, A_CM = 152.4;   // 5 ft 7 in, 5 ft 0 in
assert.strictEqual(M.bmi(83.9, P_CM), 29, "matches the 29 the body measurements show");
assert.strictEqual(M.bmi(70, P_CM), 24.2);
assert.strictEqual(M.bmi(51, A_CM), 22);
assert.strictEqual(M.bmi(42, A_CM), 18.1);
assert.strictEqual(M.bmi(0, A_CM), null);
assert.strictEqual(M.bmi(50, 0), null);
assert.strictEqual(M.bmi(-5, 150), null);
assert.deepStrictEqual(M.healthyRange(A_CM), { minKg: 43, maxKg: 57.8 });
assert.deepStrictEqual(M.healthyRange(P_CM), { minKg: 53.6, maxKg: 72.1 });
assert.strictEqual(M.healthyRange(0), null);

// ── weight plan ──
const pw = { unit: "kg", direction: "down", target: 70, heightCm: P_CM, start: 83.9, current: 83.9, dueDate: "2030-12-31" };
const w = M.weightPlan(pw, TODAY);
assert.strictEqual(w.remaining, 13.9);
assert.strictEqual(w.done, false);
assert.strictEqual(w.pct, 0);
assert.strictEqual(w.bmiNow, 29); assert.strictEqual(w.bmiTarget, 24.2);
assert.strictEqual(w.perMonth, Math.round((13.9 / (1520 / 30.4375)) * 100) / 100);   // 0.28 kg a month
assert.strictEqual(w.perMonth, 0.28);
assert.strictEqual(w.tooFast, false); assert.strictEqual(w.targetBelowBand, false); assert.strictEqual(w.targetAboveBand, false);
// progress between start and target
assert.strictEqual(M.weightPlan({ ...pw, current: 76.95 }, TODAY).pct, 50);
assert.strictEqual(M.weightPlan({ ...pw, current: 70 }, TODAY).done, true);
assert.strictEqual(M.weightPlan({ ...pw, current: 70 }, TODAY).pct, 100);
assert.strictEqual(M.weightPlan({ ...pw, current: 69 }, TODAY).done, true, "below target counts as reached");
assert.strictEqual(M.weightPlan({ ...pw, current: 69 }, TODAY).remaining, 0);
assert.strictEqual(M.weightPlan({ ...pw, current: 90 }, TODAY).pct, 0, "heavier than the start is 0 %, never negative");
// Archana's 42 kg at 5 ft is under the usual BMI floor: flagged, never changed
const aw = M.weightPlan({ unit: "kg", target: 42, heightCm: A_CM, start: 51, current: 51, dueDate: "2030-12-31" }, TODAY);
assert.strictEqual(aw.targetBelowBand, true);
assert.strictEqual(aw.bmiTarget, 18.1);
assert.strictEqual(aw.remaining, 9);
assert.strictEqual(aw.perMonth, Math.round((9 / (1520 / 30.4375)) * 100) / 100);
assert.strictEqual(M.weightPlan({ unit: "kg", target: 43, heightCm: A_CM, current: 50, dueDate: "2030-12-31" }, TODAY).targetBelowBand, false, "43 kg is a BMI of 18.5: inside the band");
assert.strictEqual(M.weightPlan({ unit: "kg", target: 90, heightCm: A_CM, current: 95, dueDate: "2030-12-31" }, TODAY).targetAboveBand, true);
// too fast: more than 4 kg a month
assert.strictEqual(M.weightPlan({ ...pw, current: 83.9, dueDate: "2026-12-02" }, TODAY).tooFast, true);
assert.strictEqual(M.weightPlan({ ...pw, current: 71.5, dueDate: "2026-12-02" }, TODAY).tooFast, false);
// start defaults to the current weight; no due date gives no pace; late gives the whole remainder
assert.strictEqual(M.weightPlan({ unit: "kg", target: 70, heightCm: P_CM, current: 80, dueDate: "2030-12-31" }, TODAY).start, 80);
assert.strictEqual(M.weightPlan({ unit: "kg", target: 70, heightCm: P_CM, current: 80 }, TODAY).perMonth, null);
assert.strictEqual(M.weightPlan({ unit: "kg", target: 70, heightCm: P_CM, current: 80, dueDate: "2026-10-01" }, TODAY).perMonth, 10);
// no weight yet: asks for one, invents nothing
const none = M.weightPlan({ unit: "kg", target: 70, heightCm: P_CM }, TODAY);
assert.strictEqual(none.needsCurrent, true); assert.strictEqual(none.bmiTarget, 24.2);
assert.strictEqual(M.weightPlan({ unit: "kg", target: 70, current: 0 }, TODAY).needsCurrent, true);
assert.strictEqual(M.weightPlan({ unit: "kg", target: 70, current: "" }, TODAY).needsCurrent, true);
assert.strictEqual(M.weightPlan(null, TODAY).needsCurrent, true);

// ── periods ──
assert.strictEqual(M.periodOf("hours/week"), "week");
assert.strictEqual(M.periodOf("days/week"), "week");
assert.strictEqual(M.periodOf("count/month"), "month");
assert.strictEqual(M.periodOf("check-ups/year"), "year");
assert.strictEqual(M.periodOf("kg"), null);
assert.deepStrictEqual(M.windowFor("week", "2026-11-02"), { start: "2026-11-02", end: "2026-11-08" }, "Monday starts the week");
assert.deepStrictEqual(M.windowFor("week", "2026-11-08"), { start: "2026-11-02", end: "2026-11-08" }, "Sunday ends it");
assert.deepStrictEqual(M.windowFor("week", "2026-11-09"), { start: "2026-11-09", end: "2026-11-15" });
assert.deepStrictEqual(M.windowFor("month", "2026-02-10"), { start: "2026-02-01", end: "2026-02-28" });
assert.deepStrictEqual(M.windowFor("month", "2028-02-10"), { start: "2028-02-01", end: "2028-02-29" }, "leap year");
assert.deepStrictEqual(M.windowFor("year", "2026-11-02"), { start: "2026-01-01", end: "2026-12-31" });
assert.strictEqual(M.windowFor("week", "garbage"), null);
assert.strictEqual(M.windowFor(null, TODAY), null);

// ── logging against a weekly target ──
const fam = { unit: "hours/week", target: 3, log: [
  { date: "2026-11-01", value: 5 },    // last Sunday: not this week
  { date: "2026-11-02", value: 1 },    // Monday: counts
  { date: "2026-11-05", value: 1.5 },
  { date: "2026-11-08", value: 0.5 },  // Sunday: counts
  { date: "2026-11-09", value: 9 },    // next Monday: not yet
] };
const f = M.periodProgress(fam, "2026-11-04");
assert.strictEqual(f.sum, 3); assert.strictEqual(f.met, true); assert.strictEqual(f.pct, 100);
assert.strictEqual(M.periodProgress(fam, "2026-11-12").sum, 9, "the next week has its own total");
assert.strictEqual(M.periodProgress({ ...fam, log: [{ date: "2026-11-03", value: 1.5 }] }, TODAY).pct, 50);
assert.strictEqual(M.periodProgress({ ...fam, log: [{ date: "2026-11-03", value: 1.5 }] }, TODAY).met, false);
assert.strictEqual(M.periodProgress({ ...fam, log: [{ date: "2026-11-03", value: 99 }] }, TODAY).pct, 100, "never above 100 %");
assert.strictEqual(M.periodProgress({ ...fam, log: [{ date: "2026-11-03", value: 2.99 }] }, TODAY).met, false, "just under is not met");
assert.strictEqual(M.periodProgress({ ...fam, log: [{ date: "2026-11-03", value: 3 }] }, TODAY).met, true, "exactly the target is met");
assert.strictEqual(M.periodProgress({ ...fam, log: undefined }, TODAY).sum, 0);
assert.strictEqual(M.periodProgress({ ...fam, log: [null, { date: "bad", value: 4 }, { date: "2026-11-03", value: "x" }] }, TODAY).sum, 0, "bad entries are ignored");
assert.strictEqual(M.periodProgress({ unit: "kg", target: 3 }, TODAY).counted, false);
assert.strictEqual(M.periodProgress({ ...fam, target: 0, log: [{ date: "2026-11-03", value: 1 }] }, TODAY).pct, 0);
// a ceiling: fights a month, at most 2
const fights = { unit: "count/month", direction: "atMost", target: 2, log: [{ date: "2026-11-03", value: 1 }, { date: "2026-10-30", value: 5 }] };
assert.strictEqual(M.periodProgress(fights, TODAY).met, true);
assert.strictEqual(M.periodProgress(fights, TODAY).pct, 100);
const two = { ...fights, log: [{ date: "2026-11-03", value: 2 }] };
assert.strictEqual(M.periodProgress(two, TODAY).met, true, "exactly at the limit is within it");
const over = { ...fights, log: [{ date: "2026-11-03", value: 4 }] };
assert.strictEqual(M.periodProgress(over, TODAY).met, false);
assert.strictEqual(M.periodProgress(over, TODAY).pct, 50);
// yearly check-ups
const chk = { unit: "check-ups/year", target: 2, log: [{ date: "2026-03-01", value: 1 }, { date: "2025-12-31", value: 1 }] };
assert.strictEqual(M.periodProgress(chk, TODAY).sum, 1, "last year does not count");

// ── income ──
const inc = M.incomeProgress({ kind: "income", unit: "₹/year", target: 2000000, current: 683832 });
assert.strictEqual(inc.pct, 34); assert.strictEqual(inc.yearly, true);
assert.strictEqual(inc.gapPerMonth, Math.round((2000000 - 683832) / 12));
assert.strictEqual(M.incomeProgress({ unit: "₹/month", target: 400000, saved: 0 }).gapPerMonth, 400000);
assert.strictEqual(M.incomeProgress({ unit: "₹/month", target: 100000, current: 100000 }).done, true);
assert.strictEqual(M.incomeProgress({ unit: "₹/month", target: 100000, current: 150000 }).gapPerMonth, 0);
assert.strictEqual(M.incomeProgress({ unit: "₹/month", target: 100000, current: 150000 }).pct, 100);
assert.strictEqual(M.incomeProgress({ unit: "₹/month", target: 0, current: 5 }).done, false);

// ── how a goal is shown ──
const vw = M.view({ ...pw, cat: "body" }, TODAY);
assert.strictEqual(vw.type, "weight"); assert.strictEqual(vw.cat, "body");
assert.strictEqual(vw.headline, "83.9 kg now, target 70 kg");
assert.ok(/BMI 29 now, 24.2 at target/.test(vw.detail) && /13.9 kg to go, about 0.28 kg a month/.test(vw.detail), vw.detail);
assert.ok(vw.notes.some((n) => /53.6 to 72.1 kg/.test(n)));
const va = M.view({ unit: "kg", cat: "body", target: 42, heightCm: A_CM, start: 51, current: 51, dueDate: "2030-12-31" }, TODAY);
assert.ok(va.notes.some((n) => /BMI of 18.1/.test(n) && /doctor/.test(n)), "the low target is flagged kindly, not changed");
assert.ok(va.notes.some((n) => /43 to 57.8 kg/.test(n)));
assert.strictEqual(M.view({ unit: "kg", target: 70, heightCm: P_CM }, TODAY).headline, "Enter your weight to start");
assert.strictEqual(M.view({ ...pw, current: 70 }, TODAY).headline, "70 kg: target reached");
assert.ok(M.view({ ...pw, dueDate: "2026-12-02" }, TODAY).notes.some((n) => /faster than the usual/.test(n)));
const vf = M.view({ ...fam, cat: "people", log: [{ date: "2026-11-03", value: 1.5 }] }, TODAY);
assert.strictEqual(vf.type, "periodic"); assert.strictEqual(vf.headline, "1.5 h of 3 h this week"); assert.strictEqual(vf.detail, "1.5 h to go this week");
assert.strictEqual(M.view({ ...fam, log: [{ date: "2026-11-03", value: 3 }] }, TODAY).detail, "Done for this period");
assert.strictEqual(M.view({ ...over, cat: "people" }, TODAY).detail, "Over the limit");
assert.strictEqual(M.view({ ...fights, cat: "people" }, TODAY).headline, "1 this month, at most 2");
assert.strictEqual(M.view({ unit: "days/week", target: 6, log: [{ date: "2026-11-03", value: 1 }] }, TODAY).headline, "1 days of 6 days this week");
const vi = M.view({ kind: "income", unit: "₹/month", target: 100000, current: 25000 }, TODAY, { inr: (n) => "R" + n });
assert.strictEqual(vi.headline, "Now R25000 a month, target R100000"); assert.strictEqual(vi.detail, "R75000 a month still to add");
assert.strictEqual(M.view({ kind: "income", unit: "₹/year", target: 2000000, current: 600000 }, TODAY, { inr: (n) => "R" + n }).headline, "Now R600000 a year, target R2000000");
assert.strictEqual(M.view({ kind: "income", unit: "₹/month", target: 100, current: 100 }, TODAY).detail, "Target reached");
assert.strictEqual(M.view({ kind: "score", saved: 40 }, TODAY).headline, "40 of 100 done");
assert.strictEqual(M.view({ kind: "score", saved: 140 }, TODAY).pct, 100);
assert.strictEqual(M.view(null, TODAY).type, "other");

// ── what each category asks ──
const goals = [
  { id: "a", unit: "hours/week", target: 3, cat: "people" },
  { id: "b", unit: "hours/week", target: 7, cat: "people" },
  { id: "c", unit: "hours/week", target: 14, cat: "skills" },
  { id: "d", unit: "count/month", direction: "atMost", target: 2, cat: "people" },
  { id: "e", unit: "days/week", target: 6, cat: "body" },
  { id: "w", name: "W", unit: "kg", target: 70, heightCm: P_CM, current: 83.9, dueDate: "2030-12-31" },
  { id: "x", name: "X", unit: "kg", target: 70, heightCm: P_CM, dueDate: "2030-12-31" },
  { id: "y", name: "Y", unit: "kg", target: 70, heightCm: P_CM, current: 69, dueDate: "2030-12-31" },
  { id: "i1", kind: "income", cat: "income", unit: "₹/month", target: 400000, current: 0 },
  { id: "i2", kind: "income", cat: "income", unit: "₹/year", target: 2000000, current: 600000 },
];
const n = M.needs(goals, TODAY);
assert.strictEqual(n.hoursPerWeek, 24, "only hours a week add up; days and counts do not");
assert.strictEqual(n.hoursPerDay, Math.round((24 / 7) * 100) / 100);
assert.strictEqual(n.weights.length, 1, "no weight yet and already-reached goals ask for nothing");
assert.strictEqual(n.weights[0].id, "w"); assert.strictEqual(n.weights[0].kgPerMonth, 0.28);
assert.strictEqual(n.incomeGapPerMonth, 400000 + Math.round(1400000 / 12));
assert.deepStrictEqual(M.needs([], TODAY), { hoursPerWeek: 0, hoursPerDay: 0, weights: [], incomeGapPerMonth: 0 });
assert.strictEqual(M.needs(null, TODAY).hoursPerDay, 0);

// ── grouping ──
const grouped = M.groupByCategory([{ id: "1", cat: "skills" }, { id: "2" }, { id: "3", cat: "body" }, { id: "4", cat: "skills" }, { id: "5", kind: "income" }]);
assert.deepStrictEqual(grouped.map((g) => g.id), ["money", "income", "body", "skills"], "the page's order, empty groups left out");
assert.deepStrictEqual(grouped[3].goals.map((g) => g.id), ["1", "4"], "order inside a group is kept");
assert.strictEqual(grouped[0].label, "Money");
assert.deepStrictEqual(M.groupByCategory(null), []);

// ── blind spots closed after the mutation run ──
assert.strictEqual(M.bmi(1, 150), 0.4, "a one-kilo weight still has a BMI");
assert.strictEqual(M.bmi(50, 1), 500000);
assert.deepStrictEqual(M.healthyRange(1), { minKg: 0, maxKg: 0 });
assert.strictEqual(M.weightPlan({ unit: "kg", target: 0.5, current: 1, dueDate: "2030-12-31" }, TODAY).needsCurrent, undefined);
assert.strictEqual(M.weightPlan({ unit: "kg", target: 70, current: 70.14, dueDate: "2030-12-31" }, TODAY).remaining, 0.1, "one decimal in kilos");
(function () {
  // due in 10 days: the pace is the whole remainder over a third of a month, not over a full month
  const soon = M.weightPlan({ unit: "kg", target: 70, heightCm: P_CM, current: 80, dueDate: "2026-11-12" }, TODAY);
  assert.strictEqual(soon.perMonth, Math.round((10 / (10 / 30.4375)) * 100) / 100);
  assert.strictEqual(soon.perMonth, 30.44);
  assert.strictEqual(soon.tooFast, true);
  // due today: the whole remainder now
  assert.strictEqual(M.weightPlan({ unit: "kg", target: 70, current: 80, dueDate: TODAY }, TODAY).perMonth, 10);
  // reached goals ask for nothing; one kilo left asks for a small amount
  const done = M.weightPlan({ ...pw, current: 70 }, TODAY);
  assert.strictEqual(done.perMonth, 0); assert.strictEqual(done.perWeek, 0);
  const one = M.weightPlan({ ...pw, current: 71 }, TODAY);
  assert.strictEqual(one.perMonth, 0.02); assert.strictEqual(one.done, false);
  // progress when the start is only a kilo above the target
  assert.strictEqual(M.weightPlan({ unit: "kg", target: 70, start: 71, current: 70.5, dueDate: "2030-12-31" }, TODAY).pct, 50);
  assert.strictEqual(M.weightPlan({ unit: "kg", target: 70, start: 70, current: 71, dueDate: "2030-12-31" }, TODAY).pct, 0, "no span: 0 %, not infinity");
  assert.strictEqual(M.weightPlan({ unit: "kg", target: 70, start: 65, current: 71, dueDate: "2030-12-31" }, TODAY).pct, 0);
  // the weekly pace is the monthly pace over 4.33 weeks, to two decimals
  const heavy = M.weightPlan({ unit: "kg", target: 70, current: 90, dueDate: "2026-12-02" }, TODAY);
  assert.strictEqual(heavy.perWeek, Math.round(heavy.perMonth * 12 / 52 * 100) / 100);
  assert.strictEqual(heavy.perWeek, 4.68);   // 20 kg over 30 days = 20.29 kg a month; x 12 / 52
  // exactly 4 kg a month is not too fast; 4.5 is
  const days76 = M.weightPlan({ unit: "kg", target: 70, current: 80, dueDate: "2027-01-17" }, TODAY);
  assert.strictEqual(days76.perMonth, 4); assert.strictEqual(days76.tooFast, false);
  assert.strictEqual(M.weightPlan({ unit: "kg", target: 70, current: 74.5, dueDate: "2026-12-02" }, TODAY).tooFast, true);
  // BMI exactly at the top of the band is inside it
  assert.strictEqual(M.weightPlan({ unit: "kg", target: 24.9, heightCm: 100, current: 30, dueDate: "2030-12-31" }, TODAY).targetAboveBand, false);
  assert.strictEqual(M.weightPlan({ unit: "kg", target: 25, heightCm: 100, current: 30, dueDate: "2030-12-31" }, TODAY).targetAboveBand, true);
})();
// log entries with a time on them count on their day; small amounts keep two decimals
assert.strictEqual(M.periodProgress({ unit: "hours/week", target: 3, log: [{ date: "2026-11-08T09:30:00", value: 1 }, { date: "2026-11-09T00:00:00", value: 5 }] }, TODAY).sum, 1);
assert.strictEqual(M.periodProgress({ unit: "hours/week", target: 3, log: [{ date: "2026-11-03", value: 0.1234 }] }, TODAY).sum, 0.12);
assert.strictEqual(M.periodProgress({ unit: "count/month", direction: "atMost", target: 2, log: [{ date: "2026-11-03", value: 1000 }] }, TODAY).pct, 0);
assert.strictEqual(M.periodProgress({ unit: "hours/week", target: 1, log: [{ date: "2026-11-03", value: 1 }] }, TODAY).pct, 100);
// income edge cases
assert.strictEqual(M.incomeProgress({ unit: "₹/month", target: 0, current: 5 }).pct, 0);
assert.strictEqual(M.incomeProgress({ unit: "₹/month", target: 1, current: 1 }).pct, 100);
assert.strictEqual(M.incomeProgress({ unit: "₹/month", target: 1, current: 1 }).done, true);
// the page's default rupee format and kilo rounding
assert.strictEqual(M.view({ kind: "income", unit: "₹/month", target: 100000, current: 25000 }, TODAY).headline, "Now ₹25000 a month, target ₹100000");
assert.strictEqual(M.view({ ...pw, current: 83.94 }, TODAY).headline, "83.9 kg now, target 70 kg");
assert.strictEqual(M.view({ unit: "kg", target: 70, heightCm: P_CM }, TODAY).pct, 0);
assert.strictEqual(M.view({ kind: "score", saved: 100 }, TODAY).done, true);
assert.strictEqual(M.view({ kind: "score", saved: 99 }, TODAY).done, false);
assert.strictEqual(M.needs([{ unit: "hours/week", target: 1.25 }], TODAY).hoursPerWeek, 1.3);
assert.deepStrictEqual(M.groupByCategory([{ id: "a" }, { id: "b", cat: "body" }, { id: "c", cat: "people" }, { id: "d", cat: "skills" }, { id: "e", kind: "income" }]).map((g) => g.unit), ["₹", "₹ a month or year", "kg, days a week", "hours a week", "hours a week"]);
console.log("goals-measure-core tests passed");
