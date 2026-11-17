#!/usr/bin/env node
/**
 * The morning email, built and sent by one program (no model copying a 60,000-character page into a mail tool).
 *   node mcp/brief-run.js --build                 prints the plain-text brief (the notes writer reads it); sends nothing
 *   node mcp/brief-run.js --send [--notes FILE]   builds it again with the optional notes and emails it
 * Environment (secrets of the cloud routine; on the Mac the keychain and config.json still work):
 *   LL_VAULT_PASSWORD, LL_GATEWAY_URL      the vault, and the gateway that also sends the mail (to the household's own address only)
 *   LL_DIR                                 a writable folder (default ~/.life-ledger-mcp)
 * If the brief cannot be built, a short "could not run" email with the real error is sent instead and the exit code is 2.
 * If the mail cannot be sent the exit code is 3 (the routine then falls back to its Gmail connector).
 */
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const Common = require("./cloud-common.js");
const BriefRender = require("./brief-render.js");

const EXIT = { ok: 0, usage: 1, build: 2, mail: 3 };
const todayISO = Common.todayISO;

function failureMail(today, what) {
  const clean = String(what || "unknown").replace(/\s+/g, " ").slice(0, 300);
  const text = `Today's Life Ledger brief (${today}) could not be built, so no numbers are included.\nWhat failed: ${clean}\nNothing was guessed. The next run is tomorrow morning; you can also open the routine "Life Ledger daily brief" and run it.`;
  return { subject: "Life Ledger — brief could not run", text, html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:21px"><p>Today's Life Ledger brief (${today}) could not be built, so no numbers are included.</p><p><b>What failed:</b> ${clean.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</p><p>Nothing was guessed. The next run is tomorrow morning; you can also open the routine "Life Ledger daily brief" and run it.</p></div>` };
}

/** Reads the notes file; anything wrong with it means "no notes", never a failed email. */
function readNotes(file, fs_ = fs) {
  if (!file) return undefined;
  try { const n = JSON.parse(fs_.readFileSync(file, "utf8")); return n && typeof n === "object" && !Array.isArray(n) ? n : undefined; } catch { return undefined; }
}

async function run({ argv, log = console.log, err = console.error, buildBrief, deliver, receipt, today = todayISO(), fs_ = fs }) {
  const send = argv.includes("--send"), build = argv.includes("--build");
  if (send === build) { err("Use exactly one of --build or --send [--notes FILE]"); return EXIT.usage; }
  let brief;
  try {
    const notesFile = argv.includes("--notes") ? argv[argv.indexOf("--notes") + 1] : null;
    brief = await buildBrief(send ? readNotes(notesFile, fs_) : undefined);
    if (!brief || !brief.subject || !brief.text || (brief.kind !== "alert" && !brief.html)) throw new Error("The brief came back incomplete");
    if (brief.html && !BriefRender.intact(brief.html)) throw new Error("The email page was cut short while it was built");
  } catch (e) {
    err("Could not build the brief: " + e.message);
    if (send) { try { await deliver(failureMail(today, e.message)); log("Sent the 'could not run' email."); } catch (e2) { err("And the 'could not run' email failed too: " + e2.message); return EXIT.mail; } }
    return EXIT.build;
  }
  if (build) { log(brief.text); return EXIT.ok; }
  try { const r = await deliver(brief); log(`Sent: ${brief.subject} (${Math.round((brief.html || "").length / 1000)}K of HTML) — ${r.accepted}`); }
  catch (e) { err("Could not send the brief: " + e.message); return EXIT.mail; }
  // The receipt the evening health watch looks for. An alert (data problem) is also a sent email, but not a brief.
  if (receipt) { try { await receipt({ checkedOn: today, status: "sent", kind: brief.kind || "brief", subject: String(brief.subject).slice(0, 120), htmlChars: (brief.html || "").length }); } catch (e) { err("The brief was sent, but its receipt could not be saved: " + e.message); } }
  return EXIT.ok;
}

/** The real builder: the vault through the gateway, then the same renderer the MCP tool uses. */
function realBuilder(env) {
  const call = Common.toolCaller(env);
  return (notes) => call("render_brief", notes ? { notes } : {});
}

if (require.main === module) {
  const hard = setTimeout(() => { console.error("Gave up: the brief took more than 8 minutes"); process.exit(EXIT.build); }, 8 * 60 * 1000);
  run({ argv: process.argv.slice(2), buildBrief: realBuilder(process.env), deliver: Common.deliverer(process.env), receipt: Common.fieldWriter(process.env, "briefRun") })
    .then((code) => { clearTimeout(hard); process.exit(code); })
    .catch((e) => { console.error(e.message); process.exit(EXIT.build); });
}

module.exports = { run, failureMail, readNotes, EXIT };
