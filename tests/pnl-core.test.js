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

// ── Three kinds: Indian shares, mutual funds, US stocks ──
{
  // a line without a kind (the ones already saved) is a share line and keeps its id; a wrong kind falls back to shares
  assert.deepStrictEqual([P.statement(line()).kind, P.statement(line()).id, P.statement(line({ kind: "gold" })).kind], ["shares", "bst-Me-Groww-2024-25", "shares"]);
  assert.deepStrictEqual([P.statement(line({ kind: "mf" })).id, P.statement(line({ kind: "us" })).id], ["bst-mf-Me-Groww-2024-25", "bst-us-Me-Groww-2024-25"]);
  assert.strictEqual(P.clean([line(), line({ kind: "mf" }), line({ kind: "us" })]).length, 3, "same broker and year, three kinds: three lines");
  // fund lots → one sale per person, fund and day
  const lot = (owner, name, sellDate, cost, proceeds, kind = "mf") => ({ kind, owner, name, sellDate, cost, proceeds });
  const fs_ = P.fundSales([lot("Me", "A", "2025-06-01", 10, 15), lot("Me", "A", "2025-06-01", 20, 22.006), lot("Me", "B", "2025-06-01", 5, 4), lot("Wife", "A", "2025-06-01", 1, 3), lot("Me", "A", "bad", 1, 9), lot("Me", "S", "2025-06-01", 1, 9, "stock"), null]);
  assert.deepStrictEqual(fs_.map((s) => [s.owner, s.demat, s.soldOn, s.gain]), [["Me", "Groww", "2025-06-01", 7.01], ["Me", "Groww", "2025-06-01", -1], ["Wife", "Groww", "2025-06-01", 2]]);
  assert.deepStrictEqual(P.fundSales(null), []); assert.strictEqual(P.fundSales([lot("Me", "A", "2025-06-01T10:00", 1, 2)], "X")[0].demat, "X");
  const sts = [line({ realised: 100 }), line({ kind: "mf", fy: "2025-26", realised: 7, charges: null, dividends: null, to: "2026-03-31" }), line({ kind: "us", broker: "INDmoney", realised: 50, charges: null, dividends: 9 }), line({ kind: "us", broker: "INDmoney", fy: "2023-24", realised: 0, charges: null, dividends: 3, to: "2024-03-31" })];
  const all = P.buildAll({ sales: [sale("Me", "Groww", "2025-01-01", 100)], fundRealised: [lot("Me", "A", "2025-06-01", 10, 17)], statements: sts });
  // each kind sees only its own lines
  assert.deepStrictEqual([all.shares.totals.profit, all.mf.totals.profit, all.us.totals.profit], [100, 7, 50]);
  assert.deepStrictEqual(all.mf.people[0].brokers[0].years.map((y) => [y.fy, y.status]), [["2025-26", "match"]]);
  assert.deepStrictEqual(all.us.people[0].brokers[0].years.map((y) => [y.fy, y.status, y.shown, y.dividends]), [["2024-25", "report", 50, 9], ["2023-24", "report", 0, 3]], "a US year is the report's alone, never 'differs'");
  assert.deepStrictEqual(all.summary.map((r) => [r.kind, r.byOwner, r.total, r.dividends]), [["shares", { Me: 100 }, 100, 5], ["mf", { Me: 7 }, 7, null], ["us", { Me: 50 }, 50, 12]]);
  assert.deepStrictEqual([all.all.byOwner, all.all.total, all.all.dividends, all.all.charges, all.owners], [{ Me: 157 }, 157, 17, 10, ["Me"]]);
  // a fund sale with no report is the app's own figure
  assert.strictEqual(P.buildAll({ fundRealised: [lot("Wife", "A", "2025-06-01", 10, 17)] }).mf.people[0].brokers[0].years[0].status, "app");
  const two = P.buildAll({ sales: [sale("Wife", "Groww", "2025-01-01", -5)], fundRealised: [lot("Me", "A", "2025-06-01", 10, 17)] });
  assert.deepStrictEqual([two.owners, two.all.byOwner, two.all.total, two.summary.length], [["Me", "Wife"], { Me: 7, Wife: -5 }, 2, 2]);
  assert.deepStrictEqual([P.buildAll(null).summary, P.buildAll({}).all.total], [[], 0]);
  // the screen: summary, a section per kind, rows open by kind, nothing broken
  let v = W.panel({ ...all.shares, all, open: [] }, o);
  assert.ok(/Everything sold, all time/.test(v) && /Mutual funds sold/.test(v) && /US stocks sold/.test(v) && !/NaN|undefined|Infinity/.test(v) && !/pf-sub/.test(v));
  v = W.panel({ ...all.shares, all, open: ["us:Me|INDmoney"] }, o); assert.strictEqual((v.match(/class="pf-sub"/g) || []).length, 2); assert.ok(/From the broker's tax report/.test(v) && v.includes('data-id="mf:Me|Groww"') && v.includes('data-id="Me|Groww"'));
  v = W.panel({ ...all.shares, all, open: [] }, o); assert.ok(/from the broker's tax reports/.test(v) && !/0 sales/.test(v) && /1 sale</.test(v), "a kind with no sales in the app does not claim zero sales");
  assert.ok(!/Everything sold/.test(W.panel(all.shares, o)), "without the other kinds the screen is as before");
  assert.ok(/No sales recorded yet/.test(W.panel({ ...P.build([], []), all: P.buildAll({}) }, o)));
  // the loader takes the three kinds together
  const out = L.build({ sales: [sale("Me", "Groww", "2025-01-01", 100)], mutualFunds: [] }, sts.map((s) => ({ ...s, source: "f" }))); assert.strictEqual(out.ok, true); assert.deepStrictEqual([out.report.lines, [...new Set(out.report.rows.map((r) => r.kind))]], [4, ["shares", "mf", "us"]]);
}
console.log("pnl-core: three kinds ok");
{
  // options count in a fund/share summary; a lot with no proceeds or no cost counts that side as nothing
  const x = P.buildAll({ statements: [line({ realised: 100, options: -30 }), line({ owner: "Wife", realised: 1 })] });
  assert.deepStrictEqual([x.summary[0].byOwner, x.summary[0].total, x.all.total], [{ Me: 70, Wife: 1 }, 71, 71]);
  assert.deepStrictEqual(P.fundSales([{ kind: "mf", name: "A", sellDate: "2025-06-01", cost: 4 }, { kind: "mf", name: "B", sellDate: "2025-06-01", proceeds: 9 }, { kind: "mf", name: "C", sellDate: "2025-06-01T09:30:00", proceeds: 1, cost: 0 }]).map((s) => [s.owner, s.soldOn, s.gain]), [["Me", "2025-06-01", -4], ["Me", "2025-06-01", 9], ["Me", "2025-06-01", 1]]);
  // "Me" comes first whichever order the lines arrive in, in each kind and across kinds
  for (const order of [["Aaa", "Me", "Zed"], ["Zed", "Me", "Aaa"], ["Me", "Zed", "Aaa"]]) assert.deepStrictEqual(P.buildAll({ statements: order.map((owner) => line({ owner })) }).owners, ["Me", "Aaa", "Zed"]);
  assert.deepStrictEqual(P.buildAll({ statements: [line({ owner: "Zed" }), line({ owner: "Aaa", kind: "mf" }), line({ kind: "us" })] }).owners, ["Me", "Aaa", "Zed"]);
}
console.log("pnl-core: edges ok");
// a year whose figure is exactly nothing adds nothing to the year table
assert.deepStrictEqual(P.build([], [line({ realised: 0, options: null })]).years.map((y) => [y.total, y.byOwner]), [[0, { Me: 0 }]]);
