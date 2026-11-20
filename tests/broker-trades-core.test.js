// Broker trades → dated lots: file reading, merging, FIFO replay, reconciliation, applying.
const assert = require("assert");
const B = require("../broker-trades-core.js");

const Z_HEAD = "symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time";
const z = (sym, date, side, qty, price, id, extra = {}) => [sym, "INE000", date, extra.exchange || "NSE", extra.segment || "EQ", "EQ", side, "false", qty, price, id, "o" + id, `${date}T10:00:00`].join(",");
const zfile = (...lines) => [Z_HEAD, ...lines].join("\n");
const G_HEAD = "Stock name,Symbol,ISIN,Type,Quantity,Value,Exchange,Execution date and time";
const g = (sym, side, qty, value, when) => `${sym} LTD,${sym},INE000,${side},${qty},${value},NSE,${when}`;

// ── CSV reading ──
assert.deepStrictEqual(B.parseCSV('a,b\n1,2\n'), [["a", "b"], ["1", "2"]]);
assert.deepStrictEqual(B.parseCSV('a,"b,c"\r\n"x ""y""",2'), [["a", "b,c"], ['x "y"', "2"]]);
assert.deepStrictEqual(B.parseCSV("﻿a,b\n\n,\n1,2"), [["a", "b"], ["1", "2"]], "byte-order mark and blank lines");
assert.deepStrictEqual(B.parseCSV('a,"b\nc"\n'), [["a", "b\nc"]]);
assert.deepStrictEqual(B.parseCSV(""), []); assert.deepStrictEqual(B.parseCSV(null), []);

// ── which file is it ──
assert.strictEqual(B.detectFormat(zfile()), "zerodha-tradebook"); assert.strictEqual(B.detectFormat(G_HEAD + "\n"), "groww-history");
assert.strictEqual(B.detectFormat("Instrument,Qty.,Avg. cost\nA,1,2"), null); assert.strictEqual(B.detectFormat(""), null); assert.strictEqual(B.detectFormat("symbol,isin\nA,B"), null);
assert.strictEqual(B.detectFormat(zfile().replace("trade_id", "tid")), null, "a missing column is not a tradebook");
{ const r = B.parseFile("Instrument,Qty.\nA,1", {}); assert.strictEqual(r.format, null); assert.strictEqual(r.trades.length, 0); assert.ok(r.errors.length); }

// ── Zerodha ──
{
  const r = B.parseZerodha(zfile(z("M&M", "2024-01-08", "buy", "3.000000", "1639.550049", "11"), z("VBL", "2024-02-01", "sell", "2", "500", "12"), z("NIFTY", "2024-02-01", "buy", "1", "1", "13", { segment: "FO" }), z("X", "2024-13-01", "buy", "1", "1", "14"), z("Y", "2024-02-01", "hold", "1", "1", "15"), z("Z", "2024-02-01", "buy", "0", "1", "16"), z("Q", "2024-02-01", "buy", "1", "0", "17")), { owner: "Me", source: "f.csv" });
  assert.strictEqual(r.trades.length, 2); assert.strictEqual(r.skipped, 1, "a futures trade is skipped, not an error"); assert.strictEqual(r.errors.length, 4);
  const t = r.trades[0]; assert.deepStrictEqual([t.id, t.broker, t.demat, t.owner, t.symbol, t.date, t.side, t.qty, t.price, t.source], ["z:NSE:11", "Zerodha", "Zerodha", "Me", "M&M", "2024-01-08", "buy", 3, 1639.5500, "f.csv"]);
  assert.strictEqual(t.time, "2024-01-08T10:00:00"); assert.strictEqual(r.trades[1].side, "sell");
  assert.strictEqual(B.parseZerodha(zfile(z("A-EQ", "2024-01-08", "buy", 1, 1, "1")), {}).trades[0].symbol, "A", "a -EQ suffix is dropped");
  assert.strictEqual(B.parseZerodha(zfile(z("a", "2024-01-08", "BUY", 1, 1, "1")), {}).trades[0].side, "buy", "case does not matter");
  assert.strictEqual(B.parseZerodha(zfile(z("A", "2024-01-08", "buy", 1, 1, "1")), {}).trades[0].owner, "Me", "default owner");
  assert.strictEqual(B.parseZerodha(zfile(z("A", "2024-01-08", "buy", '"1,000"', '"1,500.50"', "1")), {}).trades[0].qty, 1000, "thousands commas");
  const noCol = B.parseZerodha("symbol,trade_date\nA,2024-01-01", {}); assert.strictEqual(noCol.trades.length, 0); assert.ok(/trade_type/.test(noCol.errors[0]));
  assert.strictEqual(B.parseZerodha(zfile(z("A", "2024-01-08", "buy", 1, 1, "1", { exchange: "BSE" })), {}).trades[0].id, "z:BSE:1", "the exchange is part of the id");
  assert.strictEqual(B.parseZerodha(zfile(z("A", "2024-01-08", "buy", 1, 1, "1")).replace(",EQ,EQ,", ",,EQ,"), {}).trades.length, 1, "a blank segment is taken as equity");
}
// ── Groww ──
{
  const r = B.parseGroww([G_HEAD, g("NIFTYBEES", "BUY", "72", "19080.72", "07-10-2024 09:15 AM"), g("NIFTYBEES", "SELL", "2", "540", "27-08-2026 12:05 PM"), g("A", "BUY", "1", "10", "27-08-2026 12:00 AM"), g("B", "BUY", "0", "10", "27-08-2026 10:46 AM"), g("C", "BUY", "1", "10", "32-08-2026 10:46 AM"), g("D", "HOLD", "1", "10", "27-08-2026 10:46 AM"), g("E", "BUY", "1", "10", "27-08-2026 13:46 PM"), g("F", "BUY", "1", "10", "garbage")].join("\n"), { owner: "Wife" });
  assert.strictEqual(r.trades.length, 3); assert.strictEqual(r.errors.length, 5);
  const [a, b, c] = r.trades;
  assert.deepStrictEqual([a.symbol, a.date, a.time, a.side, a.qty, a.owner, a.demat, a.broker], ["NIFTYBEES", "2024-10-07", "2024-10-07T09:15:00", "buy", 72, "Wife", "Groww", "Groww"]);
  assert.strictEqual(a.price, Math.round(19080.72 / 72 * 10000) / 10000, "price = value ÷ quantity");
  assert.strictEqual(b.time, "2026-08-27T12:05:00", "12:05 PM is noon"); assert.strictEqual(c.time, "2026-08-27T00:00:00", "12:00 AM is midnight");
  assert.strictEqual(B.parseGroww([G_HEAD, g("A", "BUY", "1", "10", "7-8-2026 1:05 PM")].join("\n"), {}).trades[0].time, "2026-08-07T13:05:00", "single digits");
  assert.strictEqual(B.parseGroww([G_HEAD, g("A", "BUY", "1", "10", "07-10-2024 09:15 AM")].join("\n"), {}).trades[0].owner, "Wife", "default owner");
  assert.strictEqual(B.parseGroww("Symbol,Type\nA,BUY", {}).trades.length, 0);
  // the same fill twice in one file = two fills; the same file read twice and merged = still the same fills
  const dup = [G_HEAD, g("A", "BUY", "5", "50", "01-01-2026 10:00 AM"), g("A", "BUY", "5", "50", "01-01-2026 10:00 AM")].join("\n");
  const one = B.parseGroww(dup, {}), two = B.parseGroww(dup, {});
  assert.strictEqual(one.trades.length, 2); assert.notStrictEqual(one.trades[0].id, one.trades[1].id);
  const merged = B.mergeTrades(one.trades, two.trades); assert.strictEqual(merged.trades.length, 2); assert.strictEqual(merged.duplicates, 2); assert.strictEqual(merged.added, 0);
}
// ── merging ──
{
  const a = B.parseZerodha(zfile(z("A", "2024-01-08", "buy", 1, 1, "1"), z("A", "2024-03-01", "buy", 1, 2, "2")), {}).trades, b = B.parseZerodha(zfile(z("A", "2024-03-01", "buy", 1, 2, "2"), z("A", "2024-02-01", "sell", 1, 3, "3")), {}).trades;
  const m = B.mergeTrades(a, b);
  assert.deepStrictEqual([m.trades.length, m.added, m.duplicates], [3, 1, 1]); assert.deepStrictEqual(m.trades.map((t) => t.date), ["2024-01-08", "2024-02-01", "2024-03-01"], "oldest first");
  assert.deepStrictEqual(B.mergeTrades(null, null), { trades: [], added: 0, duplicates: 0 }); assert.strictEqual(B.mergeTrades([null, {}], [null, {}]).trades.length, 0);
  assert.strictEqual(B.mergeTrades(a, []).trades.length, 2);
}

// ── FIFO replay ──
const trade = (side, date, qty, price, extra = {}) => ({ id: `${side}${date}${qty}${extra.n || ""}`, owner: extra.owner || "Me", demat: extra.demat || "Zerodha", symbol: extra.symbol || "AAA", date, time: extra.time || date + "T10:00:00", side, qty, price });
{
  const rep = B.replay([trade("buy", "2024-01-01", 10, 100), trade("buy", "2024-02-01", 10, 120), trade("sell", "2024-03-01", 12, 150)]);
  const p = rep.get("Me|Zerodha|AAA");
  assert.deepStrictEqual(p.lots, [{ date: "2024-02-01", qty: 8, price: 120 }], "the oldest 10 and 2 of the next are gone");
  assert.deepStrictEqual([p.qty, p.cost, p.bought, p.sold, p.oversold, p.first, p.last], [8, 960, 20, 12, 0, "2024-01-01", "2024-03-01"]);
  // order in the input does not matter; same instant: the buy comes before the sell
  const p2 = B.replay([trade("sell", "2024-03-01", 12, 150), trade("buy", "2024-02-01", 10, 120), trade("buy", "2024-01-01", 10, 100)]).get("Me|Zerodha|AAA"); assert.deepStrictEqual(p2.lots, p.lots);
  const same = B.replay([trade("sell", "2024-01-01", 5, 11, { time: "2024-01-01T10:00:00" }), trade("buy", "2024-01-01", 5, 10, { time: "2024-01-01T10:00:00" })]).get("Me|Zerodha|AAA");
  assert.deepStrictEqual([same.qty, same.oversold], [0, 0], "a buy and a sell at the same second: the buy first");
  // selling shares never bought: counted, the rest is untouched
  const o = B.replay([trade("buy", "2024-01-01", 3, 100), trade("sell", "2024-02-01", 5, 120)]).get("Me|Zerodha|AAA"); assert.deepStrictEqual([o.qty, o.oversold], [0, 2]);
  assert.strictEqual(B.replay([trade("sell", "2024-02-01", 5, 120)]).get("Me|Zerodha|AAA").oversold, 5);
  // positions are kept apart by owner, broker and share; a symbol suffix does not split one
  const m = B.replay([trade("buy", "2024-01-01", 1, 1), trade("buy", "2024-01-01", 1, 1, { owner: "Wife", n: "w" }), trade("buy", "2024-01-01", 1, 1, { demat: "Upstox", n: "u" }), trade("buy", "2024-01-01", 1, 1, { symbol: "BBB", n: "b" }), trade("buy", "2024-01-01", 2, 1, { symbol: "AAA-EQ", n: "e" })]);
  assert.strictEqual(m.size, 4); assert.strictEqual(m.get("Me|Zerodha|AAA").qty, 3);
  assert.strictEqual(B.replay(null).size, 0);
  // fractions are not lost
  assert.strictEqual(B.replay([trade("buy", "2024-01-01", 0.1, 100, { n: "a" }), trade("buy", "2024-01-02", 0.2, 100, { n: "b" })]).get("Me|Zerodha|AAA").qty, 0.3);
}

// ── the holdings the trades are checked against ──
const row = (sym, qty, avg, extra = {}) => ({ id: extra.id || "r-" + sym + (extra.owner || "Me") + qty, owner: extra.owner || "Me", demat: extra.demat || "Zerodha", symbol: sym, company: sym, quantity: qty, avgPrice: avg, invested: extra.invested !== undefined ? extra.invested : Math.round(qty * avg * 100) / 100, purchaseDate: extra.date || "2026-11-11", date: extra.date || "2026-11-11", ...(extra.flag === undefined ? {} : { buyDateKnown: extra.flag }) });
const unknowns = (list) => list.map((r) => ({ ...r, buyDateKnown: false }));
assert.strictEqual(B.stampedDate([1, 2, 3, 4].map((i) => row("S" + i, 1, 1))), null, "fewer than 5 rows");
assert.strictEqual(B.stampedDate([1, 2, 3, 4, 5].map((i) => row("S" + i, 1, 1))), "2026-11-11");
assert.strictEqual(B.stampedDate([1, 2, 3, 4, 5, 6].map((i) => row("S" + i, 1, 1, { date: i <= 3 ? "2026-11-11" : "2025-0" + i + "-01" }))), null, "exactly half is not more than half");
{
  const h = B.heldPositions([row("A", 3, 100), row("A", 7, 110, { id: "r2" }), row("B", 0, 1), row("C", 1, 5, { owner: "Wife" })]);
  assert.strictEqual(h.size, 2); const a = h.get("Me|Zerodha|A"); assert.deepStrictEqual([a.qty, a.cost, a.rows.length], [10, 1070, 2]); assert.strictEqual(a.avg, 107);
  assert.strictEqual(a.allUnknown, false, "with fewer than 5 rows the stamp rule does not fire, so a date looks real (the same rule the tax engine uses)");
  assert.strictEqual(h.get("Wife|Zerodha|C").allUnknown, false);
  assert.strictEqual(B.heldPositions(unknowns([row("A", 1, 1)])).get("Me|Zerodha|A").allUnknown, true, "the explicit flag marks it unknown");
  assert.strictEqual(B.heldPositions([row("A", 1, 1, { date: "n/a" })]).get("Me|Zerodha|A").allUnknown, true, "no date at all is unknown");
  assert.strictEqual(B.heldPositions(null).size, 0);
}

// ── reconciling ──
const T = (list) => list.map((t, i) => ({ ...t, id: t.id + i }));
{
  const trades = T([trade("buy", "2025-01-10", 6, 100), trade("buy", "2025-03-10", 4, 120)]);   // 10 shares, avg 108
  const ok = B.reconcile(trades, unknowns([row("AAA", 10, 108)])).items[0];
  assert.deepStrictEqual([ok.status, ok.explainedQty, ok.missingQty, ok.tradeAvg, ok.heldAvg, ok.first, ok.last], ["exact", 10, 0, 108, 108, "2025-01-10", "2025-03-10"]);
  assert.strictEqual(B.reconcile(trades, unknowns([row("AAA", 10, 108.4)])).items[0].status, "exact", "within half a percent");
  assert.strictEqual(B.reconcile(trades, unknowns([row("AAA", 10, 108.5)])).items[0].status, "exact", "₹0.5 is always allowed");
  assert.strictEqual(B.reconcile(trades, unknowns([row("AAA", 10, 108.54)])).items[0].status, "exact", "0.54 away is inside half a percent of 108.54");
  assert.strictEqual(B.reconcile(trades, unknowns([row("AAA", 10, 108.6)])).items[0].status, "check", "0.6 away is outside it");
  assert.strictEqual(B.reconcile(trades, unknowns([row("AAA", 10, 110)])).items[0].status, "check", "a different cost with the same shares is not applied");
  assert.ok(/averag/.test(B.reconcile(trades, unknowns([row("AAA", 10, 110)])).items[0].note));
  const short = B.reconcile(trades, unknowns([row("AAA", 15, 108)])).items[0]; assert.deepStrictEqual([short.status, short.missingQty, short.explainedQty], ["short", 5, 10]); assert.ok(/10 of 15/.test(short.note));
  const extra = B.reconcile(trades, unknowns([row("AAA", 7, 108)])).items[0]; assert.deepStrictEqual([extra.status, extra.missingQty], ["extra", -3]); assert.ok(/split|sale|bonus/.test(extra.note));
  assert.strictEqual(B.reconcile(trades, unknowns([row("ZZZ", 3, 10)])).items[0].status, "none");
  assert.strictEqual(B.reconcile(trades, unknowns([row("AAA", 10, 108, { demat: "Upstox" })])).items[0].status, "none", "another broker's holding is not explained by this broker's trades");
  assert.strictEqual(B.reconcile(trades, unknowns([row("AAA", 10, 108, { owner: "Wife" })])).items[0].status, "none");
  // a share the files show fully sold: nothing left, so it cannot explain a holding
  const sold = B.reconcile(T([trade("buy", "2025-01-10", 5, 100), trade("sell", "2025-02-10", 5, 110)]), unknowns([row("AAA", 5, 100)])).items[0]; assert.strictEqual(sold.status, "none"); assert.ok(/sold/.test(sold.note));
  // earlier buys missing is said
  const ov = B.reconcile(T([trade("sell", "2025-01-10", 2, 100), trade("buy", "2025-02-10", 3, 100)]), unknowns([row("AAA", 4, 100)])).items[0]; assert.strictEqual(ov.status, "short"); assert.ok(/never show/.test(ov.note)); assert.strictEqual(ov.oversold, 2);
  // positions the files still show but the books no longer have
  const sold2 = B.reconcile(trades, unknowns([row("OTHER", 1, 1)])); assert.deepStrictEqual(sold2.soldSince.map((s) => [s.symbol, s.qty, s.last]), [["AAA", 10, "2025-03-10"]]);
  assert.strictEqual(B.reconcile(trades, unknowns([row("AAA", 10, 108)])).soldSince.length, 0); assert.strictEqual(B.reconcile(trades, []).tradeCount, 2);
  // a position whose rows already carry real dates is marked
  assert.strictEqual(B.reconcile(trades, [row("AAA", 10, 108, { date: "2024-06-01", flag: true })]).items[0].alreadyDated, true);
  // ordering: exact first, then short, check, extra, none; yours before hers
  const mix = B.reconcile(T([trade("buy", "2025-01-10", 1, 1, { symbol: "E1" }), trade("buy", "2025-01-10", 1, 1, { symbol: "S1" }), trade("buy", "2025-01-10", 1, 1, { symbol: "C1" }), trade("buy", "2025-01-10", 5, 1, { symbol: "X1" }), trade("buy", "2025-01-10", 1, 1, { symbol: "E2", owner: "Wife", demat: "Groww" })]), unknowns([row("N1", 1, 1), row("X1", 1, 1), row("C1", 1, 50), row("S1", 3, 1), row("E1", 1, 1), row("E2", 1, 1, { owner: "Wife", demat: "Groww" })]));
  assert.deepStrictEqual(mix.items.map((i) => i.symbol + ":" + i.status), ["E1:exact", "E2:exact", "S1:short", "C1:check", "X1:extra", "N1:none"]);
}

// ── applying ──
const apply = (stocks, trades, choose) => { const rec = B.reconcile(trades, stocks); return { rec, ...B.apply(stocks, rec, choose, "2026-11-14") }; };
{
  // exact: one row per day; same-day buys merge; qty and invested unchanged; flags and dates set
  const trades = T([trade("buy", "2025-01-10", 3, 100), trade("buy", "2025-01-10", 3, 100, { time: "2025-01-10T11:00:00" }), trade("buy", "2025-03-10", 4, 120)]);
  const held = unknowns([row("AAA", 10, 108, { invested: 1080 }), row("KEEP", 5, 10)]);
  const r = apply(held, trades);
  const aaa = r.stocks.filter((x) => x.symbol === "AAA");
  assert.strictEqual(aaa.length, 2); assert.deepStrictEqual(aaa.map((x) => [x.purchaseDate, x.date, x.quantity, x.buyDateKnown]), [["2025-01-10", "2025-01-10", 6, true], ["2025-03-10", "2025-03-10", 4, true]]);
  assert.strictEqual(aaa.reduce((t, x) => t + x.quantity, 0), 10); assert.ok(Math.abs(aaa.reduce((t, x) => t + x.invested, 0) - 1080) < 0.02, "the invested total is what the books said");
  assert.strictEqual(r.stocks.find((x) => x.symbol === "KEEP"), held[1], "other rows are the same objects");
  assert.ok(aaa.every((x) => /^lot-[0-9a-f]{16}$/.test(x.id)) && new Set(aaa.map((x) => x.id)).size === 2);
  assert.deepStrictEqual(r.applied, [{ key: "Me|Zerodha|AAA", symbol: "AAA", owner: "Me", lots: 2, unknownQty: 0 }]); assert.strictEqual(r.skipped.length, 0);
  // costs are scaled to the books: held cost 1090 against 1080 of trades
  const sc = apply(unknowns([row("AAA", 10, 108.4, { invested: 1084 })]), trades).stocks; assert.ok(Math.abs(sc.reduce((t, x) => t + x.invested, 0) - 1084) < 0.02, "scaled to the books' 1084, not the trades' 1080");
  assert.deepStrictEqual(sc.map((x) => x.quantity), [6, 4]); assert.ok(Math.abs(sc[0].invested - 600 * 1084 / 1080) < 0.01 && Math.abs(sc[1].invested - 480 * 1084 / 1080) < 0.01, "each lot carries its share of the difference");
  // the original row's other fields (owner, broker, category, price) are kept; the input is not changed
  const base = { ...row("AAA", 10, 108), category: "ETF", exchange: "NSE", currentPrice: 123.4, company: "A Co", buyDateKnown: false }; const frozen = JSON.stringify(base);
  const k = apply([base], trades).stocks[0]; assert.deepStrictEqual([k.category, k.exchange, k.currentPrice, k.company, k.owner, k.demat, k.symbol], ["ETF", "NSE", 123.4, "A Co", "Me", "Zerodha", "AAA"]); assert.strictEqual(JSON.stringify(base), frozen);
  // applying twice does nothing more (the rows now have real dates)
  const again = apply(r.stocks, trades); assert.strictEqual(again.stocks.length, r.stocks.length); assert.strictEqual(again.applied.length, 0);
  assert.strictEqual(again.rec.items.find((i) => i.symbol === "AAA").alreadyDated, true);
}
{
  // short: only when chosen; the dated part gets real dates and ONE row for the rest is marked unknown, on the import date
  const trades = T([trade("buy", "2025-01-10", 4, 100), trade("buy", "2025-03-10", 2, 120)]);   // explains 6 shares, cost 640
  const held = unknowns([row("AAA", 10, 110, { invested: 1100 })]);
  const none = apply(held, trades); assert.strictEqual(none.applied.length, 0, "short positions are not applied unless named"); assert.deepStrictEqual(none.stocks, held);
  const r = apply(held, trades, ["Me|Zerodha|AAA"]);
  assert.strictEqual(r.stocks.length, 3); const rest = r.stocks.find((x) => x.buyDateKnown === false);
  assert.deepStrictEqual([rest.quantity, rest.invested, rest.purchaseDate], [4, 460, "2026-11-11"]); assert.strictEqual(r.stocks[0], rest, "the unknown part comes first: it is the oldest");
  assert.deepStrictEqual(r.stocks.filter((x) => x.buyDateKnown).map((x) => [x.purchaseDate, x.quantity, x.invested]), [["2025-01-10", 4, 400], ["2025-03-10", 2, 240]]);
  assert.strictEqual(r.stocks.reduce((t, x) => t + x.quantity, 0), 10); assert.strictEqual(r.stocks.reduce((t, x) => t + x.invested, 0), 1100);
  assert.deepStrictEqual(r.applied[0], { key: "Me|Zerodha|AAA", symbol: "AAA", owner: "Me", lots: 2, unknownQty: 4 });
  // a remainder whose cost would be zero or negative is refused: the books' cost cannot carry it
  const cheap = apply(unknowns([row("AAA", 10, 50, { invested: 500 })]), trades, ["Me|Zerodha|AAA"]); assert.strictEqual(cheap.applied.length, 0); assert.strictEqual(cheap.skipped.length, 1); assert.ok(/cost/.test(cheap.skipped[0].why));
  const equal = apply(unknowns([row("AAA", 10, 64, { invested: 640 })]), trades, ["Me|Zerodha|AAA"]); assert.strictEqual(equal.applied.length, 0, "a zero-cost remainder is refused");
  // extra / check / none are never applied, even when named
  for (const [qty, avg] of [[4, 100], [6, 200], [6, 106.67]]) { const x = apply(unknowns([row("AAA", qty, avg)]), trades, ["Me|Zerodha|AAA"]); if (x.rec.items[0].status !== "exact") assert.strictEqual(x.applied.length, 0, x.rec.items[0].status); }
  assert.strictEqual(apply(unknowns([row("AAA", 4, 100)]), trades, ["Me|Zerodha|AAA"]).applied.length, 0);
  // naming only some of several
  const two = unknowns([row("AAA", 6, 106.67), row("BBB", 6, 106.67)]); const tt = T([trade("buy", "2025-01-10", 4, 100), trade("buy", "2025-03-10", 2, 120), trade("buy", "2025-01-10", 4, 100, { symbol: "BBB", n: "b" }), trade("buy", "2025-03-10", 2, 120, { symbol: "BBB", n: "c" })]);
  const sel = apply(two, tt, ["Me|Zerodha|BBB"]); assert.deepStrictEqual(sel.applied.map((a) => a.symbol), ["BBB"]); assert.strictEqual(sel.stocks.filter((x) => x.symbol === "AAA").length, 1);
}
// a position made of several rows that already has a real date is left alone, with a reason
{
  const trades = T([trade("buy", "2025-01-10", 10, 100)]);
  const mixed = [row("AAA", 4, 100, { date: "2024-05-05", flag: true, id: "a1" }), row("AAA", 6, 100, { id: "a2", flag: false })];
  const r = apply(mixed, trades); assert.strictEqual(r.applied.length, 0); assert.deepStrictEqual(r.stocks, mixed);
  const forced = B.apply(mixed, B.reconcile(trades, mixed), ["Me|Zerodha|AAA"], "2026-11-14"); assert.strictEqual(forced.applied.length, 0, "named, but it already has a real date"); assert.ok(/already/.test(forced.skipped[0].why));
}
// several rows of one position that are all unknown are replaced together, in the first one's place
{
  const trades = T([trade("buy", "2025-01-10", 10, 100)]);
  const rows = unknowns([row("XXX", 1, 1, { id: "x" }), row("AAA", 4, 100, { id: "a1" }), row("YYY", 1, 1, { id: "y" }), row("AAA", 6, 100, { id: "a2" })]);
  const r = apply(rows, trades); assert.deepStrictEqual(r.stocks.map((x) => x.symbol), ["XXX", "AAA", "YYY"]); assert.strictEqual(r.stocks[1].quantity, 10);
}
// the stamp rule: with 5+ rows on the import date those are unknown without any flag
{
  const trades = T([trade("buy", "2025-01-10", 10, 100)]);
  const stamped = [1, 2, 3, 4].map((i) => row("S" + i, 1, 1)).concat([row("AAA", 10, 100)]);
  assert.strictEqual(apply(stamped, trades).applied.length, 1);
  const fewer = [row("AAA", 10, 100)]; assert.strictEqual(apply(fewer, trades).applied.length, 0, "a lone row on the import date is not known to be a stamp, so it is left alone");
  assert.strictEqual(apply(unknowns(fewer), trades).applied.length, 1);
}
assert.strictEqual(B.apply(null, { items: [] }, null, "2026-11-14").stocks.length, 0);
assert.strictEqual(B.rowsFor(null, null, ""), null);
// ── blind spots closed after the mutation run ──
// Windows and old-Mac line endings read as the same rows
assert.deepStrictEqual(B.parseCSV("a,b\r\n1,2\r\n3,4"), [["a", "b"], ["1", "2"], ["3", "4"]]); assert.deepStrictEqual(B.parseCSV("a,b\r1,2\r3,4"), [["a", "b"], ["1", "2"], ["3", "4"]]); assert.deepStrictEqual(B.parseCSV("a\n\nb\n"), [["a"], ["b"]]);
// the same columns in another order, and the first column being a needed one
{
  const zr = "trade_type,symbol,trade_date,quantity,price,trade_id\nbuy,AAA,2025-01-10,2,50,t1"; const r = B.parseZerodha(zr, {}); assert.strictEqual(r.trades.length, 1); assert.deepStrictEqual([r.trades[0].symbol, r.trades[0].qty, r.trades[0].price, r.trades[0].exchange, r.trades[0].isin], ["AAA", 2, 50, undefined, ""]); assert.strictEqual(r.trades[0].id, "z:NSE:t1");
  assert.strictEqual(B.parseZerodha("symbol,trade_date,trade_type,quantity,price,trade_id\nAAA,2025-01-10,buy,2,50,t1", {}).trades.length, 1, "symbol first");
  const gr = "Symbol,Type,Quantity,Value,Execution date and time\nAAA,BUY,2,100,10-01-2025 10:00 AM"; assert.strictEqual(B.parseGroww(gr, {}).trades.length, 1); assert.strictEqual(B.detectFormat(gr), "groww-history");
  const g2 = B.parseGroww("Execution date and time,Value,Quantity,Type,Symbol\n10-01-2025 10:00 AM,100,2,BUY,AAA", {}); assert.deepStrictEqual([g2.trades.length, g2.trades[0].symbol, g2.trades[0].price], [1, "AAA", 50]);
  assert.ok(/"symbol"/.test(B.parseGroww("Type,Quantity,Value,Execution date and time\nBUY,1,1,10-01-2025 10:00 AM", {}).errors[0]), "a missing needed column is named");
}
// date patterns: too many digits are refused; a value of ₹1 is a trade, ₹0 is not
{
  const one = (when, value = "10") => B.parseGroww([G_HEAD, g("A", "BUY", "1", value, when)].join("\n"), {});
  for (const bad of ["127-08-2026 10:46 AM", "27-123-2026 10:46 AM", "27-08-2026 123:46 AM", "27-08-26 10:46 AM", "27-08-2026 10:46"]) assert.strictEqual(one(bad).trades.length, 0, bad);
  assert.strictEqual(one("27-08-2026 10:46 AM", "0").trades.length, 0); assert.strictEqual(one("27-08-2026 10:46 AM", "1").trades.length, 1); assert.strictEqual(one("27-08-2026 10:46 am").trades.length, 1, "am/pm in any case");
  assert.strictEqual(one("27-08-2026 00:30 AM").trades.length, 0, "hour 0 is not a 12-hour clock hour");
  assert.strictEqual(one("27-08-2026 10:46 AM").skipped, 0);
}
// the second identical fill in a file is numbered 2, the first 1
{ const r = B.parseGroww([G_HEAD, g("A", "BUY", "5", "50", "01-01-2026 10:00 AM"), g("A", "BUY", "5", "50", "01-01-2026 10:00 AM"), g("A", "BUY", "5", "50", "01-01-2026 10:00 AM")].join("\n"), {}); assert.deepStrictEqual(r.trades.map((t) => t.id.split("|").pop()), ["1", "2", "3"]); }
// parseFile reads each kind with its own reader, and a file of neither kind is not counted as skipped rows
{
  const zf = B.parseFile(zfile(z("A", "2025-01-10", "buy", 1, 10, "1"), z("A", "2025-01-10", "buy", 1, 10, "2", { segment: "FO" })), { owner: "Wife" }); assert.deepStrictEqual([zf.format, zf.trades.length, zf.skipped, zf.trades[0].broker, zf.trades[0].owner], ["zerodha-tradebook", 1, 1, "Zerodha", "Wife"]);
  const gf = B.parseFile([G_HEAD, g("A", "BUY", "1", "10", "10-01-2025 10:00 AM")].join("\n"), { owner: "Me" }); assert.deepStrictEqual([gf.format, gf.trades.length, gf.trades[0].broker, gf.trades[0].owner, gf.skipped], ["groww-history", 1, "Groww", "Me", 0]);
  assert.strictEqual(B.parseFile("a,b\n1,2", {}).skipped, 0);
  assert.strictEqual(B.parseFile(zfile(z("A", "2025-01-10", "buy", 1, 10, "1")), { demat: "Upstox" }).trades[0].demat, "Upstox", "the broker name on the holdings can be set");
}
// trades at the same instant are ordered by id; the merge keeps one of each
{ const same = (id) => ({ id, time: "2025-01-01T10:00:00", date: "2025-01-01" }); assert.deepStrictEqual(B.mergeTrades([same("b"), same("c")], [same("a")]).trades.map((t) => t.id), ["a", "b", "c"]); assert.deepStrictEqual(B.mergeTrades([same("a"), same("b")], []).trades.map((t) => t.id), ["a", "b"]); }
// the import-date rule: zero-quantity rows do not count; the commonest date wins whatever its position
assert.strictEqual(B.stampedDate([1, 2, 3, 4].map((i) => row("S" + i, 1, 1)).concat([row("Z", 0, 0, { date: "2026-11-11" }), row("Z2", 0, 0, { date: "2026-11-11" })])), null, "4 real rows are fewer than 5");
assert.strictEqual(B.stampedDate([row("A", 1, 1, { date: "2025-01-01" }), row("B", 1, 1, { date: "2026-11-11" }), row("C", 1, 1, { date: "2026-11-11" }), row("D", 1, 1, { date: "2026-11-11" }), row("E", 1, 1, { date: "2025-02-02" })]), "2026-11-11");
assert.strictEqual(B.stampedDate([row("A", 1, 1, { date: "2025-01-01" }), row("B", 1, 1, { date: "2025-01-01" }), row("C", 1, 1, { date: "2026-11-11" }), row("D", 1, 1, { date: "2026-11-11" }), row("E", 1, 1, { date: "2026-11-11" }), row("F", 1, 1, { date: "2026-11-11" })]), "2026-11-11");
assert.strictEqual(B.stampedDate(null), null);
// the cost on the books: invested when there is one, else average × quantity
assert.strictEqual(B.heldPositions([row("A", 4, 25, { invested: 0 })]).get("Me|Zerodha|A").cost, 100); assert.strictEqual(B.heldPositions([row("A", 4, 25, { invested: 90 })]).get("Me|Zerodha|A").cost, 90);
// a one-share position and a one-share-short position
{
  const one = T([trade("buy", "2025-01-10", 1, 100)]);
  const e = B.reconcile(one, unknowns([row("AAA", 1, 100)])).items[0]; assert.deepStrictEqual([e.status, e.tradeAvg, e.explainedQty], ["exact", 100, 1]);
  const sh = B.reconcile(one, unknowns([row("AAA", 2, 100)])).items[0]; assert.strictEqual(sh.status, "short"); assert.ok(/1 of 2 shares/.test(sh.note));
  assert.deepStrictEqual(apply(unknowns([row("AAA", 1, 100)]), one).stocks.map((x) => [x.quantity, x.avgPrice, x.purchaseDate]), [[1, 100, "2025-01-10"]]);
  const r = apply(unknowns([row("AAA", 2, 100, { invested: 200 })]), one, ["Me|Zerodha|AAA"]); assert.deepStrictEqual(r.stocks.map((x) => [x.quantity, x.invested, x.buyDateKnown]), [[1, 100, false], [1, 100, true]], "a remainder of exactly 1 share and ₹100");
  const tiny = apply(unknowns([row("AAA", 2, 50.5, { invested: 101 })]), one, ["Me|Zerodha|AAA"]); assert.strictEqual(tiny.applied.length, 1, "a remainder costing exactly ₹1 is still a remainder"); assert.strictEqual(tiny.stocks[0].invested, 1);
}

// ── Splits and bonus issues ──
{
  const SPLIT = [{ symbol: "AAA", kind: "split", date: "2024-09-12", ratio: 2.5 }], BONUS = [{ symbol: "AAA", kind: "bonus", date: "2024-12-03", ratio: 1 }];
  const pos = (tr, acts) => B.replay(tr, acts).get("Me|Zerodha|AAA");
  // a split: shares before the ex-date multiply, the money paid does not; a trade ON the ex-date is already in new shares
  let p = pos([trade("buy", "2024-09-11", 8, 100), trade("buy", "2024-09-12", 4, 40), trade("buy", "2024-09-13", 4, 40, { n: "x" })], SPLIT);
  assert.deepStrictEqual([p.qty, p.cost], [28, 800 + 160 + 160], "the day before is multiplied, the ex-date and after are not"); assert.strictEqual(p.lots[0].qty, 20); assert.strictEqual(p.lots[0].price, 40);
  assert.deepStrictEqual([p.bought, p.sold], [28, 0]);
  assert.strictEqual(pos([trade("buy", "2024-09-12", 4, 40)], SPLIT).qty, 4, "a trade on the ex-date is not multiplied");
  assert.strictEqual(pos([trade("buy", "2024-09-11", 4, 100)], SPLIT).qty, 10, "the day before is");
  assert.strictEqual(pos([trade("buy", "2024-01-01", 4, 100), trade("sell", "2024-09-11", 2, 100, { n: "s" })], SPLIT).qty, 5, "2 left x 2.5");
  assert.strictEqual(pos([trade("buy", "2024-01-01", 4, 100)], [{ ...SPLIT[0], symbol: "OTHER" }]).qty, 4, "another share's split does not touch it");
  assert.strictEqual(pos([trade("buy", "2024-01-01", 4, 100)], []).qty, 4, "no actions: unchanged");
  assert.strictEqual(pos([trade("buy", "2024-01-01", 4, 100)], [{ ...SPLIT[0], ratio: 0 }]).qty, 4, "a zero or missing ratio is ignored"); assert.strictEqual(pos([trade("buy", "2024-01-01", 4, 100)], [{ ...SPLIT[0], date: "2024-13-40" }]).qty, 4, "a bad date is ignored");
  // a split after the last trade still applies
  assert.strictEqual(pos([trade("buy", "2024-01-01", 4, 100)], SPLIT).qty, 10);
  // a bonus: free shares at no cost for the shares held on the ex-date, dated that day; the total paid is unchanged
  p = pos([trade("buy", "2024-11-18", 43, 500), trade("buy", "2025-01-09", 7, 300, { n: "b" })], BONUS);
  assert.deepStrictEqual([p.qty, p.cost], [93, 43 * 500 + 7 * 300]); assert.deepStrictEqual(p.lots.map((l) => [l.date, l.qty, l.price]), [["2024-11-18", 43, 500], ["2024-12-03", 43, 0], ["2025-01-09", 7, 300]], "the bonus lot sits in date order, at no cost");
  assert.strictEqual(pos([trade("buy", "2024-12-03", 10, 100)], BONUS).qty, 10, "bought on the ex-date: no bonus (the share is already ex-bonus)"); assert.strictEqual(pos([trade("buy", "2024-12-02", 10, 100)], BONUS).qty, 20, "the day before earns it");
  assert.strictEqual(pos([trade("buy", "2024-11-01", 10, 100), trade("sell", "2024-11-20", 10, 120, { n: "s" })], BONUS).qty, 0, "nothing held on the day: no bonus");
  // the real case: 43 bought, 1:1 bonus, 7 more, all 93 sold => nothing oversold (without the bonus 43 shares looked sold out of thin air)
  const w = [trade("buy", "2024-11-18", 43, 500), trade("buy", "2025-01-09", 7, 300, { n: "b" }), trade("sell", "2026-11-11", 93, 198, { n: "s" })];
  assert.strictEqual(pos(w, BONUS).oversold, 0); assert.strictEqual(pos(w, BONUS).qty, 0); assert.strictEqual(pos(w, []).oversold, 43, "without the bonus it looks oversold by exactly the bonus");
  // the counters follow the action too (so "oversold" and "bought" stay in the same shares as the lots)
  p = pos([trade("buy", "2024-01-01", 4, 100), trade("sell", "2024-02-01", 2, 100, { n: "s" }), trade("sell", "2024-03-01", 4, 100, { n: "t" })], SPLIT); assert.deepStrictEqual([p.bought, p.sold, p.oversold, p.qty], [10, 15, 5, 0], "pre-split: bought 4, sold 6, oversold 2 -> all x2.5");
  p = pos([trade("buy", "2024-11-01", 10, 100)], [{ symbol: "AAA", kind: "bonus", date: "2024-12-03", ratio: 2 }]); assert.deepStrictEqual([p.bought, p.qty, p.lots[1].qty], [30, 30, 20], "2 free shares per share held: 10 -> +20, and the buy counter grows with it");
  assert.strictEqual(pos([trade("buy", "2024-11-01", 0.00001, 100)], BONUS).lots.length, 1, "a bonus that rounds to nothing adds no lot");
  // the table that ships: only the two checked actions, each with a source
  assert.deepStrictEqual(B.ACTIONS.map((a) => [a.symbol, a.kind, a.date, a.ratio]), [["VBL", "split", "2024-09-12", 2.5], ["WIPRO", "bonus", "2024-12-03", 1]]); assert.ok(B.ACTIONS.every((a) => /^https:\/\//.test(a.source) && a.note));
  // the default is the shipped table: a VBL holding bought before the split reconciles exactly
  const v = T([trade("buy", "2023-11-23", 8, 1000, { symbol: "VBL" }), trade("buy", "2024-10-03", 36, 500, { symbol: "VBL", n: "v" })]);
  const rec = B.reconcile(v, unknowns([row("VBL", 56, (8000 + 18000) / 56)])).items[0]; assert.deepStrictEqual([rec.status, rec.explainedQty, rec.missingQty], ["exact", 56, 0]);
  assert.strictEqual(B.reconcile(v, unknowns([row("VBL", 56, (8000 + 18000) / 56)]), []).items[0].status, "short", "and without the split table it is short by the 12 extra shares");
}

// ── A sale worked out from the trades ──
{
  const acts = [{ symbol: "AAA", kind: "bonus", date: "2024-12-03", ratio: 1 }];
  const tr = T([trade("buy", "2024-11-18", 43, 500), trade("buy", "2025-01-09", 7, 300), trade("sell", "2026-11-11", 2, 198, { time: "2026-11-11T11:08:22" }), trade("sell", "2026-11-11", 91, 198, { time: "2026-11-11T11:08:22" }), trade("buy", "2026-11-11", 5, 10, { time: "2026-11-11T14:00:00" })]);
  const r = B.saleCandidate(tr, { owner: "Me", demat: "Zerodha", symbol: "AAA", date: "2026-11-11", name: "Aaa Ltd" }, acts);
  assert.strictEqual(r.ok, true); assert.deepStrictEqual([r.cand.qty, r.cand.cost, r.price, r.sellTrades], [93, 43 * 500 + 7 * 300, 198, 2]); assert.deepStrictEqual(r.cand.lots.map((l) => [l.buyDate, l.qty, l.cost, l.buyDateKnown]), [["2024-11-18", 43, 21500, true], ["2024-12-03", 43, 0, true], ["2025-01-09", 7, 2100, true]]);
  assert.strictEqual(r.cand.name, "Aaa Ltd"); assert.strictEqual(r.cand.key, "AAA|Me|Zerodha"); assert.strictEqual(r.cand.whole, true);
  // the same day's later buy is not part of the sale
  assert.strictEqual(r.cand.lots.reduce((t, l) => t + l.qty, 0), 93);
  // one share more sold than the files show bought: refused, naming the gap, nothing invented
  const short = T([trade("buy", "2024-11-18", 43, 500), trade("sell", "2026-11-11", 44, 198)]);
  const bad = B.saleCandidate(short, { owner: "Me", demat: "Zerodha", symbol: "AAA", date: "2026-11-11" }, []); assert.strictEqual(bad.ok, false); assert.ok(/only 43 of the 44/.test(bad.error) && /1 are missing/.test(bad.error), bad.error);
  assert.strictEqual(B.saleCandidate(short, { owner: "Me", demat: "Zerodha", symbol: "AAA", date: "2026-11-12" }, []).ok, false, "no sale that day");
  assert.strictEqual(B.saleCandidate(short, { owner: "Wife", demat: "Zerodha", symbol: "AAA", date: "2026-11-11" }, []).ok, false, "another owner's sale is not this one");
  assert.strictEqual(B.saleCandidate(short, { owner: "Me", demat: "Zerodha", symbol: "AAA", date: "bad" }, []).ok, false); assert.strictEqual(B.saleCandidate(null, null, []).ok, false);
  const exact = T([trade("buy", "2024-11-18", 44, 500), trade("sell", "2026-11-11", 44, 198)]); assert.strictEqual(B.saleCandidate(exact, { owner: "Me", demat: "Zerodha", symbol: "AAA", date: "2026-11-11" }, []).ok, true, "exactly the shares bought is fine");
  // a partial sale uses the oldest shares first and the cost of only the part sold
  const part = T([trade("buy", "2024-01-01", 10, 100), trade("buy", "2024-02-01", 10, 200), trade("sell", "2025-01-01", 15, 300)]); const pr = B.saleCandidate(part, { owner: "Me", demat: "Zerodha", symbol: "AAA", date: "2025-01-01" }, []);
  assert.deepStrictEqual(pr.cand.lots.map((l) => [l.qty, l.cost]), [[10, 1000], [5, 1000]]); assert.strictEqual(pr.cand.cost, 2000);
  // two sells at different prices: the price is the weighted average
  const two = T([trade("buy", "2024-01-01", 10, 100), trade("sell", "2025-01-01", 4, 200, { time: "2025-01-01T10:00:00" }), trade("sell", "2025-01-01", 6, 300, { time: "2025-01-01T11:00:00" })]); assert.strictEqual(B.saleCandidate(two, { owner: "Me", demat: "Zerodha", symbol: "AAA", date: "2025-01-01" }, []).price, 260);
}
console.log("broker-trades-core: ok");
