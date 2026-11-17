/**
 * Shared by the programs the cloud routines run (brief, health watch, holdings check, law watch): the vault login
 * from the routine's secrets (or the Mac's config and keychain), a caller for the MCP tools without a model in between,
 * and the sender that mails through the household's own gateway.
 *   LL_VAULT_PASSWORD, LL_GATEWAY_URL   the vault and the gateway (which also mails, to the household's own address only)
 *   LL_DIR                              a writable folder (default ~/.life-ledger-mcp)
 */
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const Mailer = require("./mailer.js");

const todayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

function login(env) {
  const dir = env.LL_DIR || path.join(os.homedir(), ".life-ledger-mcp");
  let gatewayUrl = env.LL_GATEWAY_URL; if (!gatewayUrl) { try { gatewayUrl = JSON.parse(fs.readFileSync(path.join(dir, "config.json"), "utf8")).gatewayUrl; } catch { /* reported when used */ } }
  let password = env.LL_VAULT_PASSWORD; if (!password) { try { password = require("./keychain.js").read(); } catch { /* reported when used */ } }
  return { dir, gatewayUrl, password };
}

/** Calls one MCP tool the way the server does (vault read, same renderers); resolves its JSON result or throws its error text. */
function toolCaller(env) {
  const { dir, gatewayUrl, password } = login(env);
  fs.mkdirSync(dir, { recursive: true });
  const Server = require("./server.js"), { fetchState } = require("./vault-client.js"), Market = require("./market.js");
  return async (name, args = {}) => {
    if (!gatewayUrl || !password) throw new Error("The vault login is missing (LL_GATEWAY_URL / LL_VAULT_PASSWORD)");
    const loader = async () => {
      const got = await fetchState({ gatewayUrl, password, attempts: 6, waitMs: 2000, cacheFile: path.join(dir, "last-vault.json") });
      Object.defineProperty(got.data, "__source", { value: { fromCache: !!got.fromCache, cachedAt: got.cachedAt || null, reason: got.reason || null, updatedAt: got.updatedAt || null, rev: got.rev || null }, enumerable: false });
      return got.data;
    };
    const ctx = () => ({ taxProfile: {}, history: async (keys) => { const r = await Market.fetchHistory(gatewayUrl, keys); return { series: r.series, failedKeys: r.failedKeys }; } });
    const res = await Server.handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, loader, ctx);
    const out = res.result;
    if (!out || out.isError) throw new Error((out && out.content && out.content[0] && out.content[0].text) || name + " failed");
    return JSON.parse(out.content[0].text);
  };
}

/** The sender: the gateway mails it to the household's own address (the one set in the script's MAIL_TO). */
function deliverer(env) {
  return (mail) => { const { gatewayUrl, password } = login(env); return Mailer.sendMail({ gatewayUrl, password, subject: mail.subject, text: mail.text, html: mail.html }); };
}

/** One small summary field saved in the vault (only the whitelisted fields can be written). */
function fieldWriter(env, field) {
  return (value) => { const { gatewayUrl, password } = login(env); return require("./vault-client.js").updateField({ gatewayUrl, password, field, value }); };
}

/** A failed run's email: short, with the real error, nothing guessed. */
function failureMail(what, today, error) {
  const clean = String(error || "unknown").replace(/\s+/g, " ").slice(0, 300), esc = (t) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  return {
    subject: `Life Ledger — ${what} could not run`,
    text: `The Life Ledger ${what} (${today}) could not run.\nWhat failed: ${clean}\nNothing was guessed. It runs again at its next scheduled time; you can also open its routine and run it.`,
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:21px"><p>The Life Ledger ${esc(what)} (${today}) could not run.</p><p><b>What failed:</b> ${esc(clean)}</p><p>Nothing was guessed. It runs again at its next scheduled time; you can also open its routine and run it.</p></div>`,
  };
}

/** Exits the process if a run hangs, so a stuck network call can never keep a routine alive for an hour. */
function hardStop(minutes, code = 2) {
  const t = setTimeout(() => { console.error(`Gave up: the run took more than ${minutes} minutes`); process.exit(code); }, minutes * 60 * 1000); t.unref && t.unref();
  return () => clearTimeout(t);
}

module.exports = { todayISO, login, toolCaller, deliverer, fieldWriter, failureMail, hardStop };
