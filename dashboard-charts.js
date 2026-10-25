/**
 * Life Ledger — chart drawing for the Salary and Spending dashboards (pure: data in, markup out; no DOM, no network).
 *
 * Every function returns a string of SVG or HTML. Text from the data (company names, categories) is escaped here, numbers are
 * rounded to one decimal so the markup is stable, and nothing is drawn outside the chart's own box. Labels that would land on
 * top of each other are dropped (the most important one wins), so no two labels ever overlap. Colours come from classes (dc-…)
 * styled in layout.css, so the charts follow the light and dark themes.
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
  /** Rough width of a label in the 11px chart font. */
  const textWidth = (text) => String(text).length * 6.3 + 4;

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

  /** Round axis ticks from 0 up to just past max, in steps of 1, 2 or 5 × a power of ten: { ticks, top }. */
  function niceTicks(max, target) {
    const want = target || 4;
    if (!(max > 0)) return { ticks: [0, 1], top: 1 };
    const raw = max / want, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
    const top = Math.ceil(max / step - 1e-9) * step, ticks = [];
    for (let t = 0; t <= top + step / 2; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
    return { ticks, top };
  }

  /** How many months apart the x-axis labels go so they stay at least ~64px apart. */
  function labelStep(pxPerMonth) {
    for (const step of [1, 3, 6, 12, 24, 60]) if (step * pxPerMonth >= 64) return step;
    return 120;
  }

  /**
   * Keep only labels that do not touch: items = [{ x, text, priority, …}] (x is the centre); the highest priority wins a clash.
   * Returns the kept items left to right. gap = the least space left between two labels.
   */
  function placeLabels(items, gap) {
    const space = gap === undefined ? 4 : gap, kept = [];
    for (const it of items.slice().sort((a, b) => (b.priority || 0) - (a.priority || 0))) {
      const half = textWidth(it.text) / 2;
      if (kept.every((k) => Math.abs(k.x - it.x) >= half + textWidth(k.text) / 2 + space)) kept.push(it);
    }
    return kept.sort((a, b) => a.x - b.x);
  }

  const frame = (w, h, label, body) => `<svg class="dc-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}" preserveAspectRatio="xMidYMid meet">${body}</svg>`;

  function yAxis(w, padL, padR, y, ticks, fmt) {
    return ticks.map((t) => `<line class="dc-grid" x1="${padL}" x2="${w - padR}" y1="${r1(y(t))}" y2="${r1(y(t))}"/><text class="dc-axis" x="${padL - 8}" y="${r1(y(t)) + 4}" text-anchor="end">${esc(fmt(t))}</text>`).join("");
  }

  /** x-axis labels every `step` months, thinned so none touch. items = [{ ym }], x(ym) → pixel. */
  function monthAxis(items, x, step, h, yearOnly) {
    const cands = items.filter((m) => ymIndex(m.ym) % step === 0).map((m) => ({ x: x(m.ym), text: yearOnly ? m.ym.slice(0, 4) : monthShort(m.ym), priority: 1 }));
    return placeLabels(cands, 6).map((c) => `<text class="dc-axis" x="${r1(c.x)}" y="${h - 8}" text-anchor="middle">${esc(c.text)}</text>`).join("");
  }

  /**
   * Pay over time. Faint columns are every month's take-home (a one-off month in amber); the line is the steady pay, with an area
   * under it; jobs are shaded bands named along the top, and each job change carries its hike. A one-off taller than the chart is cut
   * off at the top and marked. months = [{ ym, net, levelNet, levelNetToday, oneOff, tip }], jobs = [{ source, from, to }],
   * changes = [{ month, text, pct }]. Each month has an invisible column (class dc-hit, data-ym, data-tip) the page listens to.
   */
  function timeline(o) {
    const months = o.months || [], jobs = o.jobs || [], changes = o.changes || [];
    const w = o.width || 900, h = o.height || 340, padL = 54, padR = 60, padT = 46, padB = 28;
    if (!months.length) return "";
    const i0 = ymIndex(months[0].ym), span = ymIndex(months[months.length - 1].ym) - i0;
    const plotW = w - padL - padR, per = plotW / (span + 1), plotH = h - padT - padB;
    const x = (ym) => padL + (ymIndex(ym) - i0 + 0.5) * per;
    const left = (ym) => padL + (ymIndex(ym) - i0) * per;
    // The scale follows the steady pay and the regular months; a huge one-off is cut off at the top instead of flattening everything else
    const vals = months.flatMap((m) => [m.oneOff ? 0 : m.net, m.levelNet || 0, o.showReal ? m.levelNetToday || 0 : 0]);
    const { ticks, top } = niceTicks(Math.max(...vals, 1) * 1.08, 4);
    const y = (v) => padT + (1 - Math.min(v, top) / top) * plotH;
    let body = "";
    jobs.forEach((j, k) => {
      const x1 = Math.max(padL, left(j.from)), x2 = Math.min(w - padR, left(j.to) + per);
      if (x2 > x1) body += `<rect class="dc-band dc-band-${k % 2}" x="${r1(x1)}" y="${padT}" width="${r1(x2 - x1)}" height="${r1(plotH)}"/>`;
    });
    body += yAxis(w, padL, padR, y, ticks, short);
    body += monthAxis(months, x, labelStep(per), h, labelStep(per) >= 12);
    const bw = Math.max(1.4, Math.min(14, per * 0.62)), cut = [];
    for (const m of months) {
      const yy = y(m.net), hh = padT + plotH - yy;
      if (hh <= 0) continue;
      body += `<rect class="${m.oneOff ? "dc-col dc-col-oneoff" : "dc-col"}" x="${r1(x(m.ym) - bw / 2)}" y="${r1(yy)}" width="${r1(bw)}" height="${r1(hh)}"/>`;
      if (m.net > top) { body += `<path class="dc-cut" d="M${r1(x(m.ym) - bw / 2 - 2)} ${padT + 6}l${r1(bw + 4)} -3"/>`; cut.push({ x: x(m.ym), text: short(m.net), priority: m.net }); }
    }
    const pts = months.filter((m) => m.levelNet !== null && m.levelNet !== undefined);
    const step = (key) => {
      let d = "";
      pts.forEach((m, i) => {
        const v = m[key] === undefined || m[key] === null ? m.levelNet : m[key];
        d += i === 0 ? `M${r1(x(m.ym))} ${r1(y(v))}` : `H${r1(x(m.ym))}V${r1(y(v))}`;
      });
      return d;
    };
    if (pts.length) {
      body += `<path class="dc-area" d="${step("levelNet")}V${r1(padT + plotH)}H${r1(x(pts[0].ym))}Z"/>`;
      if (o.showReal) body += `<path class="dc-real" d="${step("levelNetToday")}" fill="none"/>`;
      body += `<path class="dc-level" d="${step("levelNet")}" fill="none"/>`;
      const last = pts[pts.length - 1];
      body += `<circle class="dc-end" cx="${r1(x(last.ym))}" cy="${r1(y(last.levelNet))}" r="4"/><text class="dc-end-label" x="${r1(x(last.ym) + 9)}" y="${r1(y(last.levelNet)) + 4}">${esc(short(last.levelNet))}</text>`;
    }
    jobs.forEach((j) => {
      const x1 = Math.max(padL, left(j.from)), bw2 = Math.min(w - padR, left(j.to) + per) - x1, fit = Math.floor((bw2 - 8) / 6.4);
      if (fit >= 3) body += `<text class="dc-band-label" x="${r1(x1 + 4)}" y="14">${esc(j.source.length > fit ? j.source.slice(0, fit - 1) + "…" : j.source)}</text>`;
    });
    const visible = changes.filter((c) => left(c.month) > padL + 4 && left(c.month) < w - padR);
    for (const b of placeLabels(visible.map((c) => ({ x: left(c.month), text: c.text, priority: Math.abs(c.pct || 0) })), 8)) {
      const tw = textWidth(b.text);
      body += `<line class="dc-jobline" x1="${r1(b.x)}" x2="${r1(b.x)}" y1="37" y2="${r1(padT + plotH)}"/><rect class="dc-badge" x="${r1(b.x - tw / 2)}" y="21" width="${r1(tw)}" height="16" rx="8"/><text class="dc-badge-text" x="${r1(b.x)}" y="32.5" text-anchor="middle">${esc(b.text)}</text>`;
    }
    for (const c of placeLabels(cut, 6)) body += `<text class="dc-cut-label" x="${r1(c.x)}" y="${padT + 20}" text-anchor="middle">${esc(c.text)}</text>`;
    body += `<line class="dc-cross" x1="0" x2="0" y1="${padT}" y2="${r1(padT + plotH)}" visibility="hidden"/>`;
    for (const m of months) body += `<rect class="dc-hit" data-ym="${esc(m.ym)}" data-tip="${esc(m.tip || "")}" x="${r1(x(m.ym) - per / 2)}" y="${padT}" width="${r1(per)}" height="${r1(plotH)}"/>`;
    return frame(w, h, o.label || "Pay over time", body);
  }

  /**
   * Columns per month. rows = [{ ym, values: { key: number }, cls?, tip? }], series = [{ key, cls }] (stacked bottom to top).
   * signed: bars may go below zero (a savings rate). ref: a dashed reference line { value, label }. fmt formats the y axis.
   * line: { cls, values: { ym: number }, step? } draws a line over the columns.
   */
  function columns(o) {
    const rows = o.rows || [], series = o.series || [];
    const w = o.width || 900, h = o.height || 260, padL = 54, padR = 16, padT = 14, padB = 28;
    if (!rows.length) return "";
    const plotW = w - padL - padR, slot = plotW / rows.length, bw = Math.max(2, Math.min(26, slot * 0.72));
    const lineVals = o.line ? rows.map((r) => (o.line.values || {})[r.ym]).filter((v) => Number.isFinite(v)) : [];
    const totals = rows.map((r) => series.reduce((t, s) => t + Math.max(0, (r.values || {})[s.key] || 0), 0));
    const lows = rows.map((r) => series.reduce((t, s) => t + Math.min(0, (r.values || {})[s.key] || 0), 0));
    const refHi = o.ref ? Math.max(0, o.ref.value) : 0, refLo = o.ref ? Math.min(0, o.ref.value) : 0;
    const hiNeed = Math.max(...totals, refHi, ...lineVals.map((v) => Math.max(0, v)), 1e-9);
    const loNeed = o.signed ? Math.min(...lows, refLo, ...lineVals.map((v) => Math.min(0, v)), 0) : 0;
    const up = niceTicks(hiNeed * 1.04, 4), dn = loNeed < 0 ? niceTicks(-loNeed * 1.04, 2) : null;
    const hi = up.top, lo = dn ? -dn.top : 0;
    const y = (v) => padT + ((hi - Math.max(lo, Math.min(hi, v))) / (hi - lo)) * (h - padT - padB);
    const ticks = [...(dn ? dn.ticks.slice(1).map((t) => -t) : []), ...up.ticks];
    let body = yAxis(w, padL, padR, y, ticks, o.fmt || short);
    if (lo < 0) body += `<line class="dc-zero" x1="${padL}" x2="${w - padR}" y1="${r1(y(0))}" y2="${r1(y(0))}"/>`;
    const centre = new Map(rows.map((r, i) => [r.ym, padL + (i + 0.5) * slot]));
    rows.forEach((r) => {
      const cx = centre.get(r.ym);
      let upv = 0, dnv = 0;
      for (const s of series) {
        const v = (r.values || {})[s.key] || 0;
        if (!v) continue;
        const from = v >= 0 ? upv : dnv, to = from + v;
        if (v >= 0) upv = to; else dnv = to;
        const y1 = y(Math.max(from, to)), y2 = y(Math.min(from, to));
        body += `<rect class="${esc(s.cls)}${r.cls ? " " + esc(r.cls) : ""}" x="${r1(cx - bw / 2)}" y="${r1(y1)}" width="${r1(bw)}" height="${r1(Math.max(1, y2 - y1))}" rx="1.5"/>`;
      }
    });
    const step = labelStep(slot);
    body += monthAxis(rows, (ym) => centre.get(ym), step, h, step >= 12);
    if (o.line) {
      let d = "", pen = false;
      rows.forEach((r) => {
        const v = (o.line.values || {})[r.ym], cx = centre.get(r.ym);
        if (!Number.isFinite(v)) { pen = false; return; }
        d += o.line.step && pen ? `H${r1(cx)}V${r1(y(v))}` : `${pen ? "L" : "M"}${r1(cx)} ${r1(y(v))}`;
        pen = true;
      });
      body += `<path class="${esc(o.line.cls || "dc-level")}" d="${d}" fill="none"/>`;
    }
    if (o.ref) body += `<line class="dc-ref" x1="${padL}" x2="${w - padR}" y1="${r1(y(o.ref.value))}" y2="${r1(y(o.ref.value))}"/><text class="dc-ref-label" x="${padL + 6}" y="${r1(y(o.ref.value)) - 5}" text-anchor="start">${esc(o.ref.label || "")}</text>`;
    body += `<line class="dc-cross" x1="0" x2="0" y1="${padT}" y2="${h - padB}" visibility="hidden"/>`;
    rows.forEach((r, i) => { body += `<rect class="dc-hit" data-ym="${esc(r.ym)}" data-tip="${esc(r.tip || "")}" x="${r1(padL + i * slot)}" y="${padT}" width="${r1(slot)}" height="${h - padT - padB}"/>`; });
    return frame(w, h, o.label || "Chart", body);
  }

  /** Wrap a label onto at most two lines of `per` characters, shortening with … when it still does not fit. */
  function wrapTwo(text, per) {
    const lines = [""];
    for (const word of String(text).split(/\s+/)) {
      const l = lines.length - 1;
      if (!lines[l] || (lines[l] + " " + word).length <= per) lines[l] = (lines[l] + " " + word).trim();
      else if (lines.length < 2) lines.push(word);
      else lines[1] = (lines[1] + " " + word).trim();
    }
    return lines.map((t) => (t.length > per ? t.slice(0, Math.max(1, per - 1)) + "…" : t));
  }

  /**
   * A bridge (waterfall): items = [{ label, value, kind: "total" | "delta", cls? }]. A total stands on the floor; a delta floats from
   * where the running total was. Labels under each column wrap to two lines; the value sits above it.
   */
  function bridge(o) {
    const items = o.items || [];
    const w = o.width || 640, h = o.height || 260, padL = 54, padR = 12, padT = 26, padB = 50;
    if (!items.length) return "";
    let run = 0;
    const bars = items.map((it) => {
      const from = it.kind === "total" ? 0 : run, to = it.kind === "total" ? it.value : run + it.value;
      run = to;
      return { ...it, lo: Math.min(from, to), hi: Math.max(from, to), end: to };
    });
    const { ticks, top } = niceTicks(Math.max(...bars.map((b) => b.hi), 1) * 1.1, 4);
    const y = (v) => padT + (1 - Math.max(0, Math.min(top, v)) / top) * (h - padT - padB);
    const slot = (w - padL - padR) / bars.length, bw = Math.min(70, slot * 0.6), fmt = o.fmt || short;
    let body = yAxis(w, padL, padR, y, ticks, short);
    bars.forEach((b, i) => {
      const cx = padL + (i + 0.5) * slot, y1 = y(b.hi), y2 = y(b.lo);
      body += `<rect class="${esc(b.cls || (b.kind === "total" ? "dc-b-total" : b.value < 0 ? "dc-b-down" : "dc-b-up"))}" x="${r1(cx - bw / 2)}" y="${r1(y1)}" width="${r1(bw)}" height="${r1(Math.max(1.5, y2 - y1))}" rx="3"/>`;
      if (i < bars.length - 1) body += `<line class="dc-connect" x1="${r1(cx + bw / 2)}" x2="${r1(cx + slot - bw / 2)}" y1="${r1(y(b.end))}" y2="${r1(y(b.end))}"/>`;
      body += `<text class="dc-value" x="${r1(cx)}" y="${r1(y1) - 6}" text-anchor="middle">${esc((b.kind === "delta" && b.value > 0 ? "+" : "") + fmt(b.value))}</text>`;
      wrapTwo(b.label, Math.max(5, Math.floor((slot - 6) / 6.3))).forEach((t, k) => { body += `<text class="dc-axis" x="${r1(cx)}" y="${h - padB + 16 + k * 15}" text-anchor="middle">${esc(t)}</text>`; });
    });
    return frame(w, h, o.label || "Bridge", body);
  }

  /**
   * Pay ladder: one column per job (its steady pay at the end), the hike from the job before written on the connector.
   * items = [{ label, value, text }] (text is the hike, e.g. "+52%"; empty for the first job).
   */
  function ladder(o) {
    const items = o.items || [];
    const w = o.width || 720, h = o.height || 280, padL = 54, padR = 12, padT = 34, padB = 48;
    if (!items.length) return "";
    const { ticks, top } = niceTicks(Math.max(...items.map((i) => i.value), 1) * 1.12, 4);
    const y = (v) => padT + (1 - Math.min(top, v) / top) * (h - padT - padB);
    const slot = (w - padL - padR) / items.length, bw = Math.min(84, slot * 0.58);
    let body = yAxis(w, padL, padR, y, ticks, short);
    items.forEach((it, i) => {
      const cx = padL + (i + 0.5) * slot, yy = y(it.value);
      body += `<rect class="dc-b-total" x="${r1(cx - bw / 2)}" y="${r1(yy)}" width="${r1(bw)}" height="${r1(h - padB - yy)}" rx="3"/>`;
      body += `<text class="dc-value" x="${r1(cx)}" y="${r1(yy) - 7}" text-anchor="middle">${esc(short(it.value))}</text>`;
      wrapTwo(it.label, Math.max(5, Math.floor((slot - 6) / 6.3))).forEach((t, k) => { body += `<text class="dc-axis" x="${r1(cx)}" y="${h - padB + 16 + k * 15}" text-anchor="middle">${esc(t)}</text>`; });
      if (i > 0 && it.text) {
        const px = cx - slot / 2, y0 = y(items[i - 1].value), tw = textWidth(it.text), my = (y0 + yy) / 2;
        body += `<line class="dc-connect" x1="${r1(cx - slot + bw / 2)}" x2="${r1(cx - bw / 2)}" y1="${r1(y0)}" y2="${r1(yy)}"/><rect class="dc-badge" x="${r1(px - tw / 2)}" y="${r1(my - 9)}" width="${r1(tw)}" height="16" rx="8"/><text class="dc-badge-text" x="${r1(px)}" y="${r1(my + 2.5)}" text-anchor="middle">${esc(it.text)}</text>`;
      }
    });
    return frame(w, h, o.label || "Pay by job", body);
  }

  /**
   * A heat grid (HTML): rows of cells shaded by how far each is above that row's own usual. rows = [{ label, cells: [{ text, level, tip }] }],
   * heads = column labels. level 0 (at or below usual) to 4 (far above).
   */
  function heatmap(o) {
    const heads = o.heads || [], rows = o.rows || [];
    if (!rows.length) return "";
    const cols = `style="grid-template-columns:minmax(120px,1.6fr) repeat(${heads.length},minmax(50px,1fr))"`;
    const head = `<div class="dc-heat-row dc-heat-head" ${cols}><span></span>${heads.map((t) => `<span>${esc(t)}</span>`).join("")}</div>`;
    const body = rows.map((r) => `<div class="dc-heat-row" ${cols}><span class="dc-heat-label" title="${esc(r.label)}">${esc(r.label)}</span>${r.cells.map((c) => `<span class="dc-heat-cell l${Math.max(0, Math.min(4, c.level | 0))}" title="${esc(c.tip || "")}">${esc(c.text)}</span>`).join("")}</div>`).join("");
    return `<div class="dc-heat" role="table" aria-label="${esc(o.label || "Heat grid")}">${head}${body}</div>`;
  }

  /**
   * A ring chart. items = [{ key, label, value, cls }] (positive values only are drawn; cls styles the slice). The centre shows two
   * lines of text. Each slice carries data-key and a <title> with its label, value text (item.text) and share.
   */
  function donut(o) {
    const items = (o.items || []).filter((i) => i.value > 0), total = items.reduce((t, i) => t + i.value, 0);
    const size = o.size || 260, c = size / 2, outer = c - 6, inner = outer * (o.hole || 0.62);
    if (!(total > 0)) return "";
    const pt = (r, a) => [r1(c + r * Math.sin(a)), r1(c - r * Math.cos(a))];
    let angle = 0, body = "";
    for (const it of items) {
      const sweep = (it.value / total) * Math.PI * 2, tip = `${esc(it.label)}${it.text ? " · " + esc(it.text) : ""} · ${r1((it.value / total) * 100)}%`;
      if (items.length === 1) {
        body += `<circle class="${esc(it.cls)}" data-key="${esc(it.key)}" cx="${c}" cy="${c}" r="${r1((outer + inner) / 2)}" fill="none" stroke-width="${r1(outer - inner)}"><title>${tip}</title></circle>`;
      } else {
        const a0 = angle, a1 = angle + sweep, big = sweep > Math.PI ? 1 : 0;
        const [x0, y0] = pt(outer, a0), [x1, y1] = pt(outer, a1), [x2, y2] = pt(inner, a1), [x3, y3] = pt(inner, a0);
        body += `<path class="${esc(it.cls)}" data-key="${esc(it.key)}" d="M${x0} ${y0}A${r1(outer)} ${r1(outer)} 0 ${big} 1 ${x1} ${y1}L${x2} ${y2}A${r1(inner)} ${r1(inner)} 0 ${big} 0 ${x3} ${y3}Z"><title>${tip}</title></path>`;
      }
      angle += sweep;
    }
    if (o.top) body += `<text class="dc-donut-top" x="${c}" y="${c - 4}" text-anchor="middle">${esc(o.top)}</text>`;
    if (o.bottom) body += `<text class="dc-donut-sub" x="${c}" y="${c + 16}" text-anchor="middle">${esc(o.bottom)}</text>`;
    return `<svg class="dc-svg dc-donut" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(o.label || "Share of the total")}">${body}</svg>`;
  }

  /** A tiny trend line with a soft area. values = numbers, oldest first. */
  function sparkline(values, o) {
    const w = (o && o.width) || 96, h = (o && o.height) || 26, list = (values || []).filter((v) => Number.isFinite(v));
    if (list.length < 2) return "";
    const max = Math.max(...list), min = Math.min(...list), rng = max - min;
    const pts = list.map((v, i) => `${r1(2 + (i / (list.length - 1)) * (w - 4))} ${r1(rng ? h - 3 - ((v - min) / rng) * (h - 6) : h / 2)}`);
    return `<svg class="dc-spark" viewBox="0 0 ${w} ${h}" aria-hidden="true" preserveAspectRatio="none"><path class="dc-spark-area" d="M${pts.join("L")}V${h}H2Z"/><path d="M${pts.join("L")}" fill="none"/></svg>`;
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

  return { esc, short, niceMax, niceTicks, labelStep, placeLabels, textWidth, monthLabel, monthShort, timeline, columns, bridge, ladder, heatmap, donut, sparkline, bar, stack };
});
