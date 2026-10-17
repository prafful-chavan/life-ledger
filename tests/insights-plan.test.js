const assert = require("assert");
const app = require("../app.js");
const P = app.insightsPlan;
const H = 3600 * 1000;
const now = 1_000_000_000_000;

// Nothing stored yet → ask once
assert.strictEqual(P(now, null, 0), "fetch");
// Recent insights are reused (no network call)
assert.strictEqual(P(now, { at: now - 1 * H, text: "x" }, 0), "cache");
assert.strictEqual(P(now, { at: now - 5.9 * H, text: "x" }, 0), "cache");
// Older than six hours → ask again
assert.strictEqual(P(now, { at: now - 6.1 * H, text: "x" }, 0), "fetch");
// Paused after an error/quota message: show what we have, or nothing — never ask
assert.strictEqual(P(now, { at: now - 7 * H, text: "x" }, now + H), "stale");
assert.strictEqual(P(now, null, now + H), "skip");
// The pause ends
assert.strictEqual(P(now, { at: now - 7 * H, text: "x" }, now - 1), "fetch");
// A cache with no text, or junk, never counts as fresh
assert.strictEqual(P(now, { at: now, text: "" }, 0), "fetch");
assert.strictEqual(P(now, { text: "x" }, 0), "fetch");
assert.strictEqual(P(now, undefined, undefined), "fetch");
console.log("insights-plan tests passed");
