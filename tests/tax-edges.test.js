// Edge cases for the tax engine, written from the Income-tax Act with the working beside each figure.
// Added where the mutation test (tools/mutation-test.js) showed the earlier tests would not notice a break.
// "policy" marks a point where the engine follows the return utility's approach rather than settled law.
const assert = require("assert");
const { engine: E, gains: G } = require("../tax-core.js");
const L = 100000, cess = (t) => Math.round(t * 1.04);
const tax = (p) => E.computeTax(p).totalTax;

// ── Chapter VI-A caps (old regime) ──
{
  const c = E.capDeductions({ "80C": 2 * L, "80CCD1B": 80000, "80D_self": 40000, "80D_parents": 60000, "80DDB": 70000, "80TTA": 15000, "80GGC": 5000, "80G": 1000, "80CCD2": 1 * L, homeLoanInterest: 3 * L }, { parentsSenior: true, basic: 6 * L });
  assert.deepStrictEqual([c["80C"], c["80CCD1B"], c["80D"], c["80DDB"], c["80TTA"], c["80GGC"], c["80G"], c["80CCD2"], c.homeLoanInterest], [150000, 50000, 25000 + 50000, 40000, 10000, 5000, 1000, 60000, 200000], "each deduction at its cap (80CCD2 old regime: 10% of ₹6L basic)");
  assert.strictEqual(c.total, 591000, "the capped total");
  assert.strictEqual(E.capDeductions({ "80DDB": 1.2 * L, patientSenior: true }).ded80DDB ?? E.capDeductions({ "80DDB": 1.2 * L, patientSenior: true })["80DDB"], 1 * L, "80DDB for a senior patient: ₹1L");
  assert.strictEqual(E.capDeductions({ "80D_self": 60000 }, { selfSenior: true })["80D"], 50000, "80D for a senior: ₹50,000");
  assert.strictEqual(E.capDeductions({ "80TTA": 4000, homeLoanInterest: 1.5 * L })["80TTA"] + E.capDeductions({ homeLoanInterest: 1.5 * L }).homeLoanInterest, 4000 + 1.5 * L, "below the cap, the amount paid");
}

// ── HRA, sec 10(13A): least of HRA received, rent − 10% of basic, 50% (metro) / 40% of basic ──
assert.strictEqual(E.hraExemption({ hraReceived: 3 * L, rentPaid: 4 * L, basic: 6 * L, metro: true }), 3 * L, "metro: least of ₹3L, ₹3.4L, ₹3L");
assert.strictEqual(E.hraExemption({ hraReceived: 3 * L, rentPaid: 4 * L, basic: 6 * L, metro: false }), 2.4 * L, "non-metro: 40% of basic");
assert.strictEqual(E.hraExemption({ hraReceived: 3 * L, rentPaid: 2 * L, basic: 6 * L, metro: true }), 1.4 * L, "rent − 10% of basic");
assert.strictEqual(E.hraExemption({ hraReceived: 3 * L, rentPaid: 50000, basic: 6 * L }), 0, "rent below 10% of basic: nothing");
assert.strictEqual(E.hraExemption({ hraReceived: 3 * L, rentPaid: 0, basic: 6 * L }), 0, "no rent: nothing");

// ── Salary, professional tax and other income ──
assert.strictEqual(tax({ fy: "2025-26", regime: "old", grossSalary: 10.525 * L, professionalTax: 2500 }), cess(112500), "old regime: ₹2,500 professional tax deducted (₹10L taxable)");
assert.strictEqual(tax({ fy: "2025-26", regime: "old", grossSalary: 10.525 * L, professionalTax: 5000 }), cess(112500), "professional tax capped at ₹2,500");
assert.strictEqual(tax({ fy: "2025-26", regime: "new", grossSalary: 16.75 * L, professionalTax: 2500 }), cess(120000), "new regime: no professional-tax deduction");
assert.strictEqual(tax({ fy: "2025-26", regime: "new", grossSalary: 15.75 * L, otherIncome: 50000, speculativeIncome: 50000 }), cess(120000), "interest and intraday income are slab income (₹16L)");
const out = E.computeTax({ fy: "2025-26", regime: "new", grossSalary: 20.75 * L, gains: { stcgAfter: 1 * L, ltcgAfter: 2 * L } });
assert.deepStrictEqual([out.salaryIncome, out.grossTotalIncome, out.totalIncome], [20 * L, 23 * L, 23 * L], "income lines: total income includes the whole ₹2L long-term gain (sec 112A charges 12.5% only above ₹1.25L)");
// The 87A limit is tested on total income including long-term gains: ₹11.5L slab income + ₹1L LTCG = ₹12.5L, over ₹12L
assert.strictEqual(tax({ fy: "2025-26", regime: "new", grossSalary: 12.25 * L, gains: { ltcgAfter: 1 * L } }), cess(50000),
  "slab tax ₹55,000 on ₹11.5L; total ₹12.5L is over the limit, so marginal relief caps slab tax at the ₹50,000 above ₹12L; the LTCG itself is within ₹1.25L");

// ── Old-regime deductions and employer NPS (80CCD(2): 10% of basic old, 14% new from FY 2024-25) ──
assert.strictEqual(tax({ fy: "2025-26", regime: "old", grossSalary: 10.5 * L, basic: 6 * L, deductions: 1.5 * L, employerNps: 50000 }), cess(12500 + 60000), "₹10L − ₹1.5L − ₹50,000 NPS = ₹8L");
assert.strictEqual(tax({ fy: "2025-26", regime: "old", grossSalary: 10.5 * L, basic: 6 * L, deductions: 1.5 * L, employerNps: 1 * L }), cess(12500 + 58000), "NPS capped at 10% of basic (₹60,000): ₹7.9L taxable");
assert.strictEqual(tax({ fy: "2025-26", regime: "new", grossSalary: 17.75 * L, basic: 10 * L, employerNps: 1.5 * L }), cess(20000 + 40000 + 54000), "new regime: NPS capped at 14% (₹1.4L); ₹17L − ₹1.4L = ₹15.6L");

// ── Rebate and special-rate gains before FY 2025-26 (policy: the rebate covered them until the Finance Act 2025 amendment; contested, confirm with a CA) ──
assert.strictEqual(tax({ fy: "2024-25", regime: "new", grossSalary: 6.75 * L, gains: { stcgAfter: 50000 } }), 0, "₹6.5L total: ₹15,000 slab + ₹10,000 STCG, rebated");

// ── Equity gains split at 23-Jul-2024 (FY 2024-25; policy: the ₹1.25L exemption goes to the earlier gains first, as the return utility does) ──
assert.strictEqual(tax({ fy: "2024-25", regime: "new", grossSalary: 20.75 * L, gains: { ltcgBefore: 1 * L, ltcgAfter: 1 * L, stcgBefore: 50000, stcgAfter: 50000 } }), cess(290000 + 9375 + 7500 + 10000),
  "LT ₹1L before uses ₹1L of the exemption; ₹75,000 after at 12.5%; ST ₹50,000 at 15% and ₹50,000 at 20%");
assert.strictEqual(tax({ fy: "2024-25", regime: "new", grossSalary: 20.75 * L, gains: { stcgBefore: -30000, ltcgBefore: 80000, ltcgAfter: 120000 } }), cess(290000 + 5625),
  "₹30,000 ST loss against ₹2L LT (40/60 split: ₹68,000 before, ₹1,02,000 after); exemption ₹68,000 + ₹57,000; ₹45,000 at 12.5%");
assert.strictEqual(tax({ fy: "2023-24", regime: "new", grossSalary: 15.5 * L, gains: { ltcgBefore: 1.5 * L, stcgBefore: 1 * L } }), cess(150000 + 5000 + 15000), "FY 2023-24: LTCG 10% above ₹1L, STCG 15%");

// ── Surcharge at the top: new regime capped at 25%, old regime 37% above ₹5Cr; special-rate gains capped at 15% ──
assert.strictEqual(tax({ fy: "2025-26", regime: "new", grossSalary: 600 * L + 75000 }), cess(17580000 * 1.25), "₹6Cr new regime: 25% (not 37%)");
assert.strictEqual(tax({ fy: "2025-26", regime: "old", grossSalary: 600 * L + 50000 }), cess(17812500 * 1.37), "₹6Cr old regime: 37%");
assert.strictEqual(tax({ fy: "2025-26", regime: "new", grossSalary: 100.75 * L, gains: { ltcgAfter: 151.25 * L } }), cess(2580000 + 1875000 + 2580000 * 0.25 + 1875000 * 0.15),
  "₹2.5Cr with ₹1.5Cr long-term gains: 25% surcharge on slab tax, 15% on the gains tax");
assert.strictEqual(tax({ fy: "2025-26", regime: "new", grossSalary: 50 * L + 75000 }), cess(1080000), "exactly ₹50L: no surcharge");

// ── Holding periods (sec 2(42A)): foreign shares and other non-equity assets 24 months ──
{
  const sell = (o, today = "2026-10-20") => G.taxIfSold([{ kind: "mf", name: "F", owner: "Me", cat: "equity", qty: 1, cost: 1 * L, price: 1.5 * L, date: "2020-01-01", ...o }], today, { slab: { Me: 30 }, exemptionLeft: { Me: 0 } })[0];
  assert.strictEqual(sell({ kind: "us", cat: "foreignShares", date: "2024-10-19" }).tax, cess(50000 * 0.125), "US shares held 24 months and a day: 12.5%");
  assert.strictEqual(sell({ kind: "us", cat: "foreignShares", date: "2024-10-20" }).tax, cess(50000 * 0.30), "US shares held exactly 24 months: slab rate");
  assert.strictEqual(sell({ cat: "hybrid", date: "2024-01-01" }).tax, cess(50000 * 0.125), "equity-oriented hybrid: equity rules");
  assert.strictEqual(sell({ cat: "unlistedOther", date: "2025-01-01" }).tax, cess(50000 * 0.30), "gold/overseas fund under 24 months: slab rate");
  assert.strictEqual(G.taxIfSold([{ kind: "mf", name: "F", owner: "Wife", cat: "debt", qty: 1, cost: 1 * L, price: 1.5 * L, date: "2024-01-01" }], "2026-10-20", {})[0].tax, cess(50000 * 0.30), "no slab given: 30% (the cautious figure)");
  const mix = G.taxIfSold([
    { kind: "mf", name: "M", owner: "Me", cat: "equity", qty: 1, cost: 1 * L, price: 2 * L, date: "2020-01-01" },
    { kind: "mf", name: "M", owner: "Me", cat: "equity", qty: 1, cost: 1 * L, price: 1.3 * L, date: "2026-06-01" },
  ], "2026-10-20", { slab: { Me: 30 }, exemptionLeft: { Me: 50000 } })[0];
  assert.deepStrictEqual([mix.gain, mix.gainShort, mix.gainLong, mix.exemptUsed, mix.tax], [130000, 30000, 100000, 50000, cess(30000 * 0.2 + 50000 * 0.125)], "one fund, a long and a short lot: ₹50,000 of ₹1L long-term is free");
}
// ── Gaps the mutation test found after the first round ──
assert.strictEqual(E.hraExemption({ hraReceived: 4 * L, rentPaid: 5 * L, basic: 6 * L, metro: true }), 3 * L, "metro: 50% of basic is the least (₹3L of ₹4L, ₹4.4L, ₹3L)");
assert.strictEqual(tax({ fy: "2024-25", regime: "new", grossSalary: 20.75 * L, gains: { ltcgBefore: 2 * L, ltcgAfter: 1 * L } }), cess(290000 + 7500 + 12500),
  "FY 2024-25: ₹2L before 23 July uses the whole ₹1.25L, ₹75,000 at 10%; ₹1L after at 12.5%");
// Surcharge relief with long-term gains in the income (policy: the gains stay as they are, the slab income is what the ₹50L test trims)
assert.strictEqual(tax({ fy: "2025-26", regime: "new", grossSalary: 40.75 * L, gains: { ltcgAfter: 10.1 * L } }), cess(887625 + 10000),
  "₹40L slab + ₹10.1L LTCG = ₹50.1L: slab ₹7,80,000 + LTCG ₹1,10,625 + surcharge capped at ₹7,000 (tax at ₹50L ₹8,87,625 + ₹10,000)");
{
  const rows = G.taxIfSold([
    { kind: "mf", name: "Debt", owner: "Me", cat: "debt", qty: 1, cost: 1 * L, price: 1.5 * L, date: "2024-01-01" },
    { kind: "mf", name: "Old debt", owner: "Me", cat: "debt", qty: 1, cost: 1 * L, price: 1.2 * L, date: "2020-01-01" },
    { kind: "stock", name: "Acme", symbol: "ACME", owner: "Me", cat: "equity", qty: 1, cost: 1 * L, price: 1.1 * L, date: "2026-05-24", dateKnown: false },
  ], "2026-10-20", { slab: { Me: 30 }, exemptionLeft: { Me: 0 } });
  assert.deepStrictEqual(rows.map((r) => r.gain), [50000, 20000, 10000], "the gain on each holding, whatever its tax treatment");
  assert.deepStrictEqual([rows[1].gainLong, rows[1].tax], [20000, cess(20000 * 0.125)], "a pre-April-2023 debt fund held 24+ months is long-term");
}
console.log("tax edge cases passed");
