/**
 * Life Ledger — broker trades → dated lots (pure; no DOM, no network, no clock).
 *
 * A holdings sheet tells what is held and at what average cost, but not WHEN each share was bought, and the buy date decides whether a
 * later sale is short-term or long-term. A broker's own trade history does carry the date of every buy and sell. This reads those
 * files, replays the trades in order (first in, first out, the way Indian shares are matched), and compares what is left with what the
 * household holds today:
 *
 *   exact     the shares left equal the shares held, at the same average cost → every lot gets its real buy date
 *   short     the trades explain only part of the holding (the file starts late or ends early) → the explained shares get real dates, the
 *             rest stays one lot whose date is marked UNKNOWN (never guessed)
 *   extra     the trades show more shares than are held (sold later, or a split / bonus) → nothing is applied, it is listed
 *   check     same shares but a different average cost → nothing is applied, it is listed
 *   none      no trade for it in the files
 *
 * Nothing is applied here: this builds the plan and the new rows; the page shows them and asks first. The total invested in a position is
 * never changed: the dated lots are scaled to the cost already on the books.
 *
 * Supported files: Zerodha Console tradebook (CSV) and Groww order history (CSV). Anything else is named as unsupported, not guessed at.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerBrokerTrades = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const EPS = 1e-6;
  const COST_TOLERANCE_PCT = 0.5, COST_TOLERANCE_MIN = 0.5;
  const num = (v) => { const x = Number(String(v == null ? "" : v).replace(/,/g, "")); return Number.isFinite(x) ? x : 0; };
  const r2 = (n) => Math.round(n * 100) / 100;
  const r4 = (n) => Math.round(n * 10000) / 10000;
  const iso = (v) => String(v || "").slice(0, 10);
  const validISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && (() => { const t = Date.parse(s + "T00:00:00Z"); return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s; })();

  function hash16(str) {
    let a = 0x811c9dc5, b = 0x9747b28c;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); a ^= c; a = Math.imul(a, 16777619); b ^= c + i; b = Math.imul(b, 2246822519); }
    return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
  }

  /** A CSV file as rows of cells (quotes, doubled quotes, commas and line breaks inside quotes, a byte-order mark). */
  function parseCSV(text) {
    const s = String(text || "").replace(/^﻿/, "");
    const rows = [];
    let row = [], cell = "", q = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && s[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some((x) => x.trim() !== "")) rows.push(row); row = []; }
      else cell += c;
    }
    row.push(cell);
    if (row.some((x) => x.trim() !== "")) rows.push(row);
    return rows;
  }

  const symOf = (v) => String(v || "").toUpperCase().replace(/\s*-EQ$/i, "").trim();

  /** Which kind of file this is, from its header row: "zerodha-tradebook" | "groww-history" | null. */
  function detectFormat(text) {
    const rows = parseCSV(text);
    const head = (rows[0] || []).map((h) => h.trim().toLowerCase());
    const has = (...n) => n.every((x) => head.includes(x));
    if (has("symbol", "isin", "trade_date", "trade_type", "quantity", "price", "trade_id")) return "zerodha-tradebook";
    if (has("symbol", "type", "quantity", "value", "execution date and time")) return "groww-history";
    return null;
  }

  const col = (head, name) => head.indexOf(name);

  /** Zerodha tradebook. Equity trades only (other segments are skipped and counted). → { trades, skipped, errors } */
  function parseZerodha(text, ctx) {
    const rows = parseCSV(text), head = (rows[0] || []).map((h) => h.trim().toLowerCase());
    const out = { trades: [], skipped: 0, errors: [] };
    const idx = Object.fromEntries(["symbol", "isin", "trade_date", "exchange", "segment", "trade_type", "quantity", "price", "trade_id", "order_execution_time"].map((n) => [n, col(head, n)]));
    for (const n of ["symbol", "trade_date", "trade_type", "quantity", "price", "trade_id"]) if (idx[n] < 0) { out.errors.push(`The file has no "${n}" column.`); return out; }
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i], get = (n) => (idx[n] >= 0 ? String(r[idx[n]] || "").trim() : "");
      const seg = get("segment").toUpperCase();
      if (seg && seg !== "EQ") { out.skipped++; continue; }
      const side = get("trade_type").toLowerCase(), date = iso(get("trade_date")), qty = num(get("quantity")), price = num(get("price"));
      if ((side !== "buy" && side !== "sell") || !validISO(date) || !(qty > 0) || !(price > 0)) { out.errors.push(`Line ${i + 1}: not a usable trade.`); continue; }
      out.trades.push({ id: "z:" + (get("exchange") || "NSE") + ":" + get("trade_id"), broker: "Zerodha", demat: (ctx && ctx.demat) || "Zerodha", owner: (ctx && ctx.owner) || "Me", symbol: symOf(get("symbol")), isin: get("isin"), date, time: get("order_execution_time") || date, side, qty: r4(qty), price: r4(price), source: (ctx && ctx.source) || "" });
    }
    return out;
  }

  /** Groww order history: "27-08-2026 10:46 AM". Value is the whole amount of the trade, so the price is value ÷ quantity. */
  function parseGroww(text, ctx) {
    const rows = parseCSV(text), head = (rows[0] || []).map((h) => h.trim().toLowerCase());
    const out = { trades: [], skipped: 0, errors: [] };
    const idx = Object.fromEntries(["symbol", "isin", "type", "quantity", "value", "exchange", "execution date and time"].map((n) => [n, col(head, n)]));
    for (const n of ["symbol", "type", "quantity", "value", "execution date and time"]) if (idx[n] < 0) { out.errors.push(`The file has no "${n}" column.`); return out; }
    const seen = new Map();
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i], get = (n) => (idx[n] >= 0 ? String(r[idx[n]] || "").trim() : "");
      const side = get("type").toLowerCase(), qty = num(get("quantity")), value = num(get("value"));
      const m = /^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(get("execution date and time"));
      if (!m || (side !== "buy" && side !== "sell") || !(qty > 0) || !(value > 0)) { out.errors.push(`Line ${i + 1}: not a usable trade.`); continue; }
      let h = +m[4] % 12; if (m[6].toUpperCase() === "PM") h += 12;
      const date = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      if (!validISO(date) || +m[4] < 1 || +m[4] > 12) { out.errors.push(`Line ${i + 1}: not a real date.`); continue; }
      const time = `${date}T${String(h).padStart(2, "0")}:${m[5]}:00`, sym = symOf(get("symbol"));
      // this file has no trade number: the same fill twice in one file is two fills (counted 1, 2…); the same fill in two overlapping files is one
      const base = `g:${sym}|${time}|${side}|${r4(qty)}|${r4(value)}`, n = (seen.get(base) || 0) + 1; seen.set(base, n);
      out.trades.push({ id: base + "|" + n, broker: "Groww", demat: (ctx && ctx.demat) || "Groww", owner: (ctx && ctx.owner) || "Wife", symbol: sym, isin: get("isin"), date, time, side, qty: r4(qty), price: r4(value / qty), source: (ctx && ctx.source) || "" });
    }
    return out;
  }

  /** Reads one file of either kind. ctx = { owner, demat, source }. → { format, trades, skipped, errors } */
  function parseFile(text, ctx) {
    const format = detectFormat(text);
    if (!format) return { format: null, trades: [], skipped: 0, errors: ["This file is not a Zerodha tradebook or a Groww order history."] };
    return { format, ...(format === "zerodha-tradebook" ? parseZerodha(text, ctx) : parseGroww(text, ctx)) };
  }

  /** Trades already kept + new ones; the same trade (same id) is kept once. → { trades (oldest first), added, duplicates } */
  function mergeTrades(existing, incoming) {
    const map = new Map();
    for (const t of existing || []) if (t && t.id) map.set(t.id, t);
    let added = 0, duplicates = 0;
    for (const t of incoming || []) { if (!t || !t.id) continue; if (map.has(t.id)) duplicates++; else { map.set(t.id, t); added++; } }
    const trades = [...map.values()].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : a.id < b.id ? -1 : 1));
    return { trades, added, duplicates };
  }

  const posKey = (owner, demat, symbol) => `${owner || "Me"}|${demat || ""}|${symOf(symbol)}`;

  /**
   * Share splits and bonus issues that change how many shares a trade became. A tradebook shows the shares as bought, but the holding
   * today has been through the split or bonus, so without these the files "explain" too few shares (a split) or sell more than they
   * bought (a bonus). Only actions checked against the exchange or the company's own notice are listed; nothing else is assumed.
   *   split: every share held becomes `ratio` shares; the money paid does not change, so each share's price is divided by `ratio`.
   *   bonus: `ratio` free shares for each share held, at no cost, counted from `date`.
   * `date` is the ex-date: trades on or after it are already in the new shares.
   */
  const ACTIONS = [
    { symbol: "VBL", kind: "split", date: "2024-09-12", ratio: 2.5, note: "Varun Beverages split its Rs 5 shares into Rs 2 shares (record and ex-date 12 Sep 2024; ISIN INE200M01021 became INE200M01039): 1 share became 2.5", source: "https://msei.in/SX-Content/Circulars/2024/September/Circular-15949.pdf" },
    { symbol: "MAZDOCK", kind: "split", date: "2024-12-27", ratio: 2, note: "Mazagon Dock split each Rs 10 share into two Rs 5 shares (record and ex-date 27 Dec 2024): 1 share became 2", source: "https://business-standard.com/amp/markets/news/mazagon-dock-shares-trade-ex-date-for-stock-split-today-check-details-124122700355_1.html" },
    { symbol: "WIPRO", kind: "bonus", date: "2024-12-03", ratio: 1, note: "Wipro 1:1 bonus (record date 3 Dec 2024): 1 free share for each share held, at no cost. Credited by 15 Dec 2024, so every lot is long-term either way", source: "https://www.businesstoday.in/markets/company-stock/story/wipro-shares-rise-as-board-announces-record-date-for-bonus-issue-454643-2024-11-22" },
  ];

  /** Replays the trades, first in first out, one position per owner + broker + share. Splits and bonus issues are applied on their date. → Map(key → { owner, demat, symbol, lots[{date, qty, price}], qty, cost, oversold, bought, sold, first, last }) */
  function replay(trades, actions) {
    const acts = (Array.isArray(actions) ? actions : ACTIONS).filter((a) => a && validISO(a.date) && num(a.ratio) > 0).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const sorted = (trades || []).slice().sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : a.side === b.side ? 0 : a.side === "buy" ? -1 : 1));
    const map = new Map();
    let next = 0;
    const applyAction = (a) => {
      const f = num(a.ratio), sym = symOf(a.symbol);
      for (const p of map.values()) {
        if (p.symbol !== sym) continue;
        if (a.kind === "split") { p.lots.forEach((l) => { l.qty = r4(l.qty * f); l.price = l.price / f; }); p.bought = r4(p.bought * f); p.sold = r4(p.sold * f); p.oversold = r4(p.oversold * f); }
        else if (a.kind === "bonus") { const held = r4(p.lots.reduce((t, l) => t + l.qty, 0)), extra = r4(held * f); if (extra > EPS) { p.lots.push({ date: a.date, qty: extra, price: 0, bonus: true }); p.bought = r4(p.bought + extra); } }
      }
    };
    for (const t of sorted) {
      while (next < acts.length && acts[next].date <= t.date) applyAction(acts[next++]);
      const k = posKey(t.owner, t.demat, t.symbol);
      const p = map.get(k) || map.set(k, { key: k, owner: t.owner || "Me", demat: t.demat || "", symbol: symOf(t.symbol), lots: [], oversold: 0, bought: 0, sold: 0, first: t.date, last: t.date }).get(k);
      if (t.date < p.first) p.first = t.date; if (t.date > p.last) p.last = t.date;
      if (t.side === "buy") { p.lots.push({ date: t.date, qty: num(t.qty), price: num(t.price) }); p.bought += num(t.qty); }
      else {
        let need = num(t.qty); p.sold += need;
        while (need > EPS && p.lots.length) { const l = p.lots[0], take = Math.min(need, l.qty); l.qty = r4(l.qty - take); need -= take; if (l.qty <= EPS) p.lots.shift(); }
        if (need > EPS) p.oversold = r4(p.oversold + need);   // sold shares the files never show being bought: the buys are in an earlier file
      }
    }
    while (next < acts.length) applyAction(acts[next++]);
    for (const p of map.values()) { p.qty = r4(p.lots.reduce((t, l) => t + l.qty, 0)); p.cost = r2(p.lots.reduce((t, l) => t + l.qty * l.price, 0)); }
    return map;
  }

  /**
   * The shares a sale used, from the trades (first in, first out), ready for the sales module's buildSale.
   * `sel` = { owner, demat, symbol, date, name, time? }: every sell of that share on that day is one sale. With `time` (the sell's execution time, or a
   * date-time in `date`) only that sell is the sale, so a share bought and sold again the same day can be told apart: the later round trip is left out.
   * Refuses (ok:false) when the files do not show where every sold share came from, rather than inventing a cost.
   * → { ok:true, cand, price, date, sellTrades } | { ok:false, error }
   */
  function saleCandidate(trades, sel, actions) {
    const s = sel || {}, key = posKey(s.owner, s.demat, s.symbol), date = iso(s.date), at = s.time || (String(s.date || "").length > 10 ? String(s.date) : "");
    if (!validISO(date)) return { ok: false, error: "Which day was the sale?" };
    const mine = (trades || []).filter((t) => t && posKey(t.owner, t.demat, t.symbol) === key);
    const sells = mine.filter((t) => t.side === "sell" && t.date === date && (!at || t.time === at));
    if (!sells.length) return { ok: false, error: "The files show no sale of that share on that day." };
    const first = sells.map((t) => t.time).sort()[0];
    const before = mine.filter((t) => t.time < first);
    const p = replay(before, actions).get(key);
    const lots = p ? p.lots.map((l) => ({ ...l })) : [];
    const qty = r4(sells.reduce((t, x) => t + num(x.qty), 0)), gross = sells.reduce((t, x) => t + num(x.qty) * num(x.price), 0);
    let need = qty; const used = [];
    for (const l of lots) { if (need <= EPS) break; const take = Math.min(need, l.qty); used.push({ buyDate: l.date, buyDateKnown: true, qty: r4(take), cost: r2(take * l.price) }); need = r4(need - take); }
    if (need > EPS) return { ok: false, error: `The files show only ${r4(qty - need)} of the ${qty} shares sold being bought: ${need} are missing, so the cost cannot be worked out.` };
    const cost = r2(used.reduce((t, l) => t + l.cost, 0));
    const cand = { id: "salecand-" + hash16(`${key}|${date}|${qty}`), key: `${symOf(s.symbol)}|${s.owner || "Me"}|${s.demat || ""}`, symbol: symOf(s.symbol), name: s.name || symOf(s.symbol), owner: s.owner || "Me", demat: s.demat || "", qty, cost, lots: used, lastPrice: 0, whole: true, detectedOn: date };
    return { ok: true, cand, price: r4(gross / qty), date, sellTrades: sells.length };
  }

  /** A date shared by most rows (5 or more rows, more than half) is the day a sheet was imported, not a buy date. */
  function stampedDate(rows) {
    const list = (rows || []).filter((r) => num(r.quantity) > 0);
    if (list.length < 5) return null;
    const count = {};
    list.forEach((r) => { const d = iso(r.purchaseDate || r.date); count[d] = (count[d] || 0) + 1; });
    const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
    return top && top[1] / list.length > 0.5 ? top[0] : null;
  }
  const isUnknownDate = (r, stamp) => r.buyDateKnown === false || (stamp !== null && iso(r.purchaseDate || r.date) === stamp) || !validISO(iso(r.purchaseDate || r.date));

  /** The holdings as positions: one per owner + broker + share, with the rows that make it up. */
  function heldPositions(stocks) {
    const stamp = stampedDate(stocks), map = new Map();
    for (const r of stocks || []) {
      const qty = num(r.quantity);
      if (!(qty > 0)) continue;
      const sym = symOf(r.symbol || r.company), k = posKey(r.owner, r.demat, sym);
      const p = map.get(k) || map.set(k, { key: k, owner: r.owner || "Me", demat: r.demat || "", symbol: sym, qty: 0, cost: 0, rows: [], allUnknown: true }).get(k);
      p.qty = r4(p.qty + qty); p.cost = r2(p.cost + (num(r.invested) || num(r.avgPrice) * qty)); p.rows.push(r);
      if (!isUnknownDate(r, stamp)) p.allUnknown = false;
    }
    for (const p of map.values()) p.avg = p.qty > 0 ? p.cost / p.qty : 0;
    return map;
  }

  const closeEnough = (a, b) => Math.abs(a - b) <= Math.max(COST_TOLERANCE_MIN, Math.abs(b) * COST_TOLERANCE_PCT / 100);

  /**
   * Compares the replayed trades with the holdings. → { items[], soldSince[], tradesOnly[] }
   * item = { key, owner, demat, symbol, status, heldQty, explainedQty, missingQty, heldAvg, tradeAvg, lots[{date, qty, price}], oversold, first, last, alreadyDated, note }
   * soldSince = positions the trades still show as held but the holdings no longer have (sold after the files end, or a split).
   */
  function reconcile(trades, stocks, actions) {
    const rep = replay(trades, actions), held = heldPositions(stocks), items = [], soldSince = [];
    for (const h of held.values()) {
      const p = rep.get(h.key);
      const base = { key: h.key, owner: h.owner, demat: h.demat, symbol: h.symbol, heldQty: h.qty, heldCost: h.cost, heldAvg: r2(h.avg), alreadyDated: !h.allUnknown };
      if (!p || (p.lots.length === 0 && p.bought === 0)) { items.push({ ...base, status: "none", explainedQty: 0, missingQty: h.qty, tradeAvg: null, lots: [], oversold: 0, first: null, last: null, note: "No trade for it in the files." }); continue; }
      const q = p.qty, avg = q > 0 ? p.cost / q : 0, missing = r4(h.qty - q);
      const it = { ...base, explainedQty: q, missingQty: missing, tradeAvg: q > 0 ? r2(avg) : null, lots: p.lots.map((l) => ({ ...l })), oversold: p.oversold, first: p.first, last: p.last };
      if (Math.abs(missing) <= EPS) it.status = closeEnough(avg, h.avg) ? "exact" : "check", it.note = it.status === "exact" ? "" : `Same shares, but the files average ${r2(avg)} and the books say ${r2(h.avg)}.`;
      else if (missing > 0) it.status = q > 0 ? "short" : "none", it.note = q > 0 ? `The files explain ${q} of ${h.qty} shares${p.oversold > 0 ? `; they also sell ${p.oversold} shares they never show being bought, so earlier buys are missing` : ""}.` : "The files show these shares sold, none left.";
      else it.status = "extra", it.note = `The files show ${q} shares left but ${h.qty} are held: a later sale, a split or a bonus.`;
      items.push(it);
    }
    for (const p of rep.values()) if (!held.has(p.key) && p.qty > EPS) soldSince.push({ key: p.key, owner: p.owner, demat: p.demat, symbol: p.symbol, qty: p.qty, last: p.last });
    const order = { exact: 0, short: 1, check: 2, extra: 3, none: 4 };
    items.sort((a, b) => order[a.status] - order[b.status] || (a.owner === b.owner ? (a.symbol < b.symbol ? -1 : 1) : a.owner === "Me" ? -1 : 1));
    return { items, soldSince, tradeCount: (trades || []).length };
  }

  /**
   * The new stock rows for one reconciled position, or null when nothing can safely be applied.
   * exact → one row per dated lot. short → the dated lots plus ONE row for the unexplained shares, marked buyDateKnown:false.
   * The lots are scaled so the total invested stays what the books already say.
   */
  function rowsFor(item, held, today) {
    if (!item || !held || (item.status !== "exact" && item.status !== "short")) return null;
    if (item.alreadyDated || !held.allUnknown) return null;
    const lots = item.lots.filter((l) => l.qty > EPS);
    if (!lots.length) return null;
    const explainedCost = lots.reduce((t, l) => t + l.qty * l.price, 0);
    let rest = null, scale = 1;
    if (item.status === "exact") scale = explainedCost > 0 ? held.cost / explainedCost : 1;
    else {
      const restQty = r4(held.qty - item.explainedQty), restCost = held.cost - explainedCost;
      if (!(restQty > EPS) || !(restCost > 0)) return null;   // the books' cost is less than the dated part alone: do not invent a remainder
      rest = { qty: restQty, cost: restCost };
    }
    const first = held.rows[0], keep = (r) => ({ ...r });
    const make = (qty, cost, date, known, n) => {
      const row = keep(first);
      row.id = "lot-" + hash16(`${item.key}|${date}|${qty}|${known}|${n}`);
      row.quantity = r4(qty); row.invested = r2(cost); row.avgPrice = qty > 0 ? r2(cost / qty) : 0;
      row.purchaseDate = date; row.date = date; row.buyDateKnown = known;
      if ("currentPrice" in first && first.currentPrice != null) row.currentPrice = first.currentPrice;
      return row;
    };
    // same-day buys of the same share become one lot
    const byDay = new Map();
    for (const l of lots) { const e = byDay.get(l.date) || byDay.set(l.date, { qty: 0, cost: 0 }).get(l.date); e.qty += l.qty; e.cost += l.qty * l.price * scale; }
    const out = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([d, e], i) => make(e.qty, e.cost, d, true, i));
    if (rest) out.unshift(make(rest.qty, rest.cost, iso(first.purchaseDate || first.date) || today || "", false, "rest"));
    return { replaceIds: held.rows.map((r) => r.id), rows: out };
  }

  /**
   * Applies the plan to the stock rows. `choose` = the keys the household agreed to (default: every exact one; "short" ones only when named).
   * Never touches a position that already has real dates, nor one whose cost cannot carry the change.
   * → { stocks, applied[{key, symbol, owner, lots, unknownQty}], skipped[{key, why}] }
   */
  function apply(stocks, recon, choose, today) {
    const held = heldPositions(stocks), want = choose ? new Set(choose) : null;
    const replace = new Map(), applied = [], skipped = [];
    for (const it of recon.items) {
      if (it.status !== "exact" && it.status !== "short") continue;
      if (want ? !want.has(it.key) : it.status !== "exact") continue;
      const h = held.get(it.key), r = rowsFor(it, h, today);
      if (!r) { skipped.push({ key: it.key, why: it.alreadyDated ? "it already has real buy dates" : "its cost cannot carry the change" }); continue; }
      r.replaceIds.forEach((id) => replace.set(id, r));
      applied.push({ key: it.key, symbol: it.symbol, owner: it.owner, lots: r.rows.filter((x) => x.buyDateKnown !== false).length, unknownQty: r.rows.filter((x) => x.buyDateKnown === false).reduce((t, x) => t + x.quantity, 0) });
    }
    const out = [], placed = new Set();
    for (const r of stocks || []) {
      const rep = replace.get(r.id);
      if (!rep) { out.push(r); continue; }
      if (!placed.has(rep)) { placed.add(rep); out.push(...rep.rows); }
    }
    return { stocks: out, applied, skipped };
  }

  return { EPS, ACTIONS, saleCandidate, COST_TOLERANCE_PCT, parseCSV, detectFormat, parseZerodha, parseGroww, parseFile, mergeTrades, replay, heldPositions, stampedDate, reconcile, rowsFor, apply, posKey, validISO };
});
