// Date and boundary cases across the money engines: financial-year ends, month ends, leap days, weekends,
// due-today, and the salary that pays next month's spending. Expected values come from the rule, not from the code.
const assert = require("assert");
const T = require("../tax-core.js"), NC = require("../networth-close.js"), P = require("../protection-core.js"), A = require("../mcp/analysis.js");

// ── Financial year: 1 April to 31 March ──
assert.strictEqual(T.engine.fyOf("2026-03-31"), "2025-26", "31 March is the last day of the year");
assert.strictEqual(T.engine.fyOf("2026-04-01"), "2026-27", "1 April starts the next");
assert.strictEqual(T.engine.ayOf("2025-26"), "2026-27", "assessment year follows");
assert.strictEqual(T.gains.fyOf("2027-01-15"), "2026-27", "January belongs to the year that started the April before");

// ── Holding periods around leap days and month ends (sec 2(42A): more than 12/24 months) ──
const longOn = (bought, sold, cat = "equity") => T.gains.holding({ date: bought, cat }, sold).long;
assert.strictEqual(longOn("2024-02-29", "2025-02-28"), false, "29 Feb 2024 to 28 Feb 2025 is exactly 12 months");
assert.strictEqual(longOn("2024-02-29", "2025-03-01"), true, "the next day is more than 12 months");
assert.strictEqual(longOn("2025-01-31", "2026-01-31"), false, "month-end purchase, same date a year on: 12 months exactly");
assert.strictEqual(longOn("2025-01-31", "2026-02-01"), true);
assert.strictEqual(longOn("2024-02-29", "2026-02-28", "foreignShares"), false, "24 months to the clamped anniversary");
assert.strictEqual(longOn("2024-02-29", "2026-03-01", "foreignShares"), true);
assert.strictEqual(longOn("2023-03-31", "2026-10-20", "debt"), true, "a debt fund bought on 31 Mar 2023 is before sec 50AA");
assert.strictEqual(longOn("2023-04-01", "2026-10-20", "debt"), false, "one bought on 1 Apr 2023 is always short-term");

// ── Updated-return (ITR-U) tiers step at 12/24/36/48 months after the assessment year ends (AY 2025-26 ends 31 Mar 2026) ──
assert.strictEqual(T.remedies.itrUTier("2025-26", "2027-03-31").pct, 25, "the last day of the first 12 months");
assert.strictEqual(T.remedies.itrUTier("2025-26", "2027-04-01").pct, 50, "the next day: 50%");
assert.strictEqual(T.remedies.itrUTier("2025-26", "2030-03-31").pct, 70, "the last day of 48 months");
assert.strictEqual(T.remedies.itrUTier("2025-26", "2030-04-01"), null, "after 48 months the window is closed");

// ── Market days ──
assert.strictEqual(NC.isBusinessDay("2026-10-17"), false, "Saturday");
assert.strictEqual(NC.isBusinessDay("2026-10-18"), false, "Sunday");
assert.strictEqual(NC.isBusinessDay("2026-10-19"), true, "Monday");
assert.strictEqual(NC.prevBusinessDay("2026-10-19"), "2026-10-16", "Monday's previous session is Friday");
assert.strictEqual(NC.dayAfter("2026-12-31"), "2027-01-01", "across the year end");
assert.strictEqual(NC.dayAfter("2028-02-28"), "2028-02-29", "a leap day");

// ── Birthdays, ages and due dates ──
assert.strictEqual(P.ageOn("1995-10-22", "2026-10-21"), 30, "the day before the birthday");
assert.strictEqual(P.ageOn("1995-10-22", "2026-10-22"), 31, "on the birthday");
assert.deepStrictEqual(P.nextBirthday("1995-10-22", "2026-10-22"), { date: "2026-10-22", days: 0, turning: 31 }, "today is the birthday");
assert.strictEqual(P.nextBirthday("1995-10-22", "2026-12-31").date, "2027-10-22", "after this year's birthday: next year's");
assert.deepStrictEqual(P.dueStatus("2026-10-20", "2026-10-20"), { state: "soon", days: 0 }, "due today is not overdue");
assert.strictEqual(P.dueStatus("2026-10-19", "2026-10-20").state, "overdue", "due yesterday is overdue");
assert.strictEqual(P.dueStatus("", "2026-10-20").state, "none", "no date, nothing due");

// ── Salary at a month end pays the next month's spending, including across the year end ──
const s = { income: [
  { date: "2026-12-31", amount: 200000, person: "Me", type: "Salary" },
  { date: "2026-12-30", amount: 57000, person: "Wife", type: "Salary" },
  { date: "2026-12-15", amount: 999, person: "Me", type: "Interest" },
  { date: "2027-01-01", amount: 5, person: "Me", type: "Salary" },
] };
const jan = A.salaryForSpendingMonth(s, "2027-01");
assert.deepStrictEqual([jan.creditedIn, jan.net], ["2026-12", 257000], "January's spending is paid by December's salaries (not interest, not January's)");
assert.strictEqual(A.salaryForSpendingMonth(s, "2026-12").net, 0, "nothing was credited in November");
{
  const two = { income: [{ date: "2024-06-01", amount: 169946, person: "Me", type: "Salary" }, { date: "2024-06-01", amount: 553107, person: "Me", type: "Salary" }, { date: "2024-06-30", amount: 55000, person: "Wife", type: "Salary" }] };
  const r = A.salaryForSpendingMonth(two, "2024-07");
  assert.deepStrictEqual([r.net, r.people.sort().join()], [169946 + 553107 + 55000, "Me,Wife"], "two payslips of one person in a month (a former employer's payment) are both credited");
}

// ── The tax year's salary months (the salary sheet dates a month's pay on the 1st, so the date's month is the pay month) ──
assert.strictEqual(T.household.salaryFy("2026-04-01"), "2026-27", "April's pay, dated 1 April, is in FY 2026-27");
assert.strictEqual(T.household.salaryFy("2026-03-31"), "2025-26", "March's pay is in FY 2025-26");
console.log("date and boundary tests passed");
