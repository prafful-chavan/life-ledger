const assert = require("assert");
const { taxPlan } = require("../mcp/taxplan.js");
const row = (person, date, g, tds) => ({ id: person + date, person, date, type: "Salary", grossEarnings: g, basicSalary: g * 0.3, hra: g * 0.2, pf: g * 0.12, taxTds: tds, amount: g - tds });
const state = {
  income: [row("Me", "2026-05-31", 250000, 45000), row("Me", "2026-06-30", 250000, 45000), row("Wife", "2026-06-30", 60000, 0)],
  taxProfile: { checklist: [{ id: "x", title: "Make a will", severity: "low" }] },
  taxReturns: [{ id: "r", fy: "2025-26", person: "Me", filed: { form: "ITR-1", regime: "new", grossSalary: 3000000, exemptAllowances: 200000, totalTax: 0, taxesPaid: 500000 }, evidence: { form16: { exemptions: 0 } } }],
  taxFamily: [{ id: "f", date: "2024-05-14", amount: 500000, relation: "spouse", note: "private note that must not leave the vault" }],
  insurance: [],
};
const p = taxPlan(state, "2026-10-20");
assert.strictEqual(p.fy, "2026-27");
assert.strictEqual(p.people[0].name, "Prafful"); assert.ok(p.people[0].taxNewRegime > 0 && p.people[1].taxNewRegime === 0);
assert.ok(p.actions.length && p.actions[0].severity === "high");
assert.ok(p.returns.some((r) => r.person === "Prafful" && r.correction && r.correction.route === "revised return"));
const text = JSON.stringify(p);
assert.ok(!/private note/.test(text), "family-money notes are not included");
assert.ok(p.deadlines.every((d) => d.inDays >= 0 && d.inDays <= 120));
assert.ok(p.savings && p.savings.topMoves.every((x) => x.move && Number.isFinite(x.thisYear)), "the saving moves are in the daily pack");
console.log("mcp tax plan tests passed");
