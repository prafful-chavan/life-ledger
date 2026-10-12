const assert = require("assert");
const E = require("../sync-engine.js");

const A = (id, v) => ({ id, v });
function device(data, meta) { return { data, meta: meta || E.emptyMeta() }; }
function edit(dev, mutate, now) {
  const next = JSON.parse(JSON.stringify(dev.data));
  mutate(next);
  return { data: next, meta: E.stamp(dev.data, next, dev.meta, now) };
}

// Two devices start from the same baseline
const base = device({ expenses: [A("e1", 1), A("e2", 2)], goalCfg: { x: 1 } });
let mac = base, phone = base;

// Offline-ish concurrent edits on different records + a new record each
mac = edit(mac, d => { d.expenses[0].v = 10; d.expenses.push(A("e3", 3)); }, 1000);
phone = edit(phone, d => { d.expenses[1].v = 20; d.expenses.push(A("e4", 4)); }, 2000);

const m1 = E.merge(mac, phone, 3000);
const m2 = E.merge(phone, mac, 3000);
assert.ok(E.dataEquals(m1.data, m2.data), "merge is commutative");
assert.deepStrictEqual(m1.data.expenses.map(r => r.id).sort(), ["e1", "e2", "e3", "e4"]);
assert.strictEqual(m1.data.expenses.find(r => r.id === "e1").v, 10);
assert.strictEqual(m1.data.expenses.find(r => r.id === "e2").v, 20);

// Idempotent
const m3 = E.merge(m1, m1, 3000);
assert.ok(E.dataEquals(m3.data, m1.data));
assert.deepStrictEqual(m3.meta, m1.meta);

// Same record edited on both: latest edit wins
mac = edit(m1, d => { d.expenses.find(r => r.id === "e1").v = 111; }, 4000);
phone = edit(m1, d => { d.expenses.find(r => r.id === "e1").v = 222; }, 5000);
assert.strictEqual(E.merge(mac, phone, 6000).data.expenses.find(r => r.id === "e1").v, 222);
assert.strictEqual(E.merge(phone, mac, 6000).data.expenses.find(r => r.id === "e1").v, 222);

// Delete on one device is not resurrected by a stale device
mac = edit(m1, d => { d.expenses = d.expenses.filter(r => r.id !== "e2"); }, 7000);
const merged = E.merge(m1, mac, 8000); // phone side still has e2, older stamp
assert.ok(!merged.data.expenses.some(r => r.id === "e2"), "tombstone wins over stale copy");
const merged2 = E.merge(mac, m1, 8000);
assert.ok(!merged2.data.expenses.some(r => r.id === "e2"));

// Edit after delete (newer) revives the record
phone = edit(m1, d => { d.expenses.find(r => r.id === "e2").v = 99; }, 9000);
assert.ok(E.merge(mac, phone, 10000).data.expenses.some(r => r.id === "e2" && r.v === 99));

// Scalar/object fields are last-writer-wins
mac = edit(m1, d => { d.goalCfg = { x: 5 }; }, 11000);
phone = edit(m1, d => { d.goalCfg = { x: 6 }; }, 12000);
assert.deepStrictEqual(E.merge(mac, phone, 13000).data.goalCfg, { x: 6 });

// netWorthHistory is keyed by date so two devices' same-day snapshots collapse
const s1 = { id: "nwh-aaa", date: "2026-10-12", netWorth: 100 };
const s2 = { id: "nwh-bbb", date: "2026-10-12", netWorth: 105 };
const h1 = device({ netWorthHistory: [] });
const dA = edit(h1, d => { d.netWorthHistory.push(s1); }, 100);
const dB = edit(h1, d => { d.netWorthHistory.push(s2); }, 200);
const hm = E.merge(dA, dB, 300);
assert.strictEqual(hm.data.netWorthHistory.length, 1);
assert.strictEqual(hm.data.netWorthHistory[0].netWorth, 105);

// Records without ids are deduped by content
const c1 = edit(device({ misc: [] }), d => { d.misc.push({ role: "u", text: "hi" }); }, 1);
const c2 = edit(device({ misc: [] }), d => { d.misc.push({ role: "u", text: "hi" }); }, 2);
assert.strictEqual(E.merge(c1, c2, 3).data.misc.length, 1);

// Unstamped (pre-sync) data is never lost by union
const old = device({ expenses: [A("z", 1)] });
const fresh = device({ expenses: [A("y", 2)] });
assert.strictEqual(E.merge(old, fresh, 1).data.expenses.length, 2);

// Stale tombstones are garbage-collected
const t = device({ expenses: [] }, { u: {}, d: { expenses: { gone: 1 } }, k: {} });
assert.ok(!("gone" in E.merge(t, t, E.TOMBSTONE_TTL_MS + 10).meta.d.expenses));

console.log("sync-engine tests passed");
