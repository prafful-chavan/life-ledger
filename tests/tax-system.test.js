const assert = require("assert");
const E = require("../tools/tax/engine.js");
const { audit } = require("../tools/tax/audit.js");
const { plan } = require("../tools/tax/planner.js");

// All figures below are synthetic round numbers worked out by hand.

// ── engine: slabs, rebate, marginal relief, rounding ──
let t = E.computeTax({ fy: "2025-26", regime: "new", grossSalary: 1275000 });
assert.strictEqual(t.totalIncome, 1200000);
assert.strictEqual(t.totalTax, 0, "new regime FY25-26: ₹12L after standard deduction is fully rebated");

t = E.computeTax({ fy: "2025-26", regime: "new", grossSalary: 1285000 });
assert.strictEqual(t.normalTax, 61500);
assert.strictEqual(t.totalTax, 10400, "marginal relief: tax limited to the ₹10,000 above ₹12L, plus cess");

t = E.computeTax({ fy: "2023-24", regime: "old", grossSalary: 1050000 });
assert.strictEqual(t.totalTax, 117000, "old regime ₹10L: 12,500 + 1,00,000 + 4% cess");

t = E.computeTax({ fy: "2021-22", regime: "old", grossSalary: 500004 });
assert.strictEqual(t.totalIncome % 10, 0, "sec 288A rounds total income to ₹10");
assert.strictEqual(t.totalTax, 0, "87A rebate up to ₹5L in the old regime");

assert.throws(() => E.computeTax({ fy: "2019-20", regime: "new", grossSalary: 1 }), /did not exist/);
assert.throws(() => E.computeTax({ fy: "2010-11", grossSalary: 1 }), /No tax rules/);

// New regime FY24-25 slabs (3/7/10/12/15) with ₹75k standard deduction
t = E.computeTax({ fy: "2024-25", regime: "new", grossSalary: 1575000 });
assert.strictEqual(t.normalTax, 20000 + 30000 + 30000 + 60000, "₹15L: 5% of 4L + 10% of 3L + 15% of 2L + 20% of 3L");

// ── equity gains: 23-Jul-2024 split, exemption, loss set-off ──
assert.strictEqual(E.equityGainsTax("2024-25", { stcgBefore: 10000, stcgAfter: 10000, ltcgAfter: 225000 }).tax, 1500 + 2000 + 12500);
assert.strictEqual(E.equityGainsTax("2024-25", { stcgAfter: -50000, ltcgAfter: 200000 }).tax, 3125, "short-term loss offsets long-term gain");
assert.strictEqual(E.equityGainsTax("2024-25", { stcgAfter: 30000, ltcgAfter: -50000 }).tax, 6000, "long-term loss never offsets short-term gain");
assert.strictEqual(E.equityGainsTax("2022-23", { ltcgBefore: 150000 }).tax, 5000, "before FY24-25: 10% over ₹1L");

// ── HRA and deduction caps ──
assert.strictEqual(E.hraExemption({ hraReceived: 200000, rentPaid: 240000, basic: 600000, metro: false }), 180000);
assert.strictEqual(E.hraExemption({ hraReceived: 200000, rentPaid: 0, basic: 600000 }), 0);
const caps = E.capDeductions({ "80C": 250000, "80D_self": 30000, "80D_parents": 60000 }, { parentsSenior: false });
assert.strictEqual(caps["80C"], 150000);
assert.strictEqual(caps["80D"], 50000, "parents below 60: ₹25k + ₹25k");
assert.strictEqual(E.capDeductions({ "80D_self": 30000, "80D_parents": 60000 }, { parentsSenior: true })["80D"], 75000);

// ── audit: the patterns a careful CA must catch ──
const r = audit({
  fy: "2025-26", person: "Test",
  filed: { form: "ITR-1", regime: "new", grossSalary: 3000000, exemptAllowances: 200000, otherIncome: 0, employerNps: 100000, totalTax: 0, taxesPaid: 500000 },
  evidence: {
    form16: { gross: 3000000, exemptions: 0, employerNps: 0 }, npsAccount: false, ais: { salary: 3000000, interest: 20000, dividend: 5000 },
    brokers: { stcgAfter: 40000, ltcgAfter: 10000 }, foreign: { accountOpened: "2023-01-01", peakValueInr: 500000 },
  },
});
const ids = r.findings.map((f) => f.id);
for (const id of ["wrong-form", "exemption-unsupported", "nps-unsupported", "other-income-missing", "capital-gains-mismatch", "schedule-fa", "arithmetic"]) assert.ok(ids.includes(id), `expected finding ${id}`);
assert.strictEqual(r.findings[0].severity, "high", "most severe first");
assert.ok(r.correctedTax > r.recomputedFiledTax, "corrections raise the tax");
// Exemption under the new regime: 30% of ₹2L + cess
assert.strictEqual(r.findings.find((f) => f.id === "exemption-unsupported").taxImpact, 62400);

const old = audit({
  fy: "2023-24", person: "Test",
  filed: { form: "ITR-2", regime: "old", grossSalary: 2000000, exemptAllowances: 100000, exemptBreakup: { hra: 100000 }, otherIncome: 0,
    deductions: { "80C": 150000, "80D": 75000, "80DDB": 40000, "80GGC": 100000 }, foreignAssetsDeclared: true },
  evidence: { healthPremiums: { total: 20000 }, parentsSenior: false, illness80DDB: "migraine", rent: { paid: 0 },
    donations: [{ amount: 100000, debitDate: "2024-06-01", recognisedParty: false }] },
});
const byId = Object.fromEntries(old.findings.map((f) => [f.id, f]));
assert.ok(byId["80d"] && byId["80d"].taxImpact === Math.round(55000 * 0.312), "80D limited to the ₹20k paid");
assert.ok(byId["80ddb"], "an illness outside Rule 11DD");
assert.ok(byId["80ggc"] && /outside FY/.test(byId["80ggc"].detail), "cheque cleared in the next year");
assert.ok(byId["hra-proof"], "HRA without rent evidence");
assert.ok(!byId["wrong-form"], "ITR-2 is fine");

// A clean return produces no high findings
const clean = audit({ fy: "2025-26", person: "Clean", filed: { form: "ITR-2", regime: "new", grossSalary: 531000, otherIncome: 400, totalTax: 0, taxesPaid: 0 }, evidence: { ais: { salary: 531000, interest: 400 } } });
assert.strictEqual(clean.findings.filter((f) => f.severity === "high").length, 0);
assert.strictEqual(clean.correctedTax, 0);

// ── planner ──
const p = plan({ fy: "2026-27", person: "Test", grossSalary: 3000000, basic: 1000000, hraReceived: 400000, rentPaid: 240000, otherIncome: 0, employerNps: 0,
  deductionsPaid: { "80C": 150000, "80D_self": 25000 }, tdsProjected: 450000, hasShareSales: true }, "2026-10-20");
assert.strictEqual(p.better, "new");
assert.strictEqual(p.form, "ITR-2");
const nps = p.levers.find((l) => l.id === "employer-nps");
assert.strictEqual(nps.yearlySaving, Math.round(140000 * 0.3 * 1.04), "14% of ₹10L basic at 30% + cess");
assert.ok(p.advanceTax.length === 4 && p.missedAdvance && p.nextAdvance.date === "2026-12-15", "shortfall over ₹10k → instalments; two already past");
assert.ok(p.calendar.every((c, i, a) => i === 0 || a[i - 1].date <= c.date), "calendar in date order");
const noAdv = plan({ fy: "2026-27", person: "Low", grossSalary: 700000, basic: 280000, tdsProjected: 0 }, "2026-10-20");
assert.strictEqual(noAdv.advanceTax.length, 0);
assert.ok(!noAdv.levers.some((l) => l.yearlySaving <= 0), "levers worth nothing are dropped");

console.log("tax-system tests passed");
