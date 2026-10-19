const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const V = require("../tools/version-lock.js");

// 1. The repository itself: every versioned file matches the lock (i.e. nothing changed without a version bump)
const issues = V.problems();
assert.deepStrictEqual(issues, [], "\n" + issues.join("\n"));

// 2. The rule itself, on made-up data
const lock = { "a.js": { version: "1.0.0", sha256: "aaa" }, "b.js": { version: "2.1.0", sha256: "bbb" } };
const same = { "a.js": { version: "1.0.0", sha256: "aaa" }, "b.js": { version: "2.1.0", sha256: "bbb" } };
assert.deepStrictEqual(V.problems(same, lock), [], "nothing changed → fine");
const changedNoBump = { ...same, "a.js": { version: "1.0.0", sha256: "different" } };
const p1 = V.problems(changedNoBump, lock);
assert.strictEqual(p1.length, 1); assert.ok(/a\.js CHANGED but its version is still 1\.0\.0/.test(p1[0]), "a changed file with the same version is the bug this guards against");
const bumped = { ...same, "a.js": { version: "1.0.1", sha256: "different" } };
const p2 = V.problems(bumped, lock);
assert.ok(p2.length === 1 && /stale/.test(p2[0]) && !/CHANGED but/.test(p2[0]), "a proper bump only asks for the lock to be refreshed");
assert.ok(V.problems({ ...same, "c.js": { version: "1.0.0", sha256: "ccc" } }, lock)[0].includes("not in version-lock.json"));
assert.ok(V.problems({ "a.js": same["a.js"] }, lock)[0].includes("no longer loaded"));
assert.ok(V.problems({ ...same, "x.js": { version: "1.0.0", missing: true } }, lock).some((p) => /does not exist/.test(p)));

// 3. The scanner reads real index.html references and ignores external URLs
const assets = V.currentAssets();
assert.ok(assets["app.js"] && /^\d+\.\d+\.\d+$/.test(assets["app.js"].version) && assets["app.js"].sha256.length === 64);
assert.ok(Object.keys(assets).every((f) => !/^https?:/.test(f)));
assert.ok(assets["holdings-integrity.js"] && assets["sync-engine.js"] && assets["layout.css"], "scripts and styles are both covered");
console.log("version-lock tests passed");
