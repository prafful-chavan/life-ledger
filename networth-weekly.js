/**
 * Life Ledger — weekly view of net worth: how much of each week's change is the market, how much is money you put in, and how
 * much is your own edits (pure; no DOM, no network).
 *
 * weeks(history, { count }) → one entry per calendar week (Monday to Sunday), newest first, built from the daily records.
 * The three parts always add up to the week's change: market = change − new money − your edits.
 *
 * New money is known only when both ends of the week carry the running total of money put in (records saved from 24 Oct 2026
 * on). For earlier weeks it is left out rather than guessed: the daily price moves recorded for a week are not precise enough to
 * tell a ₹20,000 purchase from price noise (a test on real data read ₹43,000 of "money taken out" in a week with no sale).
 * Those weeks still show the net worth change and your own edits, and "market + money in" together.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerNetWorthWeekly = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const DAY = 86400000;
  const INVESTED = ["mutualFunds", "stocks", "usStocks"];
  const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const r2 = (v) => Math.round(v * 100) / 100;
  const cashOthers = (e) => n(e.fd) + n(e.epf) + n(e.ppf) + n(e.bonds) + n(e.bankSaving) + n(e.others) + n(e.silver) + n(e.crypto);
  const netWorthOf = (e) => (e.netWorth != null ? n(e.netWorth) : n(e.totalAssets) - n(e.totalLiabilities));

  /** The Monday of the week a date falls in, as YYYY-MM-DD. */
  function mondayOf(iso) {
    const t = Date.parse(iso + "T00:00:00Z"), dow = new Date(t).getUTCDay();
    return new Date(t - ((dow + 6) % 7) * DAY).toISOString().slice(0, 10);
  }

  function weeks(history, opts = {}) {
    const byDate = new Map();
    for (const h of history || []) if (h && /^\d{4}-\d{2}-\d{2}$/.test(h.date)) byDate.set(h.date, h);   // one record per day; the last one given wins
    const sorted = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
    const groups = new Map();
    for (const h of sorted) { const k = mondayOf(h.date); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(h); }

    const out = [];
    for (const [monday, recs] of groups) {
      const end = recs[recs.length - 1];
      const before = sorted.filter((h) => h.date < monday);
      const start = before.length ? before[before.length - 1] : recs[0];       // the first week of the history starts at its own first record
      if (start === end) continue;                                              // a single record: nothing to compare
      const inWeek = sorted.filter((h) => h.date > start.date && h.date <= end.date);

      const known = Boolean(start.contributed && end.contributed);
      const fx = n(end.fxRate) || n(start.fxRate);
      const change = netWorthOf(end) - netWorthOf(start);
      const edits = (cashOthers(end) - cashOthers(start)) - (n(end.totalLiabilities) - n(start.totalLiabilities));
      const week = { weekStart: monday, from: start.date, to: end.date, days: inWeek.length, netWorth: r2(netWorthOf(end)), change: r2(change), edits: r2(edits), split: known, marketAndMoney: r2(change - edits), market: null, newMoney: null, newMoneyByClass: null };
      if (known) {
        const byClass = {
          mutualFunds: n(end.contributed.mutualFunds) - n(start.contributed.mutualFunds),
          stocks: n(end.contributed.stocks) - n(start.contributed.stocks),
          usStocks: fx ? (n(end.contributed.usStocksUsd) - n(start.contributed.usStocksUsd)) * fx : 0,
        };
        const newMoney = INVESTED.reduce((t, k) => t + byClass[k], 0);
        for (const k of INVESTED) byClass[k] = r2(byClass[k]);
        Object.assign(week, { newMoney: r2(newMoney), market: r2(change - newMoney - edits), newMoneyByClass: byClass });
      }
      out.push(week);
    }
    return out.sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1)).slice(0, opts.count || 8);
  }

  return { weeks, mondayOf };
});
