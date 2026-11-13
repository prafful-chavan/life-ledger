// Job switch planner: dates, service, take-home from the real tax engine, checklist.
const assert = require("assert");
const J = require("../job-switch-core.js");
const T = require("../tax-core.js");
const computeTax = T.engine.computeTax;

// last working day: 90 days from 5 Oct 2026 is 3 Jan 2027 (the household's own figure)
assert.strictEqual(J.lastDay("2026-10-05", 90), "2027-01-03");
assert.strictEqual(J.lastDay("2026-10-05", 0), "2026-10-05");
assert.strictEqual(J.lastDay("2026-10-05", 365), "2027-10-05");
assert.strictEqual(J.lastDay("2026-02-28", 1), "2026-03-01");
assert.strictEqual(J.lastDay("2028-02-28", 1), "2028-02-29", "leap year");
for (const bad of [["", 90], ["2026-13-01", 90], ["2026-02-30", 90], ["2026-10-05", -1], ["2026-10-05", 366], ["2026-10-05", 1.5], ["2026-10-05", "x"]]) assert.strictEqual(J.lastDay(...bad), null, JSON.stringify(bad));

// service and gratuity: joined 1 Mar 2024, leaving 3 Jan 2027 = 2 years 10 months; 5 years reached on 1 Mar 2029
{
  const s = J.service("2024-03-01", "2027-01-03");
  assert.deepStrictEqual([s.years, s.months, s.totalMonths], [2, 10, 34]);
  assert.strictEqual(s.eligibleOn, "2029-03-01"); assert.strictEqual(s.gratuityEligible, false); assert.strictEqual(s.daysShort, J.daysBetween("2027-01-03", "2029-03-01"));
  assert.ok(J.service("2021-01-03", "2027-01-03").gratuityEligible, "exactly on the 5th year");
  assert.strictEqual(J.service("2022-01-03", "2027-01-03").gratuityEligible, true);
  assert.strictEqual(J.service("2022-01-04", "2027-01-03").gratuityEligible, false, "one day short");
  assert.strictEqual(J.service("2022-01-04", "2027-01-03").daysShort, 1);
  assert.strictEqual(J.service("2020-02-29", "2025-02-28").eligibleOn, "2025-02-28", "29 Feb start: 5 years lands on 28 Feb");
  assert.strictEqual(J.service("2027-01-04", "2027-01-03"), null);
  assert.strictEqual(J.service("", "2027-01-03"), null);
}

// take-home uses the real engine: same footing, new regime, FY of the date
{
  const th = J.takeHome({ gross: 3000000, employeePf: 100000, employerNps: 0, ptax: 2400 }, "2026-12-01", computeTax);
  const tax = computeTax({ fy: "2026-27", regime: "new", grossSalary: 3000000, employerNps: 0, basic: 0, professionalTax: 2400 }).totalTax;
  assert.ok(th.ok); assert.strictEqual(th.fy, "2026-27"); assert.strictEqual(th.tax, tax);
  assert.strictEqual(th.year, Math.round(3000000 - 100000 - tax - 2400)); assert.strictEqual(th.month, Math.round(th.year / 12));
  // employer NPS is taxed less (deduction) and is not paid to you
  const withNps = J.takeHome({ gross: 3000000, employeePf: 100000, employerNps: 200000, basic: 1500000, ptax: 2400 }, "2026-12-01", computeTax);
  assert.ok(withNps.tax < th.tax, "employer NPS lowers the tax");
  assert.strictEqual(withNps.year, Math.round(3000000 - 200000 - 100000 - withNps.tax - 2400));
  assert.ok(!J.takeHome({ gross: 0 }, "2026-12-01", computeTax).ok);
  assert.ok(!J.takeHome({ gross: "abc" }, "2026-12-01", computeTax).ok);
  assert.ok(!J.takeHome({ gross: 1000000 }, "1990-01-01", computeTax).ok, "no rules for that year");
  // a Jan date is in the financial year that began the April before
  assert.strictEqual(J.takeHome({ gross: 1000000 }, "2027-01-03", computeTax).fy, "2026-27");
  assert.strictEqual(J.takeHome({ gross: 1000000 }, "2027-04-01", computeTax).fy, "2027-28");
}

// the whole plan
const REC = { resignedOn: "2026-10-05", noticeDays: 90, joinedOn: "2024-03-01", leaveDays: 20, leavePerDay: 3000,
  current: { gross: 3000000, employeePf: 100000 },
  offers: [{ id: "a", name: "Offer A", joinOn: "2027-01-04", gross: 3600000, employeePf: 100000 }, { id: "b", name: "Offer B", joinOn: "2027-02-01", gross: 3300000 }, { id: "c", name: "Offer C", joinOn: "2026-12-20", gross: 3300000 }, { id: "d", name: "No pay yet", joinOn: "2027-01-03" }] };
{
  const p = J.plan(REC, { today: "2026-11-13", computeTax, coverEndsWithJob: [{ person: "Me", type: "Health", cover: 500000 }] });
  assert.strictEqual(p.notice.lastDay, "2027-01-03"); assert.strictEqual(p.notice.daysLeft, J.daysBetween("2026-11-13", "2027-01-03")); assert.strictEqual(p.notice.state, "serving");
  assert.strictEqual(p.leave.amount, 60000);
  assert.strictEqual(p.service.years, 2);
  const by = Object.fromEntries(p.offers.map((o) => [o.id, o]));
  assert.strictEqual(by.a.gapDays, 0, "joining the day after the last day is a clean change-over");
  assert.strictEqual(by.b.gapDays, J.daysBetween("2027-01-03", "2027-02-01") - 1);
  assert.strictEqual(by.c.overlapDays, J.daysBetween("2026-12-20", "2027-01-03") + 1, "joins 14 days before the last day: 15 days to buy out or shorten");
}
{
  const p = J.plan(REC, { today: "2026-11-13", computeTax });
  const d = p.offers.find((o) => o.id === "d");
  assert.strictEqual(d.overlapDays, 1); assert.strictEqual(d.gapDays, null);
  assert.ok(!d.takeHome.ok);
  const a = p.offers.find((o) => o.id === "a");
  assert.ok(a.takeHome.ok && p.current.ok);
  assert.strictEqual(a.vsCurrentMonth, a.takeHome.month - p.current.month);
  assert.ok(Math.abs(a.vsCurrentPct - ((a.takeHome.month - p.current.month) / p.current.month) * 100) < 1e-9);
  assert.ok(a.vsCurrentMonth > 0);
}
// cover gap runs to the earliest joining date, never below zero
{
  const p = J.plan({ ...REC, offers: [REC.offers[1]] }, { today: "2026-11-13", computeTax, coverEndsWithJob: [{ person: "Both", type: "Health", cover: 1 }] });
  assert.strictEqual(p.cover[0].gapDaysToEarliestJoin, 28);
  const q = J.plan({ ...REC, offers: [] }, { today: "2026-11-13", computeTax, coverEndsWithJob: [{ person: "Me", type: "Health", cover: 1 }] });
  assert.strictEqual(q.cover[0].gapDaysToEarliestJoin, null);
  const o = J.plan({ ...REC, offers: [REC.offers[2]] }, { today: "2026-11-13", computeTax, coverEndsWithJob: [{ person: "Me", type: "Health", cover: 1 }] });
  assert.strictEqual(o.cover[0].gapDaysToEarliestJoin, 0);
}
// notice states
for (const [today, st] of [["2027-01-02", "serving"], ["2027-01-03", "today"], ["2027-01-04", "done"]]) assert.strictEqual(J.plan(REC, { today, computeTax }).notice.state, st);
// missing pieces are named, not guessed
{
  const p = J.plan({}, { today: "2026-11-13", computeTax });
  assert.strictEqual(p.notice, null); assert.ok(p.missing.length); assert.strictEqual(p.current, null); assert.deepStrictEqual(p.offers, []);
  const q = J.plan({ resignedOn: "2026-10-05", noticeDays: 90 }, { today: "2026-11-13", computeTax });
  assert.ok(q.notice && q.service === null && q.missing.includes("the date you joined this employer") && q.leave === null);
  assert.strictEqual(J.plan(null, {}).notice, null);
  assert.strictEqual(J.plan({ ...REC, leaveDays: 20, leavePerDay: 0 }, { today: "2026-11-13", computeTax }).leave, null);
}
// checklist: dates only where fixed; Form 16 is due 15 June after the year of exit
{
  const c = J.plan(REC, { today: "2026-11-13", computeTax }).checklist;
  const by = Object.fromEntries(c.map((i) => [i.key, i]));
  assert.strictEqual(by.docs.date, "2027-01-03"); assert.strictEqual(by.form16.date, "2027-06-15"); assert.strictEqual(by.epf.date, null); assert.strictEqual(by.epf.daysTo, null);
  assert.strictEqual(by.docs.daysTo, J.daysBetween("2026-11-13", "2027-01-03"));
  assert.strictEqual(J.plan({ ...REC, resignedOn: "2026-12-10", noticeDays: 30 }, { today: "2026-11-13", computeTax }).checklist.find((i) => i.key === "form16").date, "2027-06-15");
  assert.strictEqual(J.plan({ ...REC, resignedOn: "2027-03-31", noticeDays: 1 }, { today: "2026-11-13", computeTax }).checklist.find((i) => i.key === "form16").date, "2028-06-15", "a last day in April is in the next year");
  assert.ok(c.every((i) => i.done === false));
  const t = J.toggle(REC, "docs"); assert.strictEqual(t.done.docs, true); assert.strictEqual(REC.done, undefined, "input untouched");
  assert.ok(J.plan(t, { today: "2026-11-13", computeTax }).checklist.find((i) => i.key === "docs").done);
  assert.strictEqual(J.toggle(t, "docs").done.docs, undefined);
}
// validation
assert.deepStrictEqual(J.validate(REC), []);
assert.deepStrictEqual(J.validate({}), []);
assert.ok(J.validate({ resignedOn: "2026-02-30" }).length);
assert.ok(J.validate({ noticeDays: 400 }).length); assert.ok(J.validate({ noticeDays: -1 }).length); assert.ok(J.validate({ noticeDays: 2.5 }).length);
assert.deepStrictEqual(J.validate({ noticeDays: 0 }), []); assert.deepStrictEqual(J.validate({ noticeDays: 365 }), []);
assert.ok(J.validate({ joinedOn: "2026-10-06", resignedOn: "2026-10-05" }).length);
assert.deepStrictEqual(J.validate({ joinedOn: "2026-10-05", resignedOn: "2026-10-05" }), []);
assert.ok(J.validate({ joinedOn: "x" }).length); assert.ok(J.validate({ offers: [{ name: "A", joinOn: "2027-99-01" }] }).length);
// blind spots closed after the mutation run
{
  const at = (joinOn) => J.plan({ resignedOn: "2026-10-05", noticeDays: 90, offers: [{ id: "x", joinOn, gross: 1 }] }, { today: "2026-11-13", computeTax }).offers[0];
  assert.deepStrictEqual([at("2027-01-02").gapDays, at("2027-01-02").overlapDays], [null, 2]);
  assert.deepStrictEqual([at("2027-01-03").gapDays, at("2027-01-03").overlapDays], [null, 1]);
  assert.deepStrictEqual([at("2027-01-04").gapDays, at("2027-01-04").overlapDays], [0, null]);
  assert.deepStrictEqual([at("2027-01-05").gapDays, at("2027-01-05").overlapDays], [1, null]);
  assert.deepStrictEqual([at("2027-01-06").gapDays, at("2027-01-06").overlapDays], [2, null]);
  assert.deepStrictEqual([at("").gapDays, at("").overlapDays], [null, null]);
}
assert.ok(J.validate({ noticeDays: 366 }).length);
assert.strictEqual(J.plan({ ...REC, leaveDays: 1, leavePerDay: 0.5 }, { today: "2026-11-13", computeTax }).leave.amount, 1, "a small per-day figure still counts");
assert.strictEqual(J.plan({ ...REC, leaveDays: 0.5, leavePerDay: 1 }, { today: "2026-11-13", computeTax }).leave.days, 0.5);
assert.ok(J.takeHome({ gross: 1 }, "2026-12-01", computeTax).ok, "a tiny pay is still worked out");
assert.ok(J.plan({ ...REC, current: { gross: 1 } }, { today: "2026-11-13", computeTax }).current.ok);
assert.strictEqual(J.plan({ ...REC, current: { gross: 0 } }, { today: "2026-11-13", computeTax }).current, null);
assert.strictEqual(J.plan({ ...REC, current: { gross: 1 }, offers: [{ id: "a", joinOn: "2027-01-04", gross: 1 }] }, { today: "2026-11-13", computeTax }).offers[0].vsCurrentPct, null, "a current take-home of 0 gives no percentage (no divide by zero)");
// service edges
assert.deepStrictEqual([J.service("2024-03-30", "2024-04-30").months, J.service("2024-03-30", "2024-04-29").months], [1, 0]);
assert.deepStrictEqual([J.service("2024-03-01", "2025-03-01").years, J.service("2024-03-01", "2025-02-28").years], [1, 0]);
assert.strictEqual(J.service("2024-03-01", "2024-03-01").totalMonths, 0);
assert.strictEqual(J.service("2024-03-15", "2025-03-10").months, 11);
assert.strictEqual(J.service("2024-03-01", "2027-01-03").daysShort, 788);
assert.strictEqual(J.service("2024-03-01", "2029-03-01").daysShort, 0);
assert.deepStrictEqual([J.service("2024-10-12", "2025-02-12").months, J.service("2024-10-12", "2025-02-11").months, J.service("2024-12-31", "2025-01-30").months, J.service("2024-12-10", "2025-01-09").months], [4, 3, 0, 0]);
assert.strictEqual(J.takeHome({ gross: 1 }, "1990-01-01", computeTax).error, "The tax rules for 1989-90 are not available.");

// ── health cover after the job ──
{
  const LAST = "2027-01-03", ctx = { today: "2026-11-13", groupCover: 1200000, ownHealth: 0, baseline: 1000000 };
  const off = (o) => J.coverPlan({ offers: [{ id: "a", name: "A", joinOn: "2027-01-12", ...o }] }, LAST, ctx).offers[0];
  // cover starts on joining: 4 Jan..11 Jan are uncovered (8 days), the same count as the pay gap
  assert.strictEqual(off({ healthStarts: "joining" }).uncoveredDays, 8);
  assert.strictEqual(off({ healthStarts: "joining" }).startsOn, "2027-01-12");
  // cover starts 30 days after joining: 11 Feb, 38 days uncovered
  assert.strictEqual(off({ healthStarts: "after", healthAfterDays: 30 }).startsOn, "2027-02-11");
  assert.strictEqual(off({ healthStarts: "after", healthAfterDays: 30 }).uncoveredDays, 38);
  assert.strictEqual(off({ healthStarts: "after", healthAfterDays: 0 }).uncoveredDays, 8, "0 days after joining is the same as on joining");
  // the day after the last day: no gap; joining before the last day: never negative
  assert.strictEqual(J.coverPlan({ offers: [{ id: "a", joinOn: "2027-01-04", healthStarts: "joining" }] }, LAST, ctx).offers[0].uncoveredDays, 0);
  assert.strictEqual(J.coverPlan({ offers: [{ id: "a", joinOn: "2026-12-20", healthStarts: "joining" }] }, LAST, ctx).offers[0].uncoveredDays, 0);
  // not entered / no cover / bad inputs are said, never guessed
  for (const o of [{}, { healthStarts: "" }, { healthStarts: "after" }, { healthStarts: "after", healthAfterDays: "" }, { healthStarts: "after", healthAfterDays: -1 }, { healthStarts: "after", healthAfterDays: 1.5 }]) { const r = off(o); assert.strictEqual(r.state, "not entered", JSON.stringify(o)); assert.strictEqual(r.uncoveredDays, null); assert.strictEqual(r.startsOn, null); }
  assert.strictEqual(off({ healthStarts: "none" }).state, "no cover"); assert.strictEqual(off({ healthStarts: "none" }).uncoveredDays, null);
  assert.strictEqual(J.coverPlan({ offers: [{ id: "a", joinOn: "", healthStarts: "joining" }] }, LAST, ctx).offers[0].state, "not entered", "no joining date, no start date");
  // amounts against the group policy and the household's guide
  assert.strictEqual(off({ healthCover: 500000 }).vsGroup, -700000); assert.strictEqual(off({ healthCover: 500000 }).vsBaseline, -500000);
  assert.strictEqual(off({ healthCover: 1200000 }).vsGroup, 0); assert.strictEqual(off({ healthCover: 1500000 }).vsBaseline, 500000);
  assert.strictEqual(off({}).cover, null); assert.strictEqual(off({}).vsGroup, null); assert.strictEqual(off({ healthCover: 0 }).cover, null);
  // who is inside the new cover
  assert.deepStrictEqual([off({ healthSpouse: "yes", healthParents: "no" }).spouse, off({ healthSpouse: "yes", healthParents: "no" }).parents], ["yes", "no"]);
  assert.deepStrictEqual([off({}).spouse, off({}).parents, off({ healthParents: "maybe" }).parents], ["not entered", "not entered", "not entered"]);
  // parents are left out only when every offer says so and no own policy exists
  const left = (offers, own) => J.coverPlan({ offers }, LAST, { ...ctx, ownHealth: own }).parentsLeftOut;
  assert.strictEqual(left([{ id: "a", healthParents: "no" }, { id: "b", healthParents: "no" }], 0), true);
  assert.strictEqual(left([{ id: "a", healthParents: "no" }, { id: "b", healthParents: "yes" }], 0), false);
  assert.strictEqual(left([{ id: "a", healthParents: "no" }, { id: "b" }], 0), false, "an unanswered offer is not 'left out'");
  assert.strictEqual(left([{ id: "a", healthParents: "no" }], 500000), false, "an own policy exists");
  assert.strictEqual(left([], 0), false);
  assert.strictEqual(off({ healthCover: 0 }).vsBaseline, null);
  // ₹1 boundaries
  assert.strictEqual(J.coverPlan({ offers: [] }, LAST, { ...ctx, groupCover: 1 }).groupCover, 1, "a ₹1 group policy is still a policy");
  { const o1 = J.coverPlan({ offers: [{ id: "a", healthCover: 1 }] }, LAST, ctx).offers[0]; assert.strictEqual(o1.cover, 1); assert.strictEqual(o1.vsGroup, 1 - 1200000); assert.strictEqual(o1.vsBaseline, 1 - 1000000); }
  assert.strictEqual(J.coverPlan({ offers: [{ id: "a", healthCover: 5 }] }, LAST, { ...ctx, baseline: 0 }).offers[0].vsBaseline, null, "no baseline, no comparison");
  assert.strictEqual(J.coverPlan({ offers: [{ id: "a", healthCover: 5 }] }, LAST, { ...ctx, baseline: 1 }).offers[0].vsBaseline, 4);
  assert.strictEqual(left([{ id: "a", healthParents: "no" }], 1), false, "even ₹1 of own cover counts");
  // the dates and the figures of the policy itself
  const p = J.coverPlan({ offers: [] }, LAST, ctx);
  assert.deepStrictEqual([p.endsOn, p.firstUncovered, p.daysToEnd, p.groupCover, p.baseline], [LAST, "2027-01-04", 51, 1200000, 1000000]);
  assert.strictEqual(J.coverPlan({ offers: [] }, null, ctx), null); assert.strictEqual(J.coverPlan({ offers: [] }, LAST, { ...ctx, groupCover: 0 }), null, "no group policy, nothing to lose");
  // through the whole plan, and the new checklist steps
  const full = J.plan({ ...REC, offers: [{ ...REC.offers[0], healthStarts: "joining", healthCover: 500000, healthParents: "no" }] }, { today: "2026-11-13", computeTax, groupCover: 1200000, ownHealth: 0, baseline: 1000000 });
  assert.strictEqual(full.coverPlan.offers[0].uncoveredDays, 0); assert.strictEqual(full.coverPlan.parentsLeftOut, true);
  assert.strictEqual(J.plan(REC, { today: "2026-11-13", computeTax }).coverPlan, null, "no group cover given, no cover section");
  const keys = full.checklist.map((i) => i.key); assert.ok(keys.includes("hr-exit") && keys.includes("declare"));
  assert.strictEqual(full.checklist.find((i) => i.key === "hr-exit").date, "2026-12-20", "HR asked 14 days before the last day");
  assert.strictEqual(full.checklist.find((i) => i.key === "declare").date, null);
}
console.log("job-switch-core: ok");
