/**
 * Life Ledger — Indian and US stocks panels' logic (pure; no DOM, no network).
 *
 * What the two stock panels work out before they draw anything: which rows each shows (owner and broker), one line per holding
 * with its price, value, gain and day change (looking prices up in the price cache), and the totals above the table. app.js only
 * draws what this returns.
 *
 * The things that live in app.js (number reading, the ISIN lookup, the exchange ticker, the price cache) are passed in as `d`.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerStocksPanel = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const ISIN = /^IN[EF0-9][A-Z0-9]{7,}$/i;

  /**
   * The rows a panel shows: one owner (matchOwner(owner, filter); a row with no owner is Prafful's) and one broker ("All" for
   * every broker; compared without regard to case), newest first.
   */
  function panelRows(all, owner, broker, matchOwner) {
    return (all || [])
      .filter((item) => matchOwner(item.owner || "Me", owner))
      .filter((item) => broker === "All" || (item.demat || "").toLowerCase() === broker.toLowerCase())
      .sort((a, b) => new Date(b.purchaseDate || b.date || "1970-01-01") - new Date(a.purchaseDate || a.date || "1970-01-01"));
  }

  /**
   * One line per Indian holding. d = { num, isinInfo(code) → { symbol, company, category }|null, exchangeTicker(symbol), cache }.
   * A row whose symbol (or company, or isin field) is an ISIN code is shown under the symbol and company the ISIN resolves to.
   * The price is the row's own, else the cache's, else what was paid. The day change comes from the previous close (the row's or the
   * cache's), else from the change the price source reported.
   */
  function indianHoldings(rows, d) {
    return rows.map((item) => {
      let sym = item.symbol || "UNKNOWN", comp = item.company || sym || "Stock", cat = item.category || "Stock";
      if (ISIN.test(sym) || ISIN.test(comp) || ISIN.test(item.isin || "")) {
        const code = item.isin && ISIN.test(item.isin) ? item.isin : (ISIN.test(sym) ? sym : comp);
        const info = d.isinInfo(code);
        if (info) {
          sym = info.symbol;
          if (!comp || ISIN.test(comp) || comp === item.symbol || comp === "Stock") comp = info.company;
          cat = info.category || cat;
        }
      }
      const qty = d.num(item.quantity), avgPrice = d.num(item.avgPrice);
      const cached = d.cache[sym] || d.cache[d.exchangeTicker(sym)] || d.cache[item.symbol];
      const currentPrice = d.num(item.currentPrice || (cached && cached.price) || item.avgPrice);
      const invested = d.num(item.invested || qty * avgPrice);
      const currentValue = qty > 0 && currentPrice > 0 ? qty * currentPrice : d.num(item.currentValue || invested);
      const gain = currentValue - invested;
      const prevClose = item.prevClose ? d.num(item.prevClose) : (cached && cached.prevClose ? d.num(cached.prevClose) : null);
      const directChange = cached && cached.change !== undefined && cached.change !== null ? d.num(cached.change) : null;
      return {
        symbol: sym, company: comp, category: cat, exchange: item.exchange || "NSE", totalQty: qty, avgPrice, totalInv: invested,
        currentPrice, prevClose, currentValue, gain, gainPct: invested > 0 ? (gain / invested) * 100 : 0,
        dayChange: prevClose ? qty * (currentPrice - prevClose) : (directChange !== null ? qty * directChange : null),
        dayChangePct: prevClose && currentPrice ? ((currentPrice - prevClose) / prevClose) * 100 : (cached && cached.changePct !== undefined ? d.num(cached.changePct) : null),
        demat: item.demat || "-", id: item.id,
      };
    });
  }

  /**
   * One line per US holding (amounts in dollars). d = { num, cache }. The cache is looked up under the ticker, the exchange-prefixed
   * tickers, "TICKER.US" and the lower-case ticker. The day change comes from the previous close, else from the row's own day P&L.
   */
  function usHoldings(rows, d) {
    return rows.map((item) => {
      const qty = d.num(item.quantity), avgPrice = d.num(item.avgPrice);
      const sym = (item.symbol || "").toUpperCase().trim();
      const cached = d.cache[sym] || d.cache[`NASDAQ:${sym}`] || d.cache[`NYSE:${sym}`] || d.cache[`NYSEARCA:${sym}`] || d.cache[`${sym}.US`] || d.cache[sym.toLowerCase()];
      const currentPrice = d.num(item.currentPrice || (cached && cached.price) || item.avgPrice);
      const invested = d.num(item.invested || qty * avgPrice);
      const currentValue = qty > 0 && currentPrice > 0 ? qty * currentPrice : d.num(item.currentValue || invested);
      const gain = currentValue - invested;
      const prevClose = item.prevClose ? d.num(item.prevClose) : (cached && cached.prevClose ? d.num(cached.prevClose) : null);
      return {
        symbol: item.symbol || "UNKNOWN", company: item.company || item.symbol || "US Stock", category: item.category || "Stock", totalQty: qty, avgPrice,
        totalInv: invested, currentPrice, prevClose, currentValue, gain, gainPct: invested > 0 ? (gain / invested) * 100 : 0,
        dayChange: prevClose ? qty * (currentPrice - prevClose) : (item.dayPnl !== undefined && item.dayPnl !== 0 ? d.num(item.dayPnl) : null),
        dayChangePct: prevClose && currentPrice ? ((currentPrice - prevClose) / prevClose) * 100 : null,
        demat: item.demat || "INDmoney", id: item.id,
      };
    });
  }

  /**
   * The totals above a panel, over the holdings still held (quantity above zero): invested, current value, how many, the overall
   * gain and its percentage, and the one-day change (only for holdings that have one) with its percentage of yesterday's value.
   */
  function summary(holdings) {
    let invested = 0, current = 0, count = 0, oneDayChange = 0, hasOneDay = false;
    for (const h of holdings) {
      if (!(h.totalQty > 0)) continue;
      invested += h.totalInv; current += h.currentValue; count++;
      if (h.dayChange !== null) { oneDayChange += h.dayChange; hasOneDay = true; }
    }
    const gain = current - invested;
    return {
      invested, current, count, gain, gainPct: invested > 0 ? (gain / invested) * 100 : 0, oneDayChange, hasOneDay,
      oneDayPct: hasOneDay && current - oneDayChange > 0 ? (oneDayChange / (current - oneDayChange)) * 100 : 0,
    };
  }

  return { panelRows, indianHoldings, usHoldings, summary };
});
