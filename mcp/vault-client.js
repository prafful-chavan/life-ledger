/**
 * Life Ledger MCP — fetches and decrypts the household vault (read-only).
 * Same scheme as the app: a PBKDF2 token authorises the pull; the vault is AES-GCM (PBKDF2 250k) with optional gzip.
 * The password is supplied by the caller and is never written to disk or logged here.
 */
const crypto = require("node:crypto");
const zlib = require("node:zlib");

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

/** Test helper: builds a vault exactly the way the app does. */
async function encryptVault(inner, password, { compress = true } = {}) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
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
  return { data: inner.data, rev: j.rev, updatedAt: j.updatedAt };
}

/** Pulls and decrypts the vault, retrying transient gateway failures (read-only, so a retry is always safe). */
async function fetchState({ gatewayUrl, password, fetchImpl = fetch, attempts = 4, waitMs = 1500 }) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try { return await pullOnce({ gatewayUrl, password, fetchImpl }); }
    catch (e) {
      last = e;
      if (!e.retry && !(e.name === "TypeError" || e.name === "AbortError")) throw e; // wrong password etc: no point retrying
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, waitMs * (i + 1)));
    }
  }
  throw new Error(`${last.message} (after ${attempts} attempts)`);
}

module.exports = { authToken, decryptVault, encryptVault, fetchState };
