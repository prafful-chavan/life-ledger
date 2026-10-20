/**
 * Life Ledger — independent reference cases for the tax engine (UMD: Node tests and the browser self-check).
 *
 * Each expected figure was written down from the source BEFORE the engine was run against it, so a case checks the
 * engine against the law, not against itself. Sources:
 *   official   — a figure printed by the Government (Budget speech tables, CBDT FAQ). Strongest.
 *   statute    — worked by hand from the Act's own rates and thresholds; the working is in `why`.
 * `expected.totalTax` includes the 4% cess and is rounded to the rupee (the engine's totalTax; no sec 288B ₹10 rounding).
 * Inputs use the engine's fields; grossSalary = total income + the standard deduction of that regime/year.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerTaxOracle = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const L = 100000;
  const B25 = "Budget speech 2025-26 (1 Feb 2025), Annexure to Part B: tax on slabs, proposed, FY 2025-26";
  const B24 = "Budget speech 2025-26 (1 Feb 2025), Annexure to Part B: tax on slabs, present (= FY 2024-25 new regime)";
  const cess = (t) => Math.round(t * 1.04);
  const salaried = (fy, regime, totalIncome, std) => ({ fy, regime, grossSalary: totalIncome + std });

  const CASES = [
    // ── FY 2025-26 new regime: the Finance Minister's table (tax on slabs; the ₹12L rebate makes it nil up to ₹12L) ──
    { id: "fy2526-new-8L", source: "official", ref: B25, input: salaried("2025-26", "new", 8 * L, 75000), expected: { totalTax: 0 }, why: "₹20,000 on slabs, fully rebated (income ≤ ₹12L)" },
    { id: "fy2526-new-12L", source: "official", ref: B25, input: salaried("2025-26", "new", 12 * L, 75000), expected: { totalTax: 0 }, why: "₹60,000 on slabs, fully rebated" },
    { id: "fy2526-new-16L", source: "official", ref: B25, input: salaried("2025-26", "new", 16 * L, 75000), expected: { totalTax: cess(120000) }, why: "₹1,20,000 on slabs + 4% cess" },
    { id: "fy2526-new-20L", source: "official", ref: B25, input: salaried("2025-26", "new", 20 * L, 75000), expected: { totalTax: cess(200000) }, why: "₹2,00,000 + cess" },
    { id: "fy2526-new-24L", source: "official", ref: B25, input: salaried("2025-26", "new", 24 * L, 75000), expected: { totalTax: cess(300000) }, why: "₹3,00,000 + cess" },
    { id: "fy2526-new-50L", source: "official", ref: B25, input: salaried("2025-26", "new", 50 * L, 75000), expected: { totalTax: cess(1080000) }, why: "₹10,80,000 + cess; surcharge only above ₹50L" },
    { id: "fy2526-new-salary-12.75L", source: "official", ref: "Budget speech 2025-26: no tax for salaried up to ₹12.75 lakh (₹75,000 standard deduction)", input: { fy: "2025-26", regime: "new", grossSalary: 12.75 * L }, expected: { totalTax: 0 }, why: "₹12.75L − ₹75,000 = ₹12L, within the rebate" },
    // ── FY 2024-25 new regime: the same table's "present" column ──
    { id: "fy2425-new-8L", source: "official", ref: B24, input: salaried("2024-25", "new", 8 * L, 75000), expected: { totalTax: cess(30000) }, why: "₹30,000 on slabs; above the ₹7L rebate limit" },
    { id: "fy2425-new-12L", source: "official", ref: B24, input: salaried("2024-25", "new", 12 * L, 75000), expected: { totalTax: cess(80000) }, why: "₹80,000 + cess" },
    { id: "fy2425-new-16L", source: "official", ref: B24, input: salaried("2024-25", "new", 16 * L, 75000), expected: { totalTax: cess(170000) }, why: "₹1,70,000 + cess" },
    { id: "fy2425-new-20L", source: "official", ref: B24, input: salaried("2024-25", "new", 20 * L, 75000), expected: { totalTax: cess(290000) }, why: "₹2,90,000 + cess" },
    { id: "fy2425-new-24L", source: "official", ref: B24, input: salaried("2024-25", "new", 24 * L, 75000), expected: { totalTax: cess(410000) }, why: "₹4,10,000 + cess" },
    { id: "fy2425-new-50L", source: "official", ref: B24, input: salaried("2024-25", "new", 50 * L, 75000), expected: { totalTax: cess(1190000) }, why: "₹11,90,000 + cess" },
    { id: "fy2425-new-salary-7.75L", source: "official", ref: "Budget speech 2024-25 (23 Jul 2024): salaried in the new regime save up to ₹17,500; no tax up to ₹7.75L with the ₹75,000 standard deduction", input: { fy: "2024-25", regime: "new", grossSalary: 7.75 * L }, expected: { totalTax: 0 }, why: "₹7L total income, within the rebate" },
    // ── FY 2023-24 new regime: Budget speech 2023-24 examples ──
    { id: "fy2324-new-9L", source: "official", ref: "Budget speech 2023-24 (1 Feb 2023), para 155: income of ₹9 lakh pays only ₹45,000", input: salaried("2023-24", "new", 9 * L, 50000), expected: { totalTax: cess(45000) }, why: "₹15,000 + ₹30,000 on slabs, + cess" },
    { id: "fy2324-new-15L", source: "official", ref: "Budget speech 2023-24, para 155: income of ₹15 lakh pays only ₹1.5 lakh", input: salaried("2023-24", "new", 15 * L, 50000), expected: { totalTax: cess(150000) }, why: "₹1,50,000 + cess" },
    { id: "fy2324-new-7L", source: "official", ref: "Budget speech 2023-24: no tax up to ₹7 lakh in the new regime", input: salaried("2023-24", "new", 7 * L, 50000), expected: { totalTax: 0 }, why: "rebate up to ₹7L" },
    // ── New-regime marginal relief just above the rebate limit (sec 87A proviso) ──
    { id: "fy2526-relief-12.1L", source: "official", ref: "CBDT FAQs on the new tax regime (Feb 2025): income ₹12,10,000 → tax ₹61,500, marginal relief ₹51,500, tax ₹10,000", input: salaried("2025-26", "new", 12.1 * L, 75000), expected: { totalTax: cess(10000) }, why: "tax capped at the ₹10,000 above ₹12L" },
    { id: "fy2526-relief-12.5L", source: "statute", ref: "sec 87A proviso (Finance Act 2025)", input: salaried("2025-26", "new", 12.5 * L, 75000), expected: { totalTax: cess(50000) }, why: "slabs ₹20,000 + ₹40,000 + 15% of ₹50,000 = ₹67,500 > ₹50,000 above ₹12L, so ₹50,000" },
    { id: "fy2526-relief-ends-12.75L", source: "statute", ref: "sec 87A proviso: relief ends near ₹12,70,588", input: salaried("2025-26", "new", 12.75 * L, 75000), expected: { totalTax: cess(71250) }, why: "slabs ₹20,000 + ₹40,000 + 15% of ₹75,000 = ₹71,250 < ₹75,000 above ₹12L: no relief" },
    // ── Old regime (sec 87A ₹12,500 up to ₹5L; slabs 5/20/30) ──
    { id: "fy2526-old-5L", source: "statute", ref: "First Schedule, old regime slabs; sec 87A", input: salaried("2025-26", "old", 5 * L, 50000), expected: { totalTax: 0 }, why: "₹12,500 on slabs, rebated" },
    { id: "fy2526-old-6L", source: "statute", ref: "First Schedule, old regime slabs", input: salaried("2025-26", "old", 6 * L, 50000), expected: { totalTax: cess(32500) }, why: "₹12,500 + ₹20,000 (20% of ₹1L); no rebate above ₹5L" },
    { id: "fy2526-old-10L", source: "statute", ref: "First Schedule, old regime slabs", input: salaried("2025-26", "old", 10 * L, 50000), expected: { totalTax: cess(112500) }, why: "₹12,500 + ₹1,00,000" },
    // ── Equity gains (sec 111A / 112A, from 23-Jul-2024) ──
    { id: "fy2526-stcg-no-rebate", source: "statute", ref: "sec 87A as amended by Finance Act 2025: no rebate on tax at special rates (111A/112A)", input: { fy: "2025-26", regime: "new", grossSalary: 10.75 * L, gains: { stcgAfter: 1 * L } }, expected: { totalTax: cess(20000) }, why: "total ₹11L ≤ ₹12L: slab tax ₹40,000 rebated; 20% STCG on ₹1L stays" },
    { id: "fy2526-ltcg-above-exemption", source: "statute", ref: "sec 112A: 12.5% above ₹1.25L", input: { fy: "2025-26", regime: "new", grossSalary: 20.75 * L, gains: { ltcgAfter: 2.25 * L } }, expected: { totalTax: cess(200000 + 12500) }, why: "₹2,00,000 on ₹20L + 12.5% of ₹1L" },
    { id: "fy2526-stcl-against-ltcg", source: "statute", ref: "sec 70(3): short-term loss set off against long-term gains", input: { fy: "2025-26", regime: "new", grossSalary: 20.75 * L, gains: { stcgAfter: -50000, ltcgAfter: 3 * L } }, expected: { totalTax: cess(200000 + 15625) }, why: "₹3L − ₹50,000 = ₹2.5L; above ₹1.25L: ₹1.25L × 12.5% = ₹15,625" },
    // ── Surcharge (10% above ₹50L, 15% above ₹1Cr) with marginal relief at each threshold ──
    { id: "fy2526-surcharge-60L", source: "statute", ref: "First Schedule: surcharge 10% above ₹50L", input: salaried("2025-26", "new", 60 * L, 75000), expected: { totalTax: cess(1380000 * 1.1) }, why: "₹3,00,000 + 30% of ₹36L = ₹13,80,000; +10% surcharge ₹1,38,000; + cess" },
    { id: "fy2526-surcharge-relief-50.1L", source: "statute", ref: "First Schedule: marginal relief on surcharge (tax + surcharge may not exceed tax at ₹50L + the income above ₹50L)", input: salaried("2025-26", "new", 50.1 * L, 75000), expected: { totalTax: cess(1080000 + 10000) }, why: "slabs ₹10,83,000 + 10% would be ₹11,91,300; capped at ₹10,80,000 + ₹10,000 = ₹10,90,000" },
    { id: "fy2526-surcharge-1.2Cr", source: "statute", ref: "First Schedule: 15% above ₹1Cr", input: salaried("2025-26", "new", 120 * L, 75000), expected: { totalTax: cess(3180000 * 1.15) }, why: "₹31,80,000 on slabs + 15%; no relief (₹28,38,000 at ₹1Cr + ₹20L is far higher)" },
  ];

  /** Runs every case through `engine.computeTax`; returns { passed, failed: [{ id, expected, got }], total }. */
  function run(engine) {
    const failed = [];
    for (const c of CASES) {
      let got;
      try { got = engine.computeTax(c.input).totalTax; } catch (e) { got = `error: ${e.message}`; }
      if (got !== c.expected.totalTax) failed.push({ id: c.id, source: c.source, expected: c.expected.totalTax, got });
    }
    return { total: CASES.length, passed: CASES.length - failed.length, failed };
  }

  return { CASES, run };
});
