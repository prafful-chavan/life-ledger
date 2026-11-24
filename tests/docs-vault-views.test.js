// Documents page markup: folders like Drive, breadcrumbs, search results, links, escaping, show-more, collect tab.
const assert = require("assert");
const D = require("../docs-vault-core.js");
const V = require("../docs-vault-views.js");
const ID = "1KyUeuC55LHX0KLJ32bMVj9xHlRbh-2cN", URL = `https://drive.google.com/file/d/${ID}/view`;
const text = (h) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const mk = (name, path, o = {}) => D.record({ name, path: path || "p/" + name, type: "Other", person: "Prafful", status: "Readable", ...o });
// the model the app builds
function model(docs, ui = {}, items = [], progress) {
  const u = { q: "", type: "", person: "", fy: "", showSetAside: false, limit: 60, tab: "folders", path: [], flat: false, ...ui };
  const filters = { type: u.type, person: u.person, fy: u.fy, showSetAside: u.showSetAside };
  const searching = Boolean(u.q.trim() || u.type || u.person || u.fy);
  return { facets: D.facets(docs), tab: u.tab, query: u.q, filters, searching, results: searching ? D.search(docs, u.q, filters) : [], browse: D.browse(docs, u.path, { showSetAside: u.showSetAside }), flat: u.flat, flatFiles: u.flat ? D.search(docs, "", { under: u.path, showSetAside: u.showSetAside }) : [], limit: u.limit, collect: D.collectList(items, progress) };
}
const o = {};
const docs = D.clean([
  mk("Feb-2019_BlazeClan.pdf", "02_Tax/Payslips/BlazeClan/FY2018-19/Feb-2019_BlazeClan.pdf", { url: URL, fy: "FY2018-19", sizeKb: 119, kind: "pdf", about: "Salary slip" }),
  mk("Apr-2019_BlazeClan.pdf", "02_Tax/Payslips/BlazeClan/FY2019-20/Apr-2019_BlazeClan.pdf", { fy: "FY2019-20" }),
  mk("Offer.pdf", "02_Tax/Payslips/BlazeClan/Offer.pdf"),
  mk("Jan-2021_H.pdf", "02_Tax/Payslips/HashedIn/Jan-2021_H.pdf"),
  mk("aadhaar.pdf", "01_Identity/aadhaar.pdf", { status: "LOCKED", person: "Archana", type: "Identity" }),
  mk("loose.pdf", "loose.pdf"),
  mk("hidden.docx", "99_Aside/hidden.docx", { status: "Ignore (set aside)" }),
]);

// the top: folders with readable names and counts, the loose file, a way to see everything
{
  const html = V.panel(model(docs), o), t = text(html);
  assert.ok(/6 papers in Drive · 1 locked · 5 not linked yet · 1 set aside\./.test(t), t.slice(0, 160));
  assert.ok(/Identity 1 file/.test(t) && /Tax 4 files/.test(t), "folders show a readable name and how many files are below"); assert.ok(!/Aside/.test(t), "a folder holding only set-aside papers is not listed");
  assert.ok(html.includes('data-act="docs-go" data-path="02_Tax"') && html.includes('data-path="01_Identity"'));
  assert.ok(html.indexOf('data-path="01_Identity"') < html.indexOf('data-path="02_Tax"'), "numbered folders keep their order");
  assert.ok(/loose\.pdf/.test(t) && !/aadhaar\.pdf/.test(t), "files directly at the top are listed, files in folders are not");
  assert.ok(/<b aria-current="page">All papers<\/b>/.test(html) && !/class="dc-crumb"/.test(html), "at the top there is nowhere to go up to");
  assert.ok(/Show all 6 files inside/.test(t) && html.includes('data-act="docs-flat"'));
  assert.ok(/<button type="button" class="tab-button active" data-act="docs-tab" data-v="folders">Folders/.test(html));
}
// inside a folder: breadcrumb back up, sub-folders, files, no repeat of the top
{
  const bz = V.panel(model(docs, { path: ["02_Tax", "Payslips", "BlazeClan"] }), o), t = text(bz);
  assert.ok(/All papers › Tax › Payslips › BlazeClan/.test(t));
  assert.ok(bz.includes('class="dc-crumb" data-act="docs-go" data-path="">All papers') && bz.includes('data-path="02_Tax/Payslips">Payslips'), "every step up is a button with its own path");
  assert.ok(/<b aria-current="page">BlazeClan<\/b>/.test(bz));
  assert.ok(/FY2018-19 1 file/.test(t) && /FY2019-20 1 file/.test(t) && !/1 files/.test(t), "one file is singular");
  assert.ok(/Offer\.pdf/.test(t) && !/Feb-2019_BlazeClan/.test(t), "only what is directly here; the rest is one level down");
  assert.ok(/Show all 3 files inside/.test(t));
  const fy = V.panel(model(docs, { path: ["02_Tax", "Payslips", "BlazeClan", "FY2018-19"] }), o), ft = text(fy);
  assert.ok(/Feb-2019_BlazeClan\.pdf Prafful · FY2018-19 · PDF · 119 KB Salary slip/.test(ft)); assert.ok(fy.includes(`href="${URL}" target="_blank" rel="noopener noreferrer"`));
  assert.ok(!/Show all/.test(ft), "a folder with no sub-folders has no show-all button"); assert.ok(!/class="dc-folders"/.test(fy));
}
// show all files inside, each with the folder it is in
{
  const html = V.panel(model(docs, { path: ["02_Tax", "Payslips", "BlazeClan"], flat: true }), o), t = text(html);
  assert.ok(/Every file inside, 3 in all\./.test(t) && /Back to folders/.test(t) && !/Show all/.test(t));
  assert.ok(/Feb-2019_BlazeClan\.pdf/.test(t) && /Apr-2019_BlazeClan\.pdf/.test(t) && /Offer\.pdf/.test(t));
  assert.ok(html.includes('data-act="docs-go" data-path="02_Tax/Payslips/BlazeClan/FY2018-19">in Tax › Payslips › BlazeClan › FY2018-19</button>'), "a file points back to its folder");
  assert.ok(!/class="dc-folders"/.test(html));
}
// a folder that is gone, an empty top
{
  const gone = V.panel(model(docs, { path: ["nope"] }), o); assert.ok(/That folder is not there any more\./.test(text(gone))); assert.ok(/All papers › nope|All papers.*nope/.test(text(gone)));
  assert.ok(/No papers are listed yet\./.test(text(V.panel(model([]), o))));
  const only = D.clean([mk("a.pdf", "x/a.pdf", { status: "Ignore" })]); assert.ok(/This folder is empty\./.test(text(V.panel(model(only), o))), "everything set aside → the top looks empty");
}
// search: flat results with their folder; clear button; filters open when on
{
  const html = V.panel(model(docs, { q: "blazeclan" }), o), t = text(html);
  assert.ok(/3 matches\./.test(t) && /Clear search/.test(t) && html.includes('data-act="docs-clear"')); assert.ok(!/class="dc-folders"/.test(html) && !/Show all/.test(t));
  assert.ok(html.includes('data-path="02_Tax/Payslips/BlazeClan/FY2018-19">in Tax › Payslips › BlazeClan › FY2018-19'));
  assert.ok(/value="blazeclan"/.test(html)); assert.ok(!/<details class="dc-filters" open>/.test(html), "filters stay shut when none is on");
  assert.ok(/1 match\./.test(text(V.panel(model(docs, { q: "jan-2021" }), o))) && !/1 matches/.test(text(V.panel(model(docs, { q: "jan-2021" }), o))));
  const none = text(V.panel(model(docs, { q: "zzzz" }), o)); assert.ok(/0 matches/.test(none) && /No paper matches\. Clear a filter/.test(none));
  const f = V.panel(model(docs, { person: "Archana", type: "Identity" }), o);
  assert.ok(/<details class="dc-filters" open><summary>Filters \(2 on\)/.test(f)); assert.ok(/<option value="Archana" selected>/.test(f) && /<option value="Identity" selected>/.test(f)); assert.ok(/1 match\./.test(text(f)) && /aadhaar\.pdf locked/.test(text(f)));
  assert.ok(/data-field="showSetAside" checked/.test(V.panel(model(docs, { showSetAside: true }), o)) && /<summary>Filters \(1 on\)/.test(V.panel(model(docs, { showSetAside: true }), o)));
  assert.ok(/<option value="FY2019-20" >FY2019-20 \(1\)<\/option>/.test(html));
}
// paging: 60 at a time; exactly 60 → no button, 61 → button
{
  const many = D.clean(Array.from({ length: 130 }, (_, i) => mk("file" + String(i).padStart(3, "0") + ".pdf", "d/file" + i + ".pdf")));
  let html = V.panel(model(many, { path: ["d"] }), o); assert.strictEqual((html.match(/class="dc-row"/g) || []).length, 60); assert.ok(/Show 60 more \(70 left\)/.test(text(html)));
  html = V.panel(model(many, { path: ["d"], limit: 120 }), o); assert.strictEqual((html.match(/class="dc-row"/g) || []).length, 120); assert.ok(/Show 10 more \(10 left\)/.test(text(html)));
  assert.ok(!/docs-more/.test(V.panel(model(many, { path: ["d"], limit: 130 }), o)));
  const n = (k) => D.clean(Array.from({ length: k }, (_, i) => mk("g" + i + ".pdf", "d/g" + i + ".pdf")));
  assert.ok(!/docs-more/.test(V.panel(model(n(60), { path: ["d"] }), o))); assert.ok(/docs-more/.test(V.panel(model(n(61), { path: ["d"] }), o)));
  assert.strictEqual((V.panel(model(n(3), { path: ["d"], limit: 1 }), o).match(/class="dc-row"/g) || []).length, 1, "a limit of 1 shows one"); assert.strictEqual((V.panel(model(n(3), { path: ["d"], limit: 0 }), o).match(/class="dc-row"/g) || []).length, 3, "no limit → 60");
  const flat = V.panel(model(many, { flat: true, path: [] }), o); assert.strictEqual((flat.match(/class="dc-row"/g) || []).length, 60);
}
// text from the data is escaped, in names, folders and the path buttons; a link that is not Drive is never drawn
{
  const evil = `<img src=x onerror=alert(1)>"'`;
  const bad = [{ id: "doc:1", name: evil, type: evil, person: evil, fy: "", kind: "PDF", sizeKb: 1, status: "Readable", about: evil, url: "javascript:alert(1)", path: `${evil}/${evil}/${evil}.pdf`, folder: "f" }];
  for (const ui of [{}, { path: [evil] }, { path: [evil, evil], flat: true }, { q: "img" }]) {
    const html = V.panel(model(bad, ui, [{ area: evil, doc: evil, where: evil }], { [D.collectKey({ area: evil, doc: evil })]: { note: evil } }), o);
    assert.ok(!/<img/.test(html) && !/onerror=alert\(1\)>/.test(html), "no raw markup: " + JSON.stringify(ui)); assert.ok(!/javascript:/.test(html)); assert.ok(!/data-path="[^"]*[<>]/.test(html));
  }
  const html = V.panel(model(bad, { path: [evil, evil] }), o); assert.ok(/not linked to Drive yet/.test(html));
}
// the collect tab
{
  const items = [{ area: "Insurance", doc: "Archana's term policy", status: "COLLECT", helpsApp: true, where: "Insurer" }, { area: "Tax", doc: "Form 26AS", status: "HAVE" }, { area: "Tax", doc: "AIS 2026-27", status: "COLLECT LATER" }];
  const key = D.collectKey({ area: "Insurance", doc: "Archana's term policy" });
  let html = V.panel(model(docs, { tab: "collect" }, items), o), t = text(html);
  assert.ok(/To collect \(2\)/.test(t), "the tab names how many are open"); assert.ok(/<button type="button" class="tab-button active" data-act="docs-tab" data-v="collect">/.test(html));
  assert.ok(/2 still to collect, 1 done\./.test(t)); assert.ok(/Archana&#39;s term policy to collect · Insurer · also helps the app/.test(t)); assert.ok(/Form 26AS have it/.test(t) && /AIS 2026-27 later/.test(t));
  assert.ok(!/class="dc-folders"|class="dc-crumbs"/.test(html), "the folder view is not drawn on the collect tab"); assert.ok(!/<details class="dc-area" >[\s\S]*Insurance/.test(html));
  assert.ok(/Tax<\/b> <span>1 open/.test(html) && /Insurance<\/b> <span>1 open/.test(html));
  html = V.panel(model(docs, { tab: "collect" }, items, { [key]: { done: true, note: "asked" } }), o);
  assert.ok(/1 still to collect, 2 done\./.test(text(html)) && /To collect \(1\)/.test(text(html))); assert.ok(html.includes(`data-key="${key}" checked`) && html.includes('value="asked"'));
  const box = (doc) => { const k = D.collectKey({ area: "Tax", doc }); return V.panel(model(docs, { tab: "collect" }, items), o).match(new RegExp(`<input type="checkbox" data-act="docs-done" data-key="${k}"[^>]*>`))[0]; };
  assert.ok(/disabled/.test(box("Form 26AS")) && /checked/.test(box("Form 26AS")) && !/disabled/.test(box("AIS 2026-27")) && !/checked/.test(box("AIS 2026-27")));
  assert.ok(/Nothing is on the collect list\./.test(text(V.panel(model(docs, { tab: "collect" }), o))));
  assert.ok(!/To collect \(/.test(text(V.panel(model(docs, {}, []), o))), "no count when nothing is open");
  assert.ok(/<details class="dc-area" >/.test(V.panel(model([], { tab: "collect" }, [{ area: "A", doc: "d", status: "HAVE" }]), o))); assert.ok(/<details class="dc-area" open>/.test(V.panel(model([], { tab: "collect" }, [{ area: "A", doc: "d", status: "COLLECT" }]), o)));
  assert.ok(/class="tab-button active" data-act="docs-tab" data-v="folders"/.test(V.panel(model(docs, { tab: "weird" }), o)), "an unknown tab shows the folders");
}
// sizes: under 1 MB in KB, from 1 MB in MB
assert.ok(/1023 KB/.test(text(V.row(mk("a", "p/a", { sizeKb: 1023 }))))); assert.ok(/1\.0 MB/.test(text(V.row(mk("a", "p/a", { sizeKb: 1024 }))))); assert.ok(!/KB|MB/.test(text(V.row(mk("a", "p/a", { sizeKb: 0 })))));

// a folder with a single sub-folder still offers "show all"; the search box suggests how to search; no limit given → 60 of many
{
  assert.ok(/Show all 4 files inside/.test(text(V.panel(model(docs, { path: ["02_Tax"] }), o))), "one sub-folder is enough");
  assert.ok(V.panel(model(docs), o).includes('placeholder="e.g. gold bill, form 16 2025, car policy"'));
  const many = D.clean(Array.from({ length: 100 }, (_, i) => mk("m" + i + ".pdf", "d/m" + i + ".pdf")));
  const m = model(many, { path: ["d"] }); delete m.limit; assert.strictEqual((V.panel(m, o).match(/class="dc-row"/g) || []).length, 60, "no limit given → 60 shown");
}
console.log("docs-vault-views: all assertions passed");
