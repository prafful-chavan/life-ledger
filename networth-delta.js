/**
 * Life Ledger — day-over-day net worth change (pure).
 *
 * Each snapshot is compared with the previous snapshot: "net worth on 12 Oct minus
 * net worth on 11 Oct", broken down by what moved. This is independent of the stored
 * market-move figure (qty × price change), which stays available as a separate number.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerNetWorth = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const n = (v) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  const r2 = (v) => Math.round(v * 100) / 100;

  function cashOthers(e) {
    return n(e.fd) + n(e.epf) + n(e.ppf) + n(e.bonds) + n(e.bankSaving) + n(e.others) + n(e.silver) + n(e.crypto);
  }

  function netWorthOf(e) {
    return e.netWorth != null ? n(e.netWorth) : n(e.totalAssets) - n(e.totalLiabilities);
  }

  function daysBetween(a, b) {
    return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
  }

  /**
   * Returns a Map keyed by snapshot id (or date) → { change, pct, prevDate, gapDays, parts }.
   * The oldest snapshot has no entry (nothing to compare with).
   */
  function computeDeltas(history) {
    const sorted = (history || []).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const out = new Map();
    for (let i = 1; i < sorted.length; i++) {
      const cur = sorted[i];
      const prev = sorted[i - 1];
      const prevNw = netWorthOf(prev);
      const change = r2(netWorthOf(cur) - prevNw);
      out.set(cur.id || cur.date, {
        change,
        pct: prevNw ? r2((change / Math.abs(prevNw)) * 100) : 0,
        prevDate: prev.date,
        gapDays: daysBetween(prev.date, cur.date),
        parts: {
          mutualFunds: r2(n(cur.mutualFunds) - n(prev.mutualFunds)),
          stocks: r2(n(cur.stocks) - n(prev.stocks)),
          usStocks: r2(n(cur.usStocks) - n(prev.usStocks)),
          gold: r2(n(cur.gold) - n(prev.gold)),
          cashOthers: r2(cashOthers(cur) - cashOthers(prev)),
          // liabilities going up lowers net worth
          liabilities: r2(-(n(cur.totalLiabilities) - n(prev.totalLiabilities))),
        },
      });
    }
    return out;
  }

  return { computeDeltas, cashOthers, netWorthOf };
});
