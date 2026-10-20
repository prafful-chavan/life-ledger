/**
 * Life Ledger — Tax page UI. All the arithmetic is in tax-core.js (LifeLedgerTax); this file only draws it and edits the
 * household's tax data, which lives in the encrypted vault (state.taxProfile, state.taxReturns, state.taxFamily).
 * Nothing personal is in this file. Planning aid only — a CA confirms before anything is filed or paid.
 */
(function () {
  "use strict";
  const T = () => window.LifeLedgerTax;
  const App = () => window.LifeLedgerApp;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const inr = (v) => (num(v) < 0 ? "−" : "") + "₹" + Math.abs(Math.round(num(v))).toLocaleString("en-IN");
  const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const prettyDate = (iso) => { if (!iso) return "—"; const d = new Date(iso + "T00:00:00Z"); return isNaN(d) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }); };
  const uid = (p) => `${p}-${(crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(16).slice(2) + Date.now())}`;
  const NAMES = { Me: "Prafful", Wife: "Archana" };
  const TABS = [["today", "Today"], ["plan", "Plan"], ["savings", "Savings"], ["returns", "Returns"], ["family", "Family money"], ["rules", "Rules"], ["data", "Data"]];
  let tab = "today";
  let model = null;

  const state = () => App().getState();
  function save() { return App().saveData(true); }
  const profile = () => { const s = state(); if (!s.taxProfile || typeof s.taxProfile !== "object") s.taxProfile = {}; return s.taxProfile; };
  const chip = (cls, text) => `<span class="prot-chip ${cls}">${esc(text)}</span>`;
  const sevChip = (sev) => chip(sev === "high" ? "bad" : sev === "medium" ? "warn" : sev === "info" ? "muted" : "muted", sev);
  const note = () => `<p class="tax-note">Planning aid, not tax advice. Figures come from your own records and the law as checked on ${esc(T().law.VERIFIED)}; a CA confirms before anything is filed or paid.</p>`;

  /** In-page confirmation (native confirm/alert are blocked in some browsers and silently answer "no"). */
  function ask(message, yes = "Replace", no = "Cancel") {
    return new Promise((resolve) => {
      const old = document.getElementById("taxAsk"); if (old) old.remove();
      const box = document.createElement("div"); box.id = "taxAsk"; box.className = "tax-ask"; box.setAttribute("role", "alertdialog"); box.setAttribute("aria-modal", "true");
      box.innerHTML = `<div class="tax-ask-card"><p>${esc(message).replace(/\n/g, "<br>")}</p><div class="prot-actions">${no ? `<button type="button" class="secondary-button" data-tax-ask="no">${esc(no)}</button>` : ""}<button type="button" class="primary-button" data-tax-ask="yes">${esc(yes)}</button></div></div>`;
      const onKey = (e) => { if (e.key === "Escape") done(false); };
      const done = (v) => { box.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
      box.addEventListener("click", (e) => { const b = e.target.closest("[data-tax-ask]"); if (b) done(b.dataset.taxAsk === "yes"); else if (e.target === box) done(false); });
      document.addEventListener("keydown", onKey); document.body.appendChild(box); box.querySelector('[data-tax-ask="yes"]').focus();
    });
  }

  // One model per data change, shared by this page, the dashboard card, the Wealth Advisor and Hey Prafful,
  // so every place shows the same tax figures.
  let cacheKey = 0, cachedFor = -1;
  function compute() {
    if (cachedFor === cacheKey && model) return model;
    try { model = T().household.build(state(), today()); cachedFor = cacheKey; } catch (e) { console.warn(e); model = null; }
    return model;
  }
  const invalidate = () => { cacheKey++; };
  /** Shared accessor; null until the vault is open. */
  function sharedModel() { return App() && App().getState && T() ? compute() : null; }

  // ── Dashboard card ──────────────────────────────────────────────────────────────────────
  function renderCard() {
    const card = $("taxCard"); if (!card) return;
    const m = sharedModel();
    const people = m ? m.people.filter((p) => p.plan) : [];
    if (!people.length) { card.hidden = true; return; }
    card.hidden = false;
    const next = m.deadlines.find((d) => d.inDays >= 0 && (d.kind === "law" || /Advance tax for/.test(d.title))) || m.deadlines.find((d) => d.inDays >= 0);
    $("taxCardSummary").textContent = people.map((p) => `${p.name} ${inr(p.plan.regimes[p.plan.better].tax)}`).join(" · ") + ` this year (${people[0].plan.better} regime)`;
    const lines = [];
    const short = people.filter((p) => p.plan.balance < -10000);
    if (short.length) lines.push(`TDS short by ${short.map((p) => `${inr(-p.plan.balance)} (${p.name})`).join(", ")}`);
    if (next) lines.push(`${prettyDate(next.date)}: ${next.title}`);
    if (m.savings && m.savings.totals.runRate > 0) lines.push(`Could save ${inr(m.savings.totals.thisYear)} this year, ${inr(m.savings.totals.runRate)} a year after`);
    const hi = m.actions.filter((a) => a.severity === "high").length;
    if (hi) lines.push(`${hi} important tax action${hi === 1 ? "" : "s"} waiting`);
    $("taxCardLines").innerHTML = lines.slice(0, 4).map((t) => `<li>${esc(t)}</li>`).join("");
  }

  // ── Today ───────────────────────────────────────────────────────────────────────────────
  function viewToday(m) {
    const stat = (label, big, small) => `<div class="prot-stat"><span>${esc(label)}</span><b>${big}</b><small>${small}</small></div>`;
    const cards = m.people.map((p) => {
      if (!p.plan) return stat(p.name, "—", esc(p.note || "No salary yet"));
      const pl = p.plan, bal = pl.balance;
      return stat(`${p.name} · ${m.fy}`, `${inr(pl.regimes[pl.better].tax)} <button type="button" class="explain-btn" data-explain="tax:${esc(p.who)}" aria-label="How ${esc(p.name)}'s tax is calculated">How?</button>`, `${esc(pl.better)} regime · ${bal === 0 && !(pl.regimes[pl.better].tax > 0) ? "no tax due, no TDS needed" : bal === 0 ? "TDS covers the tax exactly" : bal > 0 ? `TDS is ${inr(bal)} more than the tax` : `${inr(-bal)} more than TDS`}`);
    }).join("");
    const top = m.actions.slice(0, 7);
    const act = top.length ? top.map((a) => {
      const isTodo = a.id.startsWith("todo-");
      return `<div class="tax-action"><div class="tax-action-main"><div>${sevChip(a.severity)} <b>${esc(a.title)}</b>${a.who ? ` <span class="prot-sub">· ${esc(a.who)}</span>` : ""}</div>
        <div class="prot-sub">${esc(a.why)}${a.due ? ` Due ${esc(prettyDate(a.due))}.` : ""}</div></div>
        ${isTodo ? `<button type="button" class="secondary-button" data-tax-done="${esc(a.id.slice(5))}">Done</button>` : ""}</div>`;
    }).join("") : `<div class="prot-empty">Nothing urgent. Import your tax data on the Data tab to see returns and deadlines.</div>`;
    const soon = m.deadlines.filter((d) => d.inDays >= 0).slice(0, 8).map((d) => `<div class="tax-deadline"><div class="tax-date">${esc(prettyDate(d.date))}<small>${d.inDays === 0 ? "today" : `in ${d.inDays} day${d.inDays === 1 ? "" : "s"}`}</small></div>
        <div><b>${esc(d.title)}</b>${d.who ? ` <span class="prot-sub">· ${esc(d.who)}</span>` : ""}<div class="prot-sub">${esc(d.why)}</div></div></div>`).join("");
    const left = m.people.filter((p) => p.plan).map((p) => `${esc(p.name)}: ${inr(p.exemptionLeft)} of the ₹1.25L long-term-gain exemption left (booked ${inr(Math.max(0, p.realised.ltcg))})`).join(" · ");
    return `<div class="prot-summary tax-people">${cards}</div>
      <section class="panel tax-panel"><div class="panel-header"><div><h3>What to do next</h3><p>Ranked by how much it matters.</p></div></div>${act}</section>
      <section class="panel tax-panel"><div class="panel-header"><div><h3>Dates that matter</h3><p>${left || "&nbsp;"}</p></div></div>${soon || `<div class="prot-empty">No dates in the next year.</div>`}</section>`;
  }

  function harvestHtml(pp) {
    const h = pp.harvest;
    if (!h || !h.picks.length) return "";
    const rows = h.picks.map((x) => `<div class="prot-check"><div><b>${esc(x.name)}</b><div class="prot-sub">Redeem about ${x.units.toLocaleString("en-IN")} ${x.kind === "mf" ? "units" : "shares"} (${inr(x.value)}), oldest first</div></div><div class="prot-check-right"><b>${inr(x.gain)}</b><span class="prot-sub">gain, tax-free</span></div></div>`).join("");
    return `<h4 class="tax-h">Which units to sell and buy back</h4>${rows}<p class="prot-sub">Books ${inr(h.planned)} of the ${inr(h.target)} still free${h.shortfall ? `; ${inr(h.shortfall)} could not be covered by holdings older than 12 months with a known buy date` : ""}. Sell, then buy back the same day, before 31 March. Check exit loads first. Funds sell oldest units first.</p>`;
  }

  // ── Plan ─────────────────────────────────────────────────────────────────────────────────
  function viewPlan(m) {
    const p = profile(), per = (k, who) => ((p[k] || {})[who]) ;
    const field = (label, key, who, step = 1000, hint = "") => `<label class="tax-field"><span>${esc(label)}</span><input type="number" inputmode="numeric" min="0" step="${step}" data-tax-field="${key}" data-who="${who}" value="${esc(num(per(key, who)) || "")}" placeholder="0" />${hint ? `<small>${esc(hint)}</small>` : ""}</label>`;
    const dedField = (label, k, who) => `<label class="tax-field"><span>${esc(label)}</span><input type="number" inputmode="numeric" min="0" step="1000" data-tax-ded="${k}" data-who="${who}" value="${esc(num(((p.deductionsPaid || {})[who] || {})[k]) || "")}" placeholder="0" /></label>`;
    const cols = m.people.map((pp) => {
      if (!pp.plan) return `<section class="panel tax-panel"><div class="panel-header"><div><h3>${esc(pp.name)}</h3><p>${esc(pp.note || "")}</p></div></div></section>`;
      const pl = pp.plan, o = pl.regimes.old, n = pl.regimes.new;
      const lev = pl.levers.length ? pl.levers.map((l) => `<div class="prot-check"><div><b>${esc(l.title)}</b><div class="prot-sub">${esc(l.detail)}</div></div><div class="prot-check-right"><b>${inr(l.yearlySaving)}</b><span class="prot-sub">a year</span></div></div>`).join("") : `<div class="prot-empty">No further levers worth acting on.</div>`;
      const adv = pl.advanceTax.length ? pl.advanceTax.map((a) => `<div class="prot-check"><div>${esc(prettyDate(a.date))} ${a.date < m.asOf ? chip("muted", "past") : ""}</div><div class="prot-check-right"><b>${inr(a.cumulativeAmount)}</b><span class="prot-sub">cumulative (${a.cumulativePct}%)</span></div></div>`).join("") : `<div class="prot-empty">Tax after TDS is under ₹10,000: no advance tax needed.</div>`;
      const sv = pp.salary;
      const salaryLine = `${esc(sv.basedOn)}${sv.variableMonths && sv.variableMonths.length ? ` · variable pay expected in ${esc(sv.variableMonths.join(", "))}` : ""} · gross about ${inr(sv.gross)}`;
      const tdsLine = `TDS so far ${inr(sv.tdsSoFar)}; at this month's rate ${inr(sv.tdsPace)} for the year; expected ${inr(pl.tdsProjected)} by March. ${esc(sv.tdsAssumption || "")}`;
      return `<section class="panel tax-panel"><div class="panel-header"><div><h3>${esc(pp.name)} · FY ${esc(m.fy)}</h3><p>${salaryLine}</p><p class="prot-sub">${tdsLine}</p></div>${chip(pl.better === "new" ? "good" : "warn", `${pl.better} regime is cheaper by ${inr(pl.saving)}`)}</div>
        <div class="tax-compare"><div><span>New regime</span><b>${inr(n && n.tax)}</b><small>taxable ${inr(n && n.taxable)}</small></div>
          <div><span>Old regime</span><b>${inr(o.tax)}</b><small>taxable ${inr(o.taxable)} · HRA ${inr(o.hraExempt)} · deductions ${inr(o.deductions)}</small></div>
          <div><span>Marginal rate</span><b>${pl.marginalRatePct}%</b><small>+ 4% cess · file ${esc(pl.form)}</small></div></div>
        <h4 class="tax-h">Ways to pay less</h4>${lev}${harvestHtml(pp)}<h4 class="tax-h">Advance tax</h4>${adv}</section>`;
    }).join("");
    const dep = p.departure || {};
    const dv = m.departure;
    const depHtml = dv ? `<div class="tax-dep">${dv.years.map((y) => `<div><span>FY ${esc(y.fy)}</span><b>${esc(y.status === "NR" ? "Non-resident" : y.status === "RNOR" ? "Resident, not ordinarily" : "Resident")}</b><small>${y.daysInIndia} days in India · ${y.globalIncomeTaxed ? "world income taxed in India (credit for foreign tax)" : "only Indian income taxed in India"}</small></div>`).join("")}</div>
      <p class="prot-sub">Leaving after ${esc(prettyDate(dv.latestForNonResidentThisYear))} makes this year a resident year even if you work abroad. Confirm with your employer's tax team and a cross-border adviser.</p>` : `<p class="prot-sub">Enter a planned departure date to see your Indian tax status year by year.</p>`;
    return `<div class="tax-grid2">${cols}</div>
      <section class="panel tax-panel"><div class="panel-header"><div><h3>Your inputs</h3><p>Change them and the plan above updates. Salary comes from your income records.</p></div></div>
        <div class="tax-fields">${["Me", "Wife"].map((w) => `<fieldset class="tax-fs"><legend>${esc(NAMES[w])}</legend>
          ${field("Rent paid per month (₹)", "rentMonthly", w, 500, "Old regime only (HRA)")}${field("Employer NPS per year (₹)", "employerNps", w, 1000, "Both regimes")}${field("Other income per year (₹)", "otherIncome", w, 1000, "Interest, dividends")}
          ${dedField("80C paid (₹)", "80C", w)}${dedField("Health premium for family (₹)", "80D_self", w)}${dedField("Health premium for parents (₹)", "80D_parents", w)}${dedField("NPS own contribution (₹)", "80CCD1B", w)}${dedField("Home-loan interest (₹)", "homeLoanInterest", w)}
        </fieldset>`).join("")}</div>
        <div class="tax-fields"><label class="tax-field"><span>Parents 60 or older</span><select data-tax-flag="parentsSenior"><option value="">No</option><option value="1" ${p.parentsSenior ? "selected" : ""}>Yes (₹50,000 limit)</option></select></label>
          <label class="tax-field"><span>Marriage date</span><input type="date" data-tax-flag="marriageDate" value="${esc(p.marriageDate || "")}" /></label></div></section>
      <section class="panel tax-panel"><div class="panel-header"><div><h3>If you move abroad</h3><p>Residential status for tax in India.</p></div></div>
        <div class="tax-fields"><label class="tax-field"><span>Planned departure</span><input type="date" data-tax-dep="date" value="${esc(dep.date || "")}" /></label>
        <label class="tax-field"><span>Days you would be in India the year after</span><input type="number" min="0" max="365" data-tax-dep="visitDays" value="${esc(dep.visitDays != null ? dep.visitDays : "")}" placeholder="30" /></label></div>${depHtml}</section>`;
  }

  // ── Savings ─────────────────────────────────────────────────────────────────────────────
  const monthLabel = (ym) => { if (!/^\d{4}-\d{2}$/.test(ym || "")) return "—"; return new Date(ym + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }); };
  const KIND = { structure: "Salary", timing: "Timing", regime: "Regime", family: "Family", business: "Business" };
  function viewSavings(m) {
    const S = m.savings;
    if (!S) return `<section class="panel tax-panel"><div class="prot-empty">The savings plan needs a salary record for this year.</div></section>`;
    const p = profile();
    const lev = S.levers.length ? S.levers.map((l) => `<div class="tax-finding"><div class="tax-ftitle">${chip("good", KIND[l.kind] || l.kind)} <b>${esc(l.title)}</b></div>
        <div class="tax-money"><div><span>This year</span><b>${inr(l.thisYear)}</b></div><div><span>Every year</span><b>${inr(l.runRate)}</b></div></div>
        <div class="prot-sub">${esc(l.what)}</div>
        ${l.needs.length ? `<div class="prot-sub"><b>You need:</b> ${esc(l.needs.join("; "))}</div>` : ""}${l.risks.length ? `<div class="prot-sub"><b>Watch for:</b> ${esc(l.risks.join("; "))}</div>` : ""}${l.deadline ? `<div class="prot-sub"><b>By:</b> ${esc(prettyDate(l.deadline))}</div>` : ""}</div>`).join("") : `<div class="prot-empty">No lever is worth acting on right now.</div>`;
    const nps = S.perPerson.filter((x) => x.nps.rows.length && x.nps.runRate.saving > 0).map((x) => `<div class="tax-sub"><h4 class="tax-h">${esc(x.name)}: employer NPS by start month</h4>
        <div class="tax-table"><div class="tax-tr tax-th"><span>Starts</span><span>Months</span><span>Put in</span><span>Tax saved</span><span>Out of pocket</span></div>
        ${x.nps.rows.map((r) => `<div class="tax-tr${r.planned ? " tax-planned" : ""}"><span>${esc(monthLabel(r.from))}${r.planned ? " · your plan" : ""}</span><span>${r.months}</span><span>${inr(r.amount)}</span><span><b>${inr(r.saving)}</b></span><span>${inr(r.netCost)}</span></div>`).join("")}
        <div class="tax-tr"><span><b>Full year</b></span><span>12</span><span>${inr(x.nps.runRate.amount)}</span><span><b>${inr(x.nps.runRate.saving)}</b></span><span>${inr(x.nps.runRate.netCost)}</span></div></div></div>`).join("");
    const npsInput = `<div class="tax-fields"><label class="tax-field"><span>Employer NPS planned to start from</span><input type="month" data-tax-flag="npsStart" value="${esc(p.npsStart || "")}" /></label></div>`;
    const reg = S.perPerson.map((x) => { const r = x.regime; if (!r) return ""; return `<div class="tax-sub"><h4 class="tax-h">${esc(x.name)}: old or new regime</h4>
        <div class="tax-compare"><div><span>New regime</span><b>${inr(r.newTax)}</b><small>nothing to claim</small></div><div><span>Old, as entered</span><b>${inr(r.oldNow)}</b><small>deductions ${inr(r.counted)}</small></div><div><span>Old, everything claimed</span><b>${inr(r.oldMax)}</b><small>deductions ${inr(r.maxDeductions)} + HRA ${inr(r.hra)}</small></div></div>
        <p class="prot-sub">${r.margin < 500 ? "Both regimes cost about the same, so the simpler new regime is the one to keep." : r.verdict === "new" ? `The new regime wins by ${inr(r.margin)} even if every old-regime deduction were claimed. The old regime would need about ${inr(r.breakevenExtra)} more deductions than you have entered to match it.` : `With every deduction claimed the old regime wins by ${inr(r.margin)}. Tell your employer in April.`}</p></div>`; }).join("");
    const loc = S.location;
    const locHtml = `<div class="tax-table"><div class="tax-tr tax-th tax-3"><span>Whose name</span><span>Tax on extra income</span><span>Tax-free room left</span></div>${loc.members.map((x) => `<div class="tax-tr tax-3"><span>${esc(x.name)}</span><span>${x.marginalRate}%</span><span>${inr(x.taxFreeHeadroom)}</span></div>`).join("")}</div>
      <p class="prot-sub">Each ₹1 lakh of interest or dividends earned in the lowest-taxed name saves up to ${inr(loc.savingPerLakh)} a year. ${esc(loc.note)}</p>`;
    const bizRows = (rows, key) => rows.map((b) => { const r = key ? b[key] : b; return `<div class="tax-tr tax-4"><span>${inr(r.profit)}</span>${r.owners.map((o) => `<span>${inr(o.extraTax)}</span>`).join("")}<span><b>${inr(r.saving)}</b></span></div>`; }).join("");
    const bizHead = S.business[0] ? `<div class="tax-tr tax-th tax-4"><span>Profit</span>${S.business[0].owners.map((o) => `<span>Tax if ${esc(o.name)} earns it</span>`).join("")}<span>Saved</span></div>` : "";
    const part = S.businessMonthsThisYear < 12 && S.businessMonthsThisYear > 0;
    const biz = `<div class="tax-fields"><label class="tax-field"><span>Business starts on</span><input type="date" data-tax-flag="sideBusinessStart" value="${esc(p.sideBusinessStart || "")}" /></label>
      <label class="tax-field"><span>Expected profit per year (₹)</span><input type="number" min="0" step="10000" data-tax-num="sideBusinessProfit" value="${esc(num(p.sideBusinessProfit) || "")}" placeholder="500000" /></label></div>
      ${part ? `<h4 class="tax-h">This tax year (${S.businessMonthsThisYear} months, return due 31 Aug ${+m.fy.slice(0, 4) + 1})</h4><div class="tax-table">${bizHead}${bizRows(S.business.filter((b) => b.thisYear), "thisYear")}</div><h4 class="tax-h">A full year after that</h4>` : ""}
      <div class="tax-table">${bizHead}${bizRows(S.business)}</div>
      <p class="prot-sub">Run it in the lower-taxed spouse's name only if she really does the work and the capital is hers: income from money you gave her, or from a business where you are employed, is added back to you (sec 64). Business income needs ITR-3 or ITR-4 (due 31 August). Check the GST threshold (₹20L for services), and ask a CA about the presumptive scheme (44ADA for professionals, 44AD for trading), where advance tax is one payment by 15 March.</p>`;
    const timing = S.perPerson.map((x) => `${x.wait.length ? `<div class="tax-sub"><h4 class="tax-h">${esc(x.name)}: wait for long-term</h4>${x.wait.map((w) => `<div class="prot-check"><div><b>${esc(w.name)}</b><div class="prot-sub">Turns long-term on ${esc(prettyDate(w.longTermOn))} (${w.inDays} days)</div></div><div class="prot-check-right"><b>${inr(w.saving)}</b><span class="prot-sub">saved by waiting</span></div></div>`).join("")}</div>` : ""}${x.losses.length ? `<div class="tax-sub"><h4 class="tax-h">${esc(x.name)}: holdings below cost</h4>${x.losses.slice(0, 5).map((w) => `<div class="prot-check"><div><b>${esc(w.name)}</b><div class="prot-sub">${w.term}-term loss of ${inr(w.loss)} (worth ${inr(w.valueNow)} now)</div></div><div class="prot-check-right"><b>${inr(w.futureSaving)}</b><span class="prot-sub">off future gains</span></div></div>`).join("")}<p class="prot-sub">Booking a loss carries it forward 8 years against future gains, only if each return is filed on time. Sell only if you would sell anyway.</p></div>` : ""}`).join("");
    const abroad = S.nonResident.filter((x) => x.extraTax > 0).map((x) => `${esc(x.name)}: about ${inr(x.extraTax)} more tax a year, because the ₹12 lakh rebate is for residents only`).join("; ");
    const next = m.nextYear ? `<div class="tax-compare">${m.nextYear.people.filter((x) => x.tax != null).map((x) => `<div><span>${esc(x.name)} · FY ${esc(x.fy)}</span><b>${inr(x.tax)}</b><small>${esc(x.regime)} regime, salary up ${m.nextYear.growthPct}%</small></div>`).join("")}</div>
      <div class="tax-fields"><label class="tax-field"><span>Expected yearly salary rise (%)</span><input type="number" min="0" max="60" step="1" data-tax-num="salaryGrowthPct" value="${esc(m.nextYear.growthPct)}" /></label></div>` : "";
    return `<div class="prot-summary"><div class="prot-stat"><span>Could save this year</span><b>${inr(S.totals.thisYear)}</b><small>${S.levers.length} move${S.levers.length === 1 ? "" : "s"}, ranked below</small></div><div class="prot-stat"><span>Every year after</span><b>${inr(S.totals.runRate)}</b><small>once set up</small></div><div class="prot-stat"><span>Tax year</span><b>${esc(m.fy)}</b><small>return due 31 Jul ${+m.fy.slice(0, 4) + 1}</small></div></div>
      <section class="panel tax-panel"><div class="panel-header"><div><h3>The moves, biggest first</h3><p>Each figure is the tax engine's own tax with and without the move.</p></div></div>${lev}</section>
      ${nps ? `<section class="panel tax-panel"><div class="panel-header"><div><h3>Employer NPS</h3><p>The one large deduction that works in the new regime. Starting later saves less this year.</p></div></div>${npsInput}${nps}</section>` : ""}
      <section class="panel tax-panel"><div class="panel-header"><div><h3>Old or new regime</h3><p>With everything you could claim.</p></div></div>${reg}</section>
      <section class="panel tax-panel"><div class="panel-header"><div><h3>Who should earn the interest and dividends</h3></div></div>${locHtml}</section>
      <section class="panel tax-panel"><div class="panel-header"><div><h3>If you start a side business</h3><p>The same profit taxed in each name.</p></div></div>${biz}</section>
      ${timing ? `<section class="panel tax-panel"><div class="panel-header"><div><h3>Timing your sales</h3></div></div>${timing}</section>` : ""}
      <section class="panel tax-panel"><div class="panel-header"><div><h3>Next year</h3><p>Planning for FY ${esc(m.nextYear ? m.nextYear.people[0].fy : "")}, on the assumption that the rules stay the same.</p></div></div>${next}${abroad ? `<p class="prot-sub"><b>If a move abroad makes someone a non-resident:</b> ${abroad}.</p>` : ""}</section>`;
  }

  // ── Returns ──────────────────────────────────────────────────────────────────────────────
  function remedyHtml(r) {
    if (!r.remedy) return `<div class="prot-sub">Nothing to correct.</div>`;
    const x = r.remedy;
    if (x.fee !== undefined && x.lastDate && !x.pctExtra) return `<div class="tax-remedy"><b>Revised return</b> is open: ${x.fee === 0 ? `free until ${esc(prettyDate(x.freeUntil || x.lastDate))}` : `fee ${inr(x.fee)}`}, last date ${esc(prettyDate(x.lastDate))}. Net payable on the documents is about ${inr(Math.max(0, -r.refundOnDocuments))} plus small interest.</div>`;
    if (!x.open) return `<div class="tax-remedy">${esc(x.reason || "Closed.")}</div>`;
    return `<div class="tax-remedy"><b>Updated return (ITR-U):</b> ${inr(x.additionalTax)} tax + about ${inr(x.interest)} interest + ${x.pctExtra}% extra (${inr(x.extraTax)}) = about <b>${inr(x.totalToPay)}</b>. Last date ${esc(prettyDate(x.lastDate))}${x.rateRisesTo ? `; the extra rises to ${x.rateRisesTo.pct}% after ${esc(prettyDate(x.rateRisesTo.after))}` : ""}. Estimate: the portal shows the real figure.</div>`;
  }
  function filingHtml(m) {
    const items = m.filing.map((f) => `<label class="tax-check"><input type="checkbox" data-tax-file="${esc(f.id)}" ${f.done ? "checked" : ""} /><span>${esc(f.title)}${f.done ? ` <small class="prot-sub">· done ${esc(prettyDate(f.done))}</small>` : ""}</span></label>`).join("");
    return `<section class="panel tax-panel"><div class="panel-header"><div><h3>Filing checklist for FY ${esc(m.fy)}</h3><p>Return due 31 July ${+m.fy.slice(0, 4) + 1}. Tick items as you collect them.</p></div></div>${items}</section>`;
  }
  const returnsBar = `<section class="panel tax-panel"><div class="panel-header"><div><h3>Your returns</h3><p>Add each year once it is filed (or note a year that was not). The check below compares it with the documents.</p></div><button type="button" class="primary-button" data-tax-ret="add">Add a year</button></div></section>`;
  const editBtns = (r) => `<div class="prot-actions"><button type="button" class="secondary-button" data-tax-ret="edit" data-id="${esc(r.id)}">Edit</button><button type="button" class="secondary-button" data-tax-ret="del" data-id="${esc(r.id)}">Delete</button></div>`;
  function viewReturns(m) {
    if (!m.returnsAudit.length) return filingHtml(m) + returnsBar + `<section class="panel tax-panel"><div class="prot-empty">No returns yet. Import your tax data on the Data tab.</div></section>`;
    return filingHtml(m) + returnsBar + m.returnsAudit.map((r) => {
      const who = NAMES[r.person] || r.person;
      if (r.error) return `<section class="panel tax-panel"><div class="panel-header"><div><h3>${esc(who)} · FY ${esc(r.fy)}</h3><p>Could not check: ${esc(r.error)}</p></div></div>${editBtns(r)}</section>`;
      if (r.unfiled) return `<section class="panel tax-panel"><div class="panel-header"><div><h3>${esc(who)} · FY ${esc(r.fy)}</h3><p>No return filed${r.note ? ` · ${esc(r.note)}` : ""}</p></div>${chip(r.extraTax > 0 ? "bad" : "good", r.extraTax > 0 ? `${inr(r.extraTax)} unpaid` : "nothing due")}</div>${remedyHtml(r)}${editBtns(r)}</section>`;
      const high = r.findings.filter((f) => f.severity === "high").length;
      const list = r.findings.length ? r.findings.map((f) => `<div class="tax-finding"><div class="tax-ftitle">${sevChip(f.severity)}${f.proofNeeded ? " " + chip("muted", "proof needed") : ""} <b>${esc(f.title)}</b>${f.taxImpact ? ` <span class="prot-sub">· tax effect ${inr(f.taxImpact)}</span>` : ""}</div><div class="prot-sub">${esc(f.detail)}${f.fix ? ` <i>${esc(f.fix)}</i>` : ""}</div></div>`).join("") : `<div class="prot-empty">No issues found against the documents.</div>`;
      return `<section class="panel tax-panel"><div class="panel-header"><div><h3>${esc(who)} · FY ${esc(r.fy)} <span class="prot-sub">(AY ${esc(r.ay)})</span></h3><p>${esc(r.form)} · ${esc(r.regime)} regime · tax filed ${inr(r.filedTax)} · on the documents ${inr(r.correctedTax)}${r.note ? ` · ${esc(r.note)}` : ""}</p></div>
        ${chip(high ? "bad" : r.findings.length ? "warn" : "good", high ? `${high} serious` : r.findings.length ? `${r.findings.length} to check` : "clean")}</div>${r.findings.some((f) => f.proofNeeded) ? `<p class="prot-sub">"On the documents" counts only what the documents contradict. Items marked <b>proof needed</b> are not in that figure: they stand if you can show the proof (bank transfers, agreement, receipts).</p>` : ""}${list}${remedyHtml(r)}${editBtns(r)}</section>`;
    }).join("");
  }

  // ── Add / edit a year's return (same dialog pattern as the Protection page) ───────────────────
  const FY_LIST = (() => { const out = []; for (let y = 2026; y >= 2018; y--) out.push(`${y}-${String(y + 1).slice(2)}`); return out; })();
  const N = "number", B = "bool";
  const RETURN_FORM = [
    ["About the return", [
      ["person", "Whose return", "select", [["Me", "Prafful"], ["Wife", "Archana"]]], ["fy", "Financial year", "select", FY_LIST.map((f) => [f, `FY ${f}`])],
      ["status", "Status", "select", [["filed", "Filed"], ["unfiled", "Not filed"]]], ["filed.form", "Form", "select", [["ITR-1", "ITR-1"], ["ITR-2", "ITR-2"], ["ITR-3", "ITR-3"], ["ITR-4", "ITR-4"]]],
      ["filed.regime", "Regime", "select", [["new", "New"], ["old", "Old"]]], ["filed.filedOn", "Filed on", "date"], ["note", "Note", "text"],
    ]],
    ["As filed in the return", [
      ["filed.grossSalary", "Gross salary", N], ["filed.exemptAllowances", "Exempt allowances (total)", N], ["filed.exemptBreakup.hra", "of which HRA", N],
      ["filed.otherIncome", "Interest and dividends", N], ["filed.speculativeIncome", "Intraday profit", N],
      ["filed.gains.stcgBefore", "Short-term gains, before 23 Jul 2024", N], ["filed.gains.stcgAfter", "Short-term gains, from 23 Jul 2024", N],
      ["filed.gains.ltcgBefore", "Long-term gains, before 23 Jul 2024", N], ["filed.gains.ltcgAfter", "Long-term gains, from 23 Jul 2024", N],
      ["filed.deductions.80C", "80C", N], ["filed.deductions.80D", "80D", N], ["filed.deductions.80DDB", "80DDB", N], ["filed.deductions.80GGC", "80GGC", N], ["filed.deductions.80TTA", "80TTA", N],
      ["filed.employerNps", "Employer NPS, 80CCD(2)", N], ["filed.totalTax", "Tax with cess, before interest", N], ["filed.interestAndFee", "Interest and late fee", N],
      ["filed.taxesPaid", "Taxes paid (TDS, TCS, self-assessment)", N], ["filed.foreignAssetsDeclared", "Foreign assets declared (Schedule FA)", B],
    ]],
    ["From the documents (Form 16, AIS, 26AS, broker reports)", [
      ["evidence.form16.exemptions", "Form 16: exemptions", N], ["evidence.form16.employerNps", "Form 16: employer NPS", N],
      ["evidence.ais.salary", "AIS: salary", N], ["evidence.ais.interest", "AIS: interest", N], ["evidence.ais.dividend", "AIS: dividends", N], ["evidence.ais.saleOfSecurities", "AIS: sale of securities", N],
      ["evidence.tds", "26AS: TDS", N],
      ["evidence.brokers.stcgBefore", "Brokers: short-term, before 23 Jul 2024", N], ["evidence.brokers.stcgAfter", "Brokers: short-term, from 23 Jul 2024", N],
      ["evidence.brokers.ltcgBefore", "Brokers: long-term, before 23 Jul 2024", N], ["evidence.brokers.ltcgAfter", "Brokers: long-term, from 23 Jul 2024", N], ["evidence.brokers.intraday", "Brokers: intraday", N],
      ["evidence.foreign.accountOpened", "Foreign account opened on", "date"], ["evidence.foreign.peakValueInr", "Foreign assets, peak value", N], ["evidence.foreign.dividendsInr", "Foreign dividends", N],
      ["evidence.npsAccount", "Has an NPS account", B], ["evidence.healthPremiums.total", "Health premiums actually paid", N], ["evidence.parentsSenior", "A parent was 60 or older", B],
      ["evidence.illness80DDB", "80DDB illness, as certified", "text"], ["evidence.rent.paid", "Rent actually paid", N], ["evidence.rent.landlordPan", "Landlord PAN available", B],
    ]],
  ];
  const getPath = (o, path) => path.split(".").reduce((a, k) => (a == null ? undefined : a[k]), o);
  function setPath(o, path, v) { const ks = path.split("."); let a = o; ks.slice(0, -1).forEach((k) => { a[k] = a[k] && typeof a[k] === "object" ? a[k] : {}; a = a[k]; }); a[ks[ks.length - 1]] = v; }
  let editingReturn = null;

  /** A stored record in the form's shape (an unfiled year keeps its figures at the top level). */
  function toFormShape(r) {
    if (!r) return { person: "Me", fy: FY_LIST[1], status: "filed", filed: { regime: "new", form: "ITR-2" }, evidence: {} };
    if (r.kind !== "unfiled") return { ...r, status: "filed" };
    return { id: r.id, person: r.person, fy: r.fy, note: r.note, status: "unfiled", filed: { regime: r.regime, grossSalary: r.grossSalary, exemptAllowances: r.exemptAllowances, otherIncome: r.otherIncome, gains: r.gains || {}, deductions: { "80C": r.deductions } }, evidence: { tds: r.tds } };
  }
  function fieldHtml([path, label, type, options], rec) {
    const v = getPath(rec, path);
    const name = `f:${path}`;
    if (type === "select") return `<label class="tax-field"><span>${esc(label)}</span><select name="${name}">${options.map(([val, l]) => `<option value="${esc(val)}" ${String(v ?? "") === val ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
    if (type === B) return `<label class="tax-field"><span>${esc(label)}</span><select name="${name}"><option value="">Not known</option><option value="yes" ${v === true ? "selected" : ""}>Yes</option><option value="no" ${v === false ? "selected" : ""}>No</option></select></label>`;
    return `<label class="tax-field"><span>${esc(label)}</span><input name="${name}" type="${type === N ? "number" : type}" ${type === N ? 'step="any" inputmode="decimal"' : ""} value="${esc(v ?? "")}" /></label>`;
  }
  function openReturnForm(id) {
    const s = state(), rec = id ? (s.taxReturns || []).find((r) => r.id === id) : null;
    editingReturn = { id: rec ? rec.id : null };
    $("taxReturnEyebrow").textContent = rec ? "Edit" : "Add";
    $("taxReturnTitle").textContent = rec ? `FY ${rec.fy} · ${NAMES[rec.person] || rec.person}` : "A year's return";
    const shape = toFormShape(rec);
    $("taxReturnForm").innerHTML = RETURN_FORM.map(([title, fields], i) => `<details class="tax-form-section" ${i === 0 || rec ? "open" : ""}><summary>${esc(title)}</summary><div class="tax-fields">${fields.map((f) => fieldHtml(f, shape)).join("")}</div></details>`).join("")
      + `<div class="tax-form-actions"><button type="button" class="secondary-button" id="taxPrefill">Fill documents from my records</button><span class="prot-sub" id="taxPrefillNote">Salary and TDS from your income records; mutual-fund gains from your holdings. Leave anything you do not know empty.</span></div>`
      + `<button type="submit" class="primary-button full-span">Save</button>`;
    $("taxReturnModal").hidden = false;
  }
  function closeReturnForm() { $("taxReturnModal").hidden = true; editingReturn = null; }
  function readForm() {
    const rec = {}, fd = new FormData($("taxReturnForm"));
    const types = new Map(RETURN_FORM.flatMap(([, f]) => f.map(([p, , t]) => [p, t])));
    fd.forEach((raw, key) => {
      const path = key.slice(2), t = types.get(path), v = String(raw).trim();
      if (v === "") return;   // empty = not known; never stored as 0
      setPath(rec, path, t === N ? Number(v) : t === B ? v === "yes" : v);
    });
    return rec;
  }
  async function submitReturnForm(e) {
    e.preventDefault();
    if (!editingReturn) return;
    const f = readForm(), s = state();
    s.taxReturns = s.taxReturns || [];
    if (!f.fy || !f.person) { await ask("Choose whose return and the financial year.", "OK", ""); return; }
    let record;
    if (f.status === "unfiled") {
      const fl = f.filed || {};
      record = { kind: "unfiled", fy: f.fy, person: f.person, regime: fl.regime || "old", grossSalary: fl.grossSalary || 0, exemptAllowances: fl.exemptAllowances || 0,
        deductions: Object.values(fl.deductions || {}).reduce((a, b) => a + (Number(b) || 0), 0), otherIncome: fl.otherIncome || 0, gains: fl.gains || {}, tds: (f.evidence || {}).tds || 0, note: f.note || "" };
    } else {
      if (!f.filed || !(f.filed.grossSalary > 0)) { await ask("Enter at least the gross salary from the return.", "OK", ""); return; }
      record = { fy: f.fy, person: f.person, filed: f.filed, evidence: f.evidence || {}, note: f.note || "" };
    }
    const clash = s.taxReturns.find((r) => r.fy === record.fy && r.person === record.person && r.id !== editingReturn.id);
    if (clash && !(await ask(`There is already a return for FY ${record.fy} (${NAMES[record.person]}). Replace it?`, "Replace"))) return;
    if (clash) s.taxReturns = s.taxReturns.filter((r) => r !== clash);
    if (editingReturn.id) { const i = s.taxReturns.findIndex((r) => r.id === editingReturn.id); if (i >= 0) s.taxReturns[i] = { id: editingReturn.id, ...record }; }
    else s.taxReturns.push({ id: uid("taxr"), ...record });
    closeReturnForm(); tab = "returns"; await save(); render();
  }
  function prefillFromRecords() {
    const fd = new FormData($("taxReturnForm")), who = fd.get("f:person"), fy = fd.get("f:fy");
    const { evidence, months } = T().household.evidenceFromRecords(state(), who, fy);
    const put = (path, v) => { const el = $("taxReturnForm").querySelector(`[name="f:${path}"]`); if (el && v != null && el.value === "") el.value = v; };
    if (evidence.ais) put("evidence.ais.salary", evidence.ais.salary);
    put("evidence.tds", evidence.tds);
    Object.entries(evidence.brokers || {}).forEach(([k, v]) => put(`evidence.brokers.${k}`, v));
    $("taxPrefillNote").textContent = months || evidence.brokers ? `Filled from ${months} salary month${months === 1 ? "" : "s"}${evidence.brokers ? " and your mutual-fund redemptions" : ""}. ${evidence.brokersNote || ""} Empty fields were left alone.` : "No salary or redemptions on record for that year.";
  }

  // ── Family money ─────────────────────────────────────────────────────────────────────────
  const REL = [["spouse", "Spouse"], ["parent", "Parent"], ["child", "Child"], ["sibling", "Brother or sister"], ["spouse-sibling", "Spouse's brother or sister"], ["spouse-parent", "Spouse's parent"], ["other", "Someone else"]];
  function viewFamily(m) {
    const list = m.family.length ? m.family.map((t) => `<div class="tax-finding"><div class="prot-card-top"><div><b>${inr(t.amount)}</b> · ${esc(NAMES[t.from] || t.from || "?")} → ${esc(NAMES[t.to] || (REL.find((r) => r[0] === t.relation) || [])[1] || "?")} <span class="prot-sub">· ${esc(prettyDate(t.date))}${t.viaOther ? " · paid into a third party's account" : ""}${t.repaymentExpected ? " · to be repaid" : ""}</span></div>
        <button type="button" class="secondary-button" data-tax-del-family="${esc(t.id)}">Remove</button></div>
        <div>${esc(t.result.summary)}</div>${t.result.flags.map((f) => `<div class="prot-sub">• ${esc(f)}</div>`).join("")}${t.result.keep.length ? `<div class="prot-sub">Keep: ${esc(t.result.keep.join("; "))}</div>` : ""}
        ${t.note ? `<div class="prot-sub">${esc(t.note)}</div>` : ""}</div>`).join("") : `<div class="prot-empty">No transfers recorded.</div>`;
    return `<section class="panel tax-panel"><div class="panel-header"><div><h3>Money between family members</h3><p>Gifts, loans and deposits: whether they are taxable, whether income on them is added to the giver, and what to keep. Uses the marriage date.</p></div></div>${list}</section>
      <section class="panel tax-panel"><div class="panel-header"><div><h3>Add a transfer</h3></div></div>
        <form id="taxFamilyForm" class="tax-fields">
          <label class="tax-field"><span>Date</span><input type="date" name="date" required /></label><label class="tax-field"><span>Amount (₹)</span><input type="number" name="amount" min="1" step="1" required /></label>
          <label class="tax-field"><span>From</span><select name="from"><option value="Me">Prafful</option><option value="Wife">Archana</option><option value="Other">Someone else</option></select></label>
          <label class="tax-field"><span>To / relation to the giver</span><select name="relation">${REL.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select></label>
          <label class="tax-field"><span>Paid into a third party's account?</span><select name="viaOther"><option value="">No</option><option value="1">Yes</option></select></label>
          <label class="tax-field"><span>Will it be repaid?</span><select name="repaymentExpected"><option value="">No (a gift)</option><option value="1">Yes (a loan)</option></select></label>
          <label class="tax-field tax-wide"><span>Note</span><input type="text" name="note" maxlength="200" /></label>
          <button type="submit" class="primary-button">Add</button></form></section>`;
  }

  // ── Rules ────────────────────────────────────────────────────────────────────────────────
  function viewRules(m) {
    const L = T().law, st = m.law;
    const label = { statute: "Statute", secondary: "Commentary: confirm", author: "Author's view: confirm" };
    const cls = { statute: "good", secondary: "warn", author: "bad" };
    return `<section class="panel tax-panel"><div class="panel-header"><div><h3>Rules this page relies on</h3><p>${L.LAW.length} rules, last checked ${esc(prettyDate(L.VERIFIED))}. ${st.weak.length} rest on professional commentary rather than the official text. A monthly check looks for changes.</p></div></div>
      ${L.LAW.map((r) => `<div class="tax-finding"><div class="tax-ftitle">${chip(cls[r.confidence], label[r.confidence])} <b>${esc(r.topic)}</b> <span class="prot-sub">${esc([r.act1961, r.act2025].filter(Boolean).join(" → "))}</span></div>
        <div class="prot-sub">${esc(r.rule)}</div><div class="prot-sub">${(r.sources || []).filter((s) => /^https?:/.test(s)).map((s) => `<a href="${esc(s)}" target="_blank" rel="noopener noreferrer">${esc(s.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60))}</a>`).join(" · ")}</div></div>`).join("")}</section>`;
  }

  // ── Data ─────────────────────────────────────────────────────────────────────────────────
  function viewData() {
    const s = state();
    return `<section class="panel tax-panel"><div class="panel-header"><div><h3>Your tax data</h3><p>Stays in your encrypted vault and syncs like everything else.</p></div></div>
      <div class="prot-summary"><div class="prot-stat"><span>Returns</span><b>${(s.taxReturns || []).length}</b><small>filed or unfiled years</small></div><div class="prot-stat"><span>Transfers</span><b>${(s.taxFamily || []).length}</b><small>family money</small></div><div class="prot-stat"><span>Checklist</span><b>${((s.taxProfile || {}).checklist || []).length}</b><small>${Object.keys((s.taxProfile || {}).done || {}).length} done</small></div></div>
      <div class="prot-actions"><label class="secondary-button tax-file">Import tax data<input type="file" accept="application/json,.json" id="taxImportFile" hidden /></label>
        <button type="button" class="secondary-button" id="taxExport">Export tax data</button></div>
      <p class="prot-sub">Import reads a JSON file with taxProfile, taxReturns and taxFamily, and replaces what is stored here after you confirm. Export saves the same file as a backup.</p></section>`;
  }

  function render() {
    const root = $("taxBody");
    if (!root || !App() || !T() || !App().getState) return;
    invalidate();   // this page's own edits change the state before the save event arrives
    const m = compute();
    if (!m) { root.innerHTML = `<section class="panel tax-panel"><div class="prot-empty">The tax page could not be built. Open the console for details.</div></section>`; return; }
    const tabs = `<div class="tax-tabs" role="tablist">${TABS.map(([k, l]) => `<button type="button" role="tab" class="tax-tab${k === tab ? " active" : ""}" aria-selected="${k === tab}" data-tax-tab="${k}">${l}</button>`).join("")}</div>`;
    const body = { today: viewToday, plan: viewPlan, savings: viewSavings, returns: viewReturns, family: viewFamily, rules: viewRules, data: viewData }[tab](m);
    const focus = document.activeElement && root.contains(document.activeElement) ? document.activeElement : null;
    const key = focus && (focus.dataset.taxField || focus.dataset.taxDed || focus.dataset.taxFlag || focus.dataset.taxDep || focus.dataset.taxNum) ? [focus.dataset.taxField || focus.dataset.taxDed || focus.dataset.taxFlag || focus.dataset.taxDep || focus.dataset.taxNum, focus.dataset.who || ""] : null;
    root.innerHTML = tabs + body + note();
    if (key) { const sel = `[data-tax-field="${key[0]}"][data-who="${key[1]}"],[data-tax-ded="${key[0]}"][data-who="${key[1]}"],[data-tax-flag="${key[0]}"],[data-tax-dep="${key[0]}"],[data-tax-num="${key[0]}"]`; const el = root.querySelector(sel); if (el && el.tagName === "INPUT") { try { el.focus(); } catch { /* ignore */ } } }
  }

  // ── events ───────────────────────────────────────────────────────────────────────────────
  function setNested(obj, a, b, v) { obj[a] = obj[a] && typeof obj[a] === "object" ? obj[a] : {}; obj[a][b] = v; }
  function onChange(e) {
    const t = e.target, p = profile();
    if (t.dataset.taxField) { setNested(p, t.dataset.taxField, t.dataset.who, num(t.value)); }
    else if (t.dataset.taxDed) { p.deductionsPaid = p.deductionsPaid || {}; p.deductionsPaid[t.dataset.who] = p.deductionsPaid[t.dataset.who] || {}; p.deductionsPaid[t.dataset.who][t.dataset.taxDed] = num(t.value); }
    else if (t.dataset.taxFlag) { p[t.dataset.taxFlag] = t.dataset.taxFlag === "parentsSenior" ? t.value === "1" : t.value; }
    else if (t.dataset.taxNum) { p[t.dataset.taxNum] = num(t.value); }
    else if (t.dataset.taxDep) { p.departure = p.departure || {}; p.departure[t.dataset.taxDep] = t.dataset.taxDep === "visitDays" ? num(t.value) : t.value; }
    else if (t.id === "taxImportFile") { importFile(t.files && t.files[0]); t.value = ""; return; }
    else return;
    save().catch(() => {}); render();
  }
  async function importFile(file) {
    if (!file) return;
    let data;
    try { data = JSON.parse(await file.text()); } catch { await ask("That file is not valid JSON.", "OK", ""); return; }
    const ok = data && typeof data === "object" && (Array.isArray(data.taxReturns) || data.taxProfile || Array.isArray(data.taxFamily));
    if (!ok) { await ask("This does not look like a tax data file (it needs taxProfile, taxReturns or taxFamily).", "OK", ""); return; }
    const s = state();
    if (!(await ask(`Replace your stored tax data with this file?\n\nReturns: ${(data.taxReturns || []).length}, transfers: ${(data.taxFamily || []).length}, checklist items: ${((data.taxProfile || {}).checklist || []).length}.`))) return;
    const withIds = (list, p) => (Array.isArray(list) ? list : []).map((x) => (x && typeof x === "object" ? { ...x, id: x.id || uid(p) } : null)).filter(Boolean);
    s.taxProfile = data.taxProfile && typeof data.taxProfile === "object" ? data.taxProfile : {};
    s.taxReturns = withIds(data.taxReturns, "taxr");
    s.taxFamily = withIds(data.taxFamily, "taxf");
    await save(); tab = "today"; render();
    await ask(`Imported: ${s.taxReturns.length} returns, ${s.taxFamily.length} transfers, ${(s.taxProfile.checklist || []).length} checklist items.`, "OK", "");
  }
  function exportFile() {
    const s = state(), blob = new Blob([JSON.stringify({ taxProfile: s.taxProfile || {}, taxReturns: s.taxReturns || [], taxFamily: s.taxFamily || [] }, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `life-ledger-tax-data-${today()}.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function onClick(e) {
    const tb = e.target.closest("[data-tax-tab]");
    if (tb) { tab = tb.dataset.taxTab; render(); return; }
    const rb = e.target.closest("[data-tax-ret]");
    if (rb) {
      const act = rb.dataset.taxRet, id = rb.dataset.id;
      if (act === "add") openReturnForm(null);
      else if (act === "edit") openReturnForm(id);
      else if (act === "del") ask("Delete this return? The check and the correction costs for that year will go with it.", "Delete").then((yes) => { if (!yes) return; const s = state(); s.taxReturns = (s.taxReturns || []).filter((r) => r.id !== id); save().catch(() => {}); render(); });
      return;
    }
    const fchk = e.target.closest("[data-tax-file]");
    if (fchk && fchk.type === "checkbox") { const p = profile(), fy = model.fy; p.filingDone = p.filingDone || {}; p.filingDone[fy] = { ...(p.filingDone[fy] || {}) }; if (fchk.checked) p.filingDone[fy][fchk.dataset.taxFile] = today(); else delete p.filingDone[fy][fchk.dataset.taxFile]; save().catch(() => {}); render(); return; }
    const done = e.target.closest("[data-tax-done]");
    if (done) { const p = profile(); p.done = { ...(p.done || {}), [done.dataset.taxDone]: today() }; save().catch(() => {}); render(); return; }
    const del = e.target.closest("[data-tax-del-family]");
    if (del) { ask("Remove this transfer?", "Remove").then((yes) => { if (!yes) return; const s = state(); s.taxFamily = (s.taxFamily || []).filter((x) => x.id !== del.dataset.taxDelFamily); save().catch(() => {}); render(); }); return; }
    if (e.target.closest("#taxExport")) exportFile();
  }
  function onSubmit(e) {
    if (e.target.id !== "taxFamilyForm") return;
    e.preventDefault();
    const f = new FormData(e.target), s = state();
    s.taxFamily = s.taxFamily || [];
    s.taxFamily.push({ id: uid("taxf"), date: f.get("date"), amount: num(f.get("amount")), from: f.get("from"), to: f.get("relation") === "spouse" ? (f.get("from") === "Me" ? "Wife" : "Me") : "", relation: f.get("relation"), viaOther: f.get("viaOther") === "1", repaymentExpected: f.get("repaymentExpected") === "1", note: String(f.get("note") || "") });
    save().catch(() => {}); render();
  }

  function registerWithAssistant() {
    const K = window.LifeLedgerKnowledge;
    if (!K || !K.registerModule) return;
    K.registerModule({ id: "tax", title: "Tax plan", description: "this year's tax per person under both regimes, TDS vs tax and advance tax, saving moves with rupee amounts, tax dates, filed returns needing correction, tax if each holding were sold today",
      build: () => { const m = sharedModel(); return m ? T().household.briefing(m) : "Tax plan not available yet (open the vault)."; } });
  }

  function init() {
    $("taxOpenBtn")?.addEventListener("click", () => window.LifeLedgerNav?.goToView?.("tax"));
    $("taxReturnForm")?.addEventListener("submit", submitReturnForm);
    $("taxReturnForm")?.addEventListener("click", (e) => { if (e.target.closest("#taxPrefill")) prefillFromRecords(); });
    document.querySelector("#taxReturnModal [data-close-modal]")?.addEventListener("click", closeReturnForm);
    window.addEventListener("ll:data-changed", () => { invalidate(); renderCard(); });
    window.addEventListener("ll:prices-updated", () => { invalidate(); renderCard(); });
    setTimeout(() => { renderCard(); registerWithAssistant(); }, 3200);
    const body = $("taxBody"); if (!body) return;
    body.addEventListener("click", onClick); body.addEventListener("change", onChange); body.addEventListener("submit", onSubmit);
    document.addEventListener("click", (e) => { if (e.target.closest('[data-view="tax"]')) setTimeout(render, 60); });
    window.addEventListener("ll:data-changed", () => { if (!$("tax")?.hidden) render(); });
    setTimeout(() => { if (App()?.getState && !$("tax")?.hidden) render(); }, 3000);
  }
  window.addEventListener("load", init);
  window.LifeLedgerTaxUI = { render, compute: () => compute(), model: sharedModel, briefing: (compact) => { const m = sharedModel(); return m ? T().household.briefing(m, { compact }) : ""; }, renderCard };
})();
