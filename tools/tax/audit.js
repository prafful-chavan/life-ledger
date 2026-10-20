/**
 * Life Ledger — return audit (pure). Checks a filed (or draft) return against the evidence for the same year and says what is
 * missing, unsupported or wrongly computed, with the tax effect of each item. It is the check a careful CA runs before filing.
 *
 * c = {
 *   fy, person,
 *   filed: { form, regime, filedOn, grossSalary, exemptAllowances, exemptBreakup: { hra, sec10_14i, ... }, professionalTax,
 *            otherIncome, interest, dividend, speculativeIncome, gains: { stcgBefore, stcgAfter, ltcgBefore, ltcgAfter },
 *            deductions: { "80C", "80D", "80DDB", "80GGC", "80TTA", ... } (as allowed in the return), employerNps,
 *            totalIncome, totalTax, interestAndFee (234A/B/C/F already in the filed liability), taxesPaid, foreignAssetsDeclared },
 *   evidence: { form16: { gross, exemptions, employerNps }, ais: { salary, interest, dividend, saleOfSecurities }, tds,
 *               brokers: { stcgBefore, stcgAfter, ltcgBefore, ltcgAfter, intraday, saleValue },
 *               foreign: { accountOpened, peakValueInr, dividendsInr }, npsAccount, healthPremiums: { self, parents },
 *               parentsSenior, illness80DDB, rent: { paid, landlordPan, payee }, proof80C, donations: [{ amount, debitDate, recognisedParty }] }
 * }
 */
const E = require("./engine");
const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const r0 = (v) => Math.round(v);
const inr = (v) => "₹" + Math.round(num(v)).toLocaleString("en-IN");
const sumGains = (g = {}) => num(g.stcgBefore) + num(g.stcgAfter) + num(g.ltcgBefore) + num(g.ltcgAfter);
const sumDed = (d = {}) => Object.values(d).reduce((a, b) => a + num(b), 0);

/** The engine input that reproduces the filed return. */
function filedInput(c) {
  const f = c.filed;
  return {
    fy: c.fy, regime: f.regime, grossSalary: f.grossSalary, exemptAllowances: f.exemptAllowances, professionalTax: f.professionalTax,
    otherIncome: num(f.otherIncome), speculativeIncome: f.speculativeIncome, deductions: sumDed(f.deductions), employerNps: f.employerNps, gains: f.gains || {},
  };
}

function audit(c) {
  const f = c.filed || {}, ev = c.evidence || {}, findings = [];
  const base = filedInput(c);
  const baseTax = E.computeTax(base).totalTax;
  /** Tax effect of changing the return as `patch` says (positive = more tax due). */
  const impact = (patch) => E.computeTax({ ...base, ...patch(base) }).totalTax - baseTax;
  const add = (severity, id, title, detail, taxImpact = 0, fix = "") => findings.push({ severity, id, title, detail, taxImpact: r0(taxImpact), fix });
  const y = E.yearRules(c.fy);
  const fyStartYear = +c.fy.slice(0, 4);

  // 1. Arithmetic
  if (f.totalTax != null && Math.abs(baseTax - num(f.totalTax)) > 10) add("medium", "arithmetic", "Tax in the return does not reproduce", `Recomputed ${inr(baseTax)} against ${inr(f.totalTax)} in the return.`, baseTax - num(f.totalTax));

  // 2. Form eligibility
  const brokerGains = ev.brokers ? sumGains(ev.brokers) : 0;
  const hasST = num(ev.brokers?.stcgBefore) + num(ev.brokers?.stcgAfter) !== 0 || num(f.gains?.stcgBefore) + num(f.gains?.stcgAfter) !== 0;
  const ltcg = num(ev.brokers?.ltcgBefore) + num(ev.brokers?.ltcgAfter);
  const hasForeign = !!(ev.foreign && ev.foreign.accountOpened && ev.foreign.accountOpened <= `${fyStartYear + 1}-03-31`);
  if (f.form === "ITR-1") {
    const why = [];
    if (hasST) why.push("short-term capital gains/losses");
    if (ltcg > 0 && (fyStartYear < 2024 || ltcg > E.RULES.itr1.maxLtcg112AFromAY2526)) why.push("long-term gains ITR-1 cannot carry");
    if (num(ev.brokers?.intraday)) why.push("intraday (speculative) trades");
    if (hasForeign) why.push("foreign assets");
    if (why.length) add("high", "wrong-form", "ITR-1 was not allowed", `This year had ${why.join(", ")}. The return needed ITR-2.`, 0, "File ITR-2.");
  }

  // 3. Salary vs Form 16 / AIS
  if (ev.ais?.salary && num(ev.ais.salary) - num(f.grossSalary) > 1000) add("medium", "salary-mismatch", "Salary in AIS is higher than in the return", `AIS ${inr(ev.ais.salary)}, return ${inr(f.grossSalary)}.`, impact(() => ({ grossSalary: num(ev.ais.salary) })));
  if (ev.form16 && num(f.exemptAllowances) > num(ev.form16.exemptions) + 1000) {
    const extra = num(f.exemptAllowances) - num(ev.form16.exemptions);
    const sev = f.regime === "new" ? "high" : "medium";
    const why = f.regime === "new" ? "Under the new regime HRA, LTA and most allowances are not exempt; Rule 2BB covers only specific duty-linked allowances." : "The employer did not allow them; each needs its own proof (rent receipts and landlord PAN for HRA, travel bills for LTA).";
    add(sev, "exemption-unsupported", "Exempt allowances above Form 16", `Return exempts ${inr(f.exemptAllowances)}, Form 16 ${inr(ev.form16.exemptions)} (extra ${inr(extra)}). ${why}`, impact(() => ({ exemptAllowances: num(ev.form16.exemptions) })), "Remove, or keep only with documents.");
  }

  // 4. Employer NPS
  if (num(f.employerNps) > 0) {
    if (ev.npsAccount === false || (ev.form16 && !num(ev.form16.employerNps))) {
      add("high", "nps-unsupported", "Employer NPS (80CCD(2)) without an NPS contribution", `Claimed ${inr(f.employerNps)}, but ${ev.npsAccount === false ? "there is no NPS account (PRAN)" : "Form 16 shows no employer NPS"}.`, impact(() => ({ employerNps: 0 })), "Remove the claim.");
    }
  }

  // 5. Other income vs AIS
  const aisOther = num(ev.ais?.interest) + num(ev.ais?.dividend) + num(ev.foreign?.dividendsInr);
  if (aisOther - num(f.otherIncome) > 500) add(aisOther - num(f.otherIncome) > 10000 ? "medium" : "low", "other-income-missing", "Interest/dividends left out", `AIS/foreign statements show ${inr(aisOther)} (interest ${inr(ev.ais?.interest)}, dividends ${inr(ev.ais?.dividend)}${num(ev.foreign?.dividendsInr) ? `, US dividends ${inr(ev.foreign.dividendsInr)}` : ""}); the return shows ${inr(f.otherIncome)}.`, impact((b) => ({ otherIncome: aisOther })), "Add them under Other Sources.");

  // 6. Capital gains vs brokers
  if (ev.brokers) {
    const g = ev.brokers, fg = f.gains || {};
    const gap = sumGains(g) - sumGains(fg);
    const intradayGap = num(g.intraday) - num(f.speculativeIncome);
    if (Math.abs(gap) > 1000 || Math.abs(intradayGap) > 1000) {
      const t = impact(() => ({ gains: { stcgBefore: g.stcgBefore, stcgAfter: g.stcgAfter, ltcgBefore: g.ltcgBefore, ltcgAfter: g.ltcgAfter }, speculativeIncome: Math.max(0, num(g.intraday)) }));
      add(Math.abs(t) > 3000 ? "high" : "medium", "capital-gains-mismatch", "Capital gains differ from the broker statements", `Brokers: short-term ${inr(num(g.stcgBefore) + num(g.stcgAfter))}, long-term ${inr(num(g.ltcgBefore) + num(g.ltcgAfter))}, intraday ${inr(g.intraday)}. Return: short-term ${inr(num(fg.stcgBefore) + num(fg.stcgAfter))}, long-term ${inr(num(fg.ltcgBefore) + num(fg.ltcgAfter))}, intraday ${inr(f.speculativeIncome)}.${g.saleValue && ev.ais?.saleOfSecurities ? ` Broker sale value ${inr(g.saleValue)} vs AIS ${inr(ev.ais.saleOfSecurities)}.` : ""}`, t, "Report every broker's gains, split at 23-Jul-2024.");
    }
    if (num(g.stcgBefore) + num(g.stcgAfter) < 0 || num(g.ltcgBefore) + num(g.ltcgAfter) < 0) add("info", "losses", "Losses to carry forward", "Losses carry forward for 8 years only if the return is filed by the due date.");
  }

  // 7. Foreign assets
  if (hasForeign && !f.foreignAssetsDeclared) {
    const small = num(ev.foreign.peakValueInr) <= E.RULES.blackMoneyPenaltyThreshold;
    add(small ? "medium" : "high", "schedule-fa", "Foreign assets not declared (Schedule FA / FSI)", `A foreign account was open from ${ev.foreign.accountOpened}. Schedule FA (calendar year), FSI for foreign income and Form 67 for US tax credit are required.${small ? " Value is under ₹20L, so the ₹10L Black Money Act penalty does not apply from Oct-2024; the risk is a notice." : ""}`, 0, "Declare in ITR-2 Schedule FA/FSI; file Form 67 before the return.");
  }

  // 8. Deductions (old regime)
  const d = f.deductions || {};
  if (f.regime === "old") {
    if (num(d["80D"]) > 0) {
      const cap = E.RULES.deductions["80D_self"] + (ev.parentsSenior ? E.RULES.deductions["80D_parents_senior"] : E.RULES.deductions["80D_parents"]);
      const paid = premiumsAllowed(ev, cap);
      const allowed = Math.min(cap, paid == null ? cap : paid + (ev.preventiveCheckup ? Math.min(5000, num(ev.preventiveCheckup)) : 0));
      if (num(d["80D"]) > allowed + 100) add("high", "80d", "80D above what was paid / the limit", `Claimed ${inr(d["80D"])}. Limit ${inr(cap)}${ev.parentsSenior ? "" : " (no parent was 60+)"}${paid != null ? `; premiums on record ${inr(paid)}` : ""}.`, impact((b) => ({ deductions: b.deductions - (num(d["80D"]) - allowed) })), "Claim only premiums actually paid, within the limit.");
    }
    if (num(d["80DDB"]) > 0) {
      const ok = ev.illness80DDB && E.RULES.rule11DD.some((x) => String(ev.illness80DDB).toLowerCase().includes(x));
      if (!ok) add("high", "80ddb", "80DDB without a Rule 11DD illness", `Claimed ${inr(d["80DDB"])}. ${ev.illness80DDB ? `"${ev.illness80DDB}" is not on the Rule 11DD list.` : "No qualifying illness/certificate on record."}`, impact((b) => ({ deductions: b.deductions - num(d["80DDB"]) })), "Remove unless a specialist certifies a listed illness.");
    }
    if (num(d["80GGC"]) > 0) {
      const don = (ev.donations || []).reduce((a, x) => a + num(x.amount), 0);
      const inYear = (ev.donations || []).filter((x) => x.debitDate && E.fyOf(x.debitDate) === c.fy).reduce((a, x) => a + num(x.amount), 0);
      const unrecognised = (ev.donations || []).some((x) => x.recognisedParty === false);
      if (!don) add("high", "80ggc", "80GGC with no donation evidence", `Claimed ${inr(d["80GGC"])}.`, impact((b) => ({ deductions: b.deductions - num(d["80GGC"]) })));
      else if (inYear < num(d["80GGC"]) || unrecognised) add("high", "80ggc", "80GGC donation at risk", `${inYear < num(d["80GGC"]) ? `The bank debit falls outside FY ${c.fy} (cheque cleared later). ` : ""}${unrecognised ? "The party is a registered-unrecognised party; these donations are a current enforcement focus. " : ""}Keep receipt, cheque and bank statement together.`, impact((b) => ({ deductions: b.deductions - num(d["80GGC"]) })));
    }
    if (num(f.exemptBreakup?.hra) > 0) {
      const r = ev.rent || {};
      if (!r.paid) add("medium", "hra-proof", "HRA without rent evidence", `HRA exempt ${inr(f.exemptBreakup.hra)}; no rent payments on record.`, impact((b) => ({ exemptAllowances: b.exemptAllowances - num(f.exemptBreakup.hra) })), "Keep bank transfers, agreement, landlord PAN.");
      else if (r.paid > E.RULES.deductions.landlordPanAbove && !r.landlordPan) add("low", "hra-pan", "Landlord PAN missing", "Rent above ₹1L a year needs the landlord's PAN.");
      if (r.payee === "parents") add("medium", "hra-parents", "Rent paid to parents", "Allowed only if the parent owns the house, rent moves by bank transfer, and the parent declares it as income.");
    }
    if (ev.proof80C != null && num(d["80C"]) > num(ev.proof80C) + 1000) add("low", "80c", "80C above the proof on record", `Claimed ${inr(d["80C"])}, proof ${inr(ev.proof80C)}.`, impact((b) => ({ deductions: b.deductions - (num(d["80C"]) - num(ev.proof80C)) })));
  }

  // 9. TDS credit
  if (ev.tds != null && num(f.taxesPaid) > num(ev.tds) + num(f.selfAssessmentTax) + num(f.tcs) + 10) add("medium", "tds-credit", "Tax credit above 26AS", `Return ${inr(f.taxesPaid)}, 26AS ${inr(ev.tds)}.`);

  // 10. Regime check
  // (Only old → new can be judged from a return: the new regime needs no extra facts.)
  if (y.newRegime && f.regime === "old") {
    const corrected = correctedInput(c);
    const a = E.computeTax({ ...corrected, regime: "new", exemptAllowances: 0, deductions: 0 });
    const cur = E.computeTax(corrected);
    if (a.totalTax + 5000 < cur.totalTax) add("info", "regime", "New regime would have been cheaper", `On documented figures: old ${inr(cur.totalTax)} vs new ${inr(a.totalTax)}.`, a.totalTax - cur.totalTax);
  }

  const corrected = E.computeTax(correctedInput(c));
  const order = { high: 0, medium: 1, low: 2, info: 3 };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || b.taxImpact - a.taxImpact);
  return {
    fy: c.fy, ay: E.ayOf(c.fy), person: c.person, form: f.form, regime: f.regime,
    filedTax: r0(num(f.totalTax) || baseTax), recomputedFiledTax: baseTax, correctedTax: corrected.totalTax, interestAndFeeFiled: r0(num(f.interestAndFee)),
    extraTaxIfCorrected: corrected.totalTax - baseTax, refundClaimed: r0(num(f.taxesPaid) - (num(f.totalTax) || baseTax) - num(f.interestAndFee)),
    refundOnDocumentedFigures: r0(num(f.taxesPaid) - corrected.totalTax - num(f.interestAndFee)), findings,
  };
}

/** 80D the premiums on record support: { self, parents } split, or { total } when the split is unknown (employer family cover). null = no record. */
function premiumsAllowed(ev, cap) {
  const h = ev.healthPremiums;
  if (!h) return null;
  if (h.total != null) return Math.min(cap, num(h.total));
  return Math.min(E.RULES.deductions["80D_self"], num(h.self)) + Math.min(ev.parentsSenior ? E.RULES.deductions["80D_parents_senior"] : E.RULES.deductions["80D_parents"], num(h.parents));
}

/** The return as the evidence supports it: unsupported claims removed, missing income added. */
function correctedInput(c) {
  const f = c.filed, ev = c.evidence || {}, b = filedInput(c);
  const out = { ...b };
  if (ev.form16 && num(f.exemptAllowances) > num(ev.form16.exemptions)) {
    const hraOk = f.regime === "old" && ev.rent?.paid && num(f.exemptBreakup?.hra);
    out.exemptAllowances = num(ev.form16.exemptions) + (hraOk ? Math.min(num(f.exemptBreakup.hra), num(ev.rent.paid)) : 0);
  }
  if (num(f.employerNps) && (ev.npsAccount === false || (ev.form16 && !num(ev.form16.employerNps)))) out.employerNps = 0;
  const aisOther = num(ev.ais?.interest) + num(ev.ais?.dividend) + num(ev.foreign?.dividendsInr);
  if (aisOther > num(f.otherIncome)) out.otherIncome = aisOther;
  if (ev.brokers) { out.gains = { stcgBefore: ev.brokers.stcgBefore, stcgAfter: ev.brokers.stcgAfter, ltcgBefore: ev.brokers.ltcgBefore, ltcgAfter: ev.brokers.ltcgAfter }; out.speculativeIncome = Math.max(0, num(ev.brokers.intraday)); }
  if (f.regime === "old") {
    const d = { ...(f.deductions || {}) };
    if (num(d["80D"])) { const cap = 25000 + (ev.parentsSenior ? 50000 : 25000); const paid = premiumsAllowed(ev, cap); d["80D"] = Math.min(num(d["80D"]), cap, paid == null ? cap : paid); }
    if (num(d["80DDB"]) && !(ev.illness80DDB && E.RULES.rule11DD.some((x) => String(ev.illness80DDB).toLowerCase().includes(x)))) d["80DDB"] = 0;
    if (num(d["80C"]) && ev.proof80C != null) d["80C"] = Math.min(num(d["80C"]), num(ev.proof80C));
    out.deductions = sumDed(d); // 80GGC kept: a cleared, documented donation is defensible; flagged separately.
  }
  return out;
}

module.exports = { audit, correctedInput, filedInput };
