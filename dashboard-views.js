/**
 * Life Ledger — the markup of the Salary and Spending dashboards (pure: analysis in, HTML out; no DOM, no network).
 *
 * Takes what salary-insights-core.js and spending-insights-core.js worked out and lays it out the way an analyst would: a row of
 * headline figures with their change and trend, then cards that each answer one question with one chart and one sentence.
 * All text that comes from the data (company names, categories, notes) is escaped here. The page only puts the result in place
 * and listens to clicks on elements carrying `data-act`.
 *
 * fmt = { inr(n) whole rupees, pct(n, digits) "12%", month("2026-09") "Sep 2026" }.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./dashboard-charts.js"));
  else root.LifeLedgerDashboardViews = factory(root.LifeLedgerDashboardCharts);
})(typeof self !== "undefined" ? self : this, function (Ch) {
  const h = Ch.esc;

  const SALARY_TABS = [["timeline", "Growth timeline"], ["hikes", "Hikes"], ["takehome", "Take-home"], ["household", "Household"]];
  const SPEND_TABS = [["savings", "Savings"], ["categories", "Categories"], ["budgets", "Budgets"], ["unusual", "Unusual & who paid"]];
  const RANGES = [["all", "All"], ["5y", "5Y"], ["3y", "3Y"], ["1y", "1Y"]];
  const RANGE_MONTHS = { "5y": 60, "3y": 36, "1y": 12 };
  const WHY = {
    overlap: "Two payslips landed in this month (a job change), so it is not a normal month.",
    high: "Well above your other months in this job — a bonus, arrears or a settlement.",
    low: "Well below your other months in this job — a part-month or unpaid leave.",
    marked: "You marked this as a one-off.",
    unmarked: "You marked this as a regular month.",
  };

  const sign = (n, fmt, digits) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt.pct(Math.abs(n), digits)}`;
  const mean = (list) => (list.length ? list.reduce((t, v) => t + v, 0) / list.length : null);
  const empty = (text) => `<div class="empty-state">${h(text)}</div>`;
  const note = (text) => `<p class="dv-note">${text}</p>`;
  const name = (names, key) => (names && names[key]) || key;
  const shiftYm = (ym, delta) => { const i = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + delta; return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`; };

  /** A change chip: ▲ green / ▼ red (the other way round when a rise is bad), grey when it hardly moved. */
  function delta(n, text, goodUp) {
    if (n === null || n === undefined || !Number.isFinite(n)) return "";
    const flat = Math.abs(n) < 0.5, up = n > 0, good = goodUp === false ? !up : up;
    return `<span class="dv-delta ${flat ? "flat" : good ? "good" : "bad"}">${flat ? "▬" : up ? "▲" : "▼"} ${h(text)}</span>`;
  }

  /** A headline tile: label, big figure, a change chip and a line of context, with an optional trend line. */
  function kpi(label, value, o) {
    const x = o || {};
    return `<article class="dv-kpi"><div class="dv-kpi-label">${h(label)}</div><div class="dv-kpi-value">${value}</div>
      <div class="dv-kpi-foot">${x.delta || ""}<span class="dv-kpi-sub">${x.sub || ""}</span></div>${x.spark ? `<div class="dv-kpi-spark">${x.spark}</div>` : ""}${x.bar || ""}</article>`;
  }

  function seg(list, active, act, cls) {
    return `<div class="dv-seg ${cls || ""}" role="tablist">${list.map(([id, label]) => `<button class="dv-seg-btn${id === active ? " active" : ""}" type="button" role="tab" aria-selected="${id === active}" data-act="${act}" data-id="${h(id)}">${h(label)}</button>`).join("")}</div>`;
  }

  /** A card: a title, one line saying what to take from it, then the chart or table. */
  function card(title, subtitle, body, tools) {
    return `<section class="dv-card"><header class="dv-card-head"><div><h4>${h(title)}</h4>${subtitle ? `<p>${subtitle}</p>` : ""}</div>${tools ? `<div class="dv-tools">${tools}</div>` : ""}</header>${body}</section>`;
  }

  // ───────────────────────────── Salary ─────────────────────────────

  function monthDetail(m, o) {
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
      <div class="dv-detail-head"><strong>${h(fmt.month(m.ym))}</strong><span>${h(m.sources.join(" + "))}</span>${status}</div>
      <div class="dv-detail-grid">
        <div><span>In your account</span><b>${fmt.inr(m.net)}</b></div>
        <div><span>Gross</span><b>${h(gross)}</b></div>
        <div><span>Tax (TDS)</span><b>${fmt.inr(m.tds)}</b></div>
        <div><span>Provident fund</span><b>${fmt.inr(m.pf)}</b></div>
        ${o.showReal ? `<div><span>In today's rupees</span><b>${fmt.inr(m.netToday)}</b></div>` : ""}
      </div>${why}<div class="dv-actions">${buttons.join("")}</div></div>`;
  }

  function jobsTable(v, fmt) {
    const range = (a, b) => (a === null || b === null ? "—" : `${fmt.inr(a)} → ${fmt.inr(b)}`);
    const rows = v.jobs.map((j) => `<tr>
      <td data-label="Company"><strong>${h(j.source)}</strong></td>
      <td data-label="Period">${h(fmt.month(j.from))} – ${h(fmt.month(j.to))}</td>
      <td data-label="Months">${j.monthCount}</td>
      <td data-label="Take-home">${h(range(j.startNet, j.endNet))}</td>
      <td data-label="Gross">${h(range(j.startGross, j.endGross))}</td></tr>`).join("");
    return `<div class="table-wrap"><table class="dv-table"><thead><tr><th>Company</th><th>Period</th><th>Months</th><th>Take-home a month</th><th>Gross a month</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  /** A job change's step: the gross step, else the take-home step. */
  function changeOf(c, fmt) {
    const pct = c.grossPct !== null ? c.grossPct : c.netPct;
    return { month: c.month, pct, text: sign(pct, fmt) };
  }

  function timelineTab(v, o) {
    const { fmt } = o;
    const range = RANGE_MONTHS[o.range] ? o.range : "all";
    const from = RANGE_MONTHS[range] ? shiftYm(v.last.ym, -(RANGE_MONTHS[range] - 1)) : v.first.ym;
    const months = v.months.filter((m) => m.ym >= from).map((m) => ({
      ...m,
      tip: `${fmt.month(m.ym)} · ${m.sources.join(" + ")} · take-home ${fmt.inr(m.net)}${m.gross !== null ? ` · gross ${fmt.inr(m.gross)}` : ""} · steady ${m.levelNet === null ? "—" : fmt.inr(m.levelNet)}${m.oneOff ? " · one-off" : ""}`,
    }));
    const jobs = v.jobs.filter((j) => j.to >= from).map((j) => ({ ...j, from: j.from < from ? from : j.from }));
    const changes = v.jobChanges.filter((c) => c.month >= from).map((c) => changeOf(c, fmt));
    const picked = v.months.find((m) => m.ym === o.ym) || v.months[v.months.length - 1];
    const chart = Ch.timeline({ months, jobs, changes, showReal: o.showReal, label: `${name(o.names, o.person)}'s take-home pay by month, ${fmt.month(months[0].ym)} to ${fmt.month(v.last.ym)}` });
    const best = v.jobChanges.map((c) => ({ c, pct: changeOf(c, fmt).pct })).sort((a, b) => b.pct - a.pct)[0];
    const oneOffTotal = v.oneOffs.reduce((t, m) => t + m.net, 0);
    const steps = v.jobChanges.length + v.raises.length;
    const insight = `Steady pay has stepped up ${steps} time${steps === 1 ? "" : "s"}${best ? `; the biggest step was ${h(best.c.from)} → ${h(best.c.to)} (${h(sign(best.pct, fmt))} in ${h(fmt.month(best.c.month))})` : ""}. ${v.oneOffs.length ? `${v.oneOffs.length} one-off month${v.oneOffs.length === 1 ? "" : "s"} paid ${fmt.inr(oneOffTotal)} on top, left out of the line.` : ""}`;
    const tools = `${seg(RANGES, range, "range", "small")}<button class="dv-toggle${o.showReal ? " active" : ""}" type="button" data-act="real" aria-pressed="${o.showReal}">Today's rupees</button>`;
    const legend = `<div class="dv-legend"><span><i class="dv-key level"></i>steady pay</span><span><i class="dv-key col"></i>each month</span><span><i class="dv-key colo"></i>one-off month</span>${o.showReal ? `<span><i class="dv-key real"></i>steady pay in today's rupees at ${h(fmt.pct(v.inflationPct, 1))} a year</span>` : ""}</div>`;
    const oneOffs = v.oneOffs.length
      ? `<details class="dv-details"><summary>${v.oneOffs.length} one-off month${v.oneOffs.length === 1 ? "" : "s"} — tap one to inspect it</summary><div class="dv-chiplist">${v.oneOffs.map((m) => `<button class="dv-pickchip" type="button" data-act="pick" data-ym="${h(m.ym)}">${h(fmt.month(m.ym))} · ${fmt.inr(m.net)}</button>`).join("")}</div></details>`
      : "";
    const gaps = v.gaps.length ? note(`⚠ No payslip for ${h(v.gaps.map(fmt.month).join(", "))}. Year totals and averages leave these months out.`) : "";
    return `${card("Take-home pay", insight, `<div class="dc-chart">${chart}</div>${legend}`, tools)}
      ${card("Inspect a month", "Tap a column in the chart, or pick a one-off below.", `${monthDetail(picked, o)}${oneOffs}${gaps}`)}
      ${card("Jobs", "Steady pay at the start and at the end of each job.", jobsTable(v, fmt))}`;
  }

  function hikesTab(v, o) {
    const { fmt } = o;
    const changes = v.jobChanges.map((c) => changeOf(c, fmt));
    const avg = mean(changes.map((c) => c.pct));
    const basisGross = v.jobs.every((j) => j.endGross !== null);
    const ladder = v.jobs.map((j, i) => ({ label: j.source, value: basisGross ? j.endGross : j.endNet, text: i > 0 && changes[i - 1] ? changes[i - 1].text : "" })).filter((i) => i.value !== null);
    const best = changes.slice().sort((a, b) => b.pct - a.pct)[0];
    const sub = changes.length
      ? `Each column is the steady ${basisGross ? "gross" : "take-home"} pay at the end of a job; the badge is the step from the job before.${avg !== null && changes.length > 1 ? ` The average step is <strong>${h(sign(avg, fmt))}</strong>, the best <strong>${h(best.text)}</strong>.` : ""}`
      : "Only one job so far.";
    const raises = v.raises.length
      ? `<div class="table-wrap"><table class="dv-table"><thead><tr><th>Month</th><th>Company</th><th>Monthly pay</th><th>Step</th></tr></thead><tbody>${v.raises.map((r) => `<tr><td data-label="Month"><strong>${h(fmt.month(r.month))}</strong></td><td data-label="Company">${h(r.source)}</td><td data-label="Monthly pay">${fmt.inr(r.before)} → ${fmt.inr(r.after)} <small>${r.basis === "gross" ? "gross" : "take-home"}</small></td><td data-label="Step"><span class="dv-delta good">${h(sign(r.pct, fmt, 1))}</span></td></tr>`).join("")}</tbody></table></div>`
      : empty("No raise inside a job yet.");
    const maxPay = Math.max(1, ...v.years.map((y) => y.totalNet));
    const years = v.years.map((y) => {
      const part = y.complete ? "" : ` <small>${y.months} of 12 months</small>`;
      return `<tr><td data-label="Year"><strong>${h(y.fy)}</strong>${part}</td>
        <td data-label="Pay received"><div class="dv-cellbar"><span>${fmt.inr(y.totalNet)}</span>${Ch.bar({ pct: (y.totalNet / maxPay) * 100, label: `${y.fy} pay` })}</div></td>
        <td data-label="Regular month">${y.avgRegularNet === null ? "—" : fmt.inr(y.avgRegularNet)}</td>
        <td data-label="Vs last year">${y.levelPct === null ? "—" : delta(y.levelPct, sign(y.levelPct, fmt), true)}</td>
        <td data-label="One-off pay">${y.oneOffMonths ? `${fmt.inr(y.oneOffNet)} <small>${y.oneOffMonths} mo</small>` : "—"}</td></tr>`;
    }).join("");
    return `${card("Pay ladder — job by job", sub, ladder.length ? `<div class="dc-chart">${Ch.ladder({ items: ladder, label: "Steady monthly pay at the end of each job" })}</div>` : empty("Not enough payslips yet."))}
      ${card("Raises inside a job", `A raise is a lasting step of ${h(fmt.pct(3, 0))} or more in the steady pay. A one-month bonus is not a raise.`, raises)}
      ${card("Year by year", "Financial years (April–March). “Regular month” leaves out the one-offs, so a part year compares fairly.", `<div class="table-wrap"><table class="dv-table"><thead><tr><th>Financial year</th><th>Pay received</th><th>Regular month</th><th>Monthly pay vs last year</th><th>One-off pay</th></tr></thead><tbody>${years}</tbody></table></div>`)}`;
  }

  function takehomeTab(v, o) {
    const { fmt } = o;
    const b = v.breakdown;
    const bridgeBody = b
      ? `<div class="dc-chart">${Ch.bridge({ label: "From gross pay to the money in your account", items: [
        { label: "Gross pay", value: b.gross, kind: "total" },
        { label: "Income tax (TDS)", value: -b.parts[1].value, kind: "delta" },
        { label: "Provident fund", value: -b.parts[2].value, kind: "delta" },
        { label: "Other deductions", value: -b.parts[3].value, kind: "delta" },
        { label: "In your account", value: b.parts[0].value, kind: "total", cls: "dc-b-net" },
      ] })}</div>`
      : empty("This payslip has no gross figure, so the split cannot be shown.");
    const sub = b ? `${h(fmt.month(b.ym))}: <strong>${h(fmt.pct(b.takeHomePct, 0))}</strong> of the ${fmt.inr(b.gross)} gross reached your account; tax took ${h(fmt.pct((b.parts[1].value / b.gross) * 100, 0))}.` : "";
    const years = v.years.map((y) => `<tr><td data-label="Year"><strong>${h(y.fy)}</strong>${y.complete ? "" : ` <small>${y.months} of 12 months</small>`}</td>
      <td data-label="Gross">${y.totalGross === null ? "—" : fmt.inr(y.totalGross)}</td><td data-label="Tax (TDS)">${fmt.inr(y.totalTds)}</td><td data-label="Provident fund">${fmt.inr(y.totalPf)}</td>
      <td data-label="In your account">${fmt.inr(y.totalNet)}</td>
      <td data-label="Reached you">${y.takeHomePct === null ? "—" : `<div class="dv-cellbar"><span>${h(fmt.pct(y.takeHomePct, 0))}</span>${Ch.bar({ pct: y.takeHomePct, cls: "ok", label: `${y.fy} share that reached you` })}</div>`}</td>
      <td data-label="Tax rate">${y.totalGross ? h(fmt.pct((y.totalTds / y.totalGross) * 100, 0)) : "—"}</td></tr>`).join("");
    return `${card("Where the gross pay goes", sub, bridgeBody)}
      ${card("Year by year", "Tax (TDS) is what the employer deducted each month; the tax actually due for the year is on the Tax tab. “—” means the payslips do not list a gross figure.", `<div class="table-wrap"><table class="dv-table"><thead><tr><th>Financial year</th><th>Gross</th><th>Tax (TDS)</th><th>Provident fund</th><th>In your account</th><th>Share that reached you</th><th>Tax rate</th></tr></thead><tbody>${years}</tbody></table></div>`)}`;
  }

  function householdTab(model, o) {
    const { fmt } = o;
    const hh = model.household;
    if (!hh) return empty("Add salary for both of you to see the household.");
    const people = hh.people;
    const rows = hh.rows.slice(-48).map((r) => ({ ym: r.ym, values: Object.fromEntries(people.map((p) => [p, r.by[p] || 0])), tip: `${fmt.month(r.ym)} · household ${fmt.inr(r.net)} · steady ${fmt.inr(r.level)}` }));
    const chart = Ch.columns({ rows, series: people.map((p, i) => ({ key: p, cls: `dc-p${i % 2}` })), line: { cls: "dc-level", step: true, values: Object.fromEntries(hh.rows.map((r) => [r.ym, r.level])) }, label: "Household pay by month", height: 300 });
    const g = hh.growth12;
    const legend = `<div class="dv-legend">${people.map((p, i) => `<span><i class="dv-swatch dc-p${i % 2}"></i>${h(name(o.names, p))}</span>`).join("")}<span><i class="dv-key level"></i>household steady pay</span></div>`;
    const split = Ch.stack(hh.shares.map((s, i) => ({ label: name(o.names, s.person), value: s.level, cls: `dc-p${i % 2}` })), "Share of the household's steady pay");
    const perPerson = people.map((p) => {
      const v = model.views[p], g12 = v.growth12;
      return `<tr><td data-label="Person"><strong>${h(name(o.names, p))}</strong></td><td data-label="Steady pay">${fmt.inr(v.last.levelNet)}</td><td data-label="Share">${h(fmt.pct(hh.shares.find((s) => s.person === p).sharePct, 0))}</td><td data-label="Last 12 months">${g12 ? delta(g12.nominalPct, sign(g12.nominalPct, fmt), true) : "—"}</td><td data-label="In today's rupees">${g12 ? delta(g12.realPct, sign(g12.realPct, fmt), true) : "—"}</td><td data-label="Since first payslip">${v.growth.multiple ? `×${h(v.growth.multiple.toFixed(1))}` : "—"}</td></tr>`;
    }).join("");
    const kp = `<div class="dv-kpis three">
      ${kpi("Household steady pay", fmt.inr(hh.latest.level), { sub: `a month · ${h(fmt.month(hh.latest.ym))}`, delta: g ? delta(g.nominalPct, `${sign(g.nominalPct, fmt)} in 12 months`, true) : "" })}
      ${kpi("In today's rupees", g ? h(sign(g.realPct, fmt)) : "—", { sub: g ? `12-month growth after ${h(fmt.pct(model.inflationPct, 1))} price rises` : "needs 13 months of pay" })}
      ${kpi("Pay split", h(hh.shares.map((s) => fmt.pct(s.sharePct, 0)).join(" / ")), { sub: h(hh.shares.map((s) => name(o.names, s.person)).join(" / ")), bar: `<div class="dv-kpi-bar">${split}</div>` })}</div>`;
    const setting = `<div class="dv-setting"><label for="dvInflation">Prices rise by</label><input id="dvInflation" class="dv-input" type="text" inputmode="decimal" value="${h(String(model.inflationPct))}" data-act="inflation" aria-describedby="dvInflationHint"><span>% a year</span>
      <span id="dvInflationHint" class="dv-hint">Your assumption (0–30). It turns past pay into today's rupees, so a raise smaller than price rises shows as a fall.</span></div>`;
    return `${kp}${card("Household pay by month", "Columns are what each of you received that month; the line is the household's steady pay with the one-offs taken out.", `<div class="dc-chart">${chart}</div>${legend}`)}
      ${card("Each of you", "", `<div class="table-wrap"><table class="dv-table"><thead><tr><th>Person</th><th>Steady monthly pay</th><th>Share</th><th>Last 12 months</th><th>In today's rupees</th><th>Since first payslip</th></tr></thead><tbody>${perPerson}</tbody></table></div>${setting}`)}`;
  }

  /** The whole Salary dashboard. model = salary-insights-core analyze(); ui = { tab, person, ym, showReal, range }. */
  function salary(model, ui, o) {
    const fmt = o.fmt, names = o.names || {};
    const people = Object.keys(model.views).filter((p) => model.views[p]);
    if (!people.length) return empty("Upload your salary workbook or add income entries to see your salary growth.");
    const tab = SALARY_TABS.some(([id]) => id === ui.tab) ? ui.tab : "timeline";
    const person = people.includes(ui.person) ? ui.person : people[0];
    const v = model.views[person];
    const who = people.length > 1 && tab !== "household" ? seg(people.map((p) => [p, name(names, p)]), person, "person", "who") : "";
    let kpis = "";
    if (tab !== "household") {
      const g12 = v.growth12, steady = v.months.filter((m) => m.levelNet !== null).slice(-36).map((m) => m.levelNet);
      const next = v.milestones.find((m) => !m.month);
      const toNext = next ? Math.min(100, (v.last.levelNet / next.amount) * 100) : null;
      kpis = `<div class="dv-kpis">
        ${kpi("Steady monthly pay", fmt.inr(v.last.levelNet), { sub: `${h(fmt.month(v.last.ym))} · ${h(v.last.source)}`, delta: g12 ? delta(g12.nominalPct, `${sign(g12.nominalPct, fmt)} vs 12 months ago`, true) : "", spark: Ch.sparkline(steady, { width: 160, height: 34 }) })}
        ${kpi("Since first payslip", v.growth.multiple ? `×${h(v.growth.multiple.toFixed(1))}` : "—", { sub: `from ${fmt.inr(v.first.net)} in ${h(fmt.month(v.first.ym))}` })}
        ${kpi("Growth a year", v.growth.nominalCagr === null ? "—" : h(fmt.pct(v.growth.nominalCagr, 0)), { sub: v.growth.realCagr === null ? "needs a year of pay" : `${h(fmt.pct(v.growth.realCagr, 0))} after ${h(fmt.pct(v.inflationPct, 1))} price rises` })}
        ${kpi("Take-home share", v.breakdown ? h(fmt.pct(v.breakdown.takeHomePct, 0)) : "—", { sub: v.breakdown ? `of ${fmt.inr(v.breakdown.gross)} gross · ${h(fmt.month(v.breakdown.ym))}` : "no gross on the payslip" })}
        ${kpi("Next milestone", next ? h(Ch.short(next.amount)) : "All reached", { sub: next ? `${h(fmt.pct(toNext, 1))} of the way there` : "", bar: next ? `<div class="dv-kpi-bar">${Ch.bar({ pct: toNext, cls: "ok", label: `${toNext.toFixed(1)}% of ${next.amount}` })}</div>` : "" })}</div>`;
    }
    const ctx = { fmt, names, person, ym: ui.ym, showReal: Boolean(ui.showReal), range: ui.range };
    let body;
    if (tab === "household") body = householdTab(model, ctx);
    else if (tab === "hikes") body = hikesTab(v, ctx);
    else if (tab === "takehome") body = takehomeTab(v, ctx);
    else body = timelineTab(v, ctx);
    return `<div class="dv-bar-top">${seg(SALARY_TABS, tab, "salary-tab", "main")}${who}</div>${kpis}<div class="dv-body">${body}</div>`;
  }

  // ───────────────────────────── Spending ─────────────────────────────

  function savingsTab(sp, ui, o) {
    const { fmt } = o;
    const complete = sp.months.filter((m) => !m.partial);
    const shown = complete.slice(-24);
    const incomeLine = Object.fromEntries(shown.filter((m) => m.pay !== null).map((m) => [m.ym, m.pay]));
    const tip = (m) => `${fmt.month(m.ym)} · spent ${fmt.inr(m.total)}${m.pay !== null ? ` · pay ${fmt.inr(m.pay)} · left ${fmt.inr(m.saved)} (${fmt.pct(m.savingsRatePct, 0)})` : ""}${m.unusual ? " · unusually high" : ""}`;
    const combo = Ch.columns({
      rows: shown.map((m) => ({ ym: m.ym, values: { fixed: m.fixed, flex: m.flexible }, cls: m.unusual ? "dc-flag" : "", tip: tip(m) })),
      series: [{ key: "fixed", cls: "dc-fixed" }, { key: "flex", cls: "dc-flex" }], line: { cls: "dc-level", step: true, values: incomeLine }, label: "Monthly spending against the pay that funds it", height: 280,
    });
    const rated = complete.filter((m) => m.savingsRatePct !== null).slice(-36);
    const roll = Object.fromEntries(rated.filter((m) => m.rollingRatePct !== null).map((m) => [m.ym, m.rollingRatePct]));
    const rate = Ch.columns({
      rows: rated.map((m) => ({ ym: m.ym, values: { rate: m.savingsRatePct }, cls: m.unusual ? "dc-flag" : "", tip: tip(m) })),
      series: [{ key: "rate", cls: "dc-rate" }], signed: true, fmt: (v) => `${Math.round(v)}%`, line: { cls: "dc-level", values: roll }, label: "Share of pay left over after spending, by month", height: 240,
    });
    const s = sp.savings;
    const picked = sp.months.find((m) => m.ym === ui.ym) || rated[rated.length - 1] || sp.months[sp.months.length - 1];
    const summary = s.months
      ? `Over the last ${s.months} months you spent <strong>${fmt.inr(s.spent)}</strong> of <strong>${fmt.inr(s.pay)}</strong> pay and kept <strong>${fmt.inr(s.saved)}</strong> — <strong>${h(fmt.pct(s.ratePct, 0))}</strong>${s.prevRatePct !== null ? ` (${h(fmt.pct(s.prevRatePct, 0))} the year before)` : ""}.${s.overspent ? ` ${s.overspent} month${s.overspent === 1 ? "" : "s"} spent more than the pay.` : ""}`
      : "No pay on record for the months you tracked spending, so the savings rate cannot be worked out.";
    const detail = picked ? `<div class="dv-detail" aria-live="polite"><div class="dv-detail-head"><strong>${h(fmt.month(picked.ym))}</strong>${picked.partial ? ` <span class="dv-chip">so far</span>` : ""}${picked.unusual ? ` <span class="dv-chip warn">unusually high</span>` : ""}</div>
      <div class="dv-detail-grid"><div><span>Pay (month before)</span><b>${picked.pay === null ? "none on record" : fmt.inr(picked.pay)}</b></div><div><span>Spent</span><b>${fmt.inr(picked.total)}</b></div>
      <div><span>Left over</span><b>${picked.saved === null ? "—" : fmt.inr(picked.saved)}</b></div><div><span>Rate</span><b>${picked.savingsRatePct === null ? "—" : h(fmt.pct(picked.savingsRatePct, 0))}</b></div>
      ${picked.unusualItemsTotal ? `<div><span>Big one-off payments</span><b>${fmt.inr(picked.unusualItemsTotal)}</b></div><div><span>Rate without them</span><b>${picked.savingsRateEveryday === null ? "—" : h(fmt.pct(picked.savingsRateEveryday, 0))}</b></div>` : ""}</div></div>` : "";
    const last12 = complete.slice(-12).reverse();
    const table = last12.map((m) => `<tr><td data-label="Month"><strong>${h(fmt.month(m.ym))}</strong>${m.unusual ? ` <span class="dv-chip warn">high</span>` : ""}</td><td data-label="Pay">${m.pay === null ? "—" : fmt.inr(m.pay)}</td><td data-label="Spent">${fmt.inr(m.total)}</td><td data-label="Left over">${m.saved === null ? "—" : fmt.inr(m.saved)}</td><td data-label="Rate">${m.savingsRatePct === null ? "—" : delta(m.savingsRatePct, fmt.pct(m.savingsRatePct, 0), true)}</td></tr>`).join("");
    const legendA = `<div class="dv-legend"><span><i class="dv-swatch dc-fixed"></i>fixed bills</span><span><i class="dv-swatch dc-flex"></i>flexible</span><span><i class="dv-key level"></i>pay (month before)</span><span><i class="dv-key flag"></i>unusually high month</span></div>`;
    const legendB = `<div class="dv-legend"><span><i class="dv-swatch dc-rate"></i>left over in the month</span><span><i class="dv-key level"></i>12-month rolling rate</span></div>`;
    return `${card("Spending against pay", summary, `<div class="dc-chart">${combo}</div>${legendA}`)}
      ${card("Share of pay left over", "Each month is set against the salary credited the month before. The line smooths out bonus months.", `<div class="dc-chart">${rate}</div>${legendB}`)}
      ${card("Inspect a month", "Tap a column in either chart.", detail)}
      ${card("Last 12 months", "“Left over” is what remained after spending, not what you invested.", `<div class="table-wrap"><table class="dv-table"><thead><tr><th>Month</th><th>Pay (month before)</th><th>Spent</th><th>Left over</th><th>Rate</th></tr></thead><tbody>${table}</tbody></table></div>`)}`;
  }

  function categoriesTab(sp, ui, o) {
    const { fmt } = o;
    const ff = sp.fixedFlexible;
    const cols = sp.window.map((ym) => { const m = sp.months.find((x) => x.ym === ym); return { ym, values: { fixed: m.fixed, flex: m.flexible }, tip: `${fmt.month(ym)} · fixed ${fmt.inr(m.fixed)} · flexible ${fmt.inr(m.flexible)}` }; });
    const chart = Ch.columns({ rows: cols, series: [{ key: "fixed", cls: "dc-fixed" }, { key: "flex", cls: "dc-flex" }], label: "Fixed and flexible spending by month", height: 230 });
    const split = ff.fixedMonthly === null ? "" : `Fixed bills take <strong>${fmt.inr(ff.fixedMonthly)}</strong> a month (${h(fmt.pct(ff.fixedSharePct, 0))} of spending). The flexible part, the one you can steer, is <strong>${fmt.inr(ff.flexibleMonthly)}</strong> a month.`;
    const top = sp.categories.slice(0, 10);
    const heat = Ch.heatmap({
      label: "Spending by category and month; darker means further above that category's own average",
      heads: sp.window.map((ym) => fmt.month(ym).slice(0, 3) + " " + ym.slice(2, 4)),
      rows: top.map((c) => ({ label: c.name, cells: c.series.map((v, i) => ({ text: v ? Ch.short(v) : "·", level: c.levels[i], tip: `${c.name} · ${fmt.month(sp.window[i])} · ${fmt.inr(v)}` })) })),
    });
    const movers = (list, word, up) => (list.length ? `<br><strong>${word}:</strong> ${list.map((c) => `${h(c.name)} (${up ? "+" : "−"}${fmt.inr(Math.abs(c.recentAvg - c.beforeAvg))} a month)`).join(", ")}` : "");
    const maxShare = Math.max(1, ...sp.categories.map((c) => c.sharePct));
    const rows = sp.categories.slice(0, 18).map((c) => {
      const trend = c.changePct === null ? "" : delta(c.changePct, `${fmt.pct(Math.abs(c.changePct), 0)} vs prior 6 months`, false);
      return `<div class="dv-row dv-cat"><div class="dv-row-main"><div class="dv-row-title">${h(c.name)} <button class="dv-badge ${c.fixed ? "fixed" : "flex"}" type="button" data-act="fixed" data-cat="${h(c.name)}" data-fixed="${c.fixed ? "no" : "yes"}" title="Click to treat as ${c.fixed ? "flexible" : "fixed"}">${c.fixed ? "fixed" : "flexible"}</button> ${trend}</div>
        <div class="dv-row-sub">${fmt.inr(c.monthlyAvg)} a month · ${h(fmt.pct(c.sharePct, 0))} of spending</div>${Ch.bar({ pct: (c.sharePct / maxShare) * 100, cls: c.fixed ? "fixed" : "", label: `${c.name} ${fmt.pct(c.sharePct, 0)}` })}</div>
        <div class="dv-row-aside">${Ch.sparkline(c.series)}<div class="dv-row-value">${fmt.inr(c.total)}</div></div></div>`;
    }).join("");
    return `${card("Fixed vs flexible", split, `<div class="dc-chart">${chart}</div><div class="dv-legend"><span><i class="dv-swatch dc-fixed"></i>fixed</span><span><i class="dv-swatch dc-flex"></i>flexible</span></div>`)}
      ${card("Category heat grid", `Last ${sp.window.length} months, top ${top.length} categories. A darker cell is a month well above that category's own average.${movers(sp.risers, "Going up", true)}${movers(sp.fallers, "Coming down", false)}`, `<div class="dc-scroll">${heat}</div>`)}
      ${card("Where the money goes", `Last ${sp.window.length} months. The label is a guess from the name — tap it to change it. The trend compares the last 6 months with the 6 before.`, `<div class="dv-rows">${rows}</div>`)}`;
  }

  function budgetsTab(sp, ui, o) {
    const { fmt } = o;
    const monthWord = sp.budgetMonth ? fmt.month(sp.budgetMonth) : "";
    const statusText = (b) => ({
      ok: "On track.",
      near: b.spent > b.budget ? "" : "Close to the limit.",
      pace: b.projected === null ? "" : `On pace for about ${fmt.inr(b.projected)} — over the budget.`,
      over: `Over by ${fmt.inr(b.spent - b.budget)}.`,
    }[b.status]);
    const list = sp.budgets.map((b) => {
      const scale = Math.max(b.budget * 1.25, b.spent, b.projected || 0) || 1;
      const markers = [{ pct: (b.budget / scale) * 100, cls: "budget" }, ...(b.projected !== null ? [{ pct: (b.projected / scale) * 100, cls: "proj" }] : [])];
      return `<div class="dv-row dv-budget ${h(b.status)}"><div class="dv-row-main"><div class="dv-row-title">${h(b.name)} <span class="dv-delta ${b.status === "ok" ? "good" : b.status === "near" ? "flat" : "bad"}">${h(statusText(b) || "")}</span></div>
        <div class="dv-row-sub">${fmt.inr(b.spent)} of ${fmt.inr(b.budget)}${b.partial ? " so far" : ` in ${h(monthWord)}`}${b.projected !== null ? ` · pace ${fmt.inr(b.projected)}` : ""}${b.history.length ? ` · within budget in ${b.hits} of the last ${b.history.length} months` : ""}</div>
        ${Ch.bar({ pct: (b.spent / scale) * 100, cls: b.status, markers, label: `${b.name}: ${Math.round(b.usedPct)}% of the budget used` })}</div>
        <div class="dv-row-aside"><div class="dv-row-value">${h(fmt.pct(b.usedPct, 0))}</div><button class="ghost-button dv-btn" type="button" data-act="budget-clear" data-cat="${h(b.name)}">Remove</button></div></div>`;
    }).join("");
    const setters = sp.categories.filter((c) => !sp.budgets.some((b) => b.name === c.name)).slice(0, 12).map((c) => {
      const sug = sp.suggestions[c.name];
      return `<div class="dv-setrow"><label for="bud-${h(c.name)}">${h(c.name)}</label><span class="dv-hint">${fmt.inr(c.monthlyAvg)} a month on average</span>
        <input id="bud-${h(c.name)}" class="dv-input" type="text" inputmode="numeric" placeholder="monthly budget ₹" data-act="budget" data-cat="${h(c.name)}" aria-label="Monthly budget for ${h(c.name)}">
        ${sug ? `<button class="ghost-button dv-btn" type="button" data-act="budget-use" data-cat="${h(c.name)}" data-amount="${sug}">Use ${fmt.inr(sug)}</button>` : ""}</div>`;
    }).join("");
    const sub = sp.budgets.length ? `${h(monthWord)}${sp.budgets[0].partial ? " so far" : ""}${o.day && sp.budgets[0].partial ? ` (day ${o.day})` : ""}. The bar is the spend; the line is the budget; the second line is where the month is heading. A pace is worked out from day 5.` : "";
    return `${card("Budgets", sub, sp.budgets.length ? `<div class="dv-rows">${list}</div>` : empty("No budgets yet. Set one below for the categories you want to watch."))}
      ${card("Set a budget", "Type a monthly amount and press Enter. “Use” fills in the average of the last three months, to the nearest ₹500.", `<div class="dv-setrows">${setters}</div>`)}`;
  }

  function unusualTab(sp, ui, o) {
    const { fmt, names } = o;
    const months = sp.months.filter((m) => m.unusual).slice(-8).reverse();
    const target = months[0] || null;
    const bigIn = (ym) => sp.unusualItems.filter((u) => u.ym === ym);
    const bridgeHtml = target
      ? (() => {
        const bigTotal = bigIn(target.ym).reduce((t, u) => t + u.amount, 0);
        return `<div class="dc-chart">${Ch.bridge({ label: `${fmt.month(target.ym)}: from a usual month to what was spent`, items: [
          { label: "A usual month", value: target.usualTotal, kind: "total" },
          { label: "Everyday spend vs usual", value: target.everydayTotal - target.usualTotal, kind: "delta" },
          { label: "Big one-off payments", value: bigTotal, kind: "delta" },
          { label: fmt.month(target.ym), value: target.total, kind: "total", cls: "dc-b-net" },
        ] })}</div>`;
      })()
      : empty("No month stands out from your usual.");
    const monthRows = months.map((m) => { const big = bigIn(m.ym).slice(0, 3); return `<div class="dv-row"><div class="dv-row-main"><div class="dv-row-title">${h(fmt.month(m.ym))}</div><div class="dv-row-sub">Spent ${fmt.inr(m.total)} against a usual ${fmt.inr(m.usualTotal)}.${big.length ? ` ${fmt.inr(m.unusualItemsTotal)} of it was ${big.length === 1 ? "one big payment" : "big payments"}: ${big.map((u) => h(u.note || u.category)).join("; ")}.` : " No single big payment explains it — many everyday spends added up."}</div></div><div class="dv-row-value down">${fmt.inr(m.total - m.usualTotal)} over</div></div>`; }).join("");
    const items = sp.unusualItems.slice(0, 12).map((u) => `<tr><td data-label="Month">${h(fmt.month(u.ym))}</td><td data-label="Category">${h(u.category)}</td><td data-label="Note">${h(u.note || "—")}</td><td data-label="Paid by">${h(name(names, u.paidBy))}</td><td data-label="Amount"><strong>${fmt.inr(u.amount)}</strong>${u.usual ? ` <small>usual ${fmt.inr(u.usual)}</small>` : ""}</td></tr>`).join("");
    const people = sp.paidBy.map((p) => `<div class="dv-person"><div class="dv-person-head"><strong>${h(name(names, p.person))}</strong><span>${h(fmt.pct(p.sharePct, 0))} of payments</span></div>
      <div class="dv-person-total">${fmt.inr(p.total)}</div>${Ch.bar({ pct: p.sharePct, label: `${name(names, p.person)} paid ${Math.round(p.sharePct)}%` })}${Ch.sparkline(p.series, { width: 160, height: 32 })}
      <div class="dv-row-sub">Mostly: ${p.top.map((t) => `${h(t.name)} ${fmt.inr(t.value)}`).join(" · ")}</div></div>`).join("");
    return `${card("Anatomy of the latest unusual month", target ? `${h(fmt.month(target.ym))} cost ${fmt.inr(target.total - target.usualTotal)} more than a usual month.` : "", bridgeHtml)}
      ${card("Unusual months", "", monthRows ? `<div class="dv-rows">${monthRows}</div>` : empty("No month stands out from your usual."))}
      ${card("Big one-off payments", `A payment counts as big when it is ${fmt.inr(25000)} or more and at least 3 times the usual payment in its category.`, items ? `<div class="table-wrap"><table class="dv-table"><thead><tr><th>Month</th><th>Category</th><th>Note</th><th>Paid by</th><th>Amount</th></tr></thead><tbody>${items}</tbody></table></div>` : empty("No unusually large payment."))}
      ${card(`Who paid (last ${sp.window.length} months)`, "This shows who paid, not who the money was for.", `<div class="dv-people-grid">${people}</div>`)}`;
  }

  /** The whole Spending dashboard. sp = spending-insights-core analyze(); ui = { tab, ym }. */
  function spending(sp, ui, o) {
    const fmt = o.fmt;
    if (!sp || !sp.tracked.count) return empty("Add or import expenses to see where the money goes.");
    const tab = SPEND_TABS.some(([id]) => id === ui.tab) ? ui.tab : "savings";
    const s = sp.savings;
    const cur = sp.months.find((m) => m.partial), latest = cur || sp.months[sp.months.length - 1];
    const roll = sp.months.filter((m) => m.rollingRatePct !== null).slice(-36).map((m) => m.rollingRatePct);
    const riser = sp.risers[0];
    const vsUsual = sp.usualMonth ? ((latest.total - sp.usualMonth) / sp.usualMonth) * 100 : null;
    const kpis = `<div class="dv-kpis">
      ${kpi("A usual month", sp.usualMonth === null ? "—" : fmt.inr(sp.usualMonth), { sub: sp.usualMonth === null ? "needs 6 full months" : "spent — the middle of the last 12" })}
      ${kpi("Kept after spending", s.ratePct === null ? "—" : h(fmt.pct(s.ratePct, 0)), { sub: s.ratePct === null ? "no pay on record" : `${fmt.inr(s.saved)} in ${s.months} months`, delta: s.prevRatePct !== null && s.ratePct !== null ? delta(s.ratePct - s.prevRatePct, `${s.ratePct - s.prevRatePct >= 0 ? "+" : "−"}${Math.abs(s.ratePct - s.prevRatePct).toFixed(0)} pts vs year before`, true) : "", spark: Ch.sparkline(roll, { width: 160, height: 34 }) })}
      ${kpi("Fixed bills", sp.fixedFlexible.fixedSharePct === null ? "—" : h(fmt.pct(sp.fixedFlexible.fixedSharePct, 0)), { sub: sp.fixedFlexible.fixedMonthly === null ? "" : `${fmt.inr(sp.fixedFlexible.fixedMonthly)} a month` })}
      ${kpi(cur ? "This month so far" : "Latest month", fmt.inr(latest.total), { sub: sp.usualMonth === null ? "" : `a usual month is ${fmt.inr(sp.usualMonth)}`, delta: vsUsual === null ? "" : delta(vsUsual, `${fmt.pct(Math.abs(vsUsual), 0)} ${vsUsual >= 0 ? "above" : "below"} usual`, false) })}
      ${kpi("Biggest riser", riser ? h(riser.name) : "—", { sub: riser ? `+${fmt.inr(riser.recentAvg - riser.beforeAvg)} a month vs the 6 before` : "nothing is climbing", delta: riser ? delta(riser.changePct, `${fmt.pct(riser.changePct, 0)}`, false) : "" })}</div>`;
    const skipped = sp.tracked.notTracked.length ? note(`Spending is tracked from <strong>${h(fmt.month(sp.tracked.start))}</strong>. ${sp.tracked.notTracked.length} earlier month${sp.tracked.notTracked.length === 1 ? "" : "s"} with only a few entries (${h(sp.tracked.notTracked.map(fmt.month).slice(-3).join(", "))}${sp.tracked.notTracked.length > 3 ? "…" : ""}) are left out so the averages stay honest.`) : "";
    const ctx = { fmt, names: o.names || {}, day: o.day };
    let body;
    if (tab === "categories") body = categoriesTab(sp, ui, ctx);
    else if (tab === "budgets") body = budgetsTab(sp, ui, ctx);
    else if (tab === "unusual") body = unusualTab(sp, ui, ctx);
    else body = savingsTab(sp, ui, ctx);
    return `<div class="dv-bar-top">${seg(SPEND_TABS, tab, "spend-tab", "main")}</div>${kpis}${skipped}<div class="dv-body">${body}</div>`;
  }

  return { SALARY_TABS, SPEND_TABS, RANGES, WHY, salary, spending };
});
