const assert = require("assert");
const fs = require("fs"), os = require("os"), path = require("path");
const { run, failureMail, readNotes, EXIT } = require("../mcp/brief-run.js");
const R = require("../mcp/brief-render.js");

const goodHtml = R.kit.sealed("<!doctype html><html><body>Net worth ₹1,38,73,848</body></html>");
const goodBrief = { kind: "brief", subject: "Life Ledger — Tue 17 Nov: ₹1,38,73,848 (flat today)", text: "LIFE LEDGER\nNET WORTH ₹1,38,73,848", html: goodHtml };
const T = "2026-11-17";
const mk = (over = {}) => {
  const out = { log: [], err: [], sent: [], built: [] };
  const args = { argv: ["--send"], today: T, log: (m) => out.log.push(m), err: (m) => out.err.push(m),
    buildBrief: async (notes) => { out.built.push(notes); return goodBrief; },
    deliver: async (mail) => { out.sent.push(mail); return { accepted: "sent by the gateway" }; }, ...over };
  return { out, go: () => run(args) };
};
const decode = (mail) => [mail.text, mail.html];

(async () => {
  // Send: the brief goes to the household's own address only, text and HTML exactly as built
  let t = mk(); assert.strictEqual(await t.go(), EXIT.ok);
  assert.strictEqual(t.out.sent.length, 1); const s = t.out.sent[0];
  assert.deepStrictEqual([s.subject, s.text, s.html], [goodBrief.subject, goodBrief.text, goodBrief.html], "subject, text and HTML go out exactly as built");
  assert.ok(/Sent: Life Ledger — Tue 17 Nov.*sent by the gateway/.test(t.out.log[0]));

  // Build only: prints the text, sends nothing, passes no notes
  t = mk({ argv: ["--build"] }); assert.strictEqual(await t.go(), EXIT.ok);
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

  // The brief cannot be built: the real error is emailed (once) and exit is 2
  t = mk({ buildBrief: async () => { throw new Error("Gateway did not answer properly: fetch failed"); } });
  assert.strictEqual(await t.go(), EXIT.build); assert.strictEqual(t.out.sent.length, 1);
  const [fText, fHtml] = decode(t.out.sent[0]);
  assert.ok(/could not be built/.test(fText) && /fetch failed/.test(fText) && /fetch failed/.test(fHtml) && /No numbers|no numbers/.test(fText));
  assert.ok(/could not run/.test(t.out.sent[0].subject));
  // ... and in --build mode nothing is sent
  t = mk({ argv: ["--build"], buildBrief: async () => { throw new Error("boom"); } }); assert.strictEqual(await t.go(), EXIT.build); assert.strictEqual(t.out.sent.length, 0);
  // If even that email fails, exit 3
  t = mk({ buildBrief: async () => { throw new Error("boom"); }, deliver: async () => { throw new Error("gateway refused"); } }); assert.strictEqual(await t.go(), EXIT.mail);

  // Incomplete or cut-short briefs are never sent as a brief
  for (const bad of [null, {}, { subject: "s", text: "t" }, { ...goodBrief, text: "" }, { ...goodBrief, subject: "" }, { ...goodBrief, html: goodHtml.slice(0, -10) }, { ...goodBrief, html: "<html>no seal</html>" }]) {
    t = mk({ buildBrief: async () => bad }); assert.strictEqual(await t.go(), EXIT.build, JSON.stringify(bad && Object.keys(bad))); assert.strictEqual(t.out.sent.length, 1, "only the could-not-run email"); assert.ok(/could not be built/.test(t.out.sent[0].text));
  }
  // An alert (data problem replaced the brief) is sent as it is; it has html too
  t = mk({ buildBrief: async () => ({ ...goodBrief, kind: "alert", subject: "Life Ledger — data problem" }) }); assert.strictEqual(await t.go(), EXIT.ok); assert.ok(/data problem/.test(t.out.log[0]));
  // The gateway refusing the real brief: exit 3 and the server's words, not the password
  t = mk({ deliver: async () => { throw new Error("The gateway refused the vault password"); } });
  assert.strictEqual(await t.go(), EXIT.mail); assert.ok(/Could not send the brief: The gateway refused/.test(t.out.err[0]));

  // failureMail escapes markup and keeps it short
  const fm = failureMail(T, "<script>x</script>" + "y".repeat(500)); assert.ok(!/<script>/.test(fm.html) && fm.text.length < 700);

  console.log("mcp-brief-run tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
