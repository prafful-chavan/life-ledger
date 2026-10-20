// The tax engine against independent reference cases (official Budget/CBDT figures and statute arithmetic).
// Expected values live in tax-oracle.js and were written from the sources before the engine was run against them.
const assert = require("assert");
const O = require("../tax-oracle.js");
const { engine: E } = require("../tax-core.js");

const res = O.run(E);
assert.strictEqual(res.failed.length, 0, "reference cases failed:\n" + res.failed.map((f) => `  ${f.id} (${f.source}): expected ${f.expected}, engine ${f.got}`).join("\n"));
assert.ok(res.total >= 29, "the reference set is complete");
assert.ok(O.CASES.every((c) => c.source && c.ref && c.why && c.expected && Number.isFinite(c.expected.totalTax)), "every case names its source and its working");
assert.strictEqual(new Set(O.CASES.map((c) => c.id)).size, O.CASES.length, "case ids are unique");
console.log(`tax oracle: ${res.passed}/${res.total} reference cases pass (${O.CASES.filter((c) => c.source === "official").length} official)`);
