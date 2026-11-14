/**
 * Life Ledger — recording a sale (pure; no DOM, no network).
 *
 * When "Sync Holdings" brings in a sheet in which a share has gone (or fewer of it are held), the app used to forget it: no
 * proceeds, no gain or loss, no tax, no bank credit. This module notices the missing quantity at the moment of the sync
 * (the only moment both the old and the new book are known), turns it into a pending "did you sell this?" item, and, once the
 * household says at what price and on what date, builds a sale record in the shape the tax engine already reads
 * (state.sales → tax-core buildLots().realised, which turns each lot into a realised row).
 *
 * Nothing is guessed: the sale price, date and charges are the household's; the cost comes from the lots that left (first in,
 * first out, the way Indian shares are matched); a lot whose real buy date is not known is marked so, and its term is left
 * "unknown" instead of being assumed.
 *
 * Only Indian stocks and ETFs are watched. A mutual fund sale already shows up as a redemption row in the sheet.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerSales = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const EPS = 1e-6;
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const r2 = (n) => Math.round(n * 100) / 100;
  const iso = (v) => String(v || "").slice(0, 10);
  const validISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && (() => { const t = Date.parse(s + "T00:00:00Z"); return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s; })();
  const symOf = (r) => String(r.symbol || r.company || "").toUpperCase().replace(/\s*-EQ$/i, "").trim();
  const posKey = (r) => `${symOf(r)}|${r.owner || "Me"}|${r.demat || ""}`;

  function hash16(str) {
    let a = 0x811c9dc5, b = 0x9747b28c;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); a ^= c; a = Math.imul(a, 16777619); b ^= c + i; b = Math.imul(b, 2246822519); }
    return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
  }

  /**
   * A broker/sheet import stamps rows with the day it ran, so a date shared by most rows is not a real buy date
   * (the same rule the tax engine uses). Returns that stamped date, or null.
   */
  function stampedDate(rows) {
    const list = (rows || []).filter((r) => num(r.quantity) > 0);
    if (list.length < 5) return null;
    const count = {};
    list.forEach((r) => { const d = iso(r.purchaseDate || r.date); count[d] = (count[d] || 0) + 1; });
    const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
    return top && top[1] / list.length > 0.5 ? top[0] : null;
  }

  /** The book as positions: one per share + owner + broker, each with its lots oldest first. */
  function positions(rows) {
    const stamp = stampedDate(rows);
    const map = new Map();
    (rows || []).forEach((r, i) => {
      const qty = num(r.quantity);
      if (!(qty > 0)) return;
      const k = posKey(r);
      const p = map.get(k) || map.set(k, { key: k, symbol: symOf(r), name: r.company || r.symbol || "", owner: r.owner || "Me", demat: r.demat || "", qty: 0, lastPrice: 0, lots: [] }).get(k);
      const date = iso(r.purchaseDate || r.date);
      p.qty += qty;
      if (num(r.currentPrice) > 0) p.lastPrice = num(r.currentPrice);
      p.lots.push({ date, dateKnown: !(stamp && date === stamp) && validISO(date) && r.buyDateKnown !== false, qty, cost: num(r.invested) || num(r.avgPrice) * qty, _i: i });
    });
    for (const p of map.values()) p.lots.sort((a, b) => (a.dateKnown === b.dateKnown ? (a.date < b.date ? -1 : a.date > b.date ? 1 : a._i - b._i) : a.dateKnown ? -1 : 1));
    return map;
  }

  /**
   * Shares that left the book between two imports. prev / next = the stock rows before and after.
   * One candidate per position whose held quantity fell: { id, key, symbol, name, owner, demat, qty, cost, lots[], lastPrice,
   * whole, detectedOn }. The lots that left are the OLDEST ones first (first in, first out).
   */
  function detect(prev, next, today) {
    const before = positions(prev), after = positions(next);
    const out = [];
    for (const [k, p] of before) {
      const left = after.has(k) ? after.get(k).qty : 0;
      const sold = p.qty - left;
      if (!(sold > EPS)) continue;
      let need = sold;
      const lots = [];
      for (const l of p.lots) {
        if (need <= EPS) break;
        const take = Math.min(need, l.qty);
        lots.push({ buyDate: l.date, buyDateKnown: l.dateKnown, qty: r2n(take), cost: r2(l.cost * (take / l.qty)) });
        need -= take;
      }
      const cost = r2(lots.reduce((t, l) => t + l.cost, 0));
      out.push({ id: "salecand-" + hash16(`${k}|${today}|${r2n(sold)}`), key: k, symbol: p.symbol, name: p.name, owner: p.owner, demat: p.demat, qty: r2n(sold), cost, lots, lastPrice: p.lastPrice, whole: left <= EPS, detectedOn: today });
    }
    return out;
  }
  const r2n = (n) => Math.round(n * 10000) / 10000;

  /** New candidates added to those still waiting (same id = same event, never twice). */
  function mergePending(existing, found) {
    const seen = new Set((existing || []).map((c) => c.id));
    return [...(existing || []), ...(found || []).filter((c) => !seen.has(c.id))];
  }

  /**
   * A sale record from a candidate and what the household typed.
   * input = { price (per share, ₹), date (YYYY-MM-DD), charges (₹, brokerage + taxes, default 0), buyDate (optional: the real buy date, when the
   * sheet only had its import date) }, ctx = { today }.
   * → { ok: true, sale } | { ok: false, error }.
   * The sale: { id, symbol, name, owner, demat, soldOn, qty, price, gross, charges, proceeds, cost, gain, lots:[{ buyDate, buyDateKnown, qty, cost }], bankCredited:false }.
   */
  function buildSale(cand, input, ctx) {
    const c = cand || {}, i = input || {}, today = (ctx && ctx.today) || "";
    const price = num(i.price), charges = num(i.charges), qty = num(c.qty);
    if (!(qty > 0)) return { ok: false, error: "There is no quantity to sell." };
    if (!(price > 0)) return { ok: false, error: "Enter the price you sold at, per share." };
    if (!validISO(iso(i.date))) return { ok: false, error: "Enter the date of the sale." };
    if (today && iso(i.date) > today) return { ok: false, error: "A sale cannot be in the future." };
    if (charges < 0) return { ok: false, error: "Charges cannot be negative." };
    const gross = r2(qty * price);
    if (charges > gross) return { ok: false, error: "Charges are more than the sale value." };
    let lots = (c.lots || []).map((l) => ({ buyDate: l.buyDate, buyDateKnown: l.buyDateKnown !== false, qty: num(l.qty), cost: num(l.cost) }));
    if (i.buyDate !== undefined && i.buyDate !== "") {
      if (!validISO(iso(i.buyDate))) return { ok: false, error: "The buy date is not a valid date." };
      if (iso(i.buyDate) > iso(i.date)) return { ok: false, error: "The shares cannot be bought after they were sold." };
      lots = lots.map((l) => (l.buyDateKnown ? l : { ...l, buyDate: iso(i.buyDate), buyDateKnown: true }));
    }
    for (const l of lots) if (l.buyDateKnown && l.buyDate > iso(i.date)) return { ok: false, error: `A lot was bought on ${l.buyDate}, after the sale date.` };
    const proceeds = r2(gross - charges), cost = r2(lots.reduce((t, l) => t + l.cost, 0));
    return { ok: true, sale: { id: "sale-" + hash16(`${c.id || c.key}|${iso(i.date)}|${price}|${charges}`), symbol: c.symbol, name: c.name || c.symbol, owner: c.owner || "Me", demat: c.demat || "", soldOn: iso(i.date), qty, price: r2(price), gross, charges: r2(charges), proceeds, cost, gain: r2(proceeds - cost), lots, bankCredited: false } };
  }

  /** A candidate typed in by hand, for a sale the sync never saw (the shares were already gone). */
  function manualCandidate(f, today) {
    const qty = num(f.qty), avg = num(f.avgCost);
    if (!String(f.symbol || f.name || "").trim()) return { ok: false, error: "Which share was it?" };
    if (!(qty > 0)) return { ok: false, error: "How many shares?" };
    if (!(avg > 0)) return { ok: false, error: "Enter what each share cost you on average." };
    const known = f.buyDate && validISO(iso(f.buyDate));
    if (f.buyDate && !known) return { ok: false, error: "The buy date is not a valid date." };
    const sym = String(f.symbol || f.name).toUpperCase().trim();
    const cand = { id: "salecand-" + hash16(`manual|${sym}|${f.owner || "Me"}|${qty}|${avg}|${f.buyDate || ""}`), key: `${sym}|${f.owner || "Me"}|${f.demat || ""}`, symbol: sym, name: String(f.name || f.symbol).trim(), owner: f.owner || "Me", demat: f.demat || "", qty: r2n(qty), cost: r2(qty * avg), lots: [{ buyDate: known ? iso(f.buyDate) : "", buyDateKnown: Boolean(known), qty: r2n(qty), cost: r2(qty * avg) }], lastPrice: 0, whole: true, detectedOn: today, manual: true };
    return { ok: true, cand };
  }

  /** The owner's bank record with the proceeds added. → { ok, list, id, before, after } | { ok: false, error }. Does not change the input. */
  function creditBank(banks, sale, today) {
    const list = banks || [];
    const i = list.findIndex((b) => (b.owner || "Me") === (sale.owner || "Me"));
    if (i < 0) return { ok: false, error: `No bank savings record for ${sale.owner || "Me"} to add the money to.` };
    const before = num(list[i].value), after = r2(before + num(sale.proceeds));
    const next = list.map((b, j) => (j === i ? { ...b, value: after, date: today || b.date } : b));
    return { ok: true, list: next, id: list[i].id, before, after };
  }

  return { EPS, stampedDate, positions, detect, mergePending, buildSale, manualCandidate, creditBank, posKey, validISO };
});
