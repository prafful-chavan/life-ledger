/**
 * Life Ledger — net worth "official close" reconstruction (pure).
 *
 * Definition: the record for calendar date D values every market asset at ITS OWN official close for D,
 * using the quantity held on D:
 *   Indian stocks/ETFs  close of D (3:30 pm IST)        → complete by D+1 06:00 IST
 *   US stocks/ETFs      close of D in New York          → complete by D+1 04:00 IST (US closes ~1:30–2:30 am IST)
 *   Mutual funds        NAV dated D                     → published that night / next morning
 *   Gold                evening rate of D               → taken from the backend ledger
 * If a market was shut on D (weekend/holiday) the last close before D is used, as the exchange itself does.
 * A record is "final" only when every held class has its real D close; until then it says what it is waiting for.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerNetWorthClose = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const DAY = 86400000;
  const IST_MS = 330 * 60000;

  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const r2 = (v) => Math.round(v * 100) / 100;
  const dayAfter = (iso) => new Date(Date.parse(iso + "T00:00:00Z") + DAY).toISOString().slice(0, 10);
  const dow = (iso) => new Date(iso + "T00:00:00Z").getUTCDay();
  const isBusinessDay = (iso) => dow(iso) !== 0 && dow(iso) !== 6;
  function prevBusinessDay(iso) {
    let d = iso;
    do { d = new Date(Date.parse(d + "T00:00:00Z") - DAY).toISOString().slice(0, 10); } while (!isBusinessDay(d));
    return d;
  }
  /** Epoch ms of `hh:mm` IST on the given IST calendar date. */
  const istMs = (iso, hh, mm = 0) => Date.parse(iso + "T00:00:00Z") + (hh * 60 + mm) * 60000 - IST_MS;

  /** Last close on or before dateISO: { value, date, prevValue } or null. */
  function closeOnOrBefore(series, dateISO) {
    if (!series || !series.dates || !series.dates.length) return null;
    const d = series.dates;
    let lo = 0, hi = d.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (d[mid] <= dateISO) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (ans < 0) return null;
    return { value: series.closes[ans], date: d[ans], prevValue: ans > 0 ? series.closes[ans - 1] : null };
  }

  /** Has the market data for this class on date D had time to be published? */
  function classComplete(cls, dateISO, nowMs, seriesList) {
    if (cls === "stocks") return nowMs >= istMs(dayAfter(dateISO), 6, 0);
    if (cls === "usStocks") return nowMs >= istMs(dayAfter(dateISO), 4, 0);
    if (cls === "mutualFunds") {
      const needed = isBusinessDay(dateISO) ? dateISO : prevBusinessDay(dateISO);
      return seriesList.length > 0 && seriesList.every((s) => s && s.dates && s.dates.length && s.dates[s.dates.length - 1] >= needed);
    }
    return false;
  }

  /**
   * held: { mutualFunds: [{key, qty, series}], stocks: [...], usStocks: [...] }
   * fx:   USD→INR series (INR=X) or a plain number
   * Returns per-class value, day change, whether it is final, and the date of the close actually used.
   */
  function rebuildMarketClasses({ date, nowMs, held, fx }) {
    const out = { values: {}, changes: {}, settled: {}, asOf: {}, missing: {} };
    const fxClose = typeof fx === "number" ? { value: fx, date } : closeOnOrBefore(fx, date);
    const fxPrev = typeof fx === "number" ? fx : fxClose && fxClose.prevValue;

    ["mutualFunds", "stocks", "usStocks"].forEach((cls) => {
      const list = (held && held[cls]) || [];
      let value = 0, change = 0, usedDate = "";
      const missing = [];
      list.forEach((h) => {
        const c = closeOnOrBefore(h.series, date);
        if (!c || !(c.value > 0)) { missing.push(h.key); return; }
        const mult = cls === "usStocks" ? (fxClose ? fxClose.value : 0) : 1;
        if (!(mult > 0)) { missing.push(h.key); return; }
        value += h.qty * c.value * mult;
        if (c.prevValue > 0) change += h.qty * (c.value - c.prevValue) * mult;
        if (!usedDate || c.date < usedDate) usedDate = c.date; // oldest close used in the class
      });
      out.values[cls] = r2(value);
      out.changes[cls] = r2(change);
      out.asOf[cls] = usedDate || "";
      out.missing[cls] = missing;
      if (!list.length) out.settled[cls] = true;
      else out.settled[cls] = missing.length === 0 && classComplete(cls, date, nowMs, list.map((h) => h.series));
    });
    void fxPrev;
    return out;
  }

  return { rebuildMarketClasses, closeOnOrBefore, classComplete, isBusinessDay, prevBusinessDay, istMs, dayAfter };
});
