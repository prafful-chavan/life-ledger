const assert = require("assert");
const { computeDeltas } = require("../networth-delta.js");

// Numbers taken from a real 3-day sequence (rounded): net worth fell slightly each day
// even though the market-move figure was positive.
const h = [
  { id: "a", date: "2026-10-11", netWorth: 13278997.14, totalAssets: 13419461.14, totalLiabilities: 140464, mutualFunds: 4340153.44, stocks: 1542825.24, usStocks: 198809.42, gold: 2405017.04, others: 4932656 },
  { id: "b", date: "2026-10-12", netWorth: 13266664.28, totalAssets: 13407128.28, totalLiabilities: 140464, mutualFunds: 4340153.44, stocks: 1537482.06, usStocks: 198809.42, gold: 2398027.36, others: 4932656 },
  { id: "c", date: "2026-10-13", netWorth: 13253527.64, totalAssets: 13393991.64, totalLiabilities: 140464, mutualFunds: 4341192.14, stocks: 1551780.31, usStocks: 197177.1, gold: 2371186.09, others: 4932656 },
];
// Order of input must not matter
const d = computeDeltas([h[2], h[0], h[1]]);
assert.strictEqual(d.has("a"), false, "first snapshot has nothing to compare with");
assert.strictEqual(d.get("b").change, -12332.86);
assert.strictEqual(d.get("c").change, -13136.64);
assert.strictEqual(d.get("b").prevDate, "2026-10-11");
assert.strictEqual(d.get("b").gapDays, 1);
assert.ok(d.get("b").pct < 0);
assert.strictEqual(d.get("c").parts.mutualFunds, 1038.7);
assert.strictEqual(d.get("c").parts.gold, -26841.27);

// The parts explain the whole change when nothing else moved
const sum = (p) => Object.values(p).reduce((s, v) => s + v, 0);
assert.ok(Math.abs(sum(d.get("c").parts) - d.get("c").change) < 0.05);

// Liabilities rising lowers net worth; gaps are reported
const g = computeDeltas([
  { date: "2026-10-01", netWorth: 100, totalLiabilities: 10 },
  { date: "2026-10-04", netWorth: 90, totalLiabilities: 20 },
]);
const e = g.get("2026-10-04");
assert.strictEqual(e.change, -10);
assert.strictEqual(e.parts.liabilities, -10);
assert.strictEqual(e.gapDays, 3);

// compare() is the single comparison used for the live "today vs yesterday" figure too
const { compare } = require("../networth-delta.js");
const cmp = compare(h[1], h[2]);
assert.strictEqual(cmp.change, d.get("c").change);
assert.deepStrictEqual(cmp.parts, d.get("c").parts);

// ── Market vs new money vs your edits: always adds up to the change ──
const N = require("../networth-delta.js");
const snap = (o) => ({ date: "2026-10-23", netWorth: 0, mutualFunds: 0, stocks: 0, usStocks: 0, gold: 0, fd: 0, bankSaving: 0, totalLiabilities: 0, fxRate: 90, ...o });
const nwOf = (s) => s.mutualFunds + s.stocks + s.usStocks + s.gold + s.fd + s.bankSaving - s.totalLiabilities;
const pair = (a, b) => { const p = snap(a), q = snap({ date: "2026-10-24", ...b }); p.netWorth = nwOf(p); q.netWorth = nwOf(q); return N.compare(p, q); };
const addsUp = (r) => Math.abs(r.split.market + r.split.newMoney + r.split.edits - r.change) < 0.01;

// Bought ₹9,912 of a gold ETF on a day the market took ₹27,677 off shares (the 24 Oct case)
let r = pair({ stocks: 1513567, contributed: { mutualFunds: 0, stocks: 1000000, usStocksUsd: 0 } }, { stocks: 1495802, contributed: { mutualFunds: 0, stocks: 1009912, usStocksUsd: 0 } });
assert.deepStrictEqual([r.split.newMoney, r.split.market, r.split.edits, r.split.exact], [9912, -27677, 0, true]); assert.ok(addsUp(r));
// A fund sale: the proceeds leave as money taken out, the market part is whatever the price did
r = pair({ mutualFunds: 800000, contributed: { mutualFunds: 600000, stocks: 0, usStocksUsd: 0 } }, { mutualFunds: 649000, contributed: { mutualFunds: 450000, stocks: 0, usStocksUsd: 0 } });
assert.deepStrictEqual([r.split.newMoney, r.split.market], [-150000, -1000]); assert.ok(addsUp(r));
// US shares: dollars put in, at today's rate; a pure exchange-rate move is market
r = pair({ usStocks: 90000, contributed: { mutualFunds: 0, stocks: 0, usStocksUsd: 800 } }, { usStocks: 99000, fxRate: 90, contributed: { mutualFunds: 0, stocks: 0, usStocksUsd: 900 } });
assert.deepStrictEqual([r.split.newMoneyByClass.usStocks, r.split.market], [9000, 0]);
r = pair({ usStocks: 90000, fxRate: 90, contributed: { mutualFunds: 0, stocks: 0, usStocksUsd: 800 } }, { usStocks: 91000, fxRate: 91, contributed: { mutualFunds: 0, stocks: 0, usStocksUsd: 800 } });
assert.deepStrictEqual([r.split.newMoney, r.split.market], [0, 1000]);
// Your own edits (FD added, loan repaid) are neither market nor new money
r = pair({ fd: 100000, totalLiabilities: 40000, contributed: { mutualFunds: 0, stocks: 0, usStocksUsd: 0 } }, { fd: 150000, totalLiabilities: 0, contributed: { mutualFunds: 0, stocks: 0, usStocksUsd: 0 } });
assert.deepStrictEqual([r.split.edits, r.split.market, r.split.newMoney], [90000, 0, 0]); assert.ok(addsUp(r));
// An older snapshot without `contributed`: estimated from the day's recorded price move, and marked as an estimate
r = pair({ stocks: 1513567 }, { stocks: 1495802, changes: { stocks: -27396 }, contributed: { mutualFunds: 0, stocks: 1, usStocksUsd: 0 } });
assert.deepStrictEqual([r.split.newMoney, r.split.exact], [9631, false]); assert.ok(addsUp(r));
// …a small gap is price timing, not money (₹1,000 or 0.3% of the class, whichever is larger)
r = pair({ stocks: 1500000 }, { stocks: 1499000, changes: { stocks: -1500 } });
assert.strictEqual(r.split.newMoney, 0, "₹500 unexplained on ₹15 lakh is timing");
r = pair({ stocks: 100000 }, { stocks: 103000, changes: { stocks: 0 } });
assert.strictEqual(r.split.newMoney, 3000, "₹3,000 on ₹1 lakh is money");
// contributions(): purchases minus sale proceeds, any spelling of a sale, falling back to units × price
assert.deepStrictEqual(N.contributions({
  mutualFunds: [{ transactionType: "PURCHASE", invested: 1000 }, { transactionType: "REDEEM", invested: 300 }, { transactionType: "REDEMPTION", invested: 200 }, { units: 10, nav: 5 }],
  stocks: [{ quantity: 2, invested: 500 }, { transactionType: "SELL", invested: 100 }, { quantity: 3, avgPrice: 10 }],
  usstocks: [{ quantity: 1, invested: 50 }, { transactionType: "S", invested: 20 }],
}), { mutualFunds: 550, stocks: 430, usStocksUsd: 30 });
assert.deepStrictEqual(N.contributions(null), { mutualFunds: 0, stocks: 0, usStocksUsd: 0 });
// ── an older record with no running total: money put in is worked out from the purchase dates ──
const rowsDated = { mutualFunds: [{ transactionType: "PURCHASE", invested: 1000, purchaseDate: "2026-10-20" }, { transactionType: "PURCHASE", invested: 500, purchaseDate: "2026-10-23" }, { transactionType: "PURCHASE", invested: 300, purchaseDate: "2026-10-24" }, { transactionType: "REDEEM", invested: 200, purchaseDate: "2026-10-24" }, { transactionType: "PURCHASE", invested: 50 }],
  stocks: [{ quantity: 1, invested: 700, date: "2026-10-23" }, { quantity: 1, invested: 900, date: "2026-10-25" }], usstocks: [{ quantity: 1, invested: 10, purchaseDate: "2026-10-24" }] };
assert.deepStrictEqual(N.contributions(rowsDated), { mutualFunds: 1650, stocks: 1600, usStocksUsd: 10 }, "everything so far");
assert.deepStrictEqual(N.contributions(rowsDated, "2026-10-23"), { mutualFunds: 1550, stocks: undefined, usStocksUsd: 0 }, "by the end of 23 Oct: later purchases and sales excluded; a row with no date is always counted; Indian shares are left out (their rows carry the import day, not the buy day)");
assert.deepStrictEqual(N.contributions(rowsDated, "2026-10-24"), { mutualFunds: 1650, stocks: undefined, usStocksUsd: 10 }, "a row dated that very day counts");
assert.deepStrictEqual(N.contributions(rowsDated, "2026-10-19"), { mutualFunds: 50, stocks: undefined, usStocksUsd: 0 }); assert.deepStrictEqual(N.contributions(rowsDated, ""), N.contributions(rowsDated), "no date given: all");
// the 24 Oct case: yesterday's record has no running total, so a share price that merely moved is not mistaken for money
// mutual funds from their dates; Indian shares (import-day dates) still from the price-timing estimate
r = pair({ mutualFunds: 400000, stocks: 1513567 }, { mutualFunds: 410000, stocks: 1495802, changes: { stocks: -27396, mutualFunds: 5000 }, contributed: { mutualFunds: 3000, stocks: 1434063, usStocksUsd: 0 }, contributedAtPrev: { mutualFunds: 1000, usStocksUsd: 0 } });
assert.deepStrictEqual([r.split.newMoneyByClass.mutualFunds, r.split.newMoneyByClass.stocks, r.split.exact], [2000, 9631, false], "funds: the ₹2,000 bought since (not the ₹5,000 the NAV moved); shares: estimated"); assert.ok(addsUp(r));
r = pair({ mutualFunds: 400000 }, { mutualFunds: 405000, changes: { mutualFunds: 5000 }, contributed: { mutualFunds: 1000, stocks: 0, usStocksUsd: 0 }, contributedAtPrev: { mutualFunds: 1000, usStocksUsd: 0 } }); assert.strictEqual(r.split.newMoney, 0, "nothing bought: all of the move is the market's");
r = pair({ usStocks: 90000 }, { usStocks: 90494, changes: { usStocks: -1155 }, fxRate: 90, contributed: { mutualFunds: 0, stocks: 0, usStocksUsd: 800 }, contributedAtPrev: { mutualFunds: 0, stocks: 0, usStocksUsd: 800 } });
assert.strictEqual(r.split.newMoney, 0, "no purchases since: the estimate that read a price move as money is not used"); assert.strictEqual(r.split.market, 494, "all of it is market");
// a previous record that does have a running total wins over the dates, and is exact
r = pair({ stocks: 1000 }, { stocks: 1600, contributed: { mutualFunds: 0, stocks: 500, usStocksUsd: 0 }, contributedAtPrev: { mutualFunds: 0, stocks: 100, usStocksUsd: 0 } });
const exactPrev = N.compare({ ...snap({ stocks: 1000, netWorth: 1000 }), contributed: { mutualFunds: 0, stocks: 100, usStocksUsd: 0 } }, { ...snap({ date: "2026-10-24", stocks: 1600, netWorth: 1600 }), contributed: { mutualFunds: 0, stocks: 500, usStocksUsd: 0 }, contributedAtPrev: { mutualFunds: 0, stocks: 0, usStocksUsd: 0 } });
assert.deepStrictEqual([exactPrev.split.newMoney, exactPrev.split.exact], [400, true]);

// ── limits: exchange rate missing, the estimate's threshold, the percentage ──
r = pair({ usStocks: 90000, fxRate: 0 }, { usStocks: 99000, fxRate: 0, contributed: { mutualFunds: 0, stocks: 0, usStocksUsd: 900 }, contributedAtPrev: { mutualFunds: 0, stocks: 0, usStocksUsd: 800 } });
assert.strictEqual(r.split.newMoneyByClass.usStocks, 0, "no exchange rate known: dollars cannot be turned into rupees, so none is claimed");
r = pair({ stocks: 100000 }, { stocks: 101000, changes: { stocks: 0 } }); assert.strictEqual(r.split.newMoney, 1000, "exactly ₹1,000 unexplained on a ₹1 lakh class: money");
r = pair({ stocks: 100000 }, { stocks: 100999, changes: { stocks: 0 } }); assert.strictEqual(r.split.newMoney, 0, "₹999: price timing");
r = pair({ stocks: 1000000 }, { stocks: 1004000, changes: { stocks: 0 } }); assert.strictEqual(r.split.newMoney, 4000, "₹4,000 on ₹10 lakh is above 0.3% (₹3,012): counts"); r = pair({ stocks: 1000000 }, { stocks: 1002990, changes: { stocks: 0 } }); assert.strictEqual(r.split.newMoney, 0, "₹2,990 is under 0.3% (₹3,009): not");
r = pair({ stocks: 200 }, { stocks: 1100, changes: { stocks: 0 } }); assert.strictEqual(r.split.newMoney, 0, "a small class never counts less than ₹1,000 as money (₹900 on ₹1,100)");
assert.strictEqual(pair({ stocks: 200 }, { stocks: 1200, changes: { stocks: 0 } }).split.newMoney, 1000, "₹1,000 on ₹1,200: money");
assert.strictEqual(pair({ stocks: 20000 }, { stocks: 22000 }).pct, 10, "the percentage is of the previous net worth"); assert.strictEqual(N.compare({ date: "a", netWorth: 0 }, { date: "b", netWorth: 50 }).pct, 0, "no previous net worth: 0%");

console.log("networth-delta tests passed");
