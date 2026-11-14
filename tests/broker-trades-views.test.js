// Broker trades panel: counts, buttons, escaping.
const assert = require("assert");
const V = require("../broker-trades-views.js");
const fmt = { inr: (n) => "₹" + Math.round(n).toLocaleString("en-IN") };
const o = { fmt, names: { Me: "Prafful", Wife: "Archana" }, dateText: (s) => "D:" + s, today: "2026-11-14" };
const text = (h) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const item = (sym, status, extra = {}) => ({ key: "Me|Zerodha|" + sym, owner: "Me", demat: "Zerodha", symbol: sym, status, heldQty: 10, heldAvg: 100, explainedQty: status === "none" ? 0 : status === "short" ? 6 : 10, missingQty: status === "short" ? 4 : 0, lots: status === "none" ? [] : [{ date: "2025-01-10", qty: 6, price: 1 }, { date: "2025-03-10", qty: 4, price: 1 }], first: status === "none" ? null : "2025-01-10", last: status === "none" ? null : "2025-03-10", alreadyDated: false, note: "", ...extra });
const model = (items, extra = {}) => ({ tradeCount: 91, range: { from: "2024-01-08", to: "2026-01-07" }, byOwner: { Me: 91, Wife: 0 }, recon: { items, soldSince: [] }, choices: new Set(), files: [], ...extra });

// nothing added yet
{
  const t = text(V.panel({ tradeCount: 0, recon: { items: [item("A", "none")], soldSince: [] }, files: [] }, o));
  assert.ok(/No trade files added yet/.test(t) && /Add trade files/.test(t)); assert.ok(!/data-act="bt-apply"/.test(V.panel({ tradeCount: 0, recon: { items: [] } }, o)), "no apply button without trades");
  assert.ok(!/<table/.test(V.panel({ tradeCount: 0, recon: { items: [item("A", "none")] } }, o)));
  assert.strictEqual(text(V.panel(null, o)).includes("No trade files added yet"), true, "an empty model still draws");
}
// counts and the apply button
{
  const items = [item("E1", "exact"), item("E2", "exact"), item("S1", "short"), item("S2", "short"), item("C1", "check"), item("X1", "extra"), item("N1", "none"), item("D1", "exact", { alreadyDated: true })];
  const html = V.panel(model(items), o), t = text(html);
  assert.ok(/91 trades kept, from D:2024-01-08 to D:2026-01-07 \(Prafful 91\)/.test(t)); assert.ok(/Of your 8 holdings: 2 can be dated exactly, 2 partly, 2 need a look, 1 have no trades, 1 already dated/.test(t));
  assert.ok(/Apply real buy dates to 2 holdings/.test(t), "only the exact ones until a partly one is ticked"); assert.ok(!/data-act="bt-apply" disabled/.test(html));
  const ticked = V.panel(model(items, { choices: new Set(["Me|Zerodha|S1"]) }), o); assert.ok(/Apply real buy dates to 3 holdings/.test(text(ticked))); assert.ok(/data-key="Me\\|Zerodha\\|S1" checked/.test(ticked) && !/data-key="Me\\|Zerodha\\|S2" checked/.test(ticked));
  assert.ok(/Date the 6, leave 4 unknown/.test(t));
  assert.ok(/Will be dated/.test(t) && /Dated/.test(t));
  // a ticked key for a position that is already dated is not counted
  assert.ok(/Apply real buy dates to 2 holdings/.test(text(V.panel(model(items, { choices: new Set(["Me|Zerodha|D1"]) }), o))));
  // nothing to apply: the button says so and is disabled
  const none = V.panel(model([item("N1", "none"), item("C1", "check")]), o); assert.ok(/disabled/.test(none) && /Nothing to apply/.test(text(none)));
  assert.ok(/Apply real buy dates to 1 holding\b/.test(text(V.panel(model([item("E1", "exact")]), o))), "singular");
  assert.ok(/1 trade kept/.test(text(V.panel(model([item("E1", "exact")], { tradeCount: 1, range: null, byOwner: {} }), o))));
  // lots and dates are shown
  assert.ok(/2 lots · D:2025-01-10 → D:2025-03-10/.test(t));
}
// owners shown by name; a zero count is left out
assert.ok(/Prafful 40, Archana 51/.test(text(V.panel(model([item("A", "exact")], { byOwner: { Me: 40, Wife: 51 } }), o))) && !/Archana 0/.test(text(V.panel(model([item("A", "exact")]), o))));
// files read
{
  const files = [{ name: "tradebook (2).csv", format: "zerodha-tradebook", added: 85, duplicates: 6, skipped: 2, errors: [] }, { name: "holdings.csv", format: null, added: 0, duplicates: 0, skipped: 0, errors: ["This file is not a Zerodha tradebook or a Groww order history."] }, { name: "g.csv", format: "groww-history", added: 1, duplicates: 0, skipped: 0, errors: ["Line 2: not a usable trade.", "Line 5: not a usable trade.", "Line 9: x"] }];
  const t = text(V.panel(model([item("A", "exact")], { files }), o));
  assert.ok(/tradebook \(2\)\.csv Zerodha tradebook 85 new trades, 6 already kept, 2 non-equity trades skipped/.test(t)); assert.ok(/holdings\.csv not read This file is not a Zerodha tradebook/.test(t));
  assert.ok(/1 new trade, 0 already kept\. Line 2: not a usable trade\. Line 5: not a usable trade\. \(\+1 more\)/.test(t));
}
// the files-in-vault notice and the unsupported-source note are present
assert.ok(/encrypted, in your vault/.test(text(V.panel(model([]), o))) && /Zerodha Console/.test(text(V.panel(model([]), o))));
// shares the files still show
{ const m = model([item("A", "exact")]); m.recon.soldSince = [{ symbol: "WIPRO", owner: "Me", demat: "Zerodha", qty: 43, last: "2024-11-18" }]; const t = text(V.panel(m, o)); assert.ok(/In the files but no longer held/.test(t) && /WIPRO · Prafful 43 shares/.test(t) && /record the sale on the Dashboard/.test(t)); assert.ok(!/In the files but no longer held/.test(text(V.panel(model([item("A", "exact")]), o)))); }
// everything that comes from a file or from the data is escaped
{
  const evil = '<img src=x onerror=alert(1)>';
  const m = model([item(evil, "short", { note: evil, key: evil, demat: evil })], { files: [{ name: evil, format: "zerodha-tradebook", added: 1, duplicates: 0, skipped: 0, errors: [evil] }], choices: new Set([evil]) });
  m.recon.soldSince = [{ symbol: evil, owner: evil, demat: "", qty: 1, last: "2024-01-01" }];
  const html = V.panel(m, { ...o, names: { Me: evil, Wife: evil } }); assert.ok(!/<img/.test(html) && /&lt;img/.test(html));
}
console.log("broker-trades-views: ok");
