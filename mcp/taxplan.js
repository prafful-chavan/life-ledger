/**
 * Life Ledger MCP — compact tax plan for the daily brief (pure). Built from the same household model as the app's Tax page.
 * Leaves out family-money notes and identifiers; keeps figures, ranked actions and dates.
 */
const { household } = require("../tax-core.js");
const r0 = (v) => Math.round(Number(v) || 0);

function taxPlan(state, today) {
  const m = household.build(state, today);
  return {
    fy: m.fy,
    people: m.people.map((p) => !p.plan ? { name: p.name, note: p.note || "No salary record for this year" } : {
      name: p.name, projectedGross: r0(p.salary.gross), regime: p.plan.better, taxNewRegime: r0(p.plan.regimes.new && p.plan.regimes.new.tax), taxOldRegime: r0(p.plan.regimes.old.tax),
      cheaperBy: r0(p.plan.saving), projectedTds: r0(p.plan.tdsProjected), tdsMinusTax: r0(p.plan.balance), longTermGainsBooked: r0(p.realised.ltcg), exemptionLeft: r0(p.exemptionLeft),
      advanceTaxNext: p.plan.nextAdvance ? { date: p.plan.nextAdvance.date, cumulative: r0(p.plan.nextAdvance.cumulativeAmount) } : null,
      levers: p.plan.levers.slice(0, 3).map((l) => ({ what: l.title, savesPerYear: r0(l.yearlySaving) })),
    }),
    actions: m.actions.slice(0, 8).map((a) => ({ severity: a.severity, title: a.title, why: a.why, due: a.due || null, who: a.who || null })),
    deadlines: m.deadlines.filter((d) => d.inDays >= 0 && d.inDays <= 120).slice(0, 6).map((d) => ({ date: d.date, inDays: d.inDays, title: d.title })),
    returns: m.returnsAudit.map((r) => ({ fy: r.fy, person: r.person === "Me" ? "Prafful" : "Archana", filed: !r.unfiled, extraTaxOnDocuments: r0(r.extraTax), highItems: (r.findings || []).filter((f) => f.severity === "high").length, correction: r.remedy ? (r.remedy.pctExtra ? { route: "updated return", extraPct: r.remedy.pctExtra, approxTotal: r0(r.remedy.totalToPay), lastDate: r.remedy.lastDate } : { route: "revised return", lastDate: r.remedy.lastDate }) : null })),
    savings: m.savings ? { couldSaveThisYear: r0(m.savings.totals.thisYear), couldSaveEveryYear: r0(m.savings.totals.runRate), topMoves: m.savings.levers.slice(0, 5).map((l) => ({ move: l.title, thisYear: r0(l.thisYear), everyYear: r0(l.runRate), by: l.deadline || null })), sideBusinessTaxSavedIfInLowerTaxedName: Number(m.profile && m.profile.sideBusinessProfit) > 0 && (m.savings.business[0] || {}).saving ? { profit: m.savings.business[0].profit, saved: r0(m.savings.business[0].saving), bestOwner: m.savings.business[0].bestOwner, profitEntered: true } : null, sideBusinessNeedsProfit: Boolean(m.profile && m.profile.sideBusinessStart) && !(Number(m.profile.sideBusinessProfit) > 0) } : null,
    lawChecked: m.law.verifiedOn, rulesToConfirmWithCa: m.law.weak.length,
  };
}

module.exports = { taxPlan };
