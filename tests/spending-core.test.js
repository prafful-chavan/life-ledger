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

console.log("spending-core tests passed");
