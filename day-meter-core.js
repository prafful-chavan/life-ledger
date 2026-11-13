/**
 * Life Ledger — the Day meter (pure; no DOM, no network, no clock).
 *
 * One strip at the top of the Dashboard that answers, per day: how much do we need to take home to live and to reach the goals on
 * their dates, how much do we take home now, and how far apart those are. Every number comes from the goal plan the app already
 * works out (goals-plan-core.js: what each money goal asks per day, plus what the household spends) and from the payslips; nothing
 * is added or assumed here. With no payslips or no spending history there is no figure to show, so no meter is drawn.
 *
 *   meter(plan, { growthPct }) → null | { need, have, gap, ahead, pct, fill, state, livingPerDay, goalsPerDay, perMonth{need, have, gap}, next, openGoals, driver }
 *   html(model, o) → the markup (all data text escaped). o = { fmt: { inr(n) }, dateText(iso) }.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerDayMeter = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  /** Share of the need that is met at or above which the meter says so. */
  const COVERED_AT = 100, CLOSE_AT = 70;

  /** The biggest single ask counts as a driver when it is at least this share of the daily need. */
  const DRIVER_SHARE = 0.25;

  function meter(plan, opts) {
    const e = plan && plan.earn;
    if (!e || !(num(e.needPerDay) > 0)) return null;
    const need = num(e.needPerDay), have = num(e.havePerDay);
    const pct = Math.round((have / need) * 100);
    const open = (plan.items || []).filter((x) => !x.done);
    // the goal that is due first (an overdue one counts as due first); the plan lists goals by what they ask per day, and the sort is stable, so on the same day the bigger ask comes first
    const dated = open.filter((x) => x.dueDate).sort((a, b) => a.days - b.days);
    const n = dated[0];
    // the one goal that asks for most of the need, and what the need would be without it
    const top = open[0]; // the plan lists goals by what they ask per day, biggest first
    let driver = null;
    if (top && num(top.perDay) / need >= DRIVER_SHARE && need - num(top.perDay) > 0) {
      const needWithout = need - num(top.perDay), pctWithout = Math.round((have / needWithout) * 100);
      driver = { name: top.name, kind: top.kind, perDay: num(top.perDay), share: Math.round((num(top.perDay) / need) * 100), needWithout, pctWithout, noGrowth: top.kind === "networth" && !(num(opts && opts.growthPct) > 0) };
    }
    return {
      need, have,
      gap: Math.max(0, need - have), ahead: Math.max(0, have - need),
      pct, fill: Math.max(0, Math.min(100, pct)),
      state: pct >= COVERED_AT ? "covered" : pct >= CLOSE_AT ? "close" : "short",
      livingPerDay: num(e.spendPerDay), goalsPerDay: num(plan.savePerDay),
      perMonth: { need: num(e.needPerMonth), have: num(e.havePerMonth), gap: Math.max(0, num(e.needPerMonth) - num(e.havePerMonth)) },
      next: n ? { name: n.name, perDay: num(n.perDay), days: n.days, dueDate: n.dueDate, overdue: Boolean(n.overdue), remaining: num(n.remaining) } : null,
      openGoals: open.length, driver,
    };
  }

  const WORDS = { covered: "Covered", close: "Close", short: "Short" };

  function html(m, o) {
    if (!m) return "";
    const f = (o && o.fmt) || { inr: (n) => "₹" + Math.round(n) }, dt = (o && o.dateText) || ((s) => s);
    const inr = (n) => esc(f.inr(n));
    const headline = m.state === "covered"
      ? `You take home <b>${inr(m.have)}</b> a day. The need is <b>${inr(m.need)}</b>. That is <b>${inr(m.ahead)}</b> a day to spare.`
      : `You need <b>${inr(m.need)}</b> a day. You take home <b>${inr(m.have)}</b>. <b>${inr(m.gap)}</b> a day is missing.`;
    const d = m.driver;
    const driver = d
      ? `<p class="dm-sub dm-driver"><b>${esc(d.name)}</b> asks for ${inr(d.perDay)} a day, ${esc(d.share)}% of the need. Without it the need is <b>${inr(d.needWithout)}</b> a day and ${esc(d.pctWithout)}% is covered.${d.noGrowth ? " It is worked out with no growth on what you hold; set a yearly growth in Goals to change that." : ""}</p>`
      : "";
    const next = m.next
      ? `<div class="dm-next"><span>Next goal due</span><b>${esc(m.next.name)}</b><span>${m.next.overdue ? "overdue" : esc(dt(m.next.dueDate))}${m.next.overdue ? "" : ` · ${esc(m.next.days)} day${m.next.days === 1 ? "" : "s"}`} · ${inr(m.next.perDay)} a day</span></div>`
      : "";
    return `<div class="dm dm-${esc(m.state)}" role="group" aria-label="What you need to take home each day">
      <div class="dm-top"><span class="dm-title">Per day</span><span class="dm-state">${esc(WORDS[m.state])} · ${esc(m.pct)}%</span></div>
      <div class="dm-bar" role="img" aria-label="${esc(m.pct)} percent of the daily need is covered"><i style="width:${esc(m.fill)}%"></i></div>
      <div class="dm-nums">
        <div><span>You need</span><b>${inr(m.need)}</b></div>
        <div><span>You take home</span><b>${inr(m.have)}</b></div>
        <div><span>${m.state === "covered" ? "To spare" : "Missing"}</span><b>${inr(m.state === "covered" ? m.ahead : m.gap)}</b></div>
      </div>
      <p class="dm-line">${headline}</p>
      <p class="dm-sub">Of the need, <b>${inr(m.livingPerDay)}</b> a day is living costs and <b>${inr(m.goalsPerDay)}</b> a day is for ${esc(m.openGoals)} goal${m.openGoals === 1 ? "" : "s"}. Per month: need ${inr(m.perMonth.need)}, take home ${inr(m.perMonth.have)}.</p>
      ${driver}
      ${next}
    </div>`;
  }

  return { COVERED_AT, CLOSE_AT, DRIVER_SHARE, meter, html };
});
