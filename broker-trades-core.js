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
 * Supported files: Zerodha Console tradebook (CSV), Groww order history (CSV) and Upstox trade history and INDmoney transactions report (CSV, or the .xlsx they are sent as, read by mcp/xlsx-read.js). Anything else is named as unsupported, not guessed at.
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

  /** A company that changed its trading symbol: the old one is read as the new one, so its trades and its holding are one position. */
  const RENAMES = { AMIORG: "ACUTAAS", ICICIB22: "BHARAT22" };   // ICICIB22 is the exchange symbol INDmoney reports for the Bharat 22 ETF (ISIN INF109KB15Y7); the holdings call it BHARAT22   // Ami Organics became Acutaas Chemicals in 2025 (same company; the split below is dated by its record date)
  const symOf = (v) => { const x = String(v || "").toUpperCase().replace(/\s*-EQ$/i, "").trim(); return RENAMES[x] || x; };

  /** Which kind of file this is, from its header row: "zerodha-tradebook" | "groww-history" | "upstox-tradebook" | "indmoney-transactions" | null. */
  function detectFormat(text) {
    const rows = parseCSV(text);
    const head = (rows[0] || []).map((h) => h.trim().toLowerCase());
    const has = (...n) => n.every((x) => head.includes(x));
    if (has("symbol", "isin", "trade_date", "trade_type", "quantity", "price", "trade_id")) return "zerodha-tradebook";
    if (has("symbol", "type", "quantity", "value", "execution date and time")) return "groww-history";
    if (has("date", "company", "scrip code", "trade num", "trade time", "side", "quantity", "price")) return "upstox-tradebook";
    if (has("execution date", "scrip symbol", "isin", "type", "quantity", "price", "exchange order id")) return "indmoney-transactions";
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
    const idx = Object.fromEntries(["stock name", "symbol", "isin", "type", "quantity", "value", "exchange", "execution date and time"].map((n) => [n, col(head, n)]));
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
      // this file has no trade number: the same fill twice in one file is two fills (counted 1, 2…); the same fill in two overlapping files is one. The id keeps the symbol as the file wrote it, so a later rename never makes a kept trade look new
      const base = `g:${String(get("symbol")).toUpperCase().trim()}|${time}|${side}|${r4(qty)}|${r4(value)}`, n = (seen.get(base) || 0) + 1; seen.set(base, n);
      out.trades.push({ id: base + "|" + n, broker: "Groww", demat: (ctx && ctx.demat) || "Groww", owner: (ctx && ctx.owner) || "Wife", symbol: sym, name: get("stock name"), isin: get("isin"), date, time, side, qty: r4(qty), price: r4(value / qty), source: (ctx && ctx.source) || "" });
    }
    return out;
  }


  /**
   * Upstox names a share by company (not by symbol) and a code, so each pair is listed here against the symbol the holdings use.
   * A pair that is not listed stops the file (named in the error) instead of being guessed. Checked against the holdings' own average cost.
   */
  const UPSTOX_SYMBOLS = {
    "BANK BEES|590106": "BANKBEES", "NIFTY BEES|590103": "NIFTYBEES", "KOTAKGOLDETF|590097": "GOLD1", "NIP IND ETF MIDCAP 150|MID150BEES": "MID150BEES",
    "N100|533385": "MON100", "RELCAPAMC NETFIT|206811": "ITBEES", "NIPPON INDIA ETF NIFTY IT|590141": "ITBEES", "HDFC MUTUAL FUND|543775": "HDFCSML250", "HDFC MUTUAL FUND|543776": "HDFCMID150", "CPSE ETF GROWTH|538057": "CPSEETF",
  };
  const excelDay = (v) => { const x = Number(v); if (!Number.isFinite(x) || x < 20000 || x > 80000) return null; return new Date(Math.round((Math.floor(x) - 25569) * 86400000)).toISOString().slice(0, 10); };

  /** Upstox trade history (equity only; the date is an ISO date or an Excel day number). */
  function parseUpstox(text, ctx) {
    const rows = parseCSV(text), head = (rows[0] || []).map((h) => h.trim().toLowerCase());
    const out = { trades: [], skipped: 0, errors: [] };
    const idx = Object.fromEntries(["date", "company", "exchange", "segment", "scrip code", "instrument type", "trade num", "trade time", "side", "quantity", "price"].map((n) => [n, col(head, n)]));
    for (const n of ["date", "company", "scrip code", "trade num", "trade time", "side", "quantity", "price"]) if (idx[n] < 0) { out.errors.push(`The file has no "${n}" column.`); return out; }
    const seen = new Map();
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i], get = (n) => (idx[n] >= 0 ? String(r[idx[n]] || "").trim() : "");
      if (!get("company") && !get("side")) continue;
      const seg = get("segment").toUpperCase(), inst = get("instrument type").toLowerCase();
      if ((seg && seg !== "EQ") || (inst && inst !== "equity")) { out.skipped++; continue; }
      const side = get("side").toLowerCase(), qty = num(get("quantity")), price = num(get("price"));
      const raw = get("date"), date = validISO(raw.slice(0, 10)) ? raw.slice(0, 10) : excelDay(raw);
      const tm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(get("trade time"));   // older rows carry hours and minutes only
      if (!date || !validISO(date) || !tm || +tm[1] > 23 || +tm[2] > 59 || +(tm[3] || 0) > 59 || (side !== "buy" && side !== "sell") || !(qty > 0) || !(price > 0)) { out.errors.push(`Line ${i + 1}: not a usable trade.`); continue; }
      const sym = UPSTOX_SYMBOLS[`${get("company").toUpperCase()}|${get("scrip code")}`];
      if (!sym) { out.errors.push(`Line ${i + 1}: "${get("company")}" (code ${get("scrip code")}) is not a share this app knows how to name.`); continue; }
      const time = `${date}T${tm[1].padStart(2, "0")}:${tm[2]}:${tm[3] || "00"}`, base = `u:${get("exchange") || "NSE"}:${get("trade num")}`, n = (seen.get(base) || 0) + 1; seen.set(base, n);
      out.trades.push({ id: n === 1 ? base : base + "|" + n, broker: "Upstox", demat: (ctx && ctx.demat) || "Upstox", owner: (ctx && ctx.owner) || "Me", symbol: sym, isin: "", date, time, side, qty: r4(qty), price: r4(price), source: (ctx && ctx.source) || "" });
    }
    return out;
  }

  /** INDmoney equity transactions report. The date is an ISO date-time (the .xlsx day number turned into one by the file reader) or an ISO date. */
  function parseIndmoney(text, ctx) {
    const rows = parseCSV(text), head = (rows[0] || []).map((h) => h.trim().toLowerCase());
    const out = { trades: [], skipped: 0, errors: [] };
    const idx = Object.fromEntries(["execution date", "scrip name", "scrip symbol", "isin", "type", "quantity", "price", "exchange", "exchange order id", "order status"].map((n) => [n, col(head, n)]));
    for (const n of ["execution date", "scrip symbol", "type", "quantity", "price", "exchange order id"]) if (idx[n] < 0) { out.errors.push(`The file has no "${n}" column.`); return out; }
    const seen = new Map();
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i], get = (n) => (idx[n] >= 0 ? String(r[idx[n]] || "").trim() : "");
      if (!get("scrip symbol") && !get("type")) continue;   // "No transactions done in this period" and similar lines
      const status = get("order status");
      if (status && !/^executed$/i.test(status)) { out.skipped++; continue; }
      const side = get("type").toLowerCase(), qty = num(get("quantity")), price = num(get("price"));
      const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}:\d{2}))?/.exec(get("execution date")), date = m ? m[1] : "";
      if (!m || !validISO(date) || (side !== "buy" && side !== "sell") || !(qty > 0) || !(price > 0)) { out.errors.push(`Line ${i + 1}: not a usable trade.`); continue; }
      const sym = symOf(get("scrip symbol")), time = `${date}T${m[2] || "00:00:00"}`;
      const base = `i:${get("exchange") || "NSE"}:${get("exchange order id")}|${r4(qty)}|${r4(price)}`, n = (seen.get(base) || 0) + 1; seen.set(base, n);
      out.trades.push({ id: n === 1 ? base : base + "|" + n, broker: "INDmoney", demat: (ctx && ctx.demat) || "INDmoney", owner: (ctx && ctx.owner) || "Wife", symbol: sym, name: get("scrip name"), isin: get("isin"), date, time, side, qty: r4(qty), price: r4(price), source: (ctx && ctx.source) || "" });
    }
    return out;
  }

  /** Reads one file of either kind. ctx = { owner, demat, source }. → { format, trades, skipped, errors } */
  function parseFile(text, ctx) {
    const format = detectFormat(text);
    if (!format) return { format: null, trades: [], skipped: 0, errors: ["This file is not a Zerodha tradebook, a Groww order history, an Upstox trade history or an INDmoney transactions report."] };
    return { format, ...(format === "zerodha-tradebook" ? parseZerodha(text, ctx) : format === "groww-history" ? parseGroww(text, ctx) : format === "upstox-tradebook" ? parseUpstox(text, ctx) : parseIndmoney(text, ctx)) };
  }

  const accountOf = (t) => `${t.owner || "Me"}|${t.demat || ""}`;
  /**
   * Trades already kept + new ones; the same trade (same id, same account) is kept once. → { trades (oldest first), added, duplicates }
   * A Groww row has no trade number, so two people who got the same shares at the same moment (an IPO allotment) make the same id. The
   * second account's trade then gets the id with its account added; ids already kept never change.
   */
  function mergeTrades(existing, incoming) {
    const map = new Map();
    for (const t of existing || []) if (t && t.id) map.set(t.id, t);
    let added = 0, duplicates = 0;
    for (const t of incoming || []) {
      if (!t || !t.id) continue;
      let id = t.id;
      if (map.has(id) && accountOf(map.get(id)) !== accountOf(t)) id = `${t.id}@${accountOf(t)}`;
      if (map.has(id)) duplicates++; else { map.set(id, id === t.id ? t : { ...t, id }); added++; }
    }
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
   *   demerger: `child` shares for every `per` shares held (whole child shares only); `costShare` of the parent's cost moves to the child, which keeps the parent's buy dates.
   * `date` is the ex-date: trades on or after it are already in the new shares.
   */
  const ACTIONS = [
    { symbol: "GAIL", kind: "bonus", date: "2022-09-06", ratio: 0.5, note: "GAIL 1:2 bonus (record date 7 Sep 2022, ex-date 6 Sep 2022): 1 free share for every 2 held, whole shares only, at no cost", source: "https://www.indiainfoline.com/article/news-top-story/gail-india-fixes-record-date-for-1-2-bonus-issue-stock-climbs-2-122082600412_1.html" },
    { symbol: "VBL", kind: "split", date: "2024-09-12", ratio: 2.5, note: "Varun Beverages split its Rs 5 shares into Rs 2 shares (record and ex-date 12 Sep 2024; ISIN INE200M01021 became INE200M01039): 1 share became 2.5", source: "https://msei.in/SX-Content/Circulars/2024/September/Circular-15949.pdf" },
    { symbol: "MAZDOCK", kind: "split", date: "2024-12-27", ratio: 2, note: "Mazagon Dock split each Rs 10 share into two Rs 5 shares (record and ex-date 27 Dec 2024): 1 share became 2", source: "https://business-standard.com/amp/markets/news/mazagon-dock-shares-trade-ex-date-for-stock-split-today-check-details-124122700355_1.html" },
    { symbol: "ACUTAAS", kind: "split", date: "2025-04-25", ratio: 2, note: "Acutaas Chemicals (formerly Ami Organics) split each Rs 10 share into two Rs 5 shares (record and ex-date 25 Apr 2025; ISIN INE00FF01017 became INE00FF01025): 1 share became 2", source: "https://trendlyne.com/equity/Split/ACUTAAS/644637/acutaas-chemicals-ltd-split" },
    { symbol: "ECLERX", kind: "bonus", date: "2026-03-13", ratio: 1, note: "eClerx 1:1 bonus (record and ex-date 13 Mar 2026; allotted 16 Mar 2026): 1 free share for each share held, at no cost", source: "https://www.businesstoday.in/markets/stocks/story/eclerx-services-bonus-shares-explained-why-the-stock-price-may-fall-sharply-today-520389-2026-03-13" },
    { symbol: "STAR", kind: "demerger", child: "ONESOURCE", per: 2, costShare: 0.1065, date: "2024-12-06", note: "Strides Pharma Science demerged its OneSource business: 1 OneSource share for every 2 Strides shares (record date 6 Dec 2024, allotted 10 Dec 2024); 10.65% of the cost of the Strides shares moves to OneSource, 89.35% stays. The OneSource shares keep the Strides buy dates", source: "https://www.angelone.in/news/share-market/strides-pharma-provides-guidance-on-cost-of-acquisition-post-demerger" },
    { symbol: "WIPRO", kind: "bonus", date: "2024-12-03", ratio: 1, note: "Wipro 1:1 bonus (record date 3 Dec 2024): 1 free share for each share held, at no cost. Credited by 15 Dec 2024, so every lot is long-term either way", source: "https://www.businesstoday.in/markets/company-stock/story/wipro-shares-rise-as-board-announces-record-date-for-bonus-issue-454643-2024-11-22" },
  ];

  const byTime = (a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : a.side === b.side ? 0 : a.side === "buy" ? -1 : 1);

  /**
   * One share, one account, one day, the way brokers (and the tax rules) match it: what was bought and sold the same day is set off against
   * each other first (intraday, whatever the order of the two), and only the rest of the sells come out of the older shares, first in first
   * out. Changes `lots` in place. → { used[{ date, qty, price }] (what the day's sells consumed), short (sold shares nothing explains) }
   */
  function matchDay(lots, dayTrades, day) {
    const buys = dayTrades.filter((t) => t.side === "buy").sort(byTime).map((t) => ({ date: day, qty: num(t.qty), price: num(t.price) }));
    let sell = r4(dayTrades.filter((t) => t.side === "sell").reduce((a, t) => a + num(t.qty), 0));
    const used = [];
    const take = (from) => { while (sell > EPS && from.length) { const l = from[0], q = Math.min(sell, l.qty); used.push({ date: l.date, qty: r4(q), price: l.price }); l.qty = r4(l.qty - q); sell = r4(sell - q); if (l.qty <= EPS) from.shift(); } };
    take(buys); take(lots);
    lots.push(...buys);
    return { used, short: sell > EPS ? sell : 0 };
  }

  /** Replays the trades, first in first out (same-day buys and sells set off first), one position per owner + broker + share. Splits and bonus issues are applied on their date. → Map(key → { owner, demat, symbol, lots[{date, qty, price}], qty, cost, oversold, bought, sold, first, last }) */
  function replay(trades, actions) {
    const acts = (Array.isArray(actions) ? actions : ACTIONS).filter((a) => a && validISO(a.date) && (a.kind === "demerger" || num(a.ratio) > 0)).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const sorted = (trades || []).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : byTime(a, b)));
    const map = new Map();
    let next = 0;
    const applyAction = (a) => {
      const f = num(a.ratio), sym = symOf(a.symbol);
      for (const p of map.values()) {
        if (p.symbol !== sym) continue;
        if (a.kind === "split") { p.lots.forEach((l) => { l.qty = r4(l.qty * f); l.price = l.price / f; }); p.bought = r4(p.bought * f); p.sold = r4(p.sold * f); p.oversold = r4(p.oversold * f); }
        else if (a.kind === "demerger") {
          const per = num(a.per), cs = num(a.costShare), child = symOf(a.child), held = r4(p.lots.reduce((t, l) => t + l.qty, 0)), childQty = per > 0 ? Math.floor(held / per + 1e-9) : 0;
          if (!(childQty > 0) || !(cs > 0) || !(cs < 1) || !child) continue;
          // the child shares come from the oldest parent shares (childQty x per of them) and carry cs of those shares' cost and their dates
          let need = childQty * per; const lots = [];
          for (const l of p.lots) { if (need <= EPS) break; const take = Math.min(need, l.qty); lots.push({ date: l.date, qty: r4(take / per), price: l.price * per * cs }); need = r4(need - take); }
          p.lots.forEach((l) => { l.price = l.price * (1 - cs); });
          const ck = posKey(p.owner, p.demat, child), c = map.get(ck) || map.set(ck, { key: ck, owner: p.owner, demat: p.demat, symbol: child, lots: [], oversold: 0, bought: 0, sold: 0, first: a.date, last: a.date }).get(ck);
          c.lots.push(...lots); c.lots.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0)); c.bought = r4(c.bought + childQty);
        }
        else if (a.kind === "bonus") { const held = r4(p.lots.reduce((t, l) => t + l.qty, 0)), extra = Math.floor(held * f + 1e-9); if (extra > EPS)   // whole shares only: a fraction is paid in cash, never credited
           { p.lots.push({ date: a.date, qty: extra, price: 0, bonus: true }); p.bought = r4(p.bought + extra); } }
      }
    };
    for (let i = 0; i < sorted.length;) {
      const day = sorted[i].date, today = new Map();
      for (; i < sorted.length && sorted[i].date === day; i++) { const k = posKey(sorted[i].owner, sorted[i].demat, sorted[i].symbol); (today.get(k) || today.set(k, []).get(k)).push(sorted[i]); }
      while (next < acts.length && acts[next].date <= day) applyAction(acts[next++]);
      for (const [k, list] of today) {
        const t = list[0];
        const p = map.get(k) || map.set(k, { key: k, owner: t.owner || "Me", demat: t.demat || "", symbol: symOf(t.symbol), lots: [], oversold: 0, bought: 0, sold: 0, first: day, last: day }).get(k);
        if (day < p.first) p.first = day; if (day > p.last) p.last = day;
        for (const x of list) { if (x.side === "buy") p.bought += num(x.qty); else p.sold += num(x.qty); }
        const m = matchDay(p.lots, list, day);
        if (m.short) p.oversold = r4(p.oversold + m.short);   // sold shares the files never show being bought: the buys are in an earlier file
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
    // the whole account is replayed, not only this share: a demerger hands a share its lots from another company's trades
    // a whole day: the earlier days, then that day's own buys and sells set off against each other. One named sell: only what came before it
    const before = (trades || []).filter((t) => t && (t.owner || "Me") === (s.owner || "Me") && (t.demat || "") === (s.demat || "") && (at ? t.time < first : t.date < date));
    // only what had already happened by the sale day: a split or demerger later on must not change the shares or the cost of an earlier sale
    const upTo = (Array.isArray(actions) ? actions : ACTIONS).filter((a) => a && a.date <= date);
    const p = replay(before, upTo).get(key);
    const lots = p ? p.lots.map((l) => ({ ...l })) : [];
    const qty = r4(sells.reduce((t, x) => t + num(x.qty), 0)), gross = sells.reduce((t, x) => t + num(x.qty) * num(x.price), 0);
    const dayTrades = at ? sells.concat(mine.filter((t) => t.side === "buy" && t.date === date && t.time < first)) : mine.filter((t) => t.date === date);
    const matched = matchDay(lots, dayTrades, date);
    const used = matched.used.map((l) => ({ buyDate: l.date, buyDateKnown: true, qty: l.qty, cost: r2(l.qty * l.price) }));
    const need = matched.short;
    if (need > EPS) return { ok: false, error: `The files show only ${r4(qty - need)} of the ${qty} shares sold being bought: ${need} are missing, so the cost cannot be worked out.` };
    const cost = r2(used.reduce((t, l) => t + l.cost, 0));
    const cand = { id: "salecand-" + hash16(`${key}|${date}|${qty}`), key: `${symOf(s.symbol)}|${s.owner || "Me"}|${s.demat || ""}`, symbol: symOf(s.symbol), name: s.name || symOf(s.symbol), owner: s.owner || "Me", demat: s.demat || "", qty, cost, lots: used, lastPrice: 0, whole: true, detectedOn: date };
    // the average is left unrounded: rounding it first moves a large day's sale value by a few paise
    return { ok: true, cand, price: gross / qty, date, sellTrades: sells.length };
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

  /**
   * Rows still carrying the import day (`stamp`) get marked buyDateKnown:false. Once some holdings have real dates the import day is no longer
   * "most rows", so without the mark the tax engine would take it for a real buy date (bought today). Rows already marked, rows with no shares
   * and rows on any other day are left as they are. → { stocks, flagged, ids }
   */
  function markStamped(stocks, stamp) {
    const ids = [];
    if (!stamp) return { stocks: stocks || [], flagged: 0, ids };
    const out = (stocks || []).map((r) => { if (r.buyDateKnown === undefined && num(r.quantity) > 0 && iso(r.purchaseDate || r.date) === stamp) { ids.push(r.id); return { ...r, buyDateKnown: false }; } return r; });
    return { stocks: out, flagged: ids.length, ids };
  }

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
   * → { stocks, applied[{key, symbol, owner, lots, unknownQty}], skipped[{key, why}], flagged (rows still on the import day, now marked unknown) }
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
    const marked = markStamped(stocks, stampedDate(stocks));
    const flagSet = new Set(marked.ids.filter((id) => !replace.has(id)));   // rows replaced by dated lots need no mark
    const flagged = flagSet.size;
    const out = [], placed = new Set();
    for (const r of stocks || []) {
      const rep = replace.get(r.id);
      if (!rep) { out.push(flagSet.has(r.id) ? { ...r, buyDateKnown: false } : r); continue; }
      if (!placed.has(rep)) { placed.add(rep); out.push(...rep.rows); }
    }
    return { stocks: out, applied, skipped, flagged };
  }

  return { EPS, ACTIONS, saleCandidate, COST_TOLERANCE_PCT, parseCSV, detectFormat, parseZerodha, parseGroww, parseUpstox, parseIndmoney, UPSTOX_SYMBOLS, markStamped, stampedDate, parseFile, mergeTrades, replay, heldPositions, reconcile, rowsFor, apply, posKey, validISO };
});
