// Loading broker tradebooks into the vault: dated holdings, recorded sales, and the guard that keeps everything else untouched.
const assert = require("assert");
const L = require("../mcp/broker-load.js"), V = require("../mcp/vault-client.js"), E = require("../sync-engine.js");
const T = "2026-11-18";
const tr = (id, side, date, qty, price, symbol, extra = {}) => ({ id, owner: "Me", demat: "Zerodha", symbol, date, time: extra.time || date + "T10:00:00", side, qty, price });
const row = (id, symbol, qty, invested, extra = {}) => ({ id, symbol, company: symbol + " Ltd", quantity: qty, avgPrice: invested / qty, invested, purchaseDate: "2026-11-17", date: "2026-11-17", owner: "Me", demat: "Zerodha", ...extra });
const data = () => ({ stocks: [row("a1", "AAA", 10, 1080), row("b1", "BBB", 4, 400, { demat: "Upstox" }), row("c1", "CCC", 3, 300), row("d1", "DDD", 3, 300), row("e1", "EEE", 3, 300), row("f1", "FFF", 3, 300)], sales: [], brokerTrades: [], goals: [{ id: "g" }], expenses: [{ id: "x1" }] });
const trades = [tr("1", "buy", "2025-01-10", 6, 100, "AAA"), tr("2", "buy", "2025-03-10", 4, 120, "AAA"), tr("3", "buy", "2024-05-01", 50, 10, "OLD"), tr("4", "sell", "2026-11-11", 50, 20, "OLD", { time: "2026-11-11T11:00:00" })];

// Trades are kept, the explained holding gets its real dates, the rest is left alone
let r = L.build(data(), trades, { today: T });
assert.strictEqual(r.ok, true); assert.deepStrictEqual([r.report.trades, r.report.added, r.report.duplicates], [4, 4, 0]);
assert.deepStrictEqual(r.after.stocks.filter((x) => x.symbol === "AAA").map((x) => [x.purchaseDate, x.quantity, x.invested]), [["2025-01-10", 6, 600], ["2025-03-10", 4, 480]], "dated lots whose cost adds to the 1080 on the books");
assert.deepStrictEqual(r.after.stocks.filter((x) => x.symbol !== "AAA").map((x) => x.id), ["b1", "c1", "d1", "e1", "f1"], "the others are untouched"); assert.strictEqual(JSON.stringify(r.after.stocks.find((x) => x.id === "b1")), JSON.stringify(data().stocks[1]));
assert.strictEqual(r.after.sales.length, 0, "no sale unless asked"); assert.strictEqual(L.guard(data(), r.after), true);
assert.strictEqual(L.expectCount(V)(data(), r.after), V.countEntries(r.after));
// loading the same files again changes nothing (trades already kept, holding already dated)
const again = L.build(r.after, trades, { today: T }); assert.deepStrictEqual([again.report.added, again.report.duplicates], [0, 4]); assert.strictEqual(JSON.stringify(again.after.stocks), JSON.stringify(r.after.stocks));

// A sale: cost from the shares, price from the trades, charges only what is stated
const sel = { owner: "Me", demat: "Zerodha", symbol: "OLD", name: "Old Ltd", date: "2026-11-11", charges: 0 };
r = L.build(data(), trades, { today: T, sales: [sel] }); assert.strictEqual(r.ok, true);
assert.deepStrictEqual(r.after.sales.map((s) => [s.symbol, s.soldOn, s.qty, s.price, s.gross, s.charges, s.cost, s.gain, s.bankCredited]), [["OLD", "2026-11-11", 50, 20, 1000, 0, 500, 500, false]]); assert.strictEqual(L.guard(data(), r.after), true);
assert.deepStrictEqual(L.build(r.after, trades, { today: T, sales: [sel] }).report.sales, [{ symbol: "OLD", date: "2026-11-11", skipped: "already recorded" }], "never recorded twice"); assert.strictEqual(L.build(r.after, trades, { today: T, sales: [sel] }).after.sales.length, 1);
r = L.build(data(), trades, { today: T, sales: [{ ...sel, charges: 15.93 }] }); assert.deepStrictEqual([r.after.sales[0].charges, r.after.sales[0].proceeds, r.after.sales[0].gain], [15.93, 984.07, 484.07]);
// refused: still held (would count twice), shares the files cannot account for, no such sale, a bad day
assert.match(L.build(data(), trades, { today: T, sales: [{ ...sel, symbol: "AAA", date: "2026-11-11" }] }).error, /AAA/);
const held = data(); held.stocks.push(row("o1", "OLD", 5, 100)); assert.match(L.build(held, trades, { today: T, sales: [sel] }).error, /still in your holdings/);
assert.match(L.build(data(), [...trades, tr("5", "sell", "2026-11-12", 1, 1, "OLD")], { today: T, sales: [{ ...sel, date: "2026-11-12" }] }).error, /missing/);
assert.strictEqual(L.build(data(), trades, { today: T, sales: [{ ...sel, date: "2026-11-10" }] }).ok, false); assert.strictEqual(L.build(data(), trades, { today: "2026-11-01", sales: [sel] }).ok, false, "a sale after today is refused");
assert.strictEqual(L.build(data(), trades, { today: T, sales: [{ ...sel, charges: 5000 }] }).ok, false, "charges above the sale value are refused");

// The report says what happened, in numbers
r = L.build(data(), [...trades, tr("6", "sell", "2025-06-01", 3, 5, "GHOST")], { today: T });
assert.deepStrictEqual(r.report.status, { exact: 1, none: 5 }); assert.deepStrictEqual(r.report.oversold, [{ symbol: "GHOST", oversold: 3 }]); assert.deepStrictEqual(r.report.applied.map((x) => [x.symbol, x.lots]), [["AAA", 2]]);
// a leftover zero-quantity row or a fraction of a share
const zero = data(); zero.stocks.push(row("z1", "OLD", 0, 0)); assert.strictEqual(L.build(zero, trades, { today: T, sales: [sel] }).ok, true, "a zero-share row does not count as held");
const frac = data(); frac.stocks.push(row("z2", "OLD", 0.5, 10)); assert.match(L.build(frac, trades, { today: T, sales: [sel] }).error, /still in your holdings/, "half a share is still held");
// the same sale named twice in one load is recorded once
const twice = L.build(data(), trades, { today: T, sales: [sel, sel] }); assert.strictEqual(twice.after.sales.length, 1); assert.strictEqual(twice.report.sales[1].skipped, "already recorded");
// a sale of 2 different days / shares in one load: both recorded
const two = L.build(data(), [...trades, tr("7", "buy", "2025-02-01", 2, 10, "NEW2"), tr("8", "sell", "2026-11-12", 2, 12, "NEW2")], { today: T, sales: [sel, { ...sel, symbol: "NEW2", name: "N", date: "2026-11-12" }] }); assert.deepStrictEqual(two.after.sales.map((x) => x.symbol), ["OLD", "NEW2"]);

// The guard
const ok = L.build(data(), trades, { today: T }).after;
assert.strictEqual(L.guard(data(), { ...ok, goals: [] }), false, "another record list changed");
assert.strictEqual(L.guard(data(), { ...ok, newField: 1 }), false, "a new field appeared");
assert.strictEqual(L.guard({ ...data(), brokerTrades: trades }, { ...ok, brokerTrades: trades.slice(1) }), false, "a kept trade was lost");
assert.strictEqual(L.guard({ ...data(), sales: [{ id: "s1" }] }, { ...ok, sales: [] }), false, "a recorded sale was lost");
assert.strictEqual(L.guard(data(), { ...ok, stocks: ok.stocks.map((x) => (x.symbol === "AAA" && x.purchaseDate === "2025-01-10" ? { ...x, quantity: 7 } : x)) }), false, "shares changed");
assert.strictEqual(L.guard(data(), { ...ok, stocks: ok.stocks.map((x) => (x.symbol === "AAA" && x.purchaseDate === "2025-01-10" ? { ...x, invested: x.invested + 1 } : x)) }), false, "money invested changed");
assert.strictEqual(L.guard(data(), { ...ok, stocks: ok.stocks.map((x) => (x.id === "c1" ? { ...x, quantity: 4 } : x)) }), false, "an untouched holding changed");
assert.strictEqual(L.guard(data(), { ...ok, stocks: ok.stocks.map((x) => (x.id === "c1" ? { ...x, note: "x" } : x)) }), false, "even a note on an untouched holding");
assert.strictEqual(L.guard(data(), { ...ok, stocks: ok.stocks.filter((x) => x.id !== "c1") }), false, "a holding vanished");
assert.strictEqual(L.guard(data(), { ...ok, stocks: [...ok.stocks, row("n1", "NEW", 1, 1)] }), false, "a holding appeared");
assert.strictEqual(L.guard(data(), { ...ok, stocks: ok.stocks.map((x) => (x.symbol === "AAA" && x.purchaseDate === "2025-01-10" ? { ...x, invested: x.invested + 0.02 } : x)) }), false, "more than a paisa per row of drift");
assert.strictEqual(L.guard(data(), { ...ok, stocks: ok.stocks.map((x) => (x.symbol === "AAA" && x.purchaseDate === "2025-01-10" ? { ...x, invested: x.invested + 0.02 } : x)) }), false);
assert.strictEqual(L.guard(data(), { ...ok, stocks: ok.stocks.map((x) => (x.symbol === "AAA" && x.purchaseDate === "2025-01-10" ? { ...x, invested: x.invested + 0.01 } : x)) }), true, "a paisa of rounding is fine");

// The writer: record count is strict by default, and a caller that adds rows names the count
(async () => {
  const pw = "pw", salt = Buffer.alloc(16, 3), start = data();
  let server = { rev: 5, vault: { ...(await V.encryptVault({ data: start, sync: E.emptyMeta(), totpSecret: null }, pw, { salt })), entryCount: V.countEntries(start) } };
  const fetchImpl = async (url, init) => { const req = JSON.parse(init.body), reply = (o) => ({ ok: true, status: 200, headers: new Map(), text: async () => JSON.stringify(o) }); if (req.op === "pull") return reply({ ok: true, rev: server.rev, vault: server.vault }); if (req.baseRev !== server.rev) return reply({ ok: true, conflict: true, rev: server.rev }); server = { rev: server.rev + 1, vault: req.vault }; return reply({ ok: true, rev: server.rev }); };
  const make = (b) => L.build(b, trades, { today: T, sales: [sel] }).after;
  await assert.rejects(V.updateWith({ gatewayUrl: "x", password: pw, fetchImpl, make, guard: L.guard }), /record count changed/); assert.strictEqual(server.rev, 5, "adding rows without saying so pushes nothing");
  const res = await V.updateWith({ gatewayUrl: "x", password: pw, fetchImpl, make, guard: L.guard, expectCount: L.expectCount(V) }); assert.strictEqual(res.rev, 6);
  const inner = await V.decryptVault(server.vault, pw); assert.deepStrictEqual([inner.data.brokerTrades.length, inner.data.sales.length, inner.data.stocks.filter((x) => x.symbol === "AAA").length, inner.data.goals.length], [4, 1, 2, 1]);
  await assert.rejects(V.updateWith({ gatewayUrl: "x", password: pw, fetchImpl, make: (b) => ({ ...make(b), goals: [] }), guard: L.guard, expectCount: L.expectCount(V) }), /more than was allowed/); assert.strictEqual(server.rev, 6);
  console.log("mcp-broker-load tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
