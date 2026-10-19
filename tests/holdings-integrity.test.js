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
console.log("holdings-integrity tests passed");
