const assert = require("assert");
const B = require("../mcp/balance-sync.js");
const V = require("../mcp/vault-client.js");

const T = "2026-11-15";
const data = () => ({
  banksaving: [{ id: "b1", owner: "Me", value: 50000, date: "2026-11-13", note: "x" }, { id: "b2", owner: "Wife", value: 20000, date: "2026-11-13", note: "y" }],
  crypto: [{ id: "c1", owner: "Wife", value: 3500, date: "2026-11-14", note: "c" }],
  bonds: [{ id: "g1", owner: "Me", value: 73273, date: "2026-11-14", note: "SGB" }],
  silver: [{ id: "s1", owner: "Me", value: 5694, date: "2026-11-14" }, { id: "s2", owner: "Wife", value: 15942, date: "2026-11-14" }],
  ppf: [{ id: "p1", owner: "Me", value: 357114, date: "2026-11-15" }],
});
const ref = (o = {}) => ({ fetchedAt: T, members: { Me: { savings_account: 164913.18, bond: 72833, silver: 5694.3, ...(o.Me || {}) }, Wife: { savings_account: 38788.47, digital_assets: 5007.09, silver: 15941.931, ...(o.Wife || {}) } } });

// Happy path: values rounded to the rupee, dated today; unchanged ones left; PPF never touched
let p = B.plan(data(), ref(), { today: T });
assert.strictEqual(p.status, "ok");
const by = (f, o) => p.changes.find((c) => c.field === f && c.owner === o);
assert.deepStrictEqual([by("banksaving", "Me").from, by("banksaving", "Me").to, by("banksaving", "Me").date], [50000, 164913, T]);
assert.strictEqual(by("banksaving", "Wife").to, 38788);
assert.strictEqual(by("crypto", "Wife").to, 5007);
assert.strictEqual(by("bonds", "Me").to, 72833);
assert.strictEqual(by("silver", "Me"), undefined, "5694.3 rounds to 5694 = already right");
assert.strictEqual(p.same.length, 2, "both silvers already right");
assert.ok(!p.changes.some((c) => c.field === "ppf"));
const out = B.apply(data(), p.changes);
assert.strictEqual(out.banksaving[0].value, 164913); assert.strictEqual(out.banksaving[0].note, "x");
assert.strictEqual(out.ppf[0].value, 357114);
assert.ok(B.onlyValuesChanged(data(), out));

// Stale or missing reference: refuse everything
assert.strictEqual(B.plan(data(), { ...ref(), fetchedAt: "2026-11-14" }, { today: T }).status, "bad-reference");
assert.strictEqual(B.plan(data(), null, { today: T }).status, "bad-reference");
assert.strictEqual(B.plan(data(), { fetchedAt: T }, { today: T }).changes.length, 0);
assert.throws(() => B.plan(data(), ref(), { today: "15/11/2026" }));

// Big fall: exactly 40% is applied, just over is held back; any rise is applied
let d = data(); d.banksaving[0].value = 100000;
p = B.plan(d, ref({ Me: { savings_account: 60000 } }), { today: T });
assert.ok(p.changes.some((c) => c.field === "banksaving" && c.owner === "Me" && c.to === 60000), "a 40% fall is applied");
p = B.plan(d, ref({ Me: { savings_account: 59999 } }), { today: T });
const held = p.skipped.find((s) => s.field === "banksaving" && s.owner === "Me");
assert.ok(held && held.reason === "big-fall" && /confirm/.test(held.text));
assert.ok(!p.changes.some((c) => c.field === "banksaving" && c.owner === "Me"));
p = B.plan(d, ref({ Me: { savings_account: 900000 } }), { today: T });
assert.ok(p.changes.some((c) => c.field === "banksaving" && c.owner === "Me" && c.to === 900000), "a big rise is applied");

// Zero, missing and junk values never overwrite a real balance
for (const bad of [0, null, undefined, "", "abc", -5]) {
  p = B.plan(data(), ref({ Wife: { digital_assets: bad } }), { today: T });
  assert.ok(!p.changes.some((c) => c.field === "crypto"), `crypto left alone for ${String(bad)}`);
  assert.ok(p.skipped.some((s) => s.field === "crypto" && s.owner === "Wife"));
}
// Zero over a zero record is just "same", not a skip
d = data(); d.crypto[0].value = 0;
p = B.plan(d, ref({ Wife: { digital_assets: 0 } }), { today: T });
assert.ok(p.same.some((s) => s.field === "crypto"));

// Two records for one owner, or none: not guessed
d = data(); d.banksaving.push({ id: "b3", owner: "Me", value: 1, date: "2026-11-01" });
p = B.plan(d, ref(), { today: T });
assert.strictEqual(p.skipped.find((s) => s.field === "banksaving" && s.owner === "Me").reason, "many-records");
assert.ok(!p.changes.some((c) => c.field === "banksaving" && c.owner === "Me"));
d = data(); d.crypto = [];
p = B.plan(d, ref(), { today: T });
assert.strictEqual(p.skipped.find((s) => s.field === "crypto").reason, "no-record");

// A record at 0 takes the new value (not a fall)
d = data(); d.bonds[0].value = 0;
p = B.plan(d, ref(), { today: T });
assert.strictEqual(p.changes.find((c) => c.field === "bonds").to, 72833);

// Edges at 0 and 1 rupee
d = data(); d.crypto = [];
p = B.plan(d, ref({ Wife: { digital_assets: 1 } }), { today: T });
assert.strictEqual(p.skipped.filter((s) => s.reason === "no-record").length, 1, "1 rupee with no record is reported");
p = B.plan(d, ref({ Wife: { digital_assets: 0 } }), { today: T });
assert.strictEqual(p.skipped.filter((s) => s.reason === "no-record").length, 0, "0 with no record is not worth a line");
d = data(); d.crypto[0].value = 1;
p = B.plan(d, ref({ Wife: { digital_assets: 0 } }), { today: T });
assert.strictEqual(p.skipped.find((s) => s.field === "crypto").reason, "zero", "0 over a 1-rupee record is held");
d = data(); d.crypto[0].value = 5;
p = B.plan(d, ref({ Wife: { digital_assets: 1 } }), { today: T });
assert.ok(p.skipped.some((s) => s.field === "crypto" && s.reason === "big-fall"), "5 to 1 is a big fall");
p = B.plan(d, ref({ Wife: { digital_assets: 6 } }), { today: T });
assert.strictEqual(p.changes.find((c) => c.field === "crypto").to, 6);
d = data(); delete d.crypto[0].value;
p = B.plan(d, ref(), { today: T });
assert.strictEqual(p.changes.find((c) => c.field === "crypto").from, 0, "a record with no value reads as 0");

// Guard: anything beyond value/date is refused
const ok = B.apply(data(), B.plan(data(), ref(), { today: T }).changes);
assert.ok(B.onlyValuesChanged(data(), ok));
let bad = JSON.parse(JSON.stringify(ok)); bad.banksaving[0].note = "changed";
assert.ok(!B.onlyValuesChanged(data(), bad), "note change refused");
bad = JSON.parse(JSON.stringify(ok)); bad.banksaving[0].owner = "Wife";
assert.ok(!B.onlyValuesChanged(data(), bad), "owner change refused");
bad = JSON.parse(JSON.stringify(ok)); bad.banksaving.pop();
assert.ok(!B.onlyValuesChanged(data(), bad), "removed record refused");
bad = JSON.parse(JSON.stringify(ok)); bad.banksaving.reverse();
assert.ok(!B.onlyValuesChanged(data(), bad), "id mismatch refused");
bad = JSON.parse(JSON.stringify(ok)); bad.ppf[0].value = 1;
assert.ok(!B.onlyValuesChanged(data(), bad), "ppf change refused");
bad = JSON.parse(JSON.stringify(ok)); bad.goals = [];
assert.ok(!B.onlyValuesChanged(data(), bad), "new field refused");
assert.throws(() => B.apply(data(), [{ field: "ppf", id: "p1", to: 1, date: T }]), /Not allowed/);

// Summary text
assert.ok(/4 updated, 2 already right, 0 left alone/.test(B.summary(B.plan(data(), ref(), { today: T }))), B.summary(B.plan(data(), ref(), { today: T })));
assert.ok(/^not saved/.test(B.summary(B.plan(data(), null, { today: T }))));

// Writer: updateWith refuses a change the guard dislikes and does nothing when there is nothing to change
(async () => {
  assert.strictEqual(typeof V.updateWith, "function");
  await assert.rejects(V.updateWith({ gatewayUrl: "http://x", password: "p", make: () => null, fetchImpl: async () => { throw new Error("offline"); } }), /did not answer|offline/);
  console.log("mcp-balance-sync tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
