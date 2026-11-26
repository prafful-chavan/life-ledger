// Share profit and loss by person, broker and year: the app's sales beside the broker's own report.
const assert = require("assert");
const P = require("../pnl-core.js"), L = require("../mcp/pnl-load.js"), W = require("../pnl-views.js");
const sale = (owner, demat, soldOn, gain) => ({ owner, demat, soldOn, gain });
const line = (o = {}) => ({ owner: "Me", broker: "Groww", fy: "2024-25", realised: 100, charges: 10, dividends: 5, to: "2025-03-31", source: "r.xlsx", ...o });
const row = (sales, sts, fy = "2024-25") => { const v = P.build(sales, sts); const r = v.people.flatMap((p) => p.brokers.flatMap((b) => b.years)).find((x) => x.fy === fy); return r; };

// the financial year turns on 1 April
assert.deepStrictEqual(["2025-03-31", "2025-04-01", "2025-12-31", "2026-01-01", "2099-04-01"].map(P.fyOf), ["2024-25", "2025-26", "2025-26", "2025-26", "2099-00"]);
assert.deepStrictEqual(["", "2025-4-1", null, "yesterday"].map(P.fyOf), ["", "", "", ""]);

// a line is placed only with an owner, a broker, a real year and at least one figure; blanks stay unknown, zero stays zero
assert.strictEqual(P.statement(null), null); assert.strictEqual(P.statement(line({ owner: "" })), null); assert.strictEqual(P.statement(line({ broker: " " })), null);
assert.strictEqual(P.statement(line({ fy: "2024-26" })), null); assert.strictEqual(P.statement(line({ fy: "24-25" })), null);
assert.strictEqual(P.statement(line({ realised: null, charges: "", dividends: undefined })), null);
assert.deepStrictEqual((({ realised, options, charges, dividends }) => [realised, options, charges, dividends])(P.statement(line({ realised: 0, charges: null, dividends: "abc" }))), [0, null, null, null]);
assert.strictEqual(P.statement(line({ fy: "", realised: null })).fy, ""); assert.strictEqual(P.statement(line({ to: "soon" })).to, ""); assert.strictEqual(P.statement(line()).id, "bst-Me-Groww-2024-25");
assert.deepStrictEqual(P.clean([line({ to: "2025-01-01", realised: 1 }), line({ to: "2025-03-31", realised: 2 }), line({ to: "2025-02-01", realised: 3 }), {}]).map((s) => s.realised), [2], "the report reaching furthest wins");
assert.deepStrictEqual(P.clean("x"), []);

// match / differs: under a rupee is rounding, a rupee is a difference
for (const [app, status] of [[100, "match"], [100.99, "match"], [99.01, "match"], [101, "differs"], [99, "differs"]]) { const r = row([sale("Me", "Groww", "2025-01-01", app)], [line()]); assert.deepStrictEqual([r.status, r.shown, r.reported, r.app], [status, 100, 100, app], String(app)); }
assert.strictEqual(row([sale("Me", "Groww", "2025-01-01", 102.25)], [line()]).diff, 2.25);
// a report that ends before the last sale is out of date: the app's figure shows. Ending on that day is enough
let r = row([sale("Me", "Groww", "2025-03-31", 70)], [line({ to: "2025-03-30" })]); assert.deepStrictEqual([r.status, r.shown, r.latest, r.to], ["older", 70, "2025-03-31", "2025-03-30"]);
assert.strictEqual(row([sale("Me", "Groww", "2025-03-31", 100)], [line({ to: "2025-03-31" })]).status, "match");
// no report: the app's own figure, charges unknown, never zero
r = row([sale("Me", "Groww", "2025-01-01", 40), sale("Me", "Groww", "2025-02-01", -10.004)], []); assert.deepStrictEqual([r.status, r.shown, r.count, r.charges, r.dividends], ["app", 30, 2, null, null]);
// a broker figure with no sale in the app is a difference, a zero figure with no sale is quiet unless it has charges
assert.deepStrictEqual((({ status, shown, count }) => [status, shown, count])(row([], [line()])), ["differs", 100, 0]);
assert.strictEqual(row([], [line({ realised: 0, charges: 0, dividends: 0 })]), undefined);
assert.strictEqual(row([], [line({ realised: 0, charges: 3, dividends: 0 })]).status, "match");
assert.strictEqual(row([], [line({ realised: null, charges: null, dividends: 7 })]).status, "none");
assert.strictEqual(row([], [line({ fy: "", realised: null, charges: 12.5, dividends: null })], "").status, "extra");

// totals: profit as shown, options and charges taken off, dividends apart; years with sales but no charges are counted as unknown
const sales = [sale("Wife", "Groww", "2025-05-01", -50), sale("Me", "Zerodha", "2020-09-01", -20), sale("Me", "Groww", "2025-01-01", 100.5), sale("Me", "Groww", "2026-05-01", 25), sale("Me", "", "2025-05-05", 1), { owner: "Me", demat: "Groww", soldOn: "bad", gain: 999 }, null];
const sts = [line(), line({ broker: "Zerodha", fy: "2020-21", realised: -20, options: -5, charges: 3, dividends: null }), line({ broker: "Zerodha", fy: "", realised: null, charges: 2, dividends: null })];
const v = P.build(sales, sts);
assert.deepStrictEqual(v.people.map((p) => p.owner), ["Me", "Wife"]); assert.deepStrictEqual(v.people[0].brokers.map((b) => b.broker), ["Groww", "Not named", "Zerodha"]);
assert.deepStrictEqual(v.people[0].brokers[0].years.map((y) => y.fy), ["2026-27", "2024-25"], "latest year first");
assert.deepStrictEqual(v.people[0].brokers[2].years.map((y) => y.fy), ["2020-21", ""], "the line for no year comes last");
assert.deepStrictEqual(v.totals, { profit: 56, options: -5, charges: 15, dividends: 5, sales: 5, chargesUnknown: 3, differs: 0, after: 36 });
assert.deepStrictEqual(v.people[1].totals, { profit: -50, options: null, charges: null, dividends: null, sales: 1, chargesUnknown: 1, differs: 0, after: -50 });
assert.deepStrictEqual(v.years.map((y) => [y.fy, y.byOwner, y.total]), [["2026-27", { Me: 25 }, 25], ["2025-26", { Wife: -50, Me: 1 }, -49], ["2024-25", { Me: 100 }, 100], ["2020-21", { Me: -25 }, -25]]);
assert.deepStrictEqual(P.build(null, null), { people: [], totals: { profit: 0, options: null, charges: null, dividends: null, sales: 0, chargesUnknown: 0, differs: 0, after: 0 }, years: [] });

// the panel: paise shown, text escaped, unknown stays unknown, rows open on request
const o = { names: { Me: "Prafful", Wife: "Archana" } };
let html = W.panel(v, o); assert.ok(!/NaN|undefined|Infinity/.test(html)); assert.ok(/Prafful/.test(html) && /Archana/.test(html) && /not known/.test(html) && !/pf-sub/.test(html));
html = W.panel({ ...v, open: ["Me|Groww"] }, o); assert.strictEqual((html.match(/class="pf-sub"/g) || []).length, 2); assert.ok(/✓ Matches the broker \(₹0.50 rounding\)/.test(html) && /No broker report/.test(html) && /\+₹100\.00/.test(html));
const bad = P.build([sale("Me", '<img src=x onerror=1>', "2025-01-01", 5)], [line({ broker: '<img src=x onerror=1>', realised: 7.47, note: '"<b>' })]); html = W.panel({ ...bad, open: ['Me|<img src=x onerror=1>'] }, o);
assert.ok(!/<img|<b>/.test(html)); assert.ok(/2\.47 below the broker|₹2\.47 below/.test(html), html);
assert.ok(/above the broker/.test(W.check({ status: "differs", app: 10, diff: 2 }))); assert.ok(/ends 30 Mar 2025, before the last sale on 31 Mar 2025/.test(W.check({ status: "older", to: "2025-03-30", latest: "2025-03-31" })));
assert.ok(/No sales recorded yet/.test(W.panel(P.build([], []), o)));

// the loader: all or nothing, only brokerStatements changes
const data = { sales, brokerStatements: [], goals: [1] };
for (const [list, why] of [[[], /no broker lines/], [null, /no broker lines/], [[line(), {}], /Line 2 cannot be placed/], [[line({ to: "" })], /how far/], [[line({ source: "" })], /name its report/], [[line(), line()], /same owner/]]) assert.match(L.build(data, list).error, why);
const out = L.build(data, sts.map((s) => ({ ...s, to: "2026-01-01", source: "f" }))); assert.strictEqual(out.ok, true); assert.deepStrictEqual([out.report.lines, out.report.previous, out.after.brokerStatements.length], [3, 0, 3]); assert.strictEqual(L.guard(data, out.after), true);
assert.strictEqual(L.guard(data, { ...out.after, goals: [] }), false); assert.strictEqual(L.guard(data, { ...out.after, sales: [] }), false); assert.strictEqual(L.guard(data, { ...out.after, extra: 1 }), false);
assert.strictEqual(L.guard(data, { ...out.after, brokerStatements: [] }), false); assert.strictEqual(L.guard(data, { ...out.after, brokerStatements: [{ owner: "Me" }] }), false); assert.strictEqual(L.guard(data, { ...data, brokerStatements: undefined }), false);
console.log("pnl-core: ok");
assert.strictEqual(L.guard(data, { ...data, brokerStatements: P.clean([line()]) }), true, "one line is enough");
assert.strictEqual(row([{ owner: "Me", demat: "Groww", soldOn: "2025-01-01" }, sale("Me", "Groww", "2025-01-02", 4)], []).app, 4, "a sale with no gain adds nothing");
assert.strictEqual(P.build([], [line({ charges: null })]).totals.chargesUnknown, 0, "a year with no sale in the app has no unknown charges to flag");
