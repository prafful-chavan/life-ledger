const assert = require("assert");
const { parseGoodReturnsGold } = require("../app.js");

// Trimmed fixture of https://www.goodreturns.in/gold-rates/mumbai.html (11 Oct 2026)
const html = `
<script>
  let currentMetalPrices = {
    '24': 15142,
    '22': 13880,
    '18': 11357,
  };
</script>
<table><tbody class="tablebody">
  <tr><td>Oct 11, 2026</td><td>&#x20b9;15,142 <span class="non-span">(0)</span></td><td>&#x20b9;13,880 <span>(0)</span></td></tr>
  <tr><td>Oct 10, 2026</td><td>&#x20b9;15,142 <span class="green-span">(+71)</span></td><td>&#x20b9;13,880 <span>(+65)</span></td></tr>
  <tr><td>Oct 09, 2026</td><td>&#x20b9;15,071 <span class="green-span">(+114)</span></td><td>&#x20b9;13,815 <span>(+104)</span></td></tr>
</tbody></table>`;

let failed = 0;
function test(name, fn) {
  try { fn(); console.log("  ✅ PASS:", name); }
  catch (e) { failed++; console.log("  ❌ FAIL:", name, e); }
}

test("parses 24K/22K/18K per-gram rates from GoodReturns", () => {
  const r = parseGoodReturnsGold(html);
  assert.strictEqual(r.price24k, 15142);
  assert.strictEqual(r.price22k, 13880);
  assert.strictEqual(r.price18k, 11357);
});

test("previous close is the most recent different rate", () => {
  const r = parseGoodReturnsGold(html);
  assert.strictEqual(r.prevClose24k, 15071);
  assert.strictEqual(r.prevClose22k, 13815.08);
});

test("returns null for unrelated or empty HTML", () => {
  assert.strictEqual(parseGoodReturnsGold("<html></html>"), null);
  assert.strictEqual(parseGoodReturnsGold(""), null);
});

if (failed > 0) process.exit(1);
console.log("🎉 ALL GOLD GOODRETURNS TESTS PASSED");
