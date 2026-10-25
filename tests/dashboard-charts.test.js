// The Salary and Spending dashboards' charts: the markup stays inside its box, never contains NaN, escapes text from the data,
// and draws what it was given (a ring for a one-off, a column per month).
const assert = require("assert");
const Ch = require("../dashboard-charts.js");

// ── escaping ──
assert.strictEqual(Ch.esc(`<b>"R&D" 'x'</b>`), "&lt;b&gt;&quot;R&amp;D&quot; &#39;x&#39;&lt;/b&gt;"); assert.strictEqual(Ch.esc(null), ""); assert.strictEqual(Ch.esc(0), "0");

// ── short rupees ──
for (const [n, t] of [[0, "₹0"], [950, "₹950"], [999, "₹999"], [1000, "₹1k"], [12500, "₹12.5k"], [99999, "₹100k"], [100000, "₹1L"], [150000, "₹1.5L"], [199884, "₹2L"], [9999999, "₹100L"], [10000000, "₹1Cr"], [34000000, "₹3.4Cr"], [-1500, "−₹1.5k"], [-500, "−₹500"]]) assert.strictEqual(Ch.short(n), t, String(n));
// ── nice maximum ──
for (const [v, n] of [[0, 1], [-5, 1], [1, 1], [1.1, 2], [2, 2], [2.1, 2.5], [2.5, 2.5], [2.6, 5], [5, 5], [5.1, 10], [10, 10], [199884, 200000], [278484, 500000], [87, 100], [0.04, 0.05]]) assert.ok(Math.abs(Ch.niceMax(v) - n) < 1e-12, `${v} → ${Ch.niceMax(v)}`);
// ── label spacing ──
assert.strictEqual(Ch.labelStep(70), 1); assert.strictEqual(Ch.labelStep(64), 1); assert.strictEqual(Ch.labelStep(63.9), 3); assert.strictEqual(Ch.labelStep(22), 3); assert.strictEqual(Ch.labelStep(21), 6); assert.strictEqual(Ch.labelStep(5.4), 12); assert.strictEqual(Ch.labelStep(2.7), 24); assert.strictEqual(Ch.labelStep(2.6), 60); assert.strictEqual(Ch.labelStep(1.07), 60); assert.strictEqual(Ch.labelStep(1), 120);
assert.strictEqual(Ch.monthLabel("2026-09"), "Sep 2026"); assert.strictEqual(Ch.monthShort("2018-08"), "Aug 18");

const noNaN = (svg) => assert.ok(!/NaN|undefined|Infinity|null/.test(svg), "no NaN / undefined in the markup: " + svg.match(/.{20}(NaN|undefined|Infinity|null).{20}/));
const coords = (svg) => [...svg.matchAll(/\b(?:cx|x|x1|x2)="(-?[\d.]+)"/g)].map((m) => Number(m[1]));
const ys = (svg) => [...svg.matchAll(/\b(?:cy|y|y1|y2)="(-?[\d.]+)"/g)].map((m) => Number(m[1]));

// ── timeline ──
const ms = [];
for (let i = 0; i < 98; i++) { const ym = `${2018 + Math.floor((7 + i) / 12)}-${String(((7 + i) % 12) + 1).padStart(2, "0")}`; ms.push({ ym, net: 10000 + i * 2000 + (i === 40 ? 150000 : 0), levelNet: 10000 + i * 2000, levelNetToday: 12000 + i * 2200, oneOff: i === 40 }); }
const jobs = [{ source: "Blazeclan", from: ms[0].ym, to: ms[29].ym }, { source: "A very long company name that cannot fit", from: ms[30].ym, to: ms[33].ym }, { source: "TCS", from: ms[34].ym, to: ms[97].ym }];
let svg = Ch.timeline({ months: ms, jobs, showReal: true, label: "Pay <timeline>" });
noNaN(svg); assert.ok(svg.includes('viewBox="0 0 900 320"')); assert.ok(svg.includes('aria-label="Pay &lt;timeline&gt;"'), "the label is escaped");
assert.strictEqual((svg.match(/class="dc-hit"/g) || []).length, 98, "one clickable column per month"); assert.strictEqual((svg.match(/class="dc-oneoff"/g) || []).length, 1, "a ring for the one-off"); assert.strictEqual((svg.match(/class="dc-dot"/g) || []).length, 97);
assert.ok(coords(svg).every((c) => c >= 0 && c <= 900), "inside the width"); assert.ok(ys(svg).every((c) => c >= 0 && c <= 320), "inside the height");
assert.ok(svg.includes('class="dc-real"'), "today's-rupees line when asked"); assert.ok(!Ch.timeline({ months: ms, jobs }).includes("dc-real"), "and not otherwise");
assert.ok(svg.includes(">Blazeclan<"), "a wide job shows its name"); assert.ok(!svg.includes("cannot fit"), "a narrow job band does not overflow with its full name"); assert.ok(svg.includes(">TCS<"));
assert.strictEqual((svg.match(/class="dc-band dc-band-/g) || []).length, 3);
assert.ok(/>2019</.test(svg) && />2026</.test(svg), "yearly labels for a long history");
assert.ok(svg.includes('data-ym="2018-08"') && svg.includes('data-ym="2026-09"'));
// a single month, a short history, a missing steady level
svg = Ch.timeline({ months: [{ ym: "2026-09", net: 1000, levelNet: 1000, oneOff: false }], jobs: [{ source: "A", from: "2026-09", to: "2026-09" }] }); noNaN(svg); assert.strictEqual((svg.match(/class="dc-hit"/g) || []).length, 1); assert.ok(coords(svg).every((c) => c >= 0 && c <= 900));
svg = Ch.timeline({ months: ms.slice(-6), jobs: [] }); noNaN(svg); assert.ok(/>(Apr|May|Jun|Jul|Aug|Sep) 26</.test(svg) || /\d\d</.test(svg), "month labels for a short history");
svg = Ch.timeline({ months: [{ ym: "2026-01", net: 100, levelNet: null }, { ym: "2026-02", net: 100, levelNet: 100 }, { ym: "2026-03", net: 100, levelNet: 100 }], jobs: [] }); noNaN(svg); assert.ok(/d="M[\d.]+ [\d.]+L[\d.]+ [\d.]+"/.test(svg), "the line starts where the level starts");
assert.strictEqual(Ch.timeline({ months: [], jobs: [] }), "", "nothing to draw: nothing");
svg = Ch.timeline({ months: [{ ym: "2026-01", net: 0, levelNet: 0 }, { ym: "2026-02", net: 0, levelNet: 0 }], jobs: [] }); noNaN(svg);
assert.ok(Ch.timeline({ months: ms, jobs, width: 400, height: 200 }).includes('viewBox="0 0 400 200"'));

// ── columns ──
const rows = Array.from({ length: 12 }, (_, i) => ({ ym: `2025-${String(i + 1).padStart(2, "0")}`, values: { fixed: 60000, flex: 40000 + i * 1000 }, cls: i === 5 ? "dc-flag" : "" }));
svg = Ch.columns({ rows, series: [{ key: "fixed", cls: "dc-fixed" }, { key: "flex", cls: "dc-flex" }], label: "Spend" });
noNaN(svg); assert.strictEqual((svg.match(/class="dc-fixed/g) || []).length, 12); assert.strictEqual((svg.match(/class="dc-flex/g) || []).length, 12); assert.strictEqual((svg.match(/dc-flag/g) || []).length, 2, "the flagged month is marked on each of its bars");
assert.ok(coords(svg).every((c) => c >= 0 && c <= 900) && ys(svg).every((c) => c >= 0 && c <= 260));
// stacked: the second bar sits on the first
const [a, b] = [...svg.matchAll(/<rect class="dc-(fixed|flex)[^>]*y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/g)].slice(0, 2).map((m) => ({ y: Number(m[2]), h: Number(m[3]) }));
assert.ok(Math.abs(b.y + b.h - a.y) < 0.2, "the flexible part sits on top of the fixed part");
// signed
const sr = [{ ym: "2026-01", values: { rate: 50 } }, { ym: "2026-02", values: { rate: -20 } }, { ym: "2026-03", values: { rate: 70 } }];
svg = Ch.columns({ rows: sr, series: [{ key: "rate", cls: "dc-rate" }], signed: true, fmt: (v) => `${Math.round(v)}%`, ref: { value: 55, label: "usual 55%" } });
noNaN(svg); assert.ok(svg.includes('class="dc-zero"'), "a zero line when something is negative"); assert.ok(svg.includes("usual 55%")); assert.ok(svg.includes('class="dc-ref"'));
const zeroY = Number(svg.match(/class="dc-zero"[^>]*y1="([\d.]+)"/)[1]); const neg = svg.match(/<rect class="dc-rate" x="[\d.]+" y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/g)[1].match(/y="([\d.]+)"/)[1];
assert.ok(Math.abs(Number(neg) - zeroY) < 0.2, "a negative bar hangs from the zero line");
assert.ok(!Ch.columns({ rows: sr.map((r) => ({ ...r, values: { rate: Math.abs(r.values.rate) } })), series: [{ key: "rate", cls: "dc-rate" }], signed: true }).includes("dc-zero"), "no zero line when nothing is negative");
assert.strictEqual(Ch.columns({ rows: [], series: [] }), ""); noNaN(Ch.columns({ rows: [{ ym: "2026-01", values: {} }], series: [{ key: "x", cls: "c" }] }));
noNaN(Ch.columns({ rows: [{ ym: "2026-01", values: { x: 0 } }], series: [{ key: "x", cls: "c" }] }));
assert.ok(Ch.columns({ rows: [{ ym: "2026-01", values: { x: 5 } }], series: [{ key: "x", cls: "a<b" }] }).includes('class="a&lt;b'), "class names are escaped");
assert.strictEqual((Ch.columns({ rows: rows.concat(rows.map((r) => ({ ...r, ym: "2026" + r.ym.slice(4) }))), series: [{ key: "fixed", cls: "f" }] }).match(/class="dc-hit"/g) || []).length, 24);

// ── sparkline, bar, stack ──
assert.strictEqual(Ch.sparkline([1]), ""); assert.strictEqual(Ch.sparkline([]), ""); assert.strictEqual(Ch.sparkline(null), "");
noNaN(Ch.sparkline([5, 5, 5])); assert.ok(/d="M[\d. L]+"/.test(Ch.sparkline([1, 3, 2]))); noNaN(Ch.sparkline([1, NaN, 3]));
assert.ok(Ch.bar({ pct: 50 }).includes("width:50%")); assert.ok(Ch.bar({ pct: 150 }).includes("width:100%"), "over 100% is clamped"); assert.ok(Ch.bar({ pct: -5 }).includes("width:0%")); assert.ok(Ch.bar({ pct: NaN }).includes("width:0%"));
assert.ok(Ch.bar({ pct: 10, markers: [{ pct: 80, cls: "m" }, { pct: 300 }] }).includes("left:80%")); assert.ok(Ch.bar({ pct: 10, markers: [{ pct: 300 }] }).includes("left:100%"), "a marker past the end is clamped");
assert.ok(Ch.bar({ pct: 1, label: '"x"' }).includes('aria-label="&quot;x&quot;"'));
const st = Ch.stack([{ label: "A", value: 300, cls: "a" }, { label: "B", value: 100, cls: "b" }, { label: "Z", value: 0, cls: "z" }, { label: "N", value: -5, cls: "n" }], "split");
assert.ok(st.includes("width:75%") && st.includes("width:25%")); assert.ok(!st.includes('class="z"') && !st.includes('class="n"'), "zero and negative parts are not drawn"); assert.strictEqual(Ch.stack([], "x"), ""); assert.strictEqual(Ch.stack([{ label: "a", value: 0 }], "x"), "");
assert.ok(Ch.stack([{ label: "<x>", value: 1 }], "t").includes('title="&lt;x&gt;"'));

// ── geometry that matters: bigger is higher, later is further right, bands cover their months ──
{
  const two = Ch.timeline({ months: [{ ym: "2026-01", net: 125, levelNet: 125 }, { ym: "2026-02", net: 500, levelNet: 500 }], jobs: [{ source: "A", from: "2026-01", to: "2026-02" }] });
  const dots = [...two.matchAll(/class="dc-dot" cx="([\d.]+)" cy="([\d.]+)"/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
  assert.ok(dots[1].x > dots[0].x, "later months are further right"); assert.ok(dots[1].y < dots[0].y, "a bigger pay is higher up the chart (smaller y)");
  const zeroLabel = two.match(/<text class="dc-axis" x="[\d.]+" y="([\d.]+)" text-anchor="end">₹0<\/text>/); const topLabel = two.match(/<text class="dc-axis" x="[\d.]+" y="([\d.]+)" text-anchor="end">₹500<\/text>/);
  assert.ok(zeroLabel && topLabel, "the axis runs from ₹0 to the next round number above the biggest value"); assert.ok(Number(zeroLabel[1]) > Number(topLabel[1]), "zero at the bottom");
  assert.ok(Math.abs((dots[0].y - dots[1].y) - (Number(zeroLabel[1]) - Number(topLabel[1])) * 0.75) < 1, "125 sits a quarter of the way up, 500 at the top");
  const band = two.match(/class="dc-band dc-band-0" x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/); assert.ok(Number(band[1]) < dots[0].x && Number(band[1]) + Number(band[2]) > dots[1].x, "the job band covers both months");
  const hits = [...two.matchAll(/class="dc-hit" data-ym="[\d-]+" x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.ok(Math.abs(hits[0][0] + hits[0][1] - hits[1][0]) < 0.2, "the clickable columns sit side by side, no gap");
  const wide = Ch.timeline({ months: [{ ym: "2026-01", net: 125, levelNet: 125 }, { ym: "2026-02", net: 500, levelNet: 500 }], jobs: [{ source: "A", from: "2026-01", to: "2026-02" }, { source: "B", from: "2026-03", to: "2026-03" }] });
  assert.ok((wide.match(/dc-band-1/g) || []).length === 1, "bands alternate");
}
{
  const cols = Ch.columns({ rows: [{ ym: "2026-01", values: { a: 100 } }, { ym: "2026-02", values: { a: 400 } }], series: [{ key: "a", cls: "k" }] });
  const rs = [...cols.matchAll(/<rect class="k" x="([\d.]+)" y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/g)].map((m) => ({ x: +m[1], y: +m[2], h: +m[3] }));
  assert.ok(rs[1].x > rs[0].x && rs[1].h > rs[0].h && rs[1].y < rs[0].y, "later is right; bigger is taller"); assert.ok(Math.abs(rs[1].h / rs[0].h - 4) < 0.1, "400 is four times as tall as 100");
  assert.ok(Math.abs(rs[0].y + rs[0].h - (rs[1].y + rs[1].h)) < 0.2, "both stand on the same floor");
}

console.log("dashboard-charts: all checks passed");
