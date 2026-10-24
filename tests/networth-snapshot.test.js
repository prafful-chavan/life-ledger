// The daily net worth record's rules: when each market has closed, when a locked value is kept or thrown away,
// how the day's move is counted, and how the totals add up. Each limit is tested on both sides.
const assert = require("assert");
const S = require("../networth-snapshot.js");
const { keepLock } = require("../networth-close.js");

const ist = (iso, hh, mm = 0) => Date.parse(iso + "T00:00:00Z") + (hh * 60 + mm) * 60000 - 330 * 60000;   // epoch ms of hh:mm IST
const WED = "2026-10-21", SAT = "2026-10-24", SUN = "2026-10-25", MON = "2026-10-26";

// ── clocks ──
assert.strictEqual(S.istTodayISO(ist(WED, 23, 59)), WED, "23:59 IST is still Wednesday"); assert.strictEqual(S.istTodayISO(ist(WED, 24, 0)), "2026-10-22", "midnight IST is Thursday");
assert.strictEqual(S.istTodayISO(Date.parse("2026-10-21T18:29:00Z")), WED); assert.strictEqual(S.istTodayISO(Date.parse("2026-10-21T18:30:00Z")), "2026-10-22", "18:30 UTC is midnight in India");
assert.deepStrictEqual(S.istClock(ist(WED, 15, 45)), { date: WED, minutes: 945, dow: 3 });
assert.strictEqual(S.prevBusinessDayISO(WED), "2026-10-20"); assert.strictEqual(S.prevBusinessDayISO(MON), "2026-10-23", "Monday's previous business day is Friday"); assert.strictEqual(S.prevBusinessDayISO(SUN), "2026-10-23"); assert.strictEqual(S.prevBusinessDayISO(SAT), "2026-10-23");

// US market is "fully closed" before 04:00 ET, from 20:00 ET, and all weekend (October 2026: New York is UTC−4)
const et = (iso, hh, mm = 0) => Date.parse(iso + "T00:00:00Z") + (hh * 60 + mm) * 60000 + 4 * 3600000;
assert.strictEqual(S.isUsMarketClosedAt(et(WED, 3, 59)), true); assert.strictEqual(S.isUsMarketClosedAt(et(WED, 4, 0)), false, "04:00 ET: pre-market has begun");
assert.strictEqual(S.isUsMarketClosedAt(et(WED, 19, 59)), false); assert.strictEqual(S.isUsMarketClosedAt(et(WED, 20, 0)), true, "20:00 ET: after-hours over");
assert.strictEqual(S.isUsMarketClosedAt(et(SAT, 12, 0)), true); assert.strictEqual(S.isUsMarketClosedAt(et(SUN, 12, 0)), true); assert.strictEqual(S.isUsMarketClosedAt(et(MON, 12, 0)), false);

// ── when a class is settled ──
const settled = (cls, ms, date, nav) => S.isClassSettled(cls, ms, date, nav);
assert.strictEqual(settled("stocks", ist(WED, 15, 44), WED), false); assert.strictEqual(settled("stocks", ist(WED, 15, 45), WED), true, "Indian shares: from 15:45");
assert.strictEqual(settled("stocks", ist(SAT, 9, 0), SAT), true, "weekend: any time"); assert.strictEqual(settled("stocks", ist(SUN, 0, 5), SUN), true);
assert.strictEqual(settled("stocks", ist(WED, 16, 0), "2026-10-22"), false, "a price fetched on another day never settles this day"); assert.strictEqual(settled("stocks", 0, WED), false, "no fetch time: not settled"); assert.strictEqual(settled("stocks", null, WED), false);
assert.strictEqual(settled("gold", ist(WED, 17, 59), WED), false); assert.strictEqual(settled("gold", ist(WED, 18, 0), WED), true, "gold: from 18:00");
assert.strictEqual(settled("usStocks", et(WED, 12, 0) , WED), false, "US market open: not settled");
assert.strictEqual(settled("usStocks", ist(WED, 23, 0), WED), false, "23:00 IST is 13:30 ET, market open");
assert.strictEqual(settled("usStocks", ist("2026-10-22", 5, 30), "2026-10-22"), true, "05:30 IST is 20:00 ET the day before: closed");
assert.strictEqual(settled("mutualFunds", ist(WED, 10, 0), WED, "2026-10-20"), true, "a NAV dated the previous business day is enough"); assert.strictEqual(settled("mutualFunds", ist(WED, 10, 0), WED, "2026-10-19"), false, "two days old: not yet");
assert.strictEqual(settled("mutualFunds", ist(MON, 10, 0), MON, "2026-10-23"), true, "Monday: Friday's NAV"); assert.strictEqual(settled("mutualFunds", ist(MON, 10, 0), MON, "2026-10-22"), false);
assert.strictEqual(settled("mutualFunds", ist(WED, 10, 0), WED, ""), false, "no NAV date"); assert.strictEqual(settled("mutualFunds", ist(WED, 10, 0), WED, undefined), false);
assert.strictEqual(settled("silver", ist(WED, 20, 0), WED), false, "classes that are not priced live never settle");

// ── holdings fingerprint ──
const st = { mutualFunds: [{ units: 10.4, transactionType: "PURCHASE" }, { units: 4, transactionType: "REDEEM" }, { units: 1, transactionType: "REDEMPTION" }], stocks: [{ quantity: 3 }, { quantity: 2.6 }], usstocks: [{ quantity: 1.5 }] };
assert.deepStrictEqual(S.holdingsSignature(st), { mutualFunds: "3:5", stocks: "2:6", usStocks: "1:1500" }, "rows : net units; a sale (any spelling) subtracts");
assert.notDeepStrictEqual(S.holdingsSignature({ ...st, stocks: [{ quantity: 3 }, { quantity: 4 }] }), S.holdingsSignature(st), "a changed quantity changes the fingerprint");
assert.deepStrictEqual(S.holdingsSignature({ ...st, stocks: [{ quantity: 3 }, { quantity: 3 }] }), S.holdingsSignature(st), "quantities are compared to the nearest whole share (5.6 and 6 are the same)");
assert.deepStrictEqual(S.holdingsSignature(null), { mutualFunds: "0:0", stocks: "0:0", usStocks: "0:0" }); assert.deepStrictEqual(S.holdingsSignature({}), S.holdingsSignature(null));
assert.notStrictEqual(S.holdingsSignature({ ...st, stocks: [...st.stocks, { quantity: 0 }] }).stocks, S.holdingsSignature(st).stocks, "an added row with zero units still changes the count");

// ── assembling the record ──
const bd = (o = {}) => ({ mutualFunds: 400000, stocks: 150000, usStocks: 20000, gold: 220000, silver: 2500, crypto: 350, fd: 200000, epf: 130000, ppf: 30000, bonds: 7000, bankSaving: 45000, others: 61000, liabilities: 4000, ...o });
const liveAll = (o = {}) => ({
  mutualFunds: { held: true, hasChange: true, change: -3000.456, fetchedAt: ist(WED, 21, 0), asOf: "2026-10-20" },
  stocks: { held: true, hasChange: true, change: -1500, fetchedAt: ist(WED, 16, 0), asOf: "" },
  usStocks: { held: true, hasChange: true, change: 100, fetchedAt: ist(WED, 5, 30), asOf: "" },
  gold: { held: true, hasChange: true, change: -2000, fetchedAt: ist(WED, 18, 30), asOf: "" },
  ...o,
});
const base = (o = {}) => ({ today: WED, breakdown: bd(), live: liveAll(), existing: null, prevRecord: null, fxNow: 94.9, sigNow: { mutualFunds: "1:10", stocks: "1:5", usStocks: "1:1000" }, keepLock, id: "nwh-new", nowIso: "2026-10-21T16:00:00.000Z", source: "live", ...o });

let r = S.assembleSnapshot(base());
assert.strictEqual(r.id, "nwh-new"); assert.strictEqual(r.date, WED); assert.strictEqual(r.source, "live"); assert.strictEqual(r.timestamp, "2026-10-21T16:00:00.000Z");
assert.strictEqual(r.totalAssets, 400000 + 150000 + 20000 + 220000 + 2500 + 350 + 200000 + 130000 + 30000 + 7000 + 45000 + 61000, "assets add up");
assert.strictEqual(r.netWorth, r.totalAssets - 4000); assert.strictEqual(r.totalLiabilities, 4000); assert.strictEqual(r.liabilities, 4000);
assert.deepStrictEqual(r.changes, { mutualFunds: -3000.46, stocks: -1500, usStocks: 100, gold: -2000 }, "moves are rounded to paise");
assert.strictEqual(r.dayChange, -6400.46); assert.strictEqual(r.dayChangePct, Number(((-6400.46 / (790000 + 6400.46)) * 100).toFixed(2)), "percent is of what the markets held yesterday");
assert.deepStrictEqual(r.settled, { mutualFunds: true, stocks: true, usStocks: true, gold: true }); assert.strictEqual(r.final, true);
assert.deepStrictEqual(r.holdSig, { mutualFunds: "1:10", stocks: "1:5", usStocks: "1:1000" }); assert.strictEqual(r.fxRate, 94.9);
assert.strictEqual(r.contributed, undefined, "no contributed figure given: none stored"); assert.deepStrictEqual(S.assembleSnapshot(base({ contributed: { stocks: 5 } })).contributed, { stocks: 5 });
assert.strictEqual(r.contributedAtPrev, undefined, "no earlier-day figure given: none stored"); assert.deepStrictEqual(S.assembleSnapshot(base({ contributed: { stocks: 5 }, contributedAtPrev: { stocks: 3 } })).contributedAtPrev, { stocks: 3 });
assert.strictEqual(r.asOf.mutualFunds, new Date(ist(WED, 21, 0)).toISOString());

// not all closed yet: not final, and the live move still counts
r = S.assembleSnapshot(base({ live: liveAll({ stocks: { held: true, hasChange: true, change: -1500, fetchedAt: ist(WED, 12, 0), asOf: "" } }) }));
assert.strictEqual(r.settled.stocks, false); assert.strictEqual(r.final, false); assert.strictEqual(r.changes.stocks, -1500);
// a class the household holds none of is settled by definition, and has no move
r = S.assembleSnapshot(base({ live: liveAll({ gold: { held: false } }) })); assert.strictEqual(r.settled.gold, true); assert.strictEqual(r.changes.gold, 0); assert.strictEqual(r.asOf.gold, "");
// held, but no change known: zero
r = S.assembleSnapshot(base({ live: liveAll({ stocks: { held: true, hasChange: false, change: -1500, fetchedAt: ist(WED, 16, 0) } }) })); assert.strictEqual(r.changes.stocks, 0);
// missing class entry: treated as not held
r = S.assembleSnapshot(base({ live: { mutualFunds: liveAll().mutualFunds } })); assert.deepStrictEqual(r.settled, { mutualFunds: true, stocks: true, usStocks: true, gold: true });
// all-zero market (a brand-new household): no division by zero
r = S.assembleSnapshot(base({ breakdown: bd({ mutualFunds: 0, stocks: 0, usStocks: 0, gold: 0 }), live: { mutualFunds: { held: false }, stocks: { held: false }, usStocks: { held: false }, gold: { held: false } } })); assert.strictEqual(r.dayChangePct, 0); assert.strictEqual(r.dayChange, 0);

// ── locks ──
const locked = (cls, extra = {}) => ({ id: "nwh-ex", date: WED, settled: { [cls]: true }, asOf: { [cls]: new Date(ist(WED, 20, 0)).toISOString() }, changes: { [cls]: -111 }, [cls]: 12345, holdSig: { mutualFunds: "1:10", stocks: "1:5", usStocks: "1:1000" }, fxRate: 94.9, ...extra });
// a settled class with nothing newer keeps its locked value and move; the others stay live
r = S.assembleSnapshot(base({ existing: locked("stocks"), live: liveAll({ stocks: { held: true, hasChange: true, change: -999, fetchedAt: ist(WED, 19, 0), asOf: "" } }) }));
assert.strictEqual(r.stocks, 12345); assert.strictEqual(r.changes.stocks, -111); assert.strictEqual(r.settled.stocks, true); assert.strictEqual(r.id, "nwh-ex", "an existing record keeps its id");
assert.strictEqual(r.mutualFunds, 400000, "other classes are not locked"); assert.strictEqual(r.netWorth, r.totalAssets - 4000, "totals use the locked value"); assert.strictEqual(r.totalAssets, 12345 + 400000 + 20000 + 220000 + 2500 + 350 + 200000 + 130000 + 30000 + 7000 + 45000 + 61000);
// a newer fetch after the close (more than a minute later) supersedes the lock; within a minute does not
r = S.assembleSnapshot(base({ existing: locked("stocks"), live: liveAll({ stocks: { held: true, hasChange: true, change: -999, fetchedAt: ist(WED, 20, 0) + 60001, asOf: "" } }) })); assert.strictEqual(r.changes.stocks, -999, "a newer close wins");
r = S.assembleSnapshot(base({ existing: locked("stocks"), live: liveAll({ stocks: { held: true, hasChange: true, change: -999, fetchedAt: ist(WED, 20, 0) + 60000, asOf: "" } }) })); assert.strictEqual(r.changes.stocks, -111, "within a minute: the lock stays");
// holdings changed after the lock (the fingerprint differs): recompute
r = S.assembleSnapshot(base({ existing: locked("stocks"), sigNow: { mutualFunds: "1:10", stocks: "2:9", usStocks: "1:1000" } })); assert.strictEqual(r.stocks, 150000, "a new holding opens the lock");
r = S.assembleSnapshot(base({ existing: locked("stocks"), sigNow: { mutualFunds: "9:99", stocks: "1:5", usStocks: "1:1000" } })); assert.strictEqual(r.stocks, 12345, "another class changing does not open this one");
// a record saved before fingerprints existed: opened when the locked value is more than 25% away from what is held now
const noSig = (v) => locked("stocks", { holdSig: undefined, stocks: v });
r = S.assembleSnapshot(base({ existing: noSig(150000 * 1.25) })); assert.strictEqual(r.stocks, 187500, "exactly 25%: kept"); r = S.assembleSnapshot(base({ existing: noSig(150000 * 1.26) })); assert.strictEqual(r.stocks, 150000, "26%: recomputed");
r = S.assembleSnapshot(base({ existing: noSig(150000 / 1.25) })); assert.strictEqual(r.stocks, 120000, "below by 20%: kept"); r = S.assembleSnapshot(base({ existing: noSig(0) })); assert.strictEqual(r.stocks, 0, "locked at zero with a price time on file: the lock stays (nothing to compare with)");
r = S.assembleSnapshot(base({ existing: { ...noSig(0), asOf: { stocks: "" } } })); assert.strictEqual(r.stocks, 150000, "locked at zero with no price time (held nothing then), held now: recompute");
// US shares: locked with another exchange rate → recompute; the 5-paise limit
const us = (fx) => locked("usStocks", { fxRate: fx, usStocks: 21000 });
r = S.assembleSnapshot(base({ existing: us(94.9), fxNow: 94.95 })); assert.strictEqual(r.usStocks, 21000, "5 paise apart: kept"); assert.strictEqual(r.fxRate, 94.9, "while locked, the lock's own rate is kept");
r = S.assembleSnapshot(base({ existing: us(94.9), fxNow: 94.96 })); assert.strictEqual(r.usStocks, 20000, "6 paise apart: recomputed"); assert.strictEqual(r.fxRate, 94.96, "recomputed: today's rate");
r = S.assembleSnapshot(base({ existing: us(undefined), fxNow: 94.9 })); assert.strictEqual(r.usStocks, 20000, "a lock with no recorded rate is recomputed");
r = S.assembleSnapshot(base({ existing: locked("stocks"), fxNow: 80 })); assert.strictEqual(r.fxRate, 80, "no US lock: today's rate");
// a first holding added after a class was locked while empty opens it
r = S.assembleSnapshot(base({ existing: { id: "e", date: WED, settled: { gold: true }, asOf: { gold: "" }, changes: { gold: 0 }, gold: 0, holdSig: {} } })); assert.strictEqual(r.gold, 220000, "locked while empty, now held: open");
// without a keepLock function, a settled class simply stays locked
r = S.assembleSnapshot(base({ keepLock: null, existing: locked("stocks"), sigNow: { stocks: "9:9" } })); assert.strictEqual(r.stocks, 12345);

// ── yesterday's move is not today's ──
const prev = (o) => ({ date: "2026-10-20", mutualFunds: 400000, changes: { mutualFunds: -3000.46 }, ...o });
r = S.assembleSnapshot(base({ prevRecord: prev() })); assert.strictEqual(r.changes.mutualFunds, 0, "same value, same move as yesterday: no new NAV yet");
r = S.assembleSnapshot(base({ prevRecord: prev({ mutualFunds: 400000 * 1.0005 }) })); assert.strictEqual(r.changes.mutualFunds, 0, "just inside 0.05% of yesterday's value (0.04998%)");
r = S.assembleSnapshot(base({ prevRecord: prev({ mutualFunds: 400000 * 1.0006 }) })); assert.strictEqual(r.changes.mutualFunds, -3000.46, "0.06% away: a new session");
r = S.assembleSnapshot(base({ prevRecord: prev({ changes: { mutualFunds: -3000.46 - 50 } }) })); assert.strictEqual(r.changes.mutualFunds, 0, "moves within ₹50 of each other are the same move");
r = S.assembleSnapshot(base({ prevRecord: prev({ changes: { mutualFunds: -3000.46 - 51 } }) })); assert.strictEqual(r.changes.mutualFunds, -3000.46, "₹51 apart: a different move");
r = S.assembleSnapshot(base({ live: liveAll({ mutualFunds: { held: true, hasChange: true, change: -300000, fetchedAt: ist(WED, 21, 0), asOf: "2026-10-20" } }), prevRecord: prev({ changes: { mutualFunds: -300000 * 1.009 } }) })); assert.strictEqual(r.changes.mutualFunds, 0, "within 1% of a large move: the same");
r = S.assembleSnapshot(base({ live: liveAll({ mutualFunds: { held: true, hasChange: true, change: -300000, fetchedAt: ist(WED, 21, 0), asOf: "2026-10-20" } }), prevRecord: prev({ changes: { mutualFunds: -300000 * 1.011 } }) })); assert.strictEqual(r.changes.mutualFunds, -300000, "more than 1% apart: different");
r = S.assembleSnapshot(base({ live: liveAll({ mutualFunds: { held: true, hasChange: true, change: 0, fetchedAt: ist(WED, 21, 0), asOf: "2026-10-20" } }), prevRecord: prev({ changes: { mutualFunds: 0 } }) })); assert.strictEqual(r.changes.mutualFunds, 0, "no move stays no move");
r = S.assembleSnapshot(base({ prevRecord: prev({ mutualFunds: 0 }) })); assert.strictEqual(r.changes.mutualFunds, -3000.46, "a previous value of zero cannot be 'the same'");
r = S.assembleSnapshot(base({ prevRecord: { date: "2026-10-20", changes: {} } })); assert.strictEqual(r.changes.stocks, -1500, "a previous record without values changes nothing");

// ── rounding, tiny values and the old-record fallback (limits found by the mutation test) ──
// totals are rounded to paise, once, at the end
r = S.assembleSnapshot(base({ breakdown: bd({ mutualFunds: 100.004, stocks: 100.004, usStocks: 0, gold: 0, silver: 0, crypto: 0, fd: 0, epf: 0, ppf: 0, bonds: 0, bankSaving: 0, others: 0, liabilities: 0.001 }), live: { mutualFunds: { held: false }, stocks: { held: false }, usStocks: { held: false }, gold: { held: false } } }));
assert.strictEqual(r.totalAssets, 200.01, "to paise"); assert.strictEqual(r.netWorth, 200.01);
// two locked classes keep their exact moves; the day's total is rounded to paise
const two = { id: "e", date: WED, settled: { stocks: true, gold: true }, asOf: { stocks: new Date(ist(WED, 20, 0)).toISOString(), gold: new Date(ist(WED, 20, 0)).toISOString() }, changes: { stocks: -1.004, gold: -1.004 }, stocks: 100000, gold: 200000, holdSig: { mutualFunds: "1:10", stocks: "1:5", usStocks: "1:1000" } };
r = S.assembleSnapshot(base({ existing: two, live: liveAll({ mutualFunds: { held: false }, usStocks: { held: false } }) })); assert.strictEqual(r.dayChange, -2.01, "−2.008 is −2.01");
// a market worth less than a rupee still gets a percentage
r = S.assembleSnapshot(base({ breakdown: bd({ mutualFunds: 0.5, stocks: 0, usStocks: 0, gold: 0 }), live: { mutualFunds: { held: true, hasChange: true, change: 0.25, fetchedAt: ist(WED, 21, 0), asOf: "2026-10-20" }, stocks: { held: false }, usStocks: { held: false }, gold: { held: false } } })); assert.strictEqual(r.dayChangePct, 100, "+₹0.25 on ₹0.25 is +100%");
// an old record (no fingerprint): the comparison needs a real value on both sides, however small
const old = (v) => ({ id: "e", date: WED, settled: { stocks: true }, asOf: { stocks: new Date(ist(WED, 20, 0)).toISOString() }, changes: { stocks: -111 }, stocks: v });
r = S.assembleSnapshot(base({ existing: old(12345), breakdown: bd({ stocks: 0 }) })); assert.strictEqual(r.stocks, 12345, "nothing held now: the lock stays");
r = S.assembleSnapshot(base({ existing: old(0.5) })); assert.strictEqual(r.stocks, 150000, "locked ₹0.50 vs ₹1,50,000 now: recompute");
r = S.assembleSnapshot(base({ existing: old(100000), breakdown: bd({ stocks: 0.5 }) })); assert.strictEqual(r.stocks, 0.5, "held now ₹0.50 vs locked ₹1,00,000: recompute");
// the same-move rule also applies to tiny previous values, and a previous zero never matches
r = S.assembleSnapshot(base({ breakdown: bd({ mutualFunds: 0.5 }), prevRecord: { date: "2026-10-20", mutualFunds: 0.5, changes: { mutualFunds: -3000.46 } } })); assert.strictEqual(r.changes.mutualFunds, 0, "₹0.50 yesterday, ₹0.50 today, same move");

console.log("networth-snapshot tests passed");
