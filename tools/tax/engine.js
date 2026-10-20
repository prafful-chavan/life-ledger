/**
 * Life Ledger — Indian personal income-tax engine (pure; no I/O).
 *
 * Year-by-year rules from FY 2018-19 to FY 2026-27 for a resident individual below 60: slabs under both regimes, standard
 * deduction, 87A rebate (with the new-regime marginal relief), surcharge, cess, special rates on listed equity gains (the
 * 23-Jul-2024 rate change), deduction caps, HRA, and the eligibility rules a return is checked against.
 * Rates are as the author understood them; every number lives in RULES so it is easy to verify. Planning aid — a CA confirms.
 */
const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const r0 = (v) => Math.round(v);
const L = 100000;

const OLD_SLABS = [[2.5 * L, 0], [5 * L, 5], [10 * L, 20], [Infinity, 30]];
const NEW_115BAC_2020 = [[2.5 * L, 0], [5 * L, 5], [7.5 * L, 10], [10 * L, 15], [12.5 * L, 20], [15 * L, 25], [Infinity, 30]];
const NEW_2023 = [[3 * L, 0], [6 * L, 5], [9 * L, 10], [12 * L, 15], [15 * L, 20], [Infinity, 30]];
const NEW_2024 = [[3 * L, 0], [7 * L, 5], [10 * L, 10], [12 * L, 15], [15 * L, 20], [Infinity, 30]];
const NEW_2025 = [[4 * L, 0], [8 * L, 5], [12 * L, 10], [16 * L, 15], [20 * L, 20], [24 * L, 25], [Infinity, 30]];

/** Per financial year. `newRegime: null` = the regime did not exist yet. */
const YEARS = {
  "2018-19": { old: { std: 40000, rebateUpTo: 3.5 * L, rebateMax: 2500 }, newRegime: null },
  "2019-20": { old: { std: 50000, rebateUpTo: 5 * L, rebateMax: 12500 }, newRegime: null },
  "2020-21": { old: { std: 50000, rebateUpTo: 5 * L, rebateMax: 12500 }, newRegime: { slabs: NEW_115BAC_2020, std: 0, rebateUpTo: 5 * L, rebateMax: 12500, cap80CCD2Pct: 10 }, defaultRegime: "old" },
  "2021-22": { old: { std: 50000, rebateUpTo: 5 * L, rebateMax: 12500 }, newRegime: { slabs: NEW_115BAC_2020, std: 0, rebateUpTo: 5 * L, rebateMax: 12500, cap80CCD2Pct: 10 }, defaultRegime: "old" },
  "2022-23": { old: { std: 50000, rebateUpTo: 5 * L, rebateMax: 12500 }, newRegime: { slabs: NEW_115BAC_2020, std: 0, rebateUpTo: 5 * L, rebateMax: 12500, cap80CCD2Pct: 10 }, defaultRegime: "old" },
  "2023-24": { old: { std: 50000, rebateUpTo: 5 * L, rebateMax: 12500 }, newRegime: { slabs: NEW_2023, std: 50000, rebateUpTo: 7 * L, rebateMax: 25000, marginalRelief: true, cap80CCD2Pct: 10 }, defaultRegime: "new" },
  "2024-25": { old: { std: 50000, rebateUpTo: 5 * L, rebateMax: 12500 }, newRegime: { slabs: NEW_2024, std: 75000, rebateUpTo: 7 * L, rebateMax: 25000, marginalRelief: true, cap80CCD2Pct: 14 }, defaultRegime: "new" },
  "2025-26": { old: { std: 50000, rebateUpTo: 5 * L, rebateMax: 12500 }, newRegime: { slabs: NEW_2025, std: 75000, rebateUpTo: 12 * L, rebateMax: 60000, marginalRelief: true, cap80CCD2Pct: 14 }, defaultRegime: "new" },
  // FY 2026-27: assumed unchanged from FY 2025-26 (first year of the Income-tax Act, 2025). Confirm with a CA.
  "2026-27": { old: { std: 50000, rebateUpTo: 5 * L, rebateMax: 12500 }, newRegime: { slabs: NEW_2025, std: 75000, rebateUpTo: 12 * L, rebateMax: 60000, marginalRelief: true, cap80CCD2Pct: 14 }, defaultRegime: "new", assumed: true },
};

const RULES = {
  cess: 4,
  equityRateChange: "2024-07-23",
  /** Listed equity / equity MF (STT paid). */
  equity: { stcgBefore: 15, stcgAfter: 20, ltcgBefore: 10, ltcgAfter: 12.5, exemptionBefore: 1 * L, exemptionFromFY2425: 1.25 * L },
  deductions: {
    "80C": 1.5 * L, "80CCD1B": 50000, "80TTA": 10000, "80D_self": 25000, "80D_self_senior": 50000, "80D_parents": 25000, "80D_parents_senior": 50000,
    "80D_preventive": 5000, "80DDB": 40000, "80DDB_senior": 1 * L, "80CCD2_oldPct": 10, homeLoanInterestSelfOccupied: 2 * L, landlordPanAbove: 1 * L,
  },
  /** Rule 11DD — the only illnesses that qualify for 80DDB (neurological ones need ≥40% certified disability). */
  rule11DD: ["dementia", "dystonia musculorum deformans", "motor neuron disease", "ataxia", "chorea", "hemiballismus", "aphasia", "parkinson", "malignant cancer", "aids", "chronic renal failure", "haemophilia", "thalassaemia"],
  /** Surcharge on total income (special-rate equity gains capped at 15%; new regime capped at 25%). Marginal relief not modelled. */
  surcharge: [[50 * L, 0], [100 * L, 10], [200 * L, 15], [500 * L, 25], [Infinity, 37]],
  itr1: { maxIncome: 50 * L, maxLtcg112AFromAY2526: 1.25 * L },
  blackMoneyPenaltyThreshold: 20 * L, // foreign assets (non-immovable) up to this value: no ₹10L non-disclosure penalty (from 1-Oct-2024)
};

const fyOf = (iso) => { const y = +String(iso).slice(0, 4), m = +String(iso).slice(5, 7); return m >= 4 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`; };
const ayOf = (fy) => { const y = +fy.slice(0, 4) + 1; return `${y}-${String(y + 1).slice(2)}`; };
const yearRules = (fy) => { const y = YEARS[fy]; if (!y) throw new Error(`No tax rules for FY ${fy}`); return y; };

function slabTax(taxable, slabs) {
  let tax = 0, prev = 0;
  for (const [limit, rate] of slabs) {
    if (taxable > prev) tax += (Math.min(taxable, limit) - prev) * (rate / 100);
    prev = limit;
  }
  return tax;
}
const marginalRate = (taxable, slabs) => { for (const [limit, rate] of slabs) if (taxable <= limit) return rate; return slabs[slabs.length - 1][1]; };

/** Equity gains tax for one year. gains: { stcgBefore, stcgAfter, ltcgBefore, ltcgAfter } (split at 23-Jul-2024; earlier years use *Before). */
function equityGainsTax(fy, g = {}) {
  const e = RULES.equity, stB = num(g.stcgBefore), stA = num(g.stcgAfter);
  const ltB = num(g.ltcgBefore), ltA = num(g.ltcgAfter);
  const after2425 = +fy.slice(0, 4) >= 2024;
  let exemption = after2425 ? e.exemptionFromFY2425 : e.exemptionBefore;
  // Short-term losses offset short-term gains first, then long-term (losses never carry into slab income).
  let st = stB + stA, lt = ltB + ltA;
  if (st < 0) { lt += st; st = 0; }
  if (lt < 0) lt = 0;
  // Apply the exemption to the lower-rate (earlier) long-term gains first, the way the return utility does.
  const ltShareB = ltB + ltA > 0 ? Math.max(0, ltB) / (Math.max(0, ltB) + Math.max(0, ltA)) : 0;
  let ltBefore = lt * ltShareB, ltAfter = lt - ltBefore;
  const useB = Math.min(exemption, ltBefore); ltBefore -= useB; exemption -= useB; ltAfter = Math.max(0, ltAfter - exemption);
  const stShareB = stB + stA > 0 ? Math.max(0, stB) / (Math.max(0, stB) + Math.max(0, stA)) : 0;
  const stBefore = st * stShareB, stAfter = st - stBefore;
  // The return utility rounds each rate bucket separately.
  const tax = r0(stBefore * e.stcgBefore / 100) + r0(stAfter * (after2425 ? e.stcgAfter : e.stcgBefore) / 100) + r0(ltBefore * e.ltcgBefore / 100) + r0(ltAfter * (after2425 ? e.ltcgAfter : e.ltcgBefore) / 100);
  return { tax, taxableST: st, taxableLT: Math.max(0, ltBefore + ltAfter) };
}

/** HRA exemption u/s 10(13A): least of HRA received, rent − 10% of salary (basic + DA), 50%/40% of salary. */
function hraExemption({ hraReceived, rentPaid, basic, metro }) {
  if (!(num(rentPaid) > 0)) return 0;
  return Math.max(0, Math.min(num(hraReceived), num(rentPaid) - 0.1 * num(basic), (metro ? 0.5 : 0.4) * num(basic)));
}

/** Caps for each deduction the old regime allows (input is the amount actually paid/invested). */
function capDeductions(input = {}, { parentsSenior = false, selfSenior = false, basic = 0 } = {}) {
  const d = RULES.deductions, out = {};
  out["80C"] = Math.min(d["80C"], num(input["80C"]));
  out["80CCD1B"] = Math.min(d["80CCD1B"], num(input["80CCD1B"]));
  out["80D"] = Math.min(selfSenior ? d["80D_self_senior"] : d["80D_self"], num(input["80D_self"])) + Math.min(parentsSenior ? d["80D_parents_senior"] : d["80D_parents"], num(input["80D_parents"]));
  out["80DDB"] = Math.min(input.patientSenior ? d["80DDB_senior"] : d["80DDB"], num(input["80DDB"]));
  out["80TTA"] = Math.min(d["80TTA"], num(input["80TTA"]));
  out["80GGC"] = num(input["80GGC"]);
  out["80G"] = num(input["80G"]);
  out["80CCD2"] = Math.min(num(input["80CCD2"]), (d["80CCD2_oldPct"] / 100) * num(basic) || Infinity);
  out.homeLoanInterest = Math.min(d.homeLoanInterestSelfOccupied, num(input.homeLoanInterest));
  out.total = Object.values(out).reduce((a, b) => a + b, 0);
  return out;
}

/**
 * Tax for one person for one year under one regime.
 * p: { fy, regime: "old"|"new", grossSalary, exemptAllowances (old: HRA/LTA etc.; new: only those the new regime allows),
 *      professionalTax, otherIncome (interest, dividends, rent net), speculativeIncome, deductions (already capped),
 *      employerNps (80CCD2, allowed in both), gains: { stcgBefore, stcgAfter, ltcgBefore, ltcgAfter } }
 */
function computeTax(p) {
  const y = yearRules(p.fy);
  const regime = p.regime || y.defaultRegime || "old";
  if (regime === "new" && !y.newRegime) throw new Error(`New regime did not exist in FY ${p.fy}`);
  const cfg = regime === "new" ? y.newRegime : { ...y.old, slabs: OLD_SLABS };
  const salaryIncome = Math.max(0, num(p.grossSalary) - num(p.exemptAllowances) - cfg.std - (regime === "old" ? Math.min(2500, num(p.professionalTax)) : 0));
  const grossTotal = salaryIncome + num(p.otherIncome) + num(p.speculativeIncome);
  const npsCapPct = regime === "new" ? y.newRegime.cap80CCD2Pct : RULES.deductions["80CCD2_oldPct"];
  const nps = Math.min(num(p.employerNps), num(p.basic) ? (npsCapPct / 100) * num(p.basic) : num(p.employerNps));
  const chapterVIA = regime === "old" ? num(p.deductions) + nps : nps;
  const g = equityGainsTax(p.fy, p.gains);
  // Sec 288A: total income is rounded to the nearest ₹10; the rounding sits in the slab-rate part.
  const totalIncome = Math.round((Math.max(0, grossTotal - chapterVIA) + g.taxableST + g.taxableLT) / 10) * 10;
  const normalIncome = Math.max(0, totalIncome - g.taxableST - g.taxableLT);
  let normalTax = slabTax(normalIncome, cfg.slabs);
  let specialTax = g.tax;
  // 87A: total income (including gains) must be within the limit; the rebate never covers special-rate equity gains from FY 2025-26.
  let rebate = 0;
  if (totalIncome <= cfg.rebateUpTo) rebate = Math.min(cfg.rebateMax, normalTax + (+p.fy.slice(0, 4) >= 2025 ? 0 : specialTax));
  else if (regime === "new" && cfg.marginalRelief) {
    const excess = totalIncome - cfg.rebateUpTo;
    if (normalTax > excess) rebate = normalTax - excess; // tax may not exceed the income above the rebate limit
  }
  const beforeSurcharge = Math.max(0, normalTax + specialTax - rebate);
  let surchargePct = 0;
  for (const [limit, pct] of RULES.surcharge) if (totalIncome > limit) surchargePct = pct;
  if (regime === "new") surchargePct = Math.min(25, surchargePct);
  const surcharge = normalTax * surchargePct / 100 + specialTax * Math.min(15, surchargePct) / 100;
  const cess = (beforeSurcharge + surcharge) * RULES.cess / 100;
  return {
    fy: p.fy, regime, salaryIncome: r0(salaryIncome), grossTotalIncome: r0(grossTotal + g.taxableST + g.taxableLT), chapterVIA: r0(chapterVIA),
    totalIncome: r0(totalIncome), normalIncome: r0(normalIncome), normalTax: r0(normalTax), specialRateTax: r0(specialTax), rebate87A: r0(rebate),
    surcharge: r0(surcharge), cess: r0(cess), totalTax: r0(beforeSurcharge + surcharge + cess), marginalRatePct: marginalRate(normalIncome, cfg.slabs),
    assumedRules: !!y.assumed,
  };
}

/** Both regimes side by side for the same person-year. `old` and `new` override fields per regime. */
function compareRegimes(base, { old = {}, newer = {} } = {}) {
  const y = yearRules(base.fy);
  const o = computeTax({ ...base, ...old, regime: "old" });
  const n = y.newRegime ? computeTax({ ...base, ...newer, regime: "new" }) : null;
  const better = !n || o.totalTax < n.totalTax ? "old" : "new";
  return { old: o, new: n, better, saving: n ? Math.abs(o.totalTax - n.totalTax) : 0 };
}

module.exports = { YEARS, RULES, fyOf, ayOf, yearRules, slabTax, marginalRate, equityGainsTax, hraExemption, capDeductions, computeTax, compareRegimes };
