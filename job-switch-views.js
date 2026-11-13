/**
 * Life Ledger — the markup of the Job switch planner (pure: numbers in, HTML out; no DOM, no network).
 *   jobSwitch(rec, plan, o) — the form (dates, pay of the current job and of each offer), then what the plan says.
 * All text that comes from the data is escaped. The page puts the result in place and listens to `data-act` / `data-field`.
 * o = { fmt: { inr(n) whole rupees }, today }.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./dashboard-charts.js"));
  else root.LifeLedgerJobSwitchViews = factory(root.LifeLedgerDashboardCharts);
})(typeof self !== "undefined" ? self : this, function (Ch) {
  const h = Ch.esc;
  const dateText = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "")); return m ? `${+m[3]} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+m[2] - 1]} ${m[1]}` : "—"; };
  const signed = (n, fmt) => `${n < 0 ? "−" : n > 0 ? "+" : ""}${fmt.inr(Math.abs(n))}`;
  const cls = (n) => (n < 0 ? "bad" : n > 0 ? "good" : "flat");
  const val = (v) => (v === undefined || v === null ? "" : h(String(v)));
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  const input = (name, label, v, type, extra) => `<label>${h(label)}<input data-field="${h(name)}" type="${type || "number"}" ${type === "date" || type === "text" ? "" : 'inputmode="decimal" min="0" step="any"'} value="${val(v)}" ${extra || ""}></label>`;
  const payFields = (p, prefix) => [
    input(prefix + "gross", "Pay a year before tax (₹): fixed + variable you expect", p && p.gross),
    input(prefix + "employeePf", "Your PF a year (₹)", p && p.employeePf),
    input(prefix + "employerNps", "Employer NPS a year (₹)", p && p.employerNps),
    input(prefix + "basic", "Basic pay a year (₹, for the NPS limit)", p && p.basic),
    input(prefix + "ptax", "Professional tax a year (₹)", p && p.ptax),
  ].join("");

  function form(rec, errors) {
    const r = rec || {};
    const offers = (r.offers || []).map((o, i) => `<div class="up-card" data-offer="${h(o.id)}"><h4>Offer ${i + 1}</h4><div class="up-form">
        ${input("o" + i + "name", "Company", o.name, "text")}${input("o" + i + "joinOn", "Joining date", o.joinOn, "date")}${payFields(o, "o" + i)}</div>
        <div class="up-actions"><button type="button" class="ghost-button up-btn" data-act="js-remove" data-id="${h(o.id)}">Remove this offer</button></div></div>`).join("");
    return `<div class="up-card"><h4>Your move</h4><div class="up-form">
        ${input("resignedOn", "Resigned on", r.resignedOn, "date")}${input("noticeDays", "Notice days", r.noticeDays, "number", 'max="365" step="1"')}
        ${input("joinedOn", "Joined this employer on", r.joinedOn, "date")}${input("leaveDays", "Leave days to be paid out", r.leaveDays)}${input("leavePerDay", "Paid per leave day (₹)", r.leavePerDay)}</div></div>
      <div class="up-card"><h4>Current job</h4><div class="up-form">${payFields(r.current, "c")}</div></div>
      ${offers}
      <p class="up-error" ${errors && errors.length ? "" : "hidden"} role="alert">${h((errors || []).join(" "))}</p>
      <div class="up-actions"><button type="button" class="secondary-button up-btn" data-act="js-add">Add an offer</button><button type="button" class="primary-button up-btn" data-act="js-save">Save and work it out</button></div>`;
  }

  function noticeCard(n, s, o) {
    if (!n) return "";
    const state = n.state === "serving" ? `<strong>${plural(n.daysLeft, "day")}</strong> left` : n.state === "today" ? "<strong>today is the last day</strong>" : `<strong>ended ${plural(-n.daysLeft, "day")} ago</strong>`;
    const svc = s ? `<li><span>Service at the last day</span><b>${plural(s.years, "year")} ${plural(s.months, "month")}</b><small>${s.gratuityEligible ? "Five years are complete, so gratuity applies." : `Gratuity needs 5 years on the Act's rule: reached on ${h(dateText(s.eligibleOn))}, ${plural(s.daysShort, "day")} after the last day. None is due on leaving on this date.`}</small></li>` : "";
    return `<li><span>Last working day</span><b>${h(dateText(n.lastDay))}</b><small>${h(dateText(n.resignedOn))} + ${plural(n.noticeDays, "day")} notice · ${state}</small></li>${svc}`;
  }

  function payCard(label, th, fmt, extra) {
    if (!th) return "";
    if (!th.ok) return `<li><span>${h(label)}</span><b>—</b><small>${h(th.error)}</small></li>`;
    return `<li><span>${h(label)}</span><b>${h(fmt.inr(th.month))} a month</b><small>${h(fmt.inr(th.year))} a year · tax ${h(fmt.inr(th.tax))} (new regime, FY ${h(th.fy)}${th.assumedRules ? ", rules for this year are assumed" : ""})${extra || ""}</small></li>`;
  }

  function offerRow(row, fmt) {
    const delta = row.vsCurrentMonth === null ? "" : ` · <span class="dv-delta ${cls(row.vsCurrentMonth)}">${h(signed(row.vsCurrentMonth, fmt))} a month${row.vsCurrentPct === null ? "" : ` (${row.vsCurrentPct >= 0 ? "+" : "−"}${Math.abs(row.vsCurrentPct).toFixed(1)}%)`} vs now</span>`;
    const join = row.joinOn ? (row.overlapDays ? `<br><small class="up-warn">Joins ${plural(row.overlapDays, "day")} before the notice ends: needs a notice buy-out or a shorter notice.</small>` : row.gapDays ? `<br><small>${plural(row.gapDays, "day")} between the last day and joining: no pay and no employer cover.</small>` : `<br><small>Joins the day after the last day: no gap.</small>`) : "";
    return payCard(row.name, row.takeHome, fmt, delta + join);
  }

  function checklistCard(items, today) {
    const li = items.map((i) => `<li><label class="up-check"><input type="checkbox" data-act="js-tick" data-key="${h(i.key)}" ${i.done ? "checked" : ""}> <span>${h(i.title)}${i.date ? ` <small>by ${h(dateText(i.date))}${i.daysTo === null || i.done ? "" : i.daysTo < 0 ? " · overdue" : ` · in ${plural(i.daysTo, "day")}`}</small>` : ""}</span></label></li>`).join("");
    return `<h5>Checklist</h5><ul class="up-list up-checks">${li}</ul>`;
  }

  function jobSwitch(rec, plan, o) {
    const fmt = o.fmt, p = plan || {};
    const out = [`<div class="up-two"><div>${form(rec, o.errors)}</div><div>`];
    if (p.missing && p.missing.length) out.push(`<p class="dv-note">To work out the dates, enter: ${p.missing.map(h).join(", ")}.</p>`);
    const list = [noticeCard(p.notice, p.service, o)];
    if (p.leave) list.push(`<li><span>Leave encashment</span><b>${h(fmt.inr(p.leave.amount))}</b><small>${h(String(p.leave.days))} days × ${h(fmt.inr(p.leave.perDay))}: your figures. The company's policy decides what is really paid.</small></li>`);
    list.push(payCard("Current job", p.current, fmt));
    for (const row of p.offers || []) list.push(offerRow(row, fmt));
    for (const c of p.cover || []) list.push(`<li><span>${h(c.type)} cover (${h(c.person)})</span><b>${h(fmt.inr(c.cover))}</b><small>Group cover ends with the job, on ${h(dateText(c.endsOn))}.${c.gapDaysToEarliestJoin === null ? "" : c.gapDaysToEarliestJoin ? ` ${plural(c.gapDaysToEarliestJoin, "day")} before the earliest joining date have no cover.` : " The earliest offer starts at once."}</small></li>`);
    out.push(`<h5>What it comes to</h5><ul class="up-list">${list.join("")}</ul>`);
    out.push(checklistCard(p.checklist || [], o.today));
    out.push(`<p class="dv-note">Take-home is on a full-year, new-regime basis from the app's tax engine and the figures typed here; it is a comparison, not a payslip. Information, not advice.</p></div></div>`);
    return out.join("");
  }

  return { jobSwitch, dateText };
});
