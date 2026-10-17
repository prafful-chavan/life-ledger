/**
 * Life Ledger — portfolio advisor engine (pure: no DOM, no network, no AI).
 *
 * Turns holdings, price history, cash flow, debts, goals and a personal profile into metrics and
 * graded signals (each with its evidence). The AI layer only explains and prioritises these; it
 * never computes numbers itself.
 *
 * Educational analytics for personal use — not investment advice.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerAdvisor = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const DAY = 86400000;

  const DEFAULT_PROFILE = {
    risk: "moderate-aggressive",
    horizonYears: 15,
    // % of the investable portfolio (must total 100)
    target: { equity: 65, gold: 10, debt: 20, cash: 5 },
    monthlyInvestable: 0,
    sipTarget: 0,
    emergencyMonths: 6,
  };

  const CFG = {
    driftPP: 7,                 // allocation drift that triggers a rebalance signal (percentage points)
    concentrationWatch: 10,     // single stock % of portfolio
    concentrationAct: 15,
    dustPct: 0.5,               // positions below this % of the portfolio are "dust"
    dustCount: 5,
    emergencyWatchFrac: 1,      // < target months = watch
    emergencyActMonths: 3,
    debtActRate: 10.5,          // % p.a. — above typical post-tax equity expectations
    debtWatchRate: 8.5,
    lowSavingsRate: 20,
    highSavingsRate: 40,
    idleCashPct: 12,
    stockActDrawdown: -30,
    stockActRelative: -10,      // pp vs Nifty over 1y, together with the deep drawdown
    stockWatchDrawdown: -15,
    stockWatchRelative: -3,     // a fall that merely matches a falling market is not stock-specific
    indexBuyDrawdown: -10,
    underperformWatch: -5,      // pp vs benchmark over 1y
    underperformAct: -10,
    extendedAboveMa200: 35,     // % above the 200-day average
    goldDrop: -7,
    minHistoryDays: 120,
  };

  const iso = (d) => new Date(d).toISOString().slice(0, 10);
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const r1 = (v) => Math.round(v * 10) / 10;
  const r2 = (v) => Math.round(v * 100) / 100;
  const pct = (a, b) => (b ? (a / b) * 100 : 0);
  const inr = (v) => "₹" + Math.round(num(v)).toLocaleString("en-IN");

  // ── price-series maths ────────────────────────────────────────────────────
  function valueOnOrBefore(series, dateISO) {
    const d = series.dates;
    let lo = 0, hi = d.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (d[mid] <= dateISO) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans >= 0 ? series.closes[ans] : null;
  }

  function returnOver(series, nowISO, days) {
    if (!series || series.closes.length < 2) return null;
    const last = series.closes[series.closes.length - 1];
    const then = valueOnOrBefore(series, iso(new Date(nowISO).getTime() - days * DAY));
    return then && then > 0 ? (last / then - 1) * 100 : null;
  }

  function lastWindow(series, nowISO, days) {
    const from = iso(new Date(nowISO).getTime() - days * DAY);
    const out = [];
    for (let i = 0; i < series.dates.length; i++) if (series.dates[i] >= from) out.push(series.closes[i]);
    return out;
  }

  function sma(series, n) {
    const c = series.closes;
    if (c.length < n) return null;
    let s = 0;
    for (let i = c.length - n; i < c.length; i++) s += c[i];
    return s / n;
  }

  function annualVol(series) {
    const c = series.closes;
    if (c.length < 30) return null;
    const rets = [];
    for (let i = 1; i < c.length; i++) if (c[i - 1] > 0 && c[i] > 0) rets.push(Math.log(c[i] / c[i - 1]));
    const m = rets.reduce((a, b) => a + b, 0) / rets.length;
    const v = rets.reduce((a, b) => a + (b - m) ** 2, 0) / (rets.length - 1);
    return Math.sqrt(v) * Math.sqrt(252) * 100;
  }

  function momentum(series, nowISO) {
    if (!series || series.closes.length < 2) return null;
    const closes = series.closes;
    const last = closes[closes.length - 1];
    const span = (new Date(series.dates[series.dates.length - 1]) - new Date(series.dates[0])) / DAY;
    const win = lastWindow(series, nowISO, 365);
    const high = Math.max(...win);
    const low = Math.min(...win);
    const ma200 = sma(series, Math.min(200, closes.length));
    return {
      days: Math.round(span),
      r1m: returnOver(series, nowISO, 30),
      r3m: returnOver(series, nowISO, 91),
      r6m: returnOver(series, nowISO, 182),
      r1y: returnOver(series, nowISO, 365),
      drawdown: high > 0 ? (last / high - 1) * 100 : null,
      rangePos: high > low ? ((last - low) / (high - low)) * 100 : null,
      vsMa200: ma200 ? (last / ma200 - 1) * 100 : null,
      vol: annualVol(series),
    };
  }

  /** XIRR for dated flows (investments negative, redemptions positive) plus a final value. */
  function xirr(flows, endValue, endISO) {
    const all = flows.map((f) => ({ t: new Date(f.date).getTime(), a: f.amount })).concat({ t: new Date(endISO).getTime(), a: endValue });
    if (all.length < 2 || !all.some((f) => f.a < 0) || !all.some((f) => f.a > 0)) return null;
    const t0 = Math.min(...all.map((f) => f.t));
    const npv = (r) => all.reduce((s, f) => s + f.a / Math.pow(1 + r, (f.t - t0) / (365 * DAY)), 0);
    let lo = -0.99, hi = 10;
    if (npv(lo) * npv(hi) > 0) return null;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid;
    }
    return ((lo + hi) / 2) * 100;
  }

  // ── classification ────────────────────────────────────────────────────────
  function groupOf(h) {
    const name = String(h.name || "").toLowerCase();
    switch (h.cls) {
      case "stock": case "us":
        if (/gold|silver/.test(name)) return "gold";                     // Gold BeES / Silver BeES held as a "stock"
        if (/liquid|overnight|gilt|g-sec|\bbond\b|bharat bond|treasury/.test(name)) return "debt";
        return "equity";
      case "gold": case "silver": return "gold";
      case "fd": case "epf": case "ppf": case "bonds": return "debt";
      case "bank": return "cash";
      case "mf":
        if (/gold/.test(name)) return "gold";
        if (/liquid|overnight|money market|ultra short|low duration|debt|gilt|bond|corporate|banking & psu|treasury/.test(name)) return "debt";
        if (/hybrid|balanced|arbitrage|multi asset|dynamic asset/.test(name)) return "hybrid";
        return "equity";
      default: return "other";
    }
  }

  // Well-known broad ETFs (their ticker, not their name, is usually all the app has)
  const KNOWN_ETF = /^(QQQ|QQQM|SPY|VOO|VTI|VT|IVV|SCHD|VEA|VWO|IWM|DIA|XLK|XLF|XLV|VNQ|SOXX|SMH|BND|AGG|GLD|IAU|SLV|VGT|VYM|VIG|VXUS|ARKK|NIFTYBEES|BANKBEES|GOLDBEES|JUNIORBEES|LIQUIDBEES|SILVERBEES|MON100|MAFANG|N100|MID150BEES|HDFCNIFTY|ICICINIFTY)$/i;

  function kindOf(h) {
    const name = String(h.name || "").toLowerCase();
    if (h.cls === "stock" || h.cls === "us") return /\betf\b|bees|etf/.test(name) || KNOWN_ETF.test(String(h.symbol || "")) ? "etf" : "stock";
    if (h.cls === "mf") return /index|nifty|sensex|\betf\b|next 50|midcap 150|smallcap 250/.test(name) ? "index" : "active";
    return h.cls;
  }

  function benchmarkFor(h) {
    if (h.cls === "us") return "sp500";
    if (h.cls === "gold" || groupOf(h) === "gold") return "gold";
    if (h.cls === "stock" || (h.cls === "mf" && groupOf(h) === "equity")) return "nifty";
    return null;
  }


  // ── plain-language layer ──────────────────────────────────────────────────
  const ACTION_LABEL = { ADD: "Add more", HOLD: "Hold", REVIEW: "Look closely", TRIM: "Reduce", REBALANCE: "Balance", PREPAY: "Pay off faster", BUILD: "Build up" };
  const STATUS_LABEL = { great: "Doing great", good: "Doing well", ok: "Okay", weak: "Falling behind", poor: "Needs attention", safe: "Safe & steady", nodata: "Too new to judge" };
  const STATUS_SCORE = { great: 100, good: 80, ok: 60, weak: 35, poor: 15, safe: 60, nodata: 55 };
  const MOVE_LABEL = { keep_adding: "Keep investing regularly", hold: "Keep holding", watch: "Keep an eye on it", review: "Look at it closely", reduce: "Consider reducing", dont_add: "Don't add more now", none: "Nothing to do" };
  const GROUP_LABEL = { mf: "Mutual funds", stock: "Indian stocks", us: "US stocks", gold: "Gold", safe: "Safe money", other: "Other" };

  function groupKey(h) {
    switch (h.cls) {
      case "mf": return "mf";
      case "stock": return "stock";
      case "us": return "us";
      case "gold": return "gold";
      case "fd": case "epf": case "ppf": case "bonds": case "bank": return "safe";
      default: return "other";
    }
  }

  const signed = (v, d = 1) => (v >= 0 ? "+" : "−") + Math.abs(Math.round(v * 10 ** d) / 10 ** d) + "%";
  const plainPct = (v) => Math.abs(Math.round(v * 10) / 10) + "%";

  /** One honest, plain-English judgement per holding. */
  function verdictFor(h, ctx) {
    const reasons = [];
    const g = groupKey(h);
    const m = h.mom;
    const hasHistory = m && h.historyDays >= CFG.minHistoryDays;
    let status = "nodata";
    let move = "hold";

    if (g === "safe") {
      return { status: "safe", label: STATUS_LABEL.safe, move: "none", moveLabel: MOVE_LABEL.none,
        headline: h.cls === "bank" ? "Cash you can reach quickly." : "Steady, low-risk money.",
        reasons: [h.cls === "bank" ? "Good for emergencies, but it earns little — keep only what you need here." : "Grows slowly and safely. Good for stability, not for beating inflation by a lot."] };
    }
    if (g === "gold" && ctx && ctx.goldBm && ctx.goldBm.days >= CFG.minHistoryDays && !hasHistory) {
      const r = ctx.goldBm.r1y;
      const st2 = r == null ? "nodata" : r >= 10 ? "good" : r >= -10 ? "ok" : "weak";
      return { status: st2, label: STATUS_LABEL[st2], move: "hold", moveLabel: MOVE_LABEL.hold,
        headline: r == null ? "Gold price history is not available yet." : `Gold has moved ${signed(r)} over the last year.`,
        reasons: ["Gold is there to protect your wealth in bad times, not to beat the market every year.",
          h.returnPct != null ? `Versus what you paid: ${h.returnPct >= 0 ? "up" : "down"} ${plainPct(h.returnPct)}.` : null].filter(Boolean) };
    }
    if (g === "other") {
      return { status: "ok", label: STATUS_LABEL.ok, move: "watch", moveLabel: MOVE_LABEL.watch,
        headline: "Not tracked against market prices.", reasons: ["Keep it small compared with your core investments, and update its value now and then."] };
    }

    const bench = h.relative1y;
    const r1y = m && m.r1y;
    if (hasHistory) {
      if (bench != null) {
        if (bench >= 8 && (m.r6m || 0) > 0) status = "great";
        else if (bench >= 2) status = "good";
        else if (bench > -5) status = "ok";
        else if (bench > -10) status = "weak";
        else status = (m.r6m || 0) < 0 ? "poor" : "weak";
        const who = g === "us" ? "the US market (S&P 500)" : g === "gold" ? "gold" : "the Indian market (Nifty 50)";
        if (g === "gold") reasons.push(`Gold moved ${signed(r1y)} in the last year.`);
        else reasons.push(`${signed(r1y)} in the last year, ${bench >= 0 ? "about " + plainPct(bench) + " better than" : "about " + plainPct(bench) + " worse than"} ${who}.`);
      } else if (r1y != null) {
        status = r1y >= 15 ? "good" : r1y >= 5 ? "ok" : r1y >= -10 ? "weak" : "poor";
        reasons.push(`${signed(r1y)} in the last year.`);
      }
      if (m.drawdown != null && m.drawdown <= -20 && h.kind !== "index") {
        reasons.push(`It is ${plainPct(m.drawdown)} below its highest price of the past year.`);
        if (m.drawdown <= CFG.stockActDrawdown && (m.r6m || 0) < 0 && (h.cls === "stock" || h.cls === "us")) status = "poor";
        else if (status === "great" || status === "good") status = "ok";
      }
      if (m.r3m != null && m.r6m != null && Math.abs(m.r3m) >= 1) reasons.push(`Last 3 months ${signed(m.r3m)}, last 6 months ${signed(m.r6m)}.`);
    } else if (h.ageDays != null && h.ageDays < 180) {
      reasons.push("You started investing in this only recently, so it is too early to judge it.");
    } else if (h.xirr != null) {
      status = h.xirr >= 12 ? "good" : h.xirr >= 8 ? "ok" : "weak";
      reasons.push(`Your money in it has grown about ${plainPct(h.xirr)} a year since you started.`);
      reasons.push("Price history for this one is not available yet, so it could not be compared with the market.");
    } else if (h.returnPct != null) {
      reasons.push(`Up ${plainPct(h.returnPct)} versus what you paid.`.replace("Up", h.returnPct >= 0 ? "Up" : "Down"));
      reasons.push("Price history is not available yet, so I can't compare it with the market.");
    }

    if (h.returnPct != null && hasHistory) reasons.push(`Compared with what you paid: ${h.returnPct >= 0 ? "up " : "down "}${plainPct(h.returnPct)}.`);
    if (h.weight >= 10) reasons.push(`It makes up ${Math.round(h.weight)}% of your investments.`);
    if (h.kind === "index" && (status === "ok" || status === "good")) reasons.unshift("A market-wide fund: it is meant to move with the market, and it is.");

    // what to do about it
    if (status === "poor") move = "review";
    else if (status === "weak") move = "watch";
    else if ((status === "good" || status === "great") && h.kind === "index") move = "keep_adding";
    else move = "hold";
    if ((h.cls === "stock" || h.cls === "us") && h.weight >= CFG.concentrationAct) move = "dont_add";
    if (h.kind === "stock" && m && m.vsMa200 != null && m.vsMa200 >= CFG.extendedAboveMa200 && h.weight >= 8) move = "dont_add";
    if (status === "nodata") move = "hold";

    const heads = {
      great: "Beating the market comfortably.", good: "Doing better than the market.", ok: "Moving about in line with the market.",
      weak: "Lagging behind the market.", poor: "Doing badly — worth a close look.", nodata: "Not enough price history to judge yet.",
    };
    return { status, label: STATUS_LABEL[status], move, moveLabel: MOVE_LABEL[move], headline: heads[status], reasons: reasons.slice(0, 4) };
  }

  function groupSummaries(items, total) {
    const order = ["mf", "stock", "us", "gold", "safe", "other"];
    return order.map((k) => {
      const list = items.filter((h) => groupKey(h) === k);
      if (!list.length) return null;
      const value = list.reduce((s, h) => s + num(h.value), 0);
      const invested = list.reduce((s, h) => s + num(h.invested), 0);
      // better verdict first; within the same verdict, the stronger 1-year / growth figure first
      const rank = (h) => STATUS_SCORE[h.verdict.status] * 1000 + (h.relative1y != null ? h.relative1y : h.mom && h.mom.r1y != null ? h.mom.r1y : h.xirr != null ? h.xirr : h.returnPct != null ? h.returnPct : 0);
      const judged = list.filter((h) => !["safe", "nodata"].includes(h.verdict.status));
      const sorted = judged.slice().sort((a, b) => rank(b) - rank(a));
      const counts = { great: 0, good: 0, ok: 0, weak: 0, poor: 0, nodata: 0, safe: 0 };
      list.forEach((h) => { counts[h.verdict.status]++; });
      return {
        key: k, label: GROUP_LABEL[k], count: list.length, value: r2(value), invested: r2(invested),
        returnPct: invested > 0 && k !== "safe" ? r1((value / invested - 1) * 100) : null,
        weight: r1(pct(value, total)), counts,
        best: sorted.slice(0, 3).map((h) => h.key),
        worst: sorted.slice(-3).reverse().filter((h) => ["weak", "poor"].includes(h.verdict.status)).map((h) => h.key),
        keys: list.slice().sort((a, b) => num(b.value) - num(a.value)).map((h) => h.key),
      };
    }).filter(Boolean);
  }

  function pillarList(ctx) {
    const { items, total, cash, liabilities, emergencyMonths, profile, signals, allocPct, mfThisMonth } = ctx;
    const P = [];
    const lvl = (s) => (s >= 75 ? "good" : s >= 50 ? "ok" : "weak");

    // 1) safety net
    if (emergencyMonths != null) {
      const need = profile.emergencyMonths;
      const sc = Math.max(0, Math.min(100, Math.round((emergencyMonths / need) * 100)));
      P.push({ id: "safety", label: "Safety net", emoji: "🛡️", weight: 25, score: sc, level: lvl(sc),
        line: emergencyMonths >= need ? `Your savings cover about ${r1(emergencyMonths)} months of spending. That is a strong cushion.` : `Your savings cover about ${r1(emergencyMonths)} months of spending. Aim for ${need}.` });
    }
    // 2) debt
    {
      const high = liabilities.filter((l) => num(l.rate) >= CFG.debtActRate);
      const mid = liabilities.filter((l) => num(l.rate) >= CFG.debtWatchRate && num(l.rate) < CFG.debtActRate);
      const emi = liabilities.reduce((s, l) => s + num(l.emi), 0);
      const income = num(cash.monthlyIncome);
      const burden = income > 0 ? (emi / income) * 100 : null;
      let sc = 100;
      const unknownRate = liabilities.filter((l) => !(num(l.rate) > 0));
      if (unknownRate.length) sc = 85;                      // can't call it perfect when a loan's cost is unknown
      sc -= high.length * 35; sc -= mid.length * 12;
      if (burden != null && burden > 30) sc -= Math.min(30, (burden - 30) * 1.5);
      sc = Math.max(0, Math.min(100, Math.round(sc)));
      const bits = [];
      if (!liabilities.length) bits.push("You have no loans on record. Nice.");
      else {
        bits.push(`${liabilities.length} loan${liabilities.length > 1 ? "s" : ""}, EMIs ${inr(emi)} a month${burden != null ? ` (${Math.round(burden)}% of your income)` : ""}.`);
        if (high.length) bits.push(`${high.map((l) => l.name).join(", ")} costs a lot in interest.`);
        if (unknownRate.length) bits.push(`Add the interest rate and EMI for ${unknownRate.map((l) => l.name).join(", ")} so I can judge it.`);
      }
      P.push({ id: "debt", label: "Debt", emoji: "💳", weight: 20, score: sc, level: lvl(sc), line: bits.join(" ") });
    }
    // 3) spread
    {
      const top5 = items.slice().sort((a, b) => b.weight - a.weight).slice(0, 5).reduce((s, h) => s + h.weight, 0);
      const bigStock = items.filter((h) => h.kind === "stock").sort((a, b) => b.weight - a.weight)[0];
      let sc = 100;
      if (items.length > 8 && top5 > 60) sc -= Math.min(35, (top5 - 60) * 1.2);
      if (bigStock && bigStock.weight > CFG.concentrationWatch) sc -= Math.min(25, (bigStock.weight - CFG.concentrationWatch) * 2);
      if (ctx.profileSet) ["equity", "gold", "debt", "cash"].forEach((k) => { const d = Math.abs(allocPct[k] - num(profile.target[k])); if (d > CFG.driftPP) sc -= Math.min(10, (d - CFG.driftPP) * 0.5); });
      sc = Math.max(0, Math.min(100, Math.round(sc)));
      const line = `Your five biggest investments are ${Math.round(top5)}% of your money.` + (bigStock && bigStock.weight > CFG.concentrationWatch ? ` ${bigStock.name} alone is ${Math.round(bigStock.weight)}%.` : "");
      P.push({ id: "spread", label: "Spread", emoji: "🧺", weight: 15, score: sc, level: lvl(sc), line });
    }
    // 4) growth (how your holdings are performing, weighted by size)
    {
      const market = items.filter((h) => ["mf", "stock", "us", "gold"].includes(groupKey(h)));
      const mv = market.reduce((s, h) => s + num(h.value), 0);
      if (mv > 0) {
        const sc = Math.round(market.reduce((s, h) => s + STATUS_SCORE[h.verdict.status] * num(h.value), 0) / mv);
        const good = market.filter((h) => ["great", "good"].includes(h.verdict.status)).length;
        const bad = market.filter((h) => ["weak", "poor"].includes(h.verdict.status)).length;
        P.push({ id: "growth", label: "Growth", emoji: "📈", weight: 25, score: sc, level: lvl(sc), line: `${good} of your ${market.length} investments are doing well, ${bad} are falling behind.` });
      }
    }
    // 5) saving habit
    if (cash.savingsRate != null) {
      const sr = cash.savingsRate;
      let sc = sr >= 30 ? 100 : sr >= 20 ? 75 : sr >= 10 ? 45 : 20;
      if (num(profile.sipTarget) > 0 && num(mfThisMonth) < num(profile.sipTarget) * 0.9) sc = Math.max(0, sc - 10);
      P.push({ id: "habit", label: "Saving habit", emoji: "🌱", weight: 15, score: sc, level: lvl(sc), line: `You save about ${r1(sr)}% of your income. ${sr >= 30 ? "That is excellent." : sr >= 20 ? "Good — a little more will speed things up." : "Try to raise this; it matters more than picking investments."}` });
    }
    return P;
  }

  // ── main entry ────────────────────────────────────────────────────────────
  function analyze(input) {
    const now = input.now || iso(Date.now());
    const profile = { ...DEFAULT_PROFILE, ...(input.profile || {}), target: { ...DEFAULT_PROFILE.target, ...((input.profile || {}).target || {}) } };
    const profileSet = Boolean(input.profileSet);
    const holdings = (input.holdings || []).filter((h) => num(h.value) > 0);
    const series = input.series || {};
    const bench = input.benchmarks || {};
    const cash = input.cash || {};
    const liabilities = (input.liabilities || []).filter((l) => num(l.value) > 0);
    const goals = input.goals || [];
    const signals = [];
    const add = (s) => signals.push({ confidence: "medium", actionLabel: ACTION_LABEL[s.action] || s.action, ...s });

    const total = holdings.reduce((s, h) => s + num(h.value), 0);
    const invested = holdings.reduce((s, h) => s + num(h.invested), 0);

    // per-holding metrics
    const items = holdings.map((h) => {
      const sr = series[h.key];
      const mom = sr ? momentum(sr, now) : null;
      const bm = bench[benchmarkFor(h)];
      const bmMom = bm ? momentum(bm, now) : null;
      const flows = h.flows && h.flows.length ? xirr(h.flows, num(h.value), now) : null;
      return {
        ...h,
        group: groupOf(h),
        kind: kindOf(h),
        weight: pct(num(h.value), total),
        returnPct: num(h.invested) > 0 ? (num(h.value) / num(h.invested) - 1) * 100 : null,
        xirr: flows,
        ageDays: h.flows && h.flows.length ? Math.round((new Date(now) - Math.min(...h.flows.map((f) => new Date(f.date).getTime()))) / DAY) : null,
        mom,
        relative1y: mom && bmMom && mom.r1y != null && bmMom.r1y != null ? mom.r1y - bmMom.r1y : null,
        historyDays: mom ? mom.days : 0,
      };
    });
    const goldBm0 = bench.gold ? momentum(bench.gold, now) : null;
    items.forEach((h) => { h.verdict = verdictFor(h, { goldBm: goldBm0 }); });

    // allocation (hybrid counts half equity / half debt)
    const alloc = { equity: 0, gold: 0, debt: 0, cash: 0, other: 0 };
    items.forEach((h) => {
      if (h.group === "hybrid") { alloc.equity += num(h.value) * 0.5; alloc.debt += num(h.value) * 0.5; }
      else alloc[h.group] += num(h.value);
    });
    const allocPct = Object.fromEntries(Object.entries(alloc).map(([k, v]) => [k, pct(v, total)]));
    const tgt = profile.target;
    const confOf = (h) => (h.historyDays >= 300 ? "high" : h.historyDays >= CFG.minHistoryDays ? "medium" : "low");

    // ── things to act on, in plain words ──────────────────────────────────
    // emergency fund
    const monthlyExpenses = num(cash.monthlyExpenses);
    const liquid = items.filter((h) => h.cls === "bank" || h.cls === "fd").reduce((s, h) => s + num(h.value), 0);
    const emergencyMonths = monthlyExpenses > 0 ? liquid / monthlyExpenses : null;
    if (emergencyMonths != null && emergencyMonths < profile.emergencyMonths) {
      const short = profile.emergencyMonths * monthlyExpenses - liquid;
      add({ id: "emergency-fund", severity: emergencyMonths < CFG.emergencyActMonths ? "act" : "watch", action: "BUILD", confidence: "high",
        title: "Build a bigger emergency cushion",
        why: [`Your bank savings and FDs would cover about ${r1(emergencyMonths)} months of spending. A safe target is ${profile.emergencyMonths} months — about ${inr(short)} more.`,
          "Do this before putting more money into shares or funds. It protects you from having to sell investments at a bad time."] });
    }

    // expensive loans
    liabilities.forEach((l) => {
      const rate = num(l.rate);
      if (!(rate > 0)) return;
      const yearly = (num(l.value) * rate) / 100;
      if (rate >= CFG.debtActRate) {
        add({ id: "debt-" + l.name, severity: "act", action: "PREPAY", assetKey: l.name, confidence: "high",
          title: `Pay off “${l.name}” faster`,
          why: [`It charges ${rate}% a year — about ${inr(yearly)} in interest on ${inr(l.value)}.`, "Shares and funds rarely beat that after tax, so spare money is better used here first."] });
      } else if (rate >= CFG.debtWatchRate) {
        add({ id: "debt-" + l.name, severity: "watch", action: "REVIEW", assetKey: l.name, confidence: "high",
          title: `Consider paying part of “${l.name}” early`,
          why: [`It charges ${rate}% a year (about ${inr(yearly)} interest). Paying it down is a guaranteed saving, similar to a good safe investment.`] });
      }
    });

    // one stock too big
    items.filter((h) => h.kind === "stock").forEach((h) => {
      if (h.weight >= CFG.concentrationWatch) {
        add({ id: "conc-" + h.key, severity: h.weight >= CFG.concentrationAct ? "act" : "watch", action: "TRIM", assetKey: h.key, confidence: "high",
          title: `${h.name} is a big part of your money (${Math.round(h.weight)}%)`,
          why: ["If one company has a bad year, it hurts your whole portfolio a lot.", "Avoid adding more. If it keeps growing, reduce slowly (check the tax on your gains first)."] });
      }
    });
    const dust = items.filter((h) => h.weight < CFG.dustPct && (h.cls === "stock" || h.cls === "us" || h.cls === "mf"));
    if (dust.length >= CFG.dustCount) {
      add({ id: "dust", severity: "info", action: "REVIEW", title: `You hold ${dust.length} very small investments`,
        why: [`Each is under ${CFG.dustPct}% of your money, so even a big jump barely changes your wealth.`, "Too many small ones are hard to follow. Keep your best ideas and fold the rest into them over time."] });
    }

    // balance vs the plan (only once you have told me your plan)
    if (profileSet) {
      [["equity", "shares and equity funds"], ["gold", "gold"], ["debt", "safe/fixed-income money"], ["cash", "cash"]].forEach(([k, label]) => {
        const drift = allocPct[k] - num(tgt[k]);
        if (Math.abs(drift) >= CFG.driftPP) {
          const over = drift > 0;
          add({ id: "drift-" + k, severity: "watch", action: "REBALANCE", assetKey: k, confidence: "high",
            title: `You hold ${over ? "more" : "less"} ${label} than your plan`,
            why: [`Now ${r1(allocPct[k])}% of your money; your plan says ${tgt[k]}%.`, over ? "No need to sell. Put new money into the other areas until it evens out." : `Put new money here until it reaches your plan (about ${inr((Math.abs(drift) / 100) * total)} more).`] });
        }
      });
    }

    // per-holding trend calls (need price history)
    items.forEach((h) => {
      const m = h.mom;
      if (!m || h.historyDays < CFG.minHistoryDays) return;
      const conf = confOf(h);
      if (h.kind === "stock") {
        if (m.drawdown != null && m.drawdown <= CFG.stockActDrawdown && (m.r6m || 0) < 0 && (h.relative1y == null || h.relative1y <= CFG.stockActRelative)) {
          add({ id: "trend-" + h.key, severity: "act", action: "REVIEW", assetKey: h.key, confidence: conf,
            title: `${h.name} has fallen a lot — check why you own it`,
            why: [`It is ${plainPct(m.drawdown)} below its highest price of the past year, and ${plainPct(m.r6m)} lower than 6 months ago.`,
              h.relative1y != null ? `It is also doing ${plainPct(h.relative1y)} worse than the market over a year.` : null,
              h.returnPct != null ? `Versus what you paid: ${h.returnPct >= 0 ? "up" : "down"} ${plainPct(h.returnPct)}.` : null,
              "If the reason you bought it no longer holds, selling may be sensible. If it still holds, don't buy more just because it looks cheaper."].filter(Boolean) });
        } else if (m.drawdown != null && m.drawdown <= CFG.stockWatchDrawdown && (h.relative1y == null || h.relative1y <= CFG.stockWatchRelative)) {
          add({ id: "trend-" + h.key, severity: "watch", action: "REVIEW", assetKey: h.key, confidence: conf,
            title: `${h.name} is down ${plainPct(m.drawdown)} from its high`,
            why: [`Last 3 months: ${signed(m.r3m)}.`, "Add more only if the reason you bought it still holds and it is a small part of your money."] });
        }
      }
      if ((h.kind === "index" || h.kind === "etf") && h.group === "equity" && m.drawdown != null && m.drawdown <= CFG.indexBuyDrawdown && allocPct.equity <= num(tgt.equity) + 3) {
        add({ id: "dip-" + h.key, severity: "info", action: "ADD", assetKey: h.key, confidence: conf,
          title: `${h.name} is ${plainPct(m.drawdown)} below its recent high`,
          why: ["Funds that follow the whole market usually recover over many years.", "If you have spare money, adding a little every month (instead of all at once) is a calm way to buy."] });
      }
      if (h.kind === "active" && h.relative1y != null && h.group === "equity") {
        const niftyR6 = bench.nifty ? returnOver(bench.nifty, now, 182) : null;
        if (h.relative1y <= CFG.underperformAct && (m.r6m || 0) < (niftyR6 == null ? 0 : niftyR6)) {
          add({ id: "lag-" + h.key, severity: "act", action: "REVIEW", assetKey: h.key, confidence: conf,
            title: `${h.name} is clearly behind the market`,
            why: [`Last year it gave ${signed(m.r1y)}; the market did ${plainPct(h.relative1y)} better. It is still behind over 6 months.`, "Compare it with other funds of the same kind, or with a plain Nifty index fund. Switching can have tax and exit-fee costs."] });
        } else if (h.relative1y <= CFG.underperformWatch) {
          add({ id: "lag-" + h.key, severity: "watch", action: "REVIEW", assetKey: h.key, confidence: conf,
            title: `${h.name} is a little behind the market`,
            why: [`Last year: ${signed(m.r1y)}, about ${plainPct(h.relative1y)} less than the market. Give it another quarter before deciding.`] });
        }
      }
      if ((h.kind === "stock" || h.kind === "etf") && m.vsMa200 != null && m.vsMa200 >= CFG.extendedAboveMa200 && h.weight >= 8) {
        add({ id: "ext-" + h.key, severity: "info", action: "HOLD", assetKey: h.key, confidence: conf,
          title: `${h.name} has risen very fast`,
          why: [`Its price is ${plainPct(m.vsMa200)} above its usual level of the past 200 days, and it is ${Math.round(h.weight)}% of your money.`, "Avoid adding more now. Taking a little profit is a fair choice if it is bigger than you intended."] });
      }
    });

    // several market-wide funds/ETFs below their highs: one calm note instead of a list of alerts
    {
      const dips = signals.filter((x) => x.id.startsWith("dip-"));
      if (dips.length >= 3) {
        const names = dips.map((x) => x.assetKey).map((k) => (items.find((h) => h.key === k) || {}).name).filter(Boolean);
        const falls = dips.map((x) => Number((x.title.match(/(\d+(?:\.\d+)?)%/) || [])[1])).filter(Number.isFinite);
        for (let i = signals.length - 1; i >= 0; i--) if (signals[i].id.startsWith("dip-")) signals.splice(i, 1);
        add({ id: "dip-multi", severity: "info", action: "ADD", confidence: "medium",
          title: `${dips.length} of your market-wide funds and ETFs are ${Math.round(Math.min(...falls))}–${Math.round(Math.max(...falls))}% below their recent highs`,
          why: [names.slice(0, 4).join(", ") + (names.length > 4 ? ` and ${names.length - 4} more` : "") + ".",
            "Funds that follow the whole market usually recover over many years. If you have spare money, adding a little every month (instead of all at once) is a calm way to buy."] });
      }
    }

    // gold timing
    const goldBm = goldBm0;
    if (goldBm && goldBm.days >= CFG.minHistoryDays) {
      if (goldBm.drawdown != null && goldBm.drawdown <= CFG.goldDrop && allocPct.gold < num(tgt.gold)) {
        add({ id: "gold-dip", severity: "info", action: "ADD", assetKey: "gold", confidence: goldBm.days >= 300 ? "high" : "medium",
          title: `Gold is ${plainPct(goldBm.drawdown)} below its recent high`,
          why: [`You hold ${r1(allocPct.gold)}% in gold; your plan says ${tgt.gold}%.`, "Buying a little at a time (gold ETF or SGB) brings you closer to your plan at a lower price."] });
      } else if ((goldBm.r1y || 0) > 30 && allocPct.gold > num(tgt.gold) + 3) {
        add({ id: "gold-run", severity: "info", action: "HOLD", assetKey: "gold", confidence: "medium",
          title: "Gold has risen sharply and is now above your plan",
          why: [`Gold gave ${signed(goldBm.r1y)} in a year; you hold ${r1(allocPct.gold)}% (plan: ${tgt.gold}%).`, "Hold what you have; avoid buying more for now."] });
      }
    }

    // saving habit and SIPs
    if (num(profile.sipTarget) > 0 && num(input.mfThisMonth) < num(profile.sipTarget) * 0.9) {
      add({ id: "sip-gap", severity: "watch", action: "ADD", confidence: "high", title: "This month's SIP is behind target",
        why: [`You have invested ${inr(input.mfThisMonth)} of your ${inr(profile.sipTarget)} target so far this month.`, "Investing regularly matters more than picking the perfect moment."] });
    }
    if (cash.savingsRate != null) {
      if (cash.savingsRate < CFG.lowSavingsRate) {
        add({ id: "savings-low", severity: "watch", action: "BUILD", confidence: "high", title: `You save only ${r1(cash.savingsRate)}% of your income`,
          why: [`Average income ${inr(cash.monthlyIncome)} a month, spending ${inr(cash.monthlyExpenses)} (last 6 months).`, "Saving 30% or more is the biggest thing you can do for long-term wealth.", cash.topCategories && cash.topCategories[0] ? `Your biggest spend: ${cash.topCategories[0][0]} (${inr(cash.topCategories[0][1])} a month).` : null].filter(Boolean) });
      } else if (cash.savingsRate >= CFG.highSavingsRate && allocPct.cash > CFG.idleCashPct) {
        add({ id: "idle-cash", severity: "info", action: "ADD", confidence: "medium", title: "You save well, but a lot of cash is sitting idle",
          why: [`Cash is ${r1(allocPct.cash)}% of your money while your savings rate is ${r1(cash.savingsRate)}%.`, "Once your emergency fund is full, move the extra into investments gradually."] });
      }
    }

    // A goal named after an investment bucket often has a hand-typed "saved" figure that has drifted from reality.
    const staleGoalNote = (g) => {
      const n = String(g.name || "").toLowerCase();
      const bucket = /mutual fund|\bmf\b|sip/.test(n) ? "mf" : /stock|equity|share/.test(n) ? "stock" : /gold/.test(n) ? "gold" : null;
      if (!bucket) return null;
      const actual = items.filter((h) => (bucket === "gold" ? groupOf(h) === "gold" : groupKey(h) === bucket)).reduce((a, h) => a + num(h.value), 0);
      if (actual > num(g.saved) * 1.1) return `Heads up: you recorded ${inr(g.saved)} saved, but your ${bucket === "mf" ? "mutual funds are" : bucket === "gold" ? "gold is" : "stocks are"} worth ${inr(actual)} now. Update the saved amount so this is accurate.`;
      return null;
    };
    // goals — only the ones that look genuinely hard
    goals.forEach((g) => {
      const need = num(g.target) - num(g.saved);
      if (need <= 0 || !g.dueDate) return;
      // Same rule as the Goals page (goalNeedPerMonth): whole months rounded up, so both pages show the same figure.
      const monthsExact = (new Date(String(g.dueDate).slice(0, 10)) - new Date(String(now).slice(0, 10))) / (30.4375 * DAY);
      const months = monthsExact <= 0 ? 0 : Math.max(1, Math.ceil(monthsExact));
      if (months <= 0) {
        add({ id: "goal-" + g.name, severity: "info", action: "REVIEW", title: `The goal “${g.name}” has passed its date`, why: [`You are still ${inr(need)} short of ${inr(g.target)}. Set a new date or amount.`] });
      } else {
        const perMonth = Math.ceil(need / months);
        if (cash.monthlyIncome && perMonth > num(cash.monthlyIncome) * 0.25) {
          add({ id: "goal-" + g.name, severity: "info", action: "REVIEW", title: `The goal “${g.name}” needs ${inr(perMonth)} a month`,
            why: [`${inr(need)} to go in ${Math.round(months)} months — that is over a quarter of your income. Consider a later date or a smaller target.`,
              staleGoalNote(g)].filter(Boolean) });
        }
      }
    });

    const order = { act: 0, watch: 1, info: 2 };
    signals.sort((a, b) => order[a.severity] - order[b.severity]);

    // ── pillars, score, strengths ─────────────────────────────────────────
    const pillars = pillarList({ items, total, cash, liabilities, emergencyMonths, profile, profileSet, signals, allocPct, mfThisMonth: input.mfThisMonth });
    const wsum = pillars.reduce((s, p) => s + p.weight, 0);
    const score = wsum ? Math.round(pillars.reduce((s, p) => s + p.score * p.weight, 0) / wsum) : 0;

    const strengths = [];
    if (emergencyMonths != null && emergencyMonths >= profile.emergencyMonths) strengths.push(`Your emergency cushion covers ${r1(emergencyMonths)} months of spending.`);
    if (cash.savingsRate != null && cash.savingsRate >= 30) strengths.push(`You save about ${r1(cash.savingsRate)}% of your income — that is excellent.`);
    if (!liabilities.length) strengths.push("You have no loans.");
    else if (liabilities.every((l) => num(l.rate) > 0) && !liabilities.some((l) => num(l.rate) >= CFG.debtWatchRate)) strengths.push("None of your loans is very expensive.");
    const winners = items.filter((h) => ["great", "good"].includes(h.verdict.status) && groupKey(h) !== "safe");
    if (winners.length) strengths.push(`${winners.length} of your investments are beating or matching the market well${winners.length <= 3 ? ": " + winners.map((h) => h.name).join(", ") : ""}.`);
    if (invested > 0 && total / invested > 1) strengths.push(`Overall, your money has grown ${r1((total / invested - 1) * 100)}% beyond what you put in.`);

    const groups = groupSummaries(items, total);
    const top5 = items.slice().sort((a, b) => b.weight - a.weight).slice(0, 5).reduce((s, h) => s + h.weight, 0);

    return {
      asOf: now,
      profileSet,
      metrics: {
        total: r2(total), invested: r2(invested),
        returnPct: invested > 0 ? r1((total / invested - 1) * 100) : null,
        allocation: Object.fromEntries(Object.entries(allocPct).map(([k, v]) => [k, r1(v)])),
        target: tgt,
        top5Weight: r1(top5),
        positions: items.length,
        emergencyMonths: emergencyMonths != null ? r1(emergencyMonths) : null,
        savingsRate: cash.savingsRate != null ? r1(cash.savingsRate) : null,
      },
      pillars,
      strengths,
      groups,
      holdings: items.map((h) => ({
        key: h.key, name: h.name, cls: h.cls, kind: h.kind, group: h.group, groupKey: groupKey(h), owner: h.owner,
        value: r2(h.value), invested: r2(num(h.invested)), weight: r1(h.weight),
        returnPct: h.returnPct != null ? r1(h.returnPct) : null,
        xirr: h.xirr != null ? r1(h.xirr) : null,
        r1m: h.mom && h.mom.r1m != null ? r1(h.mom.r1m) : null,
        r3m: h.mom && h.mom.r3m != null ? r1(h.mom.r3m) : null,
        r6m: h.mom && h.mom.r6m != null ? r1(h.mom.r6m) : null,
        r1y: h.mom && h.mom.r1y != null ? r1(h.mom.r1y) : null,
        drawdown: h.mom && h.mom.drawdown != null ? r1(h.mom.drawdown) : null,
        vsMa200: h.mom && h.mom.vsMa200 != null ? r1(h.mom.vsMa200) : null,
        vs1yBenchmark: h.relative1y != null ? r1(h.relative1y) : null,
        historyDays: h.historyDays,
        verdict: h.verdict,
      })),
      liabilities: liabilities.map((l) => ({ name: l.name, owner: l.owner, value: num(l.value), emi: num(l.emi), rate: num(l.rate), yearlyInterest: num(l.rate) > 0 ? Math.round((num(l.value) * num(l.rate)) / 100) : null })),
      signals,
      score,
    };
  }

  return { analyze, xirr, momentum, returnOver, annualVol, groupOf, kindOf, benchmarkFor, verdictFor, ACTION_LABEL, STATUS_LABEL, MOVE_LABEL, GROUP_LABEL, DEFAULT_PROFILE, CFG };
});
