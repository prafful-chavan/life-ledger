// The loader that puts the Document Register into the vault: reads rows, keeps ticks, refuses a thin register, touches only its two keys.
const assert = require("assert");
const L = require("../mcp/docs-load.js");
const D = require("../docs-vault-core.js");
const ID = (n) => ("1KyUeuC55LHX0KLJ32bMVj9xH" + String(n).padStart(4, "0"));
const row = (n, o = {}) => [o.type || "Gold & jewellery", o.person || "Prafful", o.fy || "", o.name === undefined ? `file${n}.pdf` : o.name, "PDF", 10, o.status || "Readable", "", o.link === undefined ? `=HYPERLINK("https://drive.google.com/file/d/${ID(n)}/view","Open")` : o.link, "01_Identity", "", `01_Identity/file${n}.pdf`];
const before = { income: [{ id: "i1", amount: 5 }], stocks: [{ id: "s1", quantity: 3 }], docCollect: { k1: { done: true, note: "mine" } }, documents: [{ id: "doc:old", name: "old.pdf" }] };

// a normal load
{
  const input = { rows: [row(1), row(2, { status: "LOCKED - send password" }), row(3, { status: "Ignore (set aside)" }), row(4, { link: "NOT IN DRIVE" })], collect: [["Gold", "Hallmark slip", "COLLECT", "Yes", "Jeweller"], ["Tax", "AIS", "HAVE", "", ""]] };
  const out = L.build(before, input);
  assert.ok(out.ok); const r = out.report;
  assert.deepStrictEqual([r.read, r.dropped, r.papers, r.linked, r.locked, r.setAside, r.previous, r.collect], [4, 0, 4, 3, 1, 1, 1, 2]);
  assert.strictEqual(out.after.documents.length, 4); assert.ok(!out.after.documents.some((d) => d.id === "doc:old"), "the index is replaced by the register");
  assert.deepStrictEqual(out.after.docCollectItems[0], { area: "Gold", doc: "Hallmark slip", status: "COLLECT", helpsApp: true, where: "Jeweller" });
  assert.deepStrictEqual(out.after.docCollect, before.docCollect, "the household's ticks and notes stay"); assert.deepStrictEqual(out.after.income, before.income); assert.deepStrictEqual(out.after.stocks, before.stocks);
  assert.ok(L.guard(before, out.after), "the guard accepts the change it made");
  assert.ok(r.bytes > 100);
}
// a row with no name is dropped and counted; the same file twice is merged and counted
{
  const out = L.build(before, { rows: [row(1), row(2, { name: "" }), row(1), row(3)], collect: [] });
  assert.ok(out.ok && out.report.dropped === 1 && out.report.duplicatesMerged === 1 && out.report.papers === 2, JSON.stringify(out.report));
}
// refused: nothing, nothing readable, or a register with too few Drive links (exactly half is accepted)
{
  assert.strictEqual(L.build(before, null).ok, false); assert.strictEqual(L.build(before, { rows: [] }).ok, false); assert.strictEqual(L.build(before, { rows: [row(1, { name: "" })] }).ok, false);
  const half = L.build(before, { rows: [row(1), row(2, { link: "x" })] }); assert.ok(half.ok, "1 of 2 linked is accepted");
  const under = L.build(before, { rows: [row(1), row(2, { link: "x" }), row(3, { link: "x" })] }); assert.strictEqual(under.ok, false); assert.ok(/1 of 3/.test(under.error));
  const evil = L.build(before, { rows: [row(1), row(2, { link: '=HYPERLINK("https://evil.example.com/x","Open")' })] }); assert.ok(evil.ok && evil.after.documents[1].url === "", "a link that is not Drive is dropped");
}
// the guard: only the two keys may change
{
  const good = L.build(before, { rows: [row(1)], collect: [] }).after;
  assert.ok(L.guard(before, good));
  assert.strictEqual(L.guard(before, { ...good, income: [] }), false, "another key changed"); assert.strictEqual(L.guard(before, { ...good, newKey: 1 }), false, "a new key");
  assert.strictEqual(L.guard(before, { ...good, docCollect: {} }), false, "ticks erased");
  assert.strictEqual(L.guard(before, { ...good, documents: [] }), false, "an empty index");
  assert.strictEqual(L.guard(before, { ...good, documents: [{ id: "a", name: "x", url: "https://evil.example.com" }] }), false, "a bad link");
  assert.strictEqual(L.guard(before, { ...good, documents: [{ id: "a", name: "x" }, { id: "a", name: "y" }] }), false, "the same id twice");
  assert.strictEqual(L.guard(before, { ...good, documents: [{ id: "a", name: "" }] }), false, "no name");
}
// numbers in names are reported, not hidden
{
  const out = L.build(before, { rows: [row(1, { name: "ABCDE1234F_card.pdf" }), row(2, { name: "x_123456789012.pdf" }), row(3)], collect: [] });
  assert.strictEqual(out.report.nameHasIdNumber, 2);
}
// a CHECK item keeps its status; a vault with no index yet reports 0 before
{
  const out = L.build({ stocks: [] }, { rows: [row(1)], collect: [["Tax", "Form 16 FY21-22", "CHECK", "", "HashedIn"]] });
  assert.ok(out.ok && out.after.docCollectItems[0].status === "CHECK" && out.report.previous === 0);
}
console.log("mcp-docs-load: all assertions passed");
