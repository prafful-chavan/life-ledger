// Rules the household can change in the app instead of in code: tax rates by year (state.taxRules) and the rules of thumb
// (state.ruleSettings). Expected figures are worked by hand from the slabs, not taken from the engine.
const assert = require("assert");
const T = require("../tax-core.js"), P = require("../protection-core.js"), O = require("../tax-oracle.js"), A = require("../mcp/analysis.js");
const E = T.engine, cess = (t) => Math.round(t * 1.04);

const slabs25 = [[400000, 0], [800000, 5], [1200000, 10], [1600000, 15], [2000000, 20], [2400000, 25], [null, 30]];
const edit = (over = {}) => ({ source: "Budget speech, 1 Feb 2027", confirmedOn: "2027-02-01", newRegime: { slabs: slabs25, std: 100000, rebateUpTo: 1200000, rebateMax: 60000, cap80CCD2Pct: 14, ...(over.newRegime || {}) }, ...(over.old ? { old: over.old } : {}) });
const reset = () => E.setOverrides({});
const salary = (g) => ({ fy: "2027-28", regime: "new", grossSalary: g });

// ── An edited year replaces the assumed one, and only that year ──
assert.strictEqual(E.yearRules("2027-28").assumed, true, "FY 2027-28 starts as an assumption");
assert.strictEqual(E.computeTax(salary(1300000)).totalTax, cess(25000), "₹13L, ₹75,000 standard deduction: ₹12.25L, marginal relief caps slab tax at ₹25,000");
let r = E.setOverrides({ "2027-28": edit() });
assert.deepStrictEqual([r.applied, r.problems], [["2027-28"], []]);
assert.strictEqual(E.computeTax(salary(1300000)).totalTax, 0, "with a ₹1L standard deduction the same salary is ₹12L of income: fully rebated");
assert.strictEqual(E.computeTax(salary(1300000)).assumedRules, false, "a confirmed year is no longer 'assumed'");
assert.strictEqual(E.yearRules("2027-28").source, "Budget speech, 1 Feb 2027");
assert.strictEqual(E.computeTax({ fy: "2026-27", regime: "new", grossSalary: 1300000 }).totalTax, cess(25000), "the year before is untouched");
assert.strictEqual(E.YEARS["2027-28"].newRegime.std, 75000, "the built-in table is never changed");
reset();
assert.strictEqual(E.yearRules("2027-28").assumed, true, "clearing the edit restores the assumption");

// ── A year that is not built in starts from the latest one ──
r = E.setOverrides({ "2028-29": edit({ newRegime: { std: 80000 } }) });
assert.deepStrictEqual(r.applied, ["2028-29"]);
assert.strictEqual(E.computeTax({ fy: "2028-29", regime: "new", grossSalary: 1280000 }).totalTax, 0, "₹12.8L − ₹80,000 = ₹12L");
assert.ok(E.knownYears().includes("2028-29"), "the year picker offers it");
assert.strictEqual(E.computeTax({ fy: "2028-29", regime: "old", grossSalary: 500000 + 50000 }).totalTax, 0, "old-regime figures carried over: ₹5L is rebated");
reset();
assert.throws(() => E.computeTax({ fy: "2028-29", regime: "new", grossSalary: 1 }), /No tax rules/, "without the edit the year does not exist");

// ── Mistakes are caught before saving, in plain words, and nothing half-applies ──
const errs = (e) => E.checkYearRules("2027-28", e, E.YEARS["2027-28"]).errors;
assert.ok(errs({ ...edit(), source: "  " }).some((x) => /where this comes from/.test(x)), "a source is required");
assert.ok(errs(edit({ newRegime: { slabs: [[400000, 0], [300000, 5], [null, 30]] } })).some((x) => /higher than the one before/.test(x)), "limits must rise");
assert.ok(errs(edit({ newRegime: { slabs: [[400000, 0], [800000, 30], [1200000, 10], [null, 30]] } })).some((x) => /must not fall/.test(x)), "rates must not fall");
assert.ok(errs(edit({ newRegime: { slabs: [[400000, 5], [null, 30]] } })).some((x) => /first slab/.test(x)), "the lowest slab is normally 0%");
assert.ok(errs(edit({ newRegime: { slabs: [[400000, 0], [800000, 120], [null, 30]] } })).some((x) => /0–100/.test(x)), "a rate over 100%");
assert.ok(errs(edit({ newRegime: { slabs: [[400000, 0], [800000, 5], [1200000, 10]] } })).some((x) => /no upper limit/.test(x)), "the last slab is open-ended");
assert.ok(errs(edit({ newRegime: { std: 9e9 } })).some((x) => /standard deduction/i.test(x)), "an absurd standard deduction");
assert.ok(errs(edit({ newRegime: { cap80CCD2Pct: 50 } })).some((x) => /NPS cap/.test(x)), "NPS cap over 30%");
assert.ok(errs(edit({ newRegime: { rebateMax: 60000, rebateUpTo: 0 } })).some((x) => /income limit/.test(x)), "a rebate without a limit");
assert.deepStrictEqual(E.checkYearRules("27-28", edit(), E.YEARS["2027-28"]).errors.length > 0, true, "a year written wrongly");
assert.ok(E.checkYearRules("2027-29", edit(), E.YEARS["2027-28"]).errors.some((x) => /look like 2027-28/.test(x)), "years are consecutive");
r = E.setOverrides({ "2027-28": edit({ newRegime: { slabs: [[400000, 5], [null, 30]] } }) });
assert.deepStrictEqual([r.applied, r.problems.length, E.overridesApplied()], [[], 1, []], "an invalid edit is reported and not applied");
reset();

// ── The oracle catches a wrong edit to a year the official cases cover ──
assert.strictEqual(O.run(E).failed.length, 0, "built-in rates pass every official case");
E.setOverrides({ "2025-26": edit({ newRegime: { slabs: [[400000, 0], [800000, 5], [null, 30]], std: 75000 } }) });
assert.ok(O.run(E).failed.length >= 10, "a wrong FY 2025-26 slab table fails many official cases");
E.setOverrides({ "2025-26": edit({ newRegime: { std: 75000 } }) });
assert.strictEqual(O.run(E).failed.length, 0, "the same rates re-entered correctly pass");
E.setOverrides({ "2027-28": edit() });
assert.strictEqual(O.run(E).failed.length, 0, "a future year can change without touching the official cases");
reset();

// ── Everything built from the vault uses the edit (the Tax page, advisor, brief and explanations all go through build) ──
{
  const inc = ["2027-04-01", "2027-05-01", "2027-06-01"].map((d) => ({ id: d, person: "Me", date: d, type: "Salary", grossEarnings: 108333, basicSalary: 40000, taxTds: 0, amount: 100000 }));
  const st = (rules) => ({ income: inc, taxProfile: {}, taxRules: rules });
  const before = T.household.build(st({}), "2027-06-20"), after = T.household.build(st({ "2027-28": edit() }), "2027-06-20");
  assert.deepStrictEqual([before.fy, after.fy, before.rules.applied, after.rules.applied], ["2027-28", "2027-28", [], ["2027-28"]]);
  const me = (m) => m.people.find((p) => p.who === "Me");
  assert.ok(me(after).plan.regimes.new.tax < me(before).plan.regimes.new.tax, "a bigger standard deduction lowers the tax");
  assert.strictEqual(me(before).plan.assumedRules, true);
  assert.strictEqual(me(after).plan.assumedRules, false);
  const again = T.household.build(st({}), "2027-06-20");
  assert.strictEqual(me(again).plan.regimes.new.tax, me(before).plan.regimes.new.tax, "building without the edit goes back: nothing leaks between builds");
}
reset();

// ── Rules of thumb ──
{
  assert.deepStrictEqual(P.guides({}), { termMultipleMin: 10, termMultipleMax: 15, healthBaseline: 1000000 }, "common defaults");
  assert.deepStrictEqual(P.guides({ ruleSettings: { termMultipleMin: 12, termMultipleMax: 20, healthBaseline: 2000000 } }), { termMultipleMin: 12, termMultipleMax: 20, healthBaseline: 2000000 });
  assert.strictEqual(P.guides({ ruleSettings: { termMultipleMin: "abc", healthBaseline: -5 } }).termMultipleMin, 10, "junk falls back to the default");
  assert.strictEqual(P.guides({ ruleSettings: { healthBaseline: -5 } }).healthBaseline, 1000000, "a negative baseline falls back");
  assert.strictEqual(P.guides({ ruleSettings: { termMultipleMin: 20, termMultipleMax: 12 } }).termMultipleMax, 20, "the maximum is never below the minimum");
  assert.strictEqual(P.guides({ ruleSettings: { termMultipleMin: "" } }).termMultipleMin, 10, "an empty box is the default");
  const st = (ruleSettings, cover) => ({ ruleSettings, income: [{ person: "Me", date: "2026-09-30", netSalary: 100000 }], insurance: [{ type: "Term life", person: "Me", cover }, { type: "Health", person: "Both", cover: 1500000 }] });
  assert.strictEqual(P.termCheck(st({}, 12000000), "Me").status, "ok", "₹1.2 Cr is exactly 10 × ₹12L");
  assert.strictEqual(P.termCheck(st({}, 11999999), "Me").status, "low");
  const t = P.termCheck(st({ termMultipleMin: 15, termMultipleMax: 20 }, 12000000), "Me");
  assert.deepStrictEqual([t.status, t.min, t.max, t.multipleMin, t.multipleMax], ["low", 18000000, 24000000, 15, 20], "the household's own multiple decides");
  assert.strictEqual(P.healthCheck(st({}, 1)).status, "ok", "₹15L against the ₹10L default");
  assert.strictEqual(P.healthCheck(st({ healthBaseline: 2000000 }, 1)).status, "low", "₹15L against ₹20L");
  assert.strictEqual(P.summary(st({ healthBaseline: 2000000 }, 1), "2026-10-21").health.baseline, 2000000);
  // the Tax page action and the daily brief quote the household's numbers
  const m = T.household.build({ ...st({ termMultipleMin: 15, termMultipleMax: 20 }, 12000000), taxProfile: {}, expenses: [] }, "2026-10-21");
  const a = m.actions.find((x) => x.id === "term-me");
  assert.ok(a && /15–20 × yearly income: ₹1,80,00,000 – ₹2,40,00,000/.test(a.why), "Tax page: " + (a && a.why));
  const brief = A.healthCheck({ ...st({ termMultipleMin: 15, termMultipleMax: 20, healthBaseline: 2000000 }, 12000000), expenses: [] }, "2026-10-21").flags;
  assert.ok(/15–20× yearly-income guide/.test(brief.find((f) => f.topic === "Term cover (Me)").text), "daily brief: term");
  assert.ok(/₹20,00,000 baseline/.test(brief.find((f) => f.topic === "Health cover").text), "daily brief: health");
  assert.ok(/10–15× yearly-income guide/.test(A.healthCheck({ ...st({}, 12000000), expenses: [] }, "2026-10-21").flags.find((f) => f.topic === "Term cover (Me)").text), "defaults read as before");
}

// ── Emergency fund target: the Advisor's own setting drives the daily brief too ──
{
  const base = (months, target) => ({
    income: [{ date: "2026-08-31", amount: 100000, netSalary: 100000, person: "Me", type: "Salary" }],
    expenses: ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"].map((m) => ({ date: m + "-10", amount: 10000, category: "Home" })),
    banksaving: [{ value: months * 10000 }], insurance: [], vehicles: [], liabilities: [], advisor: { profile: target ? { emergencyMonths: target } : {} },
  });
  const f = (s) => A.healthCheck(s, "2026-10-20").flags.find((x) => x.topic === "Emergency fund");
  assert.strictEqual(f(base(6, 0)).level, "good", "default target 6");
  assert.strictEqual(f(base(5.9, 0)).level, "watch");
  assert.strictEqual(f(base(2.9, 0)).level, "act", "under half of the target");
  assert.strictEqual(f(base(9, 12)).level, "watch", "a 12-month target: 9 months is short");
  assert.strictEqual(f(base(12, 12)).level, "good");
  assert.strictEqual(f(base(5.9, 12)).level, "act", "under 6 of 12 months");
  assert.ok(/your target is 12/.test(f(base(9, 12)).text));
}
// ── Limits, exactly: the value at the limit is fine, one step past it is refused ──
{
  const ok = (e) => E.checkYearRules("2027-28", e, E.YEARS["2027-28"]).errors.length === 0;
  const nr = (o) => edit({ newRegime: o });
  assert.ok(ok(nr({ std: 500000 })) && !ok(nr({ std: 500001 })), "standard deduction up to ₹5,00,000");
  assert.ok(ok(nr({ std: 0 })), "a standard deduction of 0 is allowed (the regime had none at first)");
  assert.ok(ok(nr({ cap80CCD2Pct: 30 })) && !ok(nr({ cap80CCD2Pct: 31 })) && ok(nr({ cap80CCD2Pct: 0 })), "NPS cap 0–30%");
  assert.ok(ok(nr({ rebateMax: 0, rebateUpTo: 0 })), "no rebate at all is allowed");
  assert.ok(!ok(nr({ rebateMax: 1, rebateUpTo: 0 })) && ok(nr({ rebateMax: 1, rebateUpTo: 1 })), "any rebate needs an income limit");
  assert.ok(ok(nr({ rebateUpTo: 0, rebateMax: 0, std: 1 })) && !ok(nr({ rebateUpTo: -1 })) && !ok(nr({ rebateMax: -1 })), "no negative rebate");
  assert.ok(ok({ ...edit(), old: { std: 500000, rebateUpTo: 500000, rebateMax: 12500 } }) && !ok({ ...edit(), old: { std: 500001, rebateUpTo: 500000, rebateMax: 12500 } }), "old regime: standard deduction up to ₹5,00,000");
  assert.ok(ok({ ...edit(), old: { std: 0, rebateUpTo: 0, rebateMax: 0 } }), "old regime values of 0");
  assert.ok(!ok({ ...edit(), old: { std: 50000, rebateUpTo: -1, rebateMax: 0 } }), "old regime: no negative limit");
  const sl = (a) => nr({ slabs: a });
  assert.ok(ok(sl([[400000, 0], [800000, 100], [null, 100]])) && !ok(sl([[400000, 0], [800000, 101], [null, 101]])), "a rate of exactly 100% is the ceiling");
  assert.ok(ok(sl([[400000, 0], [800000, 5], [1200000, 5], [null, 30]])), "two neighbouring slabs may share a rate");
  assert.ok(!ok(sl([[400000, 0], [400000, 5], [null, 30]])), "two slabs cannot end at the same income");
  assert.ok(ok(sl([[1, 0], [2, 5], [null, 30]])), "limits only have to rise");
  assert.ok(!ok(sl([[400000, 0], [800000, 5], [null, 30], [null, 31]])), "nothing after the open-ended slab");
  assert.ok(!ok(sl([[400000, 0], [800000, 5], [null, 4]])), "the last rate cannot fall below the one before");
  assert.ok(!ok(sl([[400000, 0]])), "at least two slabs");
  // What gets stored
  const y = E.checkYearRules("2027-28", { ...edit(), source: "x".repeat(300), confirmedOn: "2027-02-01T09:00:00Z" }, E.YEARS["2027-28"]).year;
  assert.deepStrictEqual([y.source.length, y.confirmedOn], [200, "2027-02-01"], "the source is kept to 200 characters; the date to the day");
  assert.strictEqual(y.newRegime.slabs[6][0], Infinity, "the open last slab becomes 'no limit' inside the engine");
  assert.strictEqual(y.assumed, undefined);
}
// The household's guides: each limit exactly
{
  const g = (s) => P.guides({ ruleSettings: s });
  assert.strictEqual(g({ termMultipleMin: 1 }).termMultipleMin, 1); assert.strictEqual(g({ termMultipleMin: 0.5 }).termMultipleMin, 10, "under 1× falls back");
  assert.strictEqual(g({ termMultipleMin: 50 }).termMultipleMin, 50); assert.strictEqual(g({ termMultipleMin: 51 }).termMultipleMin, 10, "over 50× falls back");
  assert.strictEqual(g({ termMultipleMax: 60 }).termMultipleMax, 60); assert.strictEqual(g({ termMultipleMax: 61 }).termMultipleMax, 15, "over 60× falls back");
  assert.strictEqual(g({ termMultipleMax: 1, termMultipleMin: 1 }).termMultipleMax, 1); assert.strictEqual(g({ termMultipleMax: 0.5 }).termMultipleMax, 15);
  assert.strictEqual(g({ healthBaseline: 100000 }).healthBaseline, 100000); assert.strictEqual(g({ healthBaseline: 99999 }).healthBaseline, 1000000, "under ₹1L falls back");
  assert.strictEqual(g({ healthBaseline: 100000000 }).healthBaseline, 100000000); assert.strictEqual(g({ healthBaseline: 100000001 }).healthBaseline, 1000000, "over ₹10 Cr falls back");
  const st = { income: [{ person: "Me", date: "2026-09-30", netSalary: 100000 }], insurance: [{ type: "Term life", person: "Me", cover: 7e6 }, { type: "Term life", person: "Me", cover: 5e6, employer: "Yes" }] };
  const t = P.termCheck(st, "Me");
  assert.deepStrictEqual([t.cover, t.ownCover, t.employerCover, t.status], [12e6, 7e6, 5e6, "employer"], "total cover is own + employer; short on its own, enough with the employer's");
}
console.log("rules config tests passed");
