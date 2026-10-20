/**
 * Life Ledger MCP — reads the monthly "law watch" result (pure aside from the file read).
 * A scheduled task searches for tax-law changes and writes ~/.life-ledger-mcp/law-watch.json:
 *   { checkedOn: "YYYY-MM-DD", changes: [{ ruleId, headline, effect, source }] }
 * The daily brief shows one line when there is a change, or when the watch has not run for too long.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const FILE = process.env.LIFE_LEDGER_LAW_WATCH || path.join(os.homedir(), ".life-ledger-mcp", "law-watch.json");
const clean = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);
const daysBetween = (a, b) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 864e5);

/** Returns { checkedOn, ageDays, stale, changes } — never throws; a missing/invalid file means "never checked". */
function lawWatch(today, file = FILE, staleAfterDays = 45) {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, "utf8")); } catch { return { checkedOn: null, ageDays: null, stale: true, changes: [], note: "The monthly law check has not run yet." }; }
  const checkedOn = /^\d{4}-\d{2}-\d{2}$/.test(raw && raw.checkedOn) ? raw.checkedOn : null;
  const changes = (Array.isArray(raw && raw.changes) ? raw.changes : []).slice(0, 10).map((c) => ({ ruleId: clean(c.ruleId, 40), headline: clean(c.headline, 160), effect: clean(c.effect, 240), source: /^https?:\/\//.test(c.source) ? clean(c.source, 200) : "" })).filter((c) => c.headline);
  const ageDays = checkedOn ? daysBetween(checkedOn, today) : null;
  return { checkedOn, ageDays, stale: ageDays == null || ageDays > staleAfterDays, changes };
}

module.exports = { lawWatch, FILE };
