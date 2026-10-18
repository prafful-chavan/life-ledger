#!/usr/bin/env node
/**
 * One-time setup — YOU run this in your own Terminal:   node mcp/setup.js
 * Asks for the sync gateway URL and the vault password (hidden), proves they work by decrypting the vault, then saves
 * the password in the macOS Keychain and the URL in ~/.life-ledger-mcp/config.json. To undo:  node mcp/setup.js --remove
 */
const fs = require("node:fs"), os = require("node:os"), path = require("node:path"), readline = require("node:readline");
const keychain = require("./keychain"), { fetchState } = require("./vault-client");

const dir = path.join(os.homedir(), ".life-ledger-mcp"), file = path.join(dir, "config.json");

function ask(q, hidden) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = (s) => { if (s.includes(q)) process.stdout.write(s); };
    rl.question(q, (a) => { rl.close(); if (hidden) process.stdout.write("\n"); resolve(a.trim()); });
  });
}

(async () => {
  if (process.argv.includes("--remove")) {
    console.log(keychain.remove() ? "Removed the password from the Keychain." : "Nothing stored in the Keychain.");
    try { fs.rmSync(file); console.log("Removed", file); } catch { /* none */ }
    return;
  }
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(file, "utf8")); } catch { /* first run */ }
  const gatewayUrl = (await ask(`Sync gateway URL (the Apps Script web-app URL from Settings)${cfg.gatewayUrl ? " [Enter keeps current]" : ""}: `)) || cfg.gatewayUrl;
  if (!/^https:\/\/script\.google\.com\//.test(gatewayUrl || "")) throw new Error("That is not an Apps Script URL");
  const password = await ask("Vault password (hidden): ", true);
  if (!password) throw new Error("No password entered");
  process.stdout.write("Checking… ");
  const s = await fetchState({ gatewayUrl, password });
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, JSON.stringify({ ...cfg, gatewayUrl }, null, 2), { mode: 0o600 });
  keychain.write(password);
  console.log(`OK — vault revision ${s.rev}: ${(s.data.mutualFunds || []).length} fund rows, ${(s.data.stocks || []).length} stocks, ${(s.data.expenses || []).length} expenses.`);
  console.log("Password saved in the macOS Keychain (item: life-ledger-mcp). Run with --remove to delete it.");
})().catch((e) => { console.error("\nSetup failed:", e.message); process.exit(1); });
