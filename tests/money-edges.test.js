// Protection, loans, spending import and the holdings check: rules the mutation test showed were unchecked.
const assert = require("assert");
const P = require("../protection-core.js"), L = require("../liability-calc.js"), S = require("../spending-core.js"), HC = require("../mcp/holdings-check.js");

// ── Protection ──
{
  const st = { income: [{ person: "Me", date: "2026-09-30", netSalary: 200000 }, { person: "Me", date: "2026-08-31", netSalary: 200000 }, { person: "Me", date: "2026-07-31", netSalary: 200000 }, { person: "Wife", date: "2026-09-30", amount: 50000 }],
    insurance: [{ type: "Term life", person: "Me", cover: 1e7, premium: 12000, frequency: "Yearly", nextDue: "2026-11-10" }, { type: "Health", person: "Both", cover: 5e5, premium: 1000, frequency: "Monthly", nextDue: "2026-10-25" }],
    vehicles: [{ value: 400000 }], expenses: [] };
  const t = P.termCheck(st, "Me");
  assert.deepStrictEqual([t.income, t.min, t.max], [2400000, 24000000, 36000000], "the steady monthly salary × 12; guide 10–15×");
  const s = P.summary(st, "2026-10-20");
  assert.strictEqual(s.yearlyPremium, 12000 + 12000, "a monthly premium counts 12 times a year");
  assert.strictEqual(Math.round(s.premiumShareOfIncome * 100) / 100, Math.round((24000 / (200000 * 12 + 50000 * 12)) * 10000) / 100, "premiums as % of both yearly incomes");
  assert.deepStrictEqual(s.dueSoon.map((d) => d.p.type), ["Health", "Term life"], "renewals soonest first");
  assert.strictEqual(P.summary({ ...st, income: [] }, "2026-10-20").premiumShareOfIncome, null, "no income: no share");
  assert.strictEqual(P.dueStatus("2026-11-19", "2026-10-20").state, "soon", "30 days away is soon");
  assert.strictEqual(P.dueStatus("2026-11-20", "2026-10-20").state, "ok", "31 days away is not");
  assert.strictEqual(P.advanceDue("2026-11-30", "Quarterly"), "2027-02-28", "a quarter after 30 Nov is the end of February");
  assert.strictEqual(P.advanceDue("2026-11-10", "Something else"), "2027-11-10", "unknown frequency: yearly");
  assert.strictEqual(P.nextBirthday("1997-05-22", "2026-05-21").date, "2026-05-22", "the day before: this year's");
  assert.strictEqual(P.nextBirthday("1997-05-22", "2026-06-21").date, "2027-05-22", "same day-of-month, later month: next year's");
  const sp = P.monthlySpending({ expenses: [{ date: "2026-04-01", amount: 600 }, { date: "2026-03-31", amount: 9999 }, { date: "2026-10-05", amount: 9999 }, { date: "2026-09-30", amount: 600 }] }, "2026-10-20");
  assert.strictEqual(sp, 200, "the six complete months before (Apr–Sep), divided by 6; not March, not this month");
  const g = P.suggestGoals({ expenses: [{ date: "2026-09-10", amount: 60000 }], goals: [], banksaving: [{ value: 1000 }], fd: [{ value: 2000 }], people: { me: { dob: "1995-10-22" } } }, "2026-10-20");
  const em = g.find((x) => x.key === "emergency"), ret = g.find((x) => x.key === "retirement");
  assert.deepStrictEqual([em.target, em.saved], [60000, 3000], "6 months of ₹10,000 average spending; progress from bank + FDs");
  assert.deepStrictEqual([ret.target, ret.saved, ret.dueDate], [3000000, 0, "2055-10-22"], "25 × a year of spending, due at 60");
}

// ── Loans: interest first, then principal; undo only if nothing changed since ──
{
  assert.strictEqual(L.monthlyInterest(120000, 12), 1200, "12% a year on ₹1.2L is ₹1,200 a month");
  assert.strictEqual(L.monthlyInterest(120000, 0), 0);
  let l = L.applyEmiPayment({ value: 120000, rate: 12 }, { amount: 5000, date: "2026-10-10" });
  assert.deepStrictEqual([l.value, l.payments[0].interest, l.payments[0].principal, l.payments[0].id], [116200, 1200, 3800, "pay-2026-10-10-5000"], "₹1,200 interest, ₹3,800 off the loan");
  l = L.applyEmiPayment({ value: 1000, rate: 0 }, { amount: 5000, date: "2026-10-10" });
  assert.strictEqual(l.value, 0, "never below zero");
  assert.throws(() => L.applyEmiPayment({ value: 0 }, { amount: 1, date: "x" }), /fully paid/);
  assert.throws(() => L.applyEmiPayment({ value: 10 }, { amount: 0, date: "x" }), /greater than zero/);
  const two = L.applyEmiPayment(L.applyEmiPayment({ value: 10000, rate: 0 }, { amount: 1000, date: "2026-09-10" }), { amount: 1000, date: "2026-10-10" });
  const u = L.undoLastPayment(two);
  assert.deepStrictEqual([u.ok, u.liability.value, u.liability.payments.length, u.liability.payments[0].date], [true, 9000, 1, "2026-09-10"], "only the last payment comes off");
  assert.strictEqual(L.undoLastPayment({ ...two, value: 5 }).ok, false, "edited since: not undone");
  assert.deepStrictEqual([L.paidThisMonth(two, "2026-10-31"), L.paidThisMonth(two, "2026-11-01")], [true, false]);
  const n = L.normalizeLiability({ emi: -5, rate: -1, emiDay: 40 });
  assert.deepStrictEqual([n.emi, n.rate, n.emiDay], [0, 0, 31], "no negative EMI or rate; the EMI day within the month");
}

// ── Spending import ──
{
  // The spending app stores a date as Core Data seconds (from 2001) at midnight IST, i.e. 18:30 UTC the day before
  const cd = (iso) => (Date.parse(iso + "T00:00:00+05:30") / 1000) - 978307200;
  assert.strictEqual(S.coreDataToISODate(cd("2026-10-01")), "2026-10-01", "midnight IST is that day, not the day before");
  assert.strictEqual(S.coreDataToISODate(cd("2026-10-01") + 86399), "2026-10-01", "23:59:59 IST is still that day");
  const rows = [{ date: cd("2026-10-01"), amount: -50, category: "Chai", name: "Chai" }, { date: cd("2026-10-01"), amount: 50, category: "Chai", name: "Chai" }, { date: cd("2026-10-02"), amount: 0, category: "", name: "" }];
  const ex = S.rowsToExpenses(rows, { idPrefix: "sp-" });
  assert.strictEqual(ex[0].amount, 50, "amounts are positive");
  assert.ok(!/-\d+$/.test(ex[0].id.slice(3)) && ex[1].id === ex[0].id + "-2", "the same chai twice gets a second id, not a duplicate");
  assert.deepStrictEqual([ex[2].category, ex[2].amount], ["General", 0]);
  const plan = S.planImport([{ id: "manual", date: "2026-10-01", amount: 50 }], ex, [], { today: "2026-10-01" });
  assert.deepStrictEqual([plan.matchedExisting, plan.toAdd.length, plan.skippedFuture], [1, 1, 1], "one matches a hand entry; the second chai is new; tomorrow's waits");
  assert.strictEqual(S.planImport([], ex, [], { today: "2026-10-02" }).skippedFuture, 0, "a row dated today is imported today");
  assert.strictEqual(S.monthTotal([{ date: "2026-10-20", amount: 5 }, { date: "2026-10-21", amount: 7 }], "2026-10", "2026-10-20"), 5, "this month so far: up to and including today");
  const mine = Array.from({ length: 20 }, (_, i) => ({ id: "sp-" + i }));
  assert.strictEqual(S.planRemovals(mine, mine.slice(0, 10), "sp-").tooFewRows, false, "half the rows back is not 'too few'");
  assert.strictEqual(S.planRemovals(mine, mine.slice(0, 9), "sp-").tooFewRows, true, "under half the rows back: something went wrong, don't mirror");
  assert.strictEqual(S.planRemovals(mine.slice(0, 19), [], "sp-").tooFewRows, false, "fewer than 20 rows: the check does not apply");
  const canon = S.categoryCanon([{ category: "Gromming" }, { category: "Grooming" }, { category: "Grooming" }]);
  assert.ok(Object.values(canon).includes("Grooming") && !Object.values(canon).includes("Gromming"), "the more common spelling wins");
  assert.strictEqual(S.overlapRatio ? S.overlapRatio([], []) : 0, 0, "nothing incoming: no overlap");
}

// ── Holdings check: the values it reports, and symbol matching for US shares ──
{
  const app = HC.appHoldings({ mutualFunds: [{ owner: "Me", fundName: "F", units: 10, latestNav: 7 }], stocks: [{ owner: "Wife", symbol: "abc", company: "Abc Ltd", quantity: 3, currentPrice: 11 }], usstocks: [{ symbol: "AAPL", company: "Apple", quantity: 2, currentPrice: 5 }] }, 90);
  assert.deepStrictEqual([app.Me.MF[0].value, app.Wife.IND_STOCK[0].value, app.Wife.IND_STOCK[0].symbol, app.Me.US_STOCK[0].value], [70, 33, "ABC", 900], "units × NAV; shares × price; US × price × USD rate");
  assert.strictEqual(HC.appHoldings({ usstocks: [{ symbol: "T", quantity: 1, currentPrice: 5 }] }).Me.US_STOCK[0].value, 5, "no USD rate: dollars as they are");
  // A US share matched by ticker even when INDmoney names it differently
  const r = HC.compare({ usstocks: [{ symbol: "T", company: "AT&T Inc", quantity: 3.8444291 }] }, { members: { Me: { US_STOCK: { total: 8569.06, rows: [{ name: "AT&T", symbol: "T", units: 3.8444291, value: 8569.06 }] } } } }, { today: "2026-10-20" });
  assert.deepStrictEqual([r.status, r.matched], ["ok", 1], "matched by ticker");
  const off = HC.compare({ usstocks: [{ symbol: "XYZ", company: "Totally Different", quantity: 1 }] }, { members: { Me: { US_STOCK: { total: 10, rows: [{ name: "Other Co", symbol: "OTH", units: 1, value: 10 }] } } } }, { today: "2026-10-20" });
  assert.deepStrictEqual(off.gaps.map((g) => g.kind).sort(), ["missing-in-app", "not-in-reference"], "different names and tickers are not matched just because the units agree");
  const g = HC.compare({ mutualFunds: [{ owner: "Me", fundName: "Fund A", units: 12, latestNav: 1 }] }, { members: { Me: { MF: { total: 100, rows: [{ name: "Fund A", units: 10, value: 100 }] } } } }, { today: "2026-10-20" });
  assert.deepStrictEqual([g.gaps[0].app, g.gaps[0].ref, g.gaps[0].diffValue], [12, 10, 20], "2 extra units at INDmoney's ₹10 a unit = ₹20");
  assert.strictEqual(HC.compare({}, { members: { Me: { MF: { total: 1000, rows: [{ name: "X", units: 1, value: 994 }] } } } }, { today: "2026-10-20" }).status, "bad-reference", "rows ₹6 short of the total: rejected (the tolerance is ₹5)");
  assert.notStrictEqual(HC.compare({}, { members: { Me: { MF: { total: 1000, rows: [{ name: "X", units: 1, value: 995 }] } } } }, { today: "2026-10-20" }).status, "bad-reference", "₹5 short: within tolerance");
  assert.strictEqual(HC.similarity("", "Fund"), 0, "an empty name matches nothing");
}
console.log("money edge tests passed");
