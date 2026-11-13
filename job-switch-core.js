/**
 * Life Ledger — Job switch planner (pure; no DOM, no network).
 *
 * Works out, from what the household types and from dates, what a change of employer means:
 *   • the last working day (resignation date + notice days) and how many days are left;
 *   • how the new joining date sits against it (a gap with no pay and no employer cover, or an overlap that needs a notice buy-out);
 *   • service at the last day against the 5 years the Gratuity Act asks for, and the date the 5 years are reached;
 *   • leave encashment, only from the days and the per-day figure typed in (policies differ, nothing is assumed);
 *   • the yearly take-home of the current job and of each offer on the same footing (the tax comes from the app's own tax engine);
 *   • a dated checklist, kept as the household ticks it.
 * Every number is the household's or the tax engine's. Nothing is guessed. Information, not advice.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerJobSwitch = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const GRATUITY_YEARS = 5;
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const r0 = (n) => Math.round(n);
  const iso = (v) => String(v || "").slice(0, 10);
  const validISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && (() => { const t = Date.parse(s + "T00:00:00Z"); return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s; })();
  const utc = (s) => Date.parse(s + "T00:00:00Z");
  const DAY = 86400000;
  const daysBetween = (a, b) => (validISO(iso(a)) && validISO(iso(b)) ? Math.round((utc(iso(b)) - utc(iso(a))) / DAY) : null);
  const addDays = (s, n) => new Date(utc(s) + n * DAY).toISOString().slice(0, 10);
  const addYears = (s, n) => { const d = new Date(utc(s)); const m = d.getUTCMonth(); d.setUTCFullYear(d.getUTCFullYear() + n); if (d.getUTCMonth() !== m) d.setUTCDate(0); return d.toISOString().slice(0, 10); };
  const fyOf = (s) => { const y = +s.slice(0, 4), m = +s.slice(5, 7); return m >= 4 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`; };
  const fyEndYear = (fy) => +fy.slice(0, 4) + 1;

  /** Last working day = the day the notice runs out (resignation date + notice days). */
  function lastDay(resignedOn, noticeDays) {
    const d = iso(resignedOn), n = Number(noticeDays);
    if (!validISO(d)) return null;
    if (!Number.isInteger(n) || n < 0 || n > 365) return null;
    return addDays(d, n);
  }

  /** Whole years and months between two dates (the end day counted as served). */
  function service(from, to) {
    const a = iso(from), b = iso(to);
    if (!validISO(a) || !validISO(b) || b < a) return null;
    let months = (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
    if (+b.slice(8, 10) < +a.slice(8, 10)) months--;
    const eligibleOn = addYears(a, GRATUITY_YEARS);
    return { years: Math.floor(months / 12), months: months % 12, totalMonths: months, eligibleOn, gratuityEligible: b >= eligibleOn, daysShort: b >= eligibleOn ? 0 : daysBetween(b, eligibleOn) };
  }

  /**
   * The yearly take-home of one job. p = { gross (taxable salary a year, fixed + variable you expect), employeePf, employerNps, basic, ptax }.
   * computeTax = the tax engine's function. The tax is for the financial year of `onDate`, new regime, full-year basis.
   * takeHome = gross − employer NPS (taxed but not paid to you) − your PF − tax − professional tax.
   */
  function takeHome(p, onDate, computeTax) {
    const gross = num(p && p.gross);
    if (!(gross > 0)) return { ok: false, error: "Enter the yearly pay." };
    const fy = fyOf(iso(onDate));
    let t;
    try { t = computeTax({ fy, regime: "new", grossSalary: gross, employerNps: num(p.employerNps), basic: num(p.basic), professionalTax: num(p.ptax) }); }
    catch (e) { return { ok: false, error: "The tax rules for " + fy + " are not available." }; }
    const net = gross - num(p.employerNps) - num(p.employeePf) - t.totalTax - num(p.ptax);
    return { ok: true, fy, tax: t.totalTax, assumedRules: Boolean(t.assumedRules), year: r0(net), month: r0(net / 12), gross };
  }

  /**
   * The whole plan. rec = { resignedOn, noticeDays, joinedOn (this employer), current: {…pay}, offers: [{ id, name, joinOn, …pay }],
   * leaveDays, leavePerDay, done: { key: true } }. ctx = { today, computeTax, coverEndsWithJob: [{ person, type, cover }] }.
   */
  function plan(rec, ctx) {
    const r = rec || {}, today = (ctx && ctx.today) || "", computeTax = ctx && ctx.computeTax;
    const out = { notice: null, service: null, leave: null, current: null, offers: [], checklist: [], cover: [], coverPlan: null, missing: [] };
    const last = lastDay(r.resignedOn, r.noticeDays);
    if (!last) out.missing.push("resignation date and notice days");
    else {
      const left = daysBetween(today, last);
      out.notice = { resignedOn: iso(r.resignedOn), noticeDays: Number(r.noticeDays), lastDay: last, daysLeft: left, state: left === null ? "unknown" : left > 0 ? "serving" : left === 0 ? "today" : "done" };
    }
    if (last && validISO(iso(r.joinedOn))) out.service = service(r.joinedOn, last);
    else if (last) out.missing.push("the date you joined this employer");
    if (num(r.leaveDays) > 0 && num(r.leavePerDay) > 0) out.leave = { days: num(r.leaveDays), perDay: num(r.leavePerDay), amount: r0(num(r.leaveDays) * num(r.leavePerDay)) };

    const cur = r.current && num(r.current.gross) > 0 && computeTax ? takeHome(r.current, last || today, computeTax) : null;
    out.current = cur;
    for (const o of Array.isArray(r.offers) ? r.offers : []) {
      if (!o) continue;
      const th = computeTax && num(o.gross) > 0 ? takeHome(o, validISO(iso(o.joinOn)) ? iso(o.joinOn) : last || today, computeTax) : { ok: false, error: "Enter the yearly pay." };
      const row = { id: o.id, name: String(o.name || "Offer"), joinOn: iso(o.joinOn), takeHome: th, gapDays: null, overlapDays: null, vsCurrentMonth: null, vsCurrentPct: null };
      if (last && validISO(row.joinOn)) {
        const d = daysBetween(last, row.joinOn);
        // joining on the day after the last day is a clean change-over (no gap)
        if (d > 1) row.gapDays = d - 1; else if (d <= 0) row.overlapDays = 1 - d;
        else row.gapDays = 0;
      }
      if (th.ok && cur && cur.ok) { row.vsCurrentMonth = th.month - cur.month; row.vsCurrentPct = cur.month > 0 ? ((th.month - cur.month) / cur.month) * 100 : null; }
      out.offers.push(row);
    }
    // employer group cover ends with the job; the gap runs to the earliest joining date
    if (last) for (const c of (ctx && ctx.coverEndsWithJob) || []) {
      const joins = out.offers.filter((o) => o.joinOn).map((o) => o.joinOn).sort();
      out.cover.push({ person: c.person, type: c.type, cover: num(c.cover), endsOn: last, gapDaysToEarliestJoin: joins.length ? Math.max(0, daysBetween(last, joins[0]) - 1) : null });
    }
    out.coverPlan = coverPlan(r, last, { today, groupCover: ctx && ctx.groupCover, ownHealth: ctx && ctx.ownHealth, baseline: ctx && ctx.baseline });
    out.checklist = checklist(r, last, today);
    return out;
  }


  /**
   * Health cover once the group policy stops. Per offer: the first day with no cover, the day the new employer's cover starts
   * (joining date + the days the household typed, or never), how many days nobody is covered, and who stays out of the new
   * cover. Nothing is assumed: an answer left blank is reported as "not entered", not as yes or no.
   *   offer.healthStarts: "joining" | "after" (+ healthAfterDays) | "none" | "" ; offer.healthCover: ₹ ; offer.healthSpouse / healthParents: "yes" | "no" | "".
   *   ctx = { today, groupCover: ₹ the group policy gives the family, ownHealth: ₹ of individual health policies held now, baseline: ₹ the household's guide }
   */
  function coverPlan(rec, last, ctx) {
    const c = ctx || {}, group = num(c.groupCover), own = num(c.ownHealth), baseline = num(c.baseline);
    if (!last || !(group > 0)) return null;
    const offers = [];
    for (const o of (rec && Array.isArray(rec.offers) ? rec.offers : [])) {
      if (!o) continue;
      const join = iso(o.joinOn), joinOk = validISO(join);
      let startsOn = null, state = "not entered";
      if (o.healthStarts === "none") state = "no cover";
      else if (o.healthStarts === "joining" && joinOk) { startsOn = join; state = "starts"; }
      else if (o.healthStarts === "after" && joinOk && Number.isInteger(Number(o.healthAfterDays)) && Number(o.healthAfterDays) >= 0 && o.healthAfterDays !== "") { startsOn = addDays(join, Number(o.healthAfterDays)); state = "starts"; }
      const uncoveredDays = startsOn ? Math.max(0, daysBetween(last, startsOn) - 1) : null;
      const cover = num(o.healthCover);
      const who = (v) => (v === "yes" ? "yes" : v === "no" ? "no" : "not entered");
      offers.push({ id: o.id, name: String(o.name || "Offer"), state, startsOn, uncoveredDays, cover: cover > 0 ? cover : null,
        spouse: who(o.healthSpouse), parents: who(o.healthParents),
        vsGroup: cover > 0 ? cover - group : null, vsBaseline: cover > 0 && baseline > 0 ? cover - baseline : null });
    }
    const parentsLeftOut = offers.length > 0 && offers.every((o) => o.parents === "no") && own <= 0;
    return { endsOn: last, firstUncovered: addDays(last, 1), daysToEnd: daysBetween(c.today, last), groupCover: group, ownHealth: own, baseline, offers, parentsLeftOut };
  }

  /** What to do, with dates only where the date is fixed by the household's own dates or by law. */
  function checklist(r, last, today) {
    const done = (r && r.done) || {};
    const exitFy = last ? fyOf(last) : null;
    const items = [
      { key: "letter", title: "Get the resignation accepted in writing, with the last working day on it", date: null },
      { key: "docs", title: "Relieving letter, experience letter and the last payslips", date: last },
      { key: "fnf", title: "Ask for the full-and-final statement (pay up to the last day, leave encashment, any recovery)", date: last },
      { key: "epf", title: "Keep the same UAN and transfer the EPF to the new employer (do not withdraw it)", date: null },
      { key: "form12b", title: "Give the new employer the pay and tax already deducted this year (Form 12B), so the tax is not taken twice", date: null },
      { key: "form16", title: "Form 16 from both employers for the year of the change", date: exitFy ? `${fyEndYear(exitFy)}-06-15` : null },
      { key: "health", title: "Check the health and life cover after the last day (group cover ends with the job)", date: last },
      { key: "hr-exit", title: "Ask the employer's HR in writing what happens to the group health policy when you leave (any option to continue or convert it), before the last day", date: last ? addDays(last, -14) : null },
      { key: "declare", title: "On any new health policy, declare every existing condition of every person covered", date: null },
    ];
    return items.map((i) => ({ ...i, done: Boolean(done[i.key]), daysTo: i.date ? daysBetween(today, i.date) : null }));
  }

  /** The household's record with one checklist item toggled (returns a new record). */
  function toggle(rec, key) {
    const done = { ...((rec && rec.done) || {}) };
    if (done[key]) delete done[key]; else done[key] = true;
    return { ...(rec || {}), done };
  }

  /** Checks a typed-in record; returns a list of problems (empty = fine). */
  function validate(rec) {
    const errs = [];
    const x = rec || {};
    if (x.resignedOn && !validISO(iso(x.resignedOn))) errs.push("The resignation date is not a real date.");
    if (x.noticeDays !== undefined && x.noticeDays !== "" && !(Number.isInteger(Number(x.noticeDays)) && Number(x.noticeDays) >= 0 && Number(x.noticeDays) <= 365)) errs.push("Notice days must be a whole number from 0 to 365.");
    if (x.joinedOn && !validISO(iso(x.joinedOn))) errs.push("The joining date at this employer is not a real date.");
    if (x.joinedOn && x.resignedOn && iso(x.joinedOn) > iso(x.resignedOn)) errs.push("You cannot resign before you joined.");
    for (const o of Array.isArray(x.offers) ? x.offers : []) if (o && o.joinOn && !validISO(iso(o.joinOn))) errs.push(`The joining date for ${o.name || "an offer"} is not a real date.`);
    return errs;
  }

  return { GRATUITY_YEARS, daysBetween, addDays, addYears, fyOf, lastDay, service, takeHome, coverPlan, plan, checklist, toggle, validate, validISO };
});
