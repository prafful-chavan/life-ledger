#!/usr/bin/env node
/**
 * Life Ledger MCP server (stdio, read-only, no dependencies).
 * Each tool call pulls the latest encrypted vault from the sync gateway, decrypts it in memory and answers from it.
 * Nothing is cached on disk. The password comes from the macOS Keychain (see setup.js).
 */
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const A = require("./analysis.js");
const Protection = require("../protection-core.js");
const { fetchState } = require("./vault-client.js");
const keychain = require("./keychain.js");

const todayISO = () => new Date().toISOString().slice(0, 10);

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

function goalsView(state) {
  return (state.goals || []).map((g) => ({ name: g.name, category: g.category, owner: g.owner, target: g.target, saved: g.saved, progressPct: g.target ? Math.round((g.saved / g.target) * 1000) / 10 : null, dueDate: g.dueDate, tracks: g.track || null }));
}

function liabilitiesView(state) {
  return (state.liabilities || []).map((l) => ({ name: l.name, category: l.category, outstanding: l.value, emi: l.emi, ratePct: l.rate }));
}

function brief(state, a = {}) {
  const today = todayISO();
  return {
    asOf: today, dataFreshness: A.freshness(state), netWorth: A.netWorth(state, a.usdInr), healthCheck: A.healthCheck(state, today, a.usdInr),
    expenses: A.expenseReport(state, a.month), mutualFunds: A.mutualFundReport(state, today), stocks: A.stockReport(state),
    usStocks: A.usStockReport(state, a.usdInr), goals: goalsView(state), liabilities: liabilitiesView(state), protection: protectionView(state, today),
  };
}

const TOOLS = [
  { name: "household_brief", description: "Everything in one call: net worth, health check, last month's spending, mutual funds, stocks, US stocks, goals, debts, protection and price freshness. Start here.", inputSchema: { type: "object", properties: { month: { type: "string", description: "Spending month YYYY-MM (default latest)" }, usdInr: { type: "number" } } }, run: (s, a) => brief(s, a) },
  { name: "net_worth", description: "Net worth by asset class with shares and the last 30 history points.", inputSchema: { type: "object", properties: { usdInr: { type: "number" } } }, run: (s, a) => A.netWorth(s, a.usdInr) },
  { name: "mutual_funds", description: "Every fund with invested, value, gain %, XIRR and day change; best/worst; category mix.", inputSchema: { type: "object", properties: {} }, run: (s) => A.mutualFundReport(s, todayISO()) },
  { name: "stocks", description: "Indian stocks and ETFs: holdings, weights, gain %, XIRR, gainers, losers, today's movers.", inputSchema: { type: "object", properties: {} }, run: (s) => A.stockReport(s) },
  { name: "us_stocks", description: "US stocks converted to rupees at the USD/INR rate.", inputSchema: { type: "object", properties: { usdInr: { type: "number" } } }, run: (s, a) => A.usStockReport(s, a.usdInr) },
  { name: "expenses", description: "A month's spending by category vs the 6-month average, biggest items, trend and savings rate. The salary credited in the PREVIOUS month funds it.", inputSchema: { type: "object", properties: { month: { type: "string" } } }, run: (s, a) => A.expenseReport(s, a.month) },
  { name: "health_check", description: "CA-style flags: emergency fund, savings rate, debt load, mix, insurance cover, renewals.", inputSchema: { type: "object", properties: {} }, run: (s) => A.healthCheck(s, todayISO()) },
  { name: "protection", description: "Insurance, vehicles, cover checks and ages (no birth dates, nominees or policy numbers).", inputSchema: { type: "object", properties: {} }, run: (s) => protectionView(s, todayISO()) },
  { name: "goals", description: "Goals with progress.", inputSchema: { type: "object", properties: {} }, run: (s) => goalsView(s) },
  { name: "data_freshness", description: "How many hours old each price source is.", inputSchema: { type: "object", properties: {} }, run: (s) => A.freshness(s) },
];

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(path.join(os.homedir(), ".life-ledger-mcp", "config.json"), "utf8")); } catch { return {}; }
}

async function defaultLoader() {
  const { gatewayUrl } = loadConfig();
  const password = keychain.read();
  if (!gatewayUrl || !password) throw new Error("Not set up yet — run: node mcp/setup.js");
  return (await fetchState({ gatewayUrl, password })).data;
}

/** Handles one JSON-RPC message; returns the response object, or null for notifications. */
async function handle(msg, loader = defaultLoader) {
  const reply = (result) => ({ jsonrpc: "2.0", id: msg.id, result });
  const fail = (code, message) => ({ jsonrpc: "2.0", id: msg.id, error: { code, message } });
  if (msg.id === undefined) return null;
  switch (msg.method) {
    case "initialize": return reply({ protocolVersion: (msg.params && msg.params.protocolVersion) || "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "life-ledger", version: "1.0.0" } });
    case "ping": return reply({});
    case "tools/list": return reply({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === (msg.params || {}).name);
      if (!tool) return fail(-32602, "Unknown tool");
      try {
        const state = await loader();
        return reply({ content: [{ type: "text", text: JSON.stringify(tool.run(state, (msg.params || {}).arguments || {}), null, 1) }] });
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

module.exports = { handle, brief, protectionView, TOOLS };
