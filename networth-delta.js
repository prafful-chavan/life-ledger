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

  // A fund or share sale, however the row spells it (the importer once wrote "REDEEM")
  const SALE = /REDEEM|REDEMPT|SELL|SOLD|WITHDRAW|SWITCH OUT|PAYOUT|^[RS]$/i;
  const dateOf = (r) => String((r && (r.purchaseDate || r.date)) || "").slice(0, 10);
  const flow = (rows, units, asOf) => (rows || []).reduce((t, r) => {
    if (asOf && dateOf(r) && dateOf(r) > asOf) return t;           // bought after that day: not yet put in
    const sale = SALE.test(String((r && (r.transactionType || r.type)) || "").trim());
    const amount = n(r && r.invested) || n(r && r[units]) * n(r && (r.nav || r.avgPrice));
    return t + (sale ? -1 : 1) * amount;
  }, 0);

  /**
   * Money put into each investment class so far (or, with asOf "YYYY-MM-DD", up to the end of that day): purchases minus sale
   * proceeds (US shares in dollars). Stored with every snapshot, so the change between two snapshots separates money you added
   * from what the market did.
   */
  function contributions(state, asOf) {
    const s = state || {};
    const out = { mutualFunds: r2(flow(s.mutualFunds, "units", asOf)), usStocksUsd: r2(flow(s.usstocks, "quantity", asOf)) };
    // Indian share rows carry the day they were imported, not the day they were bought, so a cut-off by date means nothing for them
    if (!asOf) out.stocks = r2(flow(s.stocks, "quantity"));
    return { mutualFunds: out.mutualFunds, stocks: out.stocks, usStocksUsd: out.usStocksUsd };
  }

  const INVESTED = ["mutualFunds", "stocks", "usStocks"];

  /**
   * Money added (+) or taken out (−) per class between two snapshots. Exact when both carry `contributed`; for an older
   * snapshot without it, estimated as the value change the day's price move does not explain (shown as an estimate).
   */
  function newMoneyBetween(prev, cur, parts) {
    // The earlier record has no running total (saved before it existed): the later one may carry what had been put in by
    // the earlier record's date, worked out from the purchase dates; good, but not exact, so it is still called "about"
    const cc = cur && cur.contributed;
    const exact = Boolean(prev && prev.contributed && cc);
    const pc = (prev && prev.contributed) || (cur && cur.contributedAtPrev);
    const fx = n(cur && cur.fxRate) || n(prev && prev.fxRate);
    const out = {};
    // per class: the difference of the running totals when both are known; otherwise the value change the day's price move
    // does not explain (an estimate, ignored below ₹1,000 or 0.3% of the class: that is price timing, not money)
    const known = {
      mutualFunds: cc && pc && pc.mutualFunds !== undefined ? n(cc.mutualFunds) - n(pc.mutualFunds) : null,
      stocks: cc && pc && pc.stocks !== undefined ? n(cc.stocks) - n(pc.stocks) : null,
      usStocks: cc && pc && pc.usStocksUsd !== undefined ? (fx ? (n(cc.usStocksUsd) - n(pc.usStocksUsd)) * fx : 0) : null,
    };
    let all = true;
    for (const k of INVESTED) {
      if (known[k] !== null) { out[k] = known[k]; continue; }
      all = false;
      const est = n(parts[k]) - n(cur && cur.changes && cur.changes[k]);
      out[k] = Math.abs(est) >= Math.max(1000, Math.abs(n(cur && cur[k])) * 0.003) ? est : 0;
    }
    return { byClass: out, exact: exact && all };
  }

  /** Change from snapshot `prev` to snapshot `cur`, with what moved. */
  function compare(prev, cur) {
    const prevNw = netWorthOf(prev);
    const change = r2(netWorthOf(cur) - prevNw);
    const parts = {
      mutualFunds: r2(n(cur.mutualFunds) - n(prev.mutualFunds)),
      stocks: r2(n(cur.stocks) - n(prev.stocks)),
      usStocks: r2(n(cur.usStocks) - n(prev.usStocks)),
      gold: r2(n(cur.gold) - n(prev.gold)),
      cashOthers: r2(cashOthers(cur) - cashOthers(prev)),
      // liabilities going up lowers net worth
      liabilities: r2(-(n(cur.totalLiabilities) - n(prev.totalLiabilities))),
    };
    // change = market + new money + your edits, exactly (market is what is left once the other two are known)
    const nm = newMoneyBetween(prev, cur, parts);
    const newMoneyByClass = {};
    for (const k of INVESTED) newMoneyByClass[k] = r2(nm.byClass[k]);
    const newMoney = r2(INVESTED.reduce((t, k) => t + newMoneyByClass[k], 0));
    const edits = r2(parts.cashOthers + parts.liabilities);
    const split = { market: r2(change - newMoney - edits), newMoney, edits, newMoneyByClass, exact: nm.exact };
    return {
      split,
      change,
      pct: prevNw ? r2((change / Math.abs(prevNw)) * 100) : 0,
      prevDate: prev.date,
      gapDays: daysBetween(prev.date, cur.date),
      parts,
    };
  }

  /**
   * Returns a Map keyed by snapshot id (or date) → compare(previous, snapshot).
   * The oldest snapshot has no entry (nothing to compare with).
   */
  function computeDeltas(history) {
    const sorted = (history || []).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const out = new Map();
    for (let i = 1; i < sorted.length; i++) out.set(sorted[i].id || sorted[i].date, compare(sorted[i - 1], sorted[i]));
    return out;
  }

  return { compare, computeDeltas, cashOthers, netWorthOf, contributions };
});
