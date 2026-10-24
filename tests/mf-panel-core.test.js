// The Mutual funds panel's rules: which transactions show, the portfolio figures, the SIP budget, one line per fund, the signal.
// Uses the app's own cost-basis, XIRR and redemption helpers, so the panel and the app cannot drift apart.
const assert = require("assert");
const app = require("../app.js");
const P = require("../mf-panel-core.js");

const NOW = Date.parse("2026-10-21T10:00:00");   // local time: 21 Oct, 10 days left in the month
const deps = (o = {}) => ({ costBasis: app.calcMfCostBasis, isRedemption: app.isRedemption, num: app.toNumber, xirr: app.calculateXIRR, now: NOW, matchOwner: app.matchHoldingsOwner, history: () => null, navVs30d: app.computeNavVs30dAvg, ...o });
const buy = (fund, units, nav, date, o = {}) => ({ id: fund + date, fundName: fund, owner: "Me", transactionType: "PURCHASE", units, nav, invested: units * nav, purchaseDate: date, date, latestNav: 120, prevNav: 118, ...o });
const sell = (fund, units, nav, date, o = {}) => buy(fund, units, nav, date, { transactionType: "REDEMPTION", ...o });

// ── which transactions, newest first ──
const all = [buy("A", 10, 100, "2026-01-05"), buy("B", 5, 50, "2026-03-05", { owner: "Wife" }), buy("A", 10, 110, "2026-02-05"), buy("C", 1, 10, "2026-04-01", { owner: "Both" }), buy("D", 1, 10, "", { date: "2026-05-01" }), buy("E", 1, 10, "", { date: "" })];
let rows = P.panelRows(all, "Both", app.matchHoldingsOwner);
assert.deepStrictEqual(rows.map((r) => r.fundName), ["D", "C", "B", "A", "A", "E"], "newest first; a row with no date last; the date field is used when there is no purchase date");
assert.deepStrictEqual(P.panelRows(all, "Wife", app.matchHoldingsOwner).map((r) => r.fundName), ["C", "B"], "Archana sees hers and joint ones");
assert.deepStrictEqual(P.panelRows(all, "Me", app.matchHoldingsOwner).map((r) => r.fundName), ["D", "C", "A", "A", "E"], "Prafful sees his and joint ones");
assert.deepStrictEqual(P.panelRows(null, "Me", app.matchHoldingsOwner), []); const copy = all.slice(); P.panelRows(all, "Both", app.matchHoldingsOwner); assert.deepStrictEqual(all.map((r) => r.id), copy.map((r) => r.id), "the list is not reordered in place");

// ── portfolio ──
let r = [buy("A", 10, 100, "2026-01-05"), buy("A", 10, 110, "2026-02-05"), buy("B", 5, 50, "2026-03-05")];
let pf = P.portfolio(r, deps());
assert.strictEqual(pf.invested, 1000 + 1100 + 250); assert.strictEqual(pf.current, 20 * 120 + 5 * 120, "units × latest NAV, per fund");
assert.strictEqual(pf.gain, pf.current - pf.invested); assert.ok(Math.abs(pf.roi - (pf.gain / pf.invested) * 100) < 1e-9);
assert.ok(pf.xirr > 0, "a gain gives a positive XIRR");
assert.deepStrictEqual([pf.oneDayChange, pf.oneDayHasPrev], [25 * (120 - 118), true], "units × (latest − previous NAV)"); assert.ok(Math.abs(pf.oneDayPct - (pf.oneDayChange / (pf.current - pf.oneDayChange)) * 100) < 1e-9);
// a redemption reduces units and cost (average cost), and its proceeds are an inflow
r = [buy("A", 10, 100, "2026-01-05"), buy("A", 10, 120, "2026-02-05"), sell("A", 5, 130, "2026-03-05")];
pf = P.portfolio(r, deps()); assert.strictEqual(pf.current, 15 * 120, "15 units left"); assert.strictEqual(pf.invested, app.calcMfCostBasis(r).invested, "cost from the helper, not from the redemption's proceeds");
// no previous NAV: no one-day change
pf = P.portfolio([buy("A", 10, 100, "2026-01-05", { prevNav: null, latestNav: 120 })], deps()); assert.deepStrictEqual([pf.oneDayChange, pf.oneDayHasPrev, pf.oneDayPct], [0, false, 0]);
// a fund with a previous NAV on one row is enough
pf = P.portfolio([buy("A", 5, 100, "2026-01-05", { prevNav: null }), buy("A", 5, 100, "2026-02-05", { prevNav: 110 })], deps()); assert.strictEqual(pf.oneDayHasPrev, true); assert.strictEqual(pf.oneDayChange, 10 * (120 - 110));
// nothing held: zeros and no division by zero
pf = P.portfolio([], deps()); assert.deepStrictEqual([pf.invested, pf.current, pf.gain, pf.roi, pf.oneDayPct], [0, 0, 0, 0, 0]);
pf = P.portfolio([buy("A", 10, 100, "2026-01-05"), sell("A", 10, 150, "2026-02-05")], deps()); assert.strictEqual(pf.current, 0, "sold out"); assert.ok(Number.isFinite(pf.xirr));
// funds with no name are grouped as "Unknown"; the latest NAV falls back to the purchase NAV
pf = P.portfolio([{ owner: "Me", units: 10, nav: 80, invested: 800, purchaseDate: "2026-01-05", transactionType: "PURCHASE" }], deps()); assert.strictEqual(pf.current, 800, "no latest NAV: the purchase NAV");
// the time is injectable: a row with no date counts as "now" in the XIRR
assert.doesNotThrow(() => P.portfolio([buy("A", 1, 100, "", { date: "" })], deps()));

// ── SIP budget (21 Oct: 10 of 31 days left, 21/31 = 67.7% of the month gone) ──
const m = (owner, amt, date, o = {}) => buy("F" + amt, 1, amt, date, { owner, invested: amt, ...o });
const month = [m("Me", 40000, "2026-10-03"), m("Wife", 30000, "2026-10-05"), m("Both", 5000, "2026-10-06"), m("Me", 99999, "2026-09-30"), m("Me", 7000, "2026-10-07", { transactionType: "REDEMPTION" }), m("Me", 11111, "2025-10-07")];
let sip = P.sipBudget(month, "Both", { me: 100000, wife: 50000 }, deps());
assert.deepStrictEqual([sip.invested, sip.target, sip.remaining], [75000, 150000, 75000], "this month's purchases only, from everyone");
assert.strictEqual(sip.daysRemaining, 10); assert.ok(Math.abs(sip.dayPct - (21 / 31) * 100) < 1e-9); assert.strictEqual(sip.pct, 50); assert.strictEqual(sip.isBehind, true, "50% against 67.7% of the month: behind"); assert.strictEqual(sip.targetKey, "me");
sip = P.sipBudget(month, "Wife", { me: 100000, wife: 50000 }, deps()); assert.deepStrictEqual([sip.invested, sip.target, sip.targetKey], [30000, 50000, "wife"], "Archana's own only (a joint purchase is not hers)");
sip = P.sipBudget(month, "Me", { me: 100000, wife: 50000 }, deps()); assert.deepStrictEqual([sip.invested, sip.target], [45000, 100000], "Prafful's and joint purchases");
sip = P.sipBudget(month, "Me", undefined, deps()); assert.strictEqual(sip.target, 100000, "no targets set: ₹1,00,000"); sip = P.sipBudget(month, "Both", { me: 0, wife: 0 }, deps()); assert.strictEqual(sip.target, 200000, "a target of 0 means not set");
sip = P.sipBudget(month, "Me", { me: 40000 }, deps()); assert.deepStrictEqual([sip.remaining, sip.pct], [0, 100], "over target: nothing remaining, 100% at most"); sip = P.sipBudget(month, "Me", { me: 45000 }, deps()); assert.strictEqual(sip.remaining, 0, "exactly on target");
sip = P.sipBudget([], "Me", { me: 100000 }, deps()); assert.deepStrictEqual([sip.invested, sip.pct, sip.isBehind], [0, 0, true], "nothing invested this far into the month: behind");
// behind pace: more than 15 points behind, not exactly 15
const at = (day) => deps({ now: Date.parse(`2026-10-${String(day).padStart(2, "0")}T10:00:00`) });
const budget = [m("Me", 40000, "2026-10-01")];                                  // 40% of ₹1,00,000
assert.strictEqual(P.sipBudget(budget, "Me", { me: 100000 }, at(15)).isBehind, false, "40% vs 48.4% of the month: 8 points behind, fine");
assert.strictEqual(P.sipBudget(budget, "Me", { me: 100000 }, at(18)).isBehind, true, "40% vs 58.1%: 18 points behind");
assert.strictEqual(P.sipBudget([m("Me", 1000, "2026-10-01")], "Me", { me: 100 }, deps()).isBehind, false, "100% is never behind");
assert.strictEqual(P.sipBudget(budget, "Me", { me: 0 }, at(30)).target, 100000, "target 0 falls back to the default");
// the number of days in the month is real (February)
sip = P.sipBudget([], "Me", {}, deps({ now: Date.parse("2027-02-10T10:00:00") })); assert.strictEqual(sip.daysRemaining, 18, "February 2027 has 28 days"); sip = P.sipBudget([], "Me", {}, deps({ now: Date.parse("2028-02-10T10:00:00") })); assert.strictEqual(sip.daysRemaining, 19, "February 2028 has 29");

// ── one line per fund ──
const txns = [sell("A", 5, 130, "2026-03-05", { latestNav: 125, prevNav: 124 }), buy("A", 10, 100, "2026-02-05", { latestNav: 120, prevNav: 118 }), buy("B", 4, 50, "2026-01-05", { latestNav: 60, prevNav: null })];
const hs = P.holdings(txns, deps());
assert.deepStrictEqual(hs.map((h) => h.fundName), ["A", "B"], "in order of first appearance");
const a = hs[0];
assert.strictEqual(a.latestNav, 125, "latest and previous NAV come from the newest transaction (the first row)"); assert.strictEqual(a.prevNav, 124); assert.strictEqual(a.totalUnits, 5); assert.strictEqual(a.currentValue, 5 * 125);
assert.strictEqual(a.dayChange, 5 * (125 - 124)); assert.ok(Math.abs(a.dayChangePct - ((125 - 124) / 124) * 100) < 1e-9); assert.ok(Math.abs(a.roi - (a.gain / a.totalInvested) * 100) < 1e-9); assert.strictEqual(a.avgNav, app.calcMfCostBasis(txns.slice(0, 2)).avgCost);
const b = hs[1]; assert.strictEqual(b.prevNav, null); assert.strictEqual(b.dayChange, null); assert.strictEqual(b.dayChangePct, null, "no previous NAV: no one-day figures");
assert.deepStrictEqual([b.navVs30d, b.lowestNav30d], [null, null], "no history: no 30-day figures");
// sold out: zero units, zero value, XIRR from the flows alone
const out = P.holdings([sell("S", 10, 150, "2026-02-05"), buy("S", 10, 100, "2026-01-05")], deps())[0]; assert.strictEqual(out.totalUnits, 0); assert.strictEqual(out.currentValue, 0);
// the 30-day figures from a NAV history: lowest of the last 30; the average needs 30 points
const hist = (n, f) => Array.from({ length: n }, (_, i) => ({ nav: f(i) }));
let h30 = P.holdings([buy("A", 1, 100, "2026-01-05")], deps({ history: () => hist(30, (i) => 100 + i) }))[0]; assert.strictEqual(h30.lowestNav30d, 100); assert.ok(Math.abs(h30.navVs30d - ((129 - 114.5) / 114.5) * 100) < 1e-9);
h30 = P.holdings([buy("A", 1, 100, "2026-01-05")], deps({ history: () => hist(29, (i) => 100 + i) }))[0]; assert.strictEqual(h30.lowestNav30d, 100); assert.strictEqual(h30.navVs30d, null, "29 points: no average yet");
h30 = P.holdings([buy("A", 1, 100, "2026-01-05")], deps({ history: () => hist(40, (i) => 200 - i) }))[0]; assert.strictEqual(h30.lowestNav30d, 200 - 39, "only the last 30 count");
h30 = P.holdings([buy("A", 1, 100, "2026-01-05")], deps({ history: () => [] }))[0]; assert.deepStrictEqual([h30.lowestNav30d, h30.navVs30d], [null, null], "empty history: none");
h30 = P.holdings([buy("A", 1, 100, "2026-01-05")], deps({ history: () => hist(1, () => 77) }))[0]; assert.strictEqual(h30.lowestNav30d, 77, "one point is enough for the lowest"); assert.strictEqual(P.holdings([], deps()).length, 0);
let seen = null; P.holdings([buy("Zeta Fund", 1, 100, "2026-01-05")], deps({ history: (n) => { seen = n; return null; } })); assert.strictEqual(seen, "Zeta Fund", "the history is looked up by fund name");

// ── the signal ──
assert.strictEqual(P.investSignal(100, 100), "low", "at the lowest"); assert.strictEqual(P.investSignal(99, 100), "low", "under it");
assert.strictEqual(P.investSignal(101.5, 100), "near", "exactly 1.5% above: near"); assert.strictEqual(P.investSignal(101.51, 100), "fair"); assert.strictEqual(P.investSignal(100.01, 100), "near");
assert.strictEqual(P.investSignal(104, 100), "fair", "exactly 4%: fair"); assert.strictEqual(P.investSignal(104.01, 100), "high"); assert.strictEqual(P.investSignal(150, 100), "high");
assert.strictEqual(P.investSignal(100, null), null, "no history: no signal"); assert.strictEqual(P.investSignal(null, 100), null); assert.strictEqual(P.investSignal(undefined, 100), "high", "no NAV at all reads as high, as it always did");

// ── limits found by the mutation test ──
const spy = []; const spyDeps = (o = {}) => deps({ xirr: (f) => { spy.push(f); return 0; }, ...o });
// a fund with no NAV at all is worth nothing (not ₹1 a unit)
pf = P.portfolio([{ fundName: "NoNav", owner: "Me", transactionType: "PURCHASE", units: 10, invested: 1000, purchaseDate: "2026-01-05" }], deps()); assert.strictEqual(pf.current, 0);
// the closing inflow (today's value) joins the XIRR only when something is held
spy.length = 0; P.portfolio([buy("A", 10, 100, "2026-01-05"), sell("A", 10, 120, "2026-02-05")], spyDeps()); assert.strictEqual(spy[0].length, 2, "sold out: just the two flows, no closing value");
spy.length = 0; P.portfolio([buy("A", 1, 1, "2026-01-05", { latestNav: 1, prevNav: null })], spyDeps()); assert.strictEqual(spy[0].length, 2, "₹1 held: the closing value joins");
spy.length = 0; P.holdings([buy("A", 10, 100, "2026-01-05"), sell("A", 10, 120, "2026-02-05")], spyDeps()); assert.strictEqual(spy[0].length, 2, "per fund: sold out, no closing value");
spy.length = 0; P.holdings([buy("A", 1, 1, "2026-01-05", { latestNav: 1 })], spyDeps()); assert.strictEqual(spy[0].length, 2, "per fund: one unit held, the closing value joins");
// the flows: purchases out, redemptions in, dated by purchase date (or date)
spy.length = 0; P.portfolio([buy("A", 10, 100, "2026-01-05"), sell("A", 4, 130, "2026-02-05")], spyDeps()); assert.deepStrictEqual(spy[0].slice(0, 2).map((f) => f.amount), [-1000, 520]); assert.strictEqual(spy[0][2].date.getTime(), NOW);
// one-day percentage: a sold-out portfolio with previous NAVs is 0, not NaN; a ₹1 portfolio still has one
pf = P.portfolio([buy("A", 10, 100, "2026-01-05", { prevNav: 118 }), sell("A", 10, 120, "2026-02-05", { prevNav: 118 })], deps()); assert.strictEqual(pf.oneDayPct, 0);
pf = P.portfolio([buy("A", 1, 1, "2026-01-05", { latestNav: 1, prevNav: 0.5 })], deps()); assert.strictEqual(pf.oneDayPct, 100, "+₹0.5 on ₹0.5");
// the SIP target: ₹1 is a target; a negative one never gives a percentage
assert.strictEqual(P.sipBudget([m("Me", 1, "2026-10-01")], "Me", { me: 1 }, deps()).pct, 100); assert.strictEqual(P.sipBudget([m("Me", 1, "2026-10-01")], "Me", { me: -1 }, deps()).pct, 0);
// behind pace at the end of the month: 85% exactly is fine, a little less is behind
const eom = deps({ now: Date.parse("2026-10-31T10:00:00") });
assert.strictEqual(P.sipBudget([m("Me", 85000, "2026-10-01")], "Me", { me: 100000 }, eom).isBehind, false, "85% on the last day: exactly 15 points behind"); assert.strictEqual(P.sipBudget([m("Me", 84900, "2026-10-01")], "Me", { me: 100000 }, eom).isBehind, true);
assert.strictEqual(P.sipBudget([m("Me", 84500, "2026-10-01")], "Me", { me: 100000 }, eom).isBehind, true, "84.5% is behind");
// per fund: a single transaction with only a purchase NAV; gain; a fund bought for nothing; the 30-day lowest uses 30 points
const one = P.holdings([{ fundName: "P", owner: "Me", transactionType: "PURCHASE", units: 10, nav: 80, invested: 700, purchaseDate: "2026-01-05" }], deps())[0];
assert.strictEqual(one.latestNav, 80, "no latest NAV: the purchase NAV"); assert.strictEqual(one.currentValue, 800); assert.strictEqual(one.gain, 100, "value minus invested");
assert.strictEqual(P.holdings([buy("Z", 10, 0, "2026-01-05", { invested: 0 })], deps())[0].roi, 0, "nothing invested: roi 0");
h30 = P.holdings([buy("A", 1, 100, "2026-01-05")], deps({ history: () => hist(40, (i) => 100 + i) }))[0]; assert.strictEqual(h30.lowestNav30d, 110, "the last 30 of 40 points start at 110");
const dc = P.holdings([buy("A", 5, 100, "2026-01-05", { latestNav: 126, prevNav: 124 })], deps())[0]; assert.strictEqual(dc.dayChange, 10, "5 units × ₹2");

console.log("mf-panel-core tests passed");
