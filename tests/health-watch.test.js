// The health watch: each failure it exists to catch is caught, each healthy state stays quiet, and every limit is tested on both sides.
const assert = require("assert");
const HW = require("../mcp/health-watch.js");
const R = require("../mcp/brief-render.js");

const WED = "2026-10-21", SAT = "2026-10-24", SUN = "2026-10-25", MON = "2026-10-26";
const NOW = Date.parse("2026-10-21T10:00:00Z");
const day = (n, from = WED) => new Date(Date.parse(from + "T00:00:00Z") - n * 864e5).toISOString().slice(0, 10);
const good = (over = {}) => ({
  today: over.today || WED, nowMs: NOW,
  state: {
    mutualFunds: [{ fundName: "A", owner: "Me", units: 10, latestNav: 5, transactionType: "PURCHASE" }],
    stocks: [{ symbol: "X", quantity: 2, currentPrice: 10 }], usstocks: [{ symbol: "Z", quantity: 1, currentPrice: 3 }],
    netWorthHistory: [1, 2, 3, 4, 5, 6, 7].map((n) => ({ date: day(n, over.today || WED) })),
  },
  fresh: { mutualFundsHoursOld: 5, stocksHoursOld: 5, usStocksHoursOld: 5, goldHoursOld: 5 },
  integrity: { alerts: [] }, lawWatch: { stale: false, checkedOn: "2026-10-01" }, holdingsCheck: { checkedOn: WED, status: "ok", gaps: [] },
  taxCases: { total: 29, passed: 29 }, source: { fromCache: false, updatedAt: "2026-10-21T08:00:00Z" },
  ...over,
});
const ids = (r) => r.problems.map((p) => p.id).sort().join(",");

// healthy: nothing to report, and no email on a Wednesday
let r = HW.check(good());
assert.strictEqual(r.status, "ok"); assert.strictEqual(r.problems.length, 0);
let out = HW.render(r, { today: WED });
assert.strictEqual(out.send, false, "healthy on a weekday: silent");
assert.strictEqual(HW.render(HW.check(good({ today: SUN })), { today: SUN }).send, true, "Sundays always send, so you know the watch is alive");
assert.strictEqual(HW.render(r, { today: WED, force: true }).send, true, "force sends");
assert.ok(R.intact(out.html), "the html carries its length marker");

// cloud copy
r = HW.check(good({ source: { fromCache: true, cachedAt: "2026-10-19T04:00:00Z", reason: "Gateway HTTP 404" } }));
assert.strictEqual(ids(r), "cloud"); assert.strictEqual(r.status, "fail"); assert.ok(/saved copy from 19 Oct 2026/.test(r.problems[0].detail));
const save = (hoursAgo) => good({ source: { updatedAt: new Date(NOW - hoursAgo * 3600000).toISOString() } });
assert.strictEqual(HW.check(save(24 * 7)).problems.length, 0, "exactly a week: still fine"); assert.strictEqual(ids(HW.check(save(24 * 7 + 1))), "last-save", "a week and an hour: flagged");

// price age: working-day and weekend limits, each side
const fr = (h) => ({ mutualFundsHoursOld: h, stocksHoursOld: 1, usStocksHoursOld: 1, goldHoursOld: 1 });
assert.strictEqual(HW.priceLimitHours(WED), 40); assert.strictEqual(HW.priceLimitHours(SAT), 84); assert.strictEqual(HW.priceLimitHours(SUN), 84); assert.strictEqual(HW.priceLimitHours(MON), 84);
assert.strictEqual(HW.check(good({ fresh: fr(40) })).problems.length, 0, "40 hours on a Wednesday is the limit"); assert.strictEqual(ids(HW.check(good({ fresh: fr(41) }))), "price-mutualFundsHoursOld");
assert.strictEqual(HW.check(good({ today: SAT, fresh: fr(84) })).problems.length, 0, "84 hours on a Saturday is fine"); assert.strictEqual(HW.check(good({ today: SAT, fresh: fr(85) })).problems.length, 1);
assert.strictEqual(HW.check(good({ fresh: { ...fr(1), goldHoursOld: 60 } })).problems.length, 0, "gold gets 1.5× the limit (60 hours)"); assert.strictEqual(HW.check(good({ fresh: { ...fr(1), goldHoursOld: 61 } })).problems.length, 1);
r = HW.check(good({ fresh: { mutualFundsHoursOld: null, stocksHoursOld: 1, usStocksHoursOld: 1, goldHoursOld: null } }));
assert.strictEqual(ids(r), "price-mutualFundsHoursOld", "no date is a problem for funds, but gold may have none");
assert.ok(/^The gold rate is 3 days old$/.test(HW.check(good({ fresh: { ...fr(1), goldHoursOld: 70 } })).problems[0].title), "plain grammar");

// holdings without a price
let s = good().state; s.stocks.push({ symbol: "NOPRICE", quantity: 1, currentPrice: 0 }); s.usstocks.push({ symbol: "NOUS", quantity: 1 }); s.mutualFunds.push({ fundName: "No NAV Fund", owner: "Me", units: 5, transactionType: "PURCHASE" });
r = HW.check(good({ state: s })); assert.strictEqual(ids(r), "no-price"); assert.ok(/NOPRICE, NOUS, No NAV Fund/.test(r.problems[0].detail) && /3 holdings have/.test(r.problems[0].title));
s = good().state; s.stocks.push({ symbol: "SOLD", quantity: 0, currentPrice: 0 }); s.mutualFunds.push({ fundName: "Sold Out", owner: "Me", units: 5, transactionType: "PURCHASE" }, { fundName: "Sold Out", owner: "Me", units: 5, transactionType: "REDEEM" });
assert.strictEqual(HW.check(good({ state: s })).problems.length, 0, "a sold-out holding needs no price (and REDEEM counts as a sale)");
s = good().state; s.mutualFunds.push({ fundName: "Tiny", owner: "Me", units: 0.001, transactionType: "PURCHASE" });
assert.strictEqual(HW.check(good({ state: s })).problems.length, 0, "dust units are ignored"); s.mutualFunds[1].units = 0.002; assert.strictEqual(ids(HW.check(good({ state: s }))), "no-price");

// net worth history gaps: weekends are not gaps; a missing working day is
s = good().state; s.netWorthHistory = s.netWorthHistory.filter((h) => h.date !== day(2)); r = HW.check(good({ state: s }));
assert.strictEqual(ids(r), "history"); assert.ok(/1 working day missing/.test(r.problems[0].title));
s = good().state; s.netWorthHistory = s.netWorthHistory.filter((h) => dayOfWeekIso(h.date) !== 0 && dayOfWeekIso(h.date) !== 6); assert.strictEqual(HW.check(good({ state: s })).problems.length, 0, "weekends need no record");
function dayOfWeekIso(d) { return new Date(d + "T00:00:00Z").getUTCDay(); }
s = good().state; s.netWorthHistory = []; assert.ok(/5 working days missing/.test(HW.check(good({ state: s })).problems[0].title), "plural");

// integrity
r = HW.check(good({ integrity: { alerts: [{ level: "critical", topic: "Repeated holdings", text: "12 of 40 rows are copies" }, { level: "watch", topic: "Large move", text: "moved 7%" }] } }));
assert.deepStrictEqual(r.problems.map((p) => p.level), ["fail", "warn"]); assert.strictEqual(r.status, "fail");

// INDmoney check: gaps, overdue (10 days ok, 11 not), never run
const hc = (o) => good({ holdingsCheck: { checkedOn: WED, status: "ok", gaps: [], ...o } });
r = HW.check(hc({ status: "gaps", gaps: [{ name: "Fund A", who: "Wife", confirmed: true }, { name: "Seen once", who: "Me", confirmed: false }] }));
assert.strictEqual(ids(r), "holdings-check"); assert.ok(/Fund A \(Archana\)/.test(r.problems[0].detail) && !/Seen once/.test(r.problems[0].detail));
assert.strictEqual(HW.check(hc({ checkedOn: day(10) })).problems.length, 0); assert.strictEqual(ids(HW.check(hc({ checkedOn: day(11) }))), "holdings-check");
assert.strictEqual(ids(HW.check(good({ holdingsCheck: null }))), "holdings-check");

// law watch and tax engine
assert.strictEqual(ids(HW.check(good({ lawWatch: { stale: true, checkedOn: "2026-08-01" } }))), "law");
r = HW.check(good({ taxCases: { total: 29, passed: 28 } })); assert.strictEqual(ids(r), "tax-engine"); assert.strictEqual(r.status, "fail");
assert.strictEqual(HW.check(good({ taxCases: null })).problems.length, 0, "no oracle result: nothing to judge");

// the email: subject counts problems and serious ones; text names them; html is escaped and sealed
r = HW.check(good({ source: { fromCache: true, cachedAt: "2026-10-19T04:00:00Z" }, lawWatch: { stale: true, checkedOn: "2026-08-01" }, integrity: { alerts: [{ level: "watch", topic: "<b>x</b>", text: "a & b" }] } }));
out = HW.render(r, { today: WED });
assert.strictEqual(out.subject, "Life Ledger — needs attention (3, 1 serious)"); assert.strictEqual(out.send, true); assert.strictEqual(out.kind, "attention");
assert.ok(/NEEDS ATTENTION/.test(out.text) && /\[Fix now\] The cloud copy could not be reached/.test(out.text) && /What to do:/.test(out.text));
assert.ok(!/<b>x<\/b>/.test(out.html) && /&lt;b&gt;x&lt;\/b&gt;/.test(out.html), "html-escaped"); assert.ok(R.intact(out.html));
assert.ok(!/[^-]background:/.test(out.html), "Gmail strips the background shorthand");
assert.strictEqual(HW.render(HW.check(good({ taxCases: { total: 2, passed: 1 } })), { today: WED }).subject, "Life Ledger — needs attention (1, 1 serious)");
assert.strictEqual(HW.render(HW.check(good({ lawWatch: { stale: true } })), { today: WED }).subject, "Life Ledger — needs attention (1)");
assert.strictEqual(HW.render(HW.check(good()), { today: SUN }).subject, "Life Ledger — weekly health: all good");

// ── limits that survived the mutation test ──
// a price below ₹1 is still a price
s = good().state; s.stocks = [{ symbol: "PENNY", quantity: 5, currentPrice: 0.5 }]; s.usstocks = [{ symbol: "PENNYUS", quantity: 5, currentPrice: 0.5 }]; s.mutualFunds = [{ fundName: "Cheap NAV", owner: "Me", units: 5, latestNav: 0.5, transactionType: "PURCHASE" }];
assert.strictEqual(HW.check(good({ state: s })).problems.length, 0, "₹0.50 is a price");
// a US share with zero quantity needs no price
s = good().state; s.usstocks = [{ symbol: "GONE", quantity: 0, currentPrice: 0 }]; assert.strictEqual(HW.check(good({ state: s })).problems.length, 0);
// ids name the source, so a repeat of the same problem can be recognised
assert.strictEqual(HW.check(good({ fresh: fr(99) })).problems[0].id, "price-mutualFundsHoursOld");
r = HW.check(good({ integrity: { alerts: [{ level: "critical", topic: "Repeated holdings", text: "t" }, { level: "watch", topic: "Large move", text: "t2" }] } }));
assert.deepStrictEqual(r.problems.map((p) => p.id), ["integrity-Repeated holdings", "integrity-Large move"]);
assert.ok(/Do not trust any figure/.test(r.problems[0].action) && r.problems[1].action === "", "only a serious data problem says do not trust the figures");
// long lists are cut: four INDmoney gaps, five unpriced holdings
const gaps7 = [1, 2, 3, 4, 5, 6].map((n) => ({ name: "Fund" + n, who: "Me", confirmed: true }));
r = HW.check(hc({ status: "gaps", gaps: gaps7 })); assert.ok(/Fund4/.test(r.problems[0].detail) && !/Fund5/.test(r.problems[0].detail), "four named at most");
s = good().state; s.stocks = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ symbol: "S" + n, quantity: 1, currentPrice: 0 }));
r = HW.check(good({ state: s })); assert.ok(/S5\. Net worth/.test(r.problems[0].detail) === false && /S5 and 2 more/.test(r.problems[0].detail) && !/S6,/.test(r.problems[0].detail), r.problems[0].detail);
s.stocks = s.stocks.slice(0, 5); r = HW.check(good({ state: s })); assert.ok(/S5\./.test(r.problems[0].detail) && !/more/.test(r.problems[0].detail), "exactly five: no 'and more'");
// the cloud message names the reason, and copes with no date
r = HW.check(good({ source: { fromCache: true, cachedAt: "2026-10-19T04:00:00Z", reason: "Gateway HTTP 404" } })); assert.ok(/\(Gateway HTTP 404\)/.test(r.problems[0].detail));
r = HW.check(good({ source: { fromCache: true } })); assert.ok(/an earlier day\./.test(r.problems[0].detail));

console.log("health-watch tests passed");
