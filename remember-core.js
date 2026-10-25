/**
 * Life Ledger — "remember this device" rules (pure; storage is passed in).
 *
 * The master password is never kept on the device. What is kept, for at most 30 days, is the vault's encryption key as a
 * non-extractable browser key (it can be used by the page but its bytes can never be read out), the vault's salt, and the
 * sync token (which can fetch the encrypted vault but cannot open it). A small marker without any secret tells the page that
 * a remembered session exists.
 *
 * store = { get(): Promise<record|null>, put(record): Promise<void>, del(): Promise<void> }.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerRemember = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const VERSION = 2;
  const DAYS = 30;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const TOKEN = /^[0-9a-f]{64}$/;

  /** A record to keep: the key, the vault salt (base64) and the sync token, valid for `days` days from `now`. */
  function newRecord(o) {
    return { v: VERSION, expiresAt: o.now + (o.days || DAYS) * DAY_MS, key: o.key, salt: o.salt, token: o.token };
  }

  /** { ok: true } or { ok: false, reason } — an extractable key, an old format or an expired record is never accepted. */
  function check(rec, now) {
    if (!rec || typeof rec !== "object") return { ok: false, reason: "none" };
    if (rec.v !== VERSION) return { ok: false, reason: "version" };
    if (!(rec.expiresAt > now)) return { ok: false, reason: "expired" };
    const key = rec.key;
    if (!key || key.type !== "secret" || key.extractable !== false) return { ok: false, reason: "key" };
    if (typeof rec.salt !== "string" || !rec.salt) return { ok: false, reason: "salt" };
    if (typeof rec.token !== "string" || !TOKEN.test(rec.token)) return { ok: false, reason: "token" };
    return { ok: true };
  }

  /** What may sit in plain browser storage: only when it ends, never a secret. */
  const marker = (rec) => ({ expiresAt: rec.expiresAt, ok: true });

  /** Save a record (refuses one that would not pass `check`). */
  async function save(store, rec, now) {
    const c = check(rec, now);
    if (!c.ok) throw new Error("Refusing to remember this device: " + c.reason);
    await store.put(rec);
    return marker(rec);
  }

  /** The kept record if it is still good; an invalid or expired one is deleted and null returned. */
  async function load(store, now) {
    let rec = null;
    try { rec = await store.get(); } catch { return null; }
    if (!rec) return null;
    if (!check(rec, now).ok) { try { await store.del(); } catch { /* nothing more to do */ } return null; }
    return rec;
  }

  /**
   * Turn an old record (which held the password itself, in plain text) into a safe one. legacyRaw is the stored JSON;
   * derive(password) → { key, salt, token } derives the safe values. Returns { record, password } or null when the old record
   * is unreadable or expired. The caller deletes the old record either way.
   */
  async function migrateLegacy(legacyRaw, derive, now) {
    let old = null;
    try { old = JSON.parse(legacyRaw); } catch { return null; }
    if (!old || !old.password || !(old.expiresAt > now)) return null;
    const d = await derive(old.password);
    return { password: old.password, record: { v: VERSION, expiresAt: old.expiresAt, key: d.key, salt: d.salt, token: d.token } };
  }

  return { VERSION, DAYS, newRecord, check, marker, save, load, migrateLegacy };
});
