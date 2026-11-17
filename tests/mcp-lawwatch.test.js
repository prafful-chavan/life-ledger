const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { lawWatch } = require("../mcp/lawwatch.js");
const Cal = require("../mcp/calendar.js");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lawwatch-"));
const file = path.join(dir, "law-watch.json");

// Never run, and the first scheduled run is not yet due: nothing to be late about
let w = lawWatch("2026-10-21", file);
assert.strictEqual(w.stale, false); assert.deepStrictEqual(w.changes, []); assert.strictEqual(w.checkedOn, null);
assert.ok(/first monthly law check is due on 2026-11-02/.test(w.note), w.note);
assert.strictEqual(lawWatch("2026-11-01", file).stale, false, "the 1st itself is still within the day of grace");

// Never run and the first run is overdue: stale, no changes, no throw
w = lawWatch("2026-11-02", file);
assert.strictEqual(w.stale, true); assert.deepStrictEqual(w.changes, []); assert.strictEqual(w.checkedOn, null);
assert.strictEqual(lawWatch("2026-10-21", file, 45, "2026-10-01").stale, true, "the first-run date can be passed in");

// Garbage file is treated as never run
fs.writeFileSync(file, "not json");
assert.strictEqual(lawWatch("2026-11-05", file).stale, true);

// Fresh result with a change; fields are trimmed and non-URL sources dropped
fs.writeFileSync(file, JSON.stringify({ checkedOn: "2026-11-01", changes: [{ ruleId: "fast-ds", headline: "  FAST-DS window extended\n to 31 March 2027 ", effect: "More time to decide", source: "https://www.incometax.gov.in/x" }, { headline: "", effect: "dropped" }, { ruleId: "x", headline: "bad source", source: "javascript:alert(1)" }] }));
w = lawWatch("2026-11-10", file);
assert.strictEqual(w.stale, false); assert.strictEqual(w.ageDays, 9);
assert.strictEqual(w.changes.length, 2);
assert.strictEqual(w.changes[0].headline, "FAST-DS window extended to 31 March 2027");
assert.strictEqual(w.changes[1].source, "", "only http(s) sources are kept");

// Goes stale after 45 days
assert.strictEqual(lawWatch("2026-12-20", file).stale, true);

// Legal deadlines appear in the calendar
const items = Cal.calendar({ people: {}, insurance: [] }, "2026-12-01");
assert.ok(items.some((i) => i.date === "2026-12-31" && /FAST-DS/.test(i.what)));
assert.ok(items.some((i) => i.date === "2027-03-31" && /revise/i.test(i.what)) === false, "outside the 75-day horizon on 1 Dec");
assert.ok(Cal.calendar({ people: {}, insurance: [] }, "2027-02-01").some((i) => i.date === "2027-03-31" && /revise/i.test(i.what)));

fs.rmSync(dir, { recursive: true });
console.log("law watch tests passed");

// ── The record in hand (saved in the vault by the monthly cloud run) ──
{
  const { fromRecord, cleanRecord } = require("../mcp/lawwatch.js");
  const rec = { checkedOn: "2026-11-01", changes: [{ ruleId: "r1", headline: " Slab  change ", effect: "e", source: "https://x.gov.in/a" }, { ruleId: "r2", headline: "No link", effect: "", source: "javascript:alert(1)" }] };
  const w = fromRecord(rec, "2026-11-10"); assert.strictEqual(w.ageDays, 9); assert.strictEqual(w.stale, false); assert.strictEqual(w.changes[0].headline, "Slab change"); assert.strictEqual(w.changes[1].source, "");
  assert.strictEqual(fromRecord(rec, "2026-12-17").stale, true, "46 days is stale"); assert.strictEqual(fromRecord(rec, "2026-12-16").stale, false, "45 days is not");
  for (const nothing of [null, undefined, [], "x", 5]) { const n = fromRecord(nothing, "2026-12-01"); assert.strictEqual(n.stale, true); assert.strictEqual(n.checkedOn, null); assert.ok(/has not run yet/.test(n.note)); }
  assert.strictEqual(fromRecord(null, "2026-10-20").stale, false, "before the first run is due");
  assert.strictEqual(fromRecord({ checkedOn: "bad", changes: [] }, "2026-11-10").stale, true, "a record without a real date is stale");
  // cleanRecord: what a run may save
  const c = cleanRecord({ checkedOn: "2026-12-01", changes: [{ ruleId: "a".repeat(100), headline: "H".repeat(300), effect: "E", source: "https://ok.example/x" }, { headline: "" }, { ruleId: "z", headline: "Bad link", source: "ftp://x" }], extra: "dropped" });
  assert.deepStrictEqual(Object.keys(c).sort(), ["changes", "checkedOn"]); assert.strictEqual(c.changes.length, 2, "empty headlines dropped");
  assert.strictEqual(c.changes[0].ruleId.length, 40); assert.strictEqual(c.changes[0].headline.length, 160); assert.strictEqual(c.changes[1].source, "");
  assert.strictEqual(cleanRecord({ checkedOn: "2026-12-01", changes: Array.from({ length: 12 }, (_, i) => ({ headline: "h" + i })) }).changes.length, 8, "at most 8 changes");
  assert.deepStrictEqual(cleanRecord({ checkedOn: "2026-12-01" }).changes, []);
  for (const bad of [null, {}, { checkedOn: "yesterday" }, { checkedOn: "2026-13-1" }, []]) assert.throws(() => cleanRecord(bad), /checkedOn/);
  console.log("law watch record tests passed");
}
