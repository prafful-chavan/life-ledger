/**
 * Life Ledger — the markup of the Salary and Spending dashboards (pure: analysis in, HTML out; no DOM, no network).
 *
 * Takes what salary-insights-core.js and spending-insights-core.js worked out and writes the words and charts. All text that
 * comes from the data (company names, categories, notes) is escaped here. The page only puts the result in place and listens
 * to clicks on elements carrying `data-act`.
 *
 * fmt = { inr(n) whole rupees, pct(n) "12%", month("2026-09") "Sep 2026" }.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./dashboard-charts.js"));
  else root.LifeLedgerDashboardViews = factory(root.LifeLedgerDashboardCharts);
})(typeof self !== "undefined" ? self : this, function (Ch) {
  const h = Ch.esc;

  const SALARY_TABS = [["timeline", "Growth timeline"], ["hikes", "Hikes"], ["takehome", "Take-home"], ["household", "Household"]];
  const SPEND_TABS = [["savings", "Savings"], ["categories", "Categories"], ["budgets", "Budgets"], ["unusual", "Unusual & who paid"]];
  const WHY = {
    overlap: "Two payslips landed in this month (a job change), so it is not a normal month.",
    high: "Well above your other months in this job — a bonus, arrears or a settlement.",
    low: "Well below your other months in this job — a part-month or unpaid leave.",
    marked: "You marked this as a one-off.",
    unmarked: "You marked this as a regular month.",
  };

  const sign = (n, fmt, digits) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt.pct(Math.abs(n), digits)}`;
  const mean = (list) => (list.length ? list.reduce((t, v) => t + v, 0) / list.length : null);

  function kpi(label, value, hint) {
    return `<article class="metric-card compact-metric dv-kpi"><div class="label">${h(label)}</div><div class="value">${value}</div><div class="hint">${hint}</div></article>`;
  }
  function tabs(list, active, act) {
    return `<div class="owner-toggle dv-tabs" role="tablist">${list.map(([id, label]) => `<button class="owner-pill${id === active ? " active" : ""}" type="button" role="tab" aria-selected="${id === active}" data-act="${act}" data-id="${h(id)}">${h(label)}</button>`).join("")}</div>`;
  }
  const empty = (text) => `<div class="empty-state">${h(text)}</div>`;
  const note = (text) => `<p class="dv-note">${text}</p>`;
  const name = (names, key) => (names && names[key]) || key;

  // ───────────────────────────── Salary ─────────────────────────────

  function monthDetail(v, m, o) {
    const { fmt } = o;
    const status = m.oneOff ? `<span class="dv-chip warn">One-off</span>` : `<span class="dv-chip">Regular</span>`;
    const why = m.oneOff ? `<p class="dv-note">${h(WHY[m.why] || "")}</p>` : m.why === "unmarked" ? `<p class="dv-note">${h(WHY.unmarked)}</p>` : "";
    const person = h(o.person);
    const buttons = [];
    if (m.oneOff && m.why !== "marked") buttons.push(`<button class="ghost-button dv-btn" type="button" data-act="mark" data-person="${person}" data-ym="${h(m.ym)}" data-mark="regular">This is a regular month</button>`);
    if (!m.oneOff) buttons.push(`<button class="ghost-button dv-btn" type="button" data-act="mark" data-person="${person}" data-ym="${h(m.ym)}" data-mark="oneoff">Treat as a one-off</button>`);
    if (m.why === "marked" || m.why === "unmarked") buttons.push(`<button class="ghost-button dv-btn" type="button" data-act="mark" data-person="${person}" data-ym="${h(m.ym)}" data-mark="auto">Back to the automatic rule</button>`);
    const gross = m.gross === null ? "not on the payslip" : fmt.inr(m.gross);
    return `<div class="dv-detail" aria-live="polite">
      <div class="dv-detail-head"><strong>${h(fmt.month(m.ym))}</strong> · ${h(m.sources.join(" + "))} ${status}</div>
      <div class="dv-detail-grid">
        <div><span>In your account</span><b>${fmt.inr(m.net)}</b></div>
        <div><span>Gross</span><b>${h(gross)}</b></div>
        <div><span>Tax (TDS)</span><b>${fmt.inr(m.tds)}</b></div>
        <div><span>Provident fund</span><b>${fmt.inr(m.pf)}</b></div>
        ${o.showReal ? `<div><span>In today's rupees</span><b>${fmt.inr(m.netToday)}</b></div>` : ""}
      </div>${why}<div class="dv-actions">${buttons.join("")}</div></div>`;
  }

  function jobsTable(v, fmt) {
    const range = (a, b, f) => (a === null || b === null ? "—" : `${f(a)} → ${f(b)}`);
    const rows = v.jobs.map((j) => `<tr>
      <td data-label="Company"><strong>${h(j.source)}</strong></td>
      <td data-label="Period">${h(fmt.month(j.from))} – ${h(fmt.month(j.to))}</td>
      <td data-label="Months">${j.monthCount}</td>
      <td data-label="Take-home">${h(range(j.startNet, j.endNet, fmt.inr))}</td>
      <td data-label="Gross">${h(range(j.startGross, j.endGross, fmt.inr))}</td></tr>`).join("");
    return `<div class="table-wrap"><table class="dv-table"><thead><tr><th>Company</th><th>Period</th><th>Months</th><th>Take-home a month</th><th>Gross a month</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function timelineTab(v, o) {
    const { fmt } = o;
    const picked = v.months.find((m) => m.ym === o.ym) || v.months[v.months.length - 1];
    const chart = Ch.timeline({ months: v.months, jobs: v.jobs, showReal: o.showReal, label: `${name(o.names, o.person)}'s take-home pay by month, ${fmt.month(v.first.ym)} to ${fmt.month(v.last.ym)}` });
    const oneOffs = v.oneOffs.length
      ? `<details class="dv-details"><summary>${v.oneOffs.length} one-off month${v.oneOffs.length === 1 ? "" : "s"} left out of raises and averages</summary><div class="dv-chiplist">${v.oneOffs.map((m) => `<button class="dv-pickchip" type="button" data-act="pick" data-ym="${h(m.ym)}">${h(fmt.month(m.ym))} · ${fmt.inr(m.net)}</button>`).join("")}</div></details>`
      : "";
    const gaps = v.gaps.length ? note(`⚠ No payslip for ${h(v.gaps.map(fmt.month).join(", "))}. Year totals and averages leave these months out.`) : "";
    return `<div class="dv-toolbar"><button class="owner-pill${o.showReal ? " active" : ""}" type="button" data-act="real" aria-pressed="${o.showReal}">Show in today's rupees</button>
      <span class="dv-legend"><i class="dv-key level"></i>steady pay <i class="dv-key dot"></i>a month <i class="dv-key ring"></i>one-off${o.showReal ? ` <i class="dv-key real"></i>steady pay in today's rupees (${h(fmt.pct(v.inflationPct, 1))} a year)` : ""}</span></div>
      <div class="dc-chart">${chart}</div>
      <p class="dv-hint">Tap a month to see it. Shaded bands are jobs.</p>
      ${monthDetail(v, picked, o)}${oneOffs}${gaps}
      <h4 class="dv-h">Jobs</h4>${jobsTable(v, fmt)}`;
  }

  function hikesTab(v, o) {
    const { fmt } = o;
    const changes = v.jobChanges;
    const basis = (c) => (c.grossPct !== null ? { pct: c.grossPct, from: c.grossBefore, to: c.grossAfter, label: "gross" } : { pct: c.netPct, from: c.netBefore, to: c.netAfter, label: "take-home" });
    const maxPct = Math.max(1, ...changes.map((c) => Math.abs(basis(c).pct)));
    const avg = mean(changes.map((c) => basis(c).pct));
    const changeRows = changes.length
      ? changes.map((c) => { const b = basis(c); return `<div class="dv-row"><div class="dv-row-main"><div class="dv-row-title">${h(c.from)} → ${h(c.to)}</div><div class="dv-row-sub">${h(fmt.month(c.month))} · ${fmt.inr(b.from)} → ${fmt.inr(b.to)} a month (${h(b.label)})${c.grossPct !== null ? ` · take-home ${h(sign(c.netPct, fmt))}` : ""}</div>${Ch.bar({ pct: (Math.abs(b.pct) / maxPct) * 100, cls: b.pct < 0 ? "bad" : "", label: `${sign(b.pct, fmt)} ${b.label}` })}</div><div class="dv-row-value ${b.pct < 0 ? "down" : "up"}">${h(sign(b.pct, fmt))}</div></div>`; }).join("")
      : empty("No job change yet.");
    const raises = v.raises.length
      ? v.raises.map((r) => `<div class="dv-row"><div class="dv-row-main"><div class="dv-row-title">${h(fmt.month(r.month))} · ${h(r.source)}</div><div class="dv-row-sub">${fmt.inr(r.before)} → ${fmt.inr(r.after)} a month (${h(r.basis === "gross" ? "gross" : "take-home")})</div></div><div class="dv-row-value up">${h(sign(r.pct, fmt))}</div></div>`).join("")
      : empty("No raise inside a job yet.");
    const years = v.years.map((y) => {
      const part = y.complete ? "" : ` <small>(${y.months} of 12 months)</small>`;
      return `<tr><td data-label="Year"><strong>${h(y.fy)}</strong>${part}</td><td data-label="Pay received">${fmt.inr(y.totalNet)}</td><td data-label="Regular month">${y.avgRegularNet === null ? "—" : fmt.inr(y.avgRegularNet)}</td><td data-label="Vs last year">${y.levelPct === null ? "—" : h(sign(y.levelPct, fmt))}</td><td data-label="One-off pay">${y.oneOffMonths ? `${fmt.inr(y.oneOffNet)} <small>(${y.oneOffMonths})</small>` : "—"}</td></tr>`;
    }).join("");
    return `<h4 class="dv-h">Job changes</h4>${avg !== null && changes.length > 1 ? `<p class="dv-note">Average step at a job change: <strong>${h(sign(avg, fmt))}</strong>. Compared on the steady pay at the end of one job and the start of the next, so a bonus or a settlement does not count.</p>` : ""}<div class="dv-rows">${changeRows}</div>
      <h4 class="dv-h">Raises inside a job</h4><p class="dv-note">A raise is a lasting step of ${h(fmt.pct(3, 0))} or more in your steady pay. A one-month bonus is not a raise.</p><div class="dv-rows">${raises}</div>
      <h4 class="dv-h">Year by year</h4><div class="table-wrap"><table class="dv-table"><thead><tr><th>Financial year</th><th>Pay received</th><th>Regular month</th><th>Monthly pay vs last year</th><th>One-off pay</th></tr></thead><tbody>${years}</tbody></table></div>
      <p class="dv-note">“Regular month” leaves out one-off months. The comparison is of a regular month in each year, so a part year compares fairly.</p>`;
  }

  function takehomeTab(v, o) {
    const { fmt } = o;
    const b = v.breakdown;
    const parts = b ? b.parts.map((p, i) => ({ ...p, cls: ["dc-seg-net", "dc-seg-tax", "dc-seg-pf", "dc-seg-other"][i] })) : [];
    const top = b
      ? `<p class="dv-note">${h(fmt.month(b.ym))}: of <strong>${fmt.inr(b.gross)}</strong> gross, <strong>${h(fmt.pct(b.takeHomePct, 0))}</strong> reached your account.</p>${Ch.stack(parts, "Where the gross pay went")}
        <div class="dv-legend-rows">${parts.map((p) => `<div><i class="dv-swatch ${p.cls}"></i><span>${h(p.label)}</span><b>${fmt.inr(p.value)}</b><small>${h(fmt.pct((p.value / b.gross) * 100, 0))}</small></div>`).join("")}</div>`
      : empty("This payslip has no gross figure, so the split cannot be shown.");
    const years = v.years.map((y) => `<tr><td data-label="Year"><strong>${h(y.fy)}</strong>${y.complete ? "" : ` <small>(${y.months} of 12)</small>`}</td>
      <td data-label="Gross">${y.totalGross === null ? "—" : fmt.inr(y.totalGross)}</td><td data-label="Tax (TDS)">${fmt.inr(y.totalTds)}</td><td data-label="Provident fund">${fmt.inr(y.totalPf)}</td>
      <td data-label="In your account">${fmt.inr(y.totalNet)}</td><td data-label="Reached you">${y.takeHomePct === null ? "—" : h(fmt.pct(y.takeHomePct, 0))}</td></tr>`).join("");
    return `<h4 class="dv-h">Where the pay goes</h4>${top}
      <h4 class="dv-h">Year by year</h4><div class="table-wrap"><table class="dv-table"><thead><tr><th>Financial year</th><th>Gross</th><th>Tax (TDS)</th><th>Provident fund</th><th>In your account</th><th>Share that reached you</th></tr></thead><tbody>${years}</tbody></table></div>
      <p class="dv-note">Tax (TDS) is what the employer deducted each month; the tax actually due for the year is on the Tax tab. “—” means the payslips do not list a gross figure.</p>`;
  }

  function householdTab(model, o) {
    const { fmt } = o;
    const hh = model.household;
    if (!hh) return empty("Add salary for both of you to see the household.");
    const people = hh.people;
    const rows = hh.rows.slice(-48).map((r) => ({ ym: r.ym, values: Object.fromEntries(people.map((p) => [p, r.by[p] || 0])) }));
    const chart = Ch.columns({ rows, series: people.map((p, i) => ({ key: p, cls: `dc-p${i % 2}` })), label: "Household pay by month", fmt: Ch.short });
    const g = hh.growth12;
    const kp = [
      kpi("Household steady pay", fmt.inr(hh.latest.level), `a month · ${h(fmt.month(hh.latest.ym))}`),
      kpi("Last 12 months", g ? h(sign(g.nominalPct, fmt)) : "—", g ? `${h(sign(g.realPct, fmt))} in today's rupees` : "needs 13 months of pay"),
      ...hh.shares.slice(0, 2).map((s) => kpi(`${name(o.names, s.person)}'s share`, h(fmt.pct(s.sharePct, 0)), `${fmt.inr(s.level)} a month`)),
    ].join("");
    const legend = people.map((p, i) => `<span><i class="dv-swatch dc-p${i % 2}"></i>${h(name(o.names, p))}</span>`).join("");
    const perPerson = people.map((p) => {
      const v = model.views[p], g12 = v.growth12;
      return `<tr><td data-label="Person"><strong>${h(name(o.names, p))}</strong></td><td data-label="Steady pay">${fmt.inr(v.last.levelNet)}</td><td data-label="Last 12 months">${g12 ? h(sign(g12.nominalPct, fmt)) : "—"}</td><td data-label="In today's rupees">${g12 ? h(sign(g12.realPct, fmt)) : "—"}</td><td data-label="Since first payslip">${v.growth.multiple ? `×${h(v.growth.multiple.toFixed(1))}` : "—"}</td></tr>`;
    }).join("");
    return `<div class="metric-grid compact dv-kpis">${kp}</div>
      <div class="dv-toolbar"><span class="dv-legend">${legend}</span></div><div class="dc-chart">${chart}</div>
      <h4 class="dv-h">Each of you</h4><div class="table-wrap"><table class="dv-table"><thead><tr><th>Person</th><th>Steady monthly pay</th><th>Last 12 months</th><th>In today's rupees</th><th>Since first payslip</th></tr></thead><tbody>${perPerson}</tbody></table></div>
      <div class="dv-setting"><label for="dvInflation">Prices rise by</label><input id="dvInflation" class="dv-input" type="text" inputmode="decimal" value="${h(String(model.inflationPct))}" data-act="inflation" aria-describedby="dvInflationHint"><span>% a year</span>
      <span id="dvInflationHint" class="dv-hint">Your assumption (0–30). It turns pay from the past into today's rupees, so a raise smaller than price rises shows as a fall.</span></div>`;
  }

  /** The whole Salary dashboard. model = salary-insights-core analyze(); ui = { tab, person, ym, showReal }. */
  function salary(model, ui, o) {
    const fmt = o.fmt, names = o.names || {};
    const people = Object.keys(model.views).filter((p) => model.views[p]);
    if (!people.length) return empty("Upload your salary workbook or add income entries to see your salary growth.");
    const tab = SALARY_TABS.some(([id]) => id === ui.tab) ? ui.tab : "timeline";
    const person = people.includes(ui.person) ? ui.person : people[0];
    const v = model.views[person];
    const pills = people.length > 1 && tab !== "household"
      ? `<div class="owner-toggle dv-people" role="tablist" aria-label="Whose salary">${people.map((p) => `<button class="owner-pill${p === person ? " active" : ""}" type="button" role="tab" aria-selected="${p === person}" data-act="person" data-id="${h(p)}">${h(name(names, p))}</button>`).join("")}</div>`
      : "";
    const kpis = tab === "household" ? "" : `<div class="metric-grid compact dv-kpis">
      ${kpi("Steady monthly pay", fmt.inr(v.last.levelNet), `${h(fmt.month(v.last.ym))} · ${h(v.last.source)}`)}
      ${kpi("Since first payslip", v.growth.multiple ? `×${h(v.growth.multiple.toFixed(1))}` : "—", `from ${fmt.inr(v.first.net)} in ${h(fmt.month(v.first.ym))}`)}
      ${kpi("Growth a year", v.growth.nominalCagr === null ? "—" : `${h(fmt.pct(v.growth.nominalCagr, 0))}`, v.growth.realCagr === null ? "needs a year of pay" : `${h(fmt.pct(v.growth.realCagr, 0))} after ${h(fmt.pct(v.inflationPct, 1))} price rises`)}
      ${kpi("Best month", fmt.inr(v.highest.net), `${h(fmt.month(v.highest.ym))}${v.highest.oneOff ? " · a one-off" : ""}`)}</div>`;
    const miles = tab === "timeline" ? `<div class="dv-miles">${v.milestones.map((m) => `<span class="dv-mile${m.month ? " hit" : ""}"><b>${h(Ch.short(m.amount))}</b> ${m.month ? h(fmt.month(m.month)) : "not yet"}</span>`).join("")}</div>` : "";
    const ctx = { fmt, names, person, ym: ui.ym, showReal: Boolean(ui.showReal) };
    let body;
    if (tab === "household") body = householdTab(model, ctx);
    else if (tab === "hikes") body = hikesTab(v, ctx);
    else if (tab === "takehome") body = takehomeTab(v, ctx);
    else body = timelineTab(v, ctx);
    return `${tabs(SALARY_TABS, tab, "salary-tab")}${pills}${kpis}${miles}<div class="dv-body">${body}</div>`;
  }

  // ───────────────────────────── Spending ─────────────────────────────

  function savingsTab(sp, ui, o) {
    const { fmt } = o;
    const rated = sp.months.filter((m) => m.savingsRatePct !== null && !m.partial);
    const shown = rated.slice(-36);
    const chart = Ch.columns({
      rows: shown.map((m) => ({ ym: m.ym, values: { rate: m.savingsRatePct }, cls: m.unusual ? "dc-flag" : "" })),
      series: [{ key: "rate", cls: "dc-rate" }], signed: true, fmt: (v) => `${Math.round(v)}%`,
      ref: sp.savings.typicalPct === null ? null : { value: sp.savings.typicalPct, label: `usual ${Math.round(sp.savings.typicalPct)}%` },
      label: "Share of pay left over after spending, by month",
    });
    const picked = sp.months.find((m) => m.ym === ui.ym) || rated[rated.length - 1] || sp.months[sp.months.length - 1];
    const s = sp.savings;
    const summary = s.months
      ? `<p class="dv-note">Over the last ${s.months} months you spent <strong>${fmt.inr(s.spent)}</strong> of <strong>${fmt.inr(s.pay)}</strong> pay and had <strong>${fmt.inr(s.saved)}</strong> left over — <strong>${h(fmt.pct(s.ratePct, 0))}</strong>. A typical month leaves ${h(fmt.pct(s.typicalPct, 0))}.${s.overspent ? ` ${s.overspent} month${s.overspent === 1 ? "" : "s"} spent more than the pay.` : ""}</p>`
      : empty("No pay on record for the months you tracked spending, so the savings rate cannot be worked out.");
    const detail = picked ? `<div class="dv-detail" aria-live="polite"><div class="dv-detail-head"><strong>${h(fmt.month(picked.ym))}</strong>${picked.partial ? ` <span class="dv-chip">so far</span>` : ""}${picked.unusual ? ` <span class="dv-chip warn">unusually high</span>` : ""}</div>
      <div class="dv-detail-grid"><div><span>Pay (month before)</span><b>${picked.pay === null ? "none on record" : fmt.inr(picked.pay)}</b></div><div><span>Spent</span><b>${fmt.inr(picked.total)}</b></div>
      <div><span>Left over</span><b>${picked.saved === null ? "—" : fmt.inr(picked.saved)}</b></div><div><span>Rate</span><b>${picked.savingsRatePct === null ? "—" : h(fmt.pct(picked.savingsRatePct, 0))}</b></div>
      ${picked.unusualItemsTotal ? `<div><span>Of the spend, big one-off payments</span><b>${fmt.inr(picked.unusualItemsTotal)}</b></div><div><span>Rate without them</span><b>${picked.savingsRateEveryday === null ? "—" : h(fmt.pct(picked.savingsRateEveryday, 0))}</b></div>` : ""}</div></div>` : "";
    const last12 = sp.months.filter((m) => !m.partial).slice(-12).reverse();
    const table = last12.map((m) => `<tr><td data-label="Month"><strong>${h(fmt.month(m.ym))}</strong>${m.unusual ? ` <span class="dv-chip warn">high</span>` : ""}</td><td data-label="Pay">${m.pay === null ? "—" : fmt.inr(m.pay)}</td><td data-label="Spent">${fmt.inr(m.total)}</td><td data-label="Left over">${m.saved === null ? "—" : fmt.inr(m.saved)}</td><td data-label="Rate">${m.savingsRatePct === null ? "—" : h(fmt.pct(m.savingsRatePct, 0))}</td></tr>`).join("");
    return `${summary}<div class="dv-toolbar"><span class="dv-legend"><i class="dv-key bar"></i>share of pay left over <i class="dv-key flag"></i>unusually high spend</span></div>
      <div class="dc-chart">${chart}</div><p class="dv-hint">Tap a month to see it. Salary credited at the end of a month pays for the next month, so each month is set against the pay before it.</p>${detail}
      <h4 class="dv-h">Last 12 months</h4><div class="table-wrap"><table class="dv-table"><thead><tr><th>Month</th><th>Pay (month before)</th><th>Spent</th><th>Left over</th><th>Rate</th></tr></thead><tbody>${table}</tbody></table></div>
      <p class="dv-note">“Left over” is what remained after spending, not what you invested.</p>`;
  }

  function categoriesTab(sp, ui, o) {
    const { fmt } = o;
    const ff = sp.fixedFlexible;
    const cols = sp.window.map((ym) => { const m = sp.months.find((x) => x.ym === ym); return { ym, values: { fixed: m.fixed, flex: m.flexible } }; });
    const chart = Ch.columns({ rows: cols, series: [{ key: "fixed", cls: "dc-fixed" }, { key: "flex", cls: "dc-flex" }], label: "Fixed and flexible spending by month" });
    const movers = (list, word, up) => list.length ? `<p class="dv-note"><strong>${word}:</strong> ${list.map((c) => `${h(c.name)} (${up ? "+" : "−"}${fmt.inr(Math.abs(c.recentAvg - c.beforeAvg))} a month)`).join(", ")}</p>` : "";
    const maxShare = Math.max(1, ...sp.categories.map((c) => c.sharePct));
    const rows = sp.categories.slice(0, 18).map((c) => {
      const trend = c.changePct === null ? "—" : `<span class="${c.changePct > 0 ? "down" : "up"}">${c.changePct > 0 ? "▲" : c.changePct < 0 ? "▼" : "▬"} ${h(fmt.pct(Math.abs(c.changePct), 0))}</span>`;
      return `<div class="dv-row dv-cat"><div class="dv-row-main"><div class="dv-row-title">${h(c.name)} <button class="dv-badge ${c.fixed ? "fixed" : "flex"}" type="button" data-act="fixed" data-cat="${h(c.name)}" data-fixed="${c.fixed ? "no" : "yes"}" title="Click to treat as ${c.fixed ? "flexible" : "fixed"}">${c.fixed ? "fixed" : "flexible"}</button></div>
        <div class="dv-row-sub">${fmt.inr(c.monthlyAvg)} a month · ${h(fmt.pct(c.sharePct, 0))} of spending · 6-month trend ${trend}</div>${Ch.bar({ pct: (c.sharePct / maxShare) * 100, cls: c.fixed ? "fixed" : "", label: `${c.name} ${fmt.pct(c.sharePct, 0)}` })}</div>
        <div class="dv-row-aside">${Ch.sparkline(c.series)}<div class="dv-row-value">${fmt.inr(c.total)}</div></div></div>`;
    }).join("");
    const split = ff.fixedMonthly === null ? "" : `<p class="dv-note">Fixed bills take <strong>${fmt.inr(ff.fixedMonthly)}</strong> a month (${h(fmt.pct(ff.fixedSharePct, 0))} of spending). The flexible part, the one you can steer, is <strong>${fmt.inr(ff.flexibleMonthly)}</strong> a month.</p>`;
    return `${split}<div class="dv-toolbar"><span class="dv-legend"><i class="dv-swatch dc-fixed"></i>fixed <i class="dv-swatch dc-flex"></i>flexible</span></div><div class="dc-chart">${chart}</div>
      ${movers(sp.risers, "Going up", true)}${movers(sp.fallers, "Coming down", false)}
      <h4 class="dv-h">Where the money goes (last ${sp.window.length} months)</h4><div class="dv-rows">${rows}</div>
      <p class="dv-note">Fixed means a bill that comes every month (rent, EMI, recharges). The label is a guess from the name — tap it to change it. Trend compares the last 6 months with the 6 before.</p>`;
  }

  function budgetsTab(sp, ui, o) {
    const { fmt } = o;
    const day = o.day;
    const monthWord = sp.budgetMonth ? fmt.month(sp.budgetMonth) : "";
    const statusText = (b) => ({
      ok: "On track.",
      near: b.spent > b.budget ? "" : "Close to the limit.",
      pace: b.projected === null ? "" : `On pace for about ${fmt.inr(b.projected)} this month — over the budget.`,
      over: `Over by ${fmt.inr(b.spent - b.budget)}.`,
    }[b.status]);
    const list = sp.budgets.map((b) => `<div class="dv-row dv-budget ${h(b.status)}"><div class="dv-row-main"><div class="dv-row-title">${h(b.name)}</div>
      <div class="dv-row-sub">${fmt.inr(b.spent)} of ${fmt.inr(b.budget)}${b.partial ? " so far" : ` in ${h(monthWord)}`} · ${h(statusText(b))} ${b.history.length ? `Within budget in ${b.hits} of the last ${b.history.length} months.` : ""}</div>
      ${Ch.bar({ pct: b.usedPct, cls: b.status, label: `${b.name}: ${Math.round(b.usedPct)}% of the budget used` })}</div>
      <div class="dv-row-aside"><div class="dv-row-value">${h(fmt.pct(b.usedPct, 0))}</div><button class="ghost-button dv-btn" type="button" data-act="budget-clear" data-cat="${h(b.name)}">Remove</button></div></div>`).join("");
    const setters = sp.categories.filter((c) => !sp.budgets.some((b) => b.name === c.name)).slice(0, 12).map((c) => {
      const sug = sp.suggestions[c.name];
      return `<div class="dv-setrow"><label for="bud-${h(c.name)}">${h(c.name)}</label><span class="dv-hint">${fmt.inr(c.monthlyAvg)} a month on average</span>
        <input id="bud-${h(c.name)}" class="dv-input" type="text" inputmode="numeric" placeholder="monthly budget ₹" data-act="budget" data-cat="${h(c.name)}" aria-label="Monthly budget for ${h(c.name)}">
        ${sug ? `<button class="ghost-button dv-btn" type="button" data-act="budget-use" data-cat="${h(c.name)}" data-amount="${sug}">Use ${fmt.inr(sug)}</button>` : ""}</div>`;
    }).join("");
    const head = sp.budgets.length ? `<p class="dv-note">${sp.budgets[0].partial ? `${h(monthWord)} so far${day ? ` (day ${day})` : ""}.` : `${h(monthWord)}.`} The pace is only worked out from day 5 of the month.</p>` : empty("No budgets yet. Set one below for the categories you want to watch.");
    return `${head}<div class="dv-rows">${list}</div>
      <h4 class="dv-h">Set a budget</h4><p class="dv-note">Type a monthly amount and press Enter. “Use” fills in the average of the last three months, to the nearest ₹500.</p><div class="dv-setrows">${setters}</div>`;
  }

  function unusualTab(sp, ui, o) {
    const { fmt, names } = o;
    const months = sp.months.filter((m) => m.unusual).slice(-8).reverse();
    const bigByMonth = (ym) => sp.unusualItems.filter((u) => u.ym === ym).slice(0, 3);
    const monthRows = months.length
      ? months.map((m) => { const big = bigByMonth(m.ym); return `<div class="dv-row"><div class="dv-row-main"><div class="dv-row-title">${h(fmt.month(m.ym))}</div><div class="dv-row-sub">Spent ${fmt.inr(m.total)} against a usual ${fmt.inr(m.usualTotal)}.${big.length ? ` ${fmt.inr(m.unusualItemsTotal)} of it was ${big.length === 1 ? "one big payment" : "big payments"}: ${big.map((u) => h(u.note || u.category)).join("; ")}.` : " No single big payment explains it — many everyday spends added up."}</div></div><div class="dv-row-value down">${fmt.inr(m.total - m.usualTotal)} over</div></div>`; }).join("")
      : empty("No month stands out from your usual.");
    const items = sp.unusualItems.slice(0, 12).map((u) => `<tr><td data-label="Date">${h(fmt.month(u.ym))}</td><td data-label="Category">${h(u.category)}</td><td data-label="Note">${h(u.note || "—")}</td><td data-label="Paid by">${h(name(names, u.paidBy))}</td><td data-label="Amount"><strong>${fmt.inr(u.amount)}</strong>${u.usual ? ` <small>usual ${fmt.inr(u.usual)}</small>` : ""}</td></tr>`).join("");
    const people = sp.paidBy.map((p) => `<div class="dv-person"><div class="dv-person-head"><strong>${h(name(names, p.person))}</strong><span>${h(fmt.pct(p.sharePct, 0))} of payments</span></div>
      <div class="dv-person-total">${fmt.inr(p.total)}</div>${Ch.bar({ pct: p.sharePct, label: `${name(names, p.person)} paid ${Math.round(p.sharePct)}%` })}${Ch.sparkline(p.series, { width: 140, height: 30 })}
      <div class="dv-row-sub">Mostly: ${p.top.map((t) => `${h(t.name)} ${fmt.inr(t.value)}`).join(" · ")}</div></div>`).join("");
    return `<h4 class="dv-h">Unusual months</h4><div class="dv-rows">${monthRows}</div>
      <h4 class="dv-h">Big one-off payments</h4>${items ? `<div class="table-wrap"><table class="dv-table"><thead><tr><th>Month</th><th>Category</th><th>Note</th><th>Paid by</th><th>Amount</th></tr></thead><tbody>${items}</tbody></table></div>` : empty("No unusually large payment.")}
      <p class="dv-note">A payment counts as big when it is ${fmt.inr(25000)} or more and at least 3 times the usual payment in its category.</p>
      <h4 class="dv-h">Who paid (last ${sp.window.length} months)</h4><div class="dv-people-grid">${people}</div>
      <p class="dv-note">This shows who paid, not who the money was for.</p>`;
  }

  /** The whole Spending dashboard. sp = spending-insights-core analyze(); ui = { tab, ym }. */
  function spending(sp, ui, o) {
    const fmt = o.fmt;
    if (!sp || !sp.tracked.count) return empty("Add or import expenses to see where the money goes.");
    const tab = SPEND_TABS.some(([id]) => id === ui.tab) ? ui.tab : "savings";
    const s = sp.savings;
    const cur = sp.months.find((m) => m.partial);
    const kpis = `<div class="metric-grid compact dv-kpis">
      ${kpi("A usual month", sp.usualMonth === null ? "—" : fmt.inr(sp.usualMonth), sp.usualMonth === null ? "needs 6 full months" : "spent — the middle of the last 12")}
      ${kpi("Left over", s.ratePct === null ? "—" : h(fmt.pct(s.ratePct, 0)), s.ratePct === null ? "no pay on record" : `${fmt.inr(s.saved)} in the last ${s.months} months`)}
      ${kpi("Fixed bills", sp.fixedFlexible.fixedSharePct === null ? "—" : h(fmt.pct(sp.fixedFlexible.fixedSharePct, 0)), "of spending")}
      ${kpi(cur ? "This month so far" : "Latest month", fmt.inr((cur || sp.months[sp.months.length - 1]).total), sp.usualMonth === null ? "" : `a usual month is ${fmt.inr(sp.usualMonth)}`)}</div>`;
    const skipped = sp.tracked.notTracked.length ? note(`Spending is tracked from <strong>${h(fmt.month(sp.tracked.start))}</strong>. ${sp.tracked.notTracked.length} earlier month${sp.tracked.notTracked.length === 1 ? "" : "s"} with only a few entries (${h(sp.tracked.notTracked.map(fmt.month).slice(-3).join(", "))}${sp.tracked.notTracked.length > 3 ? "…" : ""}) are left out so the averages stay honest.`) : "";
    const ctx = { fmt, names: o.names || {}, day: o.day };
    let body;
    if (tab === "categories") body = categoriesTab(sp, ui, ctx);
    else if (tab === "budgets") body = budgetsTab(sp, ui, ctx);
    else if (tab === "unusual") body = unusualTab(sp, ui, ctx);
    else body = savingsTab(sp, ui, ctx);
    return `${tabs(SPEND_TABS, tab, "spend-tab")}${kpis}${skipped}<div class="dv-body">${body}</div>`;
  }

  return { SALARY_TABS, SPEND_TABS, WHY, salary, spending };
});
