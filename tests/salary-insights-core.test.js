// The Salary dashboard's rules: one-off months, steady level, jobs, job changes, raises, financial years, milestones,
// take-home breakdown, household and today's-rupees growth. Every limit is tested on both sides.
const assert = require("assert");
const C = require("../salary-insights-core.js");
const Sal = require("../salary-core.js");

const num = (v) => { const n = Number(String(v == null ? "" : v).replace(/[^0-9.-]/g, "")); return Number.isFinite(n) ? n : 0; };
const row = (ym, net, o) => ({ type: "Salary", person: "Me", source: "Acme", date: ym + "-28", netSalary: net, amount: net, ...o });
const series = (start, nets, o) => nets.map((n, i) => row(C.shiftYm(start, i), n, o));
const months = (rows, marks) => C.addLevels(C.flagOneOffs(C.monthsOf(rows, num), marks));
const oneOffYms = (rows, marks) => months(rows, marks).filter((m) => m.oneOff).map((m) => m.ym);

// ── financial year ──
assert.strictEqual(C.fyOf("2026-03"), "2025-26", "March belongs to the year that began the April before");
assert.strictEqual(C.fyOf("2026-04"), "2026-27", "April starts a new year");
assert.strictEqual(C.fyOf("2099-12"), "2099-00", "century roll-over keeps two digits");
assert.strictEqual(C.shiftYm("2026-01", -1), "2025-12"); assert.strictEqual(C.shiftYm("2025-12", 1), "2026-01"); assert.strictEqual(C.shiftYm("2026-09", -12), "2025-09");

// ── a month from payslips ──
let m = C.monthsOf([row("2026-09", 100, { grossEarnings: 150, taxTds: 30, pf: 10 })], num)[0];
assert.deepStrictEqual([m.net, m.gross, m.tds, m.pf, m.other, m.overlap], [100, 150, 30, 10, 10, false], "gross − net − tax − PF is what is left");
m = C.monthsOf([row("2026-09", 100, { grossEarnings: 120, taxTds: 30, pf: 10 })], num)[0];
assert.strictEqual(m.other, 0, "never negative");
m = C.monthsOf([row("2026-09", 100)], num)[0];
assert.strictEqual(m.gross, null, "no gross on the payslip: unknown, not zero"); assert.strictEqual(m.other, null);
m = C.monthsOf([row("2024-03", 200, { source: "New", grossEarnings: 250 }), row("2024-03", 500, { source: "Old", grossEarnings: 600 })], num)[0];
assert.deepStrictEqual([m.net, m.gross, m.overlap, m.source, m.sources], [700, 850, true, "Old", ["New", "Old"]], "two payslips are added; the bigger one names the month");
m = C.monthsOf([row("2024-03", 200, { grossEarnings: 250 }), row("2024-03", 500, { source: "Old" })], num)[0];
assert.strictEqual(m.gross, null, "one payslip without gross makes the month's gross unknown");
assert.deepStrictEqual(C.monthsOf([row("2026-09", 1), { ...row("bad", 5), date: "garbage" }, { ...row("x", 5), date: "" }], num).map((x) => x.ym), ["2026-09"], "rows with no usable date are ignored");
assert.deepStrictEqual(C.monthsOf([row("2026-11", 1), row("2026-09", 2)], num).map((x) => x.ym), ["2026-09", "2026-11"], "oldest first");
assert.strictEqual(C.monthsOf([{ date: "2026-09-30", amount: 77 }], num)[0].net, 77, "net falls back to the amount");

// ── one-offs: both sides of the 25% / 75% limits ──
const flat = (n) => Array(9).fill(n);
const withMid = (mid) => { const a = flat(100); a[4] = mid; return a; };
assert.deepStrictEqual(oneOffYms(series("2025-01", withMid(125))), ["2025-05"], "exactly 25% above the usual is a one-off");
assert.deepStrictEqual(oneOffYms(series("2025-01", withMid(124))), [], "just under 25% above is not");
assert.deepStrictEqual(oneOffYms(series("2025-01", withMid(75))), ["2025-05"], "exactly 75% of the usual is a one-off");
assert.deepStrictEqual(oneOffYms(series("2025-01", withMid(76))), [], "just over 75% is not");
assert.strictEqual(months(series("2025-01", withMid(300)))[4].why, "high"); assert.strictEqual(months(series("2025-01", withMid(10)))[4].why, "low");

// a step up to a new pay is a raise, not a bonus
assert.deepStrictEqual(oneOffYms(series("2025-01", [100, 100, 100, 100, 200, 200, 200, 200])), [], "a permanent step is never a one-off");
// the first month at a much lower pay (a part-month) is not flagged without both neighbours
assert.deepStrictEqual(oneOffYms(series("2025-01", [50, 100, 100, 100, 100])), [], "a low first month has only one neighbour: not flagged");
// but a high last month is (the next payslip may be the bonus)
assert.deepStrictEqual(oneOffYms(series("2025-01", [100, 100, 100, 100, 160])), ["2025-05"], "a spike in the latest month is flagged");
// too little to compare with
assert.deepStrictEqual(oneOffYms(series("2025-01", [100, 400])), [], "a job with two months cannot say what is usual");
// a different job is never the comparison
assert.deepStrictEqual(oneOffYms([...series("2025-01", [30, 30, 30], { source: "A" }), ...series("2025-04", [100, 100, 100], { source: "B" })]), [], "the first month of a new job is compared with its own job");
// quarterly bonus pattern: every third month is high, all flagged, the rest steady
const quarterly = series("2025-01", [100, 100, 160, 100, 100, 160, 100, 100, 160]);
assert.deepStrictEqual(oneOffYms(quarterly), ["2025-03", "2025-06", "2025-09"]);

// two payslips in a month = overlap, a one-off by itself
const overlap = [...series("2025-01", [100, 100, 100]), row("2025-04", 100, { source: "Acme" }), row("2025-04", 90, { source: "Next" }), ...series("2025-05", [100, 100], { source: "Next" })];
assert.deepStrictEqual(oneOffYms(overlap), ["2025-04"]); assert.strictEqual(months(overlap)[3].why, "overlap");

// the household's marks win over the rules
assert.deepStrictEqual(oneOffYms(series("2025-01", flat(100)), { "2025-03": "oneoff" }), ["2025-03"], "marked as one-off");
assert.strictEqual(months(series("2025-01", flat(100)), { "2025-03": "oneoff" })[2].why, "marked");
assert.deepStrictEqual(oneOffYms(series("2025-01", withMid(300)), { "2025-05": "regular" }), [], "marked as regular although it looks like a bonus");
assert.strictEqual(months(series("2025-01", withMid(300)), { "2025-05": "regular" })[4].why, "unmarked");
assert.deepStrictEqual(oneOffYms([...series("2025-01", [100, 100, 100]), row("2025-04", 100), row("2025-04", 90, { source: "N" })], { "2025-04": "regular" }), [], "an overlap can be marked regular too");
assert.deepStrictEqual(oneOffYms(series("2025-01", flat(100)), { "2030-01": "oneoff" }), [], "a mark for a month with no payslip does nothing");

// ── the steady level ──
let lv = months(series("2025-01", [100, 100, 300, 100, 100, 100, 100]));
assert.deepStrictEqual(lv.map((x) => x.levelNet), [100, 100, 100, 100, 100, 100, 100], "a one-off month carries the level before it");
lv = months(series("2025-01", [100, 100, 100, 200, 200, 200]));
assert.deepStrictEqual(lv.map((x) => x.levelNet), [100, 100, 100, 200, 200, 200], "a real step shows in the level on the month it happens");
lv = months(series("2025-01", [100, 100, 100, 140, 100, 100, 100, 100]));
assert.deepStrictEqual(lv.map((x) => x.levelNet), [100, 100, 100, 100, 100, 100, 100, 100], "a blip under the one-off limit is smoothed away (middle of three)");
lv = months(series("2025-01", [300, 100, 100, 100, 100, 100, 100]), { "2025-01": "oneoff" });
assert.strictEqual(lv[0].levelNet, null, "no steady level before the first regular month");
assert.deepStrictEqual(months(series("2025-01", [100, 100, 100])).map((x) => x.levelGross), [null, null, null], "no gross: level of gross unknown");

// ── jobs and job changes ──
const two = [...series("2025-01", [100, 100, 100, 100], { source: "A", grossEarnings: 120 }), ...series("2025-05", [150, 150, 150, 150], { source: "B", grossEarnings: 180 })];
const jobs = C.jobsOf(months(two));
assert.deepStrictEqual(jobs.map((j) => [j.source, j.from, j.to, j.monthCount]), [["A", "2025-01", "2025-04", 4], ["B", "2025-05", "2025-08", 4]]);
const ch = C.jobChanges(jobs);
assert.strictEqual(ch.length, 1); assert.strictEqual(ch[0].grossPct, 50); assert.strictEqual(ch[0].netPct, 50); assert.strictEqual(ch[0].month, "2025-05");
assert.deepStrictEqual(C.jobChanges(C.jobsOf(months(series("2025-01", [100, 100, 100])))), [], "one job: no change");
const noGross = C.jobChanges(C.jobsOf(months([...series("2025-01", [100, 100, 100], { source: "A" }), ...series("2025-04", [200, 200, 200], { source: "B" })])));
assert.strictEqual(noGross[0].grossPct, null, "no gross: the gross change is unknown, the net change is still shown"); assert.strictEqual(noGross[0].netPct, 100);
// the end of a job uses the last steady months, not a farewell payout
const payout = [...series("2025-01", [100, 100, 100, 100, 100, 400], { source: "A" }), ...series("2025-07", [150, 150, 150], { source: "B" })];
assert.strictEqual(C.jobChanges(C.jobsOf(months(payout)))[0].netPct, 50, "a one-off last payslip does not inflate the old pay");

// ── raises: 3% limit ──
const raiseAt = (factor) => C.raisesOf(months(series("2025-01", [1000, 1000, 1000, 1000 * factor, 1000 * factor, 1000 * factor])));
assert.strictEqual(raiseAt(1.03).length, 1, "a 3% step is a raise"); assert.strictEqual(raiseAt(1.029).length, 0, "under 3% is not");
assert.strictEqual(raiseAt(1.1)[0].month, "2025-04"); assert.ok(Math.abs(raiseAt(1.1)[0].pct - 10) < 1e-9);
assert.strictEqual(raiseAt(0.9).length, 0, "a cut is not a raise");
const gR = C.raisesOf(months(series("2025-01", [1000, 1000, 1000, 1100, 1100, 1100], { grossEarnings: 2000 }).map((r, i) => ({ ...r, grossEarnings: i < 3 ? 2000 : 2400 }))));
assert.strictEqual(gR[0].basis, "gross"); assert.ok(Math.abs(gR[0].pct - 20) < 1e-9, "gross when known");
assert.strictEqual(C.raisesOf(months(series("2025-01", [100, 100, 100, 100, 300, 300, 300]).map((r, i) => (i < 4 ? { ...r, source: "A" } : { ...r, source: "B" })))).length, 0, "a new job is a job change, not a raise");

// ── financial years ──
const long = series("2024-04", Array(12).fill(100)).concat(series("2025-04", Array(12).fill(120))).concat(series("2026-04", [120, 120, 120]));
const fy = C.fySummaries(months(long));
assert.deepStrictEqual(fy.map((y) => [y.fy, y.months, y.complete]), [["2024-25", 12, true], ["2025-26", 12, true], ["2026-27", 3, false]]);
assert.strictEqual(fy[1].totalNet, 1440); assert.ok(Math.abs(fy[1].totalPct - 20) < 1e-9); assert.ok(Math.abs(fy[1].levelPct - 20) < 1e-9);
assert.strictEqual(fy[2].totalPct, null, "a part year has no year-on-year total"); assert.ok(Math.abs(fy[2].levelPct - 0) < 1e-9, "but its monthly level can be compared");
assert.strictEqual(fy[0].totalPct, null, "the first year has nothing before it");
const withBonus = series("2024-04", Array(12).fill(100)).concat(series("2025-04", Array(12).fill(100)).map((r, i) => (i === 5 ? { ...r, netSalary: 400, amount: 400 } : r)));
const fb = C.fySummaries(months(withBonus));
assert.strictEqual(fb[1].oneOffNet, 400); assert.strictEqual(fb[1].oneOffMonths, 1); assert.strictEqual(fb[1].regularNet, 1100);
assert.ok(fb[1].totalPct > 20, "total pay includes the bonus"); assert.ok(Math.abs(fb[1].levelPct - 0) < 1e-9, "regular monthly pay without it did not grow");
assert.strictEqual(fb[1].avgRegularNet, 100);
const gapped = series("2025-04", [100, 100, 100]).concat(series("2025-08", Array(8).fill(100)));
assert.strictEqual(C.fySummaries(months(gapped))[0].complete, false, "a year with a missing month is not complete");
assert.deepStrictEqual(C.gapsOf(months(gapped)), ["2025-07"]);
assert.deepStrictEqual(C.gapsOf(months(series("2025-01", [1, 1, 1]))), []);
assert.strictEqual(C.fySummaries(months(series("2025-04", [100, 100], { grossEarnings: 200 })))[0].takeHomePct, 50);
assert.strictEqual(C.fySummaries(months(series("2025-04", [100, 100])))[0].takeHomePct, null, "no gross: no take-home share");

// ── milestones: first month the steady take-home reached the amount ──
const ms = C.milestonesOf(months(series("2025-01", [20000, 20000, 20000, 26000, 26000, 26000, 60000, 60000, 60000])));
assert.deepStrictEqual(ms.map((x) => [x.amount, x.month]), [[25000, "2025-04"], [50000, "2025-07"], [100000, null], [150000, null], [200000, null]]);
assert.strictEqual(C.milestonesOf(months(series("2025-01", [25000, 25000, 25000])))[0].month, "2025-01", "exactly the amount counts");
assert.strictEqual(C.milestonesOf(months(series("2025-01", [24999, 24999, 24999])))[0].month, null, "a rupee short does not");
assert.strictEqual(C.milestonesOf(months(series("2025-01", [20000, 20000, 20000, 20000, 90000, 20000, 20000, 20000, 20000])))[1].month, null, "a one-off bonus never counts as reaching a milestone");

// ── take-home breakdown ──
const b = C.breakdownOf(C.monthsOf([row("2026-09", 700, { grossEarnings: 1000, taxTds: 200, pf: 60 })], num)[0]);
assert.deepStrictEqual(b.parts.map((p) => p.value), [700, 200, 60, 40]); assert.strictEqual(b.takeHomePct, 70);
assert.strictEqual(b.parts.reduce((t, p) => t + p.value, 0), b.gross, "the parts add up to the gross");
assert.strictEqual(C.breakdownOf(C.monthsOf([row("2026-09", 700)], num)[0]), null, "no gross: no breakdown");
assert.strictEqual(C.breakdownOf(null), null);

// ── today's rupees ──
assert.ok(Math.abs(C.growthFactor("2025-09", "2026-09", 5) - 1.05) < 1e-12, "one year at 5%");
assert.strictEqual(C.growthFactor("2026-09", "2026-09", 5), 1, "same month: 1");
assert.ok(Math.abs(C.growthFactor("2025-09", "2026-09", 0) - 1) < 1e-12, "0% inflation: nothing changes");
const pv = C.personView(series("2024-09", Array(25).fill(1000)), num, { inflationPct: 10 });
assert.ok(Math.abs(pv.months[0].netToday - 1000 * 1.1 * 1.1) < 1e-6, "two years back at 10% a year");
assert.strictEqual(pv.months[24].netToday, 1000);
assert.ok(pv.growth.realCagr < 0 && Math.abs(pv.growth.realCagr - (1 / 1.1 - 1) * 100) < 1e-6, "flat pay loses to 10% inflation: real growth ≈ −9.09% a year");
assert.strictEqual(pv.growth.nominalCagr, 0);

// ── a whole person ──
const rows = series("2018-08", [10000, 20000, 40000, 40000, 40000]);
const view = C.personView(rows, num, {});
assert.strictEqual(view.growth.multiple, 40000 / 10000, "latest steady pay against the very first payslip");
assert.strictEqual(view.growth.nominalCagr, null, "under a year: no yearly rate");
assert.strictEqual(C.personView([], num, {}), null); assert.strictEqual(C.personView([{ date: "x" }], num, {}), null);
assert.strictEqual(C.personView(series("2025-01", [1, 1, 1]), num, { asOf: "2025-06" }).asOf, "2025-06"); assert.strictEqual(C.personView(series("2025-01", [1, 1, 1]), num, { asOf: "nonsense" }).asOf, "2025-03");

// ── analyze: salary rows only, people apart, household together ──
const income = [
  ...series("2025-01", Array(14).fill(1000), { person: "Me", grossEarnings: 1500 }),
  ...series("2025-08", Array(7).fill(500), { person: "Wife", source: "Z" }),
  { ...row("2025-05", 9999), type: "Interest", netSalary: 0, amount: 9999, grossEarnings: 0 },
];
const res = C.analyze(income, num, Sal.isSalary, {});
assert.deepStrictEqual(Object.keys(res.views).sort(), ["Me", "Wife"]); assert.strictEqual(res.views.Me.months.length, 14, "interest is not salary");
assert.strictEqual(res.household.latest.net, 1500); assert.strictEqual(res.household.latest.level, 1500);
assert.strictEqual(res.household.rows.find((r) => r.ym === "2025-07").level, 1000, "before she started, the household is you alone");
assert.strictEqual(res.household.rows.find((r) => r.ym === "2025-08").level, 1500);
const hs = res.household.shares; assert.ok(Math.abs(hs[0].sharePct + hs[1].sharePct - 100) < 1e-9, "shares add to 100"); assert.ok(Math.abs(hs[1].sharePct - 33.3333333) < 1e-5);
assert.deepStrictEqual([res.household.growth12.from, res.household.growth12.to, res.household.growth12.nominalPct], [1000, 1500, 50], "a second salary joining counts in the household's growth");
assert.strictEqual(C.analyze(series("2025-01", Array(12).fill(1000)), num, Sal.isSalary, {}).household.growth12, null, "twelve months of history is not enough: it needs the month a year before the latest");
const res3 = C.analyze([...series("2025-01", Array(12).fill(1000)), ...series("2026-01", Array(3).fill(1100))], num, Sal.isSalary, { inflationPct: 5 });
assert.ok(Math.abs(res3.household.growth12.nominalPct - 10) < 1e-9, "level up 10% over the year");
assert.ok(Math.abs(res3.household.growth12.realPct - (1100 / (1000 * 1.05) - 1) * 100) < 1e-9, "in today's rupees: 10% minus 5% prices");
// marks come per person
const resMark = C.analyze(series("2025-01", flat(100)), num, Sal.isSalary, { marks: { Me: { "2025-03": "oneoff" }, Wife: { "2025-04": "oneoff" } } });
assert.deepStrictEqual(resMark.views.Me.oneOffs.map((x) => x.ym), ["2025-03"], "marks of someone else do not apply");
assert.strictEqual(C.analyze([], num, Sal.isSalary, {}).household, null, "no salary: no household");
// the inflation setting: blank or nonsense falls back to the default
assert.strictEqual(C.analyze(series("2025-01", flat(100)), num, Sal.isSalary, { inflationPct: "" }).inflationPct, C.DEFAULT_INFLATION_PCT);
assert.strictEqual(C.analyze(series("2025-01", flat(100)), num, Sal.isSalary, { inflationPct: "abc" }).inflationPct, C.DEFAULT_INFLATION_PCT);
assert.strictEqual(C.analyze(series("2025-01", flat(100)), num, Sal.isSalary, { inflationPct: "7.5" }).inflationPct, 7.5);
assert.strictEqual(C.analyze(series("2025-01", flat(100)), num, Sal.isSalary, { inflationPct: 0 }).inflationPct, 0, "0% is a real choice");
assert.strictEqual(C.analyze(series("2025-01", flat(100)), num, Sal.isSalary, {}).inflationPct, C.DEFAULT_INFLATION_PCT);

// ── details that would otherwise slip (found by mutation testing) ──
let z = C.monthsOf([{ date: "2026-09-30", source: "X" }], num)[0];
assert.deepStrictEqual([z.net, z.tds, z.pf], [0, 0, 0], "a payslip with no figures is zero, not one");
z = C.monthsOf([row("2026-09", 100, { grossEarnings: 1 })], num)[0]; assert.strictEqual(z.gross, 1, "a gross of ₹1 is still a gross");
assert.strictEqual(C.monthsOf([row("2026-09", 50, { source: "First" }), row("2026-09", 50, { source: "Second" })], num)[0].source, "First", "on a tie the first payslip names the month");
assert.strictEqual(C.monthsOf([row("2026-09", 10, { source: "Small" }), row("2026-09", 50, { source: "Big" })], num)[0].source, "Big");
// a former employer's payslip in a month already spent at the new job does not cut that job in two
{
  const jobs = (rows) => C.jobsOf(C.monthsOf(rows, num)).map((j) => `${j.source}:${j.from}→${j.to}`);
  const base = [row("2024-01", 100, { source: "Old" }), row("2024-02", 100, { source: "Old" }), row("2024-03", 200, { source: "New" }), row("2024-04", 200, { source: "New" })];
  assert.deepStrictEqual(jobs([...base, row("2024-05", 200, { source: "New" }), row("2024-06", 200, { source: "New" }), row("2024-06", 600, { source: "Old" }), row("2024-07", 200, { source: "New" })]), ["Old:2024-01→2024-02", "New:2024-03→2024-07"], "the old employer's big payment in June is the same job as May and July");
  const jun = C.monthsOf([...base, row("2024-05", 200, { source: "New" }), row("2024-06", 200, { source: "New" }), row("2024-06", 600, { source: "Old" }), row("2024-07", 200, { source: "New" })], num).find((m) => m.ym === "2024-06");
  assert.deepStrictEqual([jun.source, jun.overlap, jun.net, jun.sources.length], ["New", true, 800, 2], "still an overlap month with both payslips added; only the name changes");
  // no cut when the months beside it are not adjacent, or only one side continues, or the employer carrying on is not in the month
  assert.deepStrictEqual(jobs([row("2024-05", 200, { source: "New" }), row("2024-06", 200, { source: "New" }), row("2024-06", 600, { source: "Old" }), row("2024-08", 200, { source: "New" })]), ["New:2024-05→2024-05", "Old:2024-06→2024-06", "New:2024-08→2024-08"], "July is missing: the months are not neighbours, so the bigger payslip names June");
  assert.deepStrictEqual(jobs([row("2024-05", 200, { source: "New" }), row("2024-06", 200, { source: "New" }), row("2024-06", 600, { source: "Old" })]), ["New:2024-05→2024-05", "Old:2024-06→2024-06"], "the last month has nothing after it");
  assert.deepStrictEqual(jobs([row("2024-06", 200, { source: "New" }), row("2024-06", 600, { source: "Old" }), row("2024-07", 200, { source: "New" })]), ["Old:2024-06→2024-06", "New:2024-07→2024-07"], "the first month has nothing before it");
  assert.deepStrictEqual(jobs([row("2024-05", 200, { source: "A" }), row("2024-06", 200, { source: "B" }), row("2024-06", 600, { source: "C" }), row("2024-07", 200, { source: "A" })]), ["A:2024-05→2024-05", "C:2024-06→2024-06", "A:2024-07→2024-07"], "neither payslip belongs to the job on both sides");
  // the job on BOTH sides decides: one side alone, or the month two back, does not
  assert.deepStrictEqual(jobs([row("2024-05", 200, { source: "New" }), row("2024-06", 200, { source: "New" }), row("2024-06", 600, { source: "Old" }), row("2024-07", 200, { source: "Other" })]), ["New:2024-05→2024-05", "Old:2024-06→2024-06", "Other:2024-07→2024-07"], "New is before June but not after it");
  assert.deepStrictEqual(jobs([row("2024-05", 200, { source: "Other" }), row("2024-06", 200, { source: "New" }), row("2024-06", 600, { source: "Old" }), row("2024-07", 200, { source: "New" })]), ["Other:2024-05→2024-05", "Old:2024-06→2024-06", "New:2024-07→2024-07"], "New is after June but not before it");
  assert.deepStrictEqual(jobs([row("2024-04", 100, { source: "Old" }), row("2024-05", 200, { source: "New" }), row("2024-06", 200, { source: "New" }), row("2024-06", 600, { source: "Old" }), row("2024-07", 200, { source: "New" })]), ["Old:2024-04→2024-04", "New:2024-05→2024-07"], "May and July are New; April (two months back) is irrelevant");
  // a real job change month keeps the bigger payslip's name
  assert.deepStrictEqual(jobs([row("2024-02", 100, { source: "Old" }), row("2024-03", 200, { source: "New" }), row("2024-03", 500, { source: "Old" }), row("2024-04", 200, { source: "New" })]), ["Old:2024-02→2024-03", "New:2024-04→2024-04"], "Old carries on only on one side");
}
// only three months either side are compared (a far-off month does not change what is usual)
assert.deepStrictEqual(oneOffYms(series("2025-01", [900, 900, 900, 900, 100, 100, 100, 100, 160, 100, 100, 100, 100])), ["2025-09"], "months beyond three away are ignored");
assert.deepStrictEqual(oneOffYms(series("2025-01", [100, 100, 100, 160, 100, 100, 900, 900])), ["2025-04"], "…on both sides");
// exactly two other months are enough to judge; a spike in the middle of three
assert.deepStrictEqual(oneOffYms(series("2025-01", [100, 200, 100])), ["2025-02"], "two neighbours are enough");
// an overlap month beside a regular month is not used as a neighbour
assert.deepStrictEqual(oneOffYms([row("2025-01", 100), row("2025-02", 100), row("2025-03", 500, { source: "Acme" }), row("2025-03", 500, { source: "Other" }), row("2025-04", 100), row("2025-05", 100)]).includes("2025-02"), false);
// the last month is judged against the months before it; the first against those after
assert.deepStrictEqual(oneOffYms(series("2025-01", [160, 100, 100, 100, 100])), ["2025-01"], "a spike in the first month is flagged too");
// levels use only the same job (a new job's first month is not smoothed with the old job)
const lvJob = months([...series("2025-01", [100, 100, 100], { source: "A" }), ...series("2025-04", [300, 300, 300], { source: "B" })]);
assert.deepStrictEqual(lvJob.map((x) => x.levelNet), [100, 100, 100, 300, 300, 300], "levels do not blend jobs");
assert.strictEqual(months(series("2025-01", [100, 100, 100, 100])).map((x) => x.levelNet).length, 4);
// a job's start and end are the first and last three steady months
const jb = C.jobsOf(months(series("2025-01", [100, 110, 120, 130, 140, 150, 160])))[0];
assert.deepStrictEqual([jb.startNet, jb.endNet], [110, 150], "first three: middle is 110; last three: middle is 150");
// gaps: missing first/last/inside, edges not reported
assert.deepStrictEqual(C.gapsOf(months(series("2025-01", [1, 1, 1]))), []);
assert.deepStrictEqual(C.gapsOf(months([row("2025-01", 1), row("2025-03", 1)])), ["2025-02"]);
assert.deepStrictEqual(C.gapsOf(months([row("2025-01", 1), row("2025-04", 1)])), ["2025-02", "2025-03"]);
// household uses the latest month of anyone, and zero pay gives zero shares
const hh = C.analyze([...series("2025-01", Array(14).fill(1000), { person: "Me" }), ...series("2025-01", Array(13).fill(500), { person: "Wife" })], num, Sal.isSalary, {}).household;
assert.strictEqual(hh.latest.ym, "2026-02"); assert.strictEqual(hh.latest.level, 1500, "her last month is a month back: her last level still counts");
assert.strictEqual(hh.growth12.from, 1500, "twelve months before the latest month of anyone");
const hz = C.householdView({ Me: C.personView(series("2025-01", [0, 0, 0]), num, {}) }, {});
assert.strictEqual(hz.shares[0].sharePct, 0, "no pay: a zero share");
// yearly rates: exactly one year counts; under it does not
const oneYear = C.personView(series("2025-01", [...Array(10).fill(100), 200, 200, 200]), num, {});
assert.strictEqual(oneYear.growth.years, 1); assert.ok(Math.abs(oneYear.growth.nominalCagr - 100) < 1e-9, "doubling in exactly a year is 100% a year (a percent, not a fraction)");
assert.ok(oneYear.growth.realCagr !== null, "a year of history gives a real rate too");
const elevenMonths = C.personView(series("2025-01", [...Array(9).fill(100), 200, 200, 200]), num, {});
assert.ok(Math.abs(elevenMonths.growth.years - 11 / 12) < 1e-12); assert.strictEqual(elevenMonths.growth.nominalCagr, null); assert.strictEqual(elevenMonths.growth.realCagr, null);
const twoYears = C.personView(series("2025-01", [...Array(22).fill(100), 400, 400, 400]), num, { inflationPct: 0 });
assert.ok(Math.abs(twoYears.growth.nominalCagr - 100) < 1e-6, "×4 in two years is ×2 a year"); assert.ok(Math.abs(twoYears.growth.realCagr - 100) < 1e-6, "no inflation: real equals nominal");
assert.strictEqual(C.personView(series("2025-01", [100, 500, 500, 100, 100]), num, {}).highest.ym, "2025-02", "the first of two equal highest months");
assert.strictEqual(C.personView(series("2025-01", [900, 100, 100]), num, {}).highest.ym, "2025-01", "the highest can be the very first month");
const lastM = C.personView(series("2025-01", [100, 100, 100, 100]), num, {});
assert.strictEqual(lastM.last.ym, "2025-04"); assert.strictEqual(lastM.levelNetTodayCheck, undefined);
assert.ok(Math.abs(C.personView(series("2025-01", [100, 100, 100]), num, { inflationPct: 10, asOf: "2026-01" }).months[0].levelNetToday - 100 * Math.pow(1.1, 1)) < 1e-9, "level in today's rupees");
assert.strictEqual(C.fySummaries(months(series("2025-04", [100, 100, 100])))[0].takeHomePct, null);
assert.strictEqual(C.fySummaries(months([row("2025-04", 100, { grossEarnings: 200 }), row("2025-05", 100)]))[0].totalGross, null, "gross unknown for a year when any month lacks it");
assert.strictEqual(C.fySummaries(months(series("2025-04", [100, 100], { grossEarnings: 150, taxTds: 20 })))[0].totalTds, 40);

// edges of the steady level: the first month of a job keeps its own pay (nothing before it in the same job to smooth with)
assert.deepStrictEqual(months([...series("2025-01", [100, 100, 100, 100], { source: "A" }), ...series("2025-05", [230, 200, 200, 200], { source: "B" })]).map((x) => x.levelNet), [100, 100, 100, 100, 230, 200, 200, 200], "no blending across jobs, edges keep their own pay");
assert.deepStrictEqual(months(series("2025-01", [100, 120, 120, 120])).map((x) => x.levelNet), [100, 120, 120, 120], "first month keeps its own pay");
assert.deepStrictEqual(months(series("2025-01", [100, 100, 100, 110])).map((x) => x.levelNet), [100, 100, 100, 110], "last month keeps its own pay");
assert.strictEqual(C.raisesOf(months(series("2025-01", [100, 200, 200, 200])))[0].month, "2025-02", "a raise in the second month is found");

// ── a person's own last-twelve-months growth ──
{
  const g = C.personView(series("2025-01", [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1100, 1100, 1100]), num, { inflationPct: 5 }).growth12;
  assert.strictEqual(g.fromYm, "2025-03"); assert.strictEqual(g.from, 1000); assert.strictEqual(g.to, 1100); near2(g.nominalPct, 10); near2(g.realPct, (1100 / 1050 - 1) * 100);
  assert.strictEqual(C.personView(series("2025-01", Array(12).fill(1000)), num, {}).growth12, null, "a year of pay is not enough: it needs the month a year before the latest");
  assert.notStrictEqual(C.personView(series("2025-01", Array(13).fill(1000)), num, {}).growth12, null, "thirteen months is");
}
function near2(a, b) { assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`); }

console.log("salary-insights-core: all checks passed");
