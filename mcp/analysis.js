/**
 * Life Ledger MCP — analysis (pure: takes the household `state`, returns plain objects; no network, no secrets).
 * Everything here is a description of the user's own numbers — educational, not investment advice.
 */
const Advisor = require("../advisor-engine.js");
const Protection = require("../protection-core.js");
const Integrity = require("../holdings-integrity.js");

const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const sum = (list, f) => (list || []).reduce((s, x) => s + num(f(x)), 0);
const r0 = (v) => Math.round(v);
const r1 = (v) => Math.round(v * 10) / 10;
const pct = (a, b) => (b ? r1((a / b) * 100) : null);
const monthOf = (iso) => String(iso || "").slice(0, 7);
const addMonths = (ym, n) => { const [y, m] = ym.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const isoDay = (d) => new Date(d).toISOString().slice(0, 10);
const EXP_CAT = (c) => String(c || "Others").replace(/^EMI- /, "EMI - ").replace("Gromming", "Grooming");

function usdInr(state, override) {
  return num(override) || num(state.fx && state.fx.usdInr) || num((state.netWorthHistory || []).slice().reverse().find((h) => h.fxRate)?.fxRate) || 0;
}

/** Gold is valued as weight × the live carat rate (as the app does on every load), not the value last saved in the vault. */
function goldValue(state) {
  const gp = state.goldPrice || {}, p22 = num(gp.price22k), p24 = num(gp.price24k);
  const rate = (carat) => {
    const c = String(carat || "22K").toUpperCase();
    if (c.includes("24")) return p24 > 0 ? p24 : p22 > 0 ? p22 / (22 / 24) : 0;
    if (c.includes("18")) return (p24 > 0 ? p24 : p22 > 0 ? p22 / (22 / 24) : 0) * (18 / 24);
    return p22 > 0 ? p22 : p24 > 0 ? p24 * (22 / 24) : 0;
  };
  return (state.gold || []).reduce((t, g) => {
    const w = num(g.weightGrams || g.weight), live = w > 0 ? w * rate(g.carat) : 0;
    return t + (live > 0 ? live : num(g.value));
  }, 0);
}

// ── net worth ────────────────────────────────────────────────────────────────────────────────
function netWorth(state, fxOverride) {
  const fx = usdInr(state, fxOverride);
  const us = sum(state.usstocks, (x) => x.currentValue) * fx;
  const cls = {
    mutualFunds: sum(state.mutualFunds, (x) => (x.transactionType === "REDEMPTION" ? -1 : 1) * num(x.currentValue)),
    stocks: sum(state.stocks, (x) => x.currentValue),
    usStocks: us,
    gold: goldValue(state),
    silver: sum(state.silver, (x) => x.value),
    crypto: sum(state.crypto, (x) => x.value),
    fd: sum(state.fd, (x) => x.value),
    epf: sum(state.epf, (x) => x.value),
    ppf: sum(state.ppf, (x) => x.value),
    bonds: sum(state.bonds, (x) => x.value),
    bankSaving: sum(state.banksaving, (x) => x.value),
    others: sum(state.others, (x) => x.value) + sum(state.vehicles, (x) => x.value),
  };
  // A market class the app locked at its official close today keeps that value (the app's net worth does the same,
  // so a pre-market quote or a later exchange rate never makes the email and the app disagree). Not for a what-if rate.
  const todayRec = fxOverride ? null : (state.netWorthHistory || []).find((h) => h.date === isoDay(Date.now() + 5.5 * 3600000));   // the app dates records in IST
  const locked = [];
  if (todayRec && todayRec.settled) for (const k of ["mutualFunds", "stocks", "usStocks", "gold"]) {
    if (todayRec.settled[k] && num(todayRec[k]) > 0 && cls[k] > 0 && Math.abs(num(todayRec[k]) / cls[k] - 1) < 0.05) { cls[k] = num(todayRec[k]); locked.push(k); }
  }
  const assets = Object.values(cls).reduce((s, v) => s + v, 0);
  const liabilities = sum(state.liabilities, (x) => x.value);
  const out = { fxUsdInr: fx, lockedAtClose: locked, assets: r0(assets), liabilities: r0(liabilities), netWorth: r0(assets - liabilities), classes: {} };
  for (const [k, v] of Object.entries(cls)) out.classes[k] = { value: r0(v), sharePct: pct(v, assets) };
  const hist = (state.netWorthHistory || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  out.history = hist.slice(-30).map((h) => ({ date: h.date, netWorth: r0(num(h.netWorth)) }));
  // What moved since the last recorded day, class by class. Market moves hit funds/stocks/US/gold; manual edits and
  // repayments show up in the other classes (others, FD, bank, EPF, liabilities) — so the reader can tell them apart.
  const todayISO = isoDay(Date.now());
  const prev = hist.filter((h) => h.date < todayISO && num(h.netWorth) > 0).pop();
  if (prev) {
    const keys = ["mutualFunds", "stocks", "usStocks", "gold", "silver", "crypto", "fd", "epf", "ppf", "bonds", "bankSaving", "others"];
    const byClass = {};
    for (const k of keys) { const d = cls[k] - num(prev[k]); if (Math.abs(d) >= 500) byClass[k] = r0(d); }
    const liabDelta = liabilities - num(prev.liabilities);
    if (Math.abs(liabDelta) >= 500) byClass.liabilities = r0(liabDelta);
    const market = ["mutualFunds", "stocks", "usStocks", "gold", "silver", "crypto"].reduce((t, k) => t + (byClass[k] || 0), 0);
    out.changeVsPrevious = {
      previousDate: prev.date, previousNetWorth: r0(num(prev.netWorth)), delta: out.netWorth - r0(num(prev.netWorth)),
      byClass, marketLikeMoves: r0(market),
      note: "Positive liabilities delta means debt grew (bad for net worth). Round-number moves in others/FD/bank/EPF/liabilities are usually the household's own edits or payments, not markets.",
    };
  }
  return out;
}

// ── mutual funds ─────────────────────────────────────────────────────────────────────────────
function fundKind(name) {
  const n = String(name).toLowerCase();
  if (/gold|silver/.test(n)) return "Gold/Silver";
  if (/liquid|overnight|money market|debt|gilt|bond|corporate|short duration|low duration/.test(n)) return "Debt";
  if (/arbitrage|multi asset|hybrid|balanced|dynamic asset/.test(n)) return "Hybrid";
  if (/small ?cap/.test(n)) return "Small cap";
  if (/mid ?cap/.test(n)) return "Mid cap";
  if (/nifty|sensex|index|etf/.test(n)) return "Index";
  if (/flexi|multi ?cap|large|bluechip|focused|elss|tax/.test(n)) return "Diversified equity";
  if (/international|nasdaq|us |global|s&p|overseas/.test(n)) return "International";
  return "Equity (other)";
}

function mutualFundReport(state, today) {
  const nowISO = today || isoDay(Date.now());
  const rows = new Map();
  for (const m of state.mutualFunds || []) {
    const key = `${m.fundName}|${m.owner || "Me"}`;
    const e = rows.get(key) || { fund: m.fundName, owner: m.owner || "Me", kind: fundKind(m.fundName), units: 0, invested: 0, value: 0, dayChange: 0, flows: [], navDate: "" };
    const sign = m.transactionType === "REDEMPTION" ? -1 : 1;
    const inv = num(m.invested);
    e.units += sign * num(m.units);
    e.invested += sign * inv;
    e.value += sign * num(m.currentValue);
    e.dayChange += num(m.units) * sign * (num(m.latestNav) - num(m.prevNav || m.latestNav));
    e.flows.push({ date: m.purchaseDate || m.date, amount: -sign * inv });
    if ((m.navDate || "") > e.navDate) e.navDate = m.navDate;
    rows.set(key, e);
  }
  const funds = [...rows.values()].map((e) => {
    const gain = e.value - e.invested;
    const x = Advisor.xirr(e.flows.filter((f) => f.date), e.value, nowISO);
    return {
      fund: e.fund, owner: e.owner, kind: e.kind, invested: r0(e.invested), value: r0(e.value), gain: r0(gain),
      gainPct: pct(gain, e.invested), xirrPct: x == null ? null : r1(x), dayChange: r0(e.dayChange),
    };
  }).filter((f) => f.invested > 0 || f.value > 0).sort((a, b) => b.value - a.value);
  const total = sum(funds, (f) => f.value), invested = sum(funds, (f) => f.invested);
  const measured = funds.filter((f) => f.xirrPct != null && f.invested >= 25000);
  const byKind = {};
  for (const f of funds) { const k = (byKind[f.kind] ||= { value: 0, invested: 0 }); k.value += f.value; k.invested += f.invested; }
  return {
    totalValue: r0(total), totalInvested: r0(invested), gain: r0(total - invested), gainPct: pct(total - invested, invested),
    dayChange: r0(sum(funds, (f) => f.dayChange)),
    byKind: Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, { value: r0(v.value), sharePct: pct(v.value, total), gainPct: pct(v.value - v.invested, v.invested) }])),
    best: measured.slice().sort((a, b) => b.xirrPct - a.xirrPct).slice(0, 5),
    worst: measured.slice().sort((a, b) => a.xirrPct - b.xirrPct).slice(0, 5),
    funds,
    note: "XIRR is only shown for funds with ₹25,000+ invested; very recent SIP lots give unstable annualised figures.",
  };
}

// ── stocks / ETFs and US stocks ──────────────────────────────────────────────────────────────
function equityReport(list, { fx = 1, label }) {
  const by = new Map();
  for (const s of list || []) {
    const key = `${s.symbol}|${s.owner || "Me"}`;
    const e = by.get(key) || { symbol: s.symbol, name: s.company || s.symbol, owner: s.owner || "Me", kind: s.category || "Stock", qty: 0, invested: 0, value: 0, day: 0, flows: [], priceDate: "" };
    const q = num(s.quantity);
    e.qty += q; e.invested += num(s.invested) * fx; e.value += num(s.currentValue) * fx;
    e.day += q * (num(s.currentPrice) - num(s.prevClose || s.currentPrice)) * fx;
    e.flows.push({ date: s.purchaseDate || s.date, amount: -num(s.invested) * fx });
    if (String(s.priceDate || "") > e.priceDate) e.priceDate = String(s.priceDate || "");
    by.set(key, e);
  }
  const hold = [...by.values()].map((e) => {
    const gain = e.value - e.invested;
    const x = Advisor.xirr(e.flows.filter((f) => f.date), e.value, isoDay(Date.now()));
    return { symbol: e.symbol, name: e.name, owner: e.owner, kind: e.kind, invested: r0(e.invested), value: r0(e.value), gain: r0(gain), gainPct: pct(gain, e.invested), xirrPct: x == null ? null : r1(x), dayChange: r0(e.day), priceDate: e.priceDate };
  }).filter((h) => h.value > 0).sort((a, b) => b.value - a.value);
  const total = sum(hold, (h) => h.value), invested = sum(hold, (h) => h.invested);
  hold.forEach((h) => { h.weightPct = pct(h.value, total); });
  const meaningful = hold.filter((h) => h.invested >= 10000);
  return {
    label, totalValue: r0(total), totalInvested: r0(invested), gain: r0(total - invested), gainPct: pct(total - invested, invested),
    dayChange: r0(sum(hold, (h) => h.dayChange)), top5SharePct: pct(sum(hold.slice(0, 5), (h) => h.value), total),
    gainers: meaningful.slice().sort((a, b) => b.gainPct - a.gainPct).slice(0, 5),
    losers: meaningful.slice().sort((a, b) => a.gainPct - b.gainPct).slice(0, 5),
    todaysMovers: hold.slice().sort((a, b) => Math.abs(b.dayChange) - Math.abs(a.dayChange)).slice(0, 5),
    holdings: hold,
  };
}

const stockReport = (state) => equityReport(state.stocks, { label: "Indian stocks & ETFs" });
const usStockReport = (state, fxOverride) => equityReport(state.usstocks, { fx: usdInr(state, fxOverride), label: "US stocks (₹ at the USD/INR rate)" });

// ── spending and cash flow (salary at month-end pays NEXT month's spending) ───────────────
function salaryForSpendingMonth(state, ym) {
  const prev = addMonths(ym, -1);
  const latest = {};
  for (const i of (state.income || [])) {
    if (monthOf(i.date) !== prev) continue;
    if (i.type && !/salary/i.test(i.type)) continue;
    const who = i.person || "Me";
    if (!latest[who] || i.date > latest[who].date) latest[who] = i;
  }
  const net = Object.values(latest).reduce((s, i) => s + (num(i.netSalary) || num(i.amount)), 0);
  return { creditedIn: prev, net: r0(net), people: Object.keys(latest) };
}

function expenseReport(state, month) {
  const all = state.expenses || [];
  const months = [...new Set(all.map((e) => monthOf(e.date)).filter(Boolean))].sort();
  const latest = month || months[months.length - 1] || isoDay(Date.now()).slice(0, 7);
  const totals = {};
  for (const e of all) totals[monthOf(e.date)] = (totals[monthOf(e.date)] || 0) + num(e.amount);
  const cat = (ym) => { const c = {}; for (const e of all) if (monthOf(e.date) === ym) c[EXP_CAT(e.category)] = (c[EXP_CAT(e.category)] || 0) + num(e.amount); return c; };
  const here = cat(latest);
  const prior = [1, 2, 3, 4, 5, 6].map((n) => addMonths(latest, -n)).filter((m) => totals[m]);
  const avg = {};
  for (const m of prior) for (const [k, v] of Object.entries(cat(m))) avg[k] = (avg[k] || 0) + v / prior.length;
  const categories = Object.keys({ ...here, ...avg }).map((k) => ({
    category: k, thisMonth: r0(here[k] || 0), avg6mo: r0(avg[k] || 0), vsAvgPct: avg[k] ? r1(((here[k] || 0) / avg[k] - 1) * 100) : null,
  })).sort((a, b) => b.thisMonth - a.thisMonth);
  const sal = salaryForSpendingMonth(state, latest);
  const spent = totals[latest] || 0;
  const today = isoDay(Date.now());
  const trend = months.slice(-12).map((m) => ({ month: m, spent: r0(totals[m]), salary: salaryForSpendingMonth(state, m).net, savedPct: salaryForSpendingMonth(state, m).net ? r1((1 - totals[m] / salaryForSpendingMonth(state, m).net) * 100) : null }));
  const bigOnes = all.filter((e) => monthOf(e.date) === latest).sort((a, b) => num(b.amount) - num(a.amount)).slice(0, 5).map((e) => ({ date: e.date, category: EXP_CAT(e.category), amount: r0(num(e.amount)), note: e.note || "" }));
  return {
    month: latest, spent: r0(spent), monthIsComplete: latest < today.slice(0, 7), avg6moSpend: r0(prior.reduce((s, m) => s + totals[m], 0) / (prior.length || 1)),
    salaryThatPaysIt: sal, leftFromSalary: sal.net ? r0(sal.net - spent) : null, savingsRatePct: sal.net ? r1((1 - spent / sal.net) * 100) : null,
    categories, biggestExpenses: bigOnes, trend,
    note: "Salary credited in the last days of month M funds month M+1's spending. A month still in progress will look cheaper than it ends up.",
  };
}

// ── CA-style health check ────────────────────────────────────────────────────────────────────
function healthCheck(state, today, fxOverride) {
  const nw = netWorth(state, fxOverride);
  const t = today || isoDay(Date.now());
  const exp = expenseReport(state, addMonths(t.slice(0, 7), -1));
  const monthly = Protection.monthlySpending(state, t);
  const liquid = nw.classes.bankSaving.value + nw.classes.fd.value;
  const emi = sum(state.liabilities, (l) => l.emi);
  const income = Protection.monthlyIncome(state, "Me") + Protection.monthlyIncome(state, "Wife");
  const flags = [];
  const add = (level, topic, text) => flags.push({ level, topic, text });
  const months = monthly ? liquid / monthly : null;
  // The target is the one set in the Advisor's "About me & my goals" (6 months by default); under half of it is "act"
  const target = num(state.advisor && state.advisor.profile && state.advisor.profile.emergencyMonths) > 0 ? num(state.advisor.profile.emergencyMonths) : 6;
  if (months != null) add(months >= target ? "good" : months >= target / 2 ? "watch" : "act", "Emergency fund", `Bank + FDs cover ${r1(months)} months of spending (your target is ${target}).`);
  if (exp.savingsRatePct != null) add(exp.savingsRatePct >= 30 ? "good" : exp.savingsRatePct >= 15 ? "watch" : "act", "Savings rate", `${exp.savingsRatePct}% of the salary that paid ${exp.month} was left over.`);
  if (income > 0 && emi > 0) add(emi / income <= 0.3 ? "good" : "watch", "Debt load", `EMIs are ${pct(emi, income)}% of monthly take-home.`);
  const eq = nw.classes.mutualFunds.value + nw.classes.stocks.value + nw.classes.usStocks.value;
  add("info", "Equity share", `Direct and fund equity is ${pct(eq, nw.assets)}% of assets; gold ${pct(nw.classes.gold.value + nw.classes.silver.value, nw.assets)}%; EPF/PPF/FD/bonds ${pct(nw.classes.epf.value + nw.classes.ppf.value + nw.classes.fd.value + nw.classes.bonds.value, nw.assets)}%.`);
  const ps = Protection.summary(state, t);
  const rs = (v) => `₹${r0(v).toLocaleString("en-IN")}`;
  const viaEmployer = (c) => c.status === "employer" ? ` Only ${rs(c.ownCover)} is your own; ${rs(c.employerCover)} is employer group cover, which ends with the job.` : "";
  for (const w of ps.term) add(w.status === "ok" ? "good" : w.status === "low" ? "act" : "watch", `Term cover (${w.who})`, w.status === "not-set" ? "Not entered yet." : `${rs(w.cover)} against a ${w.multipleMin === w.multipleMax ? w.multipleMin : `${w.multipleMin}–${w.multipleMax}`}× yearly-income guide of ${rs(w.min)}–${rs(w.max)}.${viaEmployer(w)}`);
  add(ps.health.status === "ok" ? "good" : ps.health.status === "low" ? "act" : "watch", "Health cover", ps.health.status === "not-set" ? "Not entered yet." : `${rs(ps.health.cover)} against a ${rs(ps.health.baseline)} baseline.${viaEmployer(ps.health)}`);
  for (const d of ps.dueSoon) add(d.s.state === "overdue" ? "act" : "watch", "Renewal", `${d.p.policyName || d.p.type} (${d.p.person}) ${d.s.state === "overdue" ? "is overdue" : `is due in ${d.s.days} days`}.`);
  const mfs = mutualFundReport(state, t);
  if (mfs.totalValue) {
    const top = Object.entries(mfs.byKind).sort((a, b) => b[1].value - a[1].value)[0];
    if (top && top[1].sharePct > 40) add("watch", "Fund mix", `${top[0]} is ${top[1].sharePct}% of the mutual-fund money.`);
  }
  return { flags, netWorth: nw.netWorth, liquid: r0(liquid), monthlySpend6mo: r0(monthly), note: "Rules of thumb for discussion with a CA or planner — not tax or investment advice." };
}


// ── is the data itself trustworthy? ──────────────────────────────────────────────────────────
/**
 * Plain checks that catch a corrupted book before any advice is built on it: rows that appear in bulk twice (an out-of-date
 * copy of the app syncing back in) and a day-on-day net-worth jump that markets and the household's own edits cannot explain.
 * When alerts is non-empty the brief must say so first and make no investment calls.
 */
function integrity(state, fxOverride) {
  const alerts = [];
  const names = { mutualFunds: "mutual fund", stocks: "stock", usstocks: "US stock" };
  for (const r of Integrity.duplicateReport(state).filter(Integrity.looksDuplicated)) {
    alerts.push({ level: "critical", topic: "Repeated holdings", text: `${r.rowsInDuplicateGroups} of ${r.rows} ${names[r.coll]} rows are copies of each other. Net worth and every total built on them are inflated. In the app open Data health → "Remove the extra copies", or restore the last good snapshot in Settings → History.` });
  }
  const nw = netWorth(state, fxOverride), ch = nw.changeVsPrevious;
  if (ch && ch.previousNetWorth > 0 && !alerts.length) {      // duplicates already explain a jump; don't add noise on top
    const pct = (Math.abs(ch.delta) / ch.previousNetWorth) * 100;
    const market = Math.abs(ch.marketLikeMoves);
    const explained = Math.abs(ch.delta) - market;           // what is left after market-type moves = edits, repayments, imports
    if (pct >= 6 && market / Math.abs(ch.delta || 1) < 0.5) {
      alerts.push({ level: "critical", topic: "Unexplained jump", text: `Net worth moved ${ch.delta >= 0 ? "+" : "−"}₹${Math.abs(ch.delta).toLocaleString("en-IN")} (${r1(pct)}%) since ${ch.previousDate}, but market-type moves explain only ₹${market.toLocaleString("en-IN")}. Check for repeated rows or a bulk import before trusting any figure.` });
    } else if (pct >= 6) alerts.push({ level: "watch", topic: "Large move", text: `Net worth moved ${r1(pct)}% since ${ch.previousDate}; mostly market movement, but worth a glance.` });
    void explained;
  }
  return { ok: !alerts.some((a) => a.level === "critical"), alerts };
}

// ── freshness: how old are the prices behind these numbers? ─────────────────────────────────
function freshness(state, now = Date.now()) {
  const newest = (list, f) => (list || []).reduce((m, x) => Math.max(m, f(x) || 0), 0);
  const mf = newest(state.mutualFunds, (x) => num(x.navFetchedAt));
  const parse = (s) => { const t = Date.parse(String(s || "").replace(/,/g, "")); return Number.isFinite(t) ? t : 0; };
  const st = newest(state.stocks, (x) => parse(x.priceDate)), us = newest(state.usstocks, (x) => parse(x.priceDate));
  const gold = Date.parse((state.goldPrice && state.goldPrice.lastFetched) || "") || 0;
  const age = (t) => (t ? r1((now - t) / 3600000) : null);
  return { mutualFundsHoursOld: age(mf), stocksHoursOld: age(st), usStocksHoursOld: age(us), goldHoursOld: age(gold), note: "Prices refresh whenever the app is open on any device; hours-old values mean no device has opened it since." };
}

module.exports = { integrity, netWorth, mutualFundReport, stockReport, usStockReport, expenseReport, healthCheck, freshness, salaryForSpendingMonth, fundKind };
