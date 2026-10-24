// A fund sale is counted as a sale however it is spelled. An import once wrote "REDEEM" where every calculation
// expected "REDEMPTION": Axis Large Cap's ₹1.5 lakh sale then counted as a purchase (+₹2.76 lakh net worth in the MCP).
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Tax = require("../tax-core.js");
const Health = require("../data-health.js");
const { normalizeTypes } = require("../mcp/server.js");

const rows = (sale) => [
  { id: "p1", fundName: "Axis Large Cap Fund Direct Growth", owner: "Me", transactionType: "PURCHASE", units: 1000, nav: 50, invested: 50000, purchaseDate: "2024-01-10", latestNav: 66 },
  { id: "p2", fundName: "Axis Large Cap Fund Direct Growth", owner: "Me", transactionType: "PURCHASE", units: 500, nav: 60, invested: 30000, purchaseDate: "2025-01-10", latestNav: 66 },
  { id: "r1", fundName: "Axis Large Cap Fund Direct Growth", owner: "Me", transactionType: sale, units: 600, nav: 70, invested: 42000, purchaseDate: "2026-08-06", latestNav: 66 },
];

// Data health rebuilds the value: 900 units left, at ₹66
for (const sale of ["REDEMPTION", "REDEEM", "redeem", "Redemption"]) {
  assert.strictEqual(Math.round(Health.mfValue(rows(sale))), 900 * 66, `Data health: "${sale}" is a sale`);
}

// Tax engine: the sale is realised (FIFO from the oldest lot) and only 900 units stay open
for (const sale of ["REDEMPTION", "REDEEM"]) {
  const { lots, realised } = Tax.gains.buildLots({ mutualFunds: rows(sale) });
  const open = lots.filter((l) => l.kind === "mf").reduce((t, l) => t + l.qty, 0);
  assert.strictEqual(Math.round(open), 900, `tax: "${sale}" leaves 900 units open`);
  assert.strictEqual(Math.round(realised.reduce((t, r) => t + r.qty, 0)), 600, `tax: "${sale}" realises 600 units`);
}

// MCP: every spelling of a sale becomes REDEMPTION before any tool runs; everything else is a purchase
const st = normalizeTypes({ mutualFunds: [{ transactionType: "REDEEM" }, { transactionType: "Sell" }, { transactionType: "SWITCH OUT" }, { transactionType: "" }, { transactionType: "SIP" }, { transactionType: "PURCHASE" }] });
assert.deepStrictEqual(st.mutualFunds.map((t) => t.transactionType), ["REDEMPTION", "REDEMPTION", "REDEMPTION", "PURCHASE", "PURCHASE", "PURCHASE"]);
assert.deepStrictEqual(normalizeTypes({}), {}, "no funds: nothing to do");

// The sheet importer writes the one spelling
const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
assert.ok(/transactionType: isRedeem \? "REDEMPTION" : "PURCHASE"/.test(app) && !/isRedeem \? "REDEEM"/.test(app), "the importer writes REDEMPTION");

console.log("redemption spelling tests passed");
