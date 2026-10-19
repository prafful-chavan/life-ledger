/**
 * Re-enacts the 19 Oct 2026 incident: Sync Holdings on one device replaced every fund row (new ids); an older device that was
 * offline refreshed prices on the old rows AFTERWARDS; when they synced, every fund appeared twice.
 */
const assert = require("assert");
const E = require("../sync-engine.js");
const H = require("../holdings-integrity.js");

const T0 = 1_000, T_A = 2_000, T_B = 3_000, T_SYNC = 4_000;
const legacy = (i) => ({ id: "mf-legacy-" + i, fundName: "Fund " + (i % 4), owner: "Me", demat: "Groww", transactionType: "PURCHASE", units: 10 + i, nav: 100, invested: 1000 + i, purchaseDate: "2026-0" + (1 + (i % 9)) + "-10", date: "2026-0" + (1 + (i % 9)) + "-10", latestNav: 100, currentValue: 1000 + i, navDate: "01-10-2026" });
const old = Array.from({ length: 20 }, (_, i) => legacy(i));
const baseMeta = E.stamp({}, { mutualFunds: old }, E.emptyMeta(), T0);

// Device A re-imports the sheet: same lots, brand-new ids
const imported = H.assignStableIds("mutualFunds", old.map(({ id, ...r }) => r));
const A = { data: { mutualFunds: imported }, meta: E.stamp({ mutualFunds: old }, { mutualFunds: imported }, baseMeta, T_A) };

// Device B (offline) only refreshes prices on the OLD rows, later than A's delete
const refreshed = old.map((r) => ({ ...r, latestNav: 105, currentValue: Math.round(r.units * 105), navDate: "16-10-2026" }));
const B = { data: { mutualFunds: refreshed }, meta: E.stamp({ mutualFunds: old }, { mutualFunds: refreshed }, baseMeta, T_B) };

assert.ok(Object.keys(B.meta.u.mutualFunds).every((k) => B.meta.u.mutualFunds[k] === T0), "a price refresh does NOT count as an edit");
assert.ok(Object.keys(B.meta.p.mutualFunds).length === 20, "…it is recorded as a price change instead");

// They sync, in either order: no duplicates
for (const [x, y] of [[A, B], [B, A]]) {
  const m = E.merge(x, y, T_SYNC);
  assert.strictEqual(m.data.mutualFunds.length, 20, "20 lots, not 40");
  assert.ok(m.data.mutualFunds.every((r) => H.isStableId(r.id)), "only the imported rows remain");
  assert.strictEqual(new Set(m.data.mutualFunds.map((r) => r.id)).size, 20);
}

// Importing the same sheet again changes nothing at all (same ids, no deletes, no new rows)
const again = H.assignStableIds("mutualFunds", imported.map(({ id, ...r }) => r));
assert.deepStrictEqual(again.map((r) => r.id), imported.map((r) => r.id), "same sheet → same ids");
const metaAgain = E.stamp({ mutualFunds: imported }, { mutualFunds: again }, A.meta, T_SYNC);
assert.deepStrictEqual(metaAgain.d.mutualFunds, A.meta.d.mutualFunds, "no new tombstones on a repeat import");

// The OLD app (price refresh counted as an edit) on a stale device still brings its rows back — the ghost collapse removes them
const oldCodeMeta = JSON.parse(JSON.stringify(baseMeta));
for (const r of old) oldCodeMeta.u.mutualFunds["i:" + r.id] = T_B;               // what the old engine would have stamped
const staleOldCode = { data: { mutualFunds: refreshed }, meta: oldCodeMeta };
const merged = E.merge(A, staleOldCode, T_SYNC);
assert.strictEqual(merged.data.mutualFunds.length, 40, "(control) the old engine behaviour really does produce the doubled book");
const cleaned = H.collapseImportGhosts(merged.data);
assert.strictEqual(cleaned.data.mutualFunds.length, 20, "ghost collapse restores the book");
assert.strictEqual(cleaned.removed, 20);
assert.ok(cleaned.data.mutualFunds.every((r) => H.isStableId(r.id)));

// The surge guard would have stopped that push in the first place
const surge = H.duplicateSurge({ mutualFunds: imported }, merged.data);
assert.strictEqual(surge.length, 1); assert.strictEqual(surge[0].coll, "mutualFunds"); assert.strictEqual(surge[0].extra, 20);
assert.deepStrictEqual(H.duplicateSurge({ mutualFunds: imported }, { mutualFunds: [...imported, { ...legacy(99), id: "mf-new" }] }), [], "one genuinely new lot is fine");

// Prices still flow between devices: the later refresh wins, and a real edit still wins the body
const X = { data: { mutualFunds: [{ id: "r1", fundName: "F", units: 10, invested: 100, latestNav: 100, currentValue: 1000, note: "old" }] }, meta: E.emptyMeta() };
X.meta = E.stamp({}, X.data, X.meta, T0);
const Y1 = JSON.parse(JSON.stringify(X));                                       // device 1 refreshes prices at T_B
Y1.data.mutualFunds[0] = { ...Y1.data.mutualFunds[0], latestNav: 120, currentValue: 1200 };
Y1.meta = E.stamp(X.data, Y1.data, Y1.meta, T_B);
const Y2 = JSON.parse(JSON.stringify(X));                                       // device 2 edits the note at T_A (earlier)
Y2.data.mutualFunds[0] = { ...Y2.data.mutualFunds[0], note: "edited" };
Y2.meta = E.stamp(X.data, Y2.data, Y2.meta, T_A);
const mm = E.merge(Y1, Y2, T_SYNC).data.mutualFunds[0];
assert.strictEqual(mm.note, "edited", "the real edit survives");
assert.strictEqual(mm.latestNav, 120, "and so does the newer price");
assert.strictEqual(E.merge(Y2, Y1, T_SYNC).data.mutualFunds[0].latestNav, 120, "regardless of merge order");

// A real delete is still a delete, and a real edit still beats an older delete
const keep = { data: { mutualFunds: [{ id: "k", fundName: "K", units: 1, invested: 1 }] }, meta: E.emptyMeta() };
keep.meta = E.stamp({}, keep.data, keep.meta, T0);
const deleted = { data: { mutualFunds: [] }, meta: E.stamp(keep.data, { mutualFunds: [] }, keep.meta, T_A) };
assert.strictEqual(E.merge(keep, deleted, T_SYNC).data.mutualFunds.length, 0, "delete wins over an untouched copy");
const edited = { data: { mutualFunds: [{ id: "k", fundName: "K", units: 2, invested: 2 }] }, meta: E.emptyMeta() };
edited.meta = E.stamp(keep.data, edited.data, keep.meta, T_B);
assert.strictEqual(E.merge(edited, deleted, T_SYNC).data.mutualFunds.length, 1, "a later real edit still beats an earlier delete");
console.log("sync-incident tests passed");
