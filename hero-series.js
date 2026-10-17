/**
 * Life Ledger — net worth trend for the dashboard hero card (pure; no DOM).
 * buildSeries() turns the daily net worth history (+ today's live value) into the points of one chart range;
 * summarize() gives the change over that range.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerHeroSeries = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RANGES = { "1W": 7, "1M": 30, "3M": 90, "1Y": 365, All: null };
  const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));

  function addDays(iso, n) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  }

  /**
   * history: [{date, netWorth}] in any order; live: today's live net worth (or null); today: ISO date;
   * range: "1W" | "1M" | "3M" | "1Y" | "All". Returns [{date, value}] oldest first, one point per day.
   */
  function buildSeries(history, live, today, range) {
    const byDay = new Map();
    for (const h of history || []) {
      if (!h || !isDay(h.date)) continue;
      const v = Number(h.netWorth);
      if (!Number.isFinite(v)) continue;
      byDay.set(h.date, { date: h.date, value: v });
    }
    if (Number.isFinite(live) && isDay(today)) byDay.set(today, { date: today, value: live });   // today is always the live figure
    let pts = [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const days = RANGES[range];
    if (days && isDay(today)) {
      const cutoff = addDays(today, -days);
      pts = pts.filter((p) => p.date >= cutoff);
    }
    return pts;
  }

  /** Change from the first to the last point of the range. */
  function summarize(points) {
    if (!points || points.length < 2) return null;
    const first = points[0];
    const last = points[points.length - 1];
    const change = last.value - first.value;
    const pct = first.value ? (change / Math.abs(first.value)) * 100 : null;
    return { from: first.date, to: last.date, change, pct, first: first.value, last: last.value };
  }

  return { buildSeries, summarize, addDays, RANGES: Object.keys(RANGES) };
});
