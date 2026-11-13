// Recording a sale: shares that leave the book at a sync become a pending item; the household's price and date make the record.
const assert = require("assert");
const S = require("../sales-core.js");
const TC = require("../tax-core.js");

const row = (symbol, qty, invested, date, extra = {}) => ({ symbol, company: symbol, quantity: qty, invested, purchaseDate: date, date, owner: "Me", demat: "Zerodha", currentPrice: 100, ...extra });
// five rows share the import date, so that date is not a real buy date (the tax engine's rule)
const filler = ["A", "B", "C", "D", "E"].map((s) => row(s, 10, 1000, "2026-11-11"));

// ── detect ──
{
  const prev = [...filler, row("WIPRO", 93, 24395.76, "2026-11-11", { currentPrice: 198 })];
  const next = [...filler];
  const c = S.detect(prev, next, "2026-11-13");
  assert.strictEqual(c.length, 1);
  assert.strictEqual(c[0].symbol, "WIPRO"); assert.strictEqual(c[0].qty, 93); assert.strictEqual(c[0].cost, 24395.76);
  assert.strictEqual(c[0].whole, true); assert.strictEqual(c[0].lastPrice, 198);
  assert.strictEqual(c[0].lots[0].buyDateKnown, false, "the shared import date is not a real buy date");
  assert.strictEqual(S.detect(prev, prev, "2026-11-13").length, 0, "nothing left: nothing to ask");
  assert.strictEqual(S.detect(next, prev, "2026-11-13").length, 0, "buying more is not a sale");
}
// partial sale, oldest lots go first (first in, first out); a real date stays known
{
  const prev = [row("INFY", 10, 1000, "2023-01-10"), row("INFY", 10, 2000, "2024-06-01"), ...filler];
  const next = [row("INFY", 12, 2400, "2024-06-01"), ...filler];
  const [c] = S.detect(prev, next, "2026-11-13");
  assert.strictEqual(c.qty, 8); assert.strictEqual(c.whole, false);
  assert.deepStrictEqual(c.lots, [{ buyDate: "2023-01-10", buyDateKnown: true, qty: 8, cost: 800 }], "8 of the oldest 10 shares left, at their own cost");
  // taking exactly the first lot and one share of the second
  const [d] = S.detect(prev, [row("INFY", 9, 1800, "2024-06-01"), ...filler], "2026-11-13");
  assert.strictEqual(d.qty, 11); assert.deepStrictEqual(d.lots.map((l) => [l.buyDate, l.qty, l.cost]), [["2023-01-10", 10, 1000], ["2024-06-01", 1, 200]]);
}
// the same share at two brokers or for two people is two positions
{
  const prev = [row("TCS", 5, 500, "2024-01-01", { demat: "A" }), row("TCS", 5, 500, "2024-01-01", { demat: "B" }), ...filler];
  const c = S.detect(prev, [row("TCS", 5, 500, "2024-01-01", { demat: "A" }), ...filler], "2026-11-13");
  assert.strictEqual(c.length, 1); assert.strictEqual(c[0].demat, "B");
  const w = S.detect([row("TCS", 5, 500, "2024-01-01", { owner: "Wife" }), ...filler], filler, "2026-11-13");
  assert.strictEqual(w[0].owner, "Wife");
}
// a re-priced or re-dated row of the same quantity is not a sale; "-EQ" spelling is the same share
assert.strictEqual(S.detect([row("ITC", 10, 1000, "2024-01-01"), ...filler], [row("ITC-EQ", 10, 1000, "2026-11-11", { currentPrice: 500 }), ...filler], "2026-11-13").length, 0);
// rows with no quantity are ignored; an empty first book has nothing to lose
assert.strictEqual(S.detect([{ symbol: "X", quantity: 0 }], [], "2026-11-13").length, 0);
assert.strictEqual(S.detect([], [row("X", 1, 1, "2024-01-01")], "2026-11-13").length, 0);
// a quantity that fell by a hair above the tolerance is a sale; below it is rounding
assert.strictEqual(S.detect([row("Q", 10, 10, "2024-01-01")], [row("Q", 9.9999995, 10, "2024-01-01")], "2026-11-13").length, 0);
assert.strictEqual(S.detect([row("Q", 10, 10, "2024-01-01")], [row("Q", 9.99, 10, "2024-01-01")], "2026-11-13").length, 1);
// stamped-date rule: 5 rows, the date shared by MORE than half
assert.strictEqual(S.stampedDate([1, 2, 3, 4].map((i) => row("S" + i, 1, 1, "2026-11-11"))), null, "fewer than 5 rows: no verdict");
assert.strictEqual(S.stampedDate([...filler]), "2026-11-11");
assert.strictEqual(S.stampedDate([...filler.slice(0, 2), ...["2020-01-01", "2021-01-01", "2022-01-01"].map((d, i) => row("Z" + i, 1, 1, d))]), null, "2 of 5 is not more than half");
assert.strictEqual(S.stampedDate([...filler.slice(0, 3), ...["2020-01-01", "2021-01-01"].map((d, i) => row("Z" + i, 1, 1, d))]), "2026-11-11", "3 of 5 is");

// ── pending list ──
{
  const [c] = S.detect([...filler, row("W", 1, 100, "2025-01-01")], filler, "2026-11-13");
  assert.strictEqual(S.mergePending([c], [c]).length, 1, "the same event twice is one item");
  assert.strictEqual(S.mergePending(undefined, [c]).length, 1);
  assert.strictEqual(S.mergePending([c], [{ ...c, id: "other" }]).length, 2);
}

// ── buildSale ──
const cand = { id: "c1", key: "WIPRO|Me|Zerodha", symbol: "WIPRO", name: "Wipro", owner: "Me", demat: "Zerodha", qty: 93, cost: 24395.76, lots: [{ buyDate: "2026-11-11", buyDateKnown: false, qty: 93, cost: 24395.76 }] };
{
  const r = S.buildSale(cand, { price: 198.13, date: "2026-11-11", charges: 25 }, { today: "2026-11-13" });
  assert.ok(r.ok);
  assert.strictEqual(r.sale.gross, 18426.09); assert.strictEqual(r.sale.proceeds, 18401.09); assert.strictEqual(r.sale.cost, 24395.76); assert.strictEqual(r.sale.gain, -5994.67);
  assert.strictEqual(r.sale.lots[0].buyDateKnown, false, "still unknown: the household did not give a date");
  const k = S.buildSale(cand, { price: 198.13, date: "2026-11-11", buyDate: "2025-02-03" }, { today: "2026-11-13" }).sale;
  assert.strictEqual(k.lots[0].buyDate, "2025-02-03"); assert.strictEqual(k.lots[0].buyDateKnown, true);
  assert.strictEqual(S.buildSale(cand, { price: 198.13, date: "2026-11-11", charges: 25 }, { today: "2026-11-13" }).sale.id, r.sale.id, "the same sale gets the same id, so it can never be recorded twice");
}
const bad = (input, re) => { const r = S.buildSale(cand, input, { today: "2026-11-13" }); assert.ok(!r.ok && re.test(r.error), JSON.stringify(input) + " → " + r.error); };
bad({ price: 0, date: "2026-11-11" }, /price/);
bad({ price: -1, date: "2026-11-11" }, /price/);
bad({ price: 100 }, /date/);
bad({ price: 100, date: "2026-02-30" }, /date/);
bad({ price: 100, date: "2026-11-14" }, /future/);
assert.ok(S.buildSale(cand, { price: 100, date: "2026-11-13" }, { today: "2026-11-13" }).ok, "today is allowed");
bad({ price: 100, date: "2026-11-11", charges: -1 }, /negative/);
bad({ price: 100, date: "2026-11-11", charges: 9301.01 }, /more than/);
assert.ok(S.buildSale(cand, { price: 100, date: "2026-11-11", charges: 9300 }, { today: "2026-11-13" }).ok, "charges equal to the sale value are allowed (the money is nil)");
assert.strictEqual(S.buildSale(cand, { price: 100, date: "2026-11-11", charges: 9300 }, { today: "2026-11-13" }).sale.proceeds, 0);
bad({ price: 100, date: "2026-11-11", buyDate: "2026-11-12" }, /after they were sold/);
assert.ok(S.buildSale(cand, { price: 100, date: "2026-11-11", buyDate: "2026-11-11" }, { today: "2026-11-13" }).ok, "bought and sold the same day is allowed");
bad({ price: 100, date: "2026-11-11", buyDate: "nonsense" }, /buy date/);
assert.ok(!S.buildSale({ ...cand, qty: 0 }, { price: 1, date: "2026-11-11" }, { today: "2026-11-13" }).ok);
// a lot with a KNOWN buy date after the sale date is refused; a known earlier date keeps its own date even if a buyDate is typed
{
  const known = { ...cand, lots: [{ buyDate: "2024-05-05", buyDateKnown: true, qty: 93, cost: 24395.76 }] };
  assert.ok(!S.buildSale(known, { price: 1, date: "2024-01-01" }, { today: "2026-11-13" }).ok);
  const r = S.buildSale(known, { price: 1, date: "2026-01-01", buyDate: "2020-01-01" }, { today: "2026-11-13" });
  assert.strictEqual(r.sale.lots[0].buyDate, "2024-05-05", "a date the sheet really had is not overwritten");
}

// ── manual candidate (a sale the sync never saw) ──
{
  const m = S.manualCandidate({ symbol: "wipro", name: "Wipro", qty: 93, avgCost: 262.32, owner: "Me", demat: "Zerodha" }, "2026-11-13");
  assert.ok(m.ok); assert.strictEqual(m.cand.cost, 24395.76); assert.strictEqual(m.cand.symbol, "WIPRO"); assert.strictEqual(m.cand.lots[0].buyDateKnown, false);
  assert.strictEqual(S.manualCandidate({ symbol: "w", qty: 1, avgCost: 1, buyDate: "2024-01-01" }, "2026-11-13").cand.lots[0].buyDateKnown, true);
  for (const f of [{ qty: 1, avgCost: 1 }, { symbol: "W", qty: 0, avgCost: 1 }, { symbol: "W", qty: 1, avgCost: 0 }, { symbol: "W", qty: 1, avgCost: 1, buyDate: "2024-13-01" }]) assert.ok(!S.manualCandidate(f, "2026-11-13").ok, JSON.stringify(f));
}

// ── bank credit ──
{
  const banks = [{ id: "b1", owner: "Me", value: 50000, date: "2026-11-13" }, { id: "b2", owner: "Wife", value: 20000, date: "2026-11-13" }];
  const frozen = JSON.stringify(banks);
  const r = S.creditBank(banks, { owner: "Wife", proceeds: 18401.09 }, "2026-11-14");
  assert.ok(r.ok); assert.strictEqual(r.id, "b2"); assert.strictEqual(r.before, 20000); assert.strictEqual(r.after, 38401.09);
  assert.deepStrictEqual(r.list.map((b) => b.value), [50000, 38401.09]); assert.strictEqual(r.list[1].date, "2026-11-14"); assert.strictEqual(r.list[0].date, "2026-11-13");
  assert.strictEqual(JSON.stringify(banks), frozen, "the input is not changed");
  assert.ok(!S.creditBank([banks[0]], { owner: "Wife", proceeds: 1 }, "2026-11-14").ok);
  assert.ok(S.creditBank([{ id: "x", value: 10 }], { owner: "Me", proceeds: 5 }, "2026-11-14").ok, "a record with no owner counts as Me");
}

// ── the tax engine reads a recorded sale ──
{
  const G = TC.gains;
  const mk = (buyDate, known, sold, price, qty = 100, cost = 10000) => S.buildSale({ id: "t" + buyDate + sold, key: "K", symbol: "K", name: "Some Company", owner: "Me", qty, cost, lots: [{ buyDate, buyDateKnown: known, qty, cost }] }, { price, date: sold }, { today: "2030-01-01" }).sale;
  const fy = (sales, asOf = "2026-11-13") => G.realisedThisFY(G.buildLots({ sales }, 1).realised, asOf);
  // bought 2025-11-12, sold 2026-11-12: exactly a year is still short-term; the day after is long-term
  assert.strictEqual(fy([mk("2025-11-12", true, "2026-11-12", 150)]).rows[0].term, "short");
  assert.strictEqual(fy([mk("2025-11-12", true, "2026-11-13", 150)]).rows[0].term, "long");
  const long = fy([mk("2024-01-01", true, "2026-11-12", 150)]);
  assert.strictEqual(long.owners.Me.equityLT, 5000); assert.strictEqual(long.rows[0].gain, 5000); assert.strictEqual(long.rows[0].proceeds, 15000);
  const loss = fy([mk("2026-01-01", true, "2026-11-12", 80)]);
  assert.strictEqual(loss.owners.Me.equityST, -2000);
  // unknown buy date: listed, but in neither bucket
  const u = fy([mk("2026-11-11", false, "2026-11-12", 80)]);
  assert.strictEqual(u.rows[0].term, "unknown"); assert.strictEqual(u.owners.Me.unknownTerm, -2000);
  assert.strictEqual(u.owners.Me.equityST, 0); assert.strictEqual(u.owners.Me.equityLT, 0);
  // a sale in an earlier financial year is not this year's
  assert.strictEqual(fy([mk("2024-01-01", true, "2026-03-31", 150)]).rows.length, 0);
  assert.strictEqual(fy([mk("2024-01-01", true, "2026-04-01", 150)]).rows.length, 1);
  // a gold ETF is not listed equity
  const gold = S.buildSale({ id: "g", key: "G", symbol: "GOLD1", name: "Kotak Gold ETF", owner: "Me", qty: 10, cost: 1000, lots: [{ buyDate: "2025-12-01", buyDateKnown: true, qty: 10, cost: 1000 }] }, { price: 150, date: "2026-11-12" }, { today: "2030-01-01" }).sale;
  assert.strictEqual(fy([gold]).owners.Me.equityLT + fy([gold]).owners.Me.equityST, 0);
  assert.strictEqual(fy([gold]).owners.Me.otherST, 500); assert.strictEqual(fy([gold]).owners.Me.otherLT, 0, "a gold ETF held under a year is a short-term gain taxed at slab, not equity");
  // the proceeds of a sale in two lots are shared by quantity and add back to the whole
  const two = S.buildSale({ id: "t2", key: "K", symbol: "K", name: "Some Company", owner: "Me", qty: 30, cost: 3000, lots: [{ buyDate: "2020-01-01", buyDateKnown: true, qty: 10, cost: 500 }, { buyDate: "2026-06-01", buyDateKnown: true, qty: 20, cost: 2500 }] }, { price: 200, date: "2026-11-12", charges: 30 }, { today: "2030-01-01" }).sale;
  const t = fy([two]);
  assert.strictEqual(t.rows.reduce((a, r) => a + r.proceeds, 0), 5970); assert.deepStrictEqual(t.rows.map((r) => r.term), ["long", "short"]);
  assert.strictEqual(t.owners.Me.equityLT, 1990 - 500); assert.strictEqual(t.owners.Me.equityST, 3980 - 2500);
  // no sales, no rows; a record with no quantity is ignored
  assert.strictEqual(fy(undefined).rows.length, 0);
  assert.strictEqual(fy([{ qty: 0, lots: [{ qty: 1 }] }]).rows.length, 0);
  // the open lots are not touched by a recorded sale
  assert.strictEqual(G.buildLots({ sales: [two], stocks: [] }, 1).lots.length, 0);
}


// ── blind spots closed after the mutation run ──
{
  // ids are readable and stable
  const [c] = S.detect([...filler, row("W", 1, 100, "2025-01-01")], filler, "2026-11-13");
  assert.ok(/^salecand-[0-9a-f]{16}$/.test(c.id), c.id);
  const sale = S.buildSale(c, { price: 100, date: "2026-11-12" }, { today: "2026-11-13" }).sale;
  assert.ok(/^sale-[0-9a-f]{16}$/.test(sale.id), sale.id);
  assert.ok(/^salecand-[0-9a-f]{16}$/.test(S.manualCandidate({ symbol: "W", qty: 1, avgCost: 1 }, "2026-11-13").cand.id));
  assert.strictEqual(S.manualCandidate({ symbol: "W", qty: 1, avgCost: 1 }, "2026-11-13").cand.id, S.manualCandidate({ symbol: "W", qty: 1, avgCost: 1 }, "2026-12-01").cand.id, "the id does not depend on the day it was typed");
  assert.notStrictEqual(S.manualCandidate({ symbol: "W", qty: 1, avgCost: 1 }, "x").cand.id, S.manualCandidate({ symbol: "W", qty: 2, avgCost: 1 }, "x").cand.id);
  assert.strictEqual(sale.qty, 1, "a sale of exactly one share is a sale");
  // a manual candidate: cost is quantity × average; it has no last price
  const m = S.manualCandidate({ symbol: "W", qty: 4, avgCost: 25 }, "2026-11-13").cand;
  assert.strictEqual(m.lots[0].cost, 100); assert.strictEqual(m.lastPrice, 0); assert.strictEqual(m.cost, 100);
  // no price in the sheet → last price 0, not a made-up one
  assert.strictEqual(S.detect([{ symbol: "NP", quantity: 1, invested: 5, purchaseDate: "2024-01-01", owner: "Me" }], [], "2026-11-13")[0].lastPrice, 0);
  assert.strictEqual(S.detect([{ symbol: "NP", quantity: 1, invested: 5, purchaseDate: "2024-01-01", owner: "Me", currentPrice: 0 }], [], "2026-11-13")[0].lastPrice, 0);
  // the cost falls back to average price × quantity when the sheet has no "invested"
  assert.strictEqual(S.detect([{ symbol: "AP", quantity: 10, avgPrice: 50, purchaseDate: "2024-01-01", owner: "Me" }], [], "2026-11-13")[0].cost, 500);
  // a zero-quantity row never becomes a lot (it would make the cost NaN)
  const z = S.detect([row("Z", 0, 0, "2020-01-01"), row("Z", 10, 1000, "2024-01-01")], [row("Z", 5, 500, "2024-01-01")], "2026-11-13")[0];
  assert.strictEqual(z.cost, 500); assert.strictEqual(z.lots.length, 1);
  // the oldest lot goes first whatever order the sheet lists them in; equal dates keep the sheet's order; known dates before unknown ones
  const rev = S.detect([row("R", 10, 3000, "2025-01-01"), row("R", 10, 1000, "2022-01-01"), row("R", 10, 2000, "2024-01-01")], [row("R", 15, 4000, "2025-01-01")], "2026-11-13")[0];
  assert.deepStrictEqual(rev.lots.map((l) => [l.buyDate, l.qty, l.cost]), [["2022-01-01", 10, 1000], ["2024-01-01", 5, 1000]]);
  const tie = S.detect([row("T", 10, 111, "2024-01-01"), row("T", 10, 222, "2024-01-01"), row("T", 10, 333, "2024-01-01")], [row("T", 25, 0, "2024-01-01")], "2026-11-13")[0];
  assert.strictEqual(tie.cost, 55.5, "the first row listed goes first; only 5 of 10 → half of 111");
  const mixed = S.detect([...filler, row("M", 10, 100, "2026-11-11"), row("M", 10, 900, "2020-01-01")], [...filler, row("M", 10, 100, "2026-11-11")], "2026-11-13")[0];
  assert.strictEqual(mixed.lots[0].buyDate, "2020-01-01"); assert.strictEqual(mixed.cost, 900, "the lot with a real date is matched first");
  // the tolerance: a drop of exactly the tolerance is rounding; whole position means ≤ tolerance left
  assert.strictEqual(S.detect([row("E", 10, 10, "2024-01-01")], [row("E", 10 - S.EPS, 10, "2024-01-01")], "2026-11-13").length, 0);
  assert.strictEqual(S.detect([row("E", 10, 10, "2024-01-01")], [row("E", S.EPS, 10, "2024-01-01")], "2026-11-13")[0].whole, true);
  assert.strictEqual(S.detect([row("E", 10, 10, "2024-01-01")], [row("E", 2 * S.EPS, 10, "2024-01-01")], "2026-11-13")[0].whole, false);
  // stamped date: needs 5 rows WITH a quantity; exactly half is not "most"; the commonest date wins whatever order they come in
  assert.strictEqual(S.stampedDate([...[1, 2, 3, 4].map((i) => row("S" + i, 1, 1, "2026-11-11")), ...[1, 2, 3].map((i) => row("Z" + i, 0, 0, "2020-01-01"))]), null, "rows with no quantity do not count");
  assert.strictEqual(S.stampedDate(["2020-01-01", "2021-01-01", "2022-01-01"].map((d, i) => row("H" + i, 1, 1, d)).concat(["2026-11-11", "2026-11-11", "2026-11-11"].map((d, i) => row("G" + i, 1, 1, d)))), null, "3 of 6 is exactly half");
  assert.strictEqual(S.stampedDate([row("L", 1, 1, "2020-01-01"), ...[1, 2, 3, 4].map((i) => row("S" + i, 1, 1, "2026-11-11"))]), "2026-11-11", "the more common date wins even when it is listed second");
}
assert.strictEqual(S.detect([{ symbol: "PENNY", quantity: 1, invested: 1, purchaseDate: "2024-01-01", owner: "Me", currentPrice: 0.5 }], [], "2026-11-13")[0].lastPrice, 0.5, "a price under one rupee is kept");
console.log("sales-core extra: ok");
