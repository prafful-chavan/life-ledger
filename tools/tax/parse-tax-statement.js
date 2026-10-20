/** Parses the text of a Form 26AS / Annual Tax Statement (pdftotext -layout) into TDS, TCS and refund records. Pure. */
const num = (s) => Number(String(s).replace(/,/g, ""));
const DEDUCTOR = /^\s*(\d+)\s+(.+?)\s+([A-Z]{4}\d{5}[A-Z])\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*$/;
const ROW = /^\s*(\d+)\s+(\d{3}[A-Z]?(?:\([A-Za-z0-9]+\))?)\s+(\d{2}-[A-Za-z]{3}-\d{4})\s+([A-Z])\s+(\d{2}-[A-Za-z]{3}-\d{4})\s+(\S+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*$/;

function parse26as(text) {
  const out = { financialYear: (text.match(/Financial Year\s+(\d{4}-\d{2})/) || [])[1] || null, tds: [], tcs: [], refunds: [], advanceAndSelfAssessment: [] };
  let part = null, cur = null;
  for (const line of text.split("\n")) {
    // Newer statements say "PART-I … PART-X"; older ones say "PART A … PART G". Both are mapped onto the new numbering.
    const p = line.match(/^\s*PART[- ]*(I{1,3}|IV|V|VI{0,3}|IX|X|[A-G]\d?)\b/i);
    if (p) { const k = p[1].toUpperCase(); part = { A: "I", B: "VI", C: "C", D: "VII" }[k] || k; cur = null; continue; }
    const d = line.match(DEDUCTOR);
    if (d && (part === "I" || part === "VI")) {
      cur = { name: d[2].replace(/\s+/g, " ").trim(), tan: d[3], amount: num(d[4]), tax: num(d[5]), deposited: num(d[6]), entries: [] };
      (part === "I" ? out.tds : out.tcs).push(cur);
      continue;
    }
    const r = line.match(ROW);
    if (r && cur) cur.entries.push({ section: r[2], date: r[3], status: r[4], remark: r[6] === "-" ? "" : r[6], amount: num(r[7]), tax: num(r[8]), deposited: num(r[9]) });
    if (part === "VII") {
      const f = line.match(/^\s*\d+\s+(\d{4}-\d{2})\s+(\S+(?:\s\S+)?)\s+(\S.*?)\s+([\d.]+)\s+([\d.]+)\s+(\d{2}-[A-Za-z]{3}-\d{4})/);
      if (f) out.refunds.push({ assessmentYear: f[1], amount: num(f[4]), interest: num(f[5]), paidOn: f[6] });
    }
  }
  const sum = (a, k) => Math.round(a.reduce((t, x) => t + x[k], 0) * 100) / 100;
  out.totals = { tdsTax: sum(out.tds, "tax"), tdsAmount: sum(out.tds, "amount"), tcsTax: sum(out.tcs, "tax"), refunds: sum(out.refunds, "amount") };
  return out;
}
module.exports = { parse26as };
