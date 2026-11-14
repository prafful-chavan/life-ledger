// 12-month outgo calendar: dates, rolling forward, month totals, overdue, missing amounts, sources.
const assert = require("assert");
const O = require("../outgo-calendar-core.js");
const TODAY = "2026-11-14";
const item = (o) => ({ id: "x", name: "X", kind: "Other", owner: "Me", amount: 1000, frequency: "Monthly", nextDate: "2026-12-01", ...o });
const dates = (o, from = TODAY, to = "2027-10-31") => O.dates(item(o), from, to);

// ── rolling a date forward: the anchor's day is kept; short months clamp ──
assert.strictEqual(O.addMonthsAnchored("2026-01-31", 1), "2026-02-28");
assert.strictEqual(O.addMonthsAnchored("2026-01-31", 2), "2026-03-31", "back to 31 after a short month");
assert.strictEqual(O.addMonthsAnchored("2028-01-31", 1), "2028-02-29", "leap year");
assert.strictEqual(O.addMonthsAnchored("2026-11-28", 6), "2027-05-28");
assert.strictEqual(O.addMonthsAnchored("2026-11-30", 3), "2027-02-28");
assert.strictEqual(O.addMonthsAnchored("2026-12-15", 1), "2027-01-15", "year change");
assert.strictEqual(O.addMonthsAnchored("2026-12-15", 13), "2028-01-15");
assert.strictEqual(O.addMonthsAnchored("2026-06-15", 0), "2026-06-15");

// ── dates of one item ──
assert.deepStrictEqual(dates({ frequency: "Monthly", nextDate: "2026-12-01" }, TODAY, "2027-03-31").list, ["2026-12-01", "2027-01-01", "2027-02-01", "2027-03-01"]);
assert.deepStrictEqual(dates({ frequency: "Quarterly", nextDate: "2026-12-10" }, TODAY, "2027-12-31").list, ["2026-12-10", "2027-03-10", "2027-06-10", "2027-09-10", "2027-12-10"]);
assert.deepStrictEqual(dates({ frequency: "Half-yearly", nextDate: "2026-11-28" }).list, ["2026-11-28", "2027-05-28"]);
assert.deepStrictEqual(dates({ frequency: "Yearly", nextDate: "2027-04-01" }).list, ["2027-04-01"]);
assert.deepStrictEqual(dates({ frequency: "Once", nextDate: "2027-02-14" }).list, ["2027-02-14"]);
// the window is inclusive at both ends
assert.deepStrictEqual(dates({ frequency: "Once", nextDate: TODAY }).list, [TODAY], "due today is still to come");
assert.deepStrictEqual(dates({ frequency: "Once", nextDate: "2027-10-31" }).list, ["2027-10-31"]);
assert.deepStrictEqual(dates({ frequency: "Once", nextDate: "2027-11-01" }).list, []);
assert.deepStrictEqual(dates({ frequency: "Once", nextDate: "2026-11-13" }), { list: [], overdue: "2026-11-13" }, "a one-off in the past is overdue");
// a recurring item recorded in the past: reported once as overdue, then rolled forward
{ const r = dates({ frequency: "Monthly", nextDate: "2026-10-20" }, TODAY, "2027-01-31"); assert.strictEqual(r.overdue, "2026-10-20"); assert.deepStrictEqual(r.list, ["2026-11-20", "2026-12-20", "2027-01-20"]); }
{ const r = dates({ frequency: "Monthly", nextDate: "2026-09-20" }, TODAY, "2026-12-31"); assert.strictEqual(r.overdue, "2026-09-20"); assert.deepStrictEqual(r.list, ["2026-11-20", "2026-12-20"], "only the first recorded date counts as overdue"); }
assert.strictEqual(dates({ frequency: "Monthly", nextDate: "2026-11-14" }).overdue, null, "due today is not overdue");
// an end date stops it
assert.deepStrictEqual(dates({ frequency: "Monthly", nextDate: "2026-12-01", endDate: "2027-02-01" }).list, ["2026-12-01", "2027-01-01", "2027-02-01"], "the end date itself is included");
assert.deepStrictEqual(dates({ frequency: "Monthly", nextDate: "2026-12-01", endDate: "2027-01-31" }).list, ["2026-12-01", "2027-01-01"]);
assert.strictEqual(dates({ frequency: "Monthly", nextDate: "2026-10-01", endDate: "2026-10-31" }).overdue, "2026-10-01");
assert.strictEqual(dates({ frequency: "Monthly", nextDate: "2026-10-01", endDate: "2026-09-01" }).overdue, null, "ended before it was due: nothing owed");
// an unknown frequency is treated as a single date; a bad date gives nothing
assert.deepStrictEqual(dates({ frequency: "Weekly", nextDate: "2026-12-05" }).list, ["2026-12-05"]);
assert.deepStrictEqual(dates({ nextDate: "2026-02-30" }), { list: [], overdue: null }); assert.deepStrictEqual(dates({ nextDate: "" }), { list: [], overdue: null });
// a fixed day of the month survives short months
{ const l = dates({ frequency: "Monthly", nextDate: "2026-11-30", dayOfMonth: 31 }, TODAY, "2027-03-31").list; assert.deepStrictEqual(l, ["2026-11-30", "2026-12-31", "2027-01-31", "2027-02-28", "2027-03-31"]); }
assert.deepStrictEqual(dates({ frequency: "Monthly", nextDate: "2026-12-05", dayOfMonth: 0 }, TODAY, "2027-01-31").list, ["2026-12-05", "2027-01-05"], "an invalid day is ignored");

// ── the calendar ──
const HOUSEHOLD = [
  item({ id: "car", name: "Car insurance", kind: "Insurance", amount: 12190, frequency: "Yearly", nextDate: "2027-04-01" }),
  item({ id: "health", name: "Health", kind: "Insurance", amount: 0, frequency: "Yearly", nextDate: "2027-04-01" }),
  item({ id: "lic", name: "LIC", kind: "Insurance", amount: 13250, frequency: "Half-yearly", nextDate: "2026-11-28" }),
  item({ id: "rent", name: "Rent", kind: "Rent", amount: 18000, frequency: "Monthly", nextDate: "2026-12-01" }),
  item({ id: "ppf", name: "PPF", kind: "Investment", amount: 5000, frequency: "Monthly", nextDate: "2026-11-20" }),
];
{
  const c = O.build(HOUSEHOLD, TODAY);
  assert.strictEqual(c.months.length, 12); assert.strictEqual(c.months[0].key, "2026-11"); assert.strictEqual(c.months[11].key, "2027-10");
  assert.deepStrictEqual([c.from, c.to], [TODAY, "2027-10-31"]);
  const tot = Object.fromEntries(c.months.map((m) => [m.key, m.total]));
  assert.strictEqual(tot["2026-11"], 13250 + 5000, "only what is still to come this month: LIC on the 28th, PPF on the 20th; rent starts in December");
  assert.strictEqual(tot["2026-12"], 18000 + 5000); assert.strictEqual(tot["2027-04"], 18000 + 5000 + 12190); assert.strictEqual(tot["2027-05"], 18000 + 5000 + 13250);
  assert.strictEqual(tot["2027-10"], 23000);
  // totals add up, cumulative runs, average is over the 12 months
  assert.strictEqual(c.total, c.months.reduce((t, m) => t + m.total, 0)); assert.strictEqual(c.months[11].cumulative, c.total); assert.strictEqual(c.months[0].cumulative, 18250); assert.strictEqual(c.months[1].cumulative, 18250 + 23000);
  assert.strictEqual(c.perMonthAverage, Math.round((c.total / 12) * 100) / 100);
  assert.deepStrictEqual(c.heaviest.map((m) => m.key), ["2027-05", "2027-04", "2026-12"], "the three heaviest months, biggest first; ties by the earlier month");
  assert.strictEqual(c.heaviest[0].total, 36250);
  // a premium with no amount is listed, not counted, and still appears in its month
  assert.deepStrictEqual(c.missing.map((x) => x.id), ["health"]); assert.strictEqual(c.missing[0].next, "2027-04-01");
  const april = c.months.find((m) => m.key === "2027-04"); assert.ok(april.items.some((i) => i.name === "Health" && i.amount === null));
  // items inside a month are in date order
  assert.deepStrictEqual(c.months[0].items.map((i) => i.date), ["2026-11-20", "2026-11-28"]);
  assert.deepStrictEqual(april.items.map((i) => i.date), [...april.items.map((i) => i.date)].sort());
  assert.strictEqual(c.overdue.length, 0); assert.strictEqual(c.undated.length, 0);
}
// the window is by calendar month: the 12th month ends on the last day, and a different length works
{ const c3 = O.build(HOUSEHOLD, TODAY, { months: 3 }); assert.deepStrictEqual(c3.months.map((m) => m.key), ["2026-11", "2026-12", "2027-01"]); assert.strictEqual(c3.to, "2027-01-31"); assert.strictEqual(c3.perMonthAverage, Math.round((c3.total / 3) * 100) / 100);
  for (const bad of [0, -1, 1.5, 37, "x", null]) assert.strictEqual(O.build([], TODAY, { months: bad }).months.length, 12, String(bad));
  assert.strictEqual(O.build([], TODAY, { months: 36 }).months.length, 36); assert.strictEqual(O.build([], TODAY, { months: 1 }).months.length, 1);
  assert.strictEqual(O.build(HOUSEHOLD, "2026-12-31").months[0].items.length, 0, "on the last day only what is due that day is left"); }
// overdue, undated, nothing
{
  const c = O.build([item({ id: "late", name: "Late", frequency: "Monthly", nextDate: "2026-10-20", amount: 700 }), item({ id: "nodate", name: "No date", nextDate: "" }), item({ id: "once", name: "Old one-off", frequency: "Once", nextDate: "2026-01-01", amount: 5 })], TODAY);
  assert.deepStrictEqual(c.overdue.map((o) => [o.id, o.date, o.amount]), [["once", "2026-01-01", 5], ["late", "2026-10-20", 700]], "oldest first");
  assert.strictEqual(c.months[0].total, 700, "the unpaid monthly item is still counted from its next date");
  assert.deepStrictEqual(c.undated.map((u) => u.id), ["nodate"]);
}
{ const e = O.build([], TODAY); assert.strictEqual(e.total, 0); assert.strictEqual(e.heaviest.length, 0); assert.strictEqual(e.months.length, 12); assert.deepStrictEqual(O.build(null, TODAY).months.length, 12); assert.strictEqual(O.build(HOUSEHOLD, "").months.length, 0); assert.strictEqual(O.build(HOUSEHOLD, "2026-02-30").from, null); }
assert.strictEqual(O.build([null, undefined], TODAY).total, 0);
// an item with no amount and nothing to show is not "missing"
assert.strictEqual(O.build([item({ id: "z", amount: 0, frequency: "Once", nextDate: "2030-01-01" })], TODAY).missing.length, 0);
// float noise: 0.1 + 0.2
assert.strictEqual(O.build([item({ id: "a", amount: 0.1, frequency: "Once", nextDate: "2026-12-01" }), item({ id: "b", amount: 0.2, frequency: "Once", nextDate: "2026-12-02" })], TODAY).months[1].total, 0.3);

// ── from what the app holds ──
{
  const ins = O.fromInsurance([{ id: "1", type: "Car", policyName: "Altroz", insurer: "Digit", person: "Me", premium: 12190, frequency: "Yearly", nextDue: "2027-04-01" }, { id: "2", type: "Term life", premium: 0, nextDue: "" }, { id: "3", type: "Other", insurer: "LIC", premium: 13250, frequency: "Half-yearly", nextDue: "2026-11-28T00:00:00Z", person: "Both" }, null]);
  assert.strictEqual(ins.length, 2, "no due date, not in the calendar"); assert.strictEqual(ins[0].name, "Car · Altroz"); assert.strictEqual(ins[0].amount, 12190); assert.strictEqual(ins[0].frequency, "Yearly"); assert.strictEqual(ins[1].nextDate, "2026-11-28");
  assert.strictEqual(O.fromInsurance([{ id: "q", type: "Health", premium: 1, frequency: "Weekly", nextDue: "2027-01-01" }])[0].frequency, "Yearly", "an unknown frequency falls back to yearly");
  assert.strictEqual(O.fromInsurance([{ id: "q", premium: 1, nextDue: "2027-01-01" }])[0].name, "Insurance");
  assert.strictEqual(O.fromInsurance([{ id: "q", type: "Health", insurer: "New India", premium: 1, nextDue: "2027-01-01" }])[0].name, "Health · New India");
  assert.deepStrictEqual(O.fromInsurance(null), []);
  assert.strictEqual(O.build(ins, TODAY).months[0].total, 13250);
}
{
  const loans = O.fromLiabilities([{ id: "l", name: "Car loan", emi: 18250, emiDay: 5, owner: "Me" }, { id: "closed", name: "Closed", emi: 0, emiDay: 4 }, { id: "noday", name: "No day", emi: 5, emiDay: 0 }, { id: "bad", emi: 5, emiDay: 32 }, null], TODAY);
  assert.strictEqual(loans.length, 1); assert.strictEqual(loans[0].nextDate, "2026-12-05", "the 5th has passed this month, so next month"); assert.strictEqual(loans[0].dayOfMonth, 5);
  assert.strictEqual(O.fromLiabilities([{ id: "l", emi: 1, emiDay: 14 }], TODAY)[0].nextDate, "2026-11-14", "due today counts");
  assert.strictEqual(O.fromLiabilities([{ id: "l", emi: 1, emiDay: 15 }], TODAY)[0].nextDate, "2026-11-15");
  assert.strictEqual(O.fromLiabilities([{ id: "l", emi: 1, emiDay: 31 }], TODAY)[0].nextDate, "2026-11-30", "a short month clamps");
  assert.strictEqual(O.fromLiabilities([{ id: "l", emi: 1, emiDay: 5 }], "2026-12-14")[0].nextDate, "2027-01-05", "year change");
  assert.strictEqual(O.fromLiabilities([{ id: "l", emi: 1, emiDay: 3 }], "2026-12-31")[0].nextDate, "2027-01-03");
  assert.strictEqual(O.fromLiabilities([{ id: "l", emi: 1, emiDay: 31 }], "2027-01-31")[0].nextDate, "2027-01-31"); assert.strictEqual(O.fromLiabilities([{ id: "l", emi: 1, emiDay: 30 }], "2027-01-31")[0].nextDate, "2027-02-28");
  assert.strictEqual(O.fromLiabilities([{ id: "l", emi: 1, emiDay: 1 }], "bad").length, 0); assert.deepStrictEqual(O.fromLiabilities(null, TODAY), []);
  assert.strictEqual(O.fromLiabilities([{ id: "l", emi: 1, emiDay: 5 }], TODAY)[0].name, "Loan EMI");
  const cal = O.build(loans, TODAY); assert.deepStrictEqual(cal.months.map((m) => m.total), [0, ...Array(11).fill(18250)]);
}
{
  const o = O.fromOutgoings([{ id: "r", name: "Rent", amount: 18000, frequency: "Monthly", nextDate: "2026-12-01", kind: "Rent", owner: "Me" }, { id: "w", name: "", amount: 5, frequency: "Fortnightly", nextDate: "2026-12-01" }, null]);
  assert.strictEqual(o.length, 2); assert.strictEqual(o[0].kind, "Rent"); assert.strictEqual(o[1].frequency, "Monthly", "unknown frequency becomes monthly"); assert.strictEqual(o[1].name, "Outgoing"); assert.strictEqual(o[1].kind, "Other"); assert.strictEqual(o[1].owner, "Both");
}
// ── checking a typed-in outgoing ──
{
  const ok = { name: "Rent", amount: 18000, frequency: "Monthly", nextDate: "2026-12-01" };
  assert.deepStrictEqual(O.validateOutgoing(ok), []);
  assert.ok(O.validateOutgoing({ ...ok, name: "  " }).length); assert.ok(O.validateOutgoing({ ...ok, amount: 0 }).length); assert.ok(O.validateOutgoing({ ...ok, amount: -5 }).length); assert.ok(O.validateOutgoing({ ...ok, amount: "x" }).length);
  assert.ok(O.validateOutgoing({ ...ok, frequency: "Weekly" }).length); assert.ok(O.validateOutgoing({ ...ok, nextDate: "2026-02-30" }).length); assert.ok(O.validateOutgoing({ ...ok, nextDate: "" }).length);
  assert.ok(O.validateOutgoing({ ...ok, endDate: "x" }).length); assert.ok(O.validateOutgoing({ ...ok, endDate: "2026-11-30" }).length, "ends before it starts");
  assert.deepStrictEqual(O.validateOutgoing({ ...ok, endDate: "2026-12-01" }), [], "ending on the first date is fine"); assert.deepStrictEqual(O.validateOutgoing({ ...ok, endDate: "" }), []);
  assert.ok(O.validateOutgoing(null).length >= 4);
  assert.deepStrictEqual(O.validateOutgoing({ ...ok, amount: 0.5 }), [], "any positive amount");
}
assert.strictEqual(O.monthLabel("2027-04"), "Apr 2027"); assert.strictEqual(O.monthLabel("2026-12"), "Dec 2026");
// ── blind spots closed after the mutation run ──
// a one-off: the end date is inclusive; due today is not overdue
assert.deepStrictEqual(dates({ frequency: "Once", nextDate: "2026-12-01", endDate: "2026-12-01" }).list, ["2026-12-01"]);
assert.strictEqual(dates({ frequency: "Once", nextDate: "2026-11-01", endDate: "2026-11-01" }).overdue, "2026-11-01", "a one-off on its own end date, in the past, is overdue");
assert.strictEqual(dates({ frequency: "Once", nextDate: TODAY }).overdue, null);
assert.strictEqual(dates({ frequency: "Once", nextDate: "2026-11-13", endDate: "2026-11-12" }).overdue, null);
// the fixed day of the month: 1 is allowed, 0 and 32 are not, February in a leap and a normal year
assert.deepStrictEqual(dates({ frequency: "Monthly", nextDate: "2026-12-15", dayOfMonth: 1 }, TODAY, "2027-01-31").list, ["2026-12-01", "2027-01-01"].filter((d) => d >= TODAY) , "day 1 is honoured");
assert.deepStrictEqual(dates({ frequency: "Monthly", nextDate: "2026-12-15", dayOfMonth: 32 }, TODAY, "2027-01-31").list, ["2026-12-15", "2027-01-15"], "32 is ignored");
assert.deepStrictEqual(dates({ frequency: "Monthly", nextDate: "2027-12-31", dayOfMonth: 31 }, "2027-12-01", "2028-03-31").list, ["2027-12-31", "2028-01-31", "2028-02-29", "2028-03-31"], "leap-year February");
assert.deepStrictEqual(dates({ frequency: "Monthly", nextDate: "2026-12-31", dayOfMonth: 31 }, "2026-12-01", "2027-03-31").list, ["2026-12-31", "2027-01-31", "2027-02-28", "2027-03-31"]);
assert.deepStrictEqual(dates({ frequency: "Monthly", nextDate: "2026-12-30", dayOfMonth: 30 }, "2026-12-01", "2027-03-31").list, ["2026-12-30", "2027-01-30", "2027-02-28", "2027-03-30"]);
// where the window ends, in a normal and a leap year, and in December
assert.strictEqual(O.build([], "2027-03-10").to, "2028-02-29"); assert.strictEqual(O.build([], "2026-03-10").to, "2027-02-28"); assert.strictEqual(O.build([], "2026-01-05").to, "2026-12-31"); assert.strictEqual(O.build([], "2026-11-14", { months: 2 }).to, "2026-12-31"); assert.strictEqual(O.build([], "2026-07-14", { months: 1 }).to, "2026-07-31"); assert.strictEqual(O.build([], "2026-04-14", { months: 1 }).to, "2026-04-30");
// a bad date gives exactly the empty calendar
assert.deepStrictEqual(O.build(HOUSEHOLD, "nope"), { months: [], total: 0, perMonthAverage: 0, heaviest: [], overdue: [], missing: [], undated: [], from: null, to: null });
// items on the same day are in name order whatever the input order; the heaviest tie goes to the earlier month; a ₹1 month still counts
{ const c = O.build([item({ id: "b", name: "B", frequency: "Once", nextDate: "2026-12-05" }), item({ id: "a", name: "A", frequency: "Once", nextDate: "2026-12-05" })], TODAY); assert.deepStrictEqual(c.months[1].items.map((i) => i.name), ["A", "B"]); }
{ const c = O.build([item({ id: "a", amount: 500, frequency: "Once", nextDate: "2027-02-05" }), item({ id: "b", amount: 500, frequency: "Once", nextDate: "2026-12-05" }), item({ id: "c", amount: 1, frequency: "Once", nextDate: "2027-05-05" })], TODAY); assert.deepStrictEqual(c.heaviest.map((m) => m.key), ["2026-12", "2027-02", "2027-05"]); }
// ids carry where they came from, so two sources never collide
assert.strictEqual(O.fromInsurance([{ id: "7", premium: 1, nextDue: "2027-01-01" }])[0].id, "ins:7"); assert.strictEqual(O.fromLiabilities([{ id: "7", emi: 1, emiDay: 3 }], TODAY)[0].id, "loan:7"); assert.strictEqual(O.fromOutgoings([{ id: "7", nextDate: "2027-01-01" }])[0].id, "out:7");
assert.ok(O.fromInsurance([{ id: "7", premium: 1, nextDue: "2027-01-01" }])[0].source === "insurance" && O.fromLiabilities([{ id: "7", emi: 1, emiDay: 3 }], TODAY)[0].source === "liabilities" && O.fromOutgoings([{ id: "7" }])[0].source === "outgoings");
// an EMI day of 1 is a real day; 31 is the last
assert.strictEqual(O.fromLiabilities([{ id: "l", emi: 1, emiDay: 1 }], "2026-11-01")[0].nextDate, "2026-11-01"); assert.strictEqual(O.fromLiabilities([{ id: "l", emi: 1, emiDay: 31 }], "2026-12-01")[0].nextDate, "2026-12-31"); assert.strictEqual(O.fromLiabilities([{ id: "l", emi: 1, emiDay: 32 }], TODAY).length, 0);
console.log("outgo-calendar-core: ok");
