// The weekly view: weeks run Monday to Sunday, each starts from the last record before it, and the split into market, money put
// in and your own edits adds up to the week's change — and only appears when the running totals exist at both ends.
const assert = require("assert");
const W = require("../networth-weekly.js");

// ── weeks run Monday to Sunday ──
assert.strictEqual(W.mondayOf("2026-10-19"), "2026-10-19", "a Monday is its own Monday"); assert.strictEqual(W.mondayOf("2026-10-20"), "2026-10-19");
assert.strictEqual(W.mondayOf("2026-10-24"), "2026-10-19", "Saturday"); assert.strictEqual(W.mondayOf("2026-10-25"), "2026-10-19", "Sunday belongs to the week before"); assert.strictEqual(W.mondayOf("2026-10-26"), "2026-10-26");
assert.strictEqual(W.mondayOf("2027-01-01"), "2026-12-28", "across a year end"); assert.strictEqual(W.mondayOf("2024-02-29"), "2024-02-26", "a leap day");

// a record per day: net worth 1,000,000 + stocks drifting, cash 100,000
const rec = (date, o = {}) => ({ date, netWorth: 0, mutualFunds: 400000, stocks: 300000, usStocks: 100000, gold: 100000, fd: 100000, totalLiabilities: 0, fxRate: 90, ...o });
const withNw = (o) => { const r = rec(o.date, o); r.netWorth = o.netWorth != null && o.netWorth !== 0 ? o.netWorth : r.mutualFunds + r.stocks + r.usStocks + r.gold + r.fd + (r.bankSaving || 0) - r.totalLiabilities; return r; };
const tot = (m, s, u) => ({ mutualFunds: m, stocks: s, usStocksUsd: u });

// two weeks, both ends with running totals
const hist = [
  withNw({ date: "2026-10-16", contributed: tot(1000, 5000, 100) }),                                                                                        // Friday, the week before
  withNw({ date: "2026-10-19", contributed: tot(1000, 5000, 100), stocks: 301000 }),
  withNw({ date: "2026-10-23", contributed: tot(1000, 15000, 150), stocks: 318000, usStocks: 105000, fd: 90000 }),                                         // bought ₹10,000 of shares and $50 of US shares; ₹10,000 out of the FD
];
let w = W.weeks(hist);
assert.strictEqual(w.length, 1, "the Friday before is a week of one record: nothing to compare, so only one week is listed");
const cur = w[0];
assert.deepStrictEqual([cur.weekStart, cur.from, cur.to, cur.days, cur.split], ["2026-10-19", "2026-10-16", "2026-10-23", 2, true], "the week starts from the last record before its Monday");
assert.strictEqual(cur.change, (318000 + 105000 + 400000 + 100000 + 90000) - (300000 + 100000 + 400000 + 100000 + 100000), "net worth at the end minus the start");
assert.deepStrictEqual(cur.newMoneyByClass, { mutualFunds: 0, stocks: 10000, usStocks: 4500 }, "shares ₹10,000; US $50 at ₹90");
assert.strictEqual(cur.newMoney, 14500); assert.strictEqual(cur.edits, -10000, "the FD fell by ₹10,000"); assert.strictEqual(cur.market, cur.change - 14500 + 10000, "market is what is left");
assert.strictEqual(cur.market + cur.newMoney + cur.edits, cur.change, "the three parts add up to the change");

// a missing running total at either end: no split, but the change, your edits and market + money in together are still shown
for (const broken of [[{ ...hist[0], contributed: undefined }, hist[2]], [hist[0], { ...hist[2], contributed: undefined }]]) {
  w = W.weeks(broken); assert.strictEqual(w[0].split, false); assert.deepStrictEqual([w[0].market, w[0].newMoney, w[0].newMoneyByClass], [null, null, null], "nothing is guessed");
  assert.strictEqual(w[0].marketAndMoney, w[0].change - w[0].edits, "market and money in, together");
}

// edits: cash and other assets up, loans down are your edits (positive); loans up is negative
w = W.weeks([withNw({ date: "2026-10-16", totalLiabilities: 40000, fd: 100000, contributed: tot(0, 0, 0) }), withNw({ date: "2026-10-23", totalLiabilities: 0, fd: 100000, bankSaving: 5000, contributed: tot(0, 0, 0) })]);
assert.strictEqual(w[0].edits, 45000, "₹5,000 more cash and a ₹40,000 loan repaid"); assert.strictEqual(w[0].market, 0); assert.strictEqual(w[0].change, 45000);
w = W.weeks([withNw({ date: "2026-10-16", totalLiabilities: 0, contributed: tot(0, 0, 0) }), withNw({ date: "2026-10-23", totalLiabilities: 20000, contributed: tot(0, 0, 0) })]); assert.strictEqual(w[0].edits, -20000, "a loan taken: negative");
// the exchange rate for US money: this end's, else the other's, else none
const usPair = (fxEnd, fxStart) => W.weeks([withNw({ date: "2026-10-16", fxRate: fxStart, contributed: tot(0, 0, 100) }), withNw({ date: "2026-10-23", fxRate: fxEnd, usStocks: 100000, contributed: tot(0, 0, 200) })])[0];
assert.strictEqual(usPair(95, 90).newMoneyByClass.usStocks, 9500, "the later rate"); assert.strictEqual(usPair(undefined, 90).newMoneyByClass.usStocks, 9000, "the earlier rate when the later is missing"); assert.strictEqual(usPair(undefined, undefined).newMoneyByClass.usStocks, 0, "no rate known: no rupee figure is claimed");
// money taken out is negative
w = W.weeks([withNw({ date: "2026-10-16", contributed: tot(5000, 0, 0) }), withNw({ date: "2026-10-23", mutualFunds: 360000, contributed: tot(1000, 0, 0) })]); assert.strictEqual(w[0].newMoneyByClass.mutualFunds, -4000, "a sale: money out"); assert.strictEqual(w[0].market + w[0].newMoney + w[0].edits, w[0].change);

// records: one per day (the last given wins), invalid dates ignored, any order
w = W.weeks([withNw({ date: "2026-10-23", stocks: 999, contributed: tot(0, 0, 0) }), withNw({ date: "garbage" }), withNw({ date: "2026-10-23", stocks: 310000, contributed: tot(0, 0, 0) }), withNw({ date: "2026-10-16", contributed: tot(0, 0, 0) }), { date: undefined }, null]);
assert.strictEqual(w.length, 1); assert.strictEqual(w[0].change, 10000, "the later of two records for one day is used"); assert.strictEqual(w[0].days, 1);
assert.deepStrictEqual(W.weeks([]), []); assert.deepStrictEqual(W.weeks(null), []); assert.deepStrictEqual(W.weeks([withNw({ date: "2026-10-23" })]), [], "a single record: nothing to compare");
// the first week of a history starts at its own first record
w = W.weeks([withNw({ date: "2026-10-20", contributed: tot(0, 0, 0) }), withNw({ date: "2026-10-23", stocks: 310000, contributed: tot(0, 0, 0) })]); assert.deepStrictEqual([w[0].from, w[0].to, w[0].change], ["2026-10-20", "2026-10-23", 10000]);
// the weekend: a Sunday record belongs to the week before, a Monday record starts the next
w = W.weeks([withNw({ date: "2026-10-19", contributed: tot(0, 0, 0) }), withNw({ date: "2026-10-25", stocks: 305000, contributed: tot(0, 0, 0) }), withNw({ date: "2026-10-26", stocks: 307000, contributed: tot(0, 0, 0) })]);
assert.deepStrictEqual(w.map((x) => [x.weekStart, x.from, x.to, x.change]), [["2026-10-26", "2026-10-25", "2026-10-26", 2000], ["2026-10-19", "2026-10-19", "2026-10-25", 5000]], "newest first; each week starts from the last record before it");
// net worth missing: assets minus liabilities
w = W.weeks([{ date: "2026-10-16", totalAssets: 1000, totalLiabilities: 100, contributed: tot(0, 0, 0) }, { date: "2026-10-23", totalAssets: 1500, totalLiabilities: 100, contributed: tot(0, 0, 0) }]); assert.strictEqual(w[0].change, 500); assert.strictEqual(w[0].netWorth, 1400);
// the count of weeks
const long = []; for (let i = 0; i < 12; i++) { long.push(withNw({ date: new Date(Date.UTC(2026, 6, 6 + i * 7)).toISOString().slice(0, 10), stocks: 300000 + i * 1000, contributed: tot(0, 0, 0) })); }
assert.strictEqual(W.weeks(long).length, 8, "eight weeks by default"); assert.strictEqual(W.weeks(long, { count: 3 }).length, 3); assert.strictEqual(W.weeks(long, { count: 20 }).length, 11, "as many as there are");
assert.strictEqual(W.weeks(long)[0].weekStart > W.weeks(long)[1].weekStart, true, "newest first");

console.log("networth-weekly tests passed");
