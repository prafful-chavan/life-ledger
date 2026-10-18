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

async function fetchState({ gatewayUrl, password, fetchImpl = fetch }) {
  const res = await fetchImpl(gatewayUrl, {
    method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, redirect: "follow",
    body: JSON.stringify({ op: "pull", token: await authToken(password), sinceRev: 0 }),
  });
  if (!res.ok) throw new Error("Gateway HTTP " + res.status);
  const j = await res.json();
  if (!j.ok) throw new Error(j.error === "unauthorized" ? "Wrong vault password (run setup again)" : j.error || "Gateway error");
  if (!j.vault) throw new Error("The vault is empty on the gateway");
  const inner = await decryptVault(j.vault, password);
  return { data: inner.data, rev: j.rev, updatedAt: j.updatedAt };
}

module.exports = { authToken, decryptVault, encryptVault, fetchState };
