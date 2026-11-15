#!/usr/bin/env node
/**
 * Nightly balance sync: bank savings, crypto, SGB and silver from INDmoney into the vault.
 *   node mcp/balance-sync-run.js [--dry-run]
 * Reads ~/.life-ledger-mcp/indmoney-balances.json (written just before by the nightly task), plans the change against the
 * freshly pulled vault, and (unless --dry-run) writes only value and date on those records. Password from the keychain.
 */
const fs = require("fs"), os = require("os"), path = require("path");
const V = require("./vault-client.js"), kc = require("./keychain.js"), B = require("./balance-sync.js");
// On the Mac: ~/.life-ledger-mcp, config.json and the keychain. In a cloud run there is no keychain or home folder setup, so
// LL_VAULT_PASSWORD and LL_GATEWAY_URL (secrets of the routine's environment) and LL_DIR (any writable folder) are used.
const DIR = process.env.LL_DIR || path.join(os.homedir(), ".life-ledger-mcp");
(async () => {
  const cfg = process.env.LL_GATEWAY_URL ? { gatewayUrl: process.env.LL_GATEWAY_URL } : JSON.parse(fs.readFileSync(path.join(DIR, "config.json"), "utf8"));
  const ref = JSON.parse(fs.readFileSync(path.join(DIR, "indmoney-balances.json"), "utf8"));
  const today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
  const password = process.env.LL_VAULT_PASSWORD || kc.read();
  if (!password) throw new Error("No vault password: set LL_VAULT_PASSWORD (cloud) or store it in the Mac keychain");
  const dry = process.argv.includes("--dry-run");
  const show = (p) => {
    console.log(B.summary(p));
    for (const c of p.changes) console.log(`  ${dry ? "would set" : "set"} ${c.owner} ${c.field}: ${c.from} -> ${c.to}`);
    for (const s of p.skipped) console.log(`  left alone: ${s.text}`);
  };
  if (dry) { const { data } = await V.fetchState({ gatewayUrl: cfg.gatewayUrl, password }); const p = B.plan(data, ref, { today }); show(p); if (p.status !== "ok") process.exitCode = 1; return; }
  let last;
  const r = await V.updateWith({
    gatewayUrl: cfg.gatewayUrl, password, guard: B.onlyValuesChanged,
    make: (before) => { last = B.plan(before, ref, { today }); return last.status === "ok" && last.changes.length ? B.apply(before, last.changes) : null; },
  });
  show(last);
  if (last.status !== "ok") { process.exitCode = 1; return; }
  console.log(r.unchanged ? "Nothing to save." : `Saved to the vault (rev ${r.rev}).`);
})().catch((e) => { console.error(e.message); process.exit(1); });
