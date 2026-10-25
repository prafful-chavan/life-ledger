// Portfolio mix: share of each kind of holding, the owner pivot, the exposure buckets, and the comparison with a reference mix.
const assert = require("assert");
const P = require("../portfolio-core.js");
const { groupOf } = require("../advisor-engine.js");

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg || ""} expected ${b}, got ${a}`);
const helpers = { mfValue: (t) => t.reduce((s, x) => s + (x.value || 0), 0), stockValue: (t) => t.reduce((s, x) => s + (x.value || 0), 0), usStockValue: (t) => t.reduce((s, x) => s + (x.value || 0) * 80, 0), goldValue: (g) => g.value || g.grams * 7000 || 0 };
const state = {
  mutualFunds: [
    { fundName: "Axis Large Cap Fund Direct Growth", owner: "Me", value: 300000 }, { fundName: "Axis Large Cap Fund Direct Growth", owner: "Me", value: 100000 },
    { fundName: "Axis Large Cap Fund Direct Growth", owner: "Wife", value: 100000 },
    { fundName: "ICICI Prudential Multi Asset Allocation Fund Direct Growth", owner: "Me", value: 100000 },
    { fundName: "HDFC Corporate Bond Fund", owner: "Wife", value: 50000 }, { fundName: "Nippon Gold Savings Fund", owner: "Me", value: 20000 },
    { fundName: "Sold Out Fund", owner: "Me", value: 0 },
  ],
  stocks: [{ symbol: "TCS", company: "TCS", owner: "Me", demat: "A", value: 100000 }, { symbol: "TCS", company: "TCS", owner: "Me", demat: "B", value: 50000 }, { symbol: "GOLDBEES", company: "Nippon Gold BeES", owner: "Wife", value: 30000 }, { company: "", symbol: "", owner: "Me", value: 999 }],
  usstocks: [{ symbol: "QQQ", company: "Invesco QQQ", owner: "Me", value: 1000 }],
  gold: [{ name: "Chain", owner: "Wife", value: 150000 }, { name: "Coin", owner: "Me", grams: 10 }],
  silver: [{ owner: "Wife", value: 10000 }], crypto: [{ owner: "Wife", value: 5000 }],
  fd: [{ owner: "Me", value: 200000, note: "SBI FD" }, { owner: "Wife", value: 100000 }], epf: [{ owner: "Me", value: 300000 }], ppf: [{ owner: "Me", value: 50000 }], bonds: [],
  banksaving: [{ owner: "Me", value: 40000 }, { owner: "Wife", value: 10000 }], others: [{ owner: "Wife", value: 25000, note: "Misc" }], vehicles: [{ owner: "Me", name: "Car", value: 600000 }],
};

const pos = P.positionsOf(state, helpers);
// ── positions ──
assert.strictEqual(pos.filter((p) => p.kind === "mf").length, 5, "one position per fund per owner; a fully sold fund is left out");
assert.strictEqual(pos.find((p) => p.name.startsWith("Axis") && p.owner === "Me").value, 400000, "transactions of one fund add up");
assert.strictEqual(pos.filter((p) => p.kind === "stock").length, 3, "one per stock per broker; a row with no name is ignored"); assert.strictEqual(pos.filter((p) => p.name === "TCS").length, 2, "the same stock at two brokers is two positions");
assert.strictEqual(pos.find((p) => p.kind === "us").value, 80000, "US stocks come in rupees"); assert.strictEqual(pos.find((p) => p.name === "Coin").value, 70000, "gold valued by the app's own rule");
assert.strictEqual(pos.find((p) => p.kind === "fd" && p.name === "SBI FD").owner, "Me", "the note names a plain asset"); assert.strictEqual(pos.find((p) => p.kind === "other").name, "Misc");
assert.ok(pos.every((p) => p.value > 0), "no zero positions");
const noOwner = P.positionsOf({ fd: [{ value: 5 }] }, helpers)[0]; assert.strictEqual(noOwner.owner, "Me", "no owner means Me");
assert.deepStrictEqual(P.positionsOf({}, helpers), [], "an empty household has no positions");

// ── allocation ──
const total = pos.filter((p) => !["other", "vehicle"].includes(p.kind)).reduce((t, p) => t + p.value, 0);
let a = P.allocate(pos, { groupOf });
assert.strictEqual(a.total, total); assert.strictEqual(a.left, 625000, "other assets and the car are left out and reported");
near(a.kinds.reduce((t, k) => t + k.pct, 0), 100, "kind shares add to 100"); assert.strictEqual(a.kinds.reduce((t, k) => t + k.value, 0), a.total, "kind values add to the total exactly");
assert.deepStrictEqual(a.kinds.map((k) => k.key), a.kinds.slice().sort((x, y) => y.value - x.value).map((k) => k.key), "largest first");
assert.ok(!a.kinds.some((k) => k.key === "other" || k.key === "vehicle")); assert.ok(!a.kinds.some((k) => k.key === "bonds"), "an empty kind is not listed");
assert.deepStrictEqual(a.owners, ["Me", "Wife"], "you first");
const mf = a.kinds.find((k) => k.key === "mf"); assert.strictEqual(mf.value, 670000); assert.deepStrictEqual(mf.byOwner, { Me: 520000, Wife: 150000 }); near(mf.pct, (670000 / total) * 100);
assert.deepStrictEqual(mf.funds.map((f) => [f.key, f.value]), [["equity", 500000], ["hybrid", 100000], ["debt", 50000], ["gold", 20000]], "funds split by type"); near(mf.funds[0].pctOfKind, (500000 / 670000) * 100);
for (const k of a.kinds) assert.strictEqual(Object.values(k.byOwner).reduce((t, v) => t + v, 0), k.value, k.key + ": owners add to the row");

// exposure: hybrid is half equity / half debt; a gold ETF held as a stock and a gold fund are gold; silver counts with gold
const g = Object.fromEntries(a.groups.map((x) => [x.key, x.value]));
assert.deepStrictEqual(g, { equity: 780000, debt: 750000, gold: 280000, cash: 50000, other: 5000 }, "exposure by what the money is in");
assert.strictEqual(Object.values(g).reduce((t, v) => t + v, 0), 1865000, "exposure adds to the portfolio");
near(a.groups.reduce((t, x) => t + x.pct, 0), 100, "exposure shares add to 100"); assert.strictEqual(a.groups.find((x) => x.key === "equity").byOwner.Me + a.groups.find((x) => x.key === "equity").byOwner.Wife, 780000);
assert.deepStrictEqual(a.groups.map((x) => x.key), ["equity", "debt", "gold", "cash", "other"], "in a fixed order");

// including everything the app counts as an asset: matches the Finance tab's total assets
a = P.allocate(pos, { groupOf, includeOther: true });
assert.strictEqual(a.total, 1865000 + 625000); assert.strictEqual(a.left, 0); assert.ok(a.kinds.some((k) => k.key === "vehicle") && a.kinds.some((k) => k.key === "other"));
assert.strictEqual(a.groups.find((x) => x.key === "other").value, 5000 + 625000, "other assets and the car are 'other'");
// nothing at all
a = P.allocate([], { groupOf }); assert.deepStrictEqual([a.total, a.kinds, a.groups, a.owners], [0, [], [], []]);
// a classifier that does not know anything puts everything in 'other' rather than guessing
a = P.allocate(pos, {}); assert.deepStrictEqual(a.groups.map((x) => x.key), ["other"], "without a classifier nothing is called equity");
// a group the classifier invents is 'other'
assert.deepStrictEqual(P.exposureOf({ kind: "mf", name: "x" }, () => "weird"), [["other", 1]]); assert.deepStrictEqual(P.exposureOf({ kind: "mf", name: "x" }, () => "hybrid"), [["equity", 0.5], ["debt", 0.5]]);
// vehicles and others are classified 'other' even if the classifier would say more
assert.deepStrictEqual(P.exposureOf({ kind: "vehicle", name: "Car" }, (h) => (h.cls === "other" ? "other" : "equity")), [["other", 1]]);

// ── reference mixes ──
for (const id of ["aggressive", "balanced", "conservative"]) { const r = P.referenceFor(id); assert.strictEqual(Object.values(r.mix).reduce((t, v) => t + v, 0), 100, id + " adds to 100"); assert.ok(r.label && r.note); }
assert.deepStrictEqual(P.referenceFor("target", { target: { equity: 65, gold: 10, debt: 20, cash: 5 } }).mix, { equity: 65, debt: 20, gold: 10, cash: 5 });
assert.deepStrictEqual(P.referenceFor("target", { target: { equity: 130, gold: 20, debt: 40, cash: 10 } }).mix, { equity: 65, debt: 20, gold: 10, cash: 5 }, "a target that does not add to 100 is scaled");
assert.strictEqual(P.referenceFor("target", {}), null); assert.strictEqual(P.referenceFor("target", { target: { equity: 0, debt: 0, gold: 0, cash: 0 } }), null, "an all-zero target is no target"); assert.strictEqual(P.referenceFor("nonsense"), null);
assert.deepStrictEqual(P.normalize({ equity: -5, debt: 50, gold: 50, cash: 0 }), { equity: 0, debt: 50, gold: 50, cash: 0 }, "negatives count as zero");
let age = P.referenceFor("age", { ages: [31, 29] }); assert.strictEqual(age.mix.equity, 70, "100 minus the average age (30)"); assert.deepStrictEqual(age.mix, { equity: 70, debt: 15, gold: 10, cash: 5 }); assert.ok(/average age \(30\)/.test(age.note));
assert.strictEqual(P.referenceFor("age", { ages: [15] }).mix.equity, 80, "capped at 80"); assert.strictEqual(P.referenceFor("age", { ages: [70] }).mix.equity, 30, "70 → 30"); assert.strictEqual(P.referenceFor("age", { ages: [90] }).mix.equity, 20, "floored at 20");
for (const ag of [15, 20, 21, 50, 80, 90, 99]) assert.strictEqual(Object.values(P.referenceFor("age", { ages: [ag] }).mix).reduce((t, v) => t + v, 0), 100, `age ${ag} adds to 100`);
assert.strictEqual(P.referenceFor("age", { ages: [] }), null); assert.strictEqual(P.referenceFor("age", { ages: [NaN] }), null); assert.strictEqual(P.referenceFor("age", {}), null);
// ages
assert.strictEqual(P.ageOn("1995-10-22", "2026-10-21"), 30, "the day before the birthday"); assert.strictEqual(P.ageOn("1995-10-22", "2026-10-22"), 31, "on the birthday"); assert.strictEqual(P.ageOn("1995-10-22", "2026-10-23"), 31);
assert.strictEqual(P.ageOn("2000-02-29", "2026-02-28"), 25); assert.strictEqual(P.ageOn("2000-02-29", "2026-03-01"), 26); assert.strictEqual(P.ageOn("bad", "2026-01-01"), null); assert.strictEqual(P.ageOn("2030-01-01", "2026-01-01"), null, "not born yet"); assert.strictEqual(P.ageOn("1800-01-01", "2026-01-01"), null);

// ── comparison ──
const groups = [{ key: "equity", pct: 62 }, { key: "debt", pct: 20 }, { key: "gold", pct: 15 }, { key: "cash", pct: 3 }];
let rows = P.compare(groups, { mix: { equity: 55, debt: 30, gold: 10, cash: 5 } }, 1000000);
assert.deepStrictEqual(rows.map((r) => [r.key, r.status]), [["equity", "within"], ["debt", "below"], ["gold", "within"], ["cash", "within"]], "debt is 10 points under: below");
near(rows[0].gapPP, 7, "62 − 55"); assert.strictEqual(rows[0].status, "within", "exactly 7 points is still within"); near(rows[0].gapRupees, 70000); near(rows[1].gapRupees, -100000);
rows = P.compare([{ key: "equity", pct: 62.01 }], { mix: { equity: 55, debt: 30, gold: 10, cash: 5 } }, 100); assert.strictEqual(rows[0].status, "above", "just over 7 points is above"); rows = P.compare([{ key: "equity", pct: 47.99 }], { mix: { equity: 55, debt: 30, gold: 10, cash: 5 } }, 100); assert.strictEqual(rows[0].status, "below"); rows = P.compare([{ key: "equity", pct: 48 }], { mix: { equity: 55, debt: 30, gold: 10, cash: 5 } }, 100); assert.strictEqual(rows[0].status, "within");
assert.strictEqual(P.compare([], { mix: { equity: 55, debt: 30, gold: 10, cash: 5 } }, 100).find((r) => r.key === "debt").actualPct, 0, "a missing bucket is 0%"); assert.deepStrictEqual(P.compare(groups, null, 100), [], "no reference: nothing"); assert.deepStrictEqual(P.compare(groups, { mix: {} }, 0), [], "an empty portfolio: nothing");
assert.strictEqual(P.TOLERANCE_PP, 7);
// ── details found by mutation testing ──
assert.strictEqual(P.positionsOf({ fd: [{ owner: "Me", value: 0.5 }] }, helpers).length, 1, "half a rupee is still a position");
assert.strictEqual(P.positionsOf({ fd: [{ owner: "Me", value: 0.004 }] }, helpers).length, 0, "under a paisa is nothing");
assert.strictEqual(P.positionsOf({ stocks: [{ symbol: "AB", owner: "Me", value: 5 }] }, helpers)[0].name, "AB", "a stock with no company name uses its symbol");
assert.strictEqual(P.positionsOf({ usstocks: [{ symbol: "QQQ", owner: "Me", value: 5 }] }, helpers)[0].name, "QQQ");
a = P.allocate([{ kind: "fd", name: "a", owner: "Zed", value: 5 }, { kind: "fd", name: "b", owner: "Me", value: 5 }, { kind: "fd", name: "c", owner: "Anna", value: 5 }, { kind: "fd", name: "d", owner: "Me", value: 9 }], { groupOf });
assert.deepStrictEqual(a.owners, ["Me", "Anna", "Zed"], "you first, then the others by name"); assert.deepStrictEqual(a.kinds[0].positions.map((p) => p.value), [9, 5, 5, 5], "positions largest first");
a = P.allocate([{ kind: "fd", name: "a", owner: "Me", value: 0.5 }], { groupOf }); assert.strictEqual(a.kinds.length, 1, "a half-rupee holding is listed"); assert.strictEqual(a.groups.length, 1);
a = P.allocate([{ kind: "mf", name: "Axis Large Cap", owner: "Me", value: 0.5 }], { groupOf }); assert.strictEqual(a.kinds[0].funds.length, 1);
rows = P.compare([{ key: "equity", pct: 55 }], { mix: { equity: 55, debt: 30, gold: 10, cash: 5 } }, 1); assert.strictEqual(rows[0].gapPP, 0); assert.strictEqual(rows[0].status, "within"); assert.strictEqual(P.compare([{ key: "equity", pct: 10 }], { mix: { equity: 10, debt: 0, gold: 0, cash: 90 } }, 1).find((r) => r.key === "debt").refPct, 0, "a reference of 0% is 0%, not 1%");
assert.strictEqual(P.compare([{ key: "equity", pct: 70 }], { mix: { equity: 55, debt: 30, gold: 10, cash: 5 } }, 1).length, 4, "a total of ₹1 still compares");
rows = P.compare([{ key: "equity", pct: 63 }], { mix: { equity: 55, debt: 30, gold: 10, cash: 5 } }, 100); assert.strictEqual(rows[0].status, "above"); rows = P.compare([{ key: "equity", pct: 56 }], { mix: { equity: 55, debt: 30, gold: 10, cash: 5 } }, 100); assert.strictEqual(rows[0].status, "within", "1 point above is within");
console.log("portfolio-core: all checks passed");
