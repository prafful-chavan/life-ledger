const assert = require("assert");
const H = require("../holdings-integrity.js");

const mf = (o) => ({ fundName: "F", owner: "Me", demat: "Groww", transactionType: "PURCHASE", units: 10, invested: 1000, purchaseDate: "2026-01-01", ...o });

// fingerprints ignore prices and ids, but not content
assert.strictEqual(H.fingerprint("mutualFunds", mf({ id: "a", latestNav: 1, currentValue: 5 })), H.fingerprint("mutualFunds", mf({ id: "b", latestNav: 9, currentValue: 50 })));
assert.notStrictEqual(H.fingerprint("mutualFunds", mf({})), H.fingerprint("mutualFunds", mf({ units: 11 })));
assert.notStrictEqual(H.fingerprint("mutualFunds", mf({})), H.fingerprint("mutualFunds", mf({ owner: "Wife" })));
assert.notStrictEqual(H.fingerprint("mutualFunds", mf({})), H.fingerprint("mutualFunds", mf({ transactionType: "REDEMPTION" })));
assert.strictEqual(H.fingerprint("mutualFunds", mf({ transactionType: "REDEEM" })), H.fingerprint("mutualFunds", mf({ transactionType: "REDEMPTION" })), "both spellings of a sale are one thing");
assert.strictEqual(H.fingerprint("stocks", { symbol: "tcs", owner: "Me", quantity: 5, invested: 100, date: "2026-01-01" }), H.fingerprint("stocks", { symbol: "TCS", owner: "Me", quantity: 5, invested: 100, purchaseDate: "2026-01-01" }));

// stable ids: deterministic, unique even for identical rows, tagged by collection
const rows = [mf({}), mf({}), mf({ units: 3 })];
const a = H.assignStableIds("mutualFunds", rows), b = H.assignStableIds("mutualFunds", rows.map((r) => ({ ...r })));
assert.deepStrictEqual(a.map((r) => r.id), b.map((r) => r.id), "same input, same ids");
assert.strictEqual(new Set(a.map((r) => r.id)).size, 3, "two identical lots still get two ids");
assert.ok(a.every((r) => H.isStableId(r.id) && /^mf-h-/.test(r.id)));
assert.ok(H.assignStableIds("stocks", [{ symbol: "X", quantity: 1, invested: 1 }])[0].id.startsWith("stk-h-"));
assert.ok(H.assignStableIds("usstocks", [{ symbol: "X", quantity: 1, invested: 1 }])[0].id.startsWith("uss-h-"));
assert.ok(!H.isStableId("mf-5a01bf6d-1ce4-436a-9ade-ead7df7a752b"), "a legacy random id is not a stable one");
const many = H.assignStableIds("mutualFunds", Array.from({ length: 3000 }, (_, i) => mf({ units: i, invested: i * 7 })));
assert.strictEqual(new Set(many.map((r) => r.id)).size, 3000, "no id collisions across 3,000 lots");

// ghost collapse only drops legacy rows that duplicate an imported one
const imported = H.assignStableIds("mutualFunds", [mf({ units: 1 }), mf({ units: 2 })]);
const data = { mutualFunds: [...imported, { ...mf({ units: 1 }), id: "mf-legacy-1" }, { ...mf({ units: 99 }), id: "mf-manual" }], stocks: [{ id: "stk-1", symbol: "A" }] };
const c = H.collapseImportGhosts(data);
assert.strictEqual(c.removed, 1); assert.deepStrictEqual(c.data.mutualFunds.map((r) => r.id).sort(), [...imported.map((r) => r.id), "mf-manual"].sort(), "a manual lot with different content is kept");
assert.deepStrictEqual(c.data.stocks, data.stocks, "collections without imported rows are untouched");
assert.strictEqual(H.collapseImportGhosts({ mutualFunds: [{ ...mf({}), id: "mf-a" }, { ...mf({}), id: "mf-b" }] }).removed, 0, "with no imported rows nothing is guessed");

// duplicate report and halving
const book = Array.from({ length: 12 }, (_, i) => ({ ...mf({ units: i + 1 }), id: "mf-" + i }));
book.push({ ...mf({ units: 5 }), id: "mf-pair" });                           // a genuine identical pair (units 5)
const healthy = H.duplicateReport({ mutualFunds: book }).find((r) => r.coll === "mutualFunds");
assert.ok(!H.looksDuplicated(healthy), "a couple of genuine twins are not an alarm");
const doubled = [...book, ...book.map((r) => ({ ...r, id: r.id + "-copy" }))];
const rep = H.duplicateReport({ mutualFunds: doubled }).find((r) => r.coll === "mutualFunds");
assert.ok(H.looksDuplicated(rep) && rep.ratio === 1);
const fixed = H.halveDuplicates("mutualFunds", doubled);
assert.strictEqual(fixed.length, book.length, "back to the original number of lots, genuine twin included");
assert.strictEqual(fixed.filter((r) => r.units === 5).length, 2);
assert.deepStrictEqual(H.halveDuplicates("mutualFunds", doubled).map((r) => r.id), fixed.map((r) => r.id), "deterministic on every device");

// surge guard
const base = { mutualFunds: Array.from({ length: 50 }, (_, i) => ({ ...mf({ units: i + 1 }), id: "b" + i })) };
assert.deepStrictEqual(H.duplicateSurge(base, { mutualFunds: [...base.mutualFunds, ...base.mutualFunds.slice(0, 3).map((r, i) => ({ ...r, id: "x" + i }))] }), [], "3 extra copies is below the line");
assert.strictEqual(H.duplicateSurge(base, { mutualFunds: [...base.mutualFunds, ...base.mutualFunds.map((r) => ({ ...r, id: r.id + "x" }))] })[0].extra, 50);
assert.deepStrictEqual(H.duplicateSurge({ mutualFunds: [] }, base), [], "no baseline, no verdict");
assert.deepStrictEqual(H.duplicateSurge(base, { mutualFunds: [] }), [], "shrinking is never a surge");

// ── import preview ──
{
  const mkMf = (i, o = {}) => ({ fundName: "Fund " + (i % 7), owner: "Me", demat: "G", transactionType: "PURCHASE", units: 10 + i, invested: 1000 + i * 3, purchaseDate: "2026-01-" + String(1 + (i % 27)).padStart(2, "0"), ...o });
  const held = Array.from({ length: 40 }, (_, i) => ({ ...mkMf(i), id: "mf-legacy-" + i, latestNav: 5, currentValue: 50 }));
  const state = { mutualFunds: held, stocks: [], usstocks: [] };
  const stableSame = H.assignStableIds("mutualFunds", held.map(({ id, latestNav, currentValue, ...r }) => r));

  // the very same sheet, with brand-new ids and no prices: nothing changes, nothing needs a question
  let sum = H.importSummary(state, { mutualFunds: stableSame, stocks: [], usstocks: [] });
  assert.strictEqual(sum.needsConfirm, false);
  assert.strictEqual(sum.byColl.mutualFunds.added.length, 0); assert.strictEqual(sum.byColl.mutualFunds.removed.length, 0); assert.strictEqual(sum.byColl.mutualFunds.unchanged, 40);
  assert.deepStrictEqual(H.describeImport(sum).lines, ["Mutual funds: 40 → 40 (no change)"], "an id migration shows as no change");

  // one new SIP lot is routine: applied without asking, but still described
  const two = H.assignStableIds("mutualFunds", [...held.map(({ id, latestNav, currentValue, ...r }) => r), mkMf(100)]);
  sum = H.importSummary(state, { mutualFunds: two, stocks: [], usstocks: [] });
  assert.strictEqual(sum.needsConfirm, false, "+1 on 40 is under 5%");
  assert.deepStrictEqual(H.describeImport(sum).lines, ["Mutual funds: 40 → 41 (+1 new)"]);
  // …and on a realistic book a handful of new lots is nothing
  const realistic = Array.from({ length: 613 }, (_, i) => ({ ...mkMf(i), id: "mf-" + i }));
  assert.strictEqual(H.importSummary({ mutualFunds: realistic }, { mutualFunds: [...realistic.map(({ id, ...r }) => r), mkMf(900), mkMf(901), mkMf(902)] }).needsConfirm, false, "+3 on 613 is routine");
  assert.ok(H.describeImport(sum).details[0] === "New:" && /Fund/.test(H.describeImport(sum).details[1]));

  // a sheet that would drop a lot of rows, or add a lot, asks first
  const shrunk = H.assignStableIds("mutualFunds", held.slice(0, 30).map(({ id, latestNav, currentValue, ...r }) => r));
  sum = H.importSummary(state, { mutualFunds: shrunk, stocks: [], usstocks: [] });
  assert.strictEqual(sum.needsConfirm, true); assert.strictEqual(sum.byColl.mutualFunds.removed.length, 10);
  assert.ok(/Mutual funds: 0 new and 10 removed against 40/.test(sum.reasons[0]) || /10 removed against 40 held/.test(sum.reasons[0]), sum.reasons[0]);
  const doubled = H.assignStableIds("mutualFunds", [...held, ...held.map((r, i) => ({ ...r, id: undefined, units: r.units + 0.5 }))].map(({ id, latestNav, currentValue, ...r }) => r));
  assert.strictEqual(H.importSummary(state, { mutualFunds: doubled, stocks: [], usstocks: [] }).needsConfirm, true, "doubling the book needs a yes");

  // an empty sheet against a held book always asks; two empty sides never do
  sum = H.importSummary(state, { mutualFunds: [], stocks: [], usstocks: [] });
  assert.strictEqual(sum.needsConfirm, true); assert.ok(/the sheet has none, but you hold 40/.test(sum.reasons[0]));
  assert.strictEqual(H.importSummary({ mutualFunds: [], stocks: [], usstocks: [] }, { mutualFunds: [], stocks: [], usstocks: [] }).needsConfirm, false);
  // a first import into an empty book is not a "change" worth asking about
  assert.strictEqual(H.importSummary({ mutualFunds: [] }, { mutualFunds: stableSame }).needsConfirm, false);

  // sales and spellings: REDEEM and REDEMPTION are the same lot
  const withSale = { mutualFunds: [{ ...mkMf(1, { transactionType: "REDEMPTION" }), id: "x" }], stocks: [], usstocks: [] };
  assert.strictEqual(H.importSummary(withSale, { mutualFunds: [mkMf(1, { transactionType: "REDEEM" })] }).byColl.mutualFunds.unchanged, 1);
  // long lists are trimmed in the dialog
  const big = H.importSummary({ mutualFunds: [] }, { mutualFunds: stableSame });
  const d = H.describeImport(big, { examples: 3 });
  assert.ok(d.details.some((l) => /and 37 more/.test(l)));
}

console.log("holdings-integrity tests passed");
