/**
 * Life Ledger MCP — fetches and decrypts the household vault. Reads only, except updateField(), which may write the one
 * whitelisted summary field (holdingsCheck) and nothing else.
 * Same scheme as the app: a PBKDF2 token authorises the pull; the vault is AES-GCM (PBKDF2 250k) with optional gzip.
 * The password is supplied by the caller and is never written to disk or logged here.
 */
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const fs = require("node:fs");

const AUTH_SALT = "life-ledger/sync-auth/v1";

const pbkdf2 = (pw, salt, iter, len) => new Promise((res, rej) => crypto.pbkdf2(pw, salt, iter, len, "sha256", (e, k) => (e ? rej(e) : res(k))));

async function authToken(password) {
  return (await pbkdf2(password, AUTH_SALT, 100000, 32)).toString("hex");
}

/** Decrypt a vault object { salt, iv, ciphertext, compressed } into its inner JSON. */
async function decryptVault(vault, password) {
  const key = await pbkdf2(password, Buffer.from(vault.salt, "base64"), 250000, 32);
  const raw = Buffer.from(vault.ciphertext, "base64");
  const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(vault.iv, "base64"));
  d.setAuthTag(raw.subarray(raw.length - 16)); // WebCrypto appends the tag to the ciphertext
  let plain = Buffer.concat([d.update(raw.subarray(0, raw.length - 16)), d.final()]);
  if (vault.compressed) { try { plain = zlib.gunzipSync(plain); } catch { /* stored raw */ } }
  return JSON.parse(plain.toString("utf8"));
}

/** Builds a vault exactly the way the app does (the app keeps the vault's salt across saves; pass it to do the same). */
async function encryptVault(inner, password, { compress = true, salt: keepSalt } = {}) {
  const salt = keepSalt || crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const key = await pbkdf2(password, salt, 250000, 32);
  const json = Buffer.from(JSON.stringify(inner), "utf8");
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([c.update(compress ? zlib.gzipSync(json) : json), c.final(), c.getAuthTag()]);
  return { v: 1, salt: salt.toString("base64"), iv: iv.toString("base64"), ciphertext: body.toString("base64"), compressed: compress };
}

/** POST once, then follow Apps Script's redirect(s) with plain GETs (the result is served from the redirect target). */
async function postFollow(url, body, fetchImpl) {
  let res = await fetchImpl(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, redirect: "manual", body });
  for (let hop = 0; hop < 5 && res.status >= 300 && res.status < 400 && res.headers.get("location"); hop++) {
    res = await fetchImpl(new URL(res.headers.get("location"), url).toString(), { method: "GET", redirect: "manual" });
  }
  return res;
}

/** One pull attempt. Throws {retry:true} errors for the transient failures Apps Script produces now and then. */
async function pullOnce({ gatewayUrl, password, fetchImpl }) {
  const res = await postFollow(gatewayUrl, JSON.stringify({ op: "pull", token: await authToken(password), sinceRev: 0 }), fetchImpl);
  if (!res.ok) throw Object.assign(new Error("Gateway HTTP " + res.status), { retry: true });
  const text = await res.text();
  let j;
  try { j = JSON.parse(text); } catch { throw Object.assign(new Error("Gateway sent a non-JSON reply: " + text.slice(0, 120).replace(/\s+/g, " ")), { retry: true }); }
  if (!j.ok) {
    if (j.error === "unauthorized") throw new Error("Wrong vault password (run setup again)");
    throw Object.assign(new Error(`${j.error || "Gateway error"} [HTTP ${res.status}, ${text.length} bytes]`), { retry: true });
  }
  if (!j.vault) throw new Error("The vault is empty on the gateway");
  const inner = await decryptVault(j.vault, password);
  return { data: inner.data, rev: j.rev, updatedAt: j.updatedAt, vault: j.vault };
}

/** The last good vault, kept as the ENCRYPTED blob the gateway sent (so nothing readable is ever written to disk). */
function writeCache(file, got, now) {
  try {
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify({ savedAt: new Date(now).toISOString(), rev: got.rev, updatedAt: got.updatedAt, vault: got.vault }), { mode: 0o600 });
    fs.renameSync(tmp, file);
  } catch { /* a cache that cannot be written must never break a read */ }
}

/** Pulls and decrypts the vault, retrying transient gateway failures (read-only, so a retry is always safe). */
async function fetchState({ gatewayUrl, password, fetchImpl = fetch, attempts = 4, waitMs = 1500, cacheFile, now = Date.now() }) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const got = await pullOnce({ gatewayUrl, password, fetchImpl });
      if (cacheFile) writeCache(cacheFile, got, now);
      return got;
    } catch (e) {
      last = e;
      if (!e.retry && !(e.name === "TypeError" || e.name === "AbortError")) throw e; // wrong password etc: no point retrying
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, waitMs * (i + 1)));
    }
  }
  // The gateway never answered properly. A saved copy lets the morning brief still run, clearly marked as older.
  if (cacheFile && fs.existsSync(cacheFile)) {
    try {
      const saved = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
      const inner = await decryptVault(saved.vault, password);
      return { data: inner.data, rev: saved.rev, updatedAt: saved.updatedAt, fromCache: true, cachedAt: saved.savedAt, reason: last.message };
    } catch { /* an unreadable cache is no better than none */ }
  }
  throw new Error(`${last.message} (after ${attempts} attempts)`);
}

/**
 * Writes ONE top-level object field into the vault the way an app save would: pull the latest vault, set the field,
 * stamp it with the app's own sync engine (newest stamp wins when devices merge), re-encrypt with the vault's existing
 * salt, and push guarded by the revision that was read (compare-and-swap). A conflict means another device saved in
 * between: read again and retry. Only `allowed` fields can be written, so this can never touch the household's records.
 */
const WRITABLE = new Set(["holdingsCheck"]);
const ENTRY_KEYS = ["income", "expenses", "assets", "liabilities", "mutualFunds", "stocks", "fd", "epf", "bonds", "ppf", "gold", "silver", "crypto", "usstocks", "banksaving", "others", "goals", "tasks", "studies", "workouts", "habits"];
const countEntries = (data) => ENTRY_KEYS.reduce((t, k) => t + (Array.isArray(data && data[k]) ? data[k].length : 0), 0);

async function updateField({ gatewayUrl, password, field, value, fetchImpl = fetch, now = Date.now(), attempts = 3 }) {
  if (!WRITABLE.has(field)) throw new Error(`Writing "${field}" is not allowed from here`);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The value must be an object");
  const Engine = require("../sync-engine.js");
  const token = await authToken(password);
  // Apps Script now and then answers with a page that is not the reply; ask again (a repeated push is refused as a
  // conflict, so a retry can never apply a change twice)
  const call = async (body) => {
    let last;
    for (let t = 0; t < 4; t++) {
      try {
        const res = await postFollow(gatewayUrl, JSON.stringify(body), fetchImpl);
        const j = JSON.parse(await res.text());
        if (j.ok || j.error === "unauthorized") return j;
        last = new Error(j.error || "Gateway error");
      } catch (e) { last = e; }
      await new Promise((r) => setTimeout(r, 1500 * (t + 1)));
    }
    throw new Error(`Gateway did not answer properly: ${last && last.message}`);
  };
  for (let i = 0; i < attempts; i++) {
    const j = await call({ op: "pull", token, sinceRev: 0 });
    if (!j.ok || !j.vault) throw new Error(j.error || "Could not read the vault");
    const inner = await decryptVault(j.vault, password);
    const before = inner.data || {};
    const after = { ...before, [field]: value };
    const meta = Engine.stamp(before, after, inner.sync || Engine.emptyMeta(), now);
    const nextInner = { ...inner, data: after, sync: meta };
    const sealed = await encryptVault(nextInner, password, { compress: !!j.vault.compressed, salt: Buffer.from(j.vault.salt, "base64") });
    const vault = { ...sealed, updatedAt: new Date(now).toISOString(), entryCount: countEntries(after) };
    if (countEntries(after) !== countEntries(before)) throw new Error("Refusing to push: the record count changed");
    const pr = await call({ op: "push", token, baseRev: j.rev || 0, vault });
    if (pr.ok && !pr.conflict) return { rev: pr.rev, attempts: i + 1 };
    if (!pr.ok) throw new Error(pr.error || "Push failed");
  }
  throw new Error(`Another device kept saving; gave up after ${attempts} tries`);
}

module.exports = { authToken, decryptVault, encryptVault, fetchState, updateField, countEntries };
