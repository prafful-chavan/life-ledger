const assert = require("assert");
const { sendMail } = require("../mcp/mailer.js");
const { authToken } = require("../mcp/vault-client.js");

const html = "<!doctype html><html><body>₹1,38,73,848 — down ₹22,434" + "x".repeat(70000) + "</body></html>";
const text = "LIFE LEDGER\nNet worth ₹1,38,73,848";
const reply = (o, status = 200, headers = {}) => ({ ok: status < 400, status, headers: { get: (k) => headers[k.toLowerCase()] || null }, text: async () => (typeof o === "string" ? o : JSON.stringify(o)) });

(async () => {
  const token = await authToken("pw");
  // The request: one POST with the token, the subject, the plain text and the HTML exactly; no recipient anywhere
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return reply({ ok: true, sent: true, remaining: 97 }); };
  const r = await sendMail({ gatewayUrl: "https://gw.test/exec", password: "pw", subject: "Life Ledger — Tue 17 Nov", text, html, fetchImpl });
  assert.ok(/sent by the gateway, 97 emails left today/.test(r.accepted));
  assert.strictEqual(calls.length, 1); const body = JSON.parse(calls[0].init.body);
  assert.deepStrictEqual(Object.keys(body).sort(), ["html", "op", "subject", "text", "token"]);
  assert.strictEqual(body.op, "mail"); assert.strictEqual(body.token, token); assert.strictEqual(body.html, html); assert.strictEqual(body.text, text);
  assert.ok(!JSON.stringify(body).includes("pw\""), "the password itself is never sent, only its token");
  assert.ok(!/"(to|cc|bcc|recipient)"/i.test(calls[0].init.body), "no recipient is sent");

  // Apps Script's redirect is followed
  let n = 0;
  const redirecting = async (url, init) => { n++; return n === 1 ? reply("", 302, { location: "https://script.googleusercontent.com/x" }) : reply({ ok: true, sent: true }); };
  assert.ok((await sendMail({ gatewayUrl: "https://gw.test/exec", password: "pw", subject: "s", text: "t", fetchImpl: redirecting })).accepted); assert.strictEqual(n, 2);

  // Wrong password: said plainly, tried once
  let tries = 0;
  await assert.rejects(sendMail({ gatewayUrl: "g", password: "pw", subject: "s", text: "t", fetchImpl: async () => { tries++; return reply({ ok: false, error: "unauthorized" }); } }), /refused the vault password/); assert.strictEqual(tries, 1);
  // Old gateway script (no mail op yet): tells what to do, tried once
  tries = 0;
  await assert.rejects(sendMail({ gatewayUrl: "g", password: "pw", subject: "s", text: "t", fetchImpl: async () => { tries++; return reply({ ok: false, error: "unknown op" }); } }), /update its script: sync-gateway\.gs/); assert.strictEqual(tries, 1);
  // Mail permission not granted yet: final, not retried
  tries = 0;
  await assert.rejects(sendMail({ gatewayUrl: "g", password: "pw", subject: "s", text: "t", fetchImpl: async () => { tries++; return reply({ ok: false, error: "You do not have permission to call MailApp.sendEmail. Required permissions: https://www.googleapis.com/auth/script.send_mail" }); } }), /could not send it: You do not have permission/); assert.strictEqual(tries, 1);
  // A hiccup (non-JSON page, then good) is retried once; two hiccups fail with the page's words
  tries = 0;
  assert.ok((await sendMail({ gatewayUrl: "g", password: "pw", subject: "s", text: "t", waitMs: 1, fetchImpl: async () => (++tries === 1 ? reply("<html>Apps Script error</html>") : reply({ ok: true, sent: true })) })).accepted); assert.strictEqual(tries, 2);
  tries = 0;
  await assert.rejects(sendMail({ gatewayUrl: "g", password: "pw", subject: "s", text: "t", waitMs: 1, fetchImpl: async () => { tries++; return reply("<html>nope</html>"); } }), /not JSON/); assert.strictEqual(tries, 2);
  tries = 0;
  await assert.rejects(sendMail({ gatewayUrl: "g", password: "pw", subject: "s", text: "t", waitMs: 1, fetchImpl: async () => { tries++; throw new TypeError("fetch failed"); } }), /fetch failed/); assert.strictEqual(tries, 2);
  // ok without "sent" (an old script that ignores the op) is not taken as sent
  await assert.rejects(sendMail({ gatewayUrl: "g", password: "pw", subject: "s", text: "t", fetchImpl: async () => reply({ ok: true, rev: 5 }) }), /does not know how to send mail/);
  // Missing pieces
  await assert.rejects(sendMail({ gatewayUrl: "", password: "pw", subject: "s", text: "t" }), /mail login is missing/);
  await assert.rejects(sendMail({ gatewayUrl: "g", password: "", subject: "s", text: "t" }), /mail login is missing/);
  await assert.rejects(sendMail({ gatewayUrl: "g", password: "pw", subject: "", text: "t" }), /subject and a plain-text/);
  await assert.rejects(sendMail({ gatewayUrl: "g", password: "pw", subject: "s", text: "" }), /subject and a plain-text/);
  console.log("mcp-mailer tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
