const assert = require("assert");
const net = require("net");
const { buildMime, sendMail } = require("../mcp/mailer.js");

const html = "<!doctype html><html><body><p style=\"color:#123\">₹1,38,73,848 — down ₹22,434</p>\r\n.dot line\r\n</body></html>" + "x".repeat(70000);
const text = "LIFE LEDGER\n.starts with a dot\nNet worth ₹1,38,73,848";
const parse = (mime) => {
  const [head, ...rest] = mime.split("\r\n\r\n"); const body = rest.join("\r\n\r\n");
  const boundary = /boundary="([^"]+)"/.exec(head)[1];
  const parts = body.split("--" + boundary).slice(1, -1).map((p) => { const [h, ...b] = p.replace(/^\r\n/, "").split("\r\n\r\n"); return { h, body: Buffer.from(b.join("").replace(/\s+/g, ""), "base64").toString("utf8") }; });
  return { head, parts };
};

// MIME: both versions survive byte for byte, headers are plain ASCII, subject is encoded
const mime = buildMime({ from: "me@example.com", to: "me@example.com", subject: "Life Ledger — Tue 17 Nov: ₹1,38,73,848", text, html, date: new Date("2026-11-17T04:30:00Z"), id: "abc", boundary: "BND" });
const p = parse(mime);
assert.strictEqual(p.parts.length, 2);
assert.strictEqual(p.parts[0].body, text); assert.strictEqual(p.parts[1].body, html, "the HTML is carried exactly, however long");
assert.ok(/Content-Type: text\/plain/.test(p.parts[0].h) && /Content-Type: text\/html/.test(p.parts[1].h));
assert.ok(/^[\x20-\x7e\r\n]+$/.test(p.head), "headers are ASCII");
const subj = /Subject: =\?UTF-8\?B\?([^?]+)\?=/.exec(p.head); assert.strictEqual(Buffer.from(subj[1], "base64").toString("utf8"), "Life Ledger — Tue 17 Nov: ₹1,38,73,848");
assert.ok(/Date: Tue, 17 Nov 2026 04:30:00 \+0000/.test(p.head) && /Message-ID: <abc@example.com>/.test(p.head));
assert.ok(mime.split("\r\n").every((l) => l.length <= 998), "no over-long lines");
assert.ok(!/Bcc|Cc:/i.test(p.head));
// text only when there is no HTML
assert.strictEqual(parse(buildMime({ from: "me@example.com", to: "me@example.com", subject: "s", text: "hi" })).parts.length, 1);
// Header injection and bad addresses are refused
for (const bad of ["", "no-at", "a@b", "a b@c.com", "a@b.com\r\nBcc: x@y.com", "<a@b.com>", "a@b.com,c@d.com"]) assert.throws(() => buildMime({ from: "me@example.com", to: bad, subject: "s", text: "t" }), /address/, JSON.stringify(bad));
assert.throws(() => buildMime({ from: "x", to: "me@example.com", subject: "s", text: "t" }), /address/);
assert.ok(!/\r\nBcc:/.test(buildMime({ from: "me@example.com", to: "me@example.com", subject: "hi\r\nBcc: evil@x.com", text: "t" })), "a newline in the subject cannot add a header");

// SMTP conversation against a fake server
function fakeServer(script = {}) {
  const log = { cmds: [], data: "" };
  const server = net.createServer((sock) => {
    sock.on("error", () => {}); let mode = "cmd", buf = "";
    const out = (s) => sock.write(s + "\r\n");
    out("220 smtp.test ready");
    sock.on("data", (d) => {
      buf += d.toString("utf8");
      for (;;) {
        if (mode === "data") { const i = buf.indexOf("\r\n.\r\n"); if (i < 0) return; log.data = buf.slice(0, i); buf = buf.slice(i + 5); mode = "cmd"; out(script.afterData || "250 2.0.0 OK queued as 123"); continue; }
        const i = buf.indexOf("\r\n"); if (i < 0) return; const line = buf.slice(0, i); buf = buf.slice(i + 2); log.cmds.push(line);
        if (/^EHLO/.test(line)) out("250-smtp.test\r\n250-AUTH PLAIN\r\n250 8BITMIME");
        else if (/^AUTH PLAIN/.test(line)) out(script.auth || "235 2.7.0 Accepted");
        else if (/^MAIL FROM/.test(line)) out("250 OK");
        else if (/^RCPT TO/.test(line)) out(script.rcpt || "250 OK");
        else if (/^DATA/.test(line)) { out("354 go ahead"); mode = "data"; }
        else if (/^QUIT/.test(line)) { out("221 bye"); sock.end(); }
      }
    });
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok({ server, log, port: server.address().port })));
}

(async () => {
  let f = await fakeServer();
  const connect = (port) => () => net.connect(port, "127.0.0.1");
  const r = await sendMail({ user: "me@example.com", pass: "app pass word", to: "me@example.com", message: mime, connect: connect(f.port) });
  assert.ok(/queued as 123/.test(r.accepted));
  assert.deepStrictEqual(f.log.cmds.map((c) => c.split(" ")[0] + " " + (c.split(" ")[1] || "").split(":")[0]).slice(0, 5), ["EHLO lifeledger.local", "AUTH PLAIN", "MAIL FROM", "RCPT TO", "DATA "]);
  const auth = Buffer.from(f.log.cmds.find((c) => /^AUTH/.test(c)).split(" ")[2], "base64").toString("utf8");
  assert.strictEqual(auth, "\0me@example.com\0app pass word");
  assert.strictEqual(f.log.cmds.filter((c) => /^RCPT/.test(c)).length, 1, "exactly one recipient");
  // what the server received decodes to the same page, with dot-lines un-stuffed
  const received = f.log.data.replace(/^\.\./gm, ".");
  assert.strictEqual(parse(received).parts[1].body, html); assert.strictEqual(parse(received).parts[0].body, text);
  f.server.close();

  // Wrong app password: the server's own words come back, and the secret does not
  f = await fakeServer({ auth: "535 5.7.8 Username and Password not accepted" });
  await assert.rejects(sendMail({ user: "me@example.com", pass: "SECRETPASS", to: "me@example.com", message: mime, connect: connect(f.port) }), (e) => /Login refused.*535/.test(e.message) && !/SECRETPASS/.test(e.message));
  f.server.close();
  // Recipient refused, message refused
  f = await fakeServer({ rcpt: "550 no such user" });
  await assert.rejects(sendMail({ user: "me@example.com", pass: "p", to: "me@example.com", message: mime, connect: connect(f.port) }), /Recipient refused.*550/);
  f.server.close();
  f = await fakeServer({ afterData: "552 message too large" });
  await assert.rejects(sendMail({ user: "me@example.com", pass: "p", to: "me@example.com", message: mime, connect: connect(f.port) }), /Message refused.*552/);
  f.server.close();
  // No login, bad recipient, server that hangs up
  await assert.rejects(sendMail({ user: "", pass: "", to: "me@example.com", message: mime }), /No mail login/);
  await assert.rejects(sendMail({ user: "a@b.com", pass: "p", to: "bad", message: mime }), /valid recipient/);
  const dead = net.createServer((s) => { s.on("error", () => {}); s.destroy(); }); await new Promise((ok) => dead.listen(0, "127.0.0.1", ok));
  await assert.rejects(sendMail({ user: "me@example.com", pass: "p", to: "me@example.com", message: mime, connect: () => net.connect(dead.address().port, "127.0.0.1") }), /closed the connection|ECONNRESET/);
  dead.close();
  // A server that never answers times out instead of hanging the run
  const mute = net.createServer((s) => { s.on("error", () => {}); }); await new Promise((ok) => mute.listen(0, "127.0.0.1", ok));
  await assert.rejects(sendMail({ user: "me@example.com", pass: "p", to: "me@example.com", message: mime, connect: () => net.connect(mute.address().port, "127.0.0.1"), timeoutMs: 300 }), /did not answer in time|closed/);
  mute.close();
  console.log("mcp-mailer tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
