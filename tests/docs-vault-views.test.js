// Documents page markup: search, chips, rows, links, escaping, show-more, collect list.
const assert = require("assert");
const D = require("../docs-vault-core.js");
const V = require("../docs-vault-views.js");
const ID = "1KyUeuC55LHX0KLJ32bMVj9xHlRbh-2cN", URL = `https://drive.google.com/file/d/${ID}/view`;
const text = (h) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const mk = (name, o = {}) => D.record({ name, type: "Other", person: "Prafful", status: "Readable", path: "p/" + name, ...o });
const model = (docs, over = {}, items = []) => { const f = over.filters || {}; return { facets: D.facets(docs), results: D.search(docs, over.query || "", f), query: over.query || "", filters: f, limit: over.limit, collect: D.collectList(items, over.progress) }; };
const o = { names: { Me: "Prafful", Wife: "Archana" } };

// a normal page
{
  const docs = D.clean([mk("Form16_FY2024-25.pdf", { type: "Form 16 / TDS", fy: "FY2024-25", url: URL, about: "TDS paid ₹1,000", sizeKb: 119, kind: "pdf" }), mk("Altroz_RC.jpg", { type: "Vehicle", person: "Prafful" }), mk("Locked.pdf", { type: "Bank / FD / card statement", status: "LOCKED", person: "Archana" }), mk("Template.docx", { status: "Ignore (set aside)" })]);
  const html = V.panel(model(docs), o), t = text(html);
  assert.ok(/3 papers in Drive · 1 locked · 2 not linked yet · 1 set aside\./.test(t), t.slice(0, 200));
  assert.ok(/3 matches\./.test(t)); assert.ok(!/Template\.docx/.test(t), "set-aside papers are hidden");
  assert.ok(/Form 16 \/ TDS Form16_FY2024-25\.pdf Prafful · FY2024-25 · PDF · 119 KB TDS paid ₹1,000/.test(t));
  assert.ok(html.includes(`href="${URL}" target="_blank" rel="noopener noreferrer"`), "a Drive link opens in a new tab safely");
  assert.strictEqual((html.match(/Open in Drive/g) || []).length, 1); assert.strictEqual((html.match(/not linked to Drive yet/g) || []).length, 2);
  assert.ok(/Locked\.pdf locked/.test(t), "a locked paper is marked");
  assert.ok(html.includes('data-act="docs-type" data-v="Vehicle"') && /All 3/.test(t));
  assert.ok(/<option value="FY2024-25" >FY2024-25 \(1\)<\/option>/.test(html) && /<option value="Archana" >Archana \(1\)<\/option>/.test(html));
}
// chosen filters show as chosen
{
  const docs = D.clean([mk("a.pdf", { type: "Vehicle", fy: "FY2024-25", person: "Archana" }), mk("b.pdf", { type: "Gold & jewellery" })]);
  const html = V.panel(model(docs, { filters: { type: "Vehicle", person: "Archana", fy: "FY2024-25", showSetAside: true }, query: "a" }), o);
  assert.ok(/class="chip active" data-act="docs-type" data-v="Vehicle"/.test(html)); assert.ok(!/class="chip active" data-act="docs-type" data-v=""/.test(html), "All is not active when a kind is chosen");
  assert.ok(/<option value="Archana" selected>/.test(html) && /<option value="FY2024-25" selected>/.test(html) && /data-field="showSetAside" checked/.test(html) && /value="a"/.test(html));
  assert.ok(/<button type="button" class="chip active" data-act="docs-type" data-v="">/.test(V.panel(model(docs), o)), "All is active with no kind chosen");
}
// nothing loaded / nothing matches
{
  assert.ok(/No papers are listed yet\./.test(text(V.panel(model([]), o))));
  const docs = D.clean([mk("a.pdf")]); const t = text(V.panel(model(docs, { query: "zzz" }), o));
  assert.ok(/0 matches/.test(t) && /No paper matches\. Clear a filter/.test(t)); assert.ok(/1 match\./.test(text(V.panel(model(docs), o))) && !/1 matches/.test(text(V.panel(model(docs), o))));
}
// show more: 60 at a time, exactly at the limit there is no button
{
  const many = D.clean(Array.from({ length: 130 }, (_, i) => mk("file" + String(i).padStart(3, "0") + ".pdf")));
  let html = V.panel(model(many), o); assert.strictEqual((html.match(/class="dc-row"/g) || []).length, 60); assert.ok(/Show 60 more \(70 left\)/.test(text(html)));
  html = V.panel(model(many, { limit: 120 }), o); assert.strictEqual((html.match(/class="dc-row"/g) || []).length, 120); assert.ok(/Show 10 more \(10 left\)/.test(text(html)));
  html = V.panel(model(many, { limit: 130 }), o); assert.ok(!/docs-more/.test(html), "all shown → no button");
  const sixty = D.clean(Array.from({ length: 60 }, (_, i) => mk("g" + i + ".pdf"))); assert.ok(!/docs-more/.test(V.panel(model(sixty), o)), "exactly 60 → no button");
  assert.ok(/docs-more/.test(V.panel(model(D.clean(Array.from({ length: 61 }, (_, i) => mk("g" + i + ".pdf")))), o)), "61 → button");
}
// text from the data is escaped; a link that is not Drive is never drawn
{
  const evil = `<img src=x onerror=alert(1)>"'`;
  const docs = [{ id: "doc:1", name: evil, type: evil, person: evil, fy: "", kind: "PDF", sizeKb: 1, status: "Readable", about: evil, url: 'javascript:alert(1)', path: "p", folder: "f" }];
  const html = V.panel({ facets: D.facets(docs), results: docs, query: evil, filters: {}, collect: D.collectList([{ area: evil, doc: evil, where: evil }], { [D.collectKey({ area: evil, doc: evil })]: { note: evil } }) }, o);
  assert.ok(!/<img/.test(html) && !/onerror=alert\(1\)>/.test(html), "no raw markup from data"); assert.ok(!/javascript:/.test(html), "a non-Drive link is not drawn"); assert.ok(/not linked to Drive yet/.test(html));
  assert.ok(!/href="[^"]*[<>]/.test(html));
}
// the collect list
{
  const items = [{ area: "Insurance", doc: "Archana's term policy", status: "COLLECT", helpsApp: true, where: "Insurer" }, { area: "Tax", doc: "Form 26AS", status: "HAVE" }, { area: "Tax", doc: "AIS 2026-27", status: "COLLECT LATER" }];
  const key = D.collectKey({ area: "Insurance", doc: "Archana's term policy" });
  let html = V.panel(model([], {}, items), o), t = text(html);
  assert.ok(/2 still to collect, 1 done\./.test(t)); assert.ok(/Archana&#39;s term policy to collect · Insurer · also helps the app/.test(t), "the apostrophe is escaped"); assert.ok(/Form 26AS have it/.test(t) && /AIS 2026-27 later/.test(t));
  assert.ok(new RegExp(`data-act="docs-done" data-key="${key}" >`).test(html) || new RegExp(`data-act="docs-done" data-key="${key}"  >`).test(html) || html.includes(`data-act="docs-done" data-key="${key}" `), "an open item has an unticked box");
  assert.ok(/Tax<\/b> <span>1 open/.test(html) && /Insurance<\/b> <span>1 open/.test(html));
  html = V.panel(model([], { progress: { [key]: { done: true, note: "asked" } } }, items), o);
  assert.ok(/1 still to collect, 2 done\./.test(text(html))); assert.ok(html.includes(`data-key="${key}" checked`) && html.includes('value="asked"'));
  assert.ok(/Form 26AS/.test(html) && /disabled/.test(html), "an item we already have is shown ticked and cannot be un-ticked");
  assert.ok(/Nothing is on the collect list\./.test(text(V.panel(model([]), o))));
  // a group with everything done starts closed, a group with something open starts open
  const closed = V.panel(model([], {}, [{ area: "A", doc: "d", status: "HAVE" }]), o); assert.ok(/<details class="dc-area" >/.test(closed));
  assert.ok(/<details class="dc-area" open>/.test(V.panel(model([], {}, [{ area: "A", doc: "d", status: "COLLECT" }]), o)));
}
// sizes: under 1 MB in KB, from 1 MB in MB
assert.ok(/1023 KB/.test(text(V.row(mk("a", { sizeKb: 1023 }))))); assert.ok(/1\.0 MB/.test(text(V.row(mk("a", { sizeKb: 1024 }))))); assert.ok(!/KB|MB/.test(text(V.row(mk("a", { sizeKb: 0 })))));

// only an item we already have is locked; the limit is at least 1
{
  const items = [{ area: "A", doc: "open one", status: "COLLECT" }, { area: "A", doc: "have one", status: "HAVE" }];
  const html = V.panel(model([], {}, items), o);
  const box = (doc) => { const k = D.collectKey({ area: "A", doc }); return html.match(new RegExp(`<input type="checkbox" data-act="docs-done" data-key="${k}"[^>]*>`))[0]; };
  assert.ok(!/disabled/.test(box("open one")) && /disabled/.test(box("have one")) && /checked/.test(box("have one")) && !/checked/.test(box("open one")));
  const two = D.clean([mk("a.pdf"), mk("b.pdf"), mk("c.pdf")]);
  assert.strictEqual((V.panel(model(two, { limit: 1 }), o).match(/class="dc-row"/g) || []).length, 1, "a limit of 1 shows exactly one");
  assert.strictEqual((V.panel(model(two, { limit: 0 }), o).match(/class="dc-row"/g) || []).length, 3, "no limit given falls back to 60");
}
console.log("docs-vault-views: all assertions passed");
