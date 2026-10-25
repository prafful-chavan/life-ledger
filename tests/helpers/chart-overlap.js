// Shared by the chart and dashboard tests: reads every <text> of a chart's SVG as a box and fails when two overlap.
const assert = require("assert");
const Ch = require("../../dashboard-charts.js");

function texts(svg) {
  return [...svg.matchAll(/<text class="([^"]*)" x="([\d.]+)" y="([\d.]+)"(?: text-anchor="(\w+)")?>([^<]*)<\/text>/g)].map((m) => {
    const t = m[5].replace(/&[a-z#0-9]+;/g, "x"), width = Ch.textWidth(t) - 4, x = Number(m[2]), anchor = m[4] || "start";
    const x0 = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
    return { cls: m[1], text: t, x0, x1: x0 + width, y0: Number(m[3]) - 11, y1: Number(m[3]) + 3 };
  });
}

/** Fails if any two labels of the chart overlap; returns how many labels it looked at. */
function noOverlap(svg, msg) {
  const list = texts(svg);
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    assert.ok(!(a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5 && a.y0 < b.y1 - 0.5 && b.y0 < a.y1 - 0.5), `${msg || "labels"} overlap: "${a.text}" and "${b.text}"`);
  }
  return list.length;
}

module.exports = { texts, noOverlap };
