// Typed-in values that have gone out of date, and the one-tap update.
const assert = require("assert");
const V = require("../stale-values-core.js");

const TODAY = "2026-11-13";
const ago = (n) => new Date(Date.parse(TODAY + "T00:00:00Z") - n * 86400000).toISOString().slice(0, 10);
const rec = (id, days, value = 1000, extra = {}) => ({ id, date: ago(days), owner: "Me", value, note: "n-" + id, ...extra });

// ── limits: exactly the limit is fine, one day more is out of date ──
{
  const s = { banksaving: [rec("b30", 30), rec("b31", 31)], fd: [rec("f90", 90), rec("f91", 91)] };
  const r = V.find(s, TODAY);
  assert.deepStrictEqual(r.rows.map((x) => x.id).sort(), ["b31", "f91"]);
  assert.strictEqual(r.rows.find((x) => x.id === "b31").limit, 30); assert.strictEqual(r.rows.find((x) => x.id === "f91").limit, 90);
  assert.strictEqual(r.checked, 4); assert.strictEqual(r.fresh, 2);
}
// every kind has a limit and is read from the right collection
for (const k of V.KINDS) {
  const fresh = V.find({ [k.coll]: [rec("x", k.days)] }, TODAY), old = V.find({ [k.coll]: [rec("x", k.days + 1)] }, TODAY);
  assert.strictEqual(fresh.rows.length, 0, k.coll + " at its limit"); assert.strictEqual(old.rows.length, 1, k.coll + " one day over"); assert.strictEqual(old.rows[0].kind, k.label);
}
assert.deepStrictEqual(V.KINDS.map((k) => k.coll), ["banksaving", "crypto", "silver", "bonds", "fd", "epf", "ppf", "others"]);
// a future date is not stale; today is not stale
assert.strictEqual(V.find({ banksaving: [rec("a", -5), rec("b", 0)] }, TODAY).rows.length, 0);
// a record with no usable date is listed (its age cannot be told), first of all
{
  const s = { fd: [rec("old", 200), { id: "nodate", value: 5, owner: "Wife", note: "x" }, { id: "bad", date: "13-11-2026", value: 5 }, { id: "bad2", date: "2026-02-30", value: 5 }] };
  const r = V.find(s, TODAY);
  assert.deepStrictEqual(r.rows.map((x) => x.id), ["nodate", "bad", "bad2", "old"].sort((a, b) => ({ nodate: 0, bad: 1, bad2: 2, old: 3 }[a] - { nodate: 0, bad: 1, bad2: 2, old: 3 }[b])));
  assert.ok(r.rows[0].undated && r.rows[0].ageDays === null && r.rows[0].asOf === "");
  assert.strictEqual(r.rows[3].ageDays, 200);
}
// oldest first
assert.deepStrictEqual(V.find({ fd: [rec("a", 100), rec("b", 300), rec("c", 200)] }, TODAY).rows.map((x) => x.id), ["b", "c", "a"]);
// a zero or missing value adds nothing to net worth and is not listed
assert.strictEqual(V.find({ fd: [rec("z", 500, 0), rec("m", 500, null), { id: "t", date: ago(500), value: "abc" }] }, TODAY).rows.length, 0);
assert.strictEqual(V.find({ fd: [rec("neg", 500, -5)] }, TODAY).rows.length, 0);
// the rupees standing on stale numbers
assert.strictEqual(V.find({ fd: [rec("a", 100, 1500000), rec("b", 100, 500000)], epf: [rec("c", 10, 777)] }, TODAY).worth, 2000000);
// override of a limit; a bad override is ignored
assert.strictEqual(V.find({ banksaving: [rec("a", 10)] }, TODAY, { banksaving: 5 }).rows.length, 1);
assert.strictEqual(V.find({ banksaving: [rec("a", 10)] }, TODAY, { banksaving: "x" }).rows.length, 0);
assert.strictEqual(V.find({ banksaving: [rec("a", 10)] }, TODAY, { banksaving: 10 }).rows.length, 0, "an override of exactly the age is fine");
// missing collections, junk entries, empty state
assert.deepStrictEqual(V.find({}, TODAY), { rows: [], checked: 0, fresh: 0, worth: 0 });
assert.deepStrictEqual(V.find(null, TODAY), { rows: [], checked: 0, fresh: 0, worth: 0 });
assert.strictEqual(V.find({ fd: [null, undefined, 5, "x"] }, TODAY).rows.length, 0);
assert.strictEqual(V.find({ fd: "nope" }, TODAY).rows.length, 0);
// the owner and label fall back sensibly
{ const r = V.find({ fd: [{ id: "a", date: ago(200), value: 5 }] }, TODAY).rows[0]; assert.strictEqual(r.owner, "Me"); assert.strictEqual(r.name, "Fixed deposits"); }
// real shape, taken from the household's data on 2026-11-13
{
  const s = { banksaving: [rec("b1", 0, 50000), rec("b2", 0, 20000)], fd: [rec("f1", 172, 1500000), rec("f2", 172, 500000)], epf: [rec("e1", 172, 1190166), rec("e2", 172, 73203)], ppf: [rec("p1", 172, 357114)], bonds: [rec("sgb", 61, 76735)], others: [rec("ring", 172, 111000)], silver: [rec("s1", 172, 6022), rec("s2", 149, 18965)], crypto: [rec("c1", 172, 3500)] };
  const r = V.find(s, TODAY);
  assert.strictEqual(r.rows.length, 10); assert.strictEqual(r.fresh, 2); assert.strictEqual(r.worth, 1500000 + 500000 + 1190166 + 73203 + 357114 + 76735 + 111000 + 6022 + 18965 + 3500);
}

// ── daysBetween ──
assert.strictEqual(V.daysBetween("2026-11-13", "2026-11-13"), 0);
assert.strictEqual(V.daysBetween("2026-02-28", "2026-03-01"), 1);
assert.strictEqual(V.daysBetween("2028-02-28", "2028-03-01"), 2, "leap year");
assert.strictEqual(V.daysBetween("2026-11-14", "2026-11-13"), -1);
assert.strictEqual(V.daysBetween("2026-11-13T09:00:00Z", "2026-11-14"), 1, "a time on the date is ignored");
for (const bad of ["", null, undefined, "x", "2026-13-01", "2026-02-30"]) assert.strictEqual(V.daysBetween(bad, "2026-11-13"), null);

// ── refresh ──
{
  const list = [{ id: "a", date: "2026-05-25", value: 100, owner: "Me", note: "k" }, { id: "b", date: "2026-05-25", value: 200 }];
  const frozen = JSON.stringify(list);
  let r = V.refresh(list, "a", { value: 150 }, TODAY);
  assert.ok(r.ok); assert.deepStrictEqual(r.list[0], { id: "a", date: TODAY, value: 150, owner: "Me", note: "k" }); assert.deepStrictEqual(r.list[1], list[1]);
  assert.strictEqual(JSON.stringify(list), frozen, "the input is not changed");
  r = V.refresh(list, "a", {}, TODAY);
  assert.strictEqual(r.list[0].value, 100); assert.strictEqual(r.list[0].date, TODAY, "still correct: only the date moves");
  assert.strictEqual(V.refresh(list, "a", undefined, TODAY).list[0].value, 100);
  assert.strictEqual(V.refresh(list, "a", { value: 0 }, TODAY).list[0].value, 0, "zero is a real value (an FD that has matured)");
  assert.strictEqual(V.refresh(list, "a", { value: "250.5" }, TODAY).list[0].value, 250.5);
  assert.strictEqual(V.refresh(list, "a", { value: "" }, TODAY).list[0].value, 100, "an empty box means still correct");
  for (const v of [-1, "abc", NaN, Infinity]) assert.ok(!V.refresh(list, "a", { value: v }, TODAY).ok, String(v));
  assert.ok(!V.refresh(list, "zzz", {}, TODAY).ok);
  assert.ok(!V.refresh(list, "a", {}, "").ok);
  assert.ok(!V.refresh(null, "a", {}, TODAY).ok);
  // after the update the record is no longer listed
  assert.strictEqual(V.find({ fd: V.refresh(list, "a", {}, TODAY).list }, TODAY).rows.map((x) => x.id).join(), "b");
}

// ── blind spots closed after the mutation run ──
// a limit of 0 days is allowed: only today's value is fresh
assert.strictEqual(V.find({ banksaving: [rec("a", 1)] }, TODAY, { banksaving: 0 }).rows.length, 1);
assert.strictEqual(V.find({ banksaving: [rec("a", 0)] }, TODAY, { banksaving: 0 }).rows.length, 0);
// a small value still counts (a ₹1 balance is listed; only zero is skipped)
assert.strictEqual(V.find({ fd: [rec("a", 500, 1), rec("b", 500, 0.5)] }, TODAY).rows.length, 2);
// a date with a time after it is read by its date, and shown as a date
{ const r = V.find({ fd: [{ id: "t", date: "2026-05-25T10:00:00.000Z", value: 5 }] }, TODAY).rows[0]; assert.strictEqual(r.asOf, "2026-05-25"); assert.strictEqual(r.ageDays, 172); }
assert.strictEqual(V.daysBetween("2026-11-12", "2026-11-13T23:59:00Z"), 1);
assert.strictEqual(V.daysBetween("2026-11-12T08:00:00Z", "2026-11-13"), 1);
// the undated come first, then the rest by age; among the undated the order they were listed in
assert.deepStrictEqual(V.find({ fd: [rec("old", 500), { id: "u1", value: 5 }, rec("older", 900), { id: "u2", value: 5 }] }, TODAY).rows.map((r) => r.id), ["u1", "u2", "older", "old"]);
console.log("stale-values-core: ok");
