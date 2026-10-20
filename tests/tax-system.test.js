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

// Gains already booked use up the exemption
const used = plan({ fy: "2026-27", person: "Used", grossSalary: 3000000, basic: 1000000, realisedLtcgYtd: 70000, tdsProjected: 600000 }, "2026-10-20");
const h = used.levers.find((l) => l.id === "ltcg-harvest");
assert.ok(/55,000/.test(h.title) && h.yearlySaving === Math.round(55000 * 0.125 * 1.04), "₹55,000 of the exemption left");
assert.strictEqual(used.regimes.new.tax, plan({ fy: "2026-27", person: "x", grossSalary: 3000000, basic: 1000000, tdsProjected: 600000 }, "2026-10-20").regimes.new.tax, "gains inside the exemption add no tax");
assert.ok(!plan({ fy: "2026-27", person: "Full", grossSalary: 900000, basic: 300000, realisedLtcgYtd: 130000 }, "2026-10-20").levers.some((l) => l.id === "ltcg-harvest"), "nothing left to harvest");

console.log("tax-system tests passed");

// ── law register, remedies, gifts ──
const Law = require("../tools/tax/law.js");
const R = require("../tools/tax/remedies.js");
const G = require("../tools/tax/gifts.js");
assert.ok(Law.LAW.every((r) => r.id && r.topic && r.rule && ["statute", "secondary", "author"].includes(r.confidence) && Array.isArray(r.sources) && r.sources.length), "every rule names its source and confidence");
assert.strictEqual(new Set(Law.LAW.map((r) => r.id)).size, Law.LAW.length, "rule ids are unique");
assert.ok(Law.lawStatus("2026-10-20").needsReview.includes("fast-ds"), "secondary-source rules are flagged for review");
assert.ok(Law.lawStatus("2027-03-01").stale.length === Law.LAW.length, "everything is stale after 60 days");

assert.deepStrictEqual([R.itrUTier("2025-26", "2026-10-20").pct, R.itrUTier("2024-25", "2026-10-20").pct, R.itrUTier("2023-24", "2026-10-20").pct, R.itrUTier("2022-23", "2026-10-20").pct], [25, 50, 60, 70]);
assert.strictEqual(R.itrUTier("2021-22", "2026-10-20"), null, "AY 2021-22 closed after 31-Mar-2026");
assert.strictEqual(R.itrUTier("2022-23", "2027-04-01"), null, "AY 2022-23 closes 31-Mar-2027");
assert.strictEqual(R.itrUTier("2025-26", "2027-04-02").pct, 50, "the rate steps up each 1 April");
const cost = R.itrUCost({ ay: "2024-25", additionalTax: 20000, asOf: "2026-10-20" });
assert.strictEqual(cost.extraTax, Math.round((cost.additionalTax + cost.interest) * 0.5));
assert.strictEqual(cost.totalToPay, cost.additionalTax + cost.interest + cost.extraTax);
assert.strictEqual(R.revisedReturn({ ay: "2026-27", asOf: "2026-12-31" }).fee, 0);
assert.strictEqual(R.revisedReturn({ ay: "2026-27", asOf: "2027-01-02" }).fee, 5000);
assert.strictEqual(R.revisedReturn({ ay: "2025-26", asOf: "2026-10-20" }).open, false);
const f = R.fastDs({ valueAtMar2026: 300000, peakValueInr: 900000, asOf: "2026-10-20" });
assert.ok(f.open && f.category === "B" && f.cost === 100000);
assert.strictEqual(R.fastDs({ valueAtMar2026: 300000, taxedIncome: false, asOf: "2026-10-20" }).cost, 180000, "category A is 60% of value");
assert.strictEqual(R.fastDs({ valueAtMar2026: 1, asOf: "2027-01-01" }).open, false, "window closes 31-Dec-2026");

const ctx = { marriageDate: "2024-06-30" };
assert.strictEqual(G.isRelative("spouse", "2024-05-14", ctx.marriageDate), false, "fiancée is not yet a relative");
assert.strictEqual(G.isRelative("spouse", "2024-09-09", ctx.marriageDate), true);
assert.strictEqual(G.isRelative("parent", "2020-01-01", ctx.marriageDate), true);
const pre = G.classifyGift({ amount: 500000, date: "2024-05-14", relation: "spouse", viaOther: true }, ctx);
assert.ok(/before the wedding/.test(pre.summary) && pre.confidence === "medium" && !pre.clubbedToGiver);
const post = G.classifyGift({ amount: 600000, date: "2024-09-09", relation: "spouse" }, ctx);
assert.ok(post.clubbedToGiver && post.taxableToReceiver === 0);
assert.strictEqual(G.classifyGift({ amount: 30000, date: "2024-09-09", relation: "other" }, ctx).taxableToReceiver, 0, "up to ₹50,000 is fine");
assert.strictEqual(G.classifyGift({ amount: 200000, date: "2024-09-09", relation: "other" }, ctx).taxableToReceiver, 200000, "non-relative above ₹50,000");
assert.ok(/loan/i.test(G.classifyGift({ amount: 500000, date: "2024-05-14", relation: "other", repaymentExpected: true }, ctx).summary));
assert.strictEqual(G.classifyGift({ amount: 150000, date: "2024-09-09", relation: "parent" }, ctx).clubbedToGiver, false, "no clubbing for gifts to parents");

// ITR-1 can carry long-term gains up to ₹1L (to FY 2023-24) and ₹1.25L after; it was wrongly refused before
const itr1 = (fy, brokers) => audit({ fy, person: "T", filed: { form: "ITR-1", regime: "new", grossSalary: 900000, totalTax: 0, taxesPaid: 0 }, evidence: { brokers } }).findings.map((f) => f.id);
assert.ok(!itr1("2023-24", { ltcgBefore: 25000 }).includes("wrong-form"), "₹25,000 of long-term gains fits ITR-1");
assert.ok(itr1("2023-24", { ltcgBefore: 150000 }).includes("wrong-form"), "above ₹1L it does not");
assert.ok(itr1("2024-25", { ltcgAfter: 5000, stcgAfter: 1000 }).includes("wrong-form"), "any short-term gain needs ITR-2");
const proof = audit({ fy: "2023-24", person: "T", filed: { form: "ITR-2", regime: "old", grossSalary: 2000000, exemptAllowances: 100000, exemptBreakup: { hra: 100000 }, deductions: { "80GGC": 100000 }, totalTax: 0, taxesPaid: 0, foreignAssetsDeclared: true }, evidence: { rent: { paid: 0 }, donations: [{ amount: 100000, debitDate: "2024-06-01", recognisedParty: false }] } });
assert.strictEqual(proof.findings.filter((f) => f.proofNeeded).map((f) => f.id).sort().join(), "80ggc,hra-proof", "HRA and the donation are marked proof-needed");
// Negative amounts read "−₹579", never "₹-579"
const neg = audit({ fy: "2025-26", person: "T", filed: { form: "ITR-2", regime: "new", grossSalary: 900000, totalTax: 0, taxesPaid: 0 }, evidence: { brokers: { stcgAfter: 30000, intraday: -579 } } });
const ge = neg.findings.map((f) => f.detail).join(" ");
assert.ok(/−₹579/.test(ge) && !/₹-/.test(ge), "negative amounts are formatted with the minus first");
console.log("tax law, remedies and gifts tests passed");

// ── residency (moving abroad) ──
const Res = require("../tools/tax/residency.js");
const tenYears = Array.from({ length: 10 }, () => ({ resident: true, days: 330 }));
assert.strictEqual(Res.latestDepartureForNonResident("2026-27"), "2026-09-28", "day 181 of FY 2026-27");
assert.strictEqual(Res.daysInIndiaForDeparture("2026-27", "2026-09-28"), 181);
assert.strictEqual(Res.daysInIndiaForDeparture("2026-27", "2027-01-15"), 290);
let rs = Res.residentialStatus({ daysInIndia: 290, daysPrev4: 1300, citizen: true, leftForEmployment: true, prevYears: tenYears });
assert.strictEqual(rs.status, "ROR"); assert.ok(rs.globalIncomeTaxed, "year of departure after the cut-off: worldwide income is taxed in India");
rs = Res.residentialStatus({ daysInIndia: 120, daysPrev4: 1300, citizen: true, leftForEmployment: true, prevYears: tenYears });
assert.strictEqual(rs.status, "NR", "a citizen leaving for employment is tested on 182 days only, not 60");
rs = Res.residentialStatus({ daysInIndia: 120, daysPrev4: 1300, citizen: false, prevYears: tenYears });
assert.strictEqual(rs.status, "ROR", "a non-citizen is caught by the 60 + 365 test");
rs = Res.residentialStatus({ daysInIndia: 200, daysPrev4: 400, citizen: true, prevYears: [...Array(9)].map(() => ({ resident: false, days: 20 })).concat([{ resident: true, days: 300 }]) });
assert.strictEqual(rs.status, "RNOR", "non-resident in 9 of the previous 10 years");
rs = Res.residentialStatus({ daysInIndia: 130, daysPrev4: 400, citizen: true, visiting: true, indianIncome: 2000000, prevYears: tenYears });
assert.strictEqual(rs.status, "RNOR", "citizen visiting with Indian income over ₹15L: 120-day test, RNOR");
rs = Res.residentialStatus({ daysInIndia: 10, citizen: true, indianIncome: 2000000, taxedElsewhere: false, prevYears: tenYears });
assert.strictEqual(rs.status, "RNOR", "deemed resident when taxed nowhere");
assert.ok(Law.byId("residency-india") && Law.byId("uk-nic-dcc") && Law.byId("uk-fig"), "relocation rules are in the register");
assert.strictEqual(G.clubbingShare({ fromSpouse: 300000, fromOthers: 100000 }), 0.75, "club only the part traceable to the spouse's money");
assert.strictEqual(G.clubbingShare({ fromSpouse: 0, fromOthers: 500000 }), 0);
assert.strictEqual(G.clubbingShare({}), 0);
console.log("residency tests passed");
