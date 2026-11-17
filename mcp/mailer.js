/**
 * Life Ledger — sends one email over SMTP with an app password (no dependencies).
 * Used by the cloud morning brief so the finished HTML goes straight from the program to the mailbox: nothing retypes or
 * copies it, which is what cut some emails down to plain text. The password is read from the environment by the caller
 * and is never logged or written to disk.
 */
const tls = require("node:tls");
const crypto = require("node:crypto");

const ADDR = /^[^\s<>"',;:\\]+@[^\s<>"',;:\\]+\.[^\s<>"',;:\\]+$/;
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const wrap76 = (s) => s.replace(/.{1,76}/g, "$&\r\n").replace(/\r\n$/, "");
const encodeSubject = (s) => "=?UTF-8?B?" + b64(String(s).replace(/[\r\n]+/g, " ")) + "?=";

/** The whole message as text (CRLF line ends), plain and HTML versions in one multipart/alternative. */
function buildMime({ from, to, subject, text, html, date = new Date(), id = crypto.randomBytes(12).toString("hex"), boundary = "ll-" + crypto.randomBytes(10).toString("hex") }) {
  if (!ADDR.test(from || "") || !ADDR.test(to || "")) throw new Error("A sender and one recipient address are needed");
  const domain = from.split("@")[1];
  const part = (type, body) => `--${boundary}\r\nContent-Type: ${type}; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap76(b64(String(body)))}\r\n`;
  return [
    `From: Life Ledger <${from}>`, `To: ${to}`, `Subject: ${encodeSubject(subject)}`, `Date: ${new Date(date).toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <${id}@${domain}>`, "MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary="${boundary}"`, "", "",
  ].join("\r\n") + part("text/plain", text || "") + (html ? part("text/html", html) : "") + `--${boundary}--\r\n`;
}

/** Reads SMTP replies (a reply may span lines "250-..." then "250 ..."). */
function reader(socket) {
  let buf = "", waiters = [];
  const settle = () => {
    for (;;) {
      const lines = buf.split("\r\n"); if (lines.length < 2) return;
      let end = -1; for (let i = 0; i < lines.length - 1; i++) if (/^\d{3} /.test(lines[i]) || /^\d{3}$/.test(lines[i])) { end = i; break; }
      if (end < 0) return;
      const reply = lines.slice(0, end + 1); buf = lines.slice(end + 1).join("\r\n");
      const w = waiters.shift(); if (!w) return; w.ok({ code: Number(reply[end].slice(0, 3)), text: reply.join("\n") });
    }
  };
  socket.on("data", (d) => { buf += d.toString("utf8"); settle(); });
  socket.on("error", (e) => { for (const w of waiters.splice(0)) w.fail(e); });
  socket.on("close", () => { for (const w of waiters.splice(0)) w.fail(new Error("The mail server closed the connection")); });
  return () => new Promise((ok, fail) => { waiters.push({ ok, fail }); settle(); });
}

/** Sends one message. `connect` is replaceable for tests. Resolves { accepted: reply text } or throws with the server's words. */
async function sendMail({ host = "smtp.gmail.com", port = 465, user, pass, from = user, to, message, connect, timeoutMs = 60000 }) {
  if (!user || !pass) throw new Error("No mail login: set the SMTP user and app password");
  if (!ADDR.test(to || "")) throw new Error("One valid recipient address is needed");
  const socket = (connect || ((h, p) => tls.connect({ host: h, port: p, servername: h })))(host, port);
  socket.setTimeout(timeoutMs, () => socket.destroy(new Error("The mail server did not answer in time")));
  const next = reader(socket);
  const say = (line) => socket.write(line + "\r\n");
  const expect = async (codes, what) => { const r = await next(); if (!codes.includes(r.code)) throw new Error(`${what} refused by the mail server (${r.code}): ${r.text.replace(/\s+/g, " ").slice(0, 160)}`); return r; };
  try {
    await expect([220], "Connecting");
    say("EHLO lifeledger.local"); await expect([250], "Hello");
    say("AUTH PLAIN " + Buffer.from(`\0${user}\0${pass}`).toString("base64")); await expect([235], "Login");
    say(`MAIL FROM:<${from}>`); await expect([250], "Sender");
    say(`RCPT TO:<${to}>`); await expect([250, 251], "Recipient");
    say("DATA"); await expect([354], "Message start");
    socket.write(message.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..") + "\r\n.\r\n");
    const done = await expect([250], "Message");
    say("QUIT");
    return { accepted: done.text.replace(/\s+/g, " ").slice(0, 120) };
  } finally { socket.destroy(); }
}

module.exports = { buildMime, sendMail, ADDR };
