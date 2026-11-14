// A stock row marked buyDateKnown:false is a lot of unknown age to the tax engine and to the sales logic, whatever its date says.
const assert = require("assert");
const T = require("../tax-core.js");
const S = require("../sales-core.js");

const row = (sym, date, extra = {}) => ({ id: "r-" + sym + date + (extra.n || ""), owner: "Me", demat: "Zerodha", symbol: sym, company: sym, quantity: 10, avgPrice: 100, invested: 1000, currentPrice: 150, purchaseDate: date, date, category: "Stock", ...extra });
const lotsOf = (stocks) => T.gains.buildLots({ stocks, mutualFunds: [], usstocks: [], sales: [] }, 95).lots;

// the tax engine
{
  const stocks = [row("A", "2023-01-10"), row("B", "2026-11-11", { buyDateKnown: false }), row("C", "2025-06-01", { buyDateKnown: true })];
  const l = Object.fromEntries(lotsOf(stocks).map((x) => [x.symbol, x]));
  assert.strictEqual(l.A.dateKnown, undefined, "no flag, a real-looking date: known"); assert.strictEqual(l.B.dateKnown, false, "the explicit flag wins even with a date that looks real"); assert.strictEqual(l.C.dateKnown, undefined, "buyDateKnown:true changes nothing");
  const held = (x, asOf) => T.gains.holding(x, asOf, asOf);
  assert.strictEqual(held(l.B, "2030-01-01").unknown, true, "unknown term, never long-term by guess"); assert.strictEqual(held(l.A, "2026-11-14").long, true);
  // the import-stamp rule still works for rows with no flag
  const sheet = [1, 2, 3, 4, 5].map((i) => row("S" + i, "2026-11-11", { n: i }));
  assert.ok(lotsOf(sheet).every((x) => x.dateKnown === false));
  // a flagged row never becomes known because the stamp is no longer the commonest date
  const mixed = [row("K1", "2024-01-01"), row("K2", "2024-02-01"), row("K3", "2024-03-01"), row("K4", "2024-04-01"), row("U1", "2026-11-11", { buyDateKnown: false }), row("U2", "2026-11-11", { buyDateKnown: false })];
  const m = lotsOf(mixed).filter((x) => /^U/.test(x.symbol)); assert.strictEqual(m.length, 2); assert.ok(m.every((x) => x.dateKnown === false));
  // unrealised: the unknown lot is flagged, not counted long or short
  const un = T.gains.unrealised(lotsOf(mixed), "2026-11-14"); assert.strictEqual(un.perLot.filter((x) => x.termUnknown).length, 2);
}
// the sales logic: the rows that are marked unknown are lots of unknown age when a share leaves the book
{
  const prev = [row("AAA", "2025-01-10", { quantity: 4, invested: 400 }), row("AAA", "2026-11-11", { quantity: 6, invested: 600, buyDateKnown: false, n: "u" })];
  const found = S.detect(prev, [], "2026-11-14");
  assert.strictEqual(found.length, 1); assert.deepStrictEqual(found[0].lots.map((l) => [l.buyDate, l.buyDateKnown, l.qty]), [["2025-01-10", true, 4], ["2026-11-11", false, 6]], "the known lot first (oldest first), the unknown one marked");
  const sale = S.buildSale(found[0], { price: 150, date: "2026-11-14", charges: 0 }, { today: "2026-11-14" }); assert.ok(sale.ok); assert.deepStrictEqual(sale.sale.lots.map((l) => l.buyDateKnown), [true, false]);
  const real = S.detect([row("AAA", "2025-01-10")], [], "2026-11-14"); assert.strictEqual(real[0].lots[0].buyDateKnown, true);
  // a typed-in buy date in the sale form still replaces the unknown date
  const typed = S.buildSale(found[0], { price: 150, date: "2026-11-14", buyDate: "2025-12-01" }, { today: "2026-11-14" }); assert.deepStrictEqual(typed.sale.lots.map((l) => [l.buyDate, l.buyDateKnown]), [["2025-01-10", true], ["2025-12-01", true]]);
}
console.log("buy-date-known: ok");
