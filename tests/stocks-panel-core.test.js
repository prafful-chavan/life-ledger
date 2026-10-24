// The Indian and US stock panels' rules: which rows, one line per holding with its price and day change, and the totals.
const assert = require("assert");
const app = require("../app.js");
const S = require("../stocks-panel-core.js");

const num = app.toNumber;
const ind = (o = {}) => ({ num, isinInfo: () => null, exchangeTicker: (s) => s + ".NS", cache: {}, ...o });
const us = (cache = {}) => ({ num, cache });
const row = (o) => ({ owner: "Me", demat: "Zerodha", quantity: 10, avgPrice: 100, invested: 1000, currentPrice: 120, prevClose: 118, purchaseDate: "2026-10-01", ...o });

// ── which rows ──
const all = [row({ symbol: "A", owner: "Me", demat: "Upstox", purchaseDate: "2026-01-01" }), row({ symbol: "B", owner: "Wife", demat: "Groww", purchaseDate: "2026-03-01" }), row({ symbol: "C", owner: "Both", demat: "upstox", purchaseDate: "2026-02-01" }), row({ symbol: "D", owner: undefined, demat: "Zerodha", purchaseDate: "", date: "2026-05-01" }), row({ symbol: "E", demat: undefined, purchaseDate: "", date: "" })];
const names = (rows) => rows.map((r) => r.symbol).join("");
assert.strictEqual(names(S.panelRows(all, "Both", "All", app.matchHoldingsOwner)), "DBCAE", "everyone, newest first (the date field when there is no purchase date; no date last)");
assert.strictEqual(names(S.panelRows(all, "Me", "All", app.matchHoldingsOwner)), "DCAE", "Prafful's, joint ones, and rows with no owner (they are his)");
assert.strictEqual(names(S.panelRows(all, "Wife", "All", app.matchHoldingsOwner)), "BC", "Archana's and joint ones");
assert.strictEqual(names(S.panelRows(all, "Both", "UPSTOX", app.matchHoldingsOwner)), "CA", "one broker, whatever its case");
assert.strictEqual(names(S.panelRows(all, "Both", "Nobody", app.matchHoldingsOwner)), "", "no match: none"); assert.strictEqual(names(S.panelRows(all, "Me", "Upstox", app.matchHoldingsOwner)), "CA", "owner and broker together");
assert.deepStrictEqual(S.panelRows(null, "Me", "All", app.matchHoldingsOwner), []); const order = all.map((r) => r.symbol).join(""); S.panelRows(all, "Both", "All", app.matchHoldingsOwner); assert.strictEqual(all.map((r) => r.symbol).join(""), order, "not reordered in place");

// ── Indian holdings ──
let h = S.indianHoldings([row({ symbol: "TCS", company: "Tata Consultancy", quantity: 10, avgPrice: 100, invested: 1000, currentPrice: 120, prevClose: 118 })], ind())[0];
assert.deepStrictEqual([h.symbol, h.company, h.category, h.exchange, h.totalQty, h.avgPrice, h.totalInv, h.currentPrice, h.prevClose, h.currentValue, h.gain, h.demat], ["TCS", "Tata Consultancy", "Stock", "NSE", 10, 100, 1000, 120, 118, 1200, 200, "Zerodha"]);
assert.strictEqual(h.gainPct, 20); assert.strictEqual(h.dayChange, 20); assert.ok(Math.abs(h.dayChangePct - (2 / 118) * 100) < 1e-9);
// defaults and fallbacks
h = S.indianHoldings([{ owner: "Me", quantity: 5, avgPrice: 10 }], ind())[0]; assert.deepStrictEqual([h.symbol, h.company, h.category, h.demat, h.exchange], ["UNKNOWN", "UNKNOWN", "Stock", "-", "NSE"]); assert.strictEqual(h.totalInv, 50, "invested falls back to quantity × average"); assert.strictEqual(h.currentPrice, 10, "price falls back to what was paid"); assert.strictEqual(h.currentValue, 50);
h = S.indianHoldings([row({ symbol: "X", invested: 0, avgPrice: 0, quantity: 0, currentPrice: 0, currentValue: 77 })], ind())[0]; assert.strictEqual(h.currentValue, 77, "nothing held: the row's own value"); assert.strictEqual(h.gainPct, 0, "nothing invested: 0%");
h = S.indianHoldings([row({ symbol: "X", quantity: 0, invested: 0, avgPrice: 0, currentPrice: 0, currentValue: 0 })], ind())[0]; assert.strictEqual(h.currentValue, 0);
// price cache: the symbol, then the exchange ticker, then the row's original symbol
const cacheOf = (o) => ind({ cache: o });
h = S.indianHoldings([row({ symbol: "TCS", currentPrice: 0, prevClose: 0 })], cacheOf({ TCS: { price: 130, prevClose: 125 } }))[0]; assert.deepStrictEqual([h.currentPrice, h.prevClose, h.dayChange], [130, 125, 50]);
h = S.indianHoldings([row({ symbol: "TCS", currentPrice: 0, prevClose: 0 })], cacheOf({ "TCS.NS": { price: 131, prevClose: 126 } }))[0]; assert.strictEqual(h.currentPrice, 131, "exchange ticker");
h = S.indianHoldings([row({ symbol: "TCS", currentPrice: 0, prevClose: 0 })], cacheOf({ TCS: { price: 130, prevClose: 125 }, "TCS.NS": { price: 999 } }))[0]; assert.strictEqual(h.currentPrice, 130, "the plain symbol wins");
h = S.indianHoldings([row({ symbol: "TCS", currentPrice: 140, prevClose: 135 })], cacheOf({ TCS: { price: 130, prevClose: 125 } }))[0]; assert.deepStrictEqual([h.currentPrice, h.prevClose], [140, 135], "the row's own price and close win over the cache");
// day change without a previous close: the change the source reported
h = S.indianHoldings([row({ symbol: "TCS", currentPrice: 0, prevClose: 0 })], cacheOf({ TCS: { price: 130, change: 4, changePct: 3.2 } }))[0]; assert.deepStrictEqual([h.prevClose, h.dayChange, h.dayChangePct], [null, 40, 3.2], "reported change × quantity; reported percentage");
h = S.indianHoldings([row({ symbol: "TCS", currentPrice: 0, prevClose: 0 })], cacheOf({ TCS: { price: 130, change: 0, changePct: 0 } }))[0]; assert.deepStrictEqual([h.dayChange, h.dayChangePct], [0, 0], "a reported change of zero is a change of zero");
h = S.indianHoldings([row({ symbol: "TCS", currentPrice: 0, prevClose: 0 })], cacheOf({ TCS: { price: 130 } }))[0]; assert.deepStrictEqual([h.dayChange, h.dayChangePct], [null, null], "nothing reported: none");
h = S.indianHoldings([row({ symbol: "TCS", currentPrice: 0, prevClose: 0 })], cacheOf({ TCS: { price: 130, change: null, changePct: undefined } }))[0]; assert.strictEqual(h.dayChange, null);
// ISIN codes are shown under the symbol and company they resolve to
const info = { symbol: "NIFTYBEES", company: "Nippon India ETF Nifty 50 BeES", category: "ETF" };
const withIsin = (o) => S.indianHoldings([row(o)], ind({ isinInfo: (code) => (code === "INF204KB14I2" ? info : null) }))[0];
h = withIsin({ symbol: "INF204KB14I2", company: "INF204KB14I2" }); assert.deepStrictEqual([h.symbol, h.company, h.category], ["NIFTYBEES", "Nippon India ETF Nifty 50 BeES", "ETF"]);
h = withIsin({ symbol: "XYZ", company: "Some Name", isin: "INF204KB14I2" }); assert.deepStrictEqual([h.symbol, h.company], ["NIFTYBEES", "Some Name"], "an isin field resolves the symbol; a real company name is kept");
h = withIsin({ symbol: "XYZ", company: "XYZ", isin: "INF204KB14I2" }); assert.strictEqual(h.company, "Nippon India ETF Nifty 50 BeES", "a company that is just the old symbol is replaced");
h = withIsin({ symbol: "XYZ", company: "Stock", isin: "INF204KB14I2" }); assert.strictEqual(h.company, "Nippon India ETF Nifty 50 BeES", "so is the placeholder 'Stock'");
h = withIsin({ symbol: "INF999999999", company: "INF999999999" }); assert.deepStrictEqual([h.symbol, h.company], ["INF999999999", "INF999999999"], "an ISIN that does not resolve is left as it is");
h = withIsin({ symbol: "INF204KB14I2", company: "Nippon ETF", category: "Stock" }); assert.deepStrictEqual([h.symbol, h.company, h.category], ["NIFTYBEES", "Nippon ETF", "ETF"], "the ISIN's category is used");
h = withIsin({ symbol: "ABC", company: "ABC Ltd", isin: "not-an-isin" }); assert.strictEqual(h.symbol, "ABC", "a field that is not an ISIN does nothing");
h = withIsin({ symbol: "INE002A01018", company: "Reliance", isin: "INF204KB14I2" }); assert.strictEqual(h.symbol, "NIFTYBEES", "a valid isin field is the one looked up, even when the symbol is also an ISIN");

// ── US holdings ──
h = S.usHoldings([row({ symbol: "meta", company: "Meta", quantity: 2, avgPrice: 50, invested: 100, currentPrice: 60, prevClose: 59, demat: undefined })], us())[0];
assert.deepStrictEqual([h.symbol, h.company, h.totalQty, h.totalInv, h.currentPrice, h.currentValue, h.gain, h.dayChange, h.demat], ["meta", "Meta", 2, 100, 60, 120, 20, 2, "INDmoney"], "US rows default to INDmoney");
assert.ok(Math.abs(h.dayChangePct - (1 / 59) * 100) < 1e-9); assert.strictEqual(h.gainPct, 20);
h = S.usHoldings([{ quantity: 1, avgPrice: 5 }], us())[0]; assert.deepStrictEqual([h.symbol, h.company, h.demat, h.currentPrice, h.dayChange], ["UNKNOWN", "US Stock", "INDmoney", 5, null]);
const hit = (cache, symbol = "meta") => S.usHoldings([row({ symbol, currentPrice: 0, prevClose: 0 })], us(cache))[0].currentPrice;
assert.strictEqual(hit({ META: { price: 1 } }), 1, "ticker (upper-cased)"); assert.strictEqual(hit({ "NASDAQ:META": { price: 2 } }), 2); assert.strictEqual(hit({ "NYSE:META": { price: 3 } }), 3); assert.strictEqual(hit({ "NYSEARCA:META": { price: 4 } }), 4); assert.strictEqual(hit({ "META.US": { price: 5 } }), 5); assert.strictEqual(hit({ meta: { price: 6 } }), 6, "the lower-case ticker");
assert.strictEqual(hit({ META: { price: 1 }, "NASDAQ:META": { price: 2 } }), 1, "plain ticker first"); assert.strictEqual(hit({ "NASDAQ:META": { price: 2 }, "NYSE:META": { price: 3 } }), 2, "then NASDAQ"); assert.strictEqual(hit({ "NYSE:META": { price: 3 }, "NYSEARCA:META": { price: 4 } }), 3);
assert.strictEqual(hit({ META: { price: 7 } }, " meta "), 7, "the ticker is trimmed");
h = S.usHoldings([row({ symbol: "META", currentPrice: 0, prevClose: 0 })], us({ META: { price: 7, prevClose: 6 } }))[0]; assert.deepStrictEqual([h.prevClose, h.dayChange], [6, 10]);
// no previous close: the row's own day P&L (not zero)
h = S.usHoldings([row({ symbol: "META", prevClose: 0, dayPnl: 3.5 })], us())[0]; assert.deepStrictEqual([h.dayChange, h.dayChangePct], [3.5, null]);
h = S.usHoldings([row({ symbol: "META", prevClose: 0, dayPnl: 0 })], us())[0]; assert.strictEqual(h.dayChange, null, "a day P&L of zero is no information");
h = S.usHoldings([row({ symbol: "META", prevClose: 0 })], us())[0]; assert.strictEqual(h.dayChange, null);
h = S.usHoldings([row({ symbol: "META", quantity: 0, invested: 0, avgPrice: 0, currentPrice: 0, currentValue: 9 })], us())[0]; assert.strictEqual(h.currentValue, 9); assert.strictEqual(h.gainPct, 0);

// ── totals (held holdings only) ──
const lines = [
  { totalQty: 10, totalInv: 1000, currentValue: 1200, dayChange: 20 }, { totalQty: 5, totalInv: 500, currentValue: 450, dayChange: -10 },
  { totalQty: 0, totalInv: 300, currentValue: 0, dayChange: 99 }, { totalQty: 2, totalInv: 200, currentValue: 210, dayChange: null },
];
let sm = S.summary(lines);
assert.deepStrictEqual([sm.invested, sm.current, sm.count, sm.gain], [1700, 1860, 3, 160], "the sold-out line is left out of everything");
assert.ok(Math.abs(sm.gainPct - (160 / 1700) * 100) < 1e-9); assert.strictEqual(sm.oneDayChange, 10, "only held lines with a day change"); assert.strictEqual(sm.hasOneDay, true);
assert.ok(Math.abs(sm.oneDayPct - (10 / (1860 - 10)) * 100) < 1e-9, "percentage of yesterday's value");
sm = S.summary([{ totalQty: 3, totalInv: 90, currentValue: 100, dayChange: null }]); assert.deepStrictEqual([sm.hasOneDay, sm.oneDayChange, sm.oneDayPct], [false, 0, 0], "no day figures at all: none");
sm = S.summary([]); assert.deepStrictEqual([sm.invested, sm.current, sm.count, sm.gain, sm.gainPct, sm.oneDayPct], [0, 0, 0, 0, 0, 0]);
sm = S.summary([{ totalQty: 1, totalInv: 0, currentValue: 5, dayChange: 1 }]); assert.strictEqual(sm.gainPct, 0, "nothing invested: 0%");
sm = S.summary([{ totalQty: 1, totalInv: 10, currentValue: 10, dayChange: 10 }]); assert.strictEqual(sm.oneDayPct, 0, "a day that doubled the value: yesterday's value was 0, so no percentage");
sm = S.summary([{ totalQty: 1, totalInv: 10, currentValue: 10, dayChange: 0 }]); assert.deepStrictEqual([sm.hasOneDay, sm.oneDayPct], [true, 0], "a day change of zero counts as a day change");
sm = S.summary([{ totalQty: 1, totalInv: 10, currentValue: 11, dayChange: 1 }]); assert.ok(Math.abs(sm.oneDayPct - 10) < 1e-9, "+₹1 on ₹10 yesterday is +10%");
sm = S.summary([{ totalQty: 0.5, totalInv: 10, currentValue: 11, dayChange: 1 }]); assert.strictEqual(sm.count, 1, "half a share is held");
sm = S.summary([{ totalQty: -1, totalInv: 10, currentValue: 11, dayChange: 1 }]); assert.strictEqual(sm.count, 0, "a negative quantity is not held");

// ── limits found by the mutation test (both panels) ──
for (const [name, build] of [["Indian", (o) => S.indianHoldings([row(o)], ind())[0]], ["US", (o) => S.usHoldings([row(o)], us())[0]]]) {
  assert.strictEqual(build({ symbol: "Q", quantity: 0, currentPrice: 120, currentValue: 55, invested: 1000 }).currentValue, 55, `${name}: nothing held: the row's own value, not 0 × price`);
  assert.strictEqual(build({ symbol: "Q", quantity: 5, currentPrice: 0, avgPrice: 0, currentValue: 33, invested: 1000 }).currentValue, 33, `${name}: no price at all: the row's own value`);
  assert.strictEqual(build({ symbol: "Q", quantity: 1, currentPrice: 10, invested: 1000 }).currentValue, 10, `${name}: one share is held`);
  assert.strictEqual(build({ symbol: "Q", quantity: 5, currentPrice: 1, invested: 1000 }).currentValue, 5, `${name}: a ₹1 price is a price`);
  assert.ok(Math.abs(build({ symbol: "Q", quantity: 1, currentPrice: 1.5, invested: 0.5, avgPrice: 0.5 }).gainPct - 200) < 1e-9, `${name}: ₹0.50 invested still has a percentage`);
  assert.strictEqual(build({ symbol: "Q", quantity: 5, avgPrice: 10, invested: 0, currentPrice: 12 }).totalInv, 50, `${name}: invested falls back to quantity × average price`);
}
assert.strictEqual(S.usHoldings([row({ symbol: "Q", quantity: 3, currentPrice: 12, prevClose: 10 })], us())[0].dayChange, 6, "US: 3 shares × $2");
assert.strictEqual(S.indianHoldings([row({ symbol: "Q", quantity: 3, currentPrice: 12, prevClose: 10 })], ind())[0].dayChange, 6, "Indian: 3 shares × ₹2");
sm = S.summary([{ totalQty: 1, totalInv: 0.5, currentValue: 1.5, dayChange: 0.5 }]); assert.ok(Math.abs(sm.gainPct - 200) < 1e-9, "₹0.50 invested has a percentage"); assert.strictEqual(sm.oneDayPct, 50, "yesterday's value was ₹1: +₹0.50 is +50%");

console.log("stocks-panel-core tests passed");
