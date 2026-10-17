const assert = require("assert");
const C = require("../networth-close.js");

const ser = (pairs) => ({ dates: pairs.map((p) => p[0]), closes: pairs.map((p) => p[1]) });
const ist = (iso, h, m = 0) => C.istMs(iso, h, m);

// ── dates ─────────────────────────────────────────────────────────────
assert.strictEqual(C.isBusinessDay("2026-10-14"), true);   // Wednesday
assert.strictEqual(C.isBusinessDay("2026-10-17"), false);  // Saturday
assert.strictEqual(C.prevBusinessDay("2026-10-19"), "2026-10-16", "Monday → previous Friday");
assert.strictEqual(C.dayAfter("2026-10-31"), "2026-11-01");

// ── last close on or before a date ─────────────────────────────────────
const s = ser([["2026-10-14", 100], ["2026-10-15", 110], ["2026-10-16", 120]]);
assert.deepStrictEqual(C.closeOnOrBefore(s, "2026-10-15"), { value: 110, date: "2026-10-15", prevValue: 100 });
assert.strictEqual(C.closeOnOrBefore(s, "2026-10-18").value, 120, "weekend: the Friday close stands");
assert.strictEqual(C.closeOnOrBefore(s, "2026-10-13"), null, "nothing before the first candle");

// ── completeness windows (this is the heart of the timing rules) ───────
const D = "2026-10-14"; // Wednesday
assert.strictEqual(C.classComplete("stocks", D, ist(D, 16, 0), []), false, "stocks: not complete at 4 pm on the day");
assert.strictEqual(C.classComplete("stocks", D, ist("2026-10-15", 6, 1), []), true, "stocks: complete next morning");
assert.strictEqual(C.classComplete("usStocks", D, ist("2026-10-15", 1, 45), []), false, "US: the New York close is about 1:30–2:30 am IST, not yet safe");
assert.strictEqual(C.classComplete("usStocks", D, ist("2026-10-15", 4, 5), []), true, "US: complete by 4 am IST");
// funds: the NAV dated D must exist for EVERY held fund
const mfLate = ser([["2026-10-13", 50]]);
const mfDone = ser([["2026-10-13", 50], ["2026-10-14", 51]]);
assert.strictEqual(C.classComplete("mutualFunds", D, ist("2026-10-15", 9, 0), [mfDone, mfLate]), false, "one fund still lacks the 14 Oct NAV");
assert.strictEqual(C.classComplete("mutualFunds", D, ist("2026-10-15", 9, 0), [mfDone, mfDone]), true);
// Saturday: only Friday's NAV is needed
assert.strictEqual(C.classComplete("mutualFunds", "2026-10-17", ist("2026-10-18", 9), [ser([["2026-10-16", 60]])]), true);

// ── rebuilding a day from official closes ──────────────────────────────
const held = {
  mutualFunds: [{ key: "mf1", qty: 100, series: mfDone }],
  stocks: [{ key: "TCS", qty: 10, series: ser([["2026-10-13", 3000], ["2026-10-14", 3100]]) }],
  usStocks: [{ key: "QQQM", qty: 2, series: ser([["2026-10-13", 200], ["2026-10-14", 210]]) }],
};
const fx = ser([["2026-10-13", 84], ["2026-10-14", 85]]);
let r = C.rebuildMarketClasses({ date: D, nowMs: ist("2026-10-15", 9, 0), held, fx });
assert.strictEqual(r.values.mutualFunds, 5100);                 // 100 × 51
assert.strictEqual(r.values.stocks, 31000);                     // 10 × 3100
assert.strictEqual(r.values.usStocks, 2 * 210 * 85);            // US price × that day's USD/INR
assert.strictEqual(r.changes.stocks, 1000);                     // vs previous close
assert.strictEqual(r.changes.mutualFunds, 100);
assert.deepStrictEqual(JSON.parse(JSON.stringify(r.settled)), { mutualFunds: true, stocks: true, usStocks: true });
assert.strictEqual(r.asOf.stocks, "2026-10-14");

// the same day viewed too early is provisional, with the real reasons
r = C.rebuildMarketClasses({ date: D, nowMs: ist(D, 22, 0), held, fx });
assert.strictEqual(r.settled.stocks, false, "wait until the next morning");
assert.strictEqual(r.settled.usStocks, false, "the US session is still open that evening");
assert.strictEqual(r.settled.mutualFunds, true, "NAV for the 14th is already in the series");

// missing prices never turn into zeros silently
const noPrice = { stocks: [{ key: "NEW", qty: 5, series: null }] };
r = C.rebuildMarketClasses({ date: D, nowMs: ist("2026-10-16", 9), held: noPrice, fx: 85 });
assert.deepStrictEqual(r.missing.stocks, ["NEW"]);
assert.strictEqual(r.settled.stocks, false, "a class with a missing price can't be final");

// classes you don't hold are trivially final
r = C.rebuildMarketClasses({ date: D, nowMs: ist(D, 10), held: { stocks: [] }, fx: 85 });
assert.strictEqual(r.settled.stocks && r.settled.mutualFunds && r.settled.usStocks, true);

// weekend record uses Friday's closes and is final by Saturday morning
const fri = { stocks: [{ key: "TCS", qty: 10, series: ser([["2026-10-15", 3000], ["2026-10-16", 3200]]) }] };
r = C.rebuildMarketClasses({ date: "2026-10-17", nowMs: ist("2026-10-18", 7), held: fri, fx: 85 });
assert.strictEqual(r.values.stocks, 32000);
assert.strictEqual(r.asOf.stocks, "2026-10-16");
assert.strictEqual(r.settled.stocks, true);

// ── imported holdings lists vs real dated purchases ──────────────────
{
  const dateOf = (t) => String(t.purchaseDate || t.date || "").slice(0, 10);
  const imported = Array.from({ length: 35 }, (_, i) => ({ symbol: "S" + i, quantity: 10, purchaseDate: "2026-10-15" })); // all stamped with the import day
  assert.strictEqual(C.ownedAsOf(imported, "2026-10-12", dateOf).length, 35, "a holdings import counts as held on earlier days");
  const trades = [
    { symbol: "A", quantity: 1, transactionType: "BUY", purchaseDate: "2026-10-01" },
    { symbol: "B", quantity: 1, transactionType: "BUY", purchaseDate: "2026-10-14" },
  ];
  assert.deepStrictEqual(C.ownedAsOf(trades, "2026-10-10", dateOf).map((t) => t.symbol), ["A"], "real trades use their own date");
  const lots = Array.from({ length: 6 }, (_, i) => ({ symbol: "L" + i, purchaseDate: "2026-0" + (i + 1) + "-10" }));  // no type but distinct dates (US lots)
  assert.strictEqual(C.ownedAsOf(lots, "2026-03-31", dateOf).length, 3, "distinct dates are honoured even without a type");
  const mixed = imported.concat([{ symbol: "NEW", quantity: 1, transactionType: "BUY", purchaseDate: "2026-10-14" }]);
  assert.strictEqual(C.ownedAsOf(mixed, "2026-10-12", dateOf).length, 35, "a trade made after the day is excluded");
  assert.strictEqual(C.ownedAsOf([{ symbol: "X" }], "2026-10-12", dateOf).length, 1, "undated rows are always held");
}

// ── a holding with no price history is estimated only while it is a small part of the class ──
{
  const big = { key: "BIG", qty: 100, series: ser([["2026-10-13", 100], ["2026-10-14", 110]]) };
  const tiny = { key: "TRIL", qty: 10, series: null, fallback: 50 };           // 500 vs 11,000 → 4.3%
  let r2 = C.rebuildMarketClasses({ date: "2026-10-14", nowMs: ist("2026-10-15", 9), held: { stocks: [big, { ...tiny, qty: 3 }] }, fx: 85 });
  assert.strictEqual(r2.values.stocks, 11000 + 150, "official close for the priced holding + today's price for the unpriced one");
  assert.deepStrictEqual(r2.estimated.stocks, ["TRIL"]);
  assert.strictEqual(r2.settled.stocks, true, "≤2% estimated: the class can still lock");
  r2 = C.rebuildMarketClasses({ date: "2026-10-14", nowMs: ist("2026-10-15", 9), held: { stocks: [big, tiny] }, fx: 85 });
  assert.strictEqual(r2.settled.stocks, false, "too much of the class would be a guess");
  assert.ok(r2.missing.stocks.includes("TRIL"));
  r2 = C.rebuildMarketClasses({ date: "2026-10-14", nowMs: ist("2026-10-15", 9), held: { stocks: [big, { key: "X", qty: 1, series: null }] }, fx: 85 });
  assert.deepStrictEqual(r2.missing.stocks, ["X"], "no fallback price at all → still missing");
}


// ── keepLock: a newer after-close fetch replaces an earlier lock ──────
{
  const K = require("../networth-close.js").keepLock;
  assert.strictEqual(K(false, "", true, 5), false, "not locked → nothing to keep");
  assert.strictEqual(K(true, "2026-10-17T02:02:10.642Z", false, Date.parse("2026-10-17T15:40:00Z")), true, "newer fetch is not after the close → keep the lock");
  assert.strictEqual(K(true, "2026-10-17T02:02:10.642Z", true, Date.parse("2026-10-17T15:40:00Z")), false, "newer after-close fetch replaces the lock");
  assert.strictEqual(K(true, "2026-10-17T15:40:00Z", true, Date.parse("2026-10-17T15:40:00Z")), true, "same fetch → keep");
  assert.strictEqual(K(true, "", true, 0), true, "no timestamps → keep");
}

// a class locked while empty opens up once something is held (first holding added later the same day)
{
  const K = require("../networth-close.js").keepLock;
  assert.strictEqual(K(true, "", false, 0, { heldNow: true, lockedValue: 0 }), false, "was empty, now held → not locked");
  assert.strictEqual(K(true, "", false, 0, { heldNow: false, lockedValue: 0 }), true, "still empty → stays locked");
  assert.strictEqual(K(true, "2026-10-17T02:02:10.642Z", false, 0, { heldNow: true, lockedValue: 1559288 }), true, "a real locked close is kept");
}
console.log("networth-close tests passed");
