#!/usr/bin/env node
/**
 * Life Ledger MCP server (stdio, read-only, no dependencies).
 * Each tool call pulls the latest encrypted vault from the sync gateway, decrypts it in memory and answers from it.
 * Nothing about the vault is cached on disk. The password comes from the macOS Keychain (see setup.js).
 * Public price history (no holdings or amounts) is fetched through the same Apps Script proxy the app uses.
 */
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const A = require("./analysis.js");
const Tax = require("./tax.js");
const Holdings = require("./holdings.js");
const Fit = require("./fitness.js");
const Cal = require("./calendar.js");
const LawWatch = require("./lawwatch.js");
const { taxPlan } = require("./taxplan.js");
const TaxCore = require("../tax-core.js");
const Market = require("./market.js");
const Protection = require("../protection-core.js");
const { fetchState } = require("./vault-client.js");
const keychain = require("./keychain.js");

const todayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const dir = path.join(os.homedir(), ".life-ledger-mcp");

/** Never leaves the machine: nominees, notes, policy identifiers and dates of birth are dropped. Ages only. */
function protectionView(state, today) {
  const ps = Protection.summary(state, today);
  const people = Object.entries(state.people || {}).map(([k, p]) => ({ who: k === "me" ? "Prafful" : "Archana", age: Protection.ageOn(p.dob, today), nextBirthdayInDays: (Protection.nextBirthday(p.dob, today) || {}).days }));
  return {
    people,
    policies: (state.insurance || []).map((p) => ({ person: p.person, type: p.type, insurer: p.insurer, cover: p.cover, annualPremium: Math.round(Protection.annualPremium(p)), nextDue: p.nextDue, status: Protection.dueStatus(p.nextDue, today).state })),
    vehicles: (state.vehicles || []).map((v) => ({ name: v.name, value: v.value })),
    covers: { term: ps.term, health: ps.health }, yearlyPremium: Math.round(ps.yearlyPremium),
  };
}

/** Goals that follow holdings use the live figure, exactly like the app (owner "Both" = the whole household). */
function trackedSaved(state, g) {
  const owner = g.owner || "Both";
  const mine = (list) => (owner === "Both" ? list || [] : (list || []).filter((x) => (x.owner || "Me") === owner));
  const sum = (list, f) => (list || []).reduce((s, x) => s + (Number(f(x)) || 0), 0);
  switch (g.track) {
    case "Mutual funds": return sum(mine(state.mutualFunds), (x) => (x.transactionType === "REDEMPTION" ? -1 : 1) * x.currentValue);
    case "Stocks & ETFs": return sum(mine(state.stocks), (x) => x.currentValue);
    case "Gold": return sum(mine(state.gold), (x) => x.value);
    case "All my assets": return A.netWorth(state).assets;
    default: return null;
  }
}

function goalsView(state) {
  return (state.goals || []).map((g) => {
    const live = trackedSaved(state, g);
    const saved = live == null ? g.saved : Math.round(live);
    return { name: g.name, category: g.category, owner: g.owner, target: g.target, saved, progressPct: g.target ? Math.round((saved / g.target) * 1000) / 10 : null, dueDate: g.dueDate, followsHoldings: live != null ? g.track : null };
  });
}

const liabilitiesView = (state) => (state.liabilities || []).map((l) => ({ name: l.name, category: l.category, outstanding: l.value, emi: l.emi, ratePct: l.rate }));

function brief(state, a = {}) {
  const today = todayISO();
  return {
    asOf: today, integrity: A.integrity(state, a.usdInr), dataFreshness: A.freshness(state), netWorth: A.netWorth(state, a.usdInr), healthCheck: A.healthCheck(state, today, a.usdInr),
    expenses: A.expenseReport(state, a.month), mutualFunds: A.mutualFundReport(state, today), stocks: A.stockReport(state),
    usStocks: A.usStockReport(state, a.usdInr), goals: goalsView(state), liabilities: liabilitiesView(state), protection: protectionView(state, today),
  };
}

// ── tax ──────────────────────────────────────────────────────────────────────────────────────
const WHO = { Me: "Prafful", Wife: "Archana" };

function taxReport(state, ctx, today) {
  const fx = A.netWorth(state, ctx.usdInr).fxUsdInr || 1;
  const { lots, realised } = Tax.buildLots(state, fx);
  const un = Tax.unrealised(lots, today);
  const re = Tax.realisedThisFY(realised, today);
  const owners = ["Me", "Wife"];
  // Income tax comes from the same household model as the app's Tax page (salary records, the vault's tax profile, both regimes).
  const M = TaxCore.household.build(state, today);
  const incomeTax = M.people.map((p) => !p.plan ? { who: p.who, error: p.note || "No salary record for this year" } : {
    who: p.who, employer: p.salary.employer, basedOn: p.salary.basedOn, monthsPaid: p.salary.months, missingMonths: p.salary.missingMonths,
    annualGross: p.salary.gross, projectedTDS: p.plan.tdsProjected,
    newRegime: { taxable: p.plan.regimes.new.taxable, tax: p.plan.regimes.new.tax },
    oldRegime: { taxable: p.plan.regimes.old.taxable, tax: p.plan.regimes.old.tax, hraExempt: p.plan.regimes.old.hraExempt, deductions: p.plan.regimes.old.deductions },
    lowerTaxRegime: p.plan.better, regimeUsed: p.plan.better, estimatedYearlyTax: p.plan.regimes[p.plan.better].tax, marginalSlabRatePct: p.plan.marginalRatePct,
    tdsVsTax: p.plan.balance, tdsVsTaxNote: p.plan.balance >= 0 ? "Projected TDS covers the tax; the difference comes back as a refund" : "Projected TDS falls short; advance tax or more TDS is needed",
    advanceTax: p.plan.advanceTax.filter((a) => a.date >= today),
  });
  const exemption = Tax.RULES.equity.yearlyExemption;
  const perOwner = {};
  for (const o of owners) {
    const u = un.owners[o] || {}, r = re.owners[o] || {};
    const used = Math.max(0, r.equityLT || 0), left = Math.max(0, exemption - used);
    const ltCandidates = {};
    for (const l of un.perLot) if (l.owner === o && l.long && l.gain > 0 && (l.cat === "equity" || l.cat === "hybrid")) ltCandidates[l.name] = (ltCandidates[l.name] || 0) + l.gain;
    const lossLots = {};
    for (const l of un.perLot) if (l.owner === o && l.gain < 0 && (l.cat === "equity" || l.cat === "hybrid")) { const e = (lossLots[l.name] ||= { loss: 0, term: l.termUnknown ? "unknown (buy date missing)" : l.long ? "long" : "short" }); e.loss += l.gain; }
    perOwner[WHO[o]] = {
      unrealised: Object.fromEntries(Object.entries(u).map(([k, v]) => [k, Math.round(v)])),
      realisedThisFY: Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v)])),
      equityLongTermExemption: { yearly: exemption, usedThisFY: Math.round(used), left: Math.round(left) },
      canBookTaxFreeToday: Math.round(Math.min(left, Math.max(0, u.equityLT || 0))),
      longTermGainCandidates: Object.entries(ltCandidates).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, gain]) => ({ name, longTermGain: Math.round(gain) })),
      lossesAvailableToHarvest: Object.entries(lossLots).sort((a, b) => a[1].loss - b[1].loss).slice(0, 6).map(([name, v]) => ({ name, loss: Math.round(v.loss), term: v.term })),
    };
  }
  const slab = { Me: (incomeTax[0] || {}).marginalSlabRatePct, Wife: (incomeTax[1] || {}).marginalSlabRatePct };
  return {
    asOf: today, financialYear: re.fy, rules: Tax.RULES.asOf, perPerson: perOwner, realisedTransactionsThisFY: re.rows,
    incomeTax: incomeTax.map((e) => ({ person: WHO[e.who], ...e, who: undefined })), slabRateUsed: { Prafful: slab.Me, Archana: slab.Wife },
    needFromYou: M.actions.filter((a) => a.severity !== "high").slice(0, 6).map((a) => ({ what: a.title, why: a.why })),
    dataGaps: [
      ...(lots.some((l) => l.kind === "stock" && l.dateKnown === false) ? [{ what: "Real buy dates for your Indian stocks and ETFs", why: "Every stock row in the vault carries the sheet's import date, so short-term vs long-term cannot be told. Tax on those holdings is shown as a range (all long-term vs all short-term). A broker 'tax P&L' or holdings statement with first-buy dates fixes this." }] : []),
      ...(lots.some((l) => l.kind === "us" && l.dateKnown === false) ? [{ what: "Real buy dates for US stocks", why: "Same issue; foreign shares need 24 months to be long-term." }] : []),
    ],
    caveats: [
      "Estimates only. Salary figures are the latest payslip × 12; real tax depends on exact payslips, proofs and Form 26AS/AIS.",
      "Hybrid, overseas, gold fund-of-fund and debt funds follow different holding periods; they are flagged in each lot's category and a CA should confirm them.",
      "Selling to book gains or losses also costs exit loads, STT and charges, and changes your SIP/rebalancing picture. A planning idea is not an instruction.",
    ],
  };
}

// ── market-backed tables ──────────────────────────────────────────────────────────────────────
async function tableFor(state, kind, ctx, today, limit) {
  const keys = Holdings.historyKeys(state);
  const { series, failedKeys } = await ctx.history(keys);
  const fx = A.netWorth(state, ctx.usdInr).fxUsdInr || 1;
  const { lots } = Tax.buildLots(state, fx);
  const profile = ctx.taxProfile || {};
  const M = TaxCore.household.build(state, today);
  const slabOf = {}, exLeft = {};
  for (const p of M.people) if (p.plan) { slabOf[p.who] = p.plan.marginalRatePct; exLeft[p.who] = p.exemptionLeft; }
  const t = Holdings.holdingsTable(state, kind, { today, fx, series, lots, slabRate: slabOf, exemptionLeft: exLeft, profile, taxRows: M.taxIfSold });
  if (limit && t.rows.length > limit) { t.omitted = t.rows.length - limit; t.omittedValue = t.rows.slice(limit).reduce((s, r) => s + r.value, 0); t.rows = t.rows.slice(0, limit); }
  t.historyUnavailableFor = failedKeys.length;
  return t;
}

const TOOLS = [
  { name: "household_brief", description: "Net worth, health check, last month's spending, funds, stocks, US stocks, goals, debts, protection, price freshness. A quick overview.", inputSchema: { type: "object", properties: { month: { type: "string", description: "Spending month YYYY-MM (default latest)" }, usdInr: { type: "number" } } }, run: async (s, a) => brief(s, a) },
  { name: "daily_pack", description: "EVERYTHING for the morning email in one call: brief, per-holding tables with technicals and exit levels for funds, stocks and US stocks, tax position, fitness, milestones, calendar and SIP progress. Fetches public price history, so allow ~20s.", inputSchema: { type: "object", properties: { rowsPerTable: { type: "number" } } }, run: async (s, a, ctx) => {
    const today = todayISO(), limit = a.rowsPerTable || 14, nw = A.netWorth(s, ctx.usdInr);
    return {
      brief: brief(s, a), funds: await tableFor(s, "funds", ctx, today, limit), stocks: await tableFor(s, "stocks", ctx, today, limit), usStocks: await tableFor(s, "us", ctx, today, 8),
      tax: taxReport(s, ctx, today), fitness: Fit.fitnessReport(s, today), milestones: Fit.milestones(nw.netWorth, nw.history), calendar: Cal.calendar(s, today), sipThisMonth: Cal.sipProgress(s, today), lawWatch: LawWatch.lawWatch(today), taxPlan: taxPlan(s, today), holdingsCheck: s.holdingsCheck || null,
    };
  } },
  { name: "holdings_table", description: "One row per holding with value, return, XIRR, trend, RSI, 50/200-day averages, the app's verdict, review-below / first-target / stretch levels with the holding's value at each, and an estimate of tax if sold today. kind = funds | stocks | us.", inputSchema: { type: "object", properties: { kind: { type: "string", enum: ["funds", "stocks", "us"] }, limit: { type: "number" } }, required: ["kind"] }, run: async (s, a, ctx) => tableFor(s, a.kind, ctx, todayISO(), a.limit) },
  { name: "tax_report", description: "Capital gains by lot (FIFO), tax if sold today, this year's realised gains and ₹1.25L exemption left per person, harvesting ideas, an old-vs-new regime income-tax estimate, and the list of facts a CA would still need from you.", inputSchema: { type: "object", properties: {} }, run: async (s, a, ctx) => taxReport(s, ctx, todayISO()) },
  { name: "fitness", description: "Body measurements and trend, workouts, steps, cycling vs goals, habit streaks (no names), plus net-worth milestone pace and this month's SIP progress.", inputSchema: { type: "object", properties: {} }, run: async (s, a, ctx) => { const today = todayISO(), nw = A.netWorth(s, ctx.usdInr); return { fitness: Fit.fitnessReport(s, today), milestones: Fit.milestones(nw.netWorth, nw.history), sipThisMonth: Cal.sipProgress(s, today) }; } },
  { name: "tax_plan", description: "The household tax plan for this financial year: projected tax under both regimes per person, TDS vs tax, long-term-gain exemption left, ranked actions, dates, filed returns checked against their documents and what correcting each costs. Same engine as the app's Tax page.", inputSchema: { type: "object", properties: {} }, run: async (s) => taxPlan(s, todayISO()) },
  { name: "calendar", description: "Upcoming birthdays, renewals, tax dates and the salary day (next 75 days).", inputSchema: { type: "object", properties: {} }, run: async (s) => Cal.calendar(s, todayISO()) },
  { name: "net_worth", description: "Net worth by asset class with shares and the last 30 history points.", inputSchema: { type: "object", properties: { usdInr: { type: "number" } } }, run: async (s, a) => A.netWorth(s, a.usdInr) },
  { name: "mutual_funds", description: "Fund-level summary: invested, value, gain %, XIRR, day change; best/worst; category mix.", inputSchema: { type: "object", properties: {} }, run: async (s) => A.mutualFundReport(s, todayISO()) },
  { name: "stocks", description: "Indian stocks and ETFs summary: gainers, losers, today's movers.", inputSchema: { type: "object", properties: {} }, run: async (s) => A.stockReport(s) },
  { name: "us_stocks", description: "US stocks converted to rupees at the USD/INR rate.", inputSchema: { type: "object", properties: { usdInr: { type: "number" } } }, run: async (s, a) => A.usStockReport(s, a.usdInr) },
  { name: "expenses", description: "A month's spending by category vs the 6-month average, biggest items, trend and savings rate. The salary credited in the PREVIOUS month funds it.", inputSchema: { type: "object", properties: { month: { type: "string" } } }, run: async (s, a) => A.expenseReport(s, a.month) },
  { name: "health_check", description: "CA-style flags: emergency fund, savings rate, debt load, mix, insurance cover, renewals.", inputSchema: { type: "object", properties: {} }, run: async (s) => A.healthCheck(s, todayISO()) },
  { name: "protection", description: "Insurance, vehicles, cover checks and ages (no birth dates, nominees or policy numbers).", inputSchema: { type: "object", properties: {} }, run: async (s) => protectionView(s, todayISO()) },
  { name: "goals", description: "Goals with progress; goals that follow holdings use live values.", inputSchema: { type: "object", properties: {} }, run: async (s) => goalsView(s) },
  { name: "data_freshness", description: "How many hours old each price source is.", inputSchema: { type: "object", properties: {} }, run: async (s) => A.freshness(s) },
];

function loadJson(file) { try { return JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")); } catch { return {}; } }

let historyCache = { at: 0, keys: "", value: null };
function defaultContext() {
  const { gatewayUrl } = loadJson("config.json");
  return {
    taxProfile: loadJson("tax-profile.json"),
    history: async (keys) => {
      const id = keys.slice().sort().join(",");
      if (historyCache.value && historyCache.keys === id && Date.now() - historyCache.at < 30 * 60 * 1000) return historyCache.value;
      const r = await Market.fetchHistory(gatewayUrl, keys);
      const value = { series: r.series, failedKeys: r.failedKeys };
      historyCache = { at: Date.now(), keys: id, value };
      return value;
    },
  };
}

async function defaultLoader() {
  const { gatewayUrl } = loadJson("config.json");
  const password = keychain.read();
  if (!gatewayUrl || !password) throw new Error("Not set up yet — run: node mcp/setup.js");
  return (await fetchState({ gatewayUrl, password })).data;
}

/** Handles one JSON-RPC message; returns the response object, or null for notifications. */
async function handle(msg, loader = defaultLoader, ctxFactory = defaultContext) {
  const reply = (result) => ({ jsonrpc: "2.0", id: msg.id, result });
  const fail = (code, message) => ({ jsonrpc: "2.0", id: msg.id, error: { code, message } });
  if (msg.id === undefined) return null;
  switch (msg.method) {
    case "initialize": return reply({ protocolVersion: (msg.params && msg.params.protocolVersion) || "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "life-ledger", version: "2.0.0" } });
    case "ping": return reply({});
    case "tools/list": return reply({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === (msg.params || {}).name);
      if (!tool) return fail(-32602, "Unknown tool");
      try {
        const state = await loader();
        const out = await tool.run(state, (msg.params || {}).arguments || {}, ctxFactory());
        return reply({ content: [{ type: "text", text: JSON.stringify(out) }] });
      } catch (e) {
        return reply({ isError: true, content: [{ type: "text", text: "Life Ledger: " + e.message }] });
      }
    }
    default: return fail(-32601, "Method not found");
  }
}

if (require.main === module) {
  let buf = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      handle(msg).then((r) => { if (r) process.stdout.write(JSON.stringify(r) + "\n"); });
    }
  });
}

module.exports = { handle, brief, protectionView, taxReport, tableFor, TOOLS };
