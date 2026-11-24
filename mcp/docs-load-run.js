#!/usr/bin/env node
/**
 * Loads the Document Register (as JSON: { rows, collect }) into the vault (see docs-load.js).
 *   node mcp/docs-load-run.js REGISTER.json [--write]
 * Without --write it only shows what would happen. The vault password comes from the macOS keychain (or the cloud secrets).
 */
const fs = require("fs");
const L = require("./docs-load.js"), V = require("./vault-client.js"), Common = require("./cloud-common.js");
(async () => {
  const argv = process.argv.slice(2), file = argv.find((a) => !a.startsWith("--")), write = argv.includes("--write");
  if (!file) { console.error("Give the register JSON file."); process.exit(1); }
  const input = JSON.parse(fs.readFileSync(file, "utf8"));
  const login = Common.login(process.env);
  const { data } = await V.fetchState({ gatewayUrl: login.gatewayUrl, password: login.password });
  const out = L.build(data, input);
  if (!out.ok) { console.error("Stopped: " + out.error); process.exit(2); }
  const r = out.report;
  console.log(`Register rows read: ${r.read} (${r.dropped} without a name dropped, ${r.duplicatesMerged} duplicates merged)`);
  console.log(`Papers to keep: ${r.papers} — ${r.linked} with a Drive link, ${r.locked} locked, ${r.setAside} set aside. Was in the vault before: ${r.previous}`);
  console.log(`Still to collect: ${r.collect} items. Size added to the vault: about ${Math.round(r.bytes / 1024)} KB (before compression).`);
  if (r.nameHasIdNumber) console.log(`Note: ${r.nameHasIdNumber} file names contain something that looks like a PAN or 12-digit number (they stay in your encrypted vault only).`);
  if (!L.guard(data, out.after)) { console.error("Stopped: the change is more than was allowed."); process.exit(2); }
  if (!write) { console.log("Dry run: nothing written. Add --write to save."); return; }
  const res = await V.updateWith({ gatewayUrl: login.gatewayUrl, password: login.password, make: (b) => L.build(b, input).after, guard: L.guard });
  console.log(`Saved to the vault (rev ${res.rev}).`);
})().catch((e) => { console.error(e.message); process.exit(1); });
