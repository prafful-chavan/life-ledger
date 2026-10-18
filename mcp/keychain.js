/** The vault password lives only in the macOS Keychain (service "life-ledger-mcp"); nothing is written to files. */
const { execFileSync } = require("node:child_process");
const SERVICE = "life-ledger-mcp", ACCOUNT = "vault-password";

function read() {
  try {
    return execFileSync("security", ["find-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).replace(/\n$/, "");
  } catch { return null; }
}

/** Called only from setup.js, run by the user in their own Terminal. */
function write(password) {
  execFileSync("security", ["add-generic-password", "-U", "-s", SERVICE, "-a", ACCOUNT, "-w", password]);
}

function remove() {
  try { execFileSync("security", ["delete-generic-password", "-s", SERVICE, "-a", ACCOUNT], { stdio: "ignore" }); return true; } catch { return false; }
}

module.exports = { read, write, remove, SERVICE, ACCOUNT };
