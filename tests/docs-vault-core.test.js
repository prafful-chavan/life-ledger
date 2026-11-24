// Documents vault: safe links, clean-up, register import, search, filter counts, the collect list.
const assert = require("assert");
const D = require("../docs-vault-core.js");

const ID = "1KyUeuC55LHX0KLJ32bMVj9xHlRbh-2cN"; // 33 chars, a real-looking Drive id
const URL = `https://drive.google.com/file/d/${ID}/view`;

// ---- links: only Google Drive file and folder links ever pass
{
  assert.strictEqual(D.safeUrl(URL), URL);
  assert.strictEqual(D.safeUrl(URL + "?usp=drivesdk"), URL + "?usp=drivesdk");
  assert.strictEqual(D.safeUrl(`https://drive.google.com/drive/folders/${ID}`), `https://drive.google.com/drive/folders/${ID}`);
  assert.strictEqual(D.safeUrl(`  ${URL}  `), URL, "surrounding spaces are trimmed");
  for (const bad of ["", null, undefined, 5, "javascript:alert(1)", `http://drive.google.com/file/d/${ID}/view`, `https://evil.example.com/file/d/${ID}/view`,
    `https://drive.google.com.evil.com/file/d/${ID}/view`, `https://drive.google.com/file/d/${ID}/view"onmouseover="x`, `https://drive.google.com/file/d/${ID}/view?x=1`,
    "https://drive.google.com/file/d/short/view", `https://drive.google.com/file/d/${"a".repeat(19)}/view`, `data:text/html,<b>${ID}</b>`]) {
    assert.strictEqual(D.safeUrl(bad), "", "refused: " + String(bad).slice(0, 40));
  }
  // the id boundary: 20 is the shortest accepted, 19 is refused (checked above), 80 the longest, 81 refused
  assert.ok(D.safeUrl(`https://drive.google.com/file/d/${"a".repeat(20)}/view`));
  assert.ok(D.safeUrl(`https://drive.google.com/file/d/${"a".repeat(80)}/view`));
  assert.strictEqual(D.safeUrl(`https://drive.google.com/file/d/${"a".repeat(81)}/view`), "");
  assert.strictEqual(D.driveId(URL), ID); assert.strictEqual(D.driveId("https://x.com"), "");
}

// ---- one record: trimmed, kinds fixed, nothing invented
{
  const r = D.record({ name: "  Form16_FY2024-25_TCS_Part-A.pdf ", type: "Form 16 / TDS", person: "Prafful", fy: "FY2024-25", kind: "pdf", sizeKb: 118.6, status: "Readable", about: "TDS ₹1,23,456", url: URL, path: "02/x.pdf", folder: "02_Tax-Documents" });
  assert.deepStrictEqual(r, { id: "doc:" + ID, name: "Form16_FY2024-25_TCS_Part-A.pdf", url: URL, path: "02/x.pdf", type: "Form 16 / TDS", person: "Prafful", fy: "FY2024-25", kind: "PDF", sizeKb: 119, status: "Readable", about: "TDS ₹1,23,456", folder: "02_Tax-Documents" });
  assert.strictEqual(D.record({ name: "" }), null); assert.strictEqual(D.record({ name: "   " }), null); assert.strictEqual(D.record(null), null); assert.strictEqual(D.record("x"), null);
  // a year that is not a real financial year is dropped, not kept: 2024-26 is wrong, 2024-25 right, 2099-00 right
  assert.strictEqual(D.record({ name: "a", fy: "FY2024-26" }).fy, ""); assert.strictEqual(D.record({ name: "a", fy: "2024-25" }).fy, ""); assert.strictEqual(D.record({ name: "a", fy: "FY2099-00" }).fy, "FY2099-00");
  // a bad link is dropped, the record stays (it is listed as not in Drive); the id then comes from the path
  const noLink = D.record({ name: "a.pdf", url: "javascript:alert(1)", path: "p/a.pdf" }); assert.strictEqual(noLink.url, ""); assert.ok(/^doc:p[0-9a-z]+$/.test(noLink.id));
  assert.strictEqual(D.record({ name: "a.pdf", path: "p/a.pdf" }).id, noLink.id, "the same path always gets the same id");
  assert.notStrictEqual(D.record({ name: "a.pdf", path: "p/b.pdf" }).id, noLink.id);
  // size: negative or not a number becomes 0
  assert.strictEqual(D.record({ name: "a", sizeKb: -5 }).sizeKb, 0); assert.strictEqual(D.record({ name: "a", sizeKb: "abc" }).sizeKb, 0); assert.strictEqual(D.record({ name: "a", sizeKb: 0 }).sizeKb, 0);
  // control characters and runs of spaces are cleaned, long text is cut at its limit (name 200, about 400)
  assert.strictEqual(D.record({ name: "a\u0000b\n\n c" }).name, "a b c"); assert.strictEqual(D.record({ name: "x".repeat(250) }).name.length, 200); assert.strictEqual(D.record({ name: "a", about: "y".repeat(450) }).about.length, 400);
  // status words
  assert.strictEqual(D.record({ name: "a", status: "LOCKED - send password" }).status, "Locked"); assert.strictEqual(D.record({ name: "a", status: "Ignore (set aside)" }).status, "Set aside");
  assert.strictEqual(D.record({ name: "a", status: "Set aside" }).status, "Set aside"); assert.strictEqual(D.record({ name: "a", status: "" }).status, "Readable"); assert.strictEqual(D.record({ name: "a", status: "whatever" }).status, "Readable");
  assert.strictEqual(D.record({ name: "a" }).type, "Other", "no type → Other");
}

// ---- clean: de-duplicated, link wins, junk dropped, not-an-array is empty
{
  const c = D.clean([{ name: "a", url: URL }, { name: "a copy", url: URL }, { name: "n", path: "p/n" }, { name: "n", path: "p/n", url: "" }, { name: "" }, null, 7]);
  assert.strictEqual(c.length, 2); assert.strictEqual(c[0].name, "a"); assert.ok(c.find((x) => x.name === "n"));
  // the record with a link replaces one without, for the same path-less id: same id only arises from same Drive id, so a no-link then link with equal path stays distinct ids
  assert.deepStrictEqual(D.clean(null), []); assert.deepStrictEqual(D.clean({}), []); assert.deepStrictEqual(D.clean([]), []);
}

// ---- a register row → a record
{
  const row = ["Form 16 / TDS", "Prafful", "FY2024-25", "f.pdf", "PDF", 118, "Readable", "", `=HYPERLINK("${URL}","Open")`, "02_Tax-Documents", "x", "02_Tax-Documents/x/f.pdf"];
  const r = D.fromRegisterRow(row);
  assert.ok(r && r.url === URL && r.id === "doc:" + ID && r.path === "02_Tax-Documents/x/f.pdf" && r.folder === "02_Tax-Documents" && r.fy === "FY2024-25");
  assert.strictEqual(D.fromRegisterRow(row.slice(0, 11)), null, "a short row is refused"); assert.strictEqual(D.fromRegisterRow(null), null);
  const none = D.fromRegisterRow(row.map((v, i) => (i === 8 ? "NOT IN DRIVE" : v))); assert.strictEqual(none.url, "");
  const bad = D.fromRegisterRow(row.map((v, i) => (i === 8 ? '=HYPERLINK("https://evil.example.com/x","Open")' : v))); assert.strictEqual(bad.url, "", "a formula pointing anywhere but Drive gives no link");
}

// ---- search and filters
const mk = (name, o = {}) => D.record({ name, type: "Other", person: "Prafful", fy: "", status: "Readable", path: "p/" + name, ...o });
const docs = D.clean([
  mk("Gold_bill_Rokde.pdf", { type: "Gold & jewellery", person: "Archana", fy: "FY2025-26", about: "Diamond ring invoice" }),
  mk("Form16_FY2024-25_TCS_Part-A.pdf", { type: "Form 16 / TDS", fy: "FY2024-25", url: URL }),
  mk("Form16_FY2023-24_TCS_Part-A.pdf", { type: "Form 16 / TDS", fy: "FY2023-24" }),
  mk("Altroz_RC.jpg", { type: "Vehicle" }),
  mk("Locked_thing.pdf", { type: "Bank / FD / card statement", status: "LOCKED" }),
  mk("Template.docx", { type: "Set aside (ignore)", status: "Ignore (set aside)" }),
]);
{
  const names = (l) => l.map((d) => d.name);
  assert.strictEqual(D.search(docs, "").length, 5, "the set-aside file is hidden by default");
  assert.strictEqual(D.search(docs, "", { showSetAside: true }).length, 6);
  assert.deepStrictEqual(names(D.search(docs, "GOLD")), ["Gold_bill_Rokde.pdf"], "case does not matter");
  assert.deepStrictEqual(names(D.search(docs, "ring archana")), ["Gold_bill_Rokde.pdf"], "every word must match, in any order, in the note or the person");
  assert.deepStrictEqual(D.search(docs, "ring altroz"), [], "one word matching is not enough");
  assert.deepStrictEqual(names(D.search(docs, "   form16   tcs ")), ["Form16_FY2024-25_TCS_Part-A.pdf", "Form16_FY2023-24_TCS_Part-A.pdf"], "newest year first");
  assert.deepStrictEqual(names(D.search(docs, "", { type: "Form 16 / TDS", fy: "FY2023-24" })), ["Form16_FY2023-24_TCS_Part-A.pdf"]);
  assert.deepStrictEqual(names(D.search(docs, "", { person: "Archana" })), ["Gold_bill_Rokde.pdf"]);
  assert.deepStrictEqual(names(D.search(docs, "", { status: "Locked" })), ["Locked_thing.pdf"]);
  assert.deepStrictEqual(D.search(docs, "", { type: "Nope" }), []); assert.deepStrictEqual(D.search(null, "x"), []);
  assert.deepStrictEqual(names(D.search(docs, "rc")).includes("Altroz_RC.jpg"), true);
  // sorted by kind of paper, then name
  const all = D.search(docs, ""); assert.deepStrictEqual(all.map((d) => d.type), [...all.map((d) => d.type)].sort((a, b) => a.localeCompare(b)));
}
// ---- filter counts
{
  const f = D.facets(docs);
  assert.strictEqual(f.total, 5); assert.strictEqual(f.locked, 1); assert.strictEqual(f.setAside, 1); assert.strictEqual(f.notInDrive, 4, "only the Form 16 FY2024-25 has a link");
  assert.deepStrictEqual(f.types[0], { name: "Form 16 / TDS", count: 2 }); assert.ok(!f.types.some((t) => t.name.includes("Set aside")), "set-aside papers are not counted");
  assert.deepStrictEqual(f.years, [{ name: "FY2025-26", count: 1 }, { name: "FY2024-25", count: 1 }, { name: "FY2023-24", count: 1 }]);
  assert.deepStrictEqual(f.persons, [{ name: "Prafful", count: 4 }, { name: "Archana", count: 1 }]);
  const e = D.facets([]); assert.deepStrictEqual([e.total, e.locked, e.notInDrive, e.setAside, e.types.length], [0, 0, 0, 0, 0]); assert.strictEqual(D.facets(null).total, 0);
}
// ---- the collect list
{
  const items = [{ area: "Insurance", doc: "Archana's term policy", status: "collect", helpsApp: true, where: "Insurer" }, { area: "Tax", doc: "Form 26AS", status: "HAVE" }, { area: "Tax", doc: "AIS FY2026-27", status: "COLLECT LATER" }, { area: "", doc: "x" }, { area: "a", doc: "" }, { area: "Gold", doc: "Hallmark slip", status: "weird" }, null];
  const c = D.collectList(items, {});
  assert.strictEqual(c.rows.length, 4); assert.strictEqual(c.done, 1, "HAVE counts as done"); assert.strictEqual(c.open, 3);
  assert.strictEqual(c.rows.find((r) => r.doc === "Hallmark slip").status, "COLLECT", "an unknown status becomes COLLECT"); assert.strictEqual(c.rows[0].helpsApp, true);
  assert.deepStrictEqual(c.byArea, [{ name: "Gold", count: 1 }, { name: "Insurance", count: 1 }, { name: "Tax", count: 1 }]);
  // the household's own tick and note, by a stable key
  const key = D.collectKey({ area: "Insurance", doc: "Archana's term policy" });
  assert.strictEqual(key, D.collectKey({ area: "Insurance", doc: "Archana's term policy" })); assert.notStrictEqual(key, D.collectKey({ area: "Insurance", doc: "Other" }));
  const c2 = D.collectList(items, { [key]: { done: true, note: "  asked the agent  " } });
  assert.strictEqual(c2.open, 2); assert.strictEqual(c2.rows[0].done, true); assert.strictEqual(c2.rows[0].note, "asked the agent");
  assert.strictEqual(D.collectList(items, { [key]: { done: "yes" } }).rows[0].done, false, "only a real true ticks it");
  assert.strictEqual(D.collectList(items, null).rows.length, 4); assert.deepStrictEqual(D.collectList(null).rows, []);
}

// ---- every field is read from its own column, and every limit cuts at exactly its length
{
  const row = ["TYPE", "PERSON", "FY2022-23", "NAME.pdf", "pdf", 77, "LOCKED - x", "ABOUT", `=HYPERLINK("${URL}","Open")`, "FOLDER", "SUB", "PATH/NAME.pdf"];
  assert.deepStrictEqual(D.fromRegisterRow(row), { id: "doc:" + ID, name: "NAME.pdf", url: URL, path: "PATH/NAME.pdf", type: "TYPE", person: "PERSON", fy: "FY2022-23", kind: "PDF", sizeKb: 77, status: "Locked", about: "ABOUT", folder: "FOLDER" });
  // a plain link in the link column (no formula) works too
  assert.strictEqual(D.fromRegisterRow(row.map((v, i) => (i === 8 ? URL : v))).url, URL);
  const cut = (field, max, extra = {}) => { const mk1 = (n) => D.record({ name: "a", [field]: "x".repeat(n), ...extra }); assert.strictEqual(mk1(max)[field].length, max, field + " at its limit"); assert.strictEqual(mk1(max + 1)[field].length, max, field + " just over its limit"); };
  cut("path", 400); cut("type", 60); cut("person", 30); cut("folder", 80); cut("kind", 8); cut("about", 400);
  assert.strictEqual(D.record({ name: "a", sizeKb: 0.6 }).sizeKb, 1, "0.6 KB rounds up to 1"); assert.strictEqual(D.record({ name: "a", sizeKb: 0.4 }).sizeKb, 0);
  const col = (field, max) => { const items = (n) => [{ area: field === "area" ? "x".repeat(n) : "A", doc: field === "doc" ? "y".repeat(n) : "D", where: field === "where" ? "w".repeat(n) : "", status: "COLLECT" }]; assert.strictEqual(D.collectList(items(max)).rows[0][field].length, max, field + " at its limit"); assert.strictEqual(D.collectList(items(max + 1)).rows[0][field].length, max, field + " just over"); };
  col("area", 90); col("doc", 400); col("where", 120);
  const k = D.collectKey({ area: "A", doc: "D" });
  assert.strictEqual(D.collectList([{ area: "A", doc: "D" }], { [k]: { note: "n".repeat(300) } }).rows[0].note.length, 300); assert.strictEqual(D.collectList([{ area: "A", doc: "D" }], { [k]: { note: "n".repeat(301) } }).rows[0].note.length, 300);
}
console.log("docs-vault-core: limits and columns passed");
console.log("docs-vault-core: all assertions passed");
