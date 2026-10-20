const assert = require("assert");
const { household: H, engine: E } = require("../tax-core.js");

// Synthetic household: made-up numbers only.
const salaryRow = (person, date, gross, tds, extra = {}) => ({ id: `${person}-${date}`, person, date, type: "Salary", grossEarnings: gross, basicSalary: Math.round(gross * 0.3), hra: Math.round(gross * 0.2), pf: Math.round(gross * 0.12), taxTds: tds, professionalTax: 200, amount: gross - tds, organization: "Acme", ...extra });
const months = ["2026-04-30", "2026-05-31", "2026-06-30", "2026-07-31", "2026-08-31", "2026-09-30"];
const state = {
  fx: { usdInr: 90 },
  income: [
    ...months.map((d) => salaryRow("Me", d, 260000, 48000)),
    salaryRow("Me", "2026-04-01", 250000, 40000),                       // credited 1 Apr = March's salary → previous FY
    ...months.map((d) => salaryRow("Wife", d, 58000, 0)),
  ],
  mutualFunds: [
    { id: "b1", fundName: "Fund A", owner: "Me", transactionType: "PURCHASE", units: 100, invested: 10000, purchaseDate: "2021-01-10", latestNav: 300 },
    { id: "r1", fundName: "Fund A", owner: "Me", transactionType: "REDEMPTION", units: 100, invested: 30000, purchaseDate: "2026-08-06" },
  ],
  usstocks: [{ id: "u1", owner: "Me", symbol: "VOO", quantity: 2, currentPrice: 500, invested: 80000 }],
  insurance: [],
  taxProfile: { marriageDate: "2024-06-30", rentMonthly: { Me: 18000 }, parentsSenior: true, deductionsPaid: { Me: { "80C": 150000, "80D_self": 25000, "80D_parents": 50000 } }, otherIncome: { Me: 20000 },
    checklist: [{ id: "will", title: "Make wills", why: "x", severity: "low" }, { id: "nom", title: "Check nominees", severity: "medium" }], done: { nom: "2026-10-01" } },
  taxReturns: [
    { id: "r-2526", fy: "2025-26", person: "Me", filed: { form: "ITR-1", regime: "new", grossSalary: 3000000, exemptAllowances: 200000, employerNps: 100000, otherIncome: 0, totalTax: 0, taxesPaid: 500000 },
      evidence: { form16: { gross: 3000000, exemptions: 0, employerNps: 0 }, npsAccount: false, ais: { salary: 3000000, interest: 20000 }, foreign: { accountOpened: "2023-01-01", peakValueInr: 500000 } } },
    { id: "u-2122", kind: "unfiled", fy: "2021-22", person: "Me", regime: "old", grossSalary: 1300000, exemptAllowances: 170000, deductions: 140000, otherIncome: 100, tds: 70000 },
  ],
  taxFamily: [{ id: "f1", date: "2024-05-14", amount: 500000, from: "Me", to: "Wife", relation: "spouse", viaOther: true }],
};

const m = H.build(state, "2026-10-20");
assert.strictEqual(m.fy, "2026-27"); assert.strictEqual(m.ay, "2027-28");

// salary: 6 paid months + 6 typical months; the 1-Apr credit belongs to last year
assert.strictEqual(H.salaryFy("2026-04-01"), "2025-26"); assert.strictEqual(H.salaryFy("2026-04-30"), "2026-27"); assert.strictEqual(H.salaryFy("2027-01-02"), "2026-27");
const me = m.people.find((p) => p.who === "Me"), wife = m.people.find((p) => p.who === "Wife");
assert.strictEqual(me.salary.months, 6); assert.strictEqual(me.salary.gross, 260000 * 12);
assert.strictEqual(me.salary.tds, 48000 * 12);

// plan: new regime wins for this profile; realised LTCG ₹20,000 uses part of the ₹1.25L exemption
assert.strictEqual(me.plan.better, "new");
assert.strictEqual(Math.round(me.realised.ltcg), 20000); assert.strictEqual(Math.round(me.exemptionLeft), 105000);
assert.ok(me.plan.levers.some((l) => l.id === "employer-nps" && l.yearlySaving > 0));
assert.strictEqual(wife.plan.regimes.new.tax, 0, "income under ₹12L: no tax in the new regime");

// returns: the unsupported claims are found and costed; the unfiled year is flagged
const r26 = m.returnsAudit.find((r) => r.fy === "2025-26");
assert.ok(r26.findings.some((f) => f.id === "exemption-unsupported") && r26.findings.some((f) => f.id === "nps-unsupported"));
assert.ok(r26.extraTax > 0 && r26.remedy.open && r26.remedy.fee === 0, "revised return is open and free before 31 Dec");
const un = m.returnsAudit.find((r) => r.unfiled);
assert.ok(un.extraTax > 0 && un.remedy.pctExtra === 70);

// actions: revise first, then updated return, term cover, user checklist (done items hidden)
const ids = m.actions.map((a) => a.id);
assert.strictEqual(ids[0], "revise-Me"); assert.ok(ids.includes("term-me") && ids.includes("todo-will") && !ids.includes("todo-nom"));
assert.ok(ids.includes("fast-ds"), "foreign assets missing from the returns → FAST-DS decision");
assert.ok(m.actions.every((a, i, arr) => i === 0 || ({ high: 0, medium: 1, low: 2 })[arr[i - 1].severity] <= ({ high: 0, medium: 1, low: 2 })[a.severity]), "ranked by severity");

// deadlines are sorted and include the legal dates
assert.ok(m.deadlines.some((d) => d.date === "2026-12-31") && m.deadlines.every((d, i, a) => i === 0 || a[i - 1].date <= d.date));

// family money uses the marriage date
assert.ok(/before the wedding/.test(m.family[0].result.summary));

// departure view: after 28-Sep-2026 this year stays a resident year; the next can be non-resident
state.taxProfile.departure = { date: "2027-01-15", visitDays: 30 };
const dv = H.build(state, "2026-10-20").departure;
assert.strictEqual(dv.latestForNonResidentThisYear, "2026-09-28");
assert.strictEqual(dv.years[0].status, "ROR"); assert.strictEqual(dv.years[1].status, "NR");

// no salary → no plan, no crash
const empty = H.build({ income: [], taxProfile: {}, taxReturns: [] }, "2026-10-20");
assert.ok(empty.people.every((p) => p.plan === null));
// ── harvesting: oldest-first, long-term only, best gain per rupee first ──
const buy = (id, fund, date, units, invested) => ({ id, fundName: fund, owner: "Me", transactionType: "PURCHASE", units, invested, purchaseDate: date, latestNav: fund === "A" ? 300 : 120 });
const hs = { fx: { usdInr: 90 }, mutualFunds: [
  buy("a1", "A", "2020-01-10", 100, 10000), buy("a2", "A", "2021-03-10", 100, 20000), buy("a3", "A", "2026-08-10", 100, 29000),   // A: nav 300; third lot is recent
  buy("b1", "B", "2019-01-10", 100, 2000),                                                                                       // B: nav 120, gain 10,000 on 12,000 → better gain per rupee
] };
let h = H.harvestPlan(hs, "Me", 25000, "2026-10-20");
assert.strictEqual(h.picks[0].name, "B", "highest gain per rupee sold goes first");
assert.strictEqual(h.picks[0].gain, 10000);
const a = h.picks.find((p) => p.name === "A");
assert.strictEqual(a.gain, 15000); assert.strictEqual(a.units, 75, "the oldest lot (gain 20,000) is sold in part: 15,000 / 20,000 of its 100 units");
assert.strictEqual(h.planned, 25000); assert.strictEqual(h.shortfall, 0);
h = H.harvestPlan(hs, "Me", 500000, "2026-10-20");
assert.ok(h.shortfall > 0 && !h.picks.some((p) => p.units > 200), "never sells the recent (short-term) lot; reports what is not covered");
assert.deepStrictEqual(H.harvestPlan({ mutualFunds: [], fx: {} }, "Me", 10000, "2026-10-20").picks, []);

// ── TDS running above the tax, filing checklist, quarterly portal check ──
const over = { income: [...months.map((d) => salaryRow("Me", d, 120000, 40000))], taxProfile: { filingDone: { "2026-27": { form16: "2027-06-20" } } } };
const mo = H.build(over, "2026-10-20");
assert.ok(mo.actions.some((x) => x.id === "tds-Me"), "TDS far above the tax is flagged");
assert.strictEqual(mo.filing.find((f) => f.id === "form16").done, "2027-06-20"); assert.strictEqual(mo.filing.find((f) => f.id === "ais").done, null);
assert.ok(mo.deadlines.some((d) => d.date === "2027-01-01" && /notices/.test(d.title)));
assert.ok(H.build(state, "2026-10-20").people.find((p) => p.who === "Me").harvest, "a person with exemption left gets a harvest plan");

console.log("tax household tests passed");
