/**
 * Life Ledger — chart drawing for the Salary and Spending dashboards (pure: data in, markup out; no DOM, no network).
 *
 * Every function returns a string of SVG or HTML. Text from the data (company names, categories) is escaped here, numbers are
 * rounded to one decimal so the markup is stable, and nothing is drawn outside the chart's own box. Colours come from classes
 * (dc-…) styled in layout.css, so the charts follow the light and dark themes.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerDashboardCharts = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const r1 = (n) => Math.round(n * 10) / 10;
  const ymIndex = (ym) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLabel = (ym) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
  const monthShort = (ym) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;

  /** Indian short rupees: ₹950, ₹12k, ₹1.2L, ₹3.4Cr. */
  function short(n) {
    const v = Math.abs(n), sign = n < 0 ? "−" : "";
    const trim = (x) => String(r1(x)).replace(/\.0$/, "");
    if (v >= 10000000) return `${sign}₹${trim(v / 10000000)}Cr`;
    if (v >= 100000) return `${sign}₹${trim(v / 100000)}L`;
    if (v >= 1000) return `${sign}₹${trim(v / 1000)}k`;
    return `${sign}₹${Math.round(v)}`;
  }

  /** The smallest 1, 2, 2.5, 5 or 10 × a power of ten that is at least v. */
  function niceMax(v) {
    if (!(v > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }

  /** How many months apart the x-axis labels go so they stay at least ~64px apart. */
  function labelStep(pxPerMonth) {
    for (const step of [1, 3, 6, 12, 24, 60]) if (step * pxPerMonth >= 64) return step;
    return 120;
  }

  const frame = (w, h, label, body) => `<svg class="dc-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}" preserveAspectRatio="xMidYMid meet">${body}</svg>`;

  function yAxis(w, padL, padR, y, ticks, fmt) {
    return ticks.map((t) => `<line class="dc-grid" x1="${padL}" x2="${w - padR}" y1="${r1(y(t))}" y2="${r1(y(t))}"/><text class="dc-axis" x="${padL - 8}" y="${r1(y(t)) + 4}" text-anchor="end">${esc(fmt(t))}</text>`).join("");
  }

  /**
   * Pay over time: every month's take-home as a dot (a ring when it is a one-off), the steady level as a line, the jobs as
   * bands behind, and optionally the steady level in today's rupees. months = [{ ym, net, levelNet, levelNetToday, oneOff }],
   * jobs = [{ source, from, to }]. Each month has an invisible column (class dc-hit, data-ym) the page listens to.
   */
  function timeline(o) {
    const months = o.months || [], jobs = o.jobs || [];
    const w = o.width || 900, h = o.height || 320, padL = 56, padR = 14, padT = 30, padB = 30;
    if (!months.length) return "";
    const i0 = ymIndex(months[0].ym), span = ymIndex(months[months.length - 1].ym) - i0;
    const plotW = w - padL - padR, per = plotW / (span + 1);
    const x = (ym) => padL + (ymIndex(ym) - i0 + 0.5) * per;
    // The scale follows the steady pay and the regular months; a huge one-off (a settlement) is pinned to the top edge instead of flattening everything else
    const vals = months.flatMap((m) => [m.oneOff ? 0 : m.net, m.levelNet || 0, o.showReal ? m.levelNetToday || 0 : 0]);
    const top = niceMax(Math.max(...vals, 1) * 1.15);
    const y = (v) => padT + (1 - Math.min(v, top) / top) * (h - padT - padB);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => top * f);
    let body = "";
    jobs.forEach((j, k) => {
      const x1 = padL + (ymIndex(j.from) - i0) * per, x2 = padL + (ymIndex(j.to) - i0 + 1) * per, bw = x2 - x1;
      body += `<rect class="dc-band dc-band-${k % 2}" x="${r1(x1)}" y="${padT}" width="${r1(bw)}" height="${h - padT - padB}"/>`;
      const fit = Math.floor((bw - 8) / 6.5);
      if (fit >= 4) body += `<text class="dc-band-label" x="${r1(x1 + 5)}" y="${padT - 10}">${esc(j.source.length > fit ? j.source.slice(0, fit - 1) + "…" : j.source)}</text>`;
    });
    body += yAxis(w, padL, padR, y, ticks, short);
    const step = labelStep(per);
    months.forEach((m) => {
      const mi = ymIndex(m.ym);
      if (mi % step === 0) {
        body += `<text class="dc-axis" x="${r1(x(m.ym))}" y="${h - 8}" text-anchor="middle">${esc(step >= 12 ? m.ym.slice(0, 4) : monthShort(m.ym))}</text>`;
      }
    });
    const path = (key) => {
      let d = "", pen = false;
      for (const m of months) {
        if (m[key] === null || m[key] === undefined) { pen = false; continue; }
        d += `${pen ? "L" : "M"}${r1(x(m.ym))} ${r1(y(m[key]))}`;
        pen = true;
      }
      return d;
    };
    if (o.showReal) body += `<path class="dc-real" d="${path("levelNetToday")}" fill="none"/>`;
    body += `<path class="dc-level" d="${path("levelNet")}" fill="none"/>`;
    for (const m of months) body += `<circle class="${m.oneOff ? "dc-oneoff" : "dc-dot"}" cx="${r1(x(m.ym))}" cy="${r1(y(m.net))}" r="${m.oneOff ? 4 : 2.4}"><title>${esc(monthShort(m.ym))}: ${esc(short(m.net))}</title></circle>`;
    for (const m of months) if (m.net > top) body += `<text class="dc-axis" x="${r1(x(m.ym) + 8)}" y="${padT + 10}">↑ ${esc(short(m.net))}</text>`;
    for (const m of months) body += `<rect class="dc-hit" data-ym="${esc(m.ym)}" x="${r1(x(m.ym) - per / 2)}" y="${padT}" width="${r1(per)}" height="${h - padT - padB}"/>`;
    return frame(w, h, o.label || "Pay over time", body);
  }

  /**
   * Columns per month. rows = [{ ym, values: { key: number }, cls? }], series = [{ key, cls }] (drawn bottom to top when stacked).
   * signed: bars may go below zero (a savings rate). ref: a dashed reference line { value, label }. fmt formats the y axis.
   */
  function columns(o) {
    const rows = o.rows || [], series = o.series || [];
    const w = o.width || 900, h = o.height || 260, padL = 56, padR = 14, padT = 14, padB = 30;
    if (!rows.length) return "";
    const plotW = w - padL - padR, slot = plotW / rows.length, bw = Math.max(2, Math.min(26, slot * 0.72));
    const totals = rows.map((r) => series.reduce((t, s) => t + Math.max(0, (r.values || {})[s.key] || 0), 0));
    const lows = rows.map((r) => series.reduce((t, s) => t + Math.min(0, (r.values || {})[s.key] || 0), 0));
    const hi = niceMax(Math.max(...totals, o.ref ? Math.max(0, o.ref.value) : 0, 1e-9));
    const loRaw = o.signed ? Math.min(...lows, o.ref ? Math.min(0, o.ref.value) : 0) : 0;
    const lo = loRaw < 0 ? -niceMax(-loRaw) : 0;
    const y = (v) => padT + ((hi - v) / (hi - lo)) * (h - padT - padB);
    const ticks = lo < 0 ? [lo, 0, hi / 2, hi] : [0, hi / 4, hi / 2, (hi * 3) / 4, hi];
    const fmt = o.fmt || short;
    let body = yAxis(w, padL, padR, y, ticks, fmt);
    if (lo < 0) body += `<line class="dc-zero" x1="${padL}" x2="${w - padR}" y1="${r1(y(0))}" y2="${r1(y(0))}"/>`;
    const step = labelStep(slot);
    rows.forEach((r, i) => {
      const cx = padL + (i + 0.5) * slot;
      let up = 0, down = 0;
      for (const s of series) {
        const v = (r.values || {})[s.key] || 0;
        if (!v) continue;
        const from = v >= 0 ? up : down, to = from + v;
        if (v >= 0) up = to; else down = to;
        const y1 = y(Math.max(from, to)), y2 = y(Math.min(from, to));
        body += `<rect class="${esc(s.cls)}${r.cls ? " " + esc(r.cls) : ""}" x="${r1(cx - bw / 2)}" y="${r1(y1)}" width="${r1(bw)}" height="${r1(Math.max(1, y2 - y1))}" rx="1.5"/>`;
      }
      const mi = ymIndex(r.ym);
      if (mi % step === 0) body += `<text class="dc-axis" x="${r1(cx)}" y="${h - 8}" text-anchor="middle">${esc(step >= 12 ? r.ym.slice(0, 4) : monthShort(r.ym))}</text>`;
    });
    if (o.ref) body += `<line class="dc-ref" x1="${padL}" x2="${w - padR}" y1="${r1(y(o.ref.value))}" y2="${r1(y(o.ref.value))}"/><text class="dc-ref-label" x="${w - padR}" y="${r1(y(o.ref.value)) - 5}" text-anchor="end">${esc(o.ref.label || "")}</text>`;
    rows.forEach((r, i) => { body += `<rect class="dc-hit" data-ym="${esc(r.ym)}" x="${r1(padL + i * slot)}" y="${padT}" width="${r1(slot)}" height="${h - padT - padB}"/>`; });
    return frame(w, h, o.label || "Chart", body);
  }

  /** A tiny trend line for a row. values = numbers, oldest first. */
  function sparkline(values, o) {
    const w = (o && o.width) || 96, h = (o && o.height) || 26, list = (values || []).filter((v) => Number.isFinite(v));
    if (list.length < 2) return "";
    const max = Math.max(...list), min = Math.min(...list), rng = max - min;
    const pts = list.map((v, i) => `${r1(2 + (i / (list.length - 1)) * (w - 4))} ${r1(rng ? h - 3 - ((v - min) / rng) * (h - 6) : h / 2)}`);
    return `<svg class="dc-spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="M${pts.join("L")}" fill="none"/></svg>`;
  }

  /** A horizontal bar made of HTML so its text wraps on a phone. pct 0–100 (clamped); markers: [{pct, cls}] draws a tick. */
  function bar(o) {
    const pct = Math.max(0, Math.min(100, Number.isFinite(o.pct) ? o.pct : 0));
    const marks = (o.markers || []).map((m) => `<b class="dc-tick ${esc(m.cls || "")}" style="left:${r1(Math.max(0, Math.min(100, m.pct)))}%"></b>`).join("");
    return `<div class="dc-bar${o.cls ? " " + esc(o.cls) : ""}" role="img" aria-label="${esc(o.label || "")}"><i style="width:${r1(pct)}%"></i>${marks}</div>`;
  }

  /** One stacked horizontal bar of parts. parts = [{ label, value, cls }]; shares are of the total of the positive values. */
  function stack(parts, label) {
    const list = (parts || []).filter((p) => p.value > 0), total = list.reduce((t, p) => t + p.value, 0);
    if (!total) return "";
    return `<div class="dc-stack" role="img" aria-label="${esc(label || "")}">${list.map((p) => `<i class="${esc(p.cls || "")}" style="width:${r1((p.value / total) * 100)}%" title="${esc(p.label)}"></i>`).join("")}</div>`;
  }

  return { esc, short, niceMax, labelStep, monthLabel, monthShort, timeline, columns, sparkline, bar, stack };
});
