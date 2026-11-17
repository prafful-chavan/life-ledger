#!/usr/bin/env node
/**
 * The evening health watch, run by one program: checks the things that fail quietly and mails the household only when
 * something needs a look (plus an all-good note on Sundays). No model copies anything.
 *   node mcp/health-run.js [--force]      --force sends the report even when all is well
 * Environment: LL_VAULT_PASSWORD, LL_GATEWAY_URL (the gateway also mails, to the household's own address only), LL_DIR.
 * Exit codes: 0 done (sent or nothing to send), 2 the check could not run (a "could not run" email is sent), 3 mail failed.
 */
const Common = require("./cloud-common.js");
const BriefRender = require("./brief-render.js");
const EXIT = { ok: 0, build: 2, mail: 3 };

async function run({ argv, log = console.log, err = console.error, check, deliver, today = Common.todayISO() }) {
  let r;
  try {
    r = await check({ force: argv.includes("--force") });
    if (!r || typeof r.send !== "boolean" || !r.subject || !r.text) throw new Error("The health check came back incomplete");
    if (r.send && (!r.html || !BriefRender.intact(r.html))) throw new Error("The report page was cut short while it was built");
  } catch (e) {
    err("Could not run the health watch: " + e.message);
    try { await deliver(Common.failureMail("health watch", today, e.message)); log("Sent the 'could not run' email."); } catch (e2) { err("And the 'could not run' email failed too: " + e2.message); return EXIT.mail; }
    return EXIT.build;
  }
  if (!r.send) { log("All healthy, nothing sent."); return EXIT.ok; }
  try { const d = await deliver({ subject: r.subject, text: r.text, html: r.html }); log(`Sent: ${r.subject} — ${d.accepted}`); return EXIT.ok; }
  catch (e) { err("Could not send the health report: " + e.message); return EXIT.mail; }
}

if (require.main === module) {
  const stop = Common.hardStop(6, EXIT.build);
  const call = Common.toolCaller(process.env);
  run({ argv: process.argv.slice(2), check: (a) => call("health_watch", a), deliver: Common.deliverer(process.env) })
    .then((code) => { stop(); process.exit(code); }).catch((e) => { console.error(e.message); process.exit(EXIT.build); });
}

module.exports = { run, EXIT };
