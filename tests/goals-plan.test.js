const assert = require("assert");
const app = require("../app.js");
const N = app.goalNeedPerMonth;

// Your real goals (as of 17 Oct 2026)
const home = N({ target: 20000000, saved: 2000000, dueDate: "2028-05-26" }, "2026-10-17");
assert.strictEqual(home.remaining, 18000000);
assert.strictEqual(home.months, 20);                 // 19.3 months left → counted as 20
assert.strictEqual(home.perMonth, 900000);
const mf = N({ target: 10000000, saved: 2000000, dueDate: "2027-10-22" }, "2026-10-17");
assert.strictEqual(mf.remaining, 8000000);
assert.strictEqual(mf.months, 13);                   // 12.2 months left → 13
assert.strictEqual(mf.perMonth, Math.ceil(8000000 / 13));

// Done goals ask for nothing
assert.deepStrictEqual(N({ target: 100, saved: 100, dueDate: "2027-01-01" }, "2026-10-17"), { remaining: 0, months: 0, perMonth: 0, done: true });
assert.strictEqual(N({ target: 100, saved: 250, dueDate: "2027-01-01" }, "2026-10-17").done, true, "over-saved counts as done");

// No due date: remaining is known, a monthly figure is not
const open = N({ target: 500000, saved: 100000 }, "2026-10-17");
assert.strictEqual(open.remaining, 400000);
assert.strictEqual(open.perMonth, null);
assert.strictEqual(N({ target: 500000, saved: 100000, dueDate: "garbage" }, "2026-10-17").perMonth, null);

// Overdue: the whole remainder is due now
const late = N({ target: 100000, saved: 20000, dueDate: "2026-09-01" }, "2026-10-17");
assert.strictEqual(late.overdue, true);
assert.strictEqual(late.perMonth, 80000);

// Under a month left still counts as one month, never divides by zero
const soon = N({ target: 10000, saved: 0, dueDate: "2026-10-30" }, "2026-10-17");
assert.strictEqual(soon.months, 1);
assert.strictEqual(soon.perMonth, 10000);

// Bad input never throws
assert.strictEqual(N(null, "2026-10-17").done, true);
assert.strictEqual(N({}, "2026-10-17").done, true);
assert.strictEqual(N({ target: "abc", saved: "x" }, "2026-10-17").done, true);
console.log("goals-plan tests passed");
