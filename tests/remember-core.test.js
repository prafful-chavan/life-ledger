// "Remember this device": the password is never kept; only a non-extractable key, the salt and the sync token are, and only
// while valid. Old plain-text records are converted.
const assert = require("assert");
const R = require("../remember-core.js");

const T0 = Date.UTC(2026, 9, 25), DAY = 86400000;
const goodKey = { type: "secret", extractable: false };
const token = "a".repeat(64);
const rec = (o) => ({ v: 2, expiresAt: T0 + DAY, key: goodKey, salt: "c2FsdA==", token, ...(o || {}) });
const mem = () => { let v = null; return { get: async () => v, put: async (r) => { v = r; }, del: async () => { v = null; }, peek: () => v }; };

(async () => {
  // ── a new record lasts 30 days ──
  const n = R.newRecord({ key: goodKey, salt: "s", token, now: T0 });
  assert.strictEqual(n.expiresAt, T0 + 30 * DAY); assert.strictEqual(n.v, 2); assert.strictEqual(R.newRecord({ key: goodKey, salt: "s", token, now: T0, days: 1 }).expiresAt, T0 + DAY);
  assert.ok(!("password" in n), "no password in the record");

  // ── what is accepted ──
  assert.deepStrictEqual(R.check(rec(), T0), { ok: true });
  assert.strictEqual(R.check(rec({ expiresAt: T0 }), T0).reason, "expired", "ends exactly now: expired"); assert.strictEqual(R.check(rec({ expiresAt: T0 + 1 }), T0).ok, true, "a millisecond left is still valid");
  assert.strictEqual(R.check(rec({ v: 1 }), T0).reason, "version"); assert.strictEqual(R.check(null, T0).reason, "none"); assert.strictEqual(R.check("x", T0).reason, "none");
  assert.strictEqual(R.check(rec({ key: { type: "secret", extractable: true } }), T0).reason, "key", "a key whose bytes could be read is refused");
  assert.strictEqual(R.check(rec({ key: { type: "public", extractable: false } }), T0).reason, "key"); assert.strictEqual(R.check(rec({ key: null }), T0).reason, "key"); assert.strictEqual(R.check(rec({ key: "hunter2" }), T0).reason, "key", "a password string is not a key");
  assert.strictEqual(R.check(rec({ salt: "" }), T0).reason, "salt"); assert.strictEqual(R.check(rec({ salt: 5 }), T0).reason, "salt");
  assert.strictEqual(R.check(rec({ token: "abc" }), T0).reason, "token"); assert.strictEqual(R.check(rec({ token: "A".repeat(64) }), T0).reason, "token", "lower-case hex only"); assert.strictEqual(R.check(rec({ token: "a".repeat(65) }), T0).reason, "token");

  // ── the marker holds no secret ──
  const m = R.marker(rec()); assert.deepStrictEqual(m, { expiresAt: T0 + DAY, ok: true }); assert.ok(!JSON.stringify(m).includes(token), "the sync token is not in the marker");

  // ── save and load ──
  let s = mem();
  assert.deepStrictEqual(await R.save(s, rec(), T0), { expiresAt: T0 + DAY, ok: true }); assert.strictEqual((await R.load(s, T0)).token, token);
  await assert.rejects(() => R.save(mem(), rec({ key: { type: "secret", extractable: true } }), T0), /key/, "an extractable key is never stored");
  s = mem(); try { await R.save(s, rec({ expiresAt: T0 - 1 }), T0); } catch (e) { /* expected */ } assert.strictEqual(s.peek(), null, "nothing was stored");
  s = mem(); await R.save(s, rec(), T0); assert.strictEqual(await R.load(s, T0 + DAY), null, "an expired record is not returned"); assert.strictEqual(s.peek(), null, "…and is deleted");
  s = mem(); await s.put({ v: 1, password: "hunter2" }); assert.strictEqual(await R.load(s, T0), null); assert.strictEqual(s.peek(), null, "an old-format record is deleted");
  assert.strictEqual(await R.load(mem(), T0), null);
  assert.strictEqual(await R.load({ get: async () => { throw new Error("storage blocked"); }, del: async () => {} }, T0), null, "storage errors mean 'nothing remembered', not a crash");

  // ── converting an old plain-text record ──
  const derive = async (pw) => { assert.strictEqual(pw, "hunter2"); return { key: goodKey, salt: "c2FsdA==", token }; };
  let mig = await R.migrateLegacy(JSON.stringify({ expiresAt: T0 + 5 * DAY, password: "hunter2", ok: true }), derive, T0);
  assert.strictEqual(mig.password, "hunter2"); assert.strictEqual(mig.record.expiresAt, T0 + 5 * DAY, "the old end date is kept (no longer than before)"); assert.ok(!("password" in mig.record)); assert.deepStrictEqual(R.check(mig.record, T0), { ok: true });
  assert.strictEqual(await R.migrateLegacy(JSON.stringify({ expiresAt: T0, password: "hunter2" }), derive, T0), null, "an expired old record is dropped");
  assert.strictEqual(await R.migrateLegacy(JSON.stringify({ expiresAt: T0 + DAY }), derive, T0), null, "no password in it: nothing to convert");
  assert.strictEqual(await R.migrateLegacy("not json", derive, T0), null); assert.strictEqual(await R.migrateLegacy("null", derive, T0), null);
  console.log("remember-core: all checks passed");
})().catch((e) => { console.error(e); process.exit(1); });
