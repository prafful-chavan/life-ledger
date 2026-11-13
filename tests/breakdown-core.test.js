// Portfolio breakdown: the equity part split into buckets, the biggest holdings and sector, and the year's gains next to the tax-free limit.
const assert = require("assert");
const B = require("../breakdown-core.js");
const P = require("../portfolio-core.js");
const { groupOf } = require("../advisor-engine.js");

const near = (a, b, m) => assert.ok(Math.abs(a - b) < 0.011, `${m || ""} expected ${b}, got ${a}`);

// ── fund names: the household's real funds (2026-11-13) land where a reader would put them ──
const REAL = {
  "Nippon India Pharma Fund Direct Growth": "sector", "Quant Small Cap Fund Direct Plan Growth": "small", "Parag Parikh Flexi Cap Fund Direct Growth": "flexi",
  "Tata Nifty Capital Markets Index Fund Direct Growth": "sector", "Quant ELSS Tax Saver Fund Direct Growth": "elss", "Axis Large Cap Fund Direct Growth": "large",
  "Axis ELSS Tax Saver Direct Growth": "elss", "ITI Large & Mid Cap Fund Direct Growth": "largemid", "Groww Nifty EV & New Age Automotive ETF FoF Direct Growth": "sector",
  "Bandhan Small Cap Fund Direct Growth": "small", "HDFC Flexi Cap Direct Plan Growth": "flexi", "UTI Nifty 50 Index Fund Direct Growth": "large",
  "Motilal Oswal Midcap Fund Direct Growth": "mid", "Tata India Innovation Fund Direct Growth": "sector", "Baroda BNP Paribas Nifty200 Momentum 30 Index Fund Direct Growth": "factor",
};
for (const [n, k] of Object.entries(REAL)) assert.strictEqual(B.classifyFund(n), k, n);
// more spellings
const more = { "SBI Bluechip Fund": "large", "ICICI Pru Nifty Next 50 Index": "large", "HDFC Mid-Cap Opportunities Fund": "mid", "Kotak Emerging Equity (Large & Mid)": "largemid", "Nippon Small Cap": "small", "Mirae Asset NYSE FANG+ ETF FoF": "intl", "Motilal Oswal Nasdaq 100 FoF": "intl", "Edelweiss US Technology Equity FoF": "intl", "SBI Banking & Financial Services": "sector", "ICICI Pru Infrastructure": "sector", "Quant Focused Fund": "flexi", "Kotak Multicap": "flexi", "Axis Tax Saver": "elss", "Some Fund Nobody Heard Of": "other", "": "other", "Nifty Alpha 50 Index": "factor" };
for (const [n, k] of Object.entries(more)) assert.strictEqual(B.classifyFund(n), k, n);
assert.strictEqual(B.classifyFund(null), "other");
// a mid-cap fund is mid; "large & mid" is not mid; an ELSS in a sector name is still ELSS
assert.strictEqual(B.classifyFund("X Large and Mid Cap"), "largemid");
assert.strictEqual(B.classifyFund("Pharma ELSS"), "elss");
// sectors
assert.strictEqual(B.sectorOf("Nippon India Pharma Fund"), "Pharma & healthcare");
assert.strictEqual(B.sectorOf("Tata Nifty Capital Markets Index Fund"), "Financials");
assert.strictEqual(B.sectorOf("Groww Nifty EV & New Age Automotive ETF FoF"), "Auto & EV");
assert.strictEqual(B.sectorOf("Tata India Innovation Fund"), "Innovation (thematic)");
assert.strictEqual(B.sectorOf("ICICI Pru Infrastructure"), "Infrastructure & real estate");
assert.strictEqual(B.sectorOf("Zzz"), "Other thematic");
// stocks and ETFs
assert.strictEqual(B.classifyStock("Motilal Oswal Nasdaq 100 ETF", "ETF"), "intl");
assert.strictEqual(B.classifyStock("Nippon India ETF Nifty BeES", "ETF"), "large");
assert.strictEqual(B.classifyStock("Nippon Nifty Midcap 150 ETF", "ETF"), "mid");
assert.strictEqual(B.classifyStock("Some PSU Bank ETF", "ETF"), "sector");
assert.strictEqual(B.classifyStock("Infosys Ltd", "Equity"), "direct");
assert.strictEqual(B.classifyStock("Infosys Ltd", undefined), "direct");
assert.strictEqual(B.classifyStock("Gold BeES", ""), "large", "a name with 'bees' is an ETF (a gold ETF never reaches here: it is not equity)");

// ── the breakdown ──
const helpers = { mfValue: (t) => t.reduce((s, x) => s + (x.value || 0), 0), stockValue: (t) => t.reduce((s, x) => s + (x.value || 0), 0), usStockValue: (t) => t.reduce((s, x) => s + (x.value || 0) * 80, 0), goldValue: (g) => g.value || 0 };
const state = {
  mutualFunds: [
    { fundName: "Nippon India Pharma Fund Direct Growth", owner: "Me", value: 900000 }, { fundName: "Nippon India Pharma Fund Direct Growth", owner: "Wife", value: 100000 },
    { fundName: "Parag Parikh Flexi Cap Fund Direct Growth", owner: "Me", value: 1000000 },
    { fundName: "UTI Nifty 50 Index Fund Direct Growth", owner: "Me", value: 500000 },
    { fundName: "Quant Small Cap Fund Direct Plan Growth", owner: "Wife", value: 400000 },
    { fundName: "ICICI Prudential Multi Asset Allocation Fund Direct Growth", owner: "Me", value: 200000 },
    { fundName: "HDFC Corporate Bond Fund", owner: "Wife", value: 300000 }, { fundName: "Nippon Gold Savings Fund", owner: "Me", value: 20000 },
    { fundName: "Mystery Opportunities", owner: "Me", value: 50000 },
  ],
  stocks: [
    { symbol: "TCS", company: "TCS", owner: "Me", demat: "A", value: 100000, category: "Equity" }, { symbol: "TCS", company: "TCS", owner: "Me", demat: "B", value: 50000, category: "Equity" },
    { symbol: "MON100", company: "Motilal Oswal Nasdaq 100 ETF", owner: "Me", demat: "A", value: 130000, category: "ETF" },
    { symbol: "GOLD1", company: "Kotak Gold ETF", owner: "Me", demat: "A", value: 195000, category: "ETF" },
  ],
  usstocks: [{ symbol: "QQQ", company: "Invesco QQQ", owner: "Me", value: 1000 }],
  fd: [{ owner: "Me", value: 200000 }],
};
const pos = P.positionsOf(state, helpers);
const alloc = P.allocate(pos, { groupOf });
const eqRow = alloc.groups.find((g) => g.key === "equity");
const bd = B.breakdown(pos, groupOf);
near(bd.total, eqRow.value, "the breakdown's total is the Portfolio mix equity row");
near(bd.buckets.reduce((t, b) => t + b.value, 0), bd.total, "buckets add up to the total");
near(bd.buckets.reduce((t, b) => t + b.pct, 0), 100, "shares add to 100");
const get = (k) => bd.buckets.find((b) => b.key === k);
near(get("sector").value, 1000000, "pharma in two names, 9 + 1 lakh");
near(get("flexi").value, 1000000); near(get("large").value, 500000); near(get("small").value, 400000);
near(get("hybrid").value, 100000, "a multi-asset fund counts only its equity half");
near(get("direct").value, 150000, "TCS at two brokers is one direct holding of 1.5 lakh"); assert.strictEqual(get("direct").holdings.length, 1, "the same share at two brokers is one holding of one person");
near(get("intl").value, 130000 + 1000 * 80, "the Nasdaq ETF and the US stock");
near(get("other").value, 50000); assert.deepStrictEqual(get("other").holdings.map((h) => h.name), ["Mystery Opportunities"]);
assert.ok(!bd.buckets.some((b) => /debt|gold/i.test(b.label)), "debt and gold funds, and the gold ETF, are not in the equity split");
// sorted largest first; empty buckets are left out
assert.deepStrictEqual(bd.buckets.map((b) => b.value), [...bd.buckets.map((b) => b.value)].sort((a, b) => b - a));
assert.ok(!get("mid") && !get("elss"));
// holdings inside a bucket are sorted and their shares are of the whole equity
assert.deepStrictEqual(get("sector").holdings.map((h) => [h.name, h.owner]), [["Nippon India Pharma Fund Direct Growth", "Me"], ["Nippon India Pharma Fund Direct Growth", "Wife"]]);
near(get("sector").holdings[0].pct, (900000 / bd.total) * 100);
// top holdings: one row per name, two owners together
assert.strictEqual(bd.top[0].name, "Nippon India Pharma Fund Direct Growth"); near(bd.top[0].value, 1000000); assert.deepStrictEqual(bd.top[0].owners.sort(), ["Me", "Wife"]);
assert.strictEqual(bd.top.length, 5);
// sectors: only sector funds; direct stocks are not guessed into a sector
assert.deepStrictEqual(bd.sectors.map((s) => s.label), ["Pharma & healthcare"]); near(bd.sectors[0].pct, (1000000 / bd.total) * 100);
// notes: say what is not known
assert.ok(bd.notes.some((n) => /direct stock/.test(n) && /not recorded/.test(n)));
assert.ok(bd.notes.some((n) => /Mystery Opportunities/.test(n)));
assert.ok(bd.notes.some((n) => /Overlap/.test(n)));
// no equity at all
{ const e = B.breakdown(P.positionsOf({ fd: [{ owner: "Me", value: 100 }] }, helpers), groupOf); assert.strictEqual(e.total, 0); assert.deepStrictEqual(e.buckets, []); assert.deepStrictEqual(e.top, []); }
assert.strictEqual(B.breakdown([], groupOf).total, 0); assert.strictEqual(B.breakdown(null, groupOf).total, 0);
// a one-share note reads naturally
assert.ok(B.breakdown(P.positionsOf({ stocks: [{ symbol: "TCS", company: "TCS", owner: "Me", demat: "A", value: 10 }] }, helpers), groupOf).notes[0].includes("1 direct stock "));

// ── gains view ──
{
  const lot = (owner, name, gain, long, extra = {}) => ({ owner, name, cat: "equity", gain, long, termUnknown: false, ...extra });
  const perLot = [lot("Me", "A", 50000, true), lot("Me", "B", -30000, false), lot("Me", "C", -20000, true), lot("Me", "D", -1000, true), lot("Me", "E", -5000, true), lot("Me", "F", 8000, false), lot("Me", "G", 9000, true, { cat: "debt" }), lot("Me", "H", 700, null, { termUnknown: true }),
    lot("Wife", "W", 20000, true)];
  const realised = { owners: { Me: { equityST: 1000, equityLT: 70000, otherST: 0, otherLT: 5000, unknownTerm: -300 } } };
  const g = B.gainsView(perLot, realised, { exemption: 125000 });
  assert.deepStrictEqual(g.map((x) => x.owner), ["Me", "Wife"], "Me first");
  const me = g[0], w = g[1];
  assert.strictEqual(me.unrealisedGain, 50000 + 8000 + 9000 + 700); assert.strictEqual(me.unrealisedLoss, -56000);
  assert.deepStrictEqual(me.biggestLosses, [{ name: "B", gain: -30000 }, { name: "C", gain: -20000 }, { name: "E", gain: -5000 }]);
  assert.strictEqual(me.longEquityGainOpen, 50000, "only long-term equity gains: not the short-term, not debt, not a lot of unknown term");
  assert.strictEqual(me.unknownTermLots, 1);
  assert.strictEqual(me.realisedLong, 75000); assert.strictEqual(me.realisedShort, 1000); assert.strictEqual(me.realisedUnknownTerm, -300);
  assert.strictEqual(me.exemptionUsed, 70000); assert.strictEqual(me.exemptionLeft, 55000);
  assert.strictEqual(w.exemptionUsed, 0); assert.strictEqual(w.exemptionLeft, 125000); assert.strictEqual(w.longEquityGainOpen, 20000);
  // boundaries: exactly the limit used → nothing left; over the limit → still nothing left, never negative; a long-term LOSS does not "use" any
  assert.strictEqual(B.gainsView([], { owners: { Me: { equityLT: 125000 } } }, { exemption: 125000 })[0].exemptionLeft, 0);
  assert.strictEqual(B.gainsView([], { owners: { Me: { equityLT: 130000 } } }, { exemption: 125000 })[0].exemptionLeft, 0);
  assert.strictEqual(B.gainsView([], { owners: { Me: { equityLT: 130000 } } }, { exemption: 125000 })[0].exemptionUsed, 125000);
  assert.strictEqual(B.gainsView([], { owners: { Me: { equityLT: -9000 } } }, { exemption: 125000 })[0].exemptionLeft, 125000);
  assert.strictEqual(B.gainsView([], { owners: { Me: { equityLT: 124999 } } }, { exemption: 125000 })[0].exemptionLeft, 1);
  // no limit given → no guess
  const none = B.gainsView(perLot, realised, {})[0]; assert.strictEqual(none.exemptionLeft, null); assert.strictEqual(none.exemptionUsed, null);
  assert.deepStrictEqual(B.gainsView([], null, { exemption: 1 }), []);
  assert.deepStrictEqual(B.gainsView(undefined, undefined, undefined), []);
  // an owner who only has realised gains still appears
  assert.deepStrictEqual(B.gainsView([], { owners: { Wife: { equityLT: 5 } } }, { exemption: 10 }).map((x) => x.owner), ["Wife"]);
}

// ── blind spots closed after the mutation run ──
assert.strictEqual(B.classifyFund("Nifty 100 Index Fund"), "large"); assert.strictEqual(B.classifyFund("Some Top 100 Fund"), "large");
{
  // listed smallest first, so a sort that does nothing is caught; two different funds in one bucket stay two holdings
  const st = { mutualFunds: [
    { fundName: "Tiny Flexi Cap Fund", owner: "Me", value: 1 },
    { fundName: "Other Flexi Cap Fund", owner: "Me", value: 20 },
    { fundName: "Big Flexi Cap Fund", owner: "Me", value: 300 },
    { fundName: "Zeta Infrastructure Fund", owner: "Me", value: 4000 },
    { fundName: "Alpha Pharma Fund", owner: "Me", value: 50000 },
    { fundName: "Beta Banking Fund", owner: "Me", value: 600000 },
    { fundName: "Gamma Small Cap Fund", owner: "Me", value: 7 },
    { fundName: "Delta Midcap Fund", owner: "Me", value: 8000000 },
  ] };
  const x = B.breakdown(P.positionsOf(st, helpers), groupOf);
  assert.deepStrictEqual(x.buckets.map((b) => b.key), ["mid", "sector", "flexi", "small"]);
  assert.deepStrictEqual(x.buckets.find((b) => b.key === "flexi").holdings.map((h) => h.name), ["Big Flexi Cap Fund", "Other Flexi Cap Fund", "Tiny Flexi Cap Fund"], "two or more funds in a bucket, largest first, a ₹1 holding kept");
  assert.deepStrictEqual(x.top.map((t) => t.name), ["Delta Midcap Fund", "Beta Banking Fund", "Alpha Pharma Fund", "Zeta Infrastructure Fund", "Big Flexi Cap Fund"]);
  assert.deepStrictEqual(x.sectors.map((t) => t.label), ["Financials", "Pharma & healthcare", "Infrastructure & real estate"]);
  assert.strictEqual(x.sectors[0].value, 600000); assert.strictEqual(x.sectors[1].value, 50000); assert.strictEqual(x.sectors[2].value, 4000);
  assert.strictEqual(x.buckets.find((b) => b.key === "small").value, 7);
}
{
  const lot = (owner, gain, long, extra = {}) => ({ owner, name: "L" + gain, cat: "equity", gain, long, termUnknown: false, ...extra });
  const g = B.gainsView([lot("Me", -5, true), lot("Me", 0, true), lot("Me", 0.5, true), lot("Me", -0.5, false)], { owners: { Me: { equityST: 1000, otherST: 200, equityLT: 0, otherLT: 0 } } }, { exemption: 1 })[0];
  assert.deepStrictEqual(g.biggestLosses.map((l) => l.gain), [-5, -0.5], "a lot with no gain is not a loss");
  assert.strictEqual(g.unrealisedLoss, -5.5); assert.strictEqual(g.unrealisedGain, 0.5); assert.strictEqual(g.longEquityGainOpen, 0.5);
  assert.strictEqual(g.realisedShort, 1200, "short-term equity and short-term other are added");
  // Me first however the lots are listed, then the others alphabetically
  assert.deepStrictEqual(B.gainsView([lot("Wife", 1, true), lot("Zed", 1, true), lot("Archana", 1, true), lot("Me", 1, true)], {}, { exemption: 1 }).map((x) => x.owner), ["Me", "Archana", "Wife", "Zed"]);
  assert.deepStrictEqual(B.gainsView([lot("Wife", 1, true), lot("Me", 1, true)], {}, { exemption: 1 }).map((x) => x.owner), ["Me", "Wife"]);
}
console.log("breakdown-core: ok");
