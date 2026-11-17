const assert = require("assert");
const { run, EXIT } = require("../mcp/health-run.js");
const Common = require("../mcp/cloud-common.js");
const R = require("../mcp/brief-render.js");

const html = R.kit.sealed("<html><body>Health</body></html>");
const attention = { send: true, kind: "attention", subject: "Life Ledger — needs attention (1)", text: "NEEDS ATTENTION\n- x", html, problems: 1, serious: 0 };
const quiet = { send: false, kind: "healthy", subject: "Life Ledger — weekly health: all good", text: "ok", html, problems: 0, serious: 0 };
const mk = (over = {}) => { const out = { log: [], err: [], sent: [], args: [] }; return { out, go: () => run({ argv: [], today: "2026-11-17", log: (m) => out.log.push(m), err: (m) => out.err.push(m),
  check: async (a) => { out.args.push(a); return attention; }, deliver: async (m) => { out.sent.push(m); return { accepted: "sent by the gateway" }; }, ...over }) }; };

(async () => {
  // Something needs a look: mailed exactly as built
  let t = mk(); assert.strictEqual(await t.go(), EXIT.ok);
  assert.deepStrictEqual(t.out.sent.map((m) => [m.subject, m.text, m.html]), [[attention.subject, attention.text, attention.html]]);
  assert.ok(/Sent: Life Ledger — needs attention/.test(t.out.log[0]));
  // All healthy: nothing sent, said so
  t = mk({ check: async () => quiet }); assert.strictEqual(await t.go(), EXIT.ok); assert.strictEqual(t.out.sent.length, 0); assert.strictEqual(t.out.log[0], "All healthy, nothing sent.");
  // --force is passed on
  t = mk({ argv: ["--force"] }); await t.go(); assert.deepStrictEqual(t.out.args, [{ force: true }]);
  t = mk(); await t.go(); assert.deepStrictEqual(t.out.args, [{ force: false }]);
  // The check fails: the real error is mailed, exit 2
  t = mk({ check: async () => { throw new Error("Gateway did not answer properly: fetch failed"); } });
  assert.strictEqual(await t.go(), EXIT.build); assert.strictEqual(t.out.sent.length, 1);
  assert.strictEqual(t.out.sent[0].subject, "Life Ledger — health watch could not run"); assert.ok(/fetch failed/.test(t.out.sent[0].text) && /fetch failed/.test(t.out.sent[0].html));
  // ... and if that mail fails too: exit 3
  t = mk({ check: async () => { throw new Error("boom"); }, deliver: async () => { throw new Error("gateway refused"); } }); assert.strictEqual(await t.go(), EXIT.mail);
  // Incomplete or cut-short reports are never sent as a report
  for (const bad of [null, {}, { send: true, subject: "s", text: "t" }, { ...attention, html: html.slice(0, -8) }, { ...attention, html: "" }, { send: "yes", subject: "s", text: "t" }, { ...attention, subject: "" }]) {
    t = mk({ check: async () => bad }); assert.strictEqual(await t.go(), EXIT.build, JSON.stringify(bad && Object.keys(bad))); assert.ok(/could not run/.test(t.out.sent[0].subject));
  }
  // A quiet result needs no page
  t = mk({ check: async () => ({ send: false, subject: "s", text: "t" }) }); assert.strictEqual(await t.go(), EXIT.ok);
  // Mail failure on a real report: exit 3 with the gateway's words
  t = mk({ deliver: async () => { throw new Error("The gateway refused the vault password"); } }); assert.strictEqual(await t.go(), EXIT.mail); assert.ok(/refused the vault password/.test(t.out.err[0]));
  // The shared failure mail escapes markup and keeps the error short
  const f = Common.failureMail("health watch", "2026-11-17", "<b>x</b>" + "y".repeat(500)); assert.ok(!/<b>x/.test(f.html) && f.text.length < 600);
  console.log("mcp-health-run tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
