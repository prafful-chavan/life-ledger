const assert = require("assert");
const C = require("../spending-core.js");

// Midnight IST on 2022-10-12 is 18:30 UTC on the 11th; must map to the 12th.
const secs = (Date.UTC(2022, 9, 11, 18, 30) / 1000) - 978307200;
assert.strictEqual(C.coreDataToISODate(secs), "2022-10-12");
assert.strictEqual(C.coreDataToISODate(secs + 3600), "2022-10-12");

const row = (o) => ({ pk: 1, amount: 100, date: secs, name: "Lunch", note: "", category: "Eating Out ", ...o });
const rows = [row({}), row({}), row({ amount: 250, name: "Fuel", category: " Fuel and Maintenance", note: "Shell" })];
const inc = C.rowsToExpenses(rows);
assert.strictEqual(inc.length, 3);
assert.strictEqual(inc[0].category, "Eating Out");
assert.strictEqual(inc[2].note, "Fuel — Shell");
assert.strictEqual(inc[0].paidBy, "Both");
assert.notStrictEqual(inc[0].id, inc[1].id, "identical rows get distinct ids");
// Stable across runs and independent of Z_PK
assert.deepStrictEqual(C.rowsToExpenses(rows.map((r, i) => ({ ...r, pk: 900 + i }))).map((e) => e.id), inc.map((e) => e.id));

// First import: nothing existing → everything added
let plan = C.planImport([], inc, []);
assert.strictEqual(plan.toAdd.length, 3);

// Re-import is a no-op
plan = C.planImport(inc, inc, plan.handledIds);
assert.strictEqual(plan.toAdd.length, 0);
assert.strictEqual(plan.alreadyImported, 3);

// A row the user deleted in Life Ledger is not resurrected
const handled = inc.map((e) => e.id);
plan = C.planImport(inc.slice(1), inc, handled);
assert.strictEqual(plan.toAdd.length, 0);

// Overlap with expenses already imported from Excel (same date+amount) is not doubled
const manual = [{ id: "exp-1", date: "2022-10-12", amount: 100, category: "Food", note: "x" }];
plan = C.planImport(manual, inc, []);
assert.strictEqual(plan.matchedExisting, 1);
assert.strictEqual(plan.toAdd.length, 2); // one 100 matched, other 100 + 250 added

// New rows on a later import are added
const later = C.rowsToExpenses([...rows, row({ amount: 999, name: "New" })]);
plan = C.planImport(inc, later, handled);
assert.strictEqual(plan.toAdd.length, 1);
assert.strictEqual(plan.toAdd[0].amount, 999);

// Wife's source: own id prefix, own payer, and no date+amount matching against shared expenses
const wifeInc = C.rowsToExpenses(rows, { paidBy: "Wife", idPrefix: "spw-" });
{
  // Wife's import only matches expenses already tagged Wife, never yours
  const mixed = [
    { id: "exp-a", date: "2022-10-12", amount: 100, paidBy: "Me" },
    { id: "exp-b", date: "2022-10-12", amount: 100, paidBy: "Wife" },
  ];
  const isWife = (e) => /wife/i.test(e.paidBy || "");
  const p = C.planImport(mixed, wifeInc, [], { matchExisting: true, poolFilter: isWife });
  assert.strictEqual(p.matchedExisting, 1, "only her own earlier entry is matched");
  assert.strictEqual(p.toAdd.length, 2);
  // Future-dated recurring rows are held back, not marked handled
  const future = [{ id: "sp-f", date: "2099-01-01", amount: 5, category: "x", paidBy: "Both", note: "" }];
  const fp = C.planImport([], future, [], { today: "2026-10-12" });
  assert.strictEqual(fp.skippedFuture, 1);
  assert.strictEqual(fp.toAdd.length, 0);
  assert.strictEqual(fp.handledIds.length, 0);
  assert.strictEqual(C.monthTotal(future, "2099-01", "2026-10-12"), 0);
  assert.strictEqual(C.monthTotal(inc, "2022-10"), 450);
  const rs = C.resetSource([{ id: "spw-1" }, { id: "exp-1" }, { id: "sp-1" }], ["spw-1", "sp-1"], "spw-");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(rs)), { expenses: [{ id: "exp-1" }, { id: "sp-1" }], ids: ["sp-1"] });
}
assert.ok(wifeInc.every((e) => e.id.startsWith("spw-") && e.paidBy === "Wife"));
assert.notStrictEqual(wifeInc[0].id, inc[0].id, "same row in both backups never collides");
const shared = [{ id: "exp-9", date: "2022-10-12", amount: 100 }, ...inc];
let wp = C.planImport(shared, wifeInc, [], { matchExisting: false });
assert.strictEqual(wp.toAdd.length, 3);
assert.strictEqual(wp.matchedExisting, 0);
// Imported sp-/spw- rows are excluded from the existing-expense pool for either source
wp = C.planImport(wifeInc, inc, [], { matchExisting: true });
assert.strictEqual(wp.matchedExisting, 0);

{
  const mine = C.rowsToExpenses(rows, { idPrefix: "sp-" });
  const sameAsMine = C.rowsToExpenses(rows, { paidBy: "Wife", idPrefix: "spw-" });
  assert.strictEqual(C.overlapRatio(sameAsMine, mine.map((e) => e.id)), 1);
  const other = C.rowsToExpenses([row({ amount: 7, name: "Other" })], { paidBy: "Wife", idPrefix: "spw-" });
  assert.strictEqual(C.overlapRatio(other, mine.map((e) => e.id)), 0);
}

// planRemovals: imported rows missing from the backup are candidates; hand-typed rows never are
{
  const incoming = [{ id: "sp-a" }, { id: "sp-b" }];
  const existing = [{ id: "sp-a" }, { id: "sp-gone" }, { id: "spw-x" }, { id: "exp-hand" }];
  const r = C.planRemovals(existing, incoming, "sp-");
  assert.deepStrictEqual(r.stale.map((e) => e.id), ["sp-gone"], "only this source's missing row; wife's and typed rows are ignored");
  assert.strictEqual(r.large, false);
  assert.strictEqual(r.tooFewRows, false, "small data sets don't trigger the incomplete-backup guard");
  const many = Array.from({ length: 100 }, (_, i) => ({ id: "sp-" + i }));
  assert.strictEqual(C.planRemovals(many, many.slice(0, 40), "sp-").tooFewRows, true, "most of the rows missing looks like an incomplete backup");
  assert.strictEqual(C.planRemovals(many, many.slice(0, 75), "sp-").large, true, "25 of 100 is more than the batch limit");
  assert.strictEqual(C.planRemovals(many, many.slice(0, 85), "sp-").large, false, "a handful of edits is applied automatically");
  assert.strictEqual(C.planRemovals(null, null, "sp-").stale.length, 0, "bad input never throws");
}


// ── category spelling variants merge ──
{
  const ex = (category, n = 1) => Array.from({ length: n }, () => ({ category }));
  const list = [...ex("EMI - Car, Home, policy", 32), ...ex("EMI- Car, Home, policy", 6), ...ex("Grooming", 93), ...ex("Gromming", 16), ...ex("Groceries", 5), ...ex("", 2)];
  const canon = C.categoryCanon(list);
  const show = (c) => canon[C.categoryKey(c)] || c;
  assert.strictEqual(show("EMI- Car, Home, policy"), "EMI - Car, Home, policy", "most-used spelling wins");
  assert.strictEqual(show("Gromming"), "Grooming", "known typo joins the right category");
  assert.strictEqual(show("Groceries"), "Groceries");
  assert.strictEqual(Object.keys(canon).length, 3, "no empty category, 3 real ones");
  assert.deepStrictEqual(C.categoryCanon(null), {});
}
console.log("spending-core tests passed");
