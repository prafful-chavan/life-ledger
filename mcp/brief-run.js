#!/usr/bin/env node
/**
 * The morning email, built and sent by one program (no model copying a 60,000-character page into a mail tool).
 *   node mcp/brief-run.js --build                 prints the plain-text brief (the notes writer reads it); sends nothing
 *   node mcp/brief-run.js --send [--notes FILE]   builds it again with the optional notes and emails it
 * Environment (secrets of the cloud routine; on the Mac the keychain and config.json still work for the vault):
 *   LL_VAULT_PASSWORD, LL_GATEWAY_URL      the vault
 *   LL_MAIL_ADDRESS, LL_SMTP_PASSWORD      the household's own Gmail address and a Gmail app password; mail goes to that address only
 *   LL_DIR                                 a writable folder (default ~/.life-ledger-mcp)
 * If the brief cannot be built, a short "could not run" email with the real error is sent instead and the exit code is 2.
 * If the mail login fails the exit code is 3 (the routine then falls back to its mail connector).
 */
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const Mailer = require("./mailer.js");
const BriefRender = require("./brief-render.js");

const EXIT = { ok: 0, usage: 1, build: 2, mail: 3 };
const todayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

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

async function run({ argv, env, log = console.log, err = console.error, buildBrief, sendMail = Mailer.sendMail, today = todayISO(), fs_ = fs }) {
  const send = argv.includes("--send"), build = argv.includes("--build");
  if (send === build) { err("Use exactly one of --build or --send [--notes FILE]"); return EXIT.usage; }
  const to = env.LL_MAIL_ADDRESS;
  const deliver = async (mail) => {
    const message = Mailer.buildMime({ from: to, to, subject: mail.subject, text: mail.text, html: mail.html });
    return sendMail({ user: to, pass: env.LL_SMTP_PASSWORD, to, message });
  };
  if (send && (!to || !Mailer.ADDR.test(to) || !env.LL_SMTP_PASSWORD)) { err("Mail is not set up: LL_MAIL_ADDRESS and LL_SMTP_PASSWORD are needed"); return EXIT.mail; }
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
  try { const r = await deliver(brief); log(`Sent: ${brief.subject} (${Math.round((brief.html || "").length / 1000)}K of HTML) — ${r.accepted}`); return EXIT.ok; }
  catch (e) { err("Could not send the brief: " + e.message); return EXIT.mail; }
}

/** The real builder: the vault through the gateway, then the same renderer the MCP tool uses. */
function realBuilder(env) {
  const dir = env.LL_DIR || path.join(os.homedir(), ".life-ledger-mcp");
  fs.mkdirSync(dir, { recursive: true });
  // A law-watch result lives on the Mac only; without it the cloud email says nothing about the law check rather than "has not run"
  const lawFile = path.join(dir, "law-watch.json");
  if (!process.env.LIFE_LEDGER_LAW_WATCH) process.env.LIFE_LEDGER_LAW_WATCH = lawFile;
  if (env.LL_DIR && !fs.existsSync(lawFile)) fs.writeFileSync(lawFile, JSON.stringify({ checkedOn: todayISO(), changes: [] }));
  const Server = require("./server.js"), { fetchState } = require("./vault-client.js"), Market = require("./market.js"), keychain = require("./keychain.js");
  let gatewayUrl = env.LL_GATEWAY_URL; if (!gatewayUrl) { try { gatewayUrl = JSON.parse(fs.readFileSync(path.join(dir, "config.json"), "utf8")).gatewayUrl; } catch { /* reported below */ } }
  const password = env.LL_VAULT_PASSWORD || keychain.read();
  return async (notes) => {
    if (!gatewayUrl || !password) throw new Error("The vault login is missing (LL_GATEWAY_URL / LL_VAULT_PASSWORD)");
    const loader = async () => {
      const got = await fetchState({ gatewayUrl, password, attempts: 6, waitMs: 2000, cacheFile: path.join(dir, "last-vault.json") });
      Object.defineProperty(got.data, "__source", { value: { fromCache: !!got.fromCache, cachedAt: got.cachedAt || null, reason: got.reason || null, updatedAt: got.updatedAt || null, rev: got.rev || null }, enumerable: false });
      return got.data;
    };
    const ctx = () => ({ taxProfile: {}, history: async (keys) => { const r = await Market.fetchHistory(gatewayUrl, keys); return { series: r.series, failedKeys: r.failedKeys }; } });
    const res = await Server.handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "render_brief", arguments: notes ? { notes } : {} } }, loader, ctx);
    const out = res.result;
    if (!out || out.isError) throw new Error((out && out.content && out.content[0] && out.content[0].text) || "render_brief failed");
    return JSON.parse(out.content[0].text);
  };
}

if (require.main === module) {
  const hard = setTimeout(() => { console.error("Gave up: the brief took more than 8 minutes"); process.exit(EXIT.build); }, 8 * 60 * 1000);
  run({ argv: process.argv.slice(2), env: process.env, buildBrief: realBuilder(process.env) })
    .then((code) => { clearTimeout(hard); process.exit(code); })
    .catch((e) => { console.error(e.message); process.exit(EXIT.build); });
}

module.exports = { run, failureMail, readNotes, EXIT };
