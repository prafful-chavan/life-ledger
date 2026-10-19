/**
 * Shared by tests/version-lock.test.js and tools/update-version-lock.js.
 * index.html loads scripts and styles as  file?v=X.Y.Z  and the service worker caches them BY THAT URL, so a changed file
 * with an unchanged version is never picked up by devices that already have the old one. version-lock.json records each
 * file's version and content hash; the test fails if a file changed without its version being bumped.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const LOCK = path.join(ROOT, "version-lock.json");

function currentAssets() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const out = {};
  for (const m of html.matchAll(/(?:src|href)="([^"?#]+)\?v=([0-9][0-9.]*)"/g)) {
    const file = m[1];
    if (/^https?:|^\/\//.test(file)) continue;
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) { out[file] = { version: m[2], missing: true }; continue; }
    out[file] = { version: m[2], sha256: crypto.createHash("sha256").update(fs.readFileSync(full)).digest("hex") };
  }
  return out;
}
const readLock = () => (fs.existsSync(LOCK) ? JSON.parse(fs.readFileSync(LOCK, "utf8")) : {});

/** Returns a list of problems (empty = fine). */
function problems(current = currentAssets(), lock = readLock()) {
  const out = [];
  for (const [file, cur] of Object.entries(current)) {
    const prev = lock[file];
    if (cur.missing) { out.push(`${file} is loaded by index.html (?v=${cur.version}) but does not exist`); continue; }
    if (!prev) { out.push(`${file} is not in version-lock.json — run: node tools/update-version-lock.js`); continue; }
    if (prev.sha256 !== cur.sha256 && prev.version === cur.version) out.push(`${file} CHANGED but its version is still ${cur.version}. Devices that cached ?v=${cur.version} would never get the change. Bump ?v= in index.html, then run: node tools/update-version-lock.js`);
    else if (prev.sha256 !== cur.sha256 || prev.version !== cur.version) out.push(`${file} was updated (${prev.version} → ${cur.version}) but version-lock.json is stale — run: node tools/update-version-lock.js`);
  }
  for (const file of Object.keys(lock)) if (!current[file]) out.push(`${file} is in version-lock.json but no longer loaded by index.html — run: node tools/update-version-lock.js`);
  return out;
}

module.exports = { currentAssets, readLock, problems, LOCK };
