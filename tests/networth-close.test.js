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

console.log("networth-close tests passed");
