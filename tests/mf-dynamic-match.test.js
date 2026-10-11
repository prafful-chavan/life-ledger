const assert = require("assert");
const { isConfidentMfMatch } = require("../app.js");

let failed = 0;
function test(name, fn) {
  try { fn(); console.log("  ✅ PASS:", name); }
  catch (e) { failed++; console.log("  ❌ FAIL:", name, e.message); }
}

test("accepts the same fund written differently (plan/option wording, spacing, cap words)", () => {
  assert.ok(isConfidentMfMatch("Nippon India Small Cap Fund Direct Growth", "Nippon India Small Cap Fund - Direct Plan - Growth Option"));
  assert.ok(isConfidentMfMatch("Kotak Flexicap Fund Direct Growth", "Kotak Flexi Cap Fund - Direct Plan - Growth"));
  assert.ok(isConfidentMfMatch("Parag Parikh ELSS Tax Saver Fund Direct Growth", "Parag Parikh ELSS Tax Saver Fund - Direct Plan - Growth"));
  assert.ok(isConfidentMfMatch("Mirae Asset Large Cap Fund", "Mirae Asset Large Cap Fund - Direct Plan - Growth"));
});

test("rejects different funds that merely share most words (the old fuzzy-match bugs)", () => {
  assert.strictEqual(isConfidentMfMatch("ICICI Prudential Nifty 50 Index Fund Direct Growth", "ICICI Prudential Nifty Next 50 Index Fund - Direct Plan - Growth"), false);
  assert.strictEqual(isConfidentMfMatch("Axis Bluechip Fund Direct Growth", "Axis Liquid Fund - Direct Plan - Growth Option"), false);
  assert.strictEqual(isConfidentMfMatch("Kotak Flexicap Fund Direct Growth", "Kotak Medium to Long Term Fund - Direct Plan - Growth"), false);
  assert.strictEqual(isConfidentMfMatch("HDFC Mid Cap Fund", "HDFC Large & Mid Cap Fund - Direct Plan - Growth Option"), false);
});

test("empty names never match", () => {
  assert.strictEqual(isConfidentMfMatch("", "Anything Fund"), false);
  assert.strictEqual(isConfidentMfMatch("Fund Direct Growth", "Fund Direct Growth"), false);
});

if (failed > 0) process.exit(1);
console.log("🎉 ALL MF DYNAMIC MATCH TESTS PASSED");
