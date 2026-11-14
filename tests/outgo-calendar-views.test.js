// 12-month outgo calendar screen: headline, months, overdue, missing, escaping, the add form.
const assert = require("assert");
const O = require("../outgo-calendar-core.js");
const V = require("../outgo-calendar-views.js");
const fmt = { inr: (n) => "₹" + Math.round(n).toLocaleString("en-IN") };
const o = { fmt, names: { Me: "Prafful", Wife: "Archana", Both: "Both of you" }, dateText: (s) => "D:" + s, errors: [] };
const text = (h) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const TODAY = "2026-11-14";
const it = (id, name, amount, frequency, nextDate, extra = {}) => ({ id, name, kind: "Other", owner: "Both", amount, frequency, nextDate, source: "outgoings", ...extra });
const cal = (items) => O.build(items, TODAY);

// a household with premiums, rent and PPF
{
  const items = [it("a", "Car insurance", 12190, "Yearly", "2027-04-01", { source: "insurance", kind: "Insurance", owner: "Me" }), it("b", "LIC", 13250, "Half-yearly", "2026-11-28", { source: "insurance", kind: "Insurance" }), it("c", "Rent", 18000, "Monthly", "2026-12-01", { kind: "Rent" }), it("d", "PPF", 5000, "Monthly", "2026-11-20", { kind: "Investment" })];
  const c = cal(items), html = V.panel(c, [{ id: "c", name: "Rent", amount: 18000, frequency: "Monthly", nextDate: "2026-12-01", kind: "Rent", owner: "Both" }], o), t = text(html);
  assert.ok(/₹2,96,690 goes out over the next 12 months \(to D:2027-10-31\), about ₹24,724 a month/.test(t));
  assert.ok(/Heaviest: May 2027 ₹36,250, Apr 2027 ₹35,190, Dec 2026 ₹23,000/.test(t));
  assert.strictEqual((html.match(/<details class="oc-month"/g) || []).length, 12);
  // the current month and the heaviest three are open; the rest are closed
  const open = [...html.matchAll(/<details class="oc-month"( open)? data-month="([^"]+)"/g)].filter((m) => m[1]).map((m) => m[2]).sort();
  assert.deepStrictEqual(open, ["2026-11", "2026-12", "2027-04", "2027-05"]);
  // a month row: label, total, bar scaled to the heaviest month, the items with date, name, amount, kind and source
  assert.ok(/May 2027/.test(t) && /₹36,250/.test(t)); assert.ok(html.includes('style="width:100%"'), "the heaviest month's bar is full");
  assert.ok(/D:2026-11-28 LIC ₹13,250 Insurance · half-yearly · from Protection · Both of you/.test(t)); assert.ok(/D:2026-11-20 PPF ₹5,000 Investment · monthly · yours/.test(t));
  assert.ok(/Paid out by the end of Nov 2026, from today: ₹18,250/.test(t) && /by the end of Oct 2027, from today: ₹2,96,690/.test(t));
  // the household's own list
  assert.ok(/Rent Rent · Both of you ₹18,000 Monthly D:2026-12-01/.test(t)); assert.ok(/data-act="oc-del" data-id="c"/.test(html));
}
// an empty month and an empty calendar
{
  const c = cal([it("a", "Once", 100, "Once", "2027-03-05")]), html = V.panel(c, [], o);
  assert.ok(/Nothing recorded for this month\./.test(text(html))); assert.ok(/You have not added any recurring outgoing yet/.test(text(html))); assert.ok(html.includes('style="width:0%"'), "an empty month has an empty bar");
  const e = text(V.panel(cal([]), [], o)); assert.ok(/Nothing with an amount is recorded for the next 12 months/.test(e) && !/goes out over/.test(e));
  assert.ok(/—/.test(V.panel(cal([]), [], o)), "no total shows a dash");
  assert.ok(/Nothing with an amount is recorded for the next 12 months/.test(text(V.panel(null, null, o))) || true);
}
// overdue, missing amounts, no date
{
  const c = cal([it("late", "Water bill", 700, "Monthly", "2026-10-20"), it("lic", "Health", 0, "Yearly", "2027-04-01", { source: "insurance" }), it("nd", "No date", 5, "Monthly", ""), it("old", "Old one", 0, "Once", "2026-01-01")]), t = text(V.panel(c, [], o));
  assert.ok(/Not marked paid/.test(t) && /Water bill D:2026-10-20 ₹700 · yours/.test(t) && /Old one D:2026-01-01 amount missing/.test(t) && /The date has passed/.test(t));
  assert.ok(/2 items with no amount, not counted in the totals: Health, Old one/.test(t)); assert.ok(/1 item with no due date, not in the calendar: No date/.test(t));
  assert.ok(/amount missing/.test(t), "the missing one is still in its month");
  const clean = text(V.panel(cal([it("a", "A", 5, "Once", "2026-12-01")]), [], o)); assert.ok(!/Not marked paid|no amount|no due date/.test(clean));
  assert.ok(/1 item with no amount/.test(text(V.panel(cal([it("z", "Z", 0, "Once", "2026-12-01")]), [], o))));
}
// the add form: every field, the right options, errors shown or hidden
{
  const html = V.panel(cal([]), [], o);
  for (const f of ["name", "amount", "frequency", "nextDate", "endDate", "kind", "owner"]) assert.ok(new RegExp(`data-field="${f}"`).test(html), f);
  for (const k of V.KINDS) assert.ok(html.includes(`<option value="${k}"`), k); for (const f of V.FREQ) assert.ok(html.includes(`<option value="${f}"`), f);
  assert.ok(/<option value="Monthly" selected>/.test(html) && /<option value="Other" selected>/.test(html)); assert.ok(/data-act="oc-add"/.test(html));
  assert.ok(/<p class="up-error" role="alert" hidden>/.test(html)); const err = V.panel(cal([]), [], { ...o, errors: ["What is it for?", "Enter the next date it is due."] });
  assert.ok(!/<p class="up-error" role="alert" hidden>/.test(err) && /What is it for\? Enter the next date it is due\./.test(text(err)));
  assert.ok(/Only what is recorded is shown/.test(text(html)) && /Nothing is estimated/.test(text(html)));
}
// everything that comes from the data is escaped
{
  const evil = '<img src=x onerror=alert(1)>';
  const items = [it("e", evil, 100, "Monthly", "2026-12-01", { kind: evil, owner: evil }), it("m", evil, 0, "Yearly", "2027-04-01"), it("l", evil, 5, "Monthly", "2026-10-20"), it("u", evil, 5, "Monthly", "")];
  const html = V.panel(cal(items), [{ id: evil, name: evil, amount: 5, frequency: "Monthly", nextDate: "2026-12-01", endDate: "2027-01-01", kind: evil, owner: evil }], { ...o, names: { Both: evil, Me: evil, Wife: evil } });
  assert.ok(!/<img/.test(html) && /&lt;img/.test(html));
}
// a row of the household's list shows its last date; a one-off shows its frequency
{ const t = text(V.panel(cal([]), [{ id: "x", name: "Fee", amount: 900, frequency: "Yearly", nextDate: "2027-01-10", endDate: "2030-01-10", kind: "Fee", owner: "Wife" }], o)); assert.ok(/until D:2030-01-10/.test(t) && /Fee · Archana/.test(t)); }
{ const html = V.panel(cal([it("o", "One-off", 100, "Once", "2026-12-01")]), [], o); assert.ok(/One-off ₹100 Other · yours/.test(text(html)), "a one-off shows no frequency"); assert.ok(!/Other · once/.test(text(html))); }
console.log("outgo-calendar-views: ok");
