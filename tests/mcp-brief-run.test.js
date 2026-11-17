const assert = require("assert");
const fs = require("fs"), os = require("os"), path = require("path");
const { run, failureMail, readNotes, EXIT } = require("../mcp/brief-run.js");
const R = require("../mcp/brief-render.js");

const goodHtml = R.kit.sealed("<!doctype html><html><body>Net worth ₹1,38,73,848</body></html>");
const goodBrief = { kind: "brief", subject: "Life Ledger — Tue 17 Nov: ₹1,38,73,848 (flat today)", text: "LIFE LEDGER\nNET WORTH ₹1,38,73,848", html: goodHtml };
const ENV = { LL_MAIL_ADDRESS: "me@example.com", LL_SMTP_PASSWORD: "app-pass" };
const T = "2026-11-17";
const mk = (over = {}) => {
  const out = { log: [], err: [], sent: [], built: [] };
  const args = { argv: ["--send"], env: ENV, today: T, log: (m) => out.log.push(m), err: (m) => out.err.push(m),
    buildBrief: async (notes) => { out.built.push(notes); return goodBrief; },
    sendMail: async (o) => { out.sent.push(o); return { accepted: "250 OK" }; }, ...over };
  return { out, go: () => run(args) };
};
const decode = (msg) => { const m = /boundary="([^"]+)"/.exec(msg)[1]; return msg.split("--" + m).slice(1, -1).map((p) => Buffer.from(p.split("\r\n\r\n").slice(1).join("").replace(/\s+/g, ""), "base64").toString("utf8")); };

(async () => {
  // Send: the brief goes to the household's own address only, text and HTML exactly as built
  let t = mk(); assert.strictEqual(await t.go(), EXIT.ok);
  assert.strictEqual(t.out.sent.length, 1); const s = t.out.sent[0];
  assert.strictEqual(s.to, "me@example.com"); assert.strictEqual(s.user, "me@example.com"); assert.strictEqual(s.pass, "app-pass");
  assert.deepStrictEqual(decode(s.message), [goodBrief.text, goodBrief.html]);
  assert.ok(/Sent: Life Ledger — Tue 17 Nov/.test(t.out.log[0]) && !/app-pass/.test(JSON.stringify([t.out.log, t.out.err])), "the password is never printed");

  // Build only: prints the text, sends nothing, passes no notes
  t = mk({ argv: ["--build"], env: {} }); assert.strictEqual(await t.go(), EXIT.ok);
  assert.strictEqual(t.out.sent.length, 0); assert.strictEqual(t.out.log[0], goodBrief.text); assert.strictEqual(t.out.built[0], undefined);

  // Notes: a good file is passed on; a missing, broken or non-object file means no notes, never a failed email
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-")), nf = path.join(dir, "notes.json");
  fs.writeFileSync(nf, JSON.stringify({ coach: "A calm day.", win: "Saved more." }));
  t = mk({ argv: ["--send", "--notes", nf] }); await t.go(); assert.deepStrictEqual(t.out.built[0], { coach: "A calm day.", win: "Saved more." });
  for (const bad of ["not json", "[1,2]", "null", '"text"']) { fs.writeFileSync(nf, bad); t = mk({ argv: ["--send", "--notes", nf] }); assert.strictEqual(await t.go(), EXIT.ok); assert.strictEqual(t.out.built[0], undefined, bad); }
  t = mk({ argv: ["--send", "--notes", path.join(dir, "missing.json")] }); assert.strictEqual(await t.go(), EXIT.ok); assert.strictEqual(t.out.built[0], undefined);
  assert.strictEqual(readNotes(null), undefined);

  // Usage
  for (const argv of [[], ["--send", "--build"], ["--nothing"]]) { t = mk({ argv }); assert.strictEqual(await t.go(), EXIT.usage, JSON.stringify(argv)); assert.strictEqual(t.out.sent.length, 0); }

  // Mail not set up: nothing built, nothing sent, exit 3 so the routine falls back
  for (const env of [{}, { LL_MAIL_ADDRESS: "me@example.com" }, { LL_SMTP_PASSWORD: "x" }, { LL_MAIL_ADDRESS: "bad", LL_SMTP_PASSWORD: "x" }]) { t = mk({ env }); assert.strictEqual(await t.go(), EXIT.mail); assert.strictEqual(t.out.built.length, 0); assert.ok(/not set up/.test(t.out.err[0])); }

  // The brief cannot be built: the real error is emailed (once) and exit is 2
  t = mk({ buildBrief: async () => { throw new Error("Gateway did not answer properly: fetch failed"); } });
  assert.strictEqual(await t.go(), EXIT.build); assert.strictEqual(t.out.sent.length, 1);
  const [fText, fHtml] = decode(t.out.sent[0].message);
  assert.ok(/could not be built/.test(fText) && /fetch failed/.test(fText) && /fetch failed/.test(fHtml) && /No numbers|no numbers/.test(fText));
  assert.ok(/Subject: =\?UTF-8\?B\?/.test(t.out.sent[0].message));
  // ... and in --build mode nothing is sent
  t = mk({ argv: ["--build"], env: {}, buildBrief: async () => { throw new Error("boom"); } }); assert.strictEqual(await t.go(), EXIT.build); assert.strictEqual(t.out.sent.length, 0);
  // If even that email fails, exit 3
  t = mk({ buildBrief: async () => { throw new Error("boom"); }, sendMail: async () => { throw new Error("535 login"); } }); assert.strictEqual(await t.go(), EXIT.mail);

  // Incomplete or cut-short briefs are never sent as a brief
  for (const bad of [null, {}, { subject: "s", text: "t" }, { ...goodBrief, text: "" }, { ...goodBrief, subject: "" }, { ...goodBrief, html: goodHtml.slice(0, -10) }, { ...goodBrief, html: "<html>no seal</html>" }]) {
    t = mk({ buildBrief: async () => bad }); assert.strictEqual(await t.go(), EXIT.build, JSON.stringify(bad && Object.keys(bad))); assert.strictEqual(t.out.sent.length, 1, "only the could-not-run email"); assert.ok(/could not be built/.test(decode(t.out.sent[0].message)[0]));
  }
  // An alert (data problem replaced the brief) is sent as it is; it has html too
  t = mk({ buildBrief: async () => ({ ...goodBrief, kind: "alert", subject: "Life Ledger — data problem" }) }); assert.strictEqual(await t.go(), EXIT.ok); assert.ok(/data problem/.test(t.out.log[0]));
  // The mail server refusing the real brief: exit 3 and the server's words, not the password
  t = mk({ sendMail: async () => { throw new Error("Login refused by the mail server (535): bad credentials"); } });
  assert.strictEqual(await t.go(), EXIT.mail); assert.ok(/Could not send the brief: Login refused/.test(t.out.err[0]) && !/app-pass/.test(t.out.err.join()));

  // failureMail escapes markup and keeps it short
  const fm = failureMail(T, "<script>x</script>" + "y".repeat(500)); assert.ok(!/<script>/.test(fm.html) && fm.text.length < 700);

  console.log("mcp-brief-run tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
