const assert = require("assert");
const fs = require("fs");
const path = require("path");

// Load the real normaliser out of app.js (it is a plain function) so this test guards the shipped code.
const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const m = src.match(/function normalizeNetWorthHistoryEntry\(entry\) \{[\s\S]*?\n\}\n/);
assert.ok(m, "normalizeNetWorthHistoryEntry found in app.js");
const toNumber = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const generateUUID = () => "u";
const todayISO = () => "2026-10-15";
const normalize = new Function("toNumber", "generateUUID", "todayISO", m[0] + "; return normalizeNetWorthHistoryEntry;")(toNumber, generateUUID, todayISO);

const audit = { method: "official-close-v1", at: "2026-10-15T05:00:00Z", closes: { stocks: "2026-10-14" }, capturedBefore: { stocks: 1542825 }, estimated: ["Indian stocks: TRIL"] };
const row = normalize({ id: "a", date: "2026-10-14", netWorth: 1, final: true, settled: { stocks: true }, audit, mystery: "dropped" });
assert.deepStrictEqual(row.audit, audit, "the audit trail survives normalisation");
assert.strictEqual(row.final, true);
assert.strictEqual(row.mystery, undefined, "unknown fields are still dropped");
assert.ok(!("audit" in normalize({ id: "b", date: "2026-10-13" })), "rows without an audit don't gain one");
assert.ok(!("audit" in normalize({ id: "c", date: "2026-10-13", audit: "nope" })), "a malformed audit is ignored");
// normalising twice changes nothing (it runs on every load and sync)
assert.deepStrictEqual(normalize(row), row);

console.log("networth-audit tests passed");
