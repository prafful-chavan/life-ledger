// Sync merge edge cases, from the rules in sync-engine.js's header: a delete and an edit at the same moment, how long a
// delete is remembered, whose live prices win, and that the merged stamps are what the next merge needs.
const assert = require("assert");
const E = require("../sync-engine.js");

const dev = (data, meta = {}) => ({ data, meta: { ...E.emptyMeta(), ...meta } });
const rec = (id, o = {}) => ({ id, ...o });
const ids = (m, f = "expenses") => m.data[f].map((r) => r.id).sort();
const get = (m, id, f = "expenses") => m.data[f].find((r) => r.id === id);
const both = (a, b, now) => [E.merge(a, b, now), E.merge(b, a, now)];

// ── An edit and a delete of the same row ──
{
  const edited = dev({ expenses: [rec("e1", { v: 2 })] }, { u: { expenses: { "i:e1": 500 } } });
  const deleted = (at) => dev({ expenses: [] }, { d: { expenses: { "i:e1": at } } });
  for (const m of both(edited, deleted(400), 1000)) assert.deepStrictEqual([ids(m), get(m, "e1").v], [["e1"], 2], "an edit after the delete brings the row back");
  for (const m of both(edited, deleted(600), 1000)) assert.deepStrictEqual(ids(m), [], "a delete after the edit wins");
  for (const m of both(edited, deleted(500), 1000)) assert.deepStrictEqual(ids(m), [], "at the same moment the delete wins (a row you removed must not return)");
  const m = E.merge(edited, deleted(400), 1000);
  assert.strictEqual(m.meta.u.expenses["i:e1"], 500, "the surviving row keeps its edit stamp");
  assert.strictEqual(m.meta.d.expenses["i:e1"], 400, "and the delete is still remembered");
  const gone = E.merge(edited, deleted(600), 1000);
  assert.deepStrictEqual([gone.meta.d.expenses["i:e1"], gone.meta.u.expenses["i:e1"]], [600, undefined], "a deleted row keeps the delete stamp and loses the edit stamp");
}

// ── A delete of a row that exists on neither side is still remembered (so a third device does not revive it) ──
{
  const m = E.merge(dev({ expenses: [] }, { d: { expenses: { "i:x": 300 } } }), dev({ expenses: [] }, { d: { expenses: { "i:x": 700 } } }), 1000);
  assert.strictEqual(m.meta.d.expenses["i:x"], 700, "the later of two delete times is kept");
  const onlyLocal = E.merge(dev({ expenses: [] }, { d: { expenses: { "i:x": 300 } } }), dev({ expenses: [] }), 1000);
  assert.strictEqual(onlyLocal.meta.d.expenses["i:x"], 300, "a delete known to one side only is kept");
}

// ── How long a delete is remembered ──
{
  const T = E.TOMBSTONE_TTL_MS, now = 10 * T;
  const withTomb = (at) => dev({ expenses: [] }, { d: { expenses: { "i:x": at } } });
  assert.strictEqual(E.merge(withTomb(now - T + 1), withTomb(now - T + 1), now).meta.d.expenses["i:x"], now - T + 1, "a delete inside the window is kept");
  assert.strictEqual(E.merge(withTomb(now - T), withTomb(now - T), now).meta.d.expenses["i:x"], now - T, "exactly at the edge it is still kept");
  assert.strictEqual(E.merge(withTomb(now - T - 1), withTomb(now - T - 1), now).meta.d.expenses["i:x"], undefined, "older than the window it is forgotten");
}

// ── Live prices: the row's stable fields follow the latest edit, the prices follow whichever device refreshed last ──
{
  const row = (nav, name) => rec("m1", { fundName: name, units: 10, latestNav: nav, navDate: "d" + nav });
  const a = dev({ mutualFunds: [row(100, "Edited name")] }, { u: { mutualFunds: { "i:m1": 900 } }, p: { mutualFunds: { "i:m1": 100 } } });   // edited recently, prices old
  const b = dev({ mutualFunds: [row(150, "Old name")] }, { u: { mutualFunds: { "i:m1": 800 } }, p: { mutualFunds: { "i:m1": 700 } } });      // prices newer, name older
  for (const m of both(a, b)) {
    const r = get(m, "m1", "mutualFunds");
    assert.deepStrictEqual([r.fundName, r.latestNav, r.navDate], ["Edited name", 150, "d150"], "the later name edit and the later NAV, from different devices");
    assert.strictEqual(m.meta.p.mutualFunds["i:m1"], 700, "the later price stamp is carried on");
    assert.strictEqual(m.meta.u.mutualFunds["i:m1"], 900);
  }
  const same = E.merge(dev({ mutualFunds: [row(100, "N")] }, { u: { mutualFunds: { "i:m1": 900 } }, p: { mutualFunds: { "i:m1": 500 } } }), dev({ mutualFunds: [row(150, "N")] }, { u: { mutualFunds: { "i:m1": 800 } }, p: { mutualFunds: { "i:m1": 500 } } }));
  assert.strictEqual(get(same, "m1", "mutualFunds").latestNav, 100, "prices refreshed at the same moment: the row's own (latest-edited) side is kept");
  const fresh = E.merge(dev({ mutualFunds: [row(100, "N")] }, { u: { mutualFunds: { "i:m1": 900 } }, p: { mutualFunds: { "i:m1": 900 } } }), dev({ mutualFunds: [row(150, "N")] }, { u: { mutualFunds: { "i:m1": 800 } }, p: { mutualFunds: { "i:m1": 100 } } }));
  assert.strictEqual(get(fresh, "m1", "mutualFunds").latestNav, 100, "the winner's own newer prices are not replaced");
  const none = E.merge(dev({ mutualFunds: [row(100, "A")] }), dev({ mutualFunds: [row(150, "A")] }));
  assert.ok(get(none, "m1", "mutualFunds"), "rows with no stamps at all still merge to one row");
  assert.strictEqual(none.data.mutualFunds.length, 1);
}

// ── Stamps: what the merge reports is what the next merge relies on ──
{
  const a = dev({ expenses: [rec("e1", { v: 1 })] }, { u: { expenses: { "i:e1": 10 } } });
  const b = dev({ expenses: [rec("e2", { v: 2 })] }, { u: { expenses: { "i:e2": 20 } } });
  const m = E.merge(a, b);
  assert.deepStrictEqual(m.meta.u.expenses, { "i:e1": 10, "i:e2": 20 }, "each row's stamp is kept");
  assert.deepStrictEqual(m.meta.p.expenses, {}, "no price stamps on a row that has none");
  const unstamped = E.merge(dev({ expenses: [rec("e1")] }), dev({ expenses: [rec("e2")] }));
  assert.deepStrictEqual([unstamped.meta.u.expenses, unstamped.meta.d.expenses], [{}, {}], "unstamped rows add no stamp entries");
  const f = (v, k) => dev({ taxProfile: v }, k ? { k: { taxProfile: k } } : {});
  assert.strictEqual(E.merge(f({ a: 1 }, 5), f({ a: 2 }, 5)).meta.k.taxProfile, 5, "a plain field carries its stamp");
  assert.strictEqual(E.merge(f({ a: 1 }), f({ a: 2 })).meta.k.taxProfile, undefined, "no stamp, no entry");
  assert.deepStrictEqual(E.merge(f({ a: 1 }, 5), f({ a: 2 }, 6)).data.taxProfile, { a: 2 }, "the later edit wins");
  assert.deepStrictEqual(E.merge(f({ a: 1 }, 6), f({ a: 2 }, 5)).data.taxProfile, { a: 1 }, "in either order");
  assert.deepStrictEqual(E.merge(f({ a: 1 }, 5), dev({})).data.taxProfile, { a: 1 }, "a field only one side has is kept");
}
console.log("sync edge tests passed");
