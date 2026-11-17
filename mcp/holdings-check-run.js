#!/usr/bin/env node
/**
 * Weekly holdings check: compares the vault's holdings with INDmoney and saves the summary.
 *   node mcp/holdings-check-run.js [--dry-run]
 * Reads ~/.life-ledger-mcp/indmoney-holdings.json (written just before by the scheduled task from INDmoney's lists),
 * writes ~/.life-ledger-mcp/holdings-check.json, and (unless --dry-run) saves the summary into the vault field
 * `holdingsCheck`, which the app's Data Health shows. The vault password comes from the routine's secrets, or the macOS keychain on the Mac.
 */
const fs = require("fs"), os = require("os"), path = require("path");
const V = require("./vault-client.js"), Common = require("./cloud-common.js"), { compare } = require("./holdings-check.js");

// On the Mac: ~/.life-ledger-mcp and the keychain. In the cloud routine: LL_DIR, LL_GATEWAY_URL and LL_VAULT_PASSWORD.
const LOGIN = Common.login(process.env), DIR = LOGIN.dir;
const REF = path.join(DIR, "indmoney-holdings.json"), OUT = path.join(DIR, "holdings-check.json");
// Holdings the household chose not to track (tiny default buys in broker apps that are not used)
const IGNORE = [{ who: "Wife", name: "CPSE ETF", why: "2 units at 5paisa, an unused broker app" }];

(async () => {
  const cfg = { gatewayUrl: LOGIN.gatewayUrl };
  if (!cfg.gatewayUrl || !LOGIN.password) throw new Error("The vault login is missing (LL_GATEWAY_URL / LL_VAULT_PASSWORD)");
  const ref = JSON.parse(fs.readFileSync(REF, "utf8"));
  let prev = null; try { prev = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch { /* first run */ }
  const password = LOGIN.password;
  const { data } = await V.fetchState({ gatewayUrl: cfg.gatewayUrl, password });
  // A cloud run starts with no files: last week's result comes from the vault copy of it (so a gap seen twice is still "confirmed")
  if (!prev && data.holdingsCheck && typeof data.holdingsCheck === "object" && !Array.isArray(data.holdingsCheck)) prev = data.holdingsCheck;
  const fx = Number(data.fx && data.fx.usdInr) || 0;
  const today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
  const result = compare(data, ref, { today, usdInr: fx, prev, ignore: IGNORE });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
  console.log(`${result.status}: ${result.matched} of ${result.total} holdings match INDmoney${result.ignored ? ` (${result.ignored} ignored)` : ""}`);
  for (const g of result.gaps) console.log(`  ${g.confirmed ? "CONFIRMED" : "new"} ${g.who} ${g.cls} ${g.name}: app ${g.app}, INDmoney ${g.ref} (${g.kind})`);
  for (const p of result.problems) console.log(`  reference problem: ${p}`);
  if (process.argv.includes("--dry-run")) return;
  if (result.status === "bad-reference") { console.log("Not saved: the INDmoney copy did not add up."); process.exitCode = 1; return; }
  const r = await V.updateField({ gatewayUrl: cfg.gatewayUrl, password, field: "holdingsCheck", value: result });
  console.log(`Saved to the vault (rev ${r.rev}).`);
})().catch((e) => { console.error(e.message); process.exit(1); });
