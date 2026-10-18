/**
 * Life Ledger MCP — one row per holding for funds, Indian stocks/ETFs and US stocks: value, return, technicals,
 * the app's own verdict, reference levels with the holding's value at each, and an estimate of tax if sold today.
 * Pure: price history is passed in (see market.js), so everything here is testable offline.
 */
const Advisor = require("../advisor-engine.js");
const T = require("./technicals.js");
const Tax = require("./tax.js");

const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const r0 = (v) => Math.round(v);
const r1 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
const isoOf = (x) => String(x || "").slice(0, 10);
const symOf = (s) => String(s.symbol || s.company || "").toUpperCase().replace(/\s*-EQ$/i, "").trim();

const BENCH_KEYS = { nifty: "^NSEI", sp500: "^GSPC", gold: "GOLDBEES.NS" };

/** The Yahoo/AMFI keys the tables need, so market.js can fetch them in one go. */
function historyKeys(state) {
  const keys = new Set(Object.values(BENCH_KEYS));
  for (const m of state.mutualFunds || []) { const c = parseInt(m.schemeCode || m.amfiCode, 10); if (c) keys.add(`mf:${c}`); }
  for (const s of state.stocks || []) if (symOf(s)) keys.add(/\.[A-Z]{1,3}$/.test(symOf(s)) ? symOf(s) : `${symOf(s)}.NS`);
  for (const s of state.usstocks || []) if (symOf(s)) keys.add(symOf(s));
  return [...keys];
}

/** Groups raw rows into holdings (same grouping the app's advisor uses): funds by scheme, stocks by symbol. */
function groupHoldings(state, fx) {
  const out = [];
  const mf = new Map();
  for (const t of state.mutualFunds || []) (mf.get(t.fundName || "Unknown") || mf.set(t.fundName || "Unknown", []).get(t.fundName || "Unknown")).push(t);
  for (const [name, txns] of mf) {
    const buys = txns.filter((t) => t.transactionType !== "REDEMPTION"), sells = txns.filter((t) => t.transactionType === "REDEMPTION");
    const unitsIn = buys.reduce((s, t) => s + num(t.units), 0), unitsOut = sells.reduce((s, t) => s + num(t.units), 0);
    const units = unitsIn - unitsOut;
    if (!(units > 0.0001)) continue;
    const costPer = buys.reduce((s, t) => s + num(t.invested), 0) / (unitsIn || 1);
    const nav = num([...txns].reverse().find((t) => num(t.latestNav))?.latestNav) || num(txns[txns.length - 1].nav);
    const prev = num([...txns].reverse().find((t) => num(t.prevNav))?.prevNav) || nav;
    if (!(nav > 0)) continue;
    const code = parseInt(txns.find((t) => t.schemeCode || t.amfiCode)?.schemeCode || txns.find((t) => t.amfiCode)?.amfiCode, 10) || null;
    const owners = [...new Set(txns.map((t) => t.owner || "Me"))];
    out.push({
      key: `mf:${name}`, cls: "mf", name, owner: owners.length > 1 ? "Both" : owners[0], owners, qty: units, price: nav, prevPrice: prev,
      value: units * nav, invested: units * costPer, histKey: code ? `mf:${code}` : null,
      flows: txns.filter((t) => isoOf(t.purchaseDate || t.date) && num(t.invested) > 0).map((t) => ({ date: isoOf(t.purchaseDate || t.date), amount: t.transactionType === "REDEMPTION" ? num(t.invested) : -num(t.invested) })),
    });
  }
  const addStocks = (list, isUS) => {
    const g = new Map();
    for (const s of list || []) { const k = symOf(s); if (k) (g.get(k) || g.set(k, []).get(k)).push(s); }
    for (const [sym, rows] of g) {
      const qty = rows.reduce((s, r) => s + num(r.quantity), 0);
      const price = num(rows[0].currentPrice);
      if (!(qty > 0) || !(price > 0)) continue;
      const f = isUS ? fx : 1, owners = [...new Set(rows.map((r) => r.owner || "Me"))];
      out.push({
        key: `${isUS ? "us" : "in"}:${sym}`, cls: isUS ? "us" : "stock", name: rows[0].company || sym, symbol: sym, owner: owners.length > 1 ? "Both" : owners[0], owners,
        qty, price: price * f, prevPrice: (num(rows[0].prevClose) || price) * f, value: qty * price * f, invested: rows.reduce((s, r) => s + num(r.invested), 0) * f,
        histKey: isUS ? sym : (/\.[A-Z]{1,3}$/.test(sym) ? sym : `${sym}.NS`),
        flows: rows.filter((r) => isoOf(r.purchaseDate || r.date)).map((r) => ({ date: isoOf(r.purchaseDate || r.date), amount: -num(r.invested) * f })),
        category: rows[0].category,
      });
    }
  };
  addStocks(state.stocks, false);
  addStocks(state.usstocks, true);
  return out;
}

const toSeries = (s) => (s && s.d && s.c ? { dates: s.d, closes: s.c } : null);

const CALL = { keep_adding: "Hold — fine to keep adding", hold: "Hold", watch: "Watch", review: "Review", reduce: "Consider trimming", dont_add: "Hold — don't add more", none: "Hold" };

/**
 * rows for kind: "funds" | "stocks" | "us". opts: { today, fx, series (raw proxy series), slabRate: {Me, Wife}, lots }
 */
function holdingsTable(state, kind, opts) {
  const today = opts.today, fx = opts.fx || 1, rawSeries = opts.series || {};
  const all = groupHoldings(state, fx);
  const cls = kind === "funds" ? "mf" : kind === "us" ? "us" : "stock";
  const series = {};
  const bench = {};
  for (const h of all) { const s = toSeries(rawSeries[h.histKey]); if (s) series[h.key] = s; }
  for (const [name, key] of Object.entries(BENCH_KEYS)) { const s = toSeries(rawSeries[key]); if (s) bench[name] = s; }
  const input = {
    now: today, holdings: all.map((h) => ({ ...h, histKey: undefined })), series, benchmarks: bench,
    cash: {}, liabilities: [], goals: [], profile: {}, profileSet: false,
  };
  const analysed = Advisor.analyze(input);
  const items = (analysed.items || analysed.holdings || []);
  const byKey = new Map(items.map((i) => [i.key, i]));
  const lots = opts.lots || [];
  const slab = opts.slabRate || {};
  const total = all.filter((h) => h.cls === cls).reduce((s, h) => s + h.value, 0);

  const rows = all.filter((h) => h.cls === cls).map((h) => {
    const a = byKey.get(h.key) || {};
    const v = a.verdict || {};
    const t = T.technicals(series[h.key]);
    const lv = T.levels(t);
    const gain = h.value - h.invested;
    // Series for US stocks is in dollars while h.price is in rupees: scale levels by the same factor
    const scale = t && t.last ? h.price / t.last : 1;
    const valAt = (p) => (p == null ? null : r0(h.qty * p * scale));
    const hl = lots.filter((l) => (kind === "funds" ? l.kind === "mf" && l.name === h.name : kind === "us" ? l.kind === "us" && l.symbol === h.symbol : l.kind === "stock" && l.symbol === h.symbol));
    let taxNow = 0, taxIfLong = 0, taxIfShort = 0, ltShare = 0, ltGain = 0, totalGainPos = 0, unknown = false;
    const rateFor = (l, long) => { const slabPct = slab[l.owner] ?? 30; return l.cat === "debt" ? slabPct : long ? 12.5 : (l.cat === "equity" || l.cat === "hybrid") ? 20 : slabPct; };
    for (const l of hl) {
      const g = l.qty * l.price - l.cost;
      if (g <= 0) continue;
      const hd = Tax.holding(l, today);
      totalGainPos += g;
      if (hd.unknown) { unknown = true; taxIfLong += g * rateFor(l, true) / 100 * 1.04; taxIfShort += g * rateFor(l, false) / 100 * 1.04; continue; }
      taxNow += g * (rateFor(l, hd.long) / 100) * 1.04;
      if (hd.long) ltGain += g;
    }
    ltShare = totalGainPos && !unknown ? Math.round((ltGain / totalGainPos) * 100) : null;
    const dayPct = h.prevPrice ? (h.price / h.prevPrice - 1) * 100 : null;
    const unknownDates = hl.length > 0 && hl.every((l) => l.dateKnown === false);
    const firstFlow = h.flows.length ? h.flows.reduce((m, f) => (f.date < m ? f.date : m), "9999") : null;
    const ageDays = !unknownDates && firstFlow ? Math.round((new Date(today) - new Date(firstFlow)) / 86400000) : null;
    const flags = [];
    let call = CALL[v.move] || "Hold";
    const gainPctNow = h.invested ? (gain / h.invested) * 100 : 0;
    if (v.move !== "reduce" && v.move !== "review") {
      if (t && t.rsi14 >= 70) call = "Hold — don't add now (stretched)";
      else if (gainPctNow >= 40 && (a.weight || 0) >= 8 && kind !== "funds") call = "Hold — consider trimming some into strength";
      else if (t && t.trend === "Downtrend" && gainPctNow < 0) call = "Watch — weak trend and below cost";
      else if (t && t.trend === "Uptrend" && t.rsi14 != null && t.rsi14 < 65 && v.move === "keep_adding") call = "Hold — trend supports adding";
    }
    if (unknown) flags.push("Buy dates are not in your data — tax shown as a range");
    if (t && t.rsi14 >= 70) flags.push("RSI " + t.rsi14 + " — stretched; poor time to add");
    if (t && t.rsi14 != null && t.rsi14 <= 30) flags.push("RSI " + t.rsi14 + " — oversold");
    if (t && t.sma200 && t.last < t.sma200) flags.push("Below 200-day average");
    if (a.weight >= 8 && kind !== "funds") flags.push(`${r1(a.weight)}% of all holdings`);
    return {
      name: h.name, id: h.symbol || (h.histKey || "").replace("mf:", "scheme "), owner: h.owner,
      qty: kind === "funds" ? Math.round(h.qty * 1000) / 1000 : Math.round(h.qty * 1000) / 1000,
      avgCost: r1(h.invested / h.qty), price: r1(h.price), value: r0(h.value), invested: r0(h.invested),
      gain: r0(gain), gainPct: h.invested ? r1((gain / h.invested) * 100) : null, xirrPct: a.xirr != null && ageDays != null && ageDays >= 365 ? r1(a.xirr) : null, ageDays,
      dayPct: r1(dayPct), weightPct: r1((h.value / (total || 1)) * 100),
      vsMarket1yPp: a.vs1yBenchmark != null ? r1(a.vs1yBenchmark) : null,
      verdict: v.label || "n/a", call, why: (v.reasons || []).slice(0, 2),
      technical: t ? { trend: t.trend, rsi14: t.rsi14, rsiNote: t.rsiNote, sma50: t.sma50, sma200: t.sma200, fromHi52Pct: t.fromHi52Pct, rangePos52Pct: t.rangePos52Pct, r1m: t.r1m, r3m: t.r3m, r6m: t.r6m, r1y: t.r1y, asOf: t.asOf } : null,
      levels: lv ? {
        reviewBelow: { price: r1(lv.reviewBelow * scale), priceNative: r1(lv.reviewBelow), pct: lv.reviewBelowPct, holdingValue: valAt(lv.reviewBelow) },
        firstTarget: { price: r1(lv.firstTarget * scale), priceNative: r1(lv.firstTarget), pct: lv.firstTargetPct, holdingValue: valAt(lv.firstTarget) },
        stretchTarget: { price: r1(lv.stretchTarget * scale), priceNative: r1(lv.stretchTarget), pct: lv.stretchTargetPct, holdingValue: valAt(lv.stretchTarget) },
      } : null,
      taxIfSoldTodayApprox: unknown ? { ifAllLongTerm: r0(taxIfLong), ifAllShortTerm: r0(taxIfShort) } : r0(taxNow), longTermSharePct: ltShare,
      flags,
      confidence: a.historyDays >= 300 ? "high" : a.historyDays >= 90 ? "medium" : "low",
    };
  }).sort((a, b) => b.value - a.value);

  return {
    kind, asOf: today, count: rows.length, rows,
    withoutHistory: rows.filter((r) => !r.technical).map((r) => r.name),
    notes: [
      "Levels are reference points from price history (200-day average, 60-day low, 52-week high). They ignore company fundamentals, results and news.",
      "Tax is an estimate with no ₹1.25 lakh exemption netting and the slab rate you supplied; see tax_report for the proper position.",
    ],
  };
}

module.exports = { holdingsTable, historyKeys, groupHoldings, BENCH_KEYS };
