// The markup of the three Dashboard cards: text from the data is escaped, numbers are shown, empty states are quiet, forms carry the hooks the page needs.
const assert = require("assert");
const V = require("../upkeep-views.js");
const S = require("../sales-core.js");
const B = require("../breakdown-core.js");
const P = require("../portfolio-core.js");
const { groupOf } = require("../advisor-engine.js");

const fmt = { inr: (n) => "₹" + Math.round(n).toLocaleString("en-IN"), pct: (n, d = 0) => `${Number(n).toFixed(d)}%` };
const o = { fmt, names: { Me: "Prafful", Wife: "Archana" }, today: "2026-11-13" };
const EVIL = `<img src=x onerror="alert(1)">`;
const noRaw = (html) => assert.ok(!/<img|onerror=|<script/i.test(html.replace(/&lt;img[^]*?&gt;/g, "")), "unescaped markup: " + html.slice(0, 200));

// ── stale ──
assert.strictEqual(V.stale({ rows: [], checked: 3, fresh: 3, worth: 0 }, o), "", "nothing out of date: no card");
assert.strictEqual(V.stale(null, o), "");
{
  const rows = [{ coll: "fd", id: "fd-1", kind: "Fixed deposits", owner: "Me", name: EVIL, value: 1500000, asOf: "2026-05-25", ageDays: 172, limit: 90, undated: false },
    { coll: "banksaving", id: "b-2", kind: "Bank savings", owner: "Wife", name: "Wife bank", value: 20000.5, asOf: "", ageDays: null, limit: 30, undated: true }];
  const html = V.stale({ rows, checked: 5, fresh: 3, worth: 1520000.5 }, o);
  noRaw(html);
  assert.ok(html.includes("&lt;img"), "the name is shown, escaped");
  assert.ok(/2<\/strong> values you typed in are older/.test(html) && html.includes("₹15,20,001") && html.includes("3 others are up to date"));
  assert.ok(html.includes("172 days old (updated 25 May 2026)") && html.includes("no date recorded"));
  assert.ok(html.includes('data-coll="fd"') && html.includes('data-id="fd-1"') && html.includes('data-act="stale-save"') && html.includes('data-act="stale-ok"'));
  assert.ok(html.includes("Prafful") && html.includes("Archana"));
  assert.ok(html.includes('value="20000.5"'), "the box starts at the current value");
  assert.ok(/checked every 90 days/.test(html) && /checked every 30 days/.test(html));
  // one value reads naturally
  const one = V.stale({ rows: [rows[0]], checked: 1, fresh: 1, worth: 5 }, o);
  assert.ok(/1<\/strong> value you typed in is older/.test(one) && /1 other is up to date/.test(one) && /rests on it\./.test(one));
}

// ── sales ──
const cand = { id: "salecand-1", key: "K", symbol: "WIPRO", name: EVIL, owner: "Me", demat: "Zerodha", qty: 90, cost: 22500, lots: [{ buyDate: "2026-11-11", buyDateKnown: false, qty: 90, cost: 22500 }], lastPrice: 198.5, whole: true, detectedOn: "2026-11-13" };
{
  const empty = V.sales({ pending: [], sales: [], showForm: false }, o);
  assert.ok(/Nothing is waiting/.test(empty) && empty.includes('data-act="sale-form"') && !empty.includes("<table"));
  const html = V.sales({ pending: [cand], sales: [], showForm: false }, o);
  noRaw(html);
  assert.ok(html.includes('data-cand="salecand-1"') && html.includes("90 shares left your holdings") && html.includes("₹22,500") && html.includes("Prafful · Zerodha"));
  assert.ok(html.includes('data-act="sale-record"') && html.includes('data-act="sale-dismiss"') && html.includes('data-field="price"') && html.includes('value="198.5"'));
  assert.ok(/replace it with your contract note price/.test(html), "the filled-in price is called what it is: the last market price");
  assert.ok(html.includes('data-field="buyDate"') && /term unknown/.test(html), "an unknown buy date asks for one and says what happens without it");
  assert.ok(!/Nothing is waiting/.test(html));
  // with a real buy date there is no buy date box and no warning
  const known = V.sales({ pending: [{ ...cand, lots: [{ buyDate: "2023-01-01", buyDateKnown: true, qty: 90, cost: 22500 }] }], sales: [] }, o);
  assert.ok(!known.includes('data-field="buyDate"') && !/term unknown/.test(known));
  // one share, and no last price: no price pre-filled and no note about it
  const one = V.sales({ pending: [{ ...cand, qty: 1, lastPrice: 0 }], sales: [] }, o);
  assert.ok(/1 share left your holdings/.test(one) && !/replace it with/.test(one) && /data-field="price" value=""/.test(one));
  // a manual candidate does not claim it was "found" by a sync
  assert.ok(!V.sales({ pending: [{ ...cand, manual: true }], sales: [] }, o).includes("found on"));
  const form = V.sales({ pending: [], sales: [], showForm: true }, o);
  for (const f of ["symbol", "name", "owner", "demat", "qty", "avgCost", "buyDate", "price", "date", "charges", "credit"]) assert.ok(form.includes(`data-field="${f}"`), f);
  assert.ok(form.includes('data-cand="manual"') && form.includes('max="2026-11-13"') && !/Nothing is waiting/.test(form));
  // recorded sales
  const sale = S.buildSale(cand, { price: 200, date: "2026-11-11", charges: 25 }, { today: "2026-11-13" }).sale;
  const listed = V.sales({ pending: [], sales: [{ ...sale, term: "unknown" }, { ...sale, id: "s2", gain: 100, term: "long", charges: 0 }, { ...sale, id: "s3", term: "mixed" }, { ...sale, id: "s4", term: "short" }] }, o);
  noRaw(listed);
  assert.ok(listed.includes("11 Nov 2026") && listed.includes("₹17,975") && listed.includes("after ₹25 charges") && listed.includes("−₹4,525") && listed.includes("+₹100"));
  for (const t of ["Term unknown", "Long-term", "Part long, part short", "Short-term"]) assert.ok(listed.includes(t), t);
  assert.ok(listed.includes('data-act="sale-del"') && listed.includes('data-id="s2"') && /feed the Tax page/.test(listed));
  assert.strictEqual((listed.match(/after ₹25 charges/g) || []).length, 3, "a sale with no charges shows no charges line");
  assert.ok(/dv-delta bad/.test(listed) && /dv-delta good/.test(listed));
  assert.ok(V.sales(null, o).includes("Nothing is waiting"));
}

// ── breakdown ──
{
  const helpers = { mfValue: (t) => t.reduce((s, x) => s + (x.value || 0), 0), stockValue: (t) => t.reduce((s, x) => s + (x.value || 0), 0), usStockValue: () => 0, goldValue: (g) => g.value || 0 };
  const state = { mutualFunds: [{ fundName: "Nippon India Pharma Fund Direct Growth", owner: "Me", value: 900000 }, { fundName: `<b>Flexi</b> ${EVIL} Flexi Cap`, owner: "Wife", value: 100000 }, { fundName: "Mystery Opportunities", owner: "Me", value: 50000 }], stocks: [{ symbol: "TCS", company: "TCS", owner: "Me", demat: "A", value: 100000, category: "Equity" }] };
  const bd = B.breakdown(P.positionsOf(state, helpers), groupOf);
  const gains = B.gainsView([{ owner: "Me", name: "A", cat: "equity", gain: 50000, long: true, termUnknown: false }, { owner: "Me", name: EVIL, cat: "equity", gain: -30000, long: false, termUnknown: false }, { owner: "Me", name: "U", cat: "equity", gain: 5, long: null, termUnknown: true }], { owners: { Me: { equityLT: 70000, equityST: 1000, unknownTerm: -300 } } }, { exemption: 125000 });
  const html = V.breakdown({ bd, gains, exemption: 125000, open: [] }, o);
  noRaw(html);
  assert.ok(html.includes("Equity ₹11,50,000") && html.includes("Sector &amp; thematic") && html.includes("Direct stocks") && html.includes("Not classified"));
  assert.ok(html.includes('data-act="bd-open"') && html.includes('aria-expanded="false"') && !html.includes("pf-sub"), "closed: no holding rows");
  assert.ok(html.includes("Biggest holdings") && html.includes("Pharma &amp; healthcare") && html.includes("Nippon India Pharma Fund Direct Growth"));
  assert.ok(html.includes("Overlap between funds") && html.includes("Mystery Opportunities"));
  assert.ok(html.includes("₹55,000") && html.includes("of ₹1,25,000; ₹70,000 used"), "the limit left and used");
  assert.ok(html.includes("−₹300 term unknown") && html.includes("1 lot with no real buy date not counted"));
  assert.ok(html.includes("−₹30,000"), "the biggest loss");
  assert.ok(/not advice/.test(html));
  const opened = V.breakdown({ bd, gains: [], exemption: 125000, open: ["sector"] }, o);
  noRaw(opened);
  assert.ok(opened.includes('aria-expanded="true"') && opened.includes("pf-sub") && opened.includes("Nippon India Pharma Fund Direct Growth") && !/This year's gains/.test(opened), "no gains block without gains");
  // no limit → a dash, never a made-up number
  const noLimit = V.breakdown({ bd, gains: B.gainsView([], { owners: { Me: { equityLT: 1 } } }, {}), exemption: null, open: [] }, o);
  assert.ok(/Tax-free limit left<\/th>/.test(noLimit) && !/NaN|undefined/.test(noLimit));
  assert.ok(V.breakdown({ bd: { total: 0, buckets: [], top: [], sectors: [], notes: [] } }, o).includes("No equity holdings"));
  assert.ok(V.breakdown(null, o).includes("No equity holdings"));
  assert.ok(!/NaN|undefined|Infinity/.test(html));
}
assert.strictEqual(V.dateText("2026-02-05"), "5 Feb 2026"); assert.strictEqual(V.dateText(""), "—"); assert.strictEqual(V.dateText("garbage"), "—");
console.log("upkeep-views: ok");
