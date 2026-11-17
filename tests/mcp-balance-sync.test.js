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

// The run's own report
let rp = B.report(B.plan(data(), ref(), { today: T }), T);
assert.strictEqual(rp.checkedOn, T); assert.strictEqual(rp.status, "ok"); assert.strictEqual(rp.same, 2); assert.strictEqual(rp.updated.length, 4);
assert.deepStrictEqual(rp.updated.find((u) => u.field === "crypto"), { owner: "Wife", field: "crypto", label: "Crypto", from: 3500, to: 5007 });
d = data(); d.banksaving[0].value = 1000000;
rp = B.report(B.plan(d, ref(), { today: T }), T);
assert.strictEqual(rp.status, "held"); assert.strictEqual(rp.held[0].label, "Bank savings"); assert.ok(/confirm/.test(rp.held[0].text));
rp = B.report(B.plan(data(), null, { today: T }), T);
assert.strictEqual(rp.status, "failed"); assert.ok(rp.problems.length && !rp.updated.length);
// The guard lets the report in, and only a plain object
let withReport = { ...ok, balanceSync: rp };
assert.ok(B.onlyValuesChanged(data(), withReport), "balanceSync may change");
assert.ok(!B.onlyValuesChanged(data(), { ...ok, balanceSync: [1] }), "an array is refused");
assert.ok(!B.onlyValuesChanged(data(), { ...ok, balanceSync: "x" }), "a string is refused");
assert.ok(!B.onlyValuesChanged(data(), { ...withReport, otherField: { a: 1 } }), "other new fields still refused");

// Summary text
assert.ok(/4 updated, 2 already right, 0 left alone/.test(B.summary(B.plan(data(), ref(), { today: T }))), B.summary(B.plan(data(), ref(), { today: T })));
assert.ok(/^not saved/.test(B.summary(B.plan(data(), null, { today: T }))));

// Writer: the whole nightly write against a fake gateway
const E = require("../sync-engine.js");
(async () => {
  const pw = "test-password", salt = Buffer.alloc(16, 9);
  const start = { ...data(), income: [{ id: "i1", amount: 1 }], goals: [{ id: "g9" }] };
  let server = { rev: 10, vault: { ...(await V.encryptVault({ data: start, sync: E.emptyMeta(), totpSecret: null }, pw, { salt })), entryCount: V.countEntries(start) } };
  const fetchImpl = async (url, init) => {
    const req = JSON.parse(init.body), reply = (o) => ({ ok: true, status: 200, headers: new Map(), text: async () => JSON.stringify(o) });
    if (req.op === "pull") return reply({ ok: true, rev: server.rev, vault: server.vault });
    if (req.baseRev !== server.rev) return reply({ ok: true, conflict: true, rev: server.rev });
    server = { rev: server.rev + 1, vault: req.vault }; return reply({ ok: true, rev: server.rev });
  };
  const run = (reference) => { let last; return V.updateWith({ gatewayUrl: "https://example.test/gw", password: pw, fetchImpl, now: 1790000000000, guard: B.onlyValuesChanged,
    make: (before) => { last = B.plan(before, reference, { today: T }); return { ...(last.status === "ok" && last.changes.length ? B.apply(before, last.changes) : before), balanceSync: B.report(last, T) }; } }); };
  const res = await run(ref());
  assert.strictEqual(res.rev, 11);
  let inner = await V.decryptVault(server.vault, pw);
  assert.deepStrictEqual([inner.data.banksaving[0].value, inner.data.banksaving[1].value, inner.data.crypto[0].value, inner.data.bonds[0].value], [164913, 38788, 5007, 72833]);
  assert.strictEqual(inner.data.banksaving[0].note, "x", "notes untouched");
  assert.deepStrictEqual([inner.data.income, inner.data.goals, inner.data.ppf], [start.income, start.goals, start.ppf], "nothing else changed");
  assert.strictEqual(inner.data.balanceSync.status, "ok"); assert.strictEqual(inner.data.balanceSync.updated.length, 4);
  assert.strictEqual(server.vault.entryCount, V.countEntries(start), "the entry count the gateway checks is unchanged");
  assert.strictEqual(server.vault.salt, salt.toString("base64"), "salt kept");
  assert.ok(inner.sync.k.balanceSync, "the summary is stamped");
  // An app device that still has the old copy picks everything up on its next sync
  const merged = E.merge({ data: start, meta: E.emptyMeta() }, { data: inner.data, meta: inner.sync });
  assert.strictEqual(merged.data.balanceSync.checkedOn, T);
  assert.strictEqual(merged.data.banksaving.find((r) => r.id === "b1").value, 164913);
  // A second run the same day changes nothing but still saves its summary
  const res2 = await run(ref()); assert.strictEqual(res2.rev, 12);
  inner = await V.decryptVault(server.vault, pw);
  assert.strictEqual(inner.data.balanceSync.updated.length, 0); assert.strictEqual(inner.data.balanceSync.same, 6);
  // A stale copy records a failed run and changes no value
  const before = JSON.stringify(inner.data.banksaving);
  await run({ ...ref(), fetchedAt: "2026-11-14" });
  inner = await V.decryptVault(server.vault, pw);
  assert.strictEqual(inner.data.balanceSync.status, "failed"); assert.strictEqual(JSON.stringify(inner.data.banksaving), before);
  // The writer refuses a change the guard dislikes (a deleted record) and pushes nothing
  const rev = server.rev;
  await assert.rejects(V.updateWith({ gatewayUrl: "x", password: pw, fetchImpl, guard: B.onlyValuesChanged, make: (b) => ({ ...b, banksaving: b.banksaving.slice(1) }) }), /more than was allowed/);
  assert.strictEqual(server.rev, rev, "nothing was pushed");
  await assert.rejects(V.updateWith({ gatewayUrl: "x", password: pw, fetchImpl, guard: B.onlyValuesChanged, make: (b) => ({ ...b, goals: [] }) }), /more than was allowed/);
  await assert.rejects(V.updateField({ gatewayUrl: "x", password: pw, field: "banksaving", value: {}, fetchImpl }), /not allowed/);
  console.log("mcp-balance-sync tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
