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

// ── tax if sold today (shared by the Tax page, the Wealth Advisor and the daily brief) ──
{
  const G = require("../tax-core.js").gains;
  const lot = (o) => ({ kind: "mf", name: "F", owner: "Me", cat: "equity", date: "2020-01-01", qty: 1, cost: 0, price: 0, ...o });
  let r = G.taxIfSold([lot({ cost: 100000, price: 300000 })], "2026-10-20", { slab: { Me: 30 }, exemptionLeft: { Me: 125000 } })[0];
  assert.strictEqual(r.key, "mf:F"); assert.strictEqual(r.gainLong, 200000); assert.strictEqual(r.exemptUsed, 125000);
  assert.strictEqual(r.tax, Math.round(75000 * 0.125 * 1.04), "only the part above the unused ₹1.25L is taxed");
  r = G.taxIfSold([lot({ cost: 100000, price: 200000 }), lot({ date: "2026-06-01", cost: 100000, price: 50000 })], "2026-10-20", { slab: { Me: 30 }, exemptionLeft: { Me: 0 } })[0];
  assert.strictEqual(r.gainShort, 0); assert.strictEqual(r.gainLong, 50000, "a short-term loss offsets the long-term gain");
  assert.strictEqual(r.tax, Math.round(50000 * 0.125 * 1.04));
  r = G.taxIfSold([lot({ date: "2026-06-01", cost: 100000, price: 150000 })], "2026-10-20", { slab: { Me: 30 }, exemptionLeft: { Me: 125000 } })[0];
  assert.strictEqual(r.tax, Math.round(50000 * 0.20 * 1.04), "short-term equity at 20%; the exemption is for long-term only");
  r = G.taxIfSold([lot({ cat: "debt", date: "2023-06-01", cost: 100000, price: 110000 })], "2026-10-20", { slab: { Me: 30 }, exemptionLeft: { Me: 125000 } })[0];
  assert.strictEqual(r.tax, Math.round(10000 * 0.30 * 1.04), "debt funds bought from April 2023 at the slab rate (sec 50AA)");
  r = G.taxIfSold([{ kind: "stock", name: "Acme Ltd", symbol: "acme-eq", owner: "Me", cat: "equity", date: "2026-05-24", dateKnown: false, qty: 10, cost: 10000, price: 2000 }], "2026-10-20", { slab: { Me: 30 }, exemptionLeft: { Me: 0 } })[0];
  assert.strictEqual(r.key, "in:ACME", "same key as the Wealth Advisor");
  assert.ok(r.unknownDates && r.tax === null && r.taxRange[0] === Math.round(10000 * 0.125 * 1.04) && r.taxRange[1] === Math.round(10000 * 0.2 * 1.04), "unknown buy dates give a range");
  assert.ok(Array.isArray(m.taxIfSold) && m.taxIfSold.some((x) => x.key === "mf:Gain Fund"), "the household model carries it");
}
console.log("tax if sold tests passed");

// ── salary pattern and employer TDS true-up ──
{
  const { engine: EN } = require("../tax-core.js");
  const prevMonths = ["2025-04-30", "2025-05-31", "2025-06-30", "2025-07-31", "2025-08-31", "2025-09-30", "2025-10-31", "2025-11-30", "2025-12-31", "2026-01-31", "2026-02-28", "2026-03-31"];
  const variable = (d) => ["04", "07", "10", "01"].includes(d.slice(5, 7));
  const prevGross = prevMonths.map((d) => 240000 + (variable(d) ? 70000 : 0));
  const prevTax = EN.computeTax({ fy: "2025-26", regime: "new", grossSalary: prevGross.reduce((a, b) => a + b, 0), basic: 72000 * 12, professionalTax: 2500 }).totalTax;
  const mk = (d, g, tds) => ({ id: "s" + d, person: "Me", date: d, type: "Salary", grossEarnings: g, basicSalary: Math.round(g === 240000 || g === 310000 ? 72000 : 78000), hra: 30000, pf: 9000, taxTds: tds, amount: g - tds });
  const cur = ["2026-04-30", "2026-05-31", "2026-06-30", "2026-07-31", "2026-08-31", "2026-09-30"].map((d) => mk(d, 260000 + (variable(d) ? 70000 : 0), 45000));
  const st = { income: [...prevMonths.map((d, i) => mk(d, prevGross[i], Math.round(prevTax / 12))), ...cur], taxProfile: {} };
  const sp = H.salaryProjection(st, "Me", "2026-27");
  assert.strictEqual(sp.method, "last year's month-by-month pattern");
  assert.deepStrictEqual(sp.variableMonths, ["Oct", "Jan"], "variable-pay months follow last year");
  const scale = 260000 / 240000, expected = cur.reduce((a, r) => a + r.grossEarnings, 0) + Math.round(0) + (310000 * scale) * 2 + 260000 * 4;
  assert.ok(Math.abs(sp.gross - expected) <= 2, `gross ${sp.gross} vs ${expected}`);
  const mm = H.build(st, "2026-10-20"), me2 = mm.people.find((x) => x.who === "Me");
  assert.ok(/deducted the full salary tax last year/.test(me2.salary.tdsAssumption), "last year's TDS matched the salary tax");
  assert.strictEqual(me2.plan.tdsProjected, Math.max(me2.salary.tdsPace, me2.salary.tdsSalaryTax), "TDS is projected to rise to the salary tax");
  assert.ok(me2.plan.tdsProjected > 45000 * 12, "more than the current monthly pace");
  // An employer that under-deducted last year is projected at the current pace
  const under = { income: [...prevMonths.map((d, i) => mk(d, prevGross[i], Math.round(prevTax / 24))), ...cur], taxProfile: {} };
  const mu = H.build(under, "2026-10-20").people.find((x) => x.who === "Me");
  assert.strictEqual(mu.plan.tdsProjected, mu.salary.tdsPace); assert.ok(/current monthly pace/.test(mu.salary.tdsAssumption));
  // A salary with no tax (rebate) never says TDS will rise; ₹200 a month in the TDS field is pointed out as professional tax
  const low = { income: ["2026-04-30", "2026-05-31", "2026-06-30"].map((d) => ({ id: "w" + d, person: "Wife", date: d, type: "Salary", grossEarnings: 60000, basicSalary: 30000, taxTds: 200, amount: 59800 })), taxProfile: {} };
  const wl = H.build(low, "2026-10-20").people.find((x) => x.who === "Wife");
  assert.strictEqual(wl.salary.tdsSalaryTax, 0);
  assert.ok(/No tax is due on this salary/.test(wl.salary.tdsAssumption) && /professional tax/.test(wl.salary.tdsAssumption) && !/expected to rise/.test(wl.salary.tdsAssumption));
}
console.log("salary pattern tests passed");

// ── pre-filling a return's evidence from the app's own records ──
{
  const st = {
    income: ["2024-04-30", "2024-05-31", "2025-03-31", "2025-04-30"].map((d) => ({ person: "Me", date: d, type: "Salary", grossEarnings: 100000, taxTds: 10000, amount: 90000 })),
    mutualFunds: [
      { id: "b", fundName: "Eq Fund", owner: "Me", transactionType: "PURCHASE", units: 100, invested: 10000, purchaseDate: "2022-01-10", latestNav: 300 },
      { id: "r1", fundName: "Eq Fund", owner: "Me", transactionType: "REDEMPTION", units: 50, invested: 12500, purchaseDate: "2024-06-01" },
      { id: "r2", fundName: "Eq Fund", owner: "Me", transactionType: "REDEMPTION", units: 50, invested: 15000, purchaseDate: "2024-09-01" },
    ],
  };
  const ev = H.evidenceFromRecords(st, "Me", "2024-25");
  assert.strictEqual(ev.months, 3, "April, May and March belong to FY 2024-25");
  assert.strictEqual(ev.evidence.ais.salary, 300000); assert.strictEqual(ev.evidence.tds, 30000);
  assert.deepStrictEqual(ev.evidence.brokers, { ltcgBefore: 7500, ltcgAfter: 10000 }, "split at 23-Jul-2024 by sale date");
  assert.deepStrictEqual(H.evidenceFromRecords(st, "Wife", "2024-25").evidence, {}, "nothing is invented when there is no record");
}
console.log("evidence prefill tests passed");

// Form: capital losses carried from an earlier return need ITR-2 (ITR-1 cannot carry them)
{
  const inc = ["2026-04-30", "2026-05-31", "2026-06-30"].map((d) => ({ id: "w" + d, person: "Wife", date: d, type: "Salary", grossEarnings: 60000, basicSalary: 30000, amount: 56000 }));
  const lossRet = { id: "taxr-2025-26-Wife", fy: "2025-26", person: "Wife", filed: { form: "ITR-2", regime: "new", grossSalary: 300000, gains: { stcgAfter: -12000 } }, evidence: {} };
  const plain = H.build({ income: inc, taxProfile: {} }, "2026-10-20").people.find((x) => x.who === "Wife");
  const withLoss = H.build({ income: inc, taxProfile: {}, taxReturns: [lossRet] }, "2026-10-20").people.find((x) => x.who === "Wife");
  assert.strictEqual(plain.plan.form, "ITR-1", "salary only: ITR-1");
  assert.strictEqual(withLoss.plan.form, "ITR-2", "losses brought forward: ITR-2");
  const old = H.build({ income: inc, taxProfile: {}, taxReturns: [{ ...lossRet, fy: "2016-17" }] }, "2026-10-20").people.find((x) => x.who === "Wife");
  assert.strictEqual(old.plan.form, "ITR-1", "a loss older than 8 years no longer counts");
}
console.log("form tests passed");

// Family loans: classified as loans, and each one asks for the borrower's signed note until it is ticked Done
{
  const { gifts: GF } = require("../tax-core.js");
  const loan = GF.classifyGift({ amount: 1500000, date: "2026-05-25", from: "Me", relation: "parent", repaymentExpected: true }, { marriageDate: "2024-06-30" });
  assert.ok(/A loan, not a gift/.test(loan.summary) && /no interest charged, there is none/.test(loan.summary) && !loan.clubbedToGiver, "loan to a parent: no clubbing");
  const sp = GF.classifyGift({ amount: 100000, date: "2026-05-25", from: "Me", to: "Wife", relation: "spouse", repaymentExpected: true }, { marriageDate: "2024-06-30" });
  assert.ok(sp.clubbedToGiver && sp.flags.some((f) => /sec 64/.test(f)), "loan to a spouse: clubbing flagged");
  const fam = [{ id: "taxf-l1", date: "2026-05-25", amount: 1500000, from: "Me", relation: "parent", repaymentExpected: true }, { id: "taxf-g1", date: "2026-05-25", amount: 100000, from: "Me", relation: "parent" }];
  const acts = H.build({ income: [], taxProfile: {}, taxFamily: fam }, "2026-10-20").actions;
  const a = acts.find((x) => x.id === "todo-loan-note-taxf-l1");
  assert.ok(a && /₹15,00,000 from Prafful to a parent/.test(a.title), "loan note action: " + (a && a.title));
  assert.ok(!acts.some((x) => x.id === "todo-loan-note-taxf-g1"), "a gift asks for no loan note");
  assert.ok(!H.build({ income: [], taxProfile: { done: { "loan-note-taxf-l1": "2026-10-21" } }, taxFamily: fam }, "2026-10-20").actions.some((x) => x.id === "todo-loan-note-taxf-l1"), "ticked Done: gone");
  const withCa = H.build({ income: [], taxProfile: { checklist: [{ id: "ca-meeting", title: "CA", due: "2026-12-15" }] }, taxFamily: fam }, "2026-10-20").actions.find((x) => x.id === "todo-loan-note-taxf-l1");
  assert.strictEqual(withCa.due, "2026-12-15", "due with the CA meeting");
  assert.strictEqual(a.due, "", "no CA meeting on the checklist: no date");
}
console.log("family loan tests passed");
