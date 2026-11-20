/**
 * Loads broker tradebooks into the vault: keeps the trades, gives the holdings they explain exactly their real buy dates, and
 * records sales the files show (cost from the shares sold, first in first out). Pure: takes the vault data, returns the new data.
 * Nothing is guessed: a holding the trades do not explain exactly is left alone; a sale whose shares the files cannot account for
 * is refused; charges are only what the caller states (the tradebook has none).
 */
const BTC = require("../broker-trades-core.js"), SLS = require("../sales-core.js");

const r2 = (n) => Math.round(n * 100) / 100;
const symOf = (r) => String(r.symbol || r.company || "").toUpperCase().replace(/\s*-EQ$/i, "").trim();
const posOf = (r) => `${r.owner || "Me"}|${r.demat || ""}|${symOf(r)}`;

/**
 * before = vault data. files = [{ trades }] already parsed. sales = [{ owner, demat, symbol, name, date, charges }] to record.
 * → { ok:true, after, report } | { ok:false, error }
 */
function build(before, trades, opts) {
  const o = opts || {}, today = o.today || "";
  const merged = BTC.mergeTrades(before.brokerTrades || [], trades || []);
  // rows still on the import day (o.stamp) are marked "date unknown" first, so the trades can date them and the tax engine does not read the import day as a buy date
  const pre = o.stamp ? BTC.markStamped(before.stocks || [], o.stamp) : { stocks: before.stocks || [], flagged: 0 };
  const recon = BTC.reconcile(merged.trades, pre.stocks);
  const applied = BTC.apply(pre.stocks, recon, null, today);   // every exact one, nothing else
  const stillHeld = new Set(applied.stocks.filter((r) => Number(r.quantity) > 0).map(posOf));
  const newSales = [], salesReport = [];
  for (const sel of o.sales || []) {
    const sc = BTC.saleCandidate(merged.trades, sel);
    if (!sc.ok) return { ok: false, error: `${sel.symbol} sale on ${sel.date}: ${sc.error}` };
    if (stillHeld.has(`${sel.owner || "Me"}|${sel.demat || ""}|${symOf(sel)}`)) return { ok: false, error: `${sel.symbol}: some shares are still in your holdings, so this would count them twice` };
    const b = SLS.buildSale(sc.cand, { price: sc.price, date: sc.date, charges: sel.charges || 0 }, { today });
    if (!b.ok) return { ok: false, error: `${sel.symbol} sale: ${b.error}` };
    if ((before.sales || []).some((x) => x.id === b.sale.id) || newSales.some((x) => x.id === b.sale.id)) { salesReport.push({ symbol: sel.symbol, date: sel.date, skipped: "already recorded" }); continue; }
    newSales.push(b.sale); salesReport.push({ symbol: sel.symbol, date: sel.date, qty: b.sale.qty, price: b.sale.price, gross: b.sale.gross, charges: b.sale.charges, cost: b.sale.cost, gain: b.sale.gain, lots: b.sale.lots.length });
  }
  const after = { ...before, brokerTrades: merged.trades, stocks: applied.stocks, sales: [...(before.sales || []), ...newSales] };
  const status = {}; recon.items.forEach((i) => { status[i.status] = (status[i.status] || 0) + 1; });
  return { ok: true, after, report: { markedUnknown: pre.flagged, trades: merged.trades.length, added: merged.added, duplicates: merged.duplicates, status, applied: applied.applied, skipped: applied.skipped, sales: salesReport, oversold: [...BTC.replay(merged.trades).values()].filter((p) => p.oversold > 0).map((p) => ({ symbol: p.symbol, oversold: p.oversold })) } };
}

/** The change may touch only brokerTrades, stocks and sales; shares and money per holding stay; trades and sales only grow. */
function guard(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) if (!["brokerTrades", "stocks", "sales"].includes(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k])) return false;
  const bt = new Set((before.brokerTrades || []).map((t) => t.id)), at = new Set((after.brokerTrades || []).map((t) => t.id));
  for (const id of bt) if (!at.has(id)) return false;
  const bs = new Set((before.sales || []).map((t) => t.id)), as = new Set((after.sales || []).map((t) => t.id));
  for (const id of bs) if (!as.has(id)) return false;
  const tot = (rows) => { const m = new Map(); for (const r of rows || []) { const e = m.get(posOf(r)) || m.set(posOf(r), { q: 0, c: 0 }).get(posOf(r)); e.q += Number(r.quantity) || 0; e.c += Number(r.invested) || 0; } return m; };
  const b = tot(before.stocks), a = tot(after.stocks);
  if (b.size !== a.size) return false;
  for (const [k, e] of b) { const x = a.get(k); if (!x || Math.abs(x.q - e.q) > 1e-6 || Math.abs(x.c - e.c) > 0.005 * ((after.stocks || []).filter((r) => posOf(r) === k).length + 1)) return false; }
  const rowsBy = (rows) => new Map((rows || []).map((r) => [r.id, r]));
  const brows = rowsBy(before.stocks), arows = rowsBy(after.stocks);
  // a holding the trades did not replace is left exactly as it was
  const replaced = new Set([...brows.keys()].filter((id) => !arows.has(id)));
  const touched = new Set([...replaced].map((id) => posOf(brows.get(id))));
  // (the one allowed difference: a row that had no mark may now be marked "date unknown")
  const strip = (r) => { const { buyDateKnown, ...rest } = r || {}; return JSON.stringify(rest); };
  for (const [id, r] of brows) { const a = arows.get(id); if (!touched.has(posOf(r)) && JSON.stringify(a) !== JSON.stringify(r) && !(r.buyDateKnown === undefined && a && a.buyDateKnown === false && strip(a) === strip(r))) return false; }
  return true;
}

/** How many records the vault should hold after: every stock row of the new list, plus everything else as it was. */
const expectCount = (V) => (before, after) => V.countEntries({ ...before, stocks: after.stocks });

module.exports = { build, guard, expectCount };
