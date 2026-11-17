/**
 * Life Ledger — sends one email through the household's own sync gateway (an Apps Script in their Google account).
 * The finished page goes from the program to the gateway over HTTPS in one request, and the gateway mails it to the
 * script owner's own address only (the recipient is never taken from the request). Nothing retypes or copies the HTML,
 * and no mail password exists: the gateway checks the same password-derived token as a vault read.
 * (SMTP was tried first; cloud sandboxes refuse outgoing mail ports.)
 */
const { authToken, postFollow } = require("./vault-client.js");

async function sendMail({ gatewayUrl, password, subject, text, html, fetchImpl = fetch, attempts = 2, waitMs = 2000 }) {
  if (!gatewayUrl || !password) throw new Error("The mail login is missing (gateway address and vault password)");
  if (!subject || !text) throw new Error("A subject and a plain-text body are needed");
  const body = JSON.stringify({ op: "mail", token: await authToken(password), subject, text, html: html || "" });
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await postFollow(gatewayUrl, body, fetchImpl);
      const raw = await res.text();
      let j; try { j = JSON.parse(raw); } catch { throw new Error("The gateway sent a reply that is not JSON: " + raw.slice(0, 100).replace(/\s+/g, " ")); }
      if (j.ok && j.sent) return { accepted: `sent by the gateway${j.remaining != null ? `, ${j.remaining} emails left today` : ""}` };
      if (j.error === "unauthorized") throw Object.assign(new Error("The gateway refused the vault password"), { final: true });
      if (j.ok && !j.sent) throw Object.assign(new Error("The gateway does not know how to send mail yet (update its script: sync-gateway.gs, then Deploy a new version)"), { final: true });
      if (/unknown op/.test(String(j.error))) throw Object.assign(new Error("The gateway does not know how to send mail yet (update its script: sync-gateway.gs, then Deploy a new version)"), { final: true });
      throw Object.assign(new Error("The gateway could not send it: " + String(j.error || "unknown error").slice(0, 160)), { final: /permission|authoriz|too large|missing/i.test(String(j.error)) });
    } catch (e) { last = e; if (e.final) break; if (i < attempts - 1) await new Promise((r) => setTimeout(r, waitMs)); }
  }
  throw last;
}

module.exports = { sendMail };
