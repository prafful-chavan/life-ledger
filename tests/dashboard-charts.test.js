// The Salary and Spending dashboards' charts: the markup stays inside its box, never contains NaN, escapes text from the data,
// draws what it was given, and no two labels ever overlap.
const assert = require("assert");
const Ch = require("../dashboard-charts.js");

// ── escaping, rupees, scales ──
assert.strictEqual(Ch.esc(`<b>"R&D" 'x'</b>`), "&lt;b&gt;&quot;R&amp;D&quot; &#39;x&#39;&lt;/b&gt;"); assert.strictEqual(Ch.esc(null), ""); assert.strictEqual(Ch.esc(0), "0");
for (const [n, t] of [[0, "₹0"], [950, "₹950"], [999, "₹999"], [1000, "₹1k"], [12500, "₹12.5k"], [99999, "₹100k"], [100000, "₹1L"], [150000, "₹1.5L"], [199884, "₹2L"], [10000000, "₹1Cr"], [34000000, "₹3.4Cr"], [-1500, "−₹1.5k"], [-500, "−₹500"]]) assert.strictEqual(Ch.short(n), t, String(n));
for (const [v, n] of [[0, 1], [-5, 1], [1, 1], [1.1, 2], [2, 2], [2.1, 2.5], [2.6, 5], [5.1, 10], [199884, 200000]]) assert.ok(Math.abs(Ch.niceMax(v) - n) < 1e-12, `niceMax ${v}`);
assert.deepStrictEqual(Ch.niceTicks(0), { ticks: [0, 1], top: 1 }); assert.deepStrictEqual(Ch.niceTicks(-3), { ticks: [0, 1], top: 1 });
assert.deepStrictEqual(Ch.niceTicks(200000, 4), { ticks: [0, 50000, 100000, 150000, 200000], top: 200000 }, "round steps, never ₹62.5k");
assert.deepStrictEqual(Ch.niceTicks(230000, 4), { ticks: [0, 100000, 200000, 300000], top: 300000 }, "a step of 1, 2 or 5 × a power of ten");
assert.deepStrictEqual(Ch.niceTicks(100, 4).ticks, [0, 50, 100]); assert.deepStrictEqual(Ch.niceTicks(100.5, 4).top, 150 > 100.5 ? Ch.niceTicks(100.5, 4).top : 0);
assert.ok(Ch.niceTicks(137, 4).top >= 137, "the top is at least the largest value"); assert.ok(Ch.niceTicks(137, 4).ticks.every((t) => Number.isInteger(t)));
assert.strictEqual(Ch.labelStep(70), 1); assert.strictEqual(Ch.labelStep(64), 1); assert.strictEqual(Ch.labelStep(63.9), 3); assert.strictEqual(Ch.labelStep(21), 6); assert.strictEqual(Ch.labelStep(5.4), 12); assert.strictEqual(Ch.labelStep(2.7), 24); assert.strictEqual(Ch.labelStep(2.6), 60); assert.strictEqual(Ch.labelStep(1), 120);
assert.strictEqual(Ch.monthLabel("2026-09"), "Sep 2026"); assert.strictEqual(Ch.monthShort("2018-08"), "Aug 18");

// ── labels never touch ──
const w = (t) => Ch.textWidth(t);
let kept = Ch.placeLabels([{ x: 100, text: "₹2.6L", priority: 5 }, { x: 110, text: "₹2.8L", priority: 9 }, { x: 400, text: "₹7.7L", priority: 1 }]);
assert.deepStrictEqual(kept.map((k) => k.text), ["₹2.8L", "₹7.7L"], "of two labels that touch, the more important one stays; far ones stay");
kept = Ch.placeLabels([{ x: 0, text: "AA", priority: 1 }, { x: w("AA") + 4, text: "AA", priority: 1 }], 4);
assert.strictEqual(kept.length, 2, "exactly the gap apart is fine"); kept = Ch.placeLabels([{ x: 0, text: "AA", priority: 1 }, { x: w("AA") + 3.9, text: "AA", priority: 1 }], 4); assert.strictEqual(kept.length, 1, "a hair closer is not");
assert.deepStrictEqual(Ch.placeLabels([]), []); assert.deepStrictEqual(Ch.placeLabels([{ x: 5, text: "x" }]).length, 1);
kept = Ch.placeLabels([{ x: 300, text: "b", priority: 1 }, { x: 10, text: "a", priority: 2 }]); assert.deepStrictEqual(kept.map((k) => k.x), [10, 300], "returned left to right");
assert.strictEqual(Ch.placeLabels([{ x: 1, text: "a" }, { x: 2, text: "b" }], 0).length, 1, "no priority: the first wins");

// ── checks every chart must pass ──
const noNaN = (svg) => assert.ok(!/NaN|undefined|Infinity|null/.test(svg), "no NaN / undefined in the markup: " + (svg.match(/.{20}(NaN|undefined|Infinity|null).{20}/) || [""])[0]);
const nums = (svg, attrs) => [...svg.matchAll(new RegExp(`\\b(?:${attrs})="(-?[\\d.]+)"`, "g"))].map((m) => Number(m[1]));
const inside = (svg, W, H) => { assert.ok(nums(svg, "cx|x1|x2").every((c) => c >= -0.1 && c <= W + 0.1), "inside the width"); assert.ok(nums(svg, "cy|y1|y2").every((c) => c >= -0.1 && c <= H + 0.1), "inside the height"); };
const { noOverlap, texts } = require("./helpers/chart-overlap.js");
// the checker itself must catch an overlap
assert.throws(() => noOverlap('<text class="a" x="10" y="20">₹2.6L</text><text class="b" x="12" y="20">₹2.8L</text>'), /overlap/, "two labels on top of each other are caught");
assert.strictEqual(noOverlap('<text class="a" x="10" y="20">₹2.6L</text><text class="b" x="200" y="20">₹2.8L</text>'), 2, "far apart is fine");
assert.strictEqual(noOverlap('<text class="a" x="10" y="20">a</text><text class="b" x="10" y="60">b</text>'), 2, "different rows are fine");


// ── timeline ──
const ms = [];
for (let i = 0; i < 98; i++) { const ym = `${2018 + Math.floor((7 + i) / 12)}-${String(((7 + i) % 12) + 1).padStart(2, "0")}`; const oneOff = [40, 41, 60, 66, 72, 75, 78, 81, 84, 87, 90, 93].includes(i); ms.push({ ym, net: 10000 + i * 2000 + (oneOff ? 150000 + i * 3000 : 0), levelNet: 10000 + i * 2000, levelNetToday: 12000 + i * 2200, oneOff, tip: `tip ${ym} <b>` }); }
const jobs = [{ source: "Blazeclan", from: ms[0].ym, to: ms[29].ym }, { source: "A very long company name that cannot fit", from: ms[30].ym, to: ms[33].ym }, { source: "TCS", from: ms[34].ym, to: ms[97].ym }];
const changes = [{ month: ms[30].ym, text: "+52%", pct: 52 }, { month: ms[50].ym, text: "+9%", pct: 9 }];
let svg = Ch.timeline({ months: ms, jobs, changes, showReal: true, label: "Pay <timeline>" });
noNaN(svg); inside(svg, 900, 340); assert.ok(svg.includes('viewBox="0 0 900 340"')); assert.ok(svg.includes('aria-label="Pay &lt;timeline&gt;"'), "the label is escaped");
assert.ok(noOverlap(svg, "timeline") > 10, "there are labels, and none overlap even with a dozen cut-off one-offs");
assert.strictEqual((svg.match(/class="dc-hit"/g) || []).length, 98, "one clickable column per month"); assert.strictEqual((svg.match(/dc-col dc-col-oneoff/g) || []).length, 12); assert.strictEqual((svg.match(/class="dc-col"/g) || []).length, 86);
assert.ok(svg.includes('data-tip="tip 2018-08 &lt;b&gt;"'), "tooltip text is escaped");
assert.ok(svg.includes('class="dc-area"') && svg.includes('class="dc-level"') && svg.includes('class="dc-end"'), "area, steady line and end marker");
assert.ok(svg.includes('class="dc-real"') && !Ch.timeline({ months: ms, jobs, changes }).includes("dc-real"), "today's-rupees line only when asked");
assert.ok(svg.includes(">Blazeclan<") && !svg.includes("cannot fit") && svg.includes(">TCS<"), "wide jobs are named; a narrow band does not overflow with its full name");
assert.ok(svg.includes(">+52%<") && svg.includes(">+9%<"), "job changes carry their hike"); assert.strictEqual((svg.match(/class="dc-jobline"/g) || []).length, 2);
assert.ok(svg.includes('class="dc-cut"') && svg.includes('class="dc-cut-label"'), "a one-off taller than the chart is cut off and marked");
assert.ok(svg.includes('class="dc-cross"'), "a guide line for hovering");
assert.ok(/>2019</.test(svg) && />2026</.test(svg), "yearly labels for a long history");
// the scale is not flattened by the huge one-offs: the steady line fills the plot
const levelYs = [...svg.match(/class="dc-level" d="([^"]+)"/)[1].matchAll(/V([\d.]+)/g)].map((m) => Number(m[1]));
assert.ok(Math.min(...levelYs) < 150, "the steady pay reaches the upper part of the chart (not squashed by the one-offs)");
// one month, a short history, missing steady pay, empty
svg = Ch.timeline({ months: [{ ym: "2026-09", net: 1000, levelNet: 1000, oneOff: false }], jobs: [{ source: "A", from: "2026-09", to: "2026-09" }], changes: [] }); noNaN(svg); inside(svg, 900, 340); noOverlap(svg);
svg = Ch.timeline({ months: ms.slice(-6), jobs: [], changes: [] }); noNaN(svg); noOverlap(svg); assert.ok(/>(Apr|May|Jun|Jul|Aug|Sep) 26</.test(svg), "month labels for a short history");
svg = Ch.timeline({ months: [{ ym: "2026-01", net: 100, levelNet: null }, { ym: "2026-02", net: 100, levelNet: 100 }, { ym: "2026-03", net: 100, levelNet: 100 }], jobs: [], changes: [] }); noNaN(svg);
assert.strictEqual(Ch.timeline({ months: [], jobs: [] }), ""); noNaN(Ch.timeline({ months: [{ ym: "2026-01", net: 0, levelNet: 0 }, { ym: "2026-02", net: 0, levelNet: 0 }], jobs: [] }));
assert.ok(Ch.timeline({ months: ms, jobs, width: 400, height: 200 }).includes('viewBox="0 0 400 200"'));
// a change before the visible range is not drawn, so it cannot sit outside the chart
svg = Ch.timeline({ months: ms.slice(-12), jobs: [], changes: [{ month: ms[10].ym, text: "+99%", pct: 99 }] }); assert.ok(!svg.includes("+99%"), "a hike from before the range is left out");
// close job changes: only the bigger badge is kept
svg = Ch.timeline({ months: ms.slice(60), jobs: [], changes: [{ month: ms[70].ym, text: "+10%", pct: 10 }, { month: ms[71].ym, text: "+80%", pct: 80 }] }); assert.ok(svg.includes("+80%") && !svg.includes("+10%"), "two badges that would touch: the bigger hike wins");
// geometry: bigger is higher, later is further right
{
  const two = Ch.timeline({ months: [{ ym: "2026-01", net: 125, levelNet: 125 }, { ym: "2026-02", net: 500, levelNet: 500 }], jobs: [], changes: [] });
  const cols = [...two.matchAll(/class="dc-col" x="([\d.]+)" y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/g)].map((m) => ({ x: +m[1], y: +m[2], h: +m[3] }));
  assert.ok(cols[1].x > cols[0].x && cols[1].y < cols[0].y && cols[1].h > cols[0].h, "later is right; bigger is taller"); assert.ok(Math.abs(cols[1].h / cols[0].h - 4) < 0.1, "500 is four times 125");
  const hits = [...two.matchAll(/class="dc-hit" data-ym="[\d-]+" data-tip="[^"]*" x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/g)].map((m) => [+m[1], +m[2]]);
  assert.ok(Math.abs(hits[0][0] + hits[0][1] - hits[1][0]) < 0.2, "the clickable columns sit side by side");
}

// ── columns ──
const rows = Array.from({ length: 12 }, (_, i) => ({ ym: `2025-${String(i + 1).padStart(2, "0")}`, values: { fixed: 60000, flex: 40000 + i * 1000 }, cls: i === 5 ? "dc-flag" : "", tip: "t<" }));
svg = Ch.columns({ rows, series: [{ key: "fixed", cls: "dc-fixed" }, { key: "flex", cls: "dc-flex" }], label: "Spend", line: { cls: "dc-level", step: true, values: Object.fromEntries(rows.map((r) => [r.ym, 150000])) } });
noNaN(svg); inside(svg, 900, 260); noOverlap(svg, "columns"); assert.strictEqual((svg.match(/class="dc-fixed/g) || []).length, 12); assert.strictEqual((svg.match(/dc-flag/g) || []).length, 2);
assert.ok(svg.includes('class="dc-level"') && /d="M[\d.]+ [\d.]+(H[\d.]+V[\d.]+)+"/.test(svg), "a step line over the columns"); assert.ok(svg.includes('data-tip="t&lt;"'));
{
  const [a, b] = [...svg.matchAll(/<rect class="dc-(fixed|flex)[^>]*y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/g)].slice(0, 2).map((m) => ({ y: Number(m[2]), h: Number(m[3]) }));
  assert.ok(Math.abs(b.y + b.h - a.y) < 0.2, "the flexible part sits on top of the fixed part");
  const top = Number(svg.match(/class="dc-level" d="M[\d.]+ ([\d.]+)/)[1]); assert.ok(top < b.y, "the pay line (₹1.5L) is above the ₹1L columns, and the scale makes room for it");
}
const sr = [{ ym: "2026-01", values: { rate: 50 } }, { ym: "2026-02", values: { rate: -20 } }, { ym: "2026-03", values: { rate: 70 } }];
svg = Ch.columns({ rows: sr, series: [{ key: "rate", cls: "dc-rate" }], signed: true, fmt: (v) => `${Math.round(v)}%`, ref: { value: 55, label: "usual 55%" }, line: { cls: "dc-level", values: { "2026-01": 40, "2026-03": -30 } } });
noNaN(svg); inside(svg, 900, 260); noOverlap(svg, "signed columns"); assert.ok(svg.includes('class="dc-zero"') && svg.includes("usual 55%") && svg.includes('class="dc-ref"'));
assert.ok(/d="M[\d.]+ [\d.]+M[\d.]+ [\d.]+"/.test(svg), "a gap in the line values lifts the pen (no line drawn through a missing month)");
{
  const zeroY = Number(svg.match(/class="dc-zero"[^>]*y1="([\d.]+)"/)[1]); const neg = svg.match(/<rect class="dc-rate" x="[\d.]+" y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/g)[1].match(/y="([\d.]+)"/)[1];
  assert.ok(Math.abs(Number(neg) - zeroY) < 0.2, "a negative bar hangs from the zero line");
}
assert.ok(!Ch.columns({ rows: sr.map((r) => ({ ...r, values: { rate: Math.abs(r.values.rate) } })), series: [{ key: "rate", cls: "dc-rate" }], signed: true }).includes("dc-zero"), "no zero line when nothing is negative");
assert.strictEqual(Ch.columns({ rows: [], series: [] }), ""); noNaN(Ch.columns({ rows: [{ ym: "2026-01", values: {} }], series: [{ key: "x", cls: "c" }] })); noNaN(Ch.columns({ rows: [{ ym: "2026-01", values: { x: 0 } }], series: [{ key: "x", cls: "c" }] }));
assert.ok(Ch.columns({ rows: [{ ym: "2026-01", values: { x: 5 } }], series: [{ key: "x", cls: "a<b" }] }).includes('class="a&lt;b'), "class names are escaped");
{
  const two = Ch.columns({ rows: [{ ym: "2026-01", values: { a: 100 } }, { ym: "2026-02", values: { a: 400 } }], series: [{ key: "a", cls: "k" }] });
  const rs = [...two.matchAll(/<rect class="k" x="([\d.]+)" y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/g)].map((m) => ({ x: +m[1], y: +m[2], h: +m[3] }));
  assert.ok(rs[1].x > rs[0].x && rs[1].h > rs[0].h && rs[1].y < rs[0].y && Math.abs(rs[1].h / rs[0].h - 4) < 0.1, "later is right; 400 is four times as tall as 100"); assert.ok(Math.abs(rs[0].y + rs[0].h - (rs[1].y + rs[1].h)) < 0.2, "both stand on the same floor");
}
const long48 = Array.from({ length: 48 }, (_, i) => ({ ym: `${2022 + Math.floor((10 + i) / 12)}-${String(((10 + i) % 12) + 1).padStart(2, "0")}`, values: { a: 100 + i } })); svg = Ch.columns({ rows: long48, series: [{ key: "a", cls: "k" }] }); noOverlap(svg, "48 months"); noNaN(svg);

// ── bridge ──
svg = Ch.bridge({ items: [{ label: "Gross pay", value: 261564, kind: "total" }, { label: "Income tax (TDS)", value: -47961, kind: "delta" }, { label: "Provident fund", value: -9672, kind: "delta" }, { label: "Other deductions", value: -4000, kind: "delta" }, { label: "In your account", value: 199931, kind: "total", cls: "dc-b-net" }], label: "<x>" });
noNaN(svg); inside(svg, 640, 260); noOverlap(svg, "bridge"); assert.ok(svg.includes('aria-label="&lt;x&gt;"')); assert.strictEqual((svg.match(/class="dc-connect"/g) || []).length, 4, "a connector between each pair");
assert.ok(svg.includes("dc-b-total") && svg.includes("dc-b-down") && svg.includes("dc-b-net"), "totals, falls and the final figure are styled apart"); assert.ok(svg.includes(">−₹48k<") || svg.includes(">−₹47.9k<") || /−₹4\d(\.\d)?k</.test(svg), "a fall is written with a minus sign");
{
  const r = [...svg.matchAll(/<rect class="(dc-b-\w+)" x="[\d.]+" y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/g)].map((m) => ({ c: m[1], y: +m[2], h: +m[3] }));
  assert.ok(Math.abs(r[1].y - r[0].y) < 0.3, "the first fall hangs from the top of the gross column"); assert.ok(Math.abs((r[2].y) - (r[1].y + r[1].h)) < 0.3, "the next fall starts where the last one ended");
  assert.ok(Math.abs(r[4].y + r[4].h - (r[0].y + r[0].h)) < 0.3, "totals stand on the same floor");
}
svg = Ch.bridge({ items: [{ label: "A usual month", value: 100000, kind: "total" }, { label: "Big payments", value: 250000, kind: "delta" }, { label: "Aug 2026", value: 350000, kind: "total" }] }); noNaN(svg); noOverlap(svg); assert.ok(svg.includes(">+₹2.5L<"), "a rise is written with a plus sign"); assert.ok(svg.includes("dc-b-up"));
assert.strictEqual(Ch.bridge({ items: [] }), ""); noNaN(Ch.bridge({ items: [{ label: "x", value: 0, kind: "total" }] }));
noOverlap(Ch.bridge({ items: Array.from({ length: 7 }, (_, i) => ({ label: "A fairly long label number " + i, value: 1000 * (i + 1), kind: "total" })), width: 360 }), "narrow bridge");

// ── ladder ──
svg = Ch.ladder({ items: [{ label: "Blazeclan", value: 29027, text: "" }, { label: "HashedIn by Deloitte", value: 44033, text: "+52%" }, { label: "Quantiphi", value: 120194, text: "+173%" }, { label: "Jaguar Land Rover", value: 204208, text: "+56%" }, { label: "TCS", value: 261564, text: "+9%" }], label: "Pay by job" });
noNaN(svg); inside(svg, 720, 280); noOverlap(svg, "ladder"); for (const t of ["+52%", "+173%", "+56%", "+9%"]) assert.ok(svg.includes(`>${t}<`), t); assert.ok(!svg.includes(">+0%<"));
{ const bars = [...svg.matchAll(/<rect class="dc-b-total" x="[\d.]+" y="([\d.]+)"/g)].map((m) => +m[1]); assert.ok(bars.every((v, i) => i === 0 || v < bars[i - 1]), "each higher-paid job has a taller column"); }
assert.strictEqual(Ch.ladder({ items: [] }), ""); noNaN(Ch.ladder({ items: [{ label: "Only", value: 100, text: "" }] })); noOverlap(Ch.ladder({ items: [{ label: "Only", value: 100, text: "" }, { label: "Second company with a long name", value: 50, text: "−50%" }], width: 340 }));

// ── heat grid ──
const heat = Ch.heatmap({ heads: ["Jan 26", "Feb 26"], rows: [{ label: "Groc<eries>", cells: [{ text: "₹5k", level: 0, tip: "a" }, { text: "₹12k", level: 4, tip: "b" }] }, { label: "Rent", cells: [{ text: "·", level: 9 }, { text: "₹1", level: -3 }] }], label: "x" });
assert.ok(heat.includes("Groc&lt;eries&gt;") && heat.includes('class="dc-heat-cell l4"') && heat.includes('class="dc-heat-cell l0"')); assert.strictEqual((heat.match(/dc-heat-cell l4/g) || []).length, 2, "a level above 4 is clamped to 4"); assert.ok(heat.includes("repeat(2,"), "one grid column per month"); assert.strictEqual(Ch.heatmap({ heads: [], rows: [] }), "");
noNaN(heat);

// ── sparkline, bar, stack ──
assert.strictEqual(Ch.sparkline([1]), ""); assert.strictEqual(Ch.sparkline([]), ""); assert.strictEqual(Ch.sparkline(null), "");
noNaN(Ch.sparkline([5, 5, 5])); assert.ok(/d="M[\d. L]+"/.test(Ch.sparkline([1, 3, 2])) && Ch.sparkline([1, 3, 2]).includes("dc-spark-area")); noNaN(Ch.sparkline([1, NaN, 3]));
assert.ok(Ch.bar({ pct: 50 }).includes("width:50%") && Ch.bar({ pct: 150 }).includes("width:100%") && Ch.bar({ pct: -5 }).includes("width:0%") && Ch.bar({ pct: NaN }).includes("width:0%"));
assert.ok(Ch.bar({ pct: 10, markers: [{ pct: 80, cls: "m" }] }).includes("left:80%")); assert.ok(Ch.bar({ pct: 10, markers: [{ pct: 300 }] }).includes("left:100%"), "a marker past the end is clamped"); assert.ok(Ch.bar({ pct: 1, label: '"x"' }).includes('aria-label="&quot;x&quot;"'));
const st = Ch.stack([{ label: "A", value: 300, cls: "a" }, { label: "B", value: 100, cls: "b" }, { label: "Z", value: 0, cls: "z" }, { label: "N", value: -5, cls: "n" }], "split");
assert.ok(st.includes("width:75%") && st.includes("width:25%") && !st.includes('class="z"') && !st.includes('class="n"')); assert.strictEqual(Ch.stack([], "x"), ""); assert.strictEqual(Ch.stack([{ label: "a", value: 0 }], "x"), ""); assert.ok(Ch.stack([{ label: "<x>", value: 1 }], "t").includes('title="&lt;x&gt;"'));

console.log("dashboard-charts: all checks passed");
