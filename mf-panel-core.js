/**
 * Life Ledger — Mutual funds panel logic (pure; no DOM, no network).
 *
 * What the Mutual funds panel works out before it draws anything: which transactions it shows, the portfolio's invested amount,
 * current value, gain, XIRR and one-day change, this month's SIP budget against the monthly target, one line per fund, and the
 * "invest signal" next to each fund. app.js only draws what this returns.
 *
 * The helpers that live in app.js (average-cost basis, XIRR, what counts as a redemption, number reading) are passed in as `d`
 * rather than copied, so there is still one definition of each.
 *   d = { costBasis(txns) → { invested, netUnits, avgCost }, isRedemption(txn), num(v), xirr(flows), now (ms) }
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerMfPanel = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const dateOfTxn = (t) => t.purchaseDate || t.date;

  /** The transactions the panel shows for one owner, newest first. matchOwner(owner, filter) → boolean. */
  function panelRows(all, owner, matchOwner) {
    return (all || []).filter((item) => matchOwner(item.owner, owner))
      .sort((a, b) => new Date(b.purchaseDate || b.date || "1970-01-01") - new Date(a.purchaseDate || a.date || "1970-01-01"));
  }

  /**
   * The portfolio across the given transactions. Average-cost method (like Groww): a redemption's `invested` is its proceeds, not
   * its cost, so cost comes from d.costBasis. Redemptions are inflows in the XIRR.
   * Returns { invested, current, gain, roi (%), xirr (%), oneDayChange, oneDayHasPrev, oneDayPct }.
   */
  function portfolio(rows, d) {
    const groups = {}, byFund = {};
    for (const t of rows) {
      const key = t.fundName || "Unknown";
      (groups[key] = groups[key] || []).push(t);
      if (!byFund[key]) byFund[key] = { units: 0, latestNav: t.latestNav || t.nav || 0 };
      if (t.latestNav) byFund[key].latestNav = d.num(t.latestNav);
    }
    let invested = 0;
    for (const [key, txns] of Object.entries(groups)) {
      const basis = d.costBasis(txns);
      invested += basis.invested;
      byFund[key].units = basis.netUnits;
    }
    const current = Object.values(byFund).reduce((total, f) => total + f.units * f.latestNav, 0);
    const gain = current - invested;
    const roi = invested ? (gain / invested) * 100 : 0;

    const flows = rows.map((t) => ({ date: new Date(dateOfTxn(t) || d.now), amount: d.isRedemption(t) ? +d.num(t.invested) : -d.num(t.invested) }));
    if (current > 0) flows.push({ date: new Date(d.now), amount: current });

    // 1-day change: for each fund with a previous NAV, units × (latest − previous)
    let oneDayChange = 0, oneDayHasPrev = false;
    const prev = {};
    for (const t of rows) {
      const key = t.fundName || "Unknown";
      if (!prev[key]) prev[key] = { txns: [], latestNav: t.latestNav || t.nav || 0, prevNav: t.prevNav || null };
      prev[key].txns.push(t);
      if (t.latestNav) prev[key].latestNav = d.num(t.latestNav);
      if (t.prevNav) { prev[key].prevNav = d.num(t.prevNav); oneDayHasPrev = true; }
    }
    for (const f of Object.values(prev)) {
      if (f.prevNav) oneDayChange += d.costBasis(f.txns).netUnits * (f.latestNav - f.prevNav);
    }
    return {
      invested, current, gain, roi, xirr: d.xirr(flows),
      oneDayChange, oneDayHasPrev, oneDayPct: oneDayHasPrev && current > 0 ? (oneDayChange / (current - oneDayChange)) * 100 : 0,
    };
  }

  /**
   * This month's SIP budget. `all` is every transaction (not just the owner's); only purchases made this month count.
   * targets = { me, wife } (₹ a month, 100000 each when not set). owner = "Both" | "Me" | "Wife".
   * d adds matchOwner(owner, filter). Behind pace = more than 15 percentage points behind the share of the month gone.
   */
  function sipBudget(all, owner, targets, d) {
    const now = new Date(d.now), month = now.getMonth(), year = now.getFullYear();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const thisMonth = (all || []).filter((t) => {
      if (d.isRedemption(t)) return false;
      const when = new Date(dateOfTxn(t));
      return when.getMonth() === month && when.getFullYear() === year;
    });
    const total = (list) => list.reduce((s, t) => s + d.num(t.invested), 0);
    const me = d.num((targets && targets.me) || 100000), wife = d.num((targets && targets.wife) || 100000);
    let invested, target;
    if (owner === "Both") { invested = total(thisMonth); target = me + wife; }
    else if (owner === "Wife") { invested = total(thisMonth.filter((t) => (t.owner || "Me") === "Wife")); target = wife; }
    else { invested = total(thisMonth.filter((t) => d.matchOwner(t.owner, "Me"))); target = me; }
    const pct = target > 0 ? Math.min(100, (invested / target) * 100) : 0;
    const dayPct = (now.getDate() / daysInMonth) * 100;
    return {
      invested, target, remaining: Math.max(0, target - invested), pct, dayPct, isBehind: pct < dayPct - 15,
      daysRemaining: daysInMonth - now.getDate(), targetKey: owner === "Wife" ? "wife" : "me",
    };
  }

  /**
   * One line per fund. d adds history(fundName) → the fund's NAV history [{ nav }] or null, and navVs30d(history) → % or null.
   * The latest and previous NAV come from the fund's newest transaction (rows are newest first).
   * XIRR is per fund; the 30-day lowest NAV and "NAV vs its 30-day average" come from the history when there is one.
   */
  function holdings(rows, d) {
    const groups = {};
    for (const item of rows) (groups[item.fundName] = groups[item.fundName] || []).push(item);
    return Object.entries(groups).map(([fundName, txns]) => {
      const basis = d.costBasis(txns);
      const totalUnits = basis.netUnits, totalInvested = basis.invested;
      const latestNav = txns[0].latestNav || txns[0].nav;
      const prevNav = txns[0].prevNav || null;
      const currentValue = totalUnits * latestNav;
      const gain = currentValue - totalInvested;
      const flows = txns.map((t) => ({ date: new Date(dateOfTxn(t) || d.now), amount: d.isRedemption(t) ? +d.num(t.invested) : -d.num(t.invested) }));
      if (totalUnits > 0) flows.push({ date: new Date(d.now), amount: currentValue });
      let navVs30d = null, lowestNav30d = null;
      const data = d.history ? d.history(fundName) : null;
      if (data && data.length > 0) {
        lowestNav30d = Math.min(...data.slice(-30).map((x) => x.nav));
        if (data.length >= 30) navVs30d = d.navVs30d(data);
      }
      return {
        fundName, totalUnits, avgNav: basis.avgCost, totalInvested, latestNav, prevNav, currentValue, gain,
        roi: totalInvested ? (gain / totalInvested) * 100 : 0, xirr: d.xirr(flows),
        dayChange: prevNav ? totalUnits * (latestNav - prevNav) : null,
        dayChangePct: prevNav && latestNav ? ((latestNav - prevNav) / prevNav) * 100 : null,
        navVs30d, lowestNav30d,
      };
    });
  }

  /**
   * The "invest signal" for a fund: where its latest NAV sits against its 30-day lowest.
   * "low" at or under the lowest, "near" within 1.5% above it, "fair" within 4%, "high" beyond; null when the lowest (or the NAV) is null.
   */
  function investSignal(latestNav, lowestNav30d) {
    if (latestNav === null || lowestNav30d === null) return null;
    if (latestNav <= lowestNav30d) return "low";
    const diffPct = ((latestNav - lowestNav30d) / lowestNav30d) * 100;
    return diffPct <= 1.5 ? "near" : diffPct <= 4 ? "fair" : "high";
  }

  return { panelRows, portfolio, sipBudget, holdings, investSignal };
});
