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
      case "stock": case "us": return "equity";
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

  function kindOf(h) {
    const name = String(h.name || "").toLowerCase();
    if (h.cls === "stock" || h.cls === "us") return /\betf\b|bees|etf/.test(name) ? "etf" : "stock";
    if (h.cls === "mf") return /index|nifty|sensex|\betf\b|next 50|midcap 150|smallcap 250/.test(name) ? "index" : "active";
    return h.cls;
  }

  function benchmarkFor(h) {
    if (h.cls === "us") return "sp500";
    if (h.cls === "gold" || groupOf(h) === "gold") return "gold";
    if (h.cls === "stock" || (h.cls === "mf" && groupOf(h) === "equity")) return "nifty";
    return null;
  }

  // ── main entry ────────────────────────────────────────────────────────────
  function analyze(input) {
    const now = input.now || iso(Date.now());
    const profile = { ...DEFAULT_PROFILE, ...(input.profile || {}), target: { ...DEFAULT_PROFILE.target, ...((input.profile || {}).target || {}) } };
    const holdings = (input.holdings || []).filter((h) => num(h.value) > 0);
    const series = input.series || {};
    const bench = input.benchmarks || {};
    const cash = input.cash || {};
    const liabilities = (input.liabilities || []).filter((l) => num(l.value) > 0);
    const goals = input.goals || [];
    const signals = [];
    const add = (s) => signals.push({ confidence: "medium", ...s });

    const total = holdings.reduce((s, h) => s + num(h.value), 0);
    const invested = holdings.reduce((s, h) => s + num(h.invested), 0);

    // per-holding metrics
    const items = holdings.map((h) => {
      const sr = series[h.key];
      const mom = sr ? momentum(sr, now) : null;
      const bm = bench[benchmarkFor(h)];
      const bmMom = bm ? momentum(bm, now) : null;
      const group = groupOf(h);
      const flows = h.flows && h.flows.length ? xirr(h.flows, num(h.value), now) : null;
      return {
        ...h,
        group,
        kind: kindOf(h),
        weight: pct(num(h.value), total),
        returnPct: num(h.invested) > 0 ? (num(h.value) / num(h.invested) - 1) * 100 : null,
        xirr: flows,
        mom,
        relative1y: mom && bmMom && mom.r1y != null && bmMom.r1y != null ? mom.r1y - bmMom.r1y : null,
        historyDays: mom ? mom.days : 0,
      };
    });

    // allocation (hybrid counts half equity / half debt)
    const alloc = { equity: 0, gold: 0, debt: 0, cash: 0, other: 0 };
    items.forEach((h) => {
      if (h.group === "hybrid") { alloc.equity += num(h.value) * 0.5; alloc.debt += num(h.value) * 0.5; }
      else alloc[h.group] += num(h.value);
    });
    const allocPct = Object.fromEntries(Object.entries(alloc).map(([k, v]) => [k, pct(v, total)]));

    const confOf = (h) => (h.historyDays >= 300 ? "high" : h.historyDays >= CFG.minHistoryDays ? "medium" : "low");

    // R1 emergency fund
    const monthlyExpenses = num(cash.monthlyExpenses);
    const liquid = items.filter((h) => h.cls === "bank" || h.cls === "fd").reduce((s, h) => s + num(h.value), 0);
    const emergencyMonths = monthlyExpenses > 0 ? liquid / monthlyExpenses : null;
    if (emergencyMonths != null) {
      if (emergencyMonths < CFG.emergencyActMonths) {
        add({ id: "emergency-fund", severity: "act", action: "BUILD", title: "Emergency fund is thin", confidence: "high",
          why: [`Liquid savings ${inr(liquid)} cover ${r1(emergencyMonths)} months of expenses (target ${profile.emergencyMonths}).`, `Build this before adding new equity.`] });
      } else if (emergencyMonths < profile.emergencyMonths * CFG.emergencyWatchFrac) {
        add({ id: "emergency-fund", severity: "watch", action: "BUILD", title: "Emergency fund below target", confidence: "high",
          why: [`Liquid savings cover ${r1(emergencyMonths)} months (target ${profile.emergencyMonths}); shortfall ≈ ${inr(profile.emergencyMonths * monthlyExpenses - liquid)}.`] });
      }
    }

    // R2 debt cost
    liabilities.forEach((l) => {
      const rate = num(l.rate);
      if (!(rate > 0)) return;
      const yearly = (num(l.value) * rate) / 100;
      if (rate >= CFG.debtActRate) {
        add({ id: "debt-" + l.name, severity: "act", action: "PREPAY", title: `Prepay “${l.name}”`, confidence: "high", assetKey: l.name,
          why: [`Costs ${rate}% a year (${inr(yearly)} interest on ${inr(l.value)}) — above what equity can reliably beat after tax.`, "Extra surplus is better used here before new risk assets."] });
      } else if (rate >= CFG.debtWatchRate) {
        add({ id: "debt-" + l.name, severity: "watch", action: "REVIEW", title: `Consider part-prepaying “${l.name}”`, confidence: "high", assetKey: l.name,
          why: [`Costs ${rate}% a year (${inr(yearly)} interest); a guaranteed saving comparable to a good debt fund.`] });
      }
    });

    // R3 concentration + dust
    items.filter((h) => h.kind === "stock").forEach((h) => {
      if (h.weight >= CFG.concentrationWatch) {
        add({ id: "conc-" + h.key, severity: h.weight >= CFG.concentrationAct ? "act" : "watch", action: "TRIM", assetKey: h.key,
          title: `${h.name} is ${r1(h.weight)}% of your portfolio`, confidence: "high",
          why: [`A single stock above ${CFG.concentrationWatch}% adds company-specific risk.`, "Direct new money elsewhere or trim in stages (check tax on gains first)."] });
      }
    });
    const dust = items.filter((h) => h.weight < CFG.dustPct && (h.cls === "stock" || h.cls === "us" || h.cls === "mf"));
    if (dust.length >= CFG.dustCount) {
      add({ id: "dust", severity: "info", action: "REVIEW", title: `${dust.length} tiny positions (<${CFG.dustPct}% each)`,
        why: [`They add tracking effort but hardly move returns: ${dust.slice(0, 4).map((h) => h.name).join(", ")}…`, "Consider consolidating into your best holdings."] });
    }

    // R4 allocation drift
    const tgt = profile.target;
    [["equity", "Equity"], ["gold", "Gold"], ["debt", "Debt"], ["cash", "Cash"]].forEach(([k, label]) => {
      const drift = allocPct[k] - num(tgt[k]);
      if (Math.abs(drift) >= CFG.driftPP) {
        const over = drift > 0;
        add({ id: "drift-" + k, severity: "watch", action: "REBALANCE", assetKey: k,
          title: `${label} is ${over ? "over" : "under"} target by ${r1(Math.abs(drift))} pp`, confidence: "high",
          why: [`Now ${r1(allocPct[k])}% vs target ${tgt[k]}%.`, over ? "Steer new money to the other classes rather than selling." : `Direct fresh investments here (≈ ${inr((Math.abs(drift) / 100) * total)} to reach target).`] });
      }
    });

    // R5/R6/R7 per-holding trend signals (need history)
    items.forEach((h) => {
      const m = h.mom;
      if (!m || h.historyDays < CFG.minHistoryDays) return;
      const conf = confOf(h);
      const mention = (parts) => parts.filter(Boolean);
      if (h.kind === "stock") {
        if (m.drawdown != null && m.drawdown <= CFG.stockActDrawdown && (m.r6m || 0) < 0 && (h.relative1y == null || h.relative1y <= CFG.stockActRelative)) {
          add({ id: "trend-" + h.key, severity: "act", action: "REVIEW", assetKey: h.key, confidence: conf,
            title: `${h.name}: deep, persistent weakness — re-check the thesis`,
            why: mention([`Down ${r1(Math.abs(m.drawdown))}% from its 52-week high; 6-month return ${r1(m.r6m)}%.`,
              h.relative1y != null ? `Lagging Nifty by ${r1(Math.abs(h.relative1y))} pp over a year.` : null,
              h.returnPct != null ? `Your position: ${r1(h.returnPct)}% vs cost.` : null,
              "If the business reason you bought it no longer holds, this is an exit candidate; if it holds, do not average down blindly."]) });
        } else if (m.drawdown != null && m.drawdown <= CFG.stockWatchDrawdown) {
          add({ id: "trend-" + h.key, severity: "watch", action: "REVIEW", assetKey: h.key, confidence: conf,
            title: `${h.name} has corrected ${r1(Math.abs(m.drawdown))}%`,
            why: mention([`52-week drawdown ${r1(m.drawdown)}%; 3-month ${r1(m.r3m)}%.`, "Add only if the thesis is intact and the position is below your intended weight."]) });
        }
      }
      if ((h.kind === "index" || h.kind === "etf") && h.group !== "gold" && m.drawdown != null && m.drawdown <= CFG.indexBuyDrawdown && h.group === "equity" && allocPct.equity <= num(tgt.equity) + 3) {
        add({ id: "dip-" + h.key, severity: "info", action: "ADD", assetKey: h.key, confidence: conf,
          title: `${h.name} is ${r1(Math.abs(m.drawdown))}% below its 52-week high`,
          why: [`Broad, diversified instruments recover with the market over long horizons; staggering buys (tranches) reduces timing risk.`, `Weight today ${r1(h.weight)}% of the portfolio.`] });
      }
      if (h.kind === "active" && h.relative1y != null && h.group === "equity") {
        if (h.relative1y <= CFG.underperformAct && (m.r6m || 0) < (bench.nifty ? returnOver(bench.nifty, now, 182) ?? 0 : 0)) {
          add({ id: "lag-" + h.key, severity: "act", action: "REVIEW", assetKey: h.key, confidence: conf,
            title: `${h.name} is lagging the market badly`,
            why: [`1-year return ${r1(m.r1y)}% vs Nifty gap of ${r1(h.relative1y)} pp, and still behind over 6 months.`, "Compare with its category peers or a low-cost index fund; switching has tax and exit-load implications."] });
        } else if (h.relative1y <= CFG.underperformWatch) {
          add({ id: "lag-" + h.key, severity: "watch", action: "REVIEW", assetKey: h.key, confidence: conf,
            title: `${h.name} trails Nifty by ${r1(Math.abs(h.relative1y))} pp (1y)`, why: [`1-year ${r1(m.r1y)}%. Watch another quarter before acting.`] });
        }
      }
      if ((h.kind === "stock" || h.kind === "etf") && m.vsMa200 != null && m.vsMa200 >= CFG.extendedAboveMa200 && h.weight >= 8) {
        add({ id: "ext-" + h.key, severity: "info", action: "HOLD", assetKey: h.key, confidence: conf,
          title: `${h.name} looks stretched`, why: [`${r1(m.vsMa200)}% above its 200-day average and ${r1(h.weight)}% of your portfolio.`, "Avoid adding here; partial profit-booking is reasonable if it is above your intended weight."] });
      }
    });

    // R10 gold timing vs target
    const goldBm = bench.gold ? momentum(bench.gold, now) : null;
    if (goldBm && goldBm.days >= CFG.minHistoryDays) {
      if (goldBm.drawdown != null && goldBm.drawdown <= CFG.goldDrop && allocPct.gold < num(tgt.gold)) {
        add({ id: "gold-dip", severity: "info", action: "ADD", assetKey: "gold", confidence: goldBm.days >= 300 ? "high" : "medium",
          title: `Gold is ${r1(Math.abs(goldBm.drawdown))}% off its high and you are under target`,
          why: [`Gold ${r1(allocPct.gold)}% vs target ${tgt.gold}%.`, "A staggered purchase (SGB/ETF) lifts it toward target at a lower price."] });
      } else if ((goldBm.r1y || 0) > 30 && allocPct.gold > num(tgt.gold) + 3) {
        add({ id: "gold-run", severity: "info", action: "HOLD", assetKey: "gold", confidence: "medium",
          title: "Gold has run hard and is above target",
          why: [`1-year gold return ${r1(goldBm.r1y)}%; allocation ${r1(allocPct.gold)}% vs target ${tgt.gold}%.`, "Hold; avoid adding more."] });
      }
    }

    // R9 SIP discipline, R11 savings rate / idle cash
    if (num(profile.sipTarget) > 0 && num(input.mfThisMonth) < num(profile.sipTarget) * 0.9) {
      add({ id: "sip-gap", severity: "watch", action: "ADD", title: "This month's SIP is behind target", confidence: "high",
        why: [`Invested ${inr(input.mfThisMonth)} of ${inr(profile.sipTarget)} so far this month.`, "Consistency matters more than timing for generational wealth."] });
    }
    if (cash.savingsRate != null) {
      if (cash.savingsRate < CFG.lowSavingsRate) {
        add({ id: "savings-low", severity: "watch", action: "BUILD", title: `Savings rate is ${r1(cash.savingsRate)}%`, confidence: "high",
          why: [`Income ${inr(cash.monthlyIncome)}, expenses ${inr(cash.monthlyExpenses)} (6-month average).`, "Aim for 30%+: it is the biggest lever on long-term wealth.", cash.topCategories && cash.topCategories[0] ? `Largest spend: ${cash.topCategories[0][0]} (${inr(cash.topCategories[0][1])}/month).` : null].filter(Boolean) });
      } else if (cash.savingsRate >= CFG.highSavingsRate && allocPct.cash > CFG.idleCashPct) {
        add({ id: "idle-cash", severity: "info", action: "ADD", title: "Strong savings, but cash is idle", confidence: "medium",
          why: [`Savings rate ${r1(cash.savingsRate)}% yet cash is ${r1(allocPct.cash)}% of the portfolio (target ${tgt.cash}%).`, "Deploy beyond the emergency fund gradually via SIP/STP."] });
      }
    }

    // goals
    goals.forEach((g) => {
      const need = num(g.target) - num(g.saved);
      if (need <= 0 || !g.dueDate) return;
      const months = Math.max(0, (new Date(g.dueDate) - new Date(now)) / (30.44 * DAY));
      if (months <= 0) {
        add({ id: "goal-" + g.name, severity: "watch", action: "REVIEW", title: `Goal “${g.name}” is past its date`, why: [`Still ${inr(need)} short of ${inr(g.target)}.`] });
      } else {
        const perMonth = need / months;
        if (cash.monthlyIncome && perMonth > num(cash.monthlyIncome) * 0.15) {
          add({ id: "goal-" + g.name, severity: "watch", action: "REVIEW", title: `Goal “${g.name}” needs ${inr(perMonth)}/month`,
            why: [`${inr(need)} to go in ${Math.round(months)} months — over 15% of monthly income; extend the date or lift the target gradually.`] });
        }
      }
    });

    // diversification note
    const top5 = items.slice().sort((a, b) => b.weight - a.weight).slice(0, 5).reduce((s, h) => s + h.weight, 0);

    // health score
    const sev = { act: 0, watch: 0, info: 0 };
    signals.forEach((s) => { sev[s.severity] = (sev[s.severity] || 0) + 1; });
    const score = Math.max(0, Math.min(100, Math.round(100 - sev.act * 9 - sev.watch * 4)));

    const order = { act: 0, watch: 1, info: 2 };
    signals.sort((a, b) => order[a.severity] - order[b.severity]);

    return {
      asOf: now,
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
      holdings: items.map((h) => ({
        key: h.key, name: h.name, cls: h.cls, kind: h.kind, group: h.group, owner: h.owner,
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
      })),
      signals,
      score,
    };
  }

  return { analyze, xirr, momentum, returnOver, annualVol, groupOf, kindOf, benchmarkFor, DEFAULT_PROFILE, CFG };
});
