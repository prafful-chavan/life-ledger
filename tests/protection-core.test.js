const assert = require("assert");
const P = require("../protection-core.js");

// Ages and birthdays (Prafful 22 Oct 1995, Archana 22 May 1997; "today" = 18 Oct 2026)
assert.strictEqual(P.ageOn("1995-10-22", "2026-10-18"), 30, "turns 31 in four days");
assert.strictEqual(P.ageOn("1995-10-22", "2026-10-22"), 31, "on the birthday itself");
assert.strictEqual(P.ageOn("1997-05-22", "2026-10-18"), 29);
assert.deepStrictEqual(P.nextBirthday("1995-10-22", "2026-10-18"), { date: "2026-10-22", days: 4, turning: 31 });
assert.deepStrictEqual(P.nextBirthday("1997-05-22", "2026-10-18"), { date: "2027-05-22", days: 216, turning: 30 });
assert.strictEqual(P.nextBirthday("1995-10-22", "2026-10-22").days, 0, "today counts");
assert.strictEqual(P.ageOn("garbage", "2026-10-18"), null);
assert.strictEqual(P.nextBirthday("", "2026-10-18"), null);

// Premiums and renewals
assert.strictEqual(P.annualPremium({ premium: 1000, frequency: "Monthly" }), 12000);
assert.strictEqual(P.annualPremium({ premium: 5000, frequency: "Half-yearly" }), 10000);
assert.strictEqual(P.annualPremium({ premium: 24000, frequency: "Yearly" }), 24000);
assert.strictEqual(P.annualPremium({ premium: 24000 }), 24000, "no frequency means yearly");
assert.strictEqual(P.dueStatus("2026-10-10", "2026-10-18").state, "overdue");
assert.deepStrictEqual(P.dueStatus("2026-11-02", "2026-10-18"), { state: "soon", days: 15 });
assert.strictEqual(P.dueStatus("2027-03-01", "2026-10-18").state, "ok");
assert.strictEqual(P.dueStatus("", "2026-10-18").state, "none");
assert.strictEqual(P.advanceDue("2026-10-18", "Yearly"), "2027-10-18");
assert.strictEqual(P.advanceDue("2026-11-30", "Quarterly"), "2027-02-28", "month-end is kept inside the month");
assert.strictEqual(P.advanceDue("2026-12-15", "Monthly"), "2027-01-15");
assert.strictEqual(P.advanceDue("2026-08-31", "Half-yearly"), "2027-02-28");

// Cover checks
const state = () => ({
  income: [{ person: "Me", date: "2026-09-30", netSalary: 199884 }, { person: "Me", date: "2026-08-31", netSalary: 199884 }, { person: "Me", date: "2026-07-31", netSalary: 278484 }, { person: "Wife", date: "2026-09-30", amount: 56986 }],
  insurance: [], vehicles: [], goals: [], expenses: [], people: { me: { dob: "1995-10-22" }, wife: { dob: "1997-05-22" } }, banksaving: [{ value: 450000 }], fd: [{ value: 2000000 }],
});
let s = state();
assert.strictEqual(P.monthlyIncome(s, "Me"), 199884, "the middle of the last three months: the July bonus month does not lift it");
assert.strictEqual(P.monthlyIncome(s, "Wife"), 56986, "one month of pay: that month");
// a bonus month that is the LATEST must not become the monthly income either
{
  const inc = (rows) => ({ income: rows });
  const sal = (person, date, net, extra = {}) => ({ person, date, netSalary: net, type: "Salary", ...extra });
  assert.strictEqual(P.monthlyIncome(inc([sal("Me", "2026-08-31", 200), sal("Me", "2026-09-30", 200), sal("Me", "2026-10-31", 275)]), "Me"), 200, "bonus month latest: still the steady pay");
  assert.strictEqual(P.monthlyIncome(inc([sal("Me", "2026-09-30", 200), sal("Me", "2026-10-31", 275)]), "Me"), 200, "two months: the lower");
  assert.strictEqual(P.monthlyIncome(inc([sal("Me", "2026-09-30", 275)]), "Me"), 275, "one month: that month");
  assert.strictEqual(P.monthlyIncome(inc([sal("Me", "2026-06-30", 100), sal("Me", "2026-07-31", 200), sal("Me", "2026-08-31", 200), sal("Me", "2026-09-30", 300)]), "Me"), 200, "only the last three months count (100 is too old)");
  assert.strictEqual(P.monthlyIncome(inc([sal("Me", "2026-08-31", 300), sal("Me", "2026-09-30", 100), sal("Me", "2026-10-31", 200)]), "Me"), 200, "the middle value, whatever order the months come in");
  assert.strictEqual(P.monthlyIncome(inc([sal("Me", "2026-06-30", 400), sal("Me", "2026-07-31", 100), sal("Me", "2026-08-31", 100), sal("Me", "2026-09-30", 300)]), "Me"), 100, "a fourth, older month does not count");
  assert.strictEqual(P.monthlyIncome(inc([sal("Me", "2026-01-31", 100)]), "Me"), 100, "January is a month");
  assert.strictEqual(P.monthlyIncome(inc([sal("Me", "2026-13-01", 999), sal("Me", "2026-00-01", 999)]), "Me"), 0, "there is no month 13 or month 0");
  assert.strictEqual(P.monthlyIncome(inc([sal("Me", "2026-09-30", 200), sal("Me", "2026-09-30", 50), sal("Me", "2026-08-31", 250), sal("Me", "2026-07-31", 250)]), "Me"), 250, "two payslips in one month are added (job change month)");
  assert.strictEqual(P.monthlyIncome(inc([sal("Me", "2026-09-30", 200, { type: "Interest" }), sal("Me", "2026-08-31", 100)]), "Me"), 100, "interest is not salary");
  assert.strictEqual(P.monthlyIncome(inc([{ person: "Me", date: "2026-09-30", amount: 120 }, sal("Me", "2026-08-31", 100), sal("Me", "2026-07-31", 100)]), "Me"), 100, "a row with no type is salary; the amount stands in for net salary");
  assert.strictEqual(P.monthlyIncome(inc([sal("Me", "garbage", 999), sal("Me", "", 999)]), "Me"), 0, "rows without a usable date are ignored");
  assert.strictEqual(P.monthlyIncome(inc([sal("Wife", "2026-09-30", 50)]), "Me"), 0, "nobody else's pay"); assert.strictEqual(P.monthlyIncome({}, "Me"), 0);
}
assert.strictEqual(P.termCheck(s, "Me").status, "not-set", "nothing entered yet (₹0 placeholders)");
s.insurance = [{ type: "Term life", person: "Me", cover: 0 }];
assert.strictEqual(P.termCheck(s, "Me").status, "not-set", "a ₹0 placeholder is not a policy");
s.insurance = [{ type: "Term life", person: "Me", cover: 10000000 }];
const t = P.termCheck(s, "Me");
assert.strictEqual(t.status, "low");
assert.strictEqual(t.min, 199884 * 12 * 10);
s.insurance[0].cover = 40000000;
assert.strictEqual(P.termCheck(s, "Me").status, "ok");
assert.strictEqual(P.healthCheck(state()).status, "not-set");
s.insurance.push({ type: "Health", person: "Both", cover: 500000 });
assert.strictEqual(P.healthCheck(s).status, "low");
s.insurance.push({ type: "Health", person: "Both", cover: 1000000 });
assert.strictEqual(P.healthCheck(s).status, "ok");
// Employer group cover counts apart: meeting the guide only through it is its own status
let e = state();
e.insurance = [{ type: "Health", person: "Both", cover: 1200000, employer: "Yes" }];
let hc = P.healthCheck(e);
assert.deepStrictEqual([hc.status, hc.cover, hc.ownCover, hc.employerCover], ["employer", 1200000, 0, 1200000], "₹12L only through the employer");
e.insurance.push({ type: "Health", person: "Both", cover: 500000, employer: "No" });
assert.strictEqual(P.healthCheck(e).status, "employer", "own ₹5L is still below the guide");
e.insurance.push({ type: "Health", person: "Both", cover: 500000 });
assert.strictEqual(P.healthCheck(e).status, "ok", "own ₹10L meets the guide (no employer field = own policy)");
e.insurance = [{ type: "Health", person: "Both", cover: 300000, employer: "Yes" }];
assert.strictEqual(P.healthCheck(e).status, "low", "below the guide even with the employer's cover");
e.insurance = [{ type: "Term life", person: "Me", cover: 199884 * 12 * 10, employer: "Yes" }];
assert.strictEqual(P.termCheck(e, "Me").status, "employer", "group term cover alone");
assert.ok(P.isEmployer({ employer: "Yes" }) && !P.isEmployer({}) && !P.isEmployer({ employer: "No" }));

// Summary
s = state(); s.vehicles = [{ value: 500000 }, { value: 0 }]; s.insurance = [{ type: "Health", person: "Both", cover: 1, premium: 25000, frequency: "Yearly", nextDue: "2026-10-25" }, { type: "Car", person: "Me", premium: 1000, frequency: "Monthly", nextDue: "2026-09-01" }];
const sum = P.summary(s, "2026-10-18");
assert.strictEqual(sum.vehiclesValue, 500000);
assert.strictEqual(sum.yearlyPremium, 37000);
assert.strictEqual(sum.dueSoon.length, 2);
assert.strictEqual(sum.dueSoon[0].s.state, "overdue", "overdue first");

// Goal suggestions: built from the household's own numbers; existing names are never duplicated
s = state();
assert.deepStrictEqual(P.suggestGoals(s, "2026-10-18"), [], "no spending history → nothing to base them on");
const months = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
s.expenses = months.map((m) => ({ date: m + "-10", amount: 120000 }));
const g = P.suggestGoals(s, "2026-10-18");
assert.deepStrictEqual(g.map((x) => x.key), ["emergency", "retirement"]);
assert.strictEqual(g[0].target, 720000, "6 × ₹1.2L");
assert.strictEqual(g[0].saved, 2450000, "bank + FD today");
assert.strictEqual(g[1].target, 36000000, "25 × ₹14.4L a year");
assert.strictEqual(g[1].dueDate, "2055-10-22", "when the first person turns 60");
assert.strictEqual(g[1].track, "All my assets");
s.goals = [{ name: "Emergency Fund" }];
assert.deepStrictEqual(P.suggestGoals(s, "2026-10-18").map((x) => x.key), ["retirement"], "already added");
console.log("protection-core tests passed");
