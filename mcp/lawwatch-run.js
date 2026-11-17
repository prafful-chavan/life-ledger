#!/usr/bin/env node
/**
 * The monthly tax-law check, saved and mailed by one program (the research is done by the routine's agent).
 *   node mcp/lawwatch-run.js --previous                       prints last month's saved result (so changes are not repeated)
 *   node mcp/lawwatch-run.js --save [--file F] [--report R]    cleans the agent's result, saves it in the vault, mails the report
 * F (default $LL_DIR/law-watch.json): { checkedOn, changes: [{ ruleId, headline, effect, source }] }. R (default $LL_DIR/law-watch-report.md): the written report.
 * The result is saved in the vault field `lawWatch`, which the morning brief and the health watch read. The report is mailed to the household's own address.
 * Exit codes: 0 done, 1 usage, 2 the result is not usable or could not be saved, 3 the report mail failed (the result is still saved).
 */
const fs = require("node:fs"), path = require("node:path");
const Common = require("./cloud-common.js"), LawWatch = require("./lawwatch.js");
const EXIT = { ok: 0, usage: 1, bad: 2, mail: 3 };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

/** The report email: the written report, with the changes (if any) listed first. */
function reportMail(record, reportText) {
  const [y, m] = record.checkedOn.split("-"), month = `${MONTHS[+m - 1]} ${y}`;
  const lines = record.changes.length ? record.changes.map((c) => `• ${c.headline}${c.effect ? ` — ${c.effect}` : ""}${c.source ? ` (${c.source})` : ""}`) : ["No change to any rule the system relies on."];
  const body = String(reportText || "").trim();
  const text = `LIFE LEDGER — TAX-LAW WATCH, ${month.toUpperCase()}\n${lines.join("\n")}${body ? `\n\n${body}` : ""}\n\nInformation only, not licensed tax advice. A CA should confirm before any rule or return is changed.`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:21px;max-width:640px"><h2 style="font-size:18px">Tax-law watch — ${esc(month)}</h2>${record.changes.length ? "<ul>" + record.changes.map((c) => `<li><b>${esc(c.headline)}</b>${c.effect ? ` — ${esc(c.effect)}` : ""}${c.source ? ` <a href="${esc(c.source)}">source</a>` : ""}</li>`).join("") + "</ul>" : "<p>No change to any rule the system relies on.</p>"}${body ? `<pre style="white-space:pre-wrap;font-family:inherit;font-size:13px">${esc(body)}</pre>` : ""}<p style="color:#5b6573;font-size:12px">Information only, not licensed tax advice. A CA should confirm before any rule or return is changed.</p></div>`;
  return { subject: `Life Ledger — tax-law watch, ${month}`, text, html };
}

async function run({ argv, env = {}, log = console.log, err = console.error, fs_ = fs, previous, save, deliver }) {
  const dir = env.LL_DIR || ".";
  const arg = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
  if (argv.includes("--previous")) { try { log(JSON.stringify((await previous()) || null)); return EXIT.ok; } catch (e) { err("Could not read last month's result: " + e.message); return EXIT.bad; } }
  if (!argv.includes("--save")) { err("Use --previous or --save [--file F] [--report R]"); return EXIT.usage; }
  let record;
  try { record = LawWatch.cleanRecord(JSON.parse(fs_.readFileSync(arg("--file", path.join(dir, "law-watch.json")), "utf8"))); }
  catch (e) { err("The law-watch result is not usable: " + e.message); return EXIT.bad; }
  try { await save(record); log(`Saved to the vault: checked ${record.checkedOn}, ${record.changes.length} change${record.changes.length === 1 ? "" : "s"}.`); }
  catch (e) { err("Could not save the result: " + e.message); return EXIT.bad; }
  let report = ""; try { report = fs_.readFileSync(arg("--report", path.join(dir, "law-watch-report.md")), "utf8"); } catch { /* the changes alone are enough */ }
  try { const d = await deliver(reportMail(record, report)); log(`Report mailed — ${d.accepted}`); return EXIT.ok; }
  catch (e) { err("The result is saved, but the report could not be mailed: " + e.message); return EXIT.mail; }
}

if (require.main === module) {
  const stop = Common.hardStop(5, EXIT.bad);
  const call = Common.toolCaller(process.env);
  run({ argv: process.argv.slice(2), env: process.env, previous: async () => (await call("law_watch")).previous, save: Common.fieldWriter(process.env, "lawWatch"), deliver: Common.deliverer(process.env) })
    .then((c) => { stop(); process.exit(c); }).catch((e) => { console.error(e.message); process.exit(EXIT.bad); });
}

module.exports = { run, reportMail, EXIT };
