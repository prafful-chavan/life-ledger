/**
 * Life Ledger — the daily net worth record (pure; no DOM, no network).
 *
 * The rules behind "today's record": when each market has finished its trading day, when a value is locked at its close,
 * when a lock must be thrown away (holdings changed, exchange rate moved), and how the day's record is put together from
 * the live figures. app.js gathers the live figures and saves the result; everything that decides what the record says is
 * here, so it can be tested on its own.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerNetWorthSnapshot = factory();
})(typeof self !== "undefined" ? self : this, function () {
  /* Each asset class finishes its trading "day" at a different time, so today's record updates live and each class is
     LOCKED once a price fetched after its close arrives:
     • Indian stocks : fetched on/after 15:45 IST (any time on weekends)
     • US stocks     : fetched while the US market is fully closed (ET weekend, <04:00 or ≥20:00)
     • Gold          : fetched on/after 18:00 IST (the day's rate is out)
     • Mutual funds  : latest NAV is dated at least the previous business day (1+ day lag is OK)
     Past days are never modified. A class that never settled keeps its last live value. */
  const MARKET_CLASSES = ["mutualFunds", "stocks", "usStocks", "gold"];
  const CLASS_LABELS = { mutualFunds: "MF", stocks: "Stocks", usStocks: "US", gold: "Gold" };
  const STOCKS_SETTLE_MIN_IST = 15 * 60 + 45;
  const GOLD_SETTLE_MIN_IST = 18 * 60;
  const OTHER_CLASSES = ["silver", "crypto", "fd", "epf", "ppf", "bonds", "bankSaving", "others"];

  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

  function zonedClock(ms, timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short",
    }).formatToParts(new Date(ms)).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
    return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute), dow };
  }
  const istClock = (ms) => zonedClock(ms, "Asia/Kolkata");
  const istTodayISO = (ms = Date.now()) => istClock(ms).date;

  function isUsMarketClosedAt(ms) {
    const et = zonedClock(ms, "America/New_York");
    return et.dow === 0 || et.dow === 6 || et.minutes < 4 * 60 || et.minutes >= 20 * 60;
  }

  function prevBusinessDayISO(dateISO) {
    const d = new Date(`${dateISO}T00:00:00Z`);
    do { d.setUTCDate(d.getUTCDate() - 1); } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
    return d.toISOString().slice(0, 10);
  }

  /** True when `fetchedAtMs` is a price fetched on IST day `dateISO` after that class's close. */
  function isClassSettled(cls, fetchedAtMs, dateISO, navISO) {
    if (!fetchedAtMs) return false;
    const f = istClock(fetchedAtMs);
    if (f.date !== dateISO) return false;
    switch (cls) {
      case "stocks": return f.dow === 0 || f.dow === 6 || f.minutes >= STOCKS_SETTLE_MIN_IST;
      case "usStocks": return isUsMarketClosedAt(fetchedAtMs);
      case "gold": return f.minutes >= GOLD_SETTLE_MIN_IST;
      case "mutualFunds": return !!navISO && navISO >= prevBusinessDayISO(dateISO);
      default: return false;
    }
  }

  /** A cheap fingerprint of what is held per market class. When it changes (rows added, removed, edited) a locked close is stale. */
  function holdingsSignature(state) {
    const s = state || {};
    const sum = (list, f) => (list || []).reduce((t, x) => t + f(x), 0);
    return {
      mutualFunds: `${(s.mutualFunds || []).length}:${Math.round(sum(s.mutualFunds, (m) => (/^red/i.test(String(m.transactionType || "")) ? -1 : 1) * num(m.units)))}`,
      stocks: `${(s.stocks || []).length}:${Math.round(sum(s.stocks, (x) => num(x.quantity)))}`,
      usStocks: `${(s.usstocks || []).length}:${Math.round(sum(s.usstocks, (x) => num(x.quantity) * 1000))}`,
    };
  }

  /**
   * Today's record from the live figures (pure: touches nothing).
   * in = {
   *   today, breakdown (value of every class and the liabilities, as computed now),
   *   live: { [class]: { held, hasChange, change, fetchedAt, asOf } } for the four market classes,
   *   existing (the record already saved for today, or null), prevRecord (the latest record before today, or null),
   *   fxNow, sigNow (holdingsSignature now), keepLock(prevSettled, prevAsOf, liveSettled, fetchedAt, opts) → boolean,
   *   id (a new id, used when there is no record yet), nowIso, source, contributed (money put in so far, optional),
   *   contributedAtPrev (money put in by the end of the previous record's day; only for a previous record with no running total)
   * }
   * A class locked at its close earlier today keeps its locked value and move — unless the rows behind it changed, or (US
   * shares) the exchange rate moved by more than 5 paise, or a newer close arrived. Everything else is live.
   */
  function assembleSnapshot(i) {
    const { today, live, existing, prevRecord, fxNow, sigNow, keepLock } = i;
    const breakdown = { ...i.breakdown };
    const prevSettled = (existing && existing.settled) || {}, prevChanges = (existing && existing.changes) || {}, prevAsOf = (existing && existing.asOf) || {};
    const settled = {}, changes = {}, asOf = {};
    let usKeptLocked = false;

    MARKET_CLASSES.forEach((cls) => {
      const l = live[cls] || { held: false };
      const liveSettled = !l.held || isClassSettled(cls, l.fetchedAt, today, l.asOf);
      // US shares are valued with the exchange rate of the moment they were locked
      const fxChanged = cls === "usStocks" && l.held && existing && prevSettled[cls] && (!existing.fxRate || Math.abs(existing.fxRate - fxNow) > 0.05);
      // The rows behind a class changed after it was locked (an import, a deletion, a correction): the locked value is stale.
      // Snapshots saved before fingerprints existed fall back to "the locked value is far from what the holdings are worth now".
      const lockedValue = existing ? num(existing[cls]) : 0, liveValue = num(breakdown[cls]);
      const holdingsChanged = Boolean(existing && prevSettled[cls] && (
        existing.holdSig && existing.holdSig[cls] !== undefined
          ? existing.holdSig[cls] !== sigNow[cls]
          : lockedValue > 0 && liveValue > 0 && Math.abs(lockedValue / liveValue - 1) > 0.25));
      const keep = keepLock
        ? keepLock(prevSettled[cls], prevAsOf[cls], l.held && liveSettled, l.fetchedAt, { heldNow: l.held, lockedValue: existing ? existing[cls] : 0, fxChanged, holdingsChanged })
        : Boolean(prevSettled[cls]);
      if (keep) {
        breakdown[cls] = num(existing[cls]);
        changes[cls] = num(prevChanges[cls]);
        asOf[cls] = prevAsOf[cls] || "";
        settled[cls] = true;
        if (cls === "usStocks") usKeptLocked = true;
        return;
      }
      changes[cls] = l.held && l.hasChange ? Number(num(l.change).toFixed(2)) : 0;
      settled[cls] = liveSettled;
      asOf[cls] = l.fetchedAt ? new Date(l.fetchedAt).toISOString() : "";
    });

    // A session already counted in the previous day's record (no new NAV or close since: same value, same move) is not
    // today's market move. Mutual funds before the evening NAV and weekends are the usual cases.
    if (prevRecord) MARKET_CLASSES.forEach((cls) => {
      const c = num(changes[cls]), pc = num(prevRecord.changes && prevRecord.changes[cls]);
      const v = num(breakdown[cls]), pv = num(prevRecord[cls]);
      if (c && pv > 0 && Math.abs(v / pv - 1) < 0.0005 && Math.abs(c - pc) <= Math.max(50, Math.abs(pc) * 0.01)) changes[cls] = 0;
    });

    // Totals recomputed so locked classes and live classes add up consistently
    const otherAssets = OTHER_CLASSES.reduce((t, k) => t + num(breakdown[k]), 0);
    breakdown.totalAssets = Number((MARKET_CLASSES.reduce((t, k) => t + num(breakdown[k]), 0) + otherAssets).toFixed(2));
    breakdown.netWorth = Number((breakdown.totalAssets - num(breakdown.liabilities)).toFixed(2));

    const dayChange = Number(MARKET_CLASSES.reduce((t, cls) => t + changes[cls], 0).toFixed(2));
    const marketValue = MARKET_CLASSES.reduce((t, cls) => t + num(breakdown[cls]), 0);
    const prevMarketValue = marketValue - dayChange;
    const dayChangePct = prevMarketValue > 0 ? Number(((dayChange / prevMarketValue) * 100).toFixed(2)) : 0;

    return {
      id: existing ? existing.id : i.id,
      date: today,
      timestamp: i.nowIso,
      netWorth: breakdown.netWorth,
      totalAssets: breakdown.totalAssets,
      totalLiabilities: breakdown.liabilities,
      dayChange,
      dayChangePct,
      changes,
      settled,
      asOf,
      final: MARKET_CLASSES.every((cls) => settled[cls]),
      mutualFunds: breakdown.mutualFunds, stocks: breakdown.stocks, usStocks: breakdown.usStocks, gold: breakdown.gold,
      silver: breakdown.silver, crypto: breakdown.crypto, fd: breakdown.fd, epf: breakdown.epf, ppf: breakdown.ppf, bonds: breakdown.bonds,
      bankSaving: breakdown.bankSaving, others: breakdown.others, liabilities: breakdown.liabilities,
      // The rate the US value was computed with: while it stays locked, the rate of the lock (so a later move is noticed)
      fxRate: usKeptLocked && num(existing && existing.fxRate) > 0 ? num(existing.fxRate) : fxNow,
      holdSig: sigNow,
      ...(i.contributed ? { contributed: i.contributed } : {}),
      ...(i.contributedAtPrev ? { contributedAtPrev: i.contributedAtPrev } : {}),
      source: i.source || "daily",
    };
  }

  return {
    MARKET_CLASSES, CLASS_LABELS, STOCKS_SETTLE_MIN_IST, GOLD_SETTLE_MIN_IST,
    zonedClock, istClock, istTodayISO, isUsMarketClosedAt, prevBusinessDayISO, isClassSettled, holdingsSignature, assembleSnapshot,
  };
});
