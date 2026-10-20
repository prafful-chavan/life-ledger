const assert = require("assert");
const { household: H, saver: S, engine: E, planner: P } = require("../tax-core.js");

// Synthetic household (made-up numbers): one high earner, one lower earner.
const row = (person, date, g, tds) => ({ id: person + date, person, date, type: "Salary", grossEarnings: g, basicSalary: Math.round(g * 0.3), hra: Math.round(g * 0.2), pf: Math.round(g * 0.12), taxTds: tds, amount: g - tds, organization: "Acme" });
const months = ["2026-04-30", "2026-05-31", "2026-06-30", "2026-07-31", "2026-08-31", "2026-09-30"];
const buy = (id, fund, date, units, invested, nav) => ({ id, fundName: fund, owner: "Me", transactionType: "PURCHASE", units, invested, purchaseDate: date, latestNav: nav });
const state = {
  fx: { usdInr: 90 },
  income: [...months.map((d) => row("Me", d, 260000, 48000)), ...months.map((d) => row("Wife", d, 60000, 0))],
  mutualFunds: [
    buy("a1", "Gain Fund", "2020-01-10", 100, 10000, 300),                      // long-term gain
    buy("w1", "Waiting Fund", "2025-12-01", 100, 10000, 150),                   // short-term gain, turns long-term 2026-12-01 (42 days)
    buy("l1", "Loss Fund", "2024-01-10", 100, 20000, 120),                      // long-term loss
  ],
  taxProfile: { rentMonthly: { Me: 15000 }, otherIncome: { Me: 50000 }, parentsSenior: true },
};
const m = H.build(state, "2026-10-20");
const sv = m.savings;
assert.ok(sv && sv.levers.length, "a savings plan is built");
const me = m.people.find((x) => x.who === "Me"), wife = m.people.find((x) => x.who === "Wife");

// ── employer NPS: engine tax with and without, by start month ──
const nps = S.npsByStart(me.inputs, me.salary.remainingMonths, "2026-10-20", "2027-01");
const I = P.inputs(me.inputs);
assert.strictEqual(nps.cap, I.npsCap);
const first = nps.rows[0];
assert.strictEqual(first.from, "2026-11", "the earliest start is next month");
assert.strictEqual(first.amount, Math.round(I.npsCap / 12 * (me.salary.remainingMonths - 1)), "the month now under way is already processed");
const planned = nps.rows.find((r) => r.planned);
assert.ok(planned && planned.from === "2027-01" && planned.months === 3, "January start leaves Jan, Feb and Mar");
assert.ok(planned.saving < first.saving);
const t0 = S.taxWith(me.inputs, nps.regime).totalTax, t1 = S.taxWith(me.inputs, nps.regime, { base: { employerNps: first.amount } }).totalTax;
assert.strictEqual(first.saving, Math.round(t0 - t1), "saving is the engine's own difference");
assert.ok(nps.rows.every((r, i, a) => i === 0 || r.saving <= a[i - 1].saving), "starting later saves less");
assert.ok(nps.runRate.saving > first.saving && nps.runRate.netCost === nps.runRate.amount - nps.runRate.saving);
assert.strictEqual(S.npsByStart(wife.inputs, wife.salary.remainingMonths).runRate.saving, 0, "no tax to save when the rebate already covers it");
assert.ok(!sv.levers.some((l) => l.id === "nps-Wife"));

// ── regime check ──
const rc = S.regimeCheck(me.inputs);
assert.ok(rc.verdict === "new" && rc.oldMax > rc.newTax);
const atBreak = S.taxWith(me.inputs, "old", { extraDeductions: rc.breakevenExtra }).totalTax;
assert.ok(Math.abs(atBreak - rc.newTax) < 2500, "at the breakeven deductions the two regimes cost the same");

// ── who should earn the income, side business, non-resident cost ──
const loc = S.assetLocation(m.people, {});
const w = loc.members.find((x) => x.who === "Wife"), mm = loc.members.find((x) => x.who === "Me");
assert.strictEqual(mm.taxFreeHeadroom, 0); assert.ok(w.taxFreeHeadroom > 500000 && w.marginalRate < mm.marginalRate);
const biz = S.businessScenarios(m.people, [200000]);
assert.strictEqual(biz[0].owners.find((o) => o.who === "Wife").extraTax, 0, "inside her rebate headroom");
assert.ok(biz[0].owners.find((o) => o.who === "Me").extraTax > 55000, "taxed at 30% plus cess in his name");
assert.strictEqual(biz[0].bestOwner, "Archana");
const nr = S.nonResidentCost(wife);
assert.ok(nr.extraTax > 0, "the rebate is lost as a non-resident");
assert.strictEqual(E.computeTax({ fy: "2026-27", regime: "new", grossSalary: 700000, nonResident: true }).rebate87A, 0);
assert.strictEqual(E.computeTax({ fy: "2026-27", regime: "new", grossSalary: 700000 }).totalTax, 0);

// ── timing ──
const wait = S.waitList(state, "Me", "2026-10-20");
assert.ok(wait.some((x) => x.name === "Waiting Fund" && x.inDays === 42 && x.saving > 0), "a lot 42 days from long-term is listed");
assert.ok(!wait.some((x) => x.name === "Gain Fund"), "an already long-term lot is not");
const loss = S.lossList(state, "Me", "2026-10-20");
assert.ok(loss.some((x) => x.name === "Loss Fund" && x.loss === 8000 && x.term === "long" && x.futureSaving > 0));

// ── a planned side-business start only counts the months left this year ──
const planBiz = H.build({ ...state, taxProfile: { ...state.taxProfile, npsStart: "2027-01", sideBusinessStart: "2027-01-01", sideBusinessProfit: 600000 } }, "2026-10-20");
assert.strictEqual(planBiz.savings.businessMonthsThisYear, 3, "Jan, Feb, Mar");
const b600 = planBiz.savings.business[0];
assert.strictEqual(b600.profit, 600000); assert.strictEqual(b600.thisYear.profit, 150000);
assert.ok(b600.thisYear.owners.find((o) => o.who === "Me").extraTax > 45000);
assert.strictEqual(planBiz.savings.levers.find((l) => l.id === "nps-Me").thisYear, planBiz.savings.perPerson.find((x) => x.who === "Me").nps.rows.find((r) => r.planned).saving, "the lever follows the planned start");
assert.ok(planBiz.actions.some((a) => a.id === "nps-open") && planBiz.actions.some((a) => a.id === "nps-hr") && planBiz.actions.some((a) => a.id === "biz-setup") && planBiz.actions.some((a) => a.id === "biz-tax"), "decisions become dated steps");
assert.strictEqual(H.build(state, "2026-10-20").savings.businessMonthsThisYear, 12);

// ── a missing month of salary is estimated, and the months left follow the calendar ──
const gap = { income: ["2026-04-30", "2026-05-31", "2026-07-31", "2026-08-31", "2026-09-30"].map((d) => row("Me", d, 260000, 48000)), taxProfile: {} };
const sp = H.salaryProjection(gap, "Me", "2026-27");
assert.deepStrictEqual(sp.missingMonths, ["Jun"]); assert.strictEqual(sp.remainingMonths, 6); assert.strictEqual(sp.gross, 260000 * 12, "5 paid + 1 missing + 6 to come");
assert.ok(H.build(gap, "2026-10-20").actions.some((a) => a.id === "missing-Me"), "the gap is flagged so the real payslip can be added");

// ── real-world date mix: the salary sheet dates a month's pay on the 1st, manual entries use the credit date ──
const mix = { income: ["2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01", "2026-08-31", "2026-09-30"].map((d, i) => row("Me", d, [326726, 251126, 282440, 340164, 261564, 261564][i], 47961)), taxProfile: {} };
const mp = H.salaryProjection(mix, "Me", "2026-27");
assert.strictEqual(mp.months, 6); assert.deepStrictEqual(mp.missingMonths, [], "nothing is missing: April to September are all there");
assert.strictEqual(mp.remainingMonths, 6); assert.strictEqual(mp.lastPaidMonth, "Sep");
assert.ok(!H.build(mix, "2026-10-20").actions.some((a) => a.id === "missing-Me"));

// ── whole plan: ranked, totals add up, next year assumed ──
assert.ok(sv.levers.every((l, i, a) => i === 0 || a[i - 1].thisYear + a[i - 1].runRate * 0.5 >= l.thisYear + l.runRate * 0.5), "ranked by value");
assert.strictEqual(sv.totals.thisYear, sv.levers.reduce((a, l) => a + l.thisYear, 0));
assert.ok(sv.levers.some((l) => l.id === "nps-Me") && sv.levers.some((l) => l.id === "location-income"));
assert.ok(m.nextYear.people[0].fy === "2027-28" && m.nextYear.people[0].tax > me.plan.regimes.new.tax, "salary growth raises next year's tax");
assert.strictEqual(E.yearRules("2027-28").assumed, true);

// no salary → no plan, no crash
assert.strictEqual(H.build({ income: [], taxProfile: {} }, "2026-10-20").savings, null);
console.log("tax saver tests passed");
