// Net worth maths, written from what each function must do (added where the mutation test found the earlier tests
// would not notice a break). Values are chosen so that every class, sign and boundary shows in the result.
const assert = require("assert");
const D = require("../networth-delta.js");
const C = require("../networth-close.js");

// ── Day-over-day change ──
assert.strictEqual(D.cashOthers({ fd: 1, epf: 10, ppf: 100, bonds: 1000, bankSaving: 10000, others: 100000, silver: 1e6, crypto: 1e7 }), 11111111, "every savings class counted once, with a plus sign");
assert.strictEqual(D.netWorthOf({ totalAssets: 500, totalLiabilities: 200 }), 300, "assets − liabilities when no net worth is stored");
assert.strictEqual(D.netWorthOf({ netWorth: 42, totalAssets: 500, totalLiabilities: 200 }), 42, "the stored figure wins");
{
  const prev = { date: "2026-10-17", netWorth: 200000, mutualFunds: 100, stocks: 200, usStocks: 300, gold: 400, fd: 1000, totalLiabilities: 50 };
  const cur = { date: "2026-10-20", netWorth: 190000, mutualFunds: 150, stocks: 100, usStocks: 300, gold: 700, fd: 900, totalLiabilities: 40 };
  const c = D.compare(prev, cur);
  assert.deepStrictEqual([c.change, c.pct, c.prevDate, c.gapDays], [-10000, -5, "2026-10-17", 3], "−₹10,000 is −5%, three days after Friday");
  assert.deepStrictEqual(c.parts, { mutualFunds: 50, stocks: -100, usStocks: 0, gold: 300, cashOthers: -100, liabilities: 10 }, "what moved; a smaller loan raises net worth");
  assert.strictEqual(D.compare({ date: "2026-10-19", netWorth: 0 }, { date: "2026-10-20", netWorth: 100 }).pct, 0, "no percentage against zero");
  assert.strictEqual(D.compare({ date: "2026-10-19", netWorth: -1000 }, { date: "2026-10-20", netWorth: -900 }).pct, 10, "an improvement from a negative net worth is positive");
}
{
  const h = [{ id: "c", date: "2026-10-20", netWorth: 30 }, { id: "a", date: "2026-10-18", netWorth: 10 }, { id: "b", date: "2026-10-19", netWorth: 15 }];
  const m = D.computeDeltas(h);
  assert.deepStrictEqual([m.size, m.has("a"), m.get("b").change, m.get("c").change, m.get("c").prevDate], [2, false, 5, 15, "2026-10-19"], "sorted by date; each day against the one before; the oldest has none");
}

// ── The close on or before a date ──
{
  const s = { dates: ["2026-10-14", "2026-10-15", "2026-10-16"], closes: [10, 11, 12] };
  assert.deepStrictEqual(C.closeOnOrBefore(s, "2026-10-18"), { value: 12, date: "2026-10-16", prevValue: 11 }, "a Sunday uses Friday's close");
  assert.deepStrictEqual(C.closeOnOrBefore(s, "2026-10-15"), { value: 11, date: "2026-10-15", prevValue: 10 }, "on a trading day, that day's close");
  assert.deepStrictEqual(C.closeOnOrBefore(s, "2026-10-14"), { value: 10, date: "2026-10-14", prevValue: null }, "the first close has no previous");
  assert.strictEqual(C.closeOnOrBefore(s, "2026-10-13"), null, "before the series starts: nothing");
  assert.deepStrictEqual(C.closeOnOrBefore({ dates: ["2026-10-14"], closes: [7] }, "2026-10-20"), { value: 7, date: "2026-10-14", prevValue: null });
  assert.strictEqual(C.closeOnOrBefore({ dates: [], closes: [] }, "2026-10-20"), null);
}

// ── When a day's close counts as final (Indian shares by 06:00 IST next day, US by 04:00 IST, funds when the NAV is out) ──
{
  const at = (iso, hh, mm) => C.istMs(iso, hh, mm);
  assert.strictEqual(C.classComplete("stocks", "2026-10-19", at("2026-10-20", 6, 0), []), true, "06:00 IST the next morning");
  assert.strictEqual(C.classComplete("stocks", "2026-10-19", at("2026-10-20", 5, 59), []), false, "05:59 is too early");
  assert.strictEqual(C.classComplete("usStocks", "2026-10-19", at("2026-10-20", 4, 0), []), true, "US: 04:00 IST");
  assert.strictEqual(C.classComplete("usStocks", "2026-10-19", at("2026-10-20", 3, 59), []), false);
  const nav = (last) => ({ dates: ["2026-10-15", last], closes: [1, 1] });
  assert.strictEqual(C.classComplete("mutualFunds", "2026-10-19", 0, [nav("2026-10-19"), nav("2026-10-19")]), true, "every fund has that day's NAV");
  assert.strictEqual(C.classComplete("mutualFunds", "2026-10-19", 0, [nav("2026-10-19"), nav("2026-10-16")]), false, "one fund still on Friday's NAV");
  assert.strictEqual(C.classComplete("mutualFunds", "2026-10-18", 0, [nav("2026-10-16")]), true, "a Sunday needs Friday's NAV");
  assert.strictEqual(C.classComplete("mutualFunds", "2026-10-19", 0, []), false, "no funds with a series: not provable");
  assert.strictEqual(C.classComplete("gold", "2026-10-19", Date.now(), []), false, "other classes are never final this way");
}

// ── Rebuilding a day from closes ──
{
  const ser = (prev, cur, date = "2026-10-19") => ({ dates: ["2026-10-16", date], closes: [prev, cur] });
  const late = C.istMs("2026-10-21", 9, 0);
  let r = C.rebuildMarketClasses({ date: "2026-10-19", nowMs: late, fx: 95, held: {
    mutualFunds: [{ key: "a", qty: 10, series: ser(100, 110) }, { key: "b", qty: 1, series: ser(50, 40) }],
    stocks: [{ key: "big", qty: 100, series: ser(99, 100) }, { key: "tiny", qty: 1, fallback: 100 }],
    usStocks: [{ key: "u", qty: 2, series: ser(49, 50) }],
  } });
  assert.deepStrictEqual([r.values.mutualFunds, r.changes.mutualFunds], [1140, 90], "₹1,100 + ₹40; +₹100 − ₹10");
  assert.deepStrictEqual([r.values.usStocks, r.changes.usStocks], [9500, 190], "dollars × ₹95 for the value and the move");
  assert.deepStrictEqual([r.values.stocks, r.changes.stocks, r.estimated.stocks, r.missing.stocks, r.settled.stocks], [10100, 100, ["tiny"], [], true],
    "a holding with no history is priced from today's price (1% of the class: still final), and adds nothing to the move");
  assert.deepStrictEqual([r.asOf.mutualFunds, r.settled.mutualFunds], ["2026-10-19", true]);
  r = C.rebuildMarketClasses({ date: "2026-10-19", nowMs: late, fx: 95, held: { stocks: [{ key: "big", qty: 1, series: ser(99, 100) }, { key: "tiny", qty: 1, fallback: 100 }], mutualFunds: [], usStocks: [] } });
  assert.deepStrictEqual([r.settled.stocks, r.missing.stocks], [false, ["tiny"]], "half the class from a guess: not final, and named");
  r = C.rebuildMarketClasses({ date: "2026-10-19", nowMs: late, fx: { dates: ["2026-10-16", "2026-10-19"], closes: [94, 96] }, held: { usStocks: [{ key: "u", qty: 1, series: ser(10, 10) }, { key: "v", qty: 1, series: ser(5, 5, "2026-10-16") }] } });
  assert.deepStrictEqual([r.values.usStocks, r.asOf.usStocks], [1440, "2026-10-16"], "the USD rate of that day (₹96); the class shows its oldest close");
  r = C.rebuildMarketClasses({ date: "2026-10-19", nowMs: late, fx: 95, held: { mutualFunds: [{ key: "x", qty: 1 }], stocks: [], usStocks: [] } });
  assert.deepStrictEqual([r.missing.mutualFunds, r.settled.mutualFunds, r.settled.stocks, r.values.stocks], [["x"], false, true, 0], "no price at all: missing; an empty class is final at ₹0");
  r = C.rebuildMarketClasses({ date: "2026-10-19", nowMs: late, fx: { dates: ["2026-10-25"], closes: [95] }, held: { usStocks: [{ key: "u", qty: 1, series: ser(1, 1) }] } });
  assert.deepStrictEqual([r.missing.usStocks, r.values.usStocks], [["u"], 0], "no USD rate for the day: US shares cannot be valued");
}

// ── Which rows were held on a day (a broker import stamps every row with the import date) ──
{
  const at = (d, extra = {}) => ({ date: d, ...extra });
  const snapshot = [1, 2, 3, 4, 5].map(() => at("2026-10-18"));
  assert.strictEqual(C.ownedAsOf(snapshot, "2026-10-10", (t) => t.date).length, 5, "five rows stamped with one import date count as held before it");
  assert.strictEqual(C.ownedAsOf(snapshot.slice(0, 4), "2026-10-10", (t) => t.date).length, 0, "four are not enough to call it an import");
  const mixed = [...snapshot, at("2026-10-01"), at("2026-10-02"), at("2026-10-03"), at("2026-10-04")];
  assert.strictEqual(C.ownedAsOf(mixed, "2026-10-10", (t) => t.date).length, 4, "5 of 9 rows share a date (56%, under the 60% an import needs): they count from that date, so only the 4 earlier rows were held");
  const six = [...[1, 2, 3, 4, 5, 6].map(() => at("2026-10-18")), at("2026-10-01"), at("2026-10-02"), at("2026-10-03"), at("2026-10-04")];
  assert.strictEqual(C.ownedAsOf(six, "2026-10-10", (t) => t.date).length, 10, "6 of 10 (60%) is an import: all held");
  const bought = [...snapshot, at("2026-10-19", { transactionType: "PURCHASE" })];
  assert.strictEqual(C.ownedAsOf(bought, "2026-10-10", (t) => t.date).length, 5, "a real purchase after the day is not held on it");
  assert.strictEqual(C.ownedAsOf([at("2026-10-10", { transactionType: "PURCHASE" })], "2026-10-10", (t) => t.date).length, 1, "bought that day: held");
}

// ── A lock at the close is kept unless a newer, final price arrives more than a minute later ──
{
  const t0 = Date.parse("2026-10-20T01:00:00Z");
  assert.strictEqual(C.keepLock(true, new Date(t0).toISOString(), true, t0 + 60000), true, "a fetch within a minute of the lock is the same price");
  assert.strictEqual(C.keepLock(true, new Date(t0).toISOString(), true, t0 + 60001), false, "a later final price replaces the lock");
  assert.strictEqual(C.keepLock(true, new Date(t0).toISOString(), false, t0 + 999999), true, "a later price that is not final (pre-market) does not");
  assert.strictEqual(C.keepLock(false, "", true, t0), false, "nothing locked: nothing kept");
  assert.strictEqual(C.keepLock(true, new Date(t0).toISOString(), true, t0, { fxChanged: true }), false, "the USD rate changed: recompute");
  assert.strictEqual(C.keepLock(true, "", true, t0, { heldNow: true, lockedValue: 0 }), false, "locked at ₹0 before the first holding was added: open up");
}
console.log("net worth oracle tests passed");
