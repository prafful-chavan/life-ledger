#!/usr/bin/env node
/**
 * Loads the brokers' own yearly figures (JSON: a list of lines, see pnl-load.js) into the vault.
 *   node mcp/pnl-load-run.js LINES.json [--write]
 * Without --write it only shows each year beside the app's figure. The vault password comes from the macOS keychain (or the cloud secrets).
 */
const fs = require("fs");
const L = require("./pnl-load.js"), V = require("./vault-client.js"), Common = require("./cloud-common.js");
(async () => {
  const argv = process.argv.slice(2), file = argv.find((a) => !a.startsWith("--")), write = argv.includes("--write");
  if (!file) { console.error("Give the broker lines JSON file."); process.exit(1); }
  const input = JSON.parse(fs.readFileSync(file, "utf8"));
  const login = Common.login(process.env);
  const { data } = await V.fetchState({ gatewayUrl: login.gatewayUrl, password: login.password });
  const out = L.build(data, input);
  if (!out.ok) { console.error("Stopped: " + out.error); process.exit(2); }
  for (const r of out.report.rows) console.log(`${r.kind} ${r.owner} ${r.broker} ${r.fy || "other"}: ${r.status}${r.reported === null ? "" : `, broker ${r.reported}`}${r.app === null ? "" : `, app ${r.app}`}`);
  console.log(`Lines: ${out.report.lines} (in the vault before: ${out.report.previous})`);
  if (!L.guard(data, out.after)) { console.error("Stopped: the change is more than was allowed."); process.exit(2); }
  if (!write) { console.log("Dry run: nothing written. Add --write to save."); return; }
  const res = await V.updateWith({ gatewayUrl: login.gatewayUrl, password: login.password, make: (b) => L.build(b, input).after, guard: L.guard });
  console.log(`Saved to the vault (rev ${res.rev}).`);
})().catch((e) => { console.error(e.message); process.exit(1); });
