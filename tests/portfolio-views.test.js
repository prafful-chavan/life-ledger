// The Portfolio mix card: ring, pivot (type × owner), expandable rows, and the comparison with a reference mix.
const assert = require("assert");
const V = require("../portfolio-views.js");
const P = require("../portfolio-core.js");
const { groupOf } = require("../advisor-engine.js");
const { noOverlap } = require("./helpers/chart-overlap.js");

const fmt = { inr: (n) => "₹" + Math.round(n).toLocaleString("en-IN"), pct: (n, d = 0) => Number(n).toFixed(d) + "%" };
const names = { Me: "Prafful", Wife: "Archana" };
const EVIL = "<img src=x onerror=alert(1)>";
const pos = [
  { kind: "mf", name: "Axis Large Cap Fund " + EVIL, owner: "Me", value: 400000 }, { kind: "mf", name: "HDFC Corporate Bond Fund", owner: "Wife", value: 50000 }, { kind: "mf", name: "ICICI Multi Asset Fund", owner: "Me", value: 100000 },
  { kind: "stock", name: "TCS", owner: "Me", value: 150000 }, { kind: "us", name: "QQQ", owner: "Me", value: 80000 }, { kind: "gold", name: "Chain", owner: "Wife", value: 150000 },
  { kind: "fd", name: "SBI FD", owner: "Wife", value: 100000 }, { kind: "vehicle", name: "Car", owner: "Me", value: 300000 },
];
const make = (ui, o) => {
  const alloc = P.allocate(pos, { groupOf, includeOther: Boolean(ui.includeOther) });
  const ref = P.referenceFor(ui.reference || "balanced", { target: { equity: 65, gold: 10, debt: 20, cash: 5 }, ages: [31, 29] });
  return V.portfolio({ alloc, ref, rows: P.compare(alloc.groups, ref, alloc.total), ui: { view: "kind", reference: "balanced", open: [], includeOther: false, ...ui } }, { fmt, names, ...(o || {}) });
};
const clean = (html, msg) => assert.ok(!/NaN|undefined|\[object|Infinity/.test(html), (msg || "") + " " + (html.match(/.{30}(NaN|undefined|\[object|Infinity).{30}/) || [""])[0]);

let html = make({});
clean(html); assert.ok(!html.includes(EVIL) && !/<img src=x/.test(html), "names from the data are escaped");
assert.ok(html.includes("Prafful") && html.includes("Archana"), "owners are named"); assert.ok(html.includes("<svg") && html.includes("dc-donut") && html.includes("pf-legend"), "a ring and its legend");
assert.ok(html.includes("Mutual funds") && html.includes("Indian stocks &amp; ETFs") && html.includes("Gold") && html.includes("Fixed deposits"), "kinds are listed");
assert.ok(!html.includes("Vehicles"), "vehicles are left out of an investments-only view"); assert.ok(html.includes("₹3,00,000 of other assets"), "…and the note says how much was left out"); assert.ok(html.includes('data-act="pf-other"'));
assert.ok(html.includes('data-act="pf-view" data-id="kind"') && html.includes('data-act="pf-view" data-id="group"') && html.includes('data-act="pf-ref" data-id="target"') && html.includes('data-act="pf-ref" data-id="age"'));
assert.ok(html.includes(`<tr class="pf-total">`) && html.includes("₹10,30,000"), "the total row");
noOverlap(html.match(/<svg class="dc-svg dc-donut"[\s\S]*?<\/svg>/)[0], "ring centre");
// shares in the pivot add up to the whole
const shares = [...html.matchAll(/class="pf-main"[\s\S]*?<span>([\d.]+)%<\/span>/g)].map((m) => Number(m[1])); assert.ok(Math.abs(shares.reduce((t, v) => t + v, 0) - 100) < 0.5, "pivot shares add to about 100: " + shares);
// expanding a row shows its parts and holdings
html = make({ open: ["mf"] }); clean(html); assert.ok(!html.includes(EVIL) && html.includes("Axis Large Cap Fund &lt;img"), "a fund name with markup is shown as text");
assert.ok(html.includes('aria-expanded="true"') && html.includes("Equity funds") && html.includes("Hybrid &amp; multi-asset funds") && html.includes("Debt funds") && html.includes("HDFC Corporate Bond Fund"), "an opened row shows fund types and holdings");
assert.ok(make({}).includes('aria-expanded="false"') && !make({}).includes("HDFC Corporate Bond Fund"), "a closed row hides them");
assert.ok(!make({ open: ["nonsense"] }).includes("pf-sub"), "an unknown row key opens nothing");
// a long list is cut with a count
const many = Array.from({ length: 12 }, (_, i) => ({ kind: "stock", name: "S" + i, owner: "Me", value: 1000 + i }));
const big = V.portfolio({ alloc: P.allocate(many, { groupOf }), ref: P.referenceFor("balanced"), rows: [], ui: { view: "kind", reference: "balanced", open: ["stock"] } }, { fmt, names });
assert.strictEqual((big.match(/class="pf-sub"/g) || []).length, V.SHOW_HOLDINGS + 1, "eight holdings and a '+ n smaller' line"); assert.ok(big.includes("+ 4 smaller holdings"));
// other view: what the money is in
html = make({ view: "group" }); clean(html); assert.ok(html.includes("What it is in") && html.includes("Equity") && html.includes("Debt") && !html.includes('data-act="pf-open"'), "the exposure view has no expanding rows");
// including every asset
html = make({ includeOther: true }); clean(html); assert.ok(html.includes("Vehicles") && html.includes("₹13,30,000") && html.includes("Investments only") && html.includes("all assets"), "everything counted, as in Finance");
// comparison with a reference
html = make({ reference: "balanced" }); assert.ok(html.includes("Your mix against a reference") && html.includes("Balanced (60 / 25 / 10 / 5)") && html.includes("pf-g-equity") && /In range|Above|Below/.test(html));
assert.ok(html.includes("information, not an instruction") && html.includes("7 percentage points"), "the wording is information, not advice");
for (const id of ["target", "balanced", "aggressive", "conservative", "age"]) { const h2 = make({ reference: id }); clean(h2, id); assert.ok(h2.includes("pf-bar-row") && h2.includes("<th>Gap</th>"), id + ": both bars and the gap table"); }
assert.ok(make({ reference: "age" }).includes("100 minus age"));
const noRef = V.portfolio({ alloc: P.allocate(pos, { groupOf }), ref: null, rows: [], ui: { view: "kind", reference: "target", open: [] } }, { fmt, names }); clean(noRef); assert.ok(noRef.includes("Set a target mix"), "no reference: says how to get one");
// empty
assert.ok(V.portfolio({ alloc: P.allocate([], { groupOf }), ref: null, rows: [], ui: {} }, { fmt, names }).includes("Add holdings"));
assert.ok(V.portfolio({ alloc: null, ref: null, rows: [], ui: {} }, { fmt, names }).includes("Add holdings"));
// a single owner and a single holding
const solo = V.portfolio({ alloc: P.allocate([{ kind: "fd", name: "FD", owner: "Me", value: 500 }], { groupOf }), ref: P.referenceFor("balanced"), rows: P.compare(P.allocate([{ kind: "fd", name: "FD", owner: "Me", value: 500 }], { groupOf }).groups, P.referenceFor("balanced"), 500), ui: { view: "kind", reference: "balanced", open: [] } }, { fmt, names }); clean(solo); assert.ok(solo.includes("dc-donut") && solo.includes("<circle"), "one slice is a ring");
console.log("portfolio-views: all checks passed");
