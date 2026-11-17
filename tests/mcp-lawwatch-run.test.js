const assert = require("assert");
const { run, reportMail, EXIT } = require("../mcp/lawwatch-run.js");

const files = {
  "/w/law-watch.json": JSON.stringify({ checkedOn: "2026-12-01", changes: [{ ruleId: "fast-ds", headline: "FAST-DS window extended", effect: "More time", source: "https://incometax.gov.in/x" }] }),
  "/w/law-watch-report.md": "# Report\nDetails & <links>",
};
const fs_ = { readFileSync: (f) => { if (f in files) return files[f]; throw new Error("ENOENT " + f); } };
const mk = (over = {}) => { const out = { log: [], err: [], saved: [], sent: [] }; return { out, go: (argv) => run({ argv, env: { LL_DIR: "/w" }, fs_, log: (m) => out.log.push(m), err: (m) => out.err.push(m),
  previous: async () => ({ checkedOn: "2026-11-01", changes: [] }), save: async (v) => { out.saved.push(v); }, deliver: async (m) => { out.sent.push(m); return { accepted: "sent by the gateway" }; }, ...over }) }; };

(async () => {
  let t = mk(); assert.strictEqual(await t.go(["--save"]), EXIT.ok);
  assert.deepStrictEqual(t.out.saved, [{ checkedOn: "2026-12-01", changes: [{ ruleId: "fast-ds", headline: "FAST-DS window extended", effect: "More time", source: "https://incometax.gov.in/x" }] }]);
  const m = t.out.sent[0]; assert.strictEqual(m.subject, "Life Ledger — tax-law watch, December 2026");
  assert.ok(/FAST-DS window extended — More time \(https:\/\/incometax/.test(m.text) && /# Report/.test(m.text) && /Not licensed|not licensed/.test(m.text));
  assert.ok(/Details &amp; &lt;links&gt;/.test(m.html) && !/<links>/.test(m.html), "markup in the report is escaped");
  assert.ok(/Saved to the vault: checked 2026-12-01, 1 change\./.test(t.out.log[0]) && /Report mailed/.test(t.out.log[1]));
  // No changes: said plainly. No report file: the changes alone are mailed.
  files["/w/law-watch.json"] = JSON.stringify({ checkedOn: "2026-12-01", changes: [] }); delete files["/w/law-watch-report.md"];
  t = mk(); assert.strictEqual(await t.go(["--save"]), EXIT.ok); assert.ok(/0 changes\./.test(t.out.log[0]) && /No change to any rule/.test(t.out.sent[0].text));
  // Explicit files
  files["/x/r.json"] = JSON.stringify({ checkedOn: "2026-12-02", changes: [] }); files["/x/rep.md"] = "custom";
  t = mk(); await t.go(["--save", "--file", "/x/r.json", "--report", "/x/rep.md"]); assert.strictEqual(t.out.saved[0].checkedOn, "2026-12-02"); assert.ok(/custom/.test(t.out.sent[0].text));
  // An unusable result is not saved or mailed
  for (const bad of ["not json", "{}", JSON.stringify({ checkedOn: "soon", changes: [] }), "null"]) { files["/w/law-watch.json"] = bad; t = mk(); assert.strictEqual(await t.go(["--save"]), EXIT.bad, bad); assert.strictEqual(t.out.saved.length + t.out.sent.length, 0); }
  delete files["/w/law-watch.json"]; t = mk(); assert.strictEqual(await t.go(["--save"]), EXIT.bad);
  // Save fails: nothing mailed; mail fails: result still saved, exit 3
  files["/w/law-watch.json"] = JSON.stringify({ checkedOn: "2026-12-01", changes: [] });
  t = mk({ save: async () => { throw new Error("vault busy"); } }); assert.strictEqual(await t.go(["--save"]), EXIT.bad); assert.strictEqual(t.out.sent.length, 0); assert.ok(/Could not save the result: vault busy/.test(t.out.err[0]));
  t = mk({ deliver: async () => { throw new Error("gateway refused"); } }); assert.strictEqual(await t.go(["--save"]), EXIT.mail); assert.strictEqual(t.out.saved.length, 1); assert.ok(/result is saved, but the report could not be mailed/.test(t.out.err[0]));
  // --previous prints last month's result (or null); usage otherwise
  t = mk(); assert.strictEqual(await t.go(["--previous"]), EXIT.ok); assert.deepStrictEqual(JSON.parse(t.out.log[0]), { checkedOn: "2026-11-01", changes: [] });
  t = mk({ previous: async () => undefined }); await t.go(["--previous"]); assert.strictEqual(t.out.log[0], "null");
  t = mk({ previous: async () => { throw new Error("offline"); } }); assert.strictEqual(await t.go(["--previous"]), EXIT.bad);
  assert.strictEqual(await mk().go([]), EXIT.usage); assert.strictEqual(await mk().go(["--nothing"]), EXIT.usage);
  // Subject names the month, including January and December
  for (const [d, name] of [["2027-01-01", "January 2027"], ["2026-12-01", "December 2026"]]) assert.ok(reportMail({ checkedOn: d, changes: [] }, "").subject.endsWith(name));
  console.log("mcp-lawwatch-run tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
