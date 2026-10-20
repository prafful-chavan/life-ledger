/**
 * Life Ledger — tax core (browser + Node). One file holds the whole personal-tax engine so the app and the tests share it:
 *   law        the register of rules with their source and confidence
 *   engine     slabs, rebate, surcharge, cess, equity gains, HRA, deductions, both regimes, FY 2018-19 to FY 2026-27
 *   remedies   revised return, updated return (ITR-U) cost, FAST-DS
 *   gifts      gifts, loans and spouse clubbing around the marriage date
 *   residency  Indian residential status for a move abroad
 *   audit      checks a filed return against the evidence
 *   planner    forward plan: regime, levers, advance tax, calendar
 * Pure: no DOM, no network, no personal data. Planning aid only — a CA confirms.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerTax = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  // ════════════════════════════ law ════════════════════════════
  const law = (function () {
  /**
   * Life Ledger — law register (data + checks, pure).
   *
   * Every rule the tax system relies on is listed here with where it comes from, how sure we are, and when it was last checked.
   * Nothing is "just known": the register is what a CA would call the file of authorities. `confidence`:
   *   "statute"   — read from or confirmed against the Act/Rules/CBDT notification text, or long-settled and stable
   *   "secondary" — taken from several consistent professional commentaries but not the official text; verify before acting
   *   "author"    — the author's understanding with no fresh source; verify
   * `lawStatus()` returns what needs re-checking (secondary/author rules, and anything older than `maxAgeDays`).
   */
  const VERIFIED = "2026-10-20";

  const LAW = [
    // ── framework ──
    { id: "act-transition", topic: "Which Act applies", rule: "Income earned up to 31-Mar-2026 (FY 2025-26 and earlier, assessment years up to 2026-27) is governed by the Income-tax Act, 1961. From 1-Apr-2026 the Income-tax Act, 2025 applies and replaces 'assessment year / previous year' with a single 'tax year' (FY 2026-27 = Tax Year 2026-27). Section numbers change (80C→123, 80D→126, 80CCD→124, 80E→129, 80G→133, 87A→156); rates did not change.", from: "2026-04-01", act1961: "—", act2025: "Income-tax Act, 2025", confidence: "secondary", sources: ["https://kpmg.com/in/en/blogs/2026/03/income-tax-overhaul-key-changes-you-should-watch-for-from-april-1-2026.html", "https://taxguru.in/income-tax/income-tax-major-tax-effect-1-april-2026.html"] },
    { id: "section-map", topic: "Section numbers (1961 → 2025)", rule: "80C→123, 80CCD→124, 80D→126, 80E→129, 80G→133, 87A→156. 80DDB, 80GGC, 10(13A) HRA, 24(b) interest: mapping not confirmed — look up in the CBDT correspondence table before citing.", from: "2026-04-01", confidence: "secondary", sources: ["https://taxgarden.in/blog/income-tax-act-2025-section-mapping-old-vs-new-india"] },

    // ── slabs, rebate, standard deduction (FY 2025-26 and assumed FY 2026-27) ──
    { id: "new-regime-fy2526", topic: "New regime slabs FY 2025-26", rule: "0–4L nil; 4–8L 5%; 8–12L 10%; 12–16L 15%; 16–20L 20%; 20–24L 25%; above 24L 30%. Standard deduction ₹75,000. 87A rebate up to ₹60,000 if total income ≤ ₹12L, with marginal relief. 4% cess.", from: "2025-04-01", act1961: "115BAC, 87A", act2025: "202, 156", confidence: "statute", sources: ["Finance Act 2025", "reproduced to the rupee against Form 16 / ITR of FY 2025-26"] },
    { id: "new-regime-fy2627", topic: "New regime FY 2026-27", rule: "No change announced in Budget 2026-27; slabs, ₹75,000 standard deduction and ₹12L rebate carry forward. Employer NPS 80CCD(2) allowed up to 14% of basic+DA in the new regime.", from: "2026-04-01", confidence: "secondary", sources: ["https://upstox.com/news/personal-finance/tax/top-10-income-tax-announcements-in-budget-2026-from-tcs-on-lrs-stt-buyback-shares-to-revised-itr-filing-date/article-188714/", "https://www.mstock.com/articles/income-tax-act-2025"] },
    { id: "old-regime", topic: "Old regime", rule: "0–2.5L nil; 2.5–5L 5%; 5–10L 20%; above 10L 30%. Standard deduction ₹50,000. 87A rebate ₹12,500 if income ≤ ₹5L. Surcharge and cess as usual. Unchanged for years.", from: "2018-04-01", act1961: "115BAC (opt-out), 87A", confidence: "statute", sources: ["reproduced to the rupee against four filed returns"] },

    // ── capital gains ──
    { id: "equity-cg", topic: "Listed equity / equity MF gains", rule: "Before 23-Jul-2024: STCG 15%, LTCG 10% above ₹1L. From 23-Jul-2024: STCG 20%, LTCG 12.5% above ₹1.25L a year. Long-term = more than 12 months. Short-term losses set off against short- and long-term gains; long-term losses only against long-term gains; carry forward 8 years if the return is filed on time.", from: "2024-07-23", act1961: "111A, 112A, 70, 74", confidence: "statute", sources: ["Finance (No. 2) Act 2024", "reproduced against FY 2024-25 return"] },
    { id: "buyback", topic: "Share buybacks", rule: "From Budget 2026, buyback proceeds are taxed as capital gains instead of dividend. No effect on current holdings unless a buyback is accepted.", from: "2026-04-01", confidence: "secondary", sources: ["https://upstox.com/news/personal-finance/tax/top-10-income-tax-announcements-in-budget-2026-from-tcs-on-lrs-stt-buyback-shares-to-revised-itr-filing-date/article-188714/"] },
    { id: "foreign-cg", topic: "Foreign shares (US stocks)", rule: "Unlisted-equivalent: long-term after 24 months at 12.5% (no ₹1.25L exemption); short-term at slab. Dividends taxed at slab; US withholds 25% for Indian residents (Form W-8BEN rates), credit via Form 67 filed before the return.", from: "2024-07-23", act1961: "112, 90/91, Rule 128", confidence: "secondary", sources: ["https://cleartax.in/s/fast-ds-2026-foreign-assets-disclosure-scheme"] },

    // ── filing and remedies ──
    { id: "due-dates", topic: "Return due dates", rule: "ITR-1 and ITR-2: 31 July. Non-audit ITR-3/ITR-4: 31 August (new from AY 2026-27). Belated return: 31 December (fee up to ₹5,000, ₹1,000 if income ≤ ₹5L).", from: "2026-04-01", act1961: "139(1), 139(4), 234F", confidence: "secondary", sources: ["https://taxguru.in/income-tax/itr-filing-due-dates-fy-2025-26-ay-2026-27.html", "https://cleartax.in/last-date-to-file-itr"] },
    { id: "revised-return", topic: "Revised return", rule: "For AY 2026-27 (FY 2025-26): revised return allowed up to 31-Mar-2027 (12 months from the end of the tax year) or until assessment completes; free until 31-Dec-2026, then fee u/s 234I of ₹1,000 (income ≤ ₹5L) or ₹5,000. For AY 2025-26 and earlier the revised/belated window has closed; only ITR-U remains. Sources conflict on the exact fee/date mechanics — confirm on the portal.", from: "2026-04-01", act1961: "139(5), 234I", act2025: "263(5)", confidence: "secondary", sources: ["https://indiapolicyhub.in/2026/10/03/revised-vs-updated-return-itr-u/", "https://upstox.com/news/personal-finance/tax/top-10-income-tax-announcements-in-budget-2026-from-tcs-on-lrs-stt-buyback-shares-to-revised-itr-filing-date/article-188714/"] },
    { id: "itr-u", topic: "Updated return (ITR-U)", rule: "Allowed within 48 months from the end of the assessment year, once per year, for income left out or wrongly reported (cannot reduce tax or increase a refund). Extra tax on (additional tax + interest): 25% within 12 months of the end of the AY, 50% within 24, 60% within 36, 70% within 48. Barred during/after assessment or reassessment, search or survey. Finance Act 2026 also allows ITR-U in reply to a section 148 notice at +10 percentage points. Gives protection from the 270A penalty on the income declared through it.", from: "2025-04-01", act1961: "139(8A), 140B, 148A", confidence: "secondary", sources: ["https://taxguru.in/income-tax/itr-october-2026-year-window-25-percent-70-percent-additional-tax-ay-wise-deadlines.html", "https://indiapolicyhub.in/2026/10/03/revised-vs-updated-return-itr-u/", "https://taxgarden.in/blog/section-139-8a-updated-return-48-months-finance-act-2025"] },
    { id: "reassessment", topic: "How long the department can reopen a year", rule: "Normally three years from the end of the assessment year (up to five years where escaped income is ₹50L or more). Penalty for under-reported income 50% of tax; for misreported income 200%.", from: "2021-04-01", act1961: "148, 148A, 149, 270A", confidence: "statute", sources: ["Finance Act 2021 and 2025"] },

    // ── foreign assets ──
    { id: "schedule-fa", topic: "Schedule FA / FSI / Form 67", rule: "A resident must report foreign assets held at any time in the calendar year (Schedule FA), foreign income (FSI) and claim US-tax credit with Form 67 filed before the return. ITR-1 cannot carry any of these; ITR-2 is required.", from: "2012-04-01", act1961: "Schedule FA, FSI, TR; Rule 128", confidence: "statute", sources: ["ITR-2 instructions"] },
    { id: "black-money", topic: "Black Money Act penalty", rule: "Non-disclosure of a foreign asset in the return: ₹10L per year under section 43. From 1-Oct-2024 the penalty does not apply when the aggregate value of foreign assets (other than immovable property) is ₹20L or less. Sources differ on whether this relief reaches earlier years; prosecution does not apply below ₹20L (Finance Bill 2026).", from: "2024-10-01", act1961: "BMA 2015 s.43, 49", confidence: "secondary", sources: ["https://cleartax.in/s/fast-ds-2026-foreign-assets-disclosure-scheme"] },
    { id: "fast-ds", topic: "FAST-DS 2026 (one-time foreign asset disclosure)", rule: "CBDT Notification 114/2026 dated 14-Aug-2026. Window 16-Aug-2026 to 31-Dec-2026 (no extension known). Valuation date 31-Mar-2026. Category A (never taxed/never reported, up to ₹1 Cr): pay 60% of value (30% tax + 100% additional), full immunity from Black Money Act penalty and prosecution. Category B (acquired from income already taxed but asset not in Schedule FA, up to ₹5 Cr): flat ₹1,00,000, same immunity. Declaration Form 1 on the e-filing portal.", from: "2026-08-16", confidence: "secondary", sources: ["https://cleartax.in/s/fast-ds-2026-foreign-assets-disclosure-scheme", "https://taxguru.in/income-tax/foreign-assets-small-taxpayers-disclosure-scheme-2026-complete-guide.html", "https://www.sansalegal.com/post/cbdt-notifies-fast-ds-rules-2026-for-one-time-disclosure-of-undisclosed-foreign-assets"] },
    { id: "lrs-tcs", topic: "TCS on foreign remittances (LRS)", rule: "Budget 2026: education and medical remittances above ₹10L: 2% (was 5%); overseas tour packages: 2%; other purposes (including investing abroad): 20% above ₹10L a year. TCS is a credit against your tax.", from: "2026-04-01", act1961: "206C(1G)", confidence: "secondary", sources: ["https://upstox.com/news/personal-finance/tax/top-10-income-tax-announcements-in-budget-2026-from-tcs-on-lrs-stt-buyback-shares-to-revised-itr-filing-date/article-188714/"] },

    // ── deductions ──
    { id: "deductions-old", topic: "Old-regime deductions", rule: "80C ₹1.5L; 80CCD(1B) ₹50k; 80D self & family ₹25k (₹50k if the insured is 60+), parents ₹25k (₹50k if a parent is 60+), preventive check-up ₹5k within the limit; 80TTA ₹10k on savings interest (not FDs); 80TTB ₹50k for seniors only; 80DDB ₹40k (₹1L for seniors) only for the diseases in Rule 11DD with a specialist's prescription/certificate; 80GGC political donations by non-cash mode to a party registered under section 29A. Senior citizen = 60 or more at any time in the year.", from: "2018-04-01", act1961: "80C, 80CCD, 80D, 80TTA, 80TTB, 80DDB, 80GGC; Rule 11DD", act2025: "123, 124, 126, …", confidence: "statute", sources: ["Income-tax Act 1961"] },
    { id: "hra", topic: "HRA exemption", rule: "Old regime only. Least of HRA received, rent paid − 10% of salary (basic+DA), 50% (metro) or 40% of salary. Landlord's PAN needed when yearly rent exceeds ₹1L. Rent to parents allowed if the parent owns the house, rent is actually paid (bank transfer is the proof) and the parent declares it as income.", from: "2018-04-01", act1961: "10(13A), Rule 2A", confidence: "statute", sources: ["Income-tax Rules 1962"] },
    { id: "employer-nps", topic: "Employer NPS", rule: "80CCD(2): employer's contribution to the employee's NPS account, up to 14% of basic+DA in both regimes (10% in the old regime for non-government employers). Needs an NPS account; no account means no contribution.", from: "2024-04-01", act1961: "80CCD(2)", act2025: "124", confidence: "secondary", sources: ["https://www.mstock.com/articles/income-tax-act-2025"] },

    // ── gifts, family money ──
    { id: "gifts", topic: "Gifts", rule: "Money or property received without consideration above ₹50,000 a year from a non-relative is taxable to the receiver. Exempt: gifts from relatives (spouse; brother or sister; brother or sister of the spouse; parents and their brothers and sisters; lineal ancestors and descendants; and spouses of these), and gifts received on the occasion of the individual's own marriage.", from: "2017-04-01", act1961: "56(2)(x)", confidence: "statute", sources: ["Income-tax Act 1961"] },
    { id: "clubbing", topic: "Clubbing between spouses", rule: "Income from assets given by an individual to the spouse without adequate consideration is added to the giver's income (interest, dividends, capital gains), as long as they are spouses. Does not apply to gifts to parents, siblings, or to money the spouse earned herself. Whether clubbing reaches assets gifted before the marriage is argued both ways — treat as a CA question.", from: "1961-04-01", act1961: "64(1)(iv)", confidence: "statute", sources: ["Income-tax Act 1961"] },
    { id: "tds-property", topic: "TDS on buying property", rule: "Buyer deducts 1% TDS and files Form 26QB on every payment when the price of an immovable property (other than agricultural land) is ₹50L or more.", from: "2013-06-01", act1961: "194-IA", confidence: "statute", sources: ["Income-tax Act 1961"] },


    // ── moving abroad (UK posting) ──
    { id: "residency-india", topic: "Residential status in India", rule: "Resident if 182+ days in the financial year, or 60+ days in the year and 365+ days in the previous four years. An Indian citizen who leaves India in the year for employment abroad (or as crew) is tested on 182 days only. A citizen visiting India: 182 days, or 120 if Indian-source income exceeds ₹15L (then RNOR). A citizen with Indian income over ₹15L who is not liable to tax in any country is deemed resident (RNOR). Resident but not ordinarily resident (RNOR) if non-resident in 9 of the previous 10 years or 729 days or fewer in the previous 7; otherwise ordinarily resident (global income taxed). NRIs and RNORs are taxed in India on Indian-source income only (salary for work done abroad is not Indian-source).", from: "2020-04-01", act1961: "6", act2025: "retained, renumbered", confidence: "secondary", sources: ["https://nriinformation.com/taxation/nri-tax-residential-status", "https://askcasanjay.com/blog/nri-taxation-income-tax-act-2025", "https://www.balakrishnaandco.com/news-and-articles/44-residential-status-india-simple-clear-guide-determine-your-tax-residency-2025"] },
    { id: "uk-nic-dcc", topic: "India–UK social security (National Insurance)", rule: "The India–UK Double Contribution Convention applies from 15-Jul-2026 to postings that start on or after that date: an employee sent temporarily by an Indian employer stays in the Indian scheme (EPF) and is exempt from UK National Insurance, with a certificate of coverage from EPFO. The exemption period is reported as 60 months by recent sources (36 months in earlier ones) — verify against GOV.UK.", from: "2026-07-15", confidence: "secondary", sources: ["https://www.gov.uk/government/publications/social-security-agreement-between-the-uk-and-india/uk-and-india-new-social-security-agreement", "https://mooreks.co.uk/insights/uk-india-social-security-agreement-coming-into-effect-from-15-july-2026/", "https://www.india-briefing.com/news/india-uk-social-security-pact-takes-effect-july-15-2026-what-employers-and-indian-professionals-need-to-know-45762.html/"] },
    { id: "uk-fig", topic: "UK foreign income and gains regime", rule: "A new UK resident who was non-UK resident for the 10 previous tax years can claim, for the first four years of UK residence, exemption on foreign income and gains (e.g. Indian interest, dividends, capital gains) arising from 6-Apr-2025. It must be claimed each year on a self-assessment return and costs the personal allowance and the capital-gains annual exempt amount for that year. Employment income for UK duties is taxed in the UK regardless.", from: "2025-04-06", confidence: "secondary", sources: ["https://aab.uk/blog/a-guide-to-the-new-foreign-income-and-gains-regime/", "https://taxresidency.co.uk/blog/foreign-income-and-gains-regime"] },
    { id: "nri-accounts", topic: "What changes for assets when you become an NRI", rule: "Resident savings accounts and FDs must be re-designated NRO (or moved to NRE); mutual fund and demat KYC/FATCA must be updated and folios linked to the NRO account; TDS applies to NRI redemptions (equity 20% short-term, 12.5% long-term, claim the ₹1.25L exemption in the return). PPF may continue to its original maturity without extension or new accounts; NPS can continue; EPF credits to a non-resident go to an NRO account. LRS (sending money abroad to invest) is for residents only. Schedule FA is for residents only.", from: "2020-04-01", confidence: "secondary", sources: ["https://nritaxs.com/mutual-funds-after-becoming-nri/", "https://nriinformation.com/nri-info/top-investment-options-2026", "https://nriinformation.com/returning-to-india/nri-provident-fund-guide"] },

    // ── other ──
    { id: "crypto", topic: "Crypto / virtual digital assets", rule: "30% tax on gains with no deductions, no set-off of losses, 1% TDS on transfers above the threshold; every transfer is reported in Schedule VDA, even at a loss.", from: "2022-04-01", act1961: "115BBH, 194S", confidence: "statute", sources: ["Finance Act 2022"] },
    { id: "advance-tax", topic: "Advance tax", rule: "Required if tax after TDS is ₹10,000 or more: 15% by 15 Jun, 45% by 15 Sep, 75% by 15 Dec, 100% by 15 Mar. Interest 1% a month under 234B/234C otherwise.", from: "1961-04-01", act1961: "208, 211, 234B, 234C", confidence: "statute", sources: ["Income-tax Act 1961"] },
  ];

  const dayDiff = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

  /** What needs re-checking: weaker sources, and anything not verified in the last `maxAgeDays`. */
  function lawStatus(asOf = new Date().toISOString().slice(0, 10), maxAgeDays = 60) {
    const stale = LAW.filter((r) => dayDiff(r.verifiedOn || VERIFIED, asOf) > maxAgeDays);
    const weak = LAW.filter((r) => r.confidence !== "statute");
    return { total: LAW.length, weak: weak.map((r) => r.id), stale: stale.map((r) => r.id), needsReview: [...new Set([...stale, ...weak].map((r) => r.id))], verifiedOn: VERIFIED, asOf };
  }

  const byId = (id) => LAW.find((r) => r.id === id);

  return { LAW, VERIFIED, lawStatus, byId };
  })();

  // ════════════════════════════ engine ════════════════════════════
  const engine = (function () {
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
    // FY 2027-28: assumed unchanged from FY 2026-27. The Budget of February 2027 will say; the law watch flags changes.
    "2027-28": { old: { std: 50000, rebateUpTo: 5 * L, rebateMax: 12500 }, newRegime: { slabs: NEW_2025, std: 75000, rebateUpTo: 12 * L, rebateMax: 60000, marginalRelief: true, cap80CCD2Pct: 14 }, defaultRegime: "new", assumed: true },
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
    if (p.nonResident) rebate = 0; // the 87A rebate is for residents only
    else if (totalIncome <= cfg.rebateUpTo) rebate = Math.min(cfg.rebateMax, normalTax + (+p.fy.slice(0, 4) >= 2025 ? 0 : specialTax));
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

  return { YEARS, RULES, fyOf, ayOf, yearRules, slabTax, marginalRate, equityGainsTax, hraExemption, capDeductions, computeTax, compareRegimes };
  })();

  // ════════════════════════════ remedies ════════════════════════════
  const remedies = (function () {
  /**
   * Life Ledger — how to correct a filed year (pure): which route is open, until when, at what cost.
   * Routes: revised return (139(5)), updated return ITR-U (139(8A)), FAST-DS 2026 for undisclosed foreign assets.
   * Dates and percentages come from the law register (secondary sources — confirm on the portal before paying).
   */
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const r0 = (v) => Math.round(v);
  const iso = (d) => new Date(d).toISOString().slice(0, 10);
  const addMonths = (d, n) => { const x = new Date(d + "T00:00:00Z"); x.setUTCMonth(x.getUTCMonth() + n); return iso(x); };
  const monthsBetween = (from, to) => { const a = new Date(from + "T00:00:00Z"), b = new Date(to + "T00:00:00Z"); let m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()); if (b.getUTCDate() > a.getUTCDate()) m += 1; return Math.max(0, m); };
  const ayEnd = (ay) => `${+ay.slice(0, 4) + 1}-03-31`; // AY 2025-26 ends 31-Mar-2026

  /** Additional-tax tier (percent) for an ITR-U filed on `fileDate` for assessment year `ay` ("2025-26"); null if the window is closed. */
  function itrUTier(ay, fileDate) {
    const end = ayEnd(ay), m = monthsBetween(end, fileDate);
    const tiers = [[12, 25], [24, 50], [36, 60], [48, 70]];
    for (const [limit, pct] of tiers) if (m <= limit && fileDate > end) return { pct, monthsAfterAyEnd: m, lastDate: addMonths(end, limit) };
    if (fileDate <= end) return { pct: 25, monthsAfterAyEnd: 0, lastDate: addMonths(end, 12) };
    return null;
  }

  /** Rough interest on unpaid tax for an updated return: 1% a month under 234A from the due date and 234B from 1-Apr of the AY (when the unpaid tax is ₹10,000 or more). An estimate — the portal computes the real figure. */
  function estimateInterest(additionalTax, ay, fileDate) {
    const dueDate = `${+ay.slice(0, 4)}-07-31`, from234B = `${+ay.slice(0, 4)}-04-01`;
    const a = monthsBetween(dueDate, fileDate), b = num(additionalTax) >= 10000 ? monthsBetween(from234B, fileDate) : 0;
    return r0(num(additionalTax) * 0.01 * (a + b));
  }

  /** What an ITR-U would cost now for one past year. */
  function itrUCost({ ay, additionalTax, asOf }) {
    const tier = itrUTier(ay, asOf);
    if (!tier) return { open: false, ay, reason: "The 48-month window has closed." };
    const interest = estimateInterest(additionalTax, ay, asOf);
    const base = num(additionalTax) + interest;
    const extra = r0(base * tier.pct / 100);
    const nextStep = (() => {
      const next = itrUTier(ay, addMonths(tier.lastDate, 1));
      return next ? { after: tier.lastDate, pct: next.pct } : null;
    })();
    return { open: true, ay, pctExtra: tier.pct, lastDate: tier.lastDate, additionalTax: r0(additionalTax), interest, extraTax: extra, totalToPay: r0(base + extra), rateRisesTo: nextStep };
  }

  /** Revised-return window for the latest year (AY 2026-27); earlier years can only use ITR-U. */
  function revisedReturn({ ay, asOf }) {
    if (ay !== "2026-27") return { open: false, ay, reason: "Revised/belated window has closed for this year; use an updated return (ITR-U)." };
    if (asOf <= "2026-12-31") return { open: true, ay, lastDate: "2027-03-31", fee: 0, freeUntil: "2026-12-31", note: "No fee until 31-Dec-2026; ₹1,000 (income ≤ ₹5L) or ₹5,000 after that, up to 31-Mar-2027." };
    if (asOf <= "2027-03-31") return { open: true, ay, lastDate: "2027-03-31", fee: 5000, note: "Fee ₹5,000 (₹1,000 if income ≤ ₹5L)." };
    return { open: false, ay, reason: "Revised window has closed." };
  }

  /**
   * FAST-DS 2026 helper for a foreign account. valueAtMar2026 in ₹. taxedIncome = the money came from salary already taxed in India.
   * Returns the scheme cost and the exposure it replaces, so the choice is explicit. Not advice: confirm with a CA.
   */
  function fastDs({ valueAtMar2026, taxedIncome = true, peakValueInr, asOf }) {
    const open = asOf >= "2026-08-16" && asOf <= "2026-12-31";
    const cat = taxedIncome ? "B" : "A";
    const limit = cat === "B" ? 5e7 : 1e7;
    const eligible = num(valueAtMar2026) <= limit;
    const cost = cat === "B" ? 100000 : r0(num(valueAtMar2026) * 0.6);
    const under20L = num(peakValueInr) <= 2000000;
    return {
      open, category: cat, eligible, cost, deadline: "2026-12-31", immunity: "No Black Money Act penalty or prosecution for the years covered",
      withoutScheme: under20L
        ? "Peak value is under ₹20L: no ₹10L Black Money Act penalty for years from 1-Oct-2024 and no prosecution; earlier years are arguable. The realistic exposure is a notice and a corrected return."
        : "Value above ₹20L: ₹10L penalty per year of non-disclosure is possible.",
      note: "Choose between ₹1,00,000 for certainty and a corrected return for free; get a CA's view before 31-Dec-2026.",
    };
  }

  return { itrUTier, itrUCost, estimateInterest, revisedReturn, fastDs, monthsBetween };
  })();

  // ════════════════════════════ gifts ════════════════════════════
  const gifts = (function () {
  /**
   * Life Ledger — gifts and family money (pure). Classifies a transfer between family members for the receiver's tax (56(2)(x)),
   * the giver's clubbing exposure (64) and the paperwork to keep, taking the marriage date into account: before the wedding a
   * future spouse and her family are not "relatives", after it they are.
   *
   * t = { amount, date: "YYYY-MM-DD", from, to, relation: "spouse"|"parent"|"child"|"sibling"|"spouse-sibling"|"spouse-parent"|"other",
   *       viaOther?: true (paid into a third party's account on behalf of `to`), purpose?, repaymentExpected? }
   * ctx = { marriageDate }
   */
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const THRESHOLD = 50000;

  /** Is `relation` a "relative" under 56(2)(x) on the given date? Spouse-side relations only exist from the marriage. */
  function isRelative(relation, date, marriageDate) {
    const spouseSide = ["spouse", "spouse-sibling", "spouse-parent"].includes(relation);
    if (spouseSide) return !!marriageDate && date >= marriageDate;
    return ["parent", "child", "sibling", "grandparent", "grandchild"].includes(relation);
  }

  function classifyGift(t, ctx = {}) {
    const out = { amount: num(t.amount), date: t.date, flags: [], keep: [], taxableToReceiver: 0, clubbedToGiver: false, confidence: "high", summary: "" };
    const before = ctx.marriageDate && t.date < ctx.marriageDate;
    const relative = isRelative(t.relation, t.date, ctx.marriageDate);
    const toSpouse = t.relation === "spouse";

    if (t.repaymentExpected) {
      out.summary = "A loan, not a gift: no tax on the principal; interest received is the lender's income. Keep a written acknowledgement and take repayments by bank.";
      out.keep.push("one-line loan acknowledgement signed by the borrower", "bank trail of repayments");
      return out;
    }

    if (out.amount <= THRESHOLD) { out.summary = "At or below ₹50,000 in the year from any person: not taxable to the receiver."; return out; }

    if (relative) {
      out.summary = "From a relative: tax-free to the receiver.";
      if (toSpouse) { out.clubbedToGiver = true; out.flags.push("Income earned on this money (interest, dividends, capital gains/losses) is added to the giver's income (sec 64) while you are spouses."); }
      out.keep.push("bank transfer record", "short gift letter (who, how much, date, 'out of love and affection')");
      return out;
    }

    // Not a relative at that date.
    if (before && ["spouse", "spouse-sibling", "spouse-parent"].includes(t.relation)) {
      out.summary = "Given before the wedding, so the receiver was not yet a relative. A gift received on the occasion of the receiver's own marriage is exempt from anyone; the tribunals have generally accepted gifts made around the wedding, not only on the day.";
      out.flags.push(`Paid ${Math.round((new Date(ctx.marriageDate) - new Date(t.date)) / 864e5)} days before the wedding${t.viaOther ? " and into a third party's account" : ""}: tax-free only if it really was a gift to the bride in connection with the marriage; if the receiver was the third party (not the bride), the marriage exemption does not cover them.`);
      out.flags.push("Clubbing: whether income from a pre-wedding gift is added to the giver once they marry is argued both ways. Ask the CA; the amounts here are small.");
      out.confidence = "medium";
      out.keep.push("bank transfer record", "a dated note of purpose (gift for the bride / wedding)", "wedding date proof");
      return out;
    }

    out.taxableToReceiver = out.amount;
    out.summary = "From a non-relative above ₹50,000: taxable to the receiver as income from other sources unless an exemption applies (marriage occasion, will/inheritance).";
    out.keep.push("bank transfer record");
    return out;
  }

  /**
   * When a spouse's investments were paid for partly with money given by the other spouse and partly with her own or her parents'
   * money, only the share traceable to the giver's money is clubbed (sec 64). Returns the fraction to club, 0..1.
   * contributions: { fromSpouse, fromOthers } in ₹ (own earnings, gifts from parents, etc. are "fromOthers").
   */
  function clubbingShare({ fromSpouse = 0, fromOthers = 0 } = {}) {
    const a = Math.max(0, num(fromSpouse)), b = Math.max(0, num(fromOthers));
    return a + b > 0 ? a / (a + b) : 0;
  }

  return { classifyGift, isRelative, clubbingShare, THRESHOLD };
  })();

  // ════════════════════════════ residency ════════════════════════════
  const residency = (function () {
  /**
   * Life Ledger — Indian residential status for one financial year (pure), for planning a move abroad (e.g. a UK posting).
   * Implements section 6 of the Income-tax Act 1961 as retained in the Income-tax Act 2025 (see law register "residency-india").
   *
   * i = { daysInIndia (this FY), daysPrev4 (days in India across the previous 4 FYs), prevYears: [{ fy, resident: boolean, days }] (up to 10, newest first),
   *       citizen: true, leftForEmployment: true (left India this year for employment abroad), visiting: true (citizen/PIO living abroad, visiting India),
   *       indianIncome (excluding foreign sources, ₹), taxedElsewhere: true }
   */
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const L = 100000;

  function residentialStatus(i) {
    const days = num(i.daysInIndia), prev4 = num(i.daysPrev4);
    const prev = i.prevYears || [];
    const reasons = [];
    let resident = false, deemed = false;

    let threshold182 = 182;
    if (i.citizen && i.visiting && num(i.indianIncome) > 15 * L) threshold182 = 120;
    if (days >= 182) { resident = true; reasons.push("182 days or more in the year"); }
    else if (days >= 60 && prev4 >= 365 && !(i.citizen && (i.leftForEmployment || i.visiting))) { resident = true; reasons.push("60 days in the year and 365 in the previous four"); }
    else if (i.citizen && i.visiting && days >= threshold182 && threshold182 === 120) { resident = true; deemed = true; reasons.push("citizen visiting India with Indian income over ₹15L: 120-day test (RNOR)"); }
    if (!resident && i.citizen && num(i.indianIncome) > 15 * L && i.taxedElsewhere === false) { resident = true; deemed = true; reasons.push("deemed resident: Indian income over ₹15L and not liable to tax in any country (RNOR)"); }

    if (!resident) return { status: "NR", resident: false, reasons: reasons.length ? reasons : ["fewer than 182 days in India"], globalIncomeTaxed: false, note: "Taxed in India on Indian-source income only." };

    const nrIn9of10 = prev.length >= 10 ? prev.slice(0, 10).filter((y) => !y.resident).length >= 9 : null;
    const days7 = prev.length >= 7 ? prev.slice(0, 7).reduce((a, y) => a + num(y.days), 0) : null;
    const rnor = deemed || nrIn9of10 === true || (days7 != null && days7 <= 729);
    return {
      status: rnor ? "RNOR" : "ROR", resident: true, reasons,
      globalIncomeTaxed: !rnor,
      note: rnor ? "Resident but not ordinarily resident: foreign income not taxed in India unless it arises from an Indian business or profession." : "Resident and ordinarily resident: worldwide income taxed in India, with credit for tax paid abroad under the treaty (Form 67).",
    };
  }

  /** Days in India for a departure date within a financial year (FY starts 1 April). Departure day itself counts as a day in India. */
  function daysInIndiaForDeparture(fy, departureISO) {
    const start = new Date(`${fy.slice(0, 4)}-04-01T00:00:00Z`), dep = new Date(departureISO + "T00:00:00Z");
    return Math.max(0, Math.min(365, Math.round((dep - start) / 864e5) + 1));
  }

  /** The latest departure date in a financial year that still makes the year a non-resident year (≤ 181 days in India). */
  function latestDepartureForNonResident(fy) {
    const start = new Date(`${fy.slice(0, 4)}-04-01T00:00:00Z`);
    const d = new Date(start.getTime() + 180 * 864e5); // day 181 = start + 180 days
    return d.toISOString().slice(0, 10);
  }

  return { residentialStatus, daysInIndiaForDeparture, latestDepartureForNonResident };
  })();

  // ════════════════════════════ audit ════════════════════════════
  const audit = (function () {
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
  const E = engine;
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const r0 = (v) => Math.round(v);
  const inr = (v) => (num(v) < 0 ? "−" : "") + "₹" + Math.abs(Math.round(num(v))).toLocaleString("en-IN");
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
      if (ltcg > (fyStartYear >= 2024 ? E.RULES.itr1.maxLtcg112AFromAY2526 : 100000)) why.push("long-term gains above what ITR-1 can carry");
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
    // Items below stand if the household can show proof; they are listed but not counted in the corrected tax.
    for (const f of findings) f.proofNeeded = ["hra-proof", "hra-parents", "hra-pan", "80ggc", "80c"].includes(f.id);
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

  return { audit, correctedInput, filedInput };
  })();

  // ════════════════════════════ planner ════════════════════════════
  const planner = (function () {
  /**
   * Life Ledger — forward tax planner (pure). For the coming/current year: old vs new regime on the household's real figures,
   * what each lever is worth (employer NPS, gains harvesting, deductions), advance-tax instalments and the filing calendar.
   *
   * p = { fy, person, grossSalary, basic, hraReceived, rentPaid, metro, professionalTax, otherIncome, employerNps (current),
   *       gains: { stcgAfter, ltcgAfter } (further gains expected), realisedLtcgYtd / realisedStcgYtd (already booked this year), deductionsPaid: { "80C", "80D_self", "80D_parents", "80CCD1B", homeLoanInterest },
   *       parentsSenior, tdsProjected, hasForeignAssets, hasShareSales }
   */
  const E = engine;
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const r0 = (v) => Math.round(v);

  /** The figures every scenario starts from: year rules, NPS cap, HRA, old-regime deductions, and the tax base. */
  function inputs(p) {
    const y = E.yearRules(p.fy);
    const npsCap = r0((y.newRegime ? y.newRegime.cap80CCD2Pct : 10) / 100 * num(p.basic));
    const hra = E.hraExemption({ hraReceived: p.hraReceived, rentPaid: p.rentPaid, basic: p.basic, metro: p.metro });
    const capped = E.capDeductions(p.deductionsPaid || {}, { parentsSenior: p.parentsSenior, basic: p.basic });
    const oldDed = capped["80C"] + capped["80CCD1B"] + capped["80D"] + capped.homeLoanInterest;
    const gains = { ...(p.gains || {}) };
    if (num(p.realisedLtcgYtd) || num(p.realisedStcgYtd)) { gains.ltcgAfter = num(gains.ltcgAfter) + num(p.realisedLtcgYtd); gains.stcgAfter = num(gains.stcgAfter) + num(p.realisedStcgYtd); }
    const base = { fy: p.fy, grossSalary: p.grossSalary, professionalTax: p.professionalTax, otherIncome: p.otherIncome, employerNps: p.employerNps, basic: p.basic, gains };
    return { y, npsCap, hra, oldDed, base, capped };
  }

  function plan(p, asOf = new Date().toISOString().slice(0, 10)) {
    const { y, npsCap, hra, oldDed, base } = inputs(p);
    const fyStart = +p.fy.slice(0, 4);
    const cmp = E.compareRegimes(base, { old: { exemptAllowances: hra, deductions: oldDed }, newer: { exemptAllowances: 0, deductions: 0 } });
    const chosen = cmp.better;
    const current = cmp[chosen];

    const levers = [];
    // Employer NPS up to the cap
    if (num(p.employerNps) < npsCap) {
      const t = E.computeTax({ ...base, regime: chosen, exemptAllowances: chosen === "old" ? hra : 0, deductions: chosen === "old" ? oldDed : 0, employerNps: npsCap });
      levers.push({ id: "employer-nps", title: "Employer NPS (80CCD(2)) up to the cap", yearlySaving: current.totalTax - t.totalTax, detail: `Ask the employer to route up to ₹${npsCap.toLocaleString("en-IN")} a year (${y.newRegime ? y.newRegime.cap80CCD2Pct : 10}% of basic) to NPS. Needs your own NPS account (PRAN). Locked until 60.` });
    }
    // Long-term gains harvesting (₹1.25L exemption, 12.5%)
    const exemptionLeft = Math.max(0, E.RULES.equity.exemptionFromFY2425 - Math.max(0, num(p.realisedLtcgYtd)));
    if (exemptionLeft > 0) levers.push({ id: "ltcg-harvest", title: `Book ₹${exemptionLeft.toLocaleString("en-IN")} more of long-term equity gains tax-free`, yearlySaving: r0(exemptionLeft * E.RULES.equity.ltcgAfter / 100 * 1.04), detail: `${num(p.realisedLtcgYtd) > 0 ? `₹${r0(p.realisedLtcgYtd).toLocaleString("en-IN")} of the ₹1.25L exemption is already used this year. ` : ""}Sell and buy back the same day before 31 March; resets your cost so future tax is lower. Leave out funds with exit loads.` });
    // Holding period
    if (num(p.gains?.stcgAfter) > 0) levers.push({ id: "hold-12m", title: "Hold equity 12+ months", yearlySaving: r0(num(p.gains.stcgAfter) * (E.RULES.equity.stcgAfter - E.RULES.equity.ltcgAfter) / 100 * 1.04), detail: "Short-term 20% vs long-term 12.5% (first ₹1.25L free)." });
    for (let i = levers.length - 1; i >= 0; i--) if (!(levers[i].yearlySaving > 0)) levers.splice(i, 1);
    levers.sort((a, b) => b.yearlySaving - a.yearlySaving);

    // Advance tax: due if tax not covered by TDS exceeds ₹10,000
    const shortfall = current.totalTax - num(p.tdsProjected);
    const advance = shortfall > 10000 ? [[`${fyStart}-06-15`, 15], [`${fyStart}-09-15`, 45], [`${fyStart}-12-15`, 75], [`${fyStart + 1}-03-15`, 100]].map(([date, pct]) => ({ date, cumulativePct: pct, cumulativeAmount: r0(shortfall * pct / 100) })) : [];

    const form = p.hasForeignAssets || p.hasShareSales || num(p.grossSalary) > 50 * 1e5 ? "ITR-2" : "ITR-1";
    const calendar = [
      { date: `${fyStart}-04-30`, what: "Tell the employer your regime; start/confirm employer NPS" },
      ...advance.map((a) => ({ date: a.date, what: `Advance tax: ${a.cumulativePct}% (₹${a.cumulativeAmount.toLocaleString("en-IN")} cumulative)` })),
      { date: `${fyStart + 1}-03-15`, what: "Gains harvesting and loss booking; insurance renewals" },
      { date: `${fyStart + 1}-06-15`, what: "Form 16 arrives; download AIS/TIS, 26AS, broker and INDmoney reports; run the audit" },
      ...(p.hasForeignAssets ? [{ date: `${fyStart + 1}-07-15`, what: "File Form 67 (credit for US tax on dividends) before the return" }] : []),
      { date: `${fyStart + 1}-07-31`, what: `File ${form} (${chosen} regime)` },
      { date: `${fyStart + 1}-12-31`, what: "Last date for a revised/belated return" },
    ];

    calendar.sort((a, b) => (a.date < b.date ? -1 : 1));
    for (const c of calendar) c.status = c.date < asOf ? "past" : "upcoming";
    // An instalment date already gone means interest u/s 234C; paying the cumulative amount by the next date limits it.
    const nextAdvance = advance.find((a) => a.date >= asOf) || null;
    const missedAdvance = advance.filter((a) => a.date < asOf).length > 0;

    return {
      fy: p.fy, person: p.person, asOf, assumedRules: !!y.assumed, nextAdvance, missedAdvance,
      regimes: { old: { tax: cmp.old.totalTax, hraExempt: r0(hra), deductions: r0(oldDed), taxable: cmp.old.totalIncome }, new: cmp.new && { tax: cmp.new.totalTax, taxable: cmp.new.totalIncome } },
      better: chosen, saving: cmp.saving, marginalRatePct: current.marginalRatePct,
      tdsProjected: r0(num(p.tdsProjected)), balance: r0(num(p.tdsProjected) - current.totalTax),
      form, levers, advanceTax: advance, calendar,
    };
  }

  return { plan, inputs };
  })();

  // ════════════════════════════ gains ════════════════════════════
  // Capital gains by lot (FIFO) from the app's holdings: open lots, gains if sold today, gains realised this financial year.
  const gains = (function () {
    const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
    const r0 = (v) => Math.round(v);
    const isoOf = (x) => String(x || "").slice(0, 10);
    const RULES = { equity: { holdMonths: 12 }, listedOther: { holdMonths: 12 }, unlistedOther: { holdMonths: 24 }, foreignShares: { holdMonths: 24 } };
  // ── classification ───────────────────────────────────────────────────────────────────────────
  function taxCategory(name, kind, category) {
    const n = String(name || "").toLowerCase();
    if (kind === "us") return "foreignShares";
    if (kind === "mf") {
      if (/liquid|overnight|money market|debt|gilt|bond|corporate bond|short duration|low duration|ultra short/.test(n)) return "debt";
      if (/gold|silver|nasdaq|s&p|us |overseas|international|global|hang seng|world/.test(n)) return "unlistedOther";
      if (/multi asset|hybrid|balanced|dynamic asset/.test(n)) return "hybrid";
      return "equity";
    }
    if (/gold|silver|nasdaq|s&p|hang seng|mafang|international|world|overseas/.test(n)) return "listedOther";
    return "equity";
  }

  // ── lots (FIFO) ──────────────────────────────────────────────────────────────────────────────
  /** Returns { lots: open lots, realised: [{...}] } for mutual funds (with redemptions) and stocks/ETFs/US stocks. */
  function buildLots(state, usdInr = 1) {
    const lots = [], realised = [];
    const mfRows = (state.mutualFunds || []).slice().sort((a, b) => (isoOf(a.purchaseDate || a.date) < isoOf(b.purchaseDate || b.date) ? -1 : 1));
    const groups = new Map();
    for (const t of mfRows) {
      const k = `${t.fundName}|${t.owner || "Me"}`;
      (groups.get(k) || groups.set(k, []).get(k)).push(t);
    }
    for (const [k, rows] of groups) {
      const [name, owner] = k.split("|");
      const nav = num([...rows].reverse().find((t) => num(t.latestNav))?.latestNav) || num(rows[rows.length - 1].nav);
      const open = [];
      for (const t of rows) {
        if (t.transactionType === "REDEMPTION") {
          let units = num(t.units);
          const proceedsPerUnit = num(t.invested) / (num(t.units) || 1);
          while (units > 1e-9 && open.length) {
            const l = open[0], take = Math.min(units, l.qty), costPer = l.cost / l.qty;
            realised.push({ kind: "mf", name, owner, category: l.cat, buyDate: l.date, sellDate: isoOf(t.purchaseDate || t.date), qty: take, cost: take * costPer, proceeds: take * proceedsPerUnit });
            l.cost -= take * costPer; l.qty -= take; units -= take;
            if (l.qty <= 1e-9) open.shift();
          }
        } else {
          open.push({ kind: "mf", name, owner, cat: taxCategory(name, "mf"), date: isoOf(t.purchaseDate || t.date), qty: num(t.units), cost: num(t.invested), price: nav });
        }
      }
      open.forEach((l) => lots.push(l));
    }
    const addStocks = (list, kind, fx) => {
      for (const s of list || []) {
        const qty = num(s.quantity);
        if (!(qty > 0)) continue;
        lots.push({ kind, name: s.company || s.symbol, symbol: s.symbol, owner: s.owner || "Me", cat: taxCategory(s.company || s.symbol, kind, s.category), date: isoOf(s.purchaseDate || s.date), qty, cost: num(s.invested) * fx, price: num(s.currentPrice) * fx });
      }
    };
    addStocks(state.stocks, "stock", 1);
    addStocks(state.usstocks, "us", num(usdInr) || 1);
    // Broker/sheet imports stamp every row with the import date, so a date shared by most rows is not a real buy date.
    for (const kind of ["stock", "us"]) {
      const ls = lots.filter((l) => l.kind === kind), count = {};
      ls.forEach((l) => { count[l.date] = (count[l.date] || 0) + 1; });
      const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
      if (top && ls.length >= 5 && top[1] / ls.length > 0.5) ls.forEach((l) => { if (l.date === top[0]) l.dateKnown = false; });
    }
    return { lots, realised };
  }

  const monthsBetween = (fromISO, toISO) => {
    const a = new Date(fromISO), b = new Date(toISO);
    let m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
    if (b.getUTCDate() < a.getUTCDate()) m--;
    return m;
  };

  /** Is a lot long-term on `asOf`? (Debt: never.) */
  function holding(lot, asOf, sellDate) {
    if (lot.dateKnown === false) return { long: null, months: null, rule: null, unknown: true };
    const cat = lot.cat || lot.category;
    const rule = cat === "equity" || cat === "hybrid" ? RULES.equity : cat === "listedOther" ? RULES.listedOther : cat === "debt" ? null : cat === "foreignShares" ? RULES.foreignShares : RULES.unlistedOther;
    const months = monthsBetween(lot.date || lot.buyDate, sellDate || asOf);
    return { long: !!rule && months >= rule.holdMonths, months, rule };
  }

  const fyOf = (iso) => { const y = +iso.slice(0, 4), m = +iso.slice(5, 7); return m >= 4 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`; };

  /** Gains if every open lot were sold on `asOf`, split per owner into short/long and equity/other. */
  function unrealised(lots, asOf) {
    const owners = {};
    const perLot = lots.map((l) => {
      const h = holding(l, asOf);
      const value = l.qty * l.price, gain = value - l.cost;
      const o = (owners[l.owner] ||= { equityST: 0, equityLT: 0, otherST: 0, otherLT: 0, debt: 0, unknownTermEquity: 0, unknownTermOther: 0 });
      if (h.unknown) { if (l.cat === "equity" || l.cat === "hybrid") o.unknownTermEquity += gain; else o.unknownTermOther += gain; }
      else if (l.cat === "debt") o.debt += gain;
      else if (l.cat === "equity" || l.cat === "hybrid") (h.long ? (o.equityLT += gain) : (o.equityST += gain));
      else (h.long ? (o.otherLT += gain) : (o.otherST += gain));
      return { ...l, value, gain, long: h.long, months: h.months, termUnknown: !!h.unknown };
    });
    return { owners, perLot };
  }

  /** This financial year's realised gains per owner (from redemptions). */
  function realisedThisFY(realised, asOf) {
    const fy = fyOf(asOf), owners = {};
    const rows = realised.filter((r) => fyOf(r.sellDate) === fy).map((r) => {
      const h = holding({ date: r.buyDate, cat: r.category }, r.sellDate, r.sellDate);
      const gain = r.proceeds - r.cost;
      const o = (owners[r.owner] ||= { equityST: 0, equityLT: 0, otherST: 0, otherLT: 0 });
      const eq = r.category === "equity" || r.category === "hybrid";
      if (eq) (h.long ? (o.equityLT += gain) : (o.equityST += gain)); else (h.long ? (o.otherLT += gain) : (o.otherST += gain));
      return { owner: r.owner, name: r.name, sold: r.sellDate, bought: r.buyDate, proceeds: r0(r.proceeds), cost: r0(r.cost), gain: r0(gain), term: h.long ? "long" : "short", category: r.category };
    });
    return { fy, owners, rows };
  }


    return { taxCategory, buildLots, holding, unrealised, realisedThisFY, fyOf, monthsBetween };
  })();

  // ════════════════════════════ saver ════════════════════════════
  // The tax-saving engine. Every figure is the engine's own tax with and without the move, not a rule of thumb.
  // Levers: employer NPS (by start month), old vs new regime (and what the old regime would need), long-term-gain
  // harvesting, waiting for a lot to turn long-term, booking losses, who should hold interest-bearing assets, running a
  // side business in the lower-taxed spouse's name, and what a move abroad does (the 87A rebate is for residents only).
  const saver = (function () {
    const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
    const r0 = (v) => Math.round(v);
    const inr = (v) => (num(v) < 0 ? "−" : "") + "₹" + Math.abs(Math.round(num(v))).toLocaleString("en-IN");
    const CESS = 1 + engine.RULES.cess / 100;
    const monthName = (ym) => { try { return new Date(ym + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }); } catch { return ym; } };
    const addMonthsISO = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
    const daysTo = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
    const nextFy = (fy) => `${+fy.slice(0, 4) + 1}-${String(+fy.slice(0, 4) + 2).slice(2)}`;

    /** Tax for the person's plan inputs under a regime, with optional changes. */
    function taxWith(p, regime, change = {}) {
      const I = planner.inputs(p);
      const base = { ...I.base, ...(change.base || {}) };
      return engine.computeTax({ ...base, regime, exemptAllowances: regime === "old" ? I.hra : 0, deductions: regime === "old" ? I.oldDed + num(change.extraDeductions) : 0, ...(change.tax || {}) });
    }
    const chosenRegime = (p) => planner.plan(p, "2000-01-01").better;

    /**
     * Employer NPS: saving and out-of-pocket cost by the month the employer starts it. remaining = payroll months left this year,
     * counting the month now under way; the earliest start is next month. planned = "YYYY-MM" the household intends to start.
     */
    function npsByStart(p, remaining, today, planned) {
      const I = planner.inputs(p), regime = chosenRegime(p), monthly = I.npsCap / 12, have = num(p.employerNps);
      const room = Math.max(0, I.npsCap - have);
      if (room <= 0) return { cap: I.npsCap, rows: [], runRate: null };
      const t0 = taxWith(p, regime).totalTax;
      const cur = (today || "2026-01-01").slice(0, 7) + "-01";
      const offsets = new Set([0, 1, 2, 3]);
      if (planned && /^\d{4}-\d{2}$/.test(planned)) { const o = (+planned.slice(0, 4) - +cur.slice(0, 4)) * 12 + (+planned.slice(5, 7) - +cur.slice(5, 7)) - 1; if (o >= 0 && o <= 11) offsets.add(o); }
      const rows = [...offsets].sort((a, b) => a - b).map((off) => {
        const months = Math.max(0, Math.min(12, remaining - 1 - off));
        const amount = Math.min(room, r0(monthly * months));
        const saving = r0(t0 - taxWith(p, regime, { base: { employerNps: have + amount } }).totalTax);
        const from = addMonthsISO(cur, 1 + off).slice(0, 7);
        return { startsInMonths: off + 1, from, months, amount, saving, netCost: amount - saving, planned: from === planned };
      }).filter((x) => x.amount > 0);
      const full = r0(t0 - taxWith(p, regime, { base: { employerNps: have + room } }).totalTax);
      return { cap: I.npsCap, regime, rows, runRate: { amount: room, saving: full, netCost: room - full } };
    }

    /** New vs old with everything claimed, and the deductions the old regime would need to match the new. */
    function regimeCheck(p) {
      const I = planner.inputs(p), y = I.y;
      if (!y.newRegime) return null;
      const newTax = taxWith(p, "new").totalTax;
      const oldNow = taxWith(p, "old").totalTax;
      const maxDed = engine.capDeductions({ "80C": 1e9, "80D_self": 1e9, "80D_parents": 1e9, "80CCD1B": 1e9, homeLoanInterest: 0 }, { parentsSenior: p.parentsSenior, basic: p.basic });
      const maxExtra = Math.max(0, maxDed["80C"] + maxDed["80CCD1B"] + maxDed["80D"] - I.oldDed);
      const oldMax = taxWith(p, "old", { extraDeductions: maxExtra }).totalTax;
      let lo = 0, hi = 3000000;
      for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (taxWith(p, "old", { extraDeductions: mid }).totalTax > newTax) lo = mid; else hi = mid; }
      const needed = r0(hi);
      return { newTax, oldNow, oldMax, maxDeductions: r0(I.oldDed + maxExtra), hra: r0(I.hra), counted: r0(I.oldDed), breakevenExtra: oldNow <= newTax ? 0 : needed, extraDeductionsPossible: r0(maxExtra), verdict: oldMax < newTax ? "old" : "new", margin: r0(Math.abs(oldMax - newTax)) };
    }

    /** Long-term lots that sit on short-term equity gains and turn long-term soon: waiting cuts the rate from 20% to 12.5%. */
    function waitList(state, who, today, withinDays = 180) {
      const lots = gains.buildLots(state, num((state.fx || {}).usdInr) || 95).lots.filter((l) => l.owner === who && (l.cat === "equity" || l.cat === "hybrid") && l.dateKnown !== false);
      const out = [];
      for (const l of gains.unrealised(lots, today).perLot) {
        if (l.long !== false || !(l.gain > 500)) continue;
        const date = addMonthsISO(l.date, 12), d = daysTo(today, date);
        if (d < 0 || d > withinDays) continue;
        out.push({ name: l.name, kind: l.kind, longTermOn: date, inDays: d, gain: r0(l.gain), saving: r0(l.gain * (engine.RULES.equity.stcgAfter - engine.RULES.equity.ltcgAfter) / 100 * CESS) });
      }
      return out.sort((a, b) => a.inDays - b.inDays).slice(0, 10);
    }

    /** Equity holdings below cost: booking the loss carries it forward 8 years against future gains (only if returns are filed on time). */
    function lossList(state, who, today) {
      const lots = gains.buildLots(state, num((state.fx || {}).usdInr) || 95).lots.filter((l) => l.owner === who && (l.cat === "equity" || l.cat === "hybrid") && l.dateKnown !== false);
      const rows = gains.unrealised(lots, today).perLot.filter((l) => l.gain < -500).map((l) => ({ name: l.name, kind: l.kind, loss: r0(-l.gain), term: l.long ? "long" : "short", valueNow: r0(l.value), futureSaving: r0(-l.gain * (l.long ? engine.RULES.equity.ltcgAfter : engine.RULES.equity.stcgAfter) / 100 * CESS) }));
      return rows.sort((a, b) => b.loss - a.loss).slice(0, 10);
    }

    /** Income taxed at the person's own rate, and how much more each family member could receive before paying tax. */
    function assetLocation(people, profile) {
      const out = { members: [], savingPerLakh: 0, note: "" };
      const me = people.find((x) => x.who === "Me" && x.plan);
      for (const x of people) {
        if (!x.plan) continue;
        const regime = x.plan.better, t = x.taxNow, y = engine.yearRules(x.plan.fy);
        const limit = y.newRegime && regime === "new" ? y.newRegime.rebateUpTo : 0;
        const headroom = limit ? Math.max(0, limit - t.totalIncome) : 0;
        out.members.push({ who: x.who, name: x.name, marginalRate: r0(x.plan.marginalRatePct * CESS * 10) / 10, taxableIncome: t.totalIncome, taxFreeHeadroom: r0(headroom) });
      }
      const par = (profile && profile.parentIncome) || {};
      if (par.taxableIncome != null) {
        const lim = engine.yearRules(me ? me.plan.fy : "2026-27").newRegime.rebateUpTo;
        out.members.push({ who: "Parent", name: par.label || "A parent", marginalRate: 0, taxableIncome: num(par.taxableIncome), taxFreeHeadroom: r0(Math.max(0, lim - num(par.taxableIncome))) });
      }
      const top = out.members.slice().sort((a, b) => b.marginalRate - a.marginalRate)[0];
      out.savingPerLakh = top ? r0(100000 * top.marginalRate / 100) : 0;
      out.note = "Interest, dividends and short-term gains are taxed at the holder's slab rate. Money you give your spouse is added back to your income (sec 64); money from her own salary or from her parents' gifts is hers. A gift to a parent is not clubbed, but the parent must truly own it.";
      return out;
    }

    /** Tax on extra business profit if it is earned by each person. profit = yearly ₹; monthsThisYear = months of it that fall in this tax year. */
    function businessScenarios(people, profits, monthsThisYear = 12) {
      const taxOn = (profit) => {
        const owners = people.filter((x) => x.plan).map((x) => {
          const p = x.inputs, regime = x.plan.better;
          const t1 = taxWith(p, regime, { base: { otherIncome: num(p.otherIncome) + profit } }).totalTax;
          return { who: x.who, name: x.name, extraTax: r0(t1 - x.taxNow.totalTax) };
        });
        const best = owners.slice().sort((a, b) => a.extraTax - b.extraTax)[0], worst = owners.slice().sort((a, b) => b.extraTax - a.extraTax)[0];
        return { owners, saving: worst && best ? worst.extraTax - best.extraTax : 0, bestOwner: best ? best.name : "" };
      };
      return profits.map((profit) => ({ profit, ...taxOn(profit), months: monthsThisYear, thisYear: monthsThisYear < 12 ? { profit: r0(profit * monthsThisYear / 12), ...taxOn(profit * monthsThisYear / 12) } : null }));
    }

    /** What the 87A rebate loss costs a person who becomes a non-resident (the rebate is for residents only). */
    function nonResidentCost(x) {
      if (!x.plan || x.plan.better !== "new") return null;
      const p = x.inputs, I = planner.inputs(p);
      const t1 = engine.computeTax({ ...I.base, regime: "new", exemptAllowances: 0, deductions: 0, nonResident: true }).totalTax;
      return { who: x.who, name: x.name, extraTax: r0(t1 - x.taxNow.totalTax) };
    }

    /**
     * Everything together. people: household people with { who, name, plan, inputs, salary, realised, exemptionLeft, harvest }.
     * Returns { levers[] ranked, perPerson, location, business, nonResident, totals }.
     */
    function build(state, people, profile, today) {
      const fy = (people.find((x) => x.plan) || {}).plan ? people.find((x) => x.plan).plan.fy : null;
      if (!fy) return null;
      for (const x of people) if (x.plan) x.taxNow = engine.computeTax({ ...planner.inputs(x.inputs).base, regime: x.plan.better, exemptAllowances: x.plan.better === "old" ? planner.inputs(x.inputs).hra : 0, deductions: x.plan.better === "old" ? planner.inputs(x.inputs).oldDed : 0 });
      const levers = [], perPerson = [];
      for (const x of people) {
        if (!x.plan) continue;
        const rem = x.salary ? x.salary.remainingMonths : 12;
        const nps = npsByStart(x.inputs, rem, today, profile && profile.npsStart), rc = regimeCheck(x.inputs);
        const wait = waitList(state, x.who, today), losses = lossList(state, x.who, today);
        perPerson.push({ who: x.who, name: x.name, nps, regime: rc, wait, losses });
        const first = nps.rows.find((r) => r.planned) || nps.rows[0];
        if (first && nps.runRate && nps.runRate.saving >= 3000) levers.push({
          id: `nps-${x.who}`, who: x.name, kind: "structure", title: `Employer NPS for ${x.name}`, thisYear: first.saving, runRate: nps.runRate.saving,
          what: `Ask payroll to route ₹${r0(nps.cap / 12).toLocaleString("en-IN")} a month (up to 14% of basic) into NPS from ${monthName(first.from)}${first.planned ? " (your plan)" : ""}: ${inr(first.amount)} this year saves ${inr(first.saving)}; a full year (${inr(nps.runRate.amount)}) saves ${inr(nps.runRate.saving)}. Out of pocket ${inr(nps.runRate.netCost)}, invested for retirement.`,
          needs: ["Your own NPS account (PRAN)", "Employer must offer the option"], risks: ["Locked until 60 (60% tax-free lump sum, 40% annuity)", "Reduces cash salary"], deadline: "", confidence: "high" });
        const ltcgLeft = x.exemptionLeft;
        if (ltcgLeft >= 5000 && x.harvest && x.harvest.picks.length) levers.push({
          id: `harvest-${x.who}`, who: x.name, kind: "timing", title: `Book ${inr(x.harvest.planned)} of long-term gains tax-free for ${x.name}`, thisYear: 0, runRate: r0(x.harvest.planned * engine.RULES.equity.ltcgAfter / 100 * CESS),
          what: `Sell and buy back the units listed in Plan before 31 March. It costs nothing in tax now and lowers the tax on those gains later by up to ${inr(x.harvest.planned * engine.RULES.equity.ltcgAfter / 100 * CESS)} (when the units are eventually sold above the free limit).`,
          needs: ["Check exit loads", "Same-day buy back"], risks: ["Market can move between sell and buy", "Benefit arrives only when you finally sell"], deadline: `${+today.slice(0, 4) + (today.slice(5, 7) >= "04" ? 1 : 0)}-03-31`, confidence: "high" });
        if (wait.length) levers.push({ id: `wait-${x.who}`, who: x.name, kind: "timing", title: `Hold ${wait.length} lot${wait.length === 1 ? "" : "s"} a little longer for ${x.name}`, thisYear: 0, runRate: wait.reduce((a, w) => a + w.saving, 0),
          what: `${wait.map((w) => `${w.name} turns long-term on ${w.longTermOn}`).slice(0, 3).join("; ")}. Selling after that date charges 12.5% instead of 20%.`, needs: [], risks: ["Price risk while you wait"], deadline: wait[0].longTermOn, confidence: "high" });
        if (rc && rc.verdict === "old" && rc.margin > 5000) levers.push({ id: `regime-${x.who}`, who: x.name, kind: "regime", title: `Old regime could beat the new for ${x.name}`, thisYear: rc.margin, runRate: rc.margin, what: `With every deduction claimed the old regime comes to ${inr(rc.oldMax)} against ${inr(rc.newTax)}.`, needs: ["Proofs for each deduction"], risks: ["Employer must be told in April"], deadline: "", confidence: "medium" });
      }
      const loc = assetLocation(people, profile);
      const wifeHead = loc.members.find((m) => m.who === "Wife");
      const meM = loc.members.find((m) => m.who === "Me");
      const taxedOther = people.filter((x) => x.plan).map((x) => ({ who: x.who, name: x.name, other: num(x.inputs.otherIncome) }));
      const meOther = (taxedOther.find((x) => x.who === "Me") || {}).other || 0;
      if (meM && meM.marginalRate >= 20 && meOther >= 10000) levers.push({ id: "location-income", who: "Both", kind: "family", title: "Earn interest and dividends in the lower-taxed name", thisYear: r0(meOther * meM.marginalRate / 100 * Math.min(12, ((people.find((x) => x.who === "Me") || {}).salary || {}).remainingMonths || 12) / 12), runRate: r0(meOther * meM.marginalRate / 100),
        what: `Your own other income of ${inr(meOther)} is taxed at ${meM.marginalRate}%. ${wifeHead ? `${wifeHead.name} can receive about ${inr(wifeHead.taxFreeHeadroom)} more taxable income before paying any tax. ` : ""}Put new fixed-income investments in her name from her own money, or in a parent's name by a real gift. Money you give her is added back to your income.`,
        needs: ["Her own savings or her parents' gifts", "Separate account or folio"], risks: ["Clubbing if the money came from you", "A gift to a parent must be real"], deadline: "", confidence: "high" });
      const bizProfits = [200000, 500000, 1000000];
      if (profile && num(profile.sideBusinessProfit) > 0) bizProfits.unshift(num(profile.sideBusinessProfit));
      let bizMonths = 12;
      if (profile && /^\d{4}-\d{2}-\d{2}$/.test(profile.sideBusinessStart || "")) {
        const st = profile.sideBusinessStart, fyStartY = +fy.slice(0, 4);
        if (st > `${fyStartY + 1}-03-31`) bizMonths = 0; else if (st >= `${fyStartY}-04-01`) { const m = +st.slice(5, 7); bizMonths = m >= 4 ? 16 - m : 4 - m; }
      }
      const business = businessScenarios(people, bizProfits, bizMonths);
      const nri = people.map(nonResidentCost).filter(Boolean);
      levers.sort((a, b) => (b.thisYear + b.runRate * 0.5) - (a.thisYear + a.runRate * 0.5));
      const totals = { thisYear: levers.reduce((a, l) => a + l.thisYear, 0), runRate: levers.reduce((a, l) => a + l.runRate, 0) };
      return { fy, levers, perPerson, location: loc, business, businessMonthsThisYear: bizMonths, nonResident: nri, totals };
    }

    /** Next year's tax if salary grows by growthPct (assumed rules). */
    function nextYear(x, growthPct) {
      if (!x.plan) return null;
      const g = 1 + num(growthPct) / 100, fy = nextFy(x.plan.fy);
      const p = { ...x.inputs, fy, grossSalary: r0(x.inputs.grossSalary * g), basic: r0(x.inputs.basic * g), hraReceived: r0(x.inputs.hraReceived * g), realisedLtcgYtd: 0, realisedStcgYtd: 0, employerNps: 0, tdsProjected: 0 };
      const pl = planner.plan(p, "2000-01-01");
      return { fy, regime: pl.better, tax: pl.regimes[pl.better].tax, levers: pl.levers.slice(0, 3).map((l) => ({ id: l.id, saving: l.yearlySaving })) };
    }

    return { build, npsByStart, regimeCheck, waitList, lossList, assetLocation, businessScenarios, nonResidentCost, nextYear, taxWith };
  })();

  // ════════════════════════════ household ════════════════════════════
  // Joins the app's own data (salary records, holdings, insurance) with the household's tax profile and filed returns, and
  // answers: where do we stand this year, what is overdue or due soon, and what should be done next. No personal data lives
  // here; the profile and the returns live in the encrypted vault (state.taxProfile, state.taxReturns, state.taxFamily).
  const household = (function () {
    const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
    const r0 = (v) => Math.round(v);
    const NAMES = { Me: "Prafful", Wife: "Archana" };
    const PEOPLE = ["Me", "Wife"];
    const inr = (v) => (v < 0 ? "−" : "") + "₹" + Math.abs(Math.round(num(v))).toLocaleString("en-IN");
    const addDays = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
    const daysTo = (from, to) => Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 864e5);
    const fyStartYear = (fy) => +fy.slice(0, 4);

    /** The financial year a salary record belongs to: the month of its date is the pay month (the salary sheet dates a month's pay on the 1st; manual entries use the credit date). */
    function salaryFy(iso) {
      const y = +iso.slice(0, 4), m = +iso.slice(5, 7);
      return m >= 4 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
    }

    /**
     * Salary for a financial year from the income records: what has been paid so far plus the typical month for the rest.
     * Returns { months, gross, basic, hra, pf, tds, professionalTax, typicalMonthlyGross, basedOn } or null when there is none.
     */
    /** 1 = April … 12 = March for the month a salary record pays. */
    function payIdx(iso) { const m = +iso.slice(5, 7); return m >= 4 ? m - 3 : m + 9; }
    const MONTH_NAMES = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
    function salaryProjection(state, who, fy) {
      const all = (state.income || []).filter((i) => (i.person || "Me") === who && (!i.type || /salary/i.test(i.type)) && num(i.grossEarnings) > 0)
        .sort((a, b) => (a.date < b.date ? -1 : 1));
      const rows = all.filter((i) => salaryFy(i.date) === fy);
      const prevFy = `${fyStartYear(fy) - 1}-${String(fyStartYear(fy)).slice(2)}`;
      const source = rows.length ? rows : all.filter((i) => salaryFy(i.date) === prevFy);
      if (!source.length) return null;
      const recent = source.slice(-3), mean = (k, set = recent) => set.reduce((a, r) => a + num(r[k]), 0) / set.length;
      // Bonus months distort the average: the typical month is the median of the last six gross figures.
      const grossSorted = source.slice(-6).map((r) => num(r.grossEarnings)).sort((a, b) => a - b), typical = grossSorted[Math.floor(grossSorted.length / 2)];
      const scale = typical / (mean("grossEarnings") || typical || 1);
      const last = recent[recent.length - 1];
      const monthly = (k) => (k === "grossEarnings" ? typical : num(last[k]));
      const sum = (k) => rows.reduce((a, r) => a + num(r[k]), 0);
      let lastIdx = 0, missing = [];
      if (rows.length) {
        const have = new Set(rows.map((r) => payIdx(r.date)));
        lastIdx = Math.max(...have);
        for (let i = 1; i <= lastIdx; i++) if (!have.has(i)) missing.push(MONTH_NAMES[i - 1]);
      }
      const remaining = rows.length ? 12 - lastIdx : 12;
      const imputed = missing.length + remaining;   // months estimated from the typical month
      return {
        fy, months: rows.length, remainingMonths: remaining, missingMonths: missing, lastPaidMonth: rows.length ? MONTH_NAMES[lastIdx - 1] : null,
        basedOn: rows.length ? "this year so far plus a typical month" : "last year's salary",
        gross: r0(sum("grossEarnings") + imputed * monthly("grossEarnings")), basic: r0(sum("basicSalary") + imputed * monthly("basicSalary")),
        hra: r0(sum("hra") + imputed * monthly("hra")), pf: r0(sum("pf") + imputed * monthly("pf")),
        tds: r0(sum("taxTds") + imputed * mean("taxTds")), professionalTax: Math.min(2500, r0(sum("professionalTax") + imputed * (num(last.professionalTax) || 200))),
        typicalMonthlyGross: r0(typical), scale: Math.round(scale * 100) / 100, employer: last.organization || "",
      };
    }

    const sumVal = (list, k = "value") => (list || []).reduce((a, x) => a + num(x[k]), 0);

    /** Everything a person's plan needs from the vault and the profile. */
    function personInputs(state, profile, who, fy, today) {
      const sal = salaryProjection(state, who, fy);
      if (!sal) return null;
      const pr = profile || {}, per = (o) => (o && o[who]) || {};
      const lots = gains.buildLots(state, num((state.fx || {}).usdInr) || 95);
      const realised = gains.realisedThisFY(lots.realised, today);
      const g = realised.owners[who] || { equityST: 0, equityLT: 0 };
      const extra = per(pr.realisedExtra);
      const hasForeign = (state.usstocks || []).some((s) => (s.owner || "Me") === who && num(s.quantity) > 0) || !!per(pr.foreignAssets).held;
      return {
        plan: {
          fy, person: NAMES[who], grossSalary: sal.gross, basic: sal.basic, hraReceived: sal.hra, rentPaid: num(per(pr.rentMonthly)) * 12, metro: !!pr.metro,
          professionalTax: sal.professionalTax, otherIncome: num(per(pr.otherIncome)), employerNps: num(per(pr.employerNps)), gains: {},
          realisedLtcgYtd: Math.max(0, g.equityLT + num(extra.ltcg)), realisedStcgYtd: g.equityST + num(extra.stcg),
          deductionsPaid: per(pr.deductionsPaid), parentsSenior: !!pr.parentsSenior, tdsProjected: sal.tds,
          hasForeignAssets: hasForeign, hasShareSales: g.equityLT !== 0 || g.equityST !== 0 || num(extra.ltcg) !== 0 || num(extra.stcg) !== 0,
        },
        salary: sal, realised: { ltcg: g.equityLT + num(extra.ltcg), stcg: g.equityST + num(extra.stcg) },
      };
    }

    /** Dates that matter, soonest first. Legal dates are the same for everyone; the rest depend on the profile. */
    function deadlines(model, today) {
      const out = [], y = +today.slice(0, 4);
      const add = (date, title, kind, why, who) => { const d = daysTo(today, date); if (d >= -30 && d <= 400) out.push({ date, inDays: d, title, kind, why: why || "", who: who || "" }); };
      add("2026-12-31", "Last fee-free day to revise the FY 2025-26 return; FAST-DS 2026 window closes", "law", "After 31 Dec a fee of ₹1,000–5,000 applies to a revision, up to 31 Mar 2027.");
      add("2027-03-31", "Last day to revise the FY 2025-26 return", "law", "Updated-return (ITR-U) extra tax for FY 2021-22 to FY 2024-25 steps up on 1 April.");
      for (const [yr, mo] of [[y, 1], [y, 4], [y, 7], [y, 10], [y + 1, 1]]) add(`${yr}-${String(mo).padStart(2, "0")}-01`, "Check the income-tax portal for notices", "tax", "Pending Actions → e-Proceedings and Worklist. Nothing there means no open proceedings for any year.");
      for (const yr of [y, y + 1]) {
        add(`${yr}-03-31`, "Last day of the year: book long-term gains up to the free limit, book losses, renew policies", "tax", "Each person's ₹1.25L long-term-gain exemption resets on 1 April.");
        add(`${yr}-07-31`, "Income-tax return due (ITR-1/ITR-2)", "tax", "Download AIS/TIS, Form 16 and broker reports first, run the audit.");
      }
      // Advance tax only for people whose tax after TDS is ₹10,000 or more, with the amount to have paid by each date.
      for (const p of model.people || []) for (const a of (p.plan && p.plan.advanceTax) || []) add(a.date, `Advance tax for ${p.name}: ${inr(a.cumulativeAmount)} paid in total (${a.cumulativePct}%)`, "tax", "Tax after TDS is ₹10,000 or more, so instalments apply.", p.name);
      for (const r of model.returnsAudit || []) if (r.remedy && r.remedy.lastDate && r.remedy.pctExtra && r.extraTax > 0 && r.fy !== model.fy) add(r.remedy.lastDate, `Last day to correct FY ${r.fy} by an updated return`, "law", `Extra tax rate is ${r.remedy.pctExtra}% now; it steps up on 1 April.`, NAMES[r.person] || r.person);
      const dep = model.profile && model.profile.departure;
      if (dep && dep.date) add(dep.date, "Planned departure abroad", "plan", "Residential status, NRO/NRE accounts, KYC updates and insurance must be settled before this date.");
      return out.sort((a, b) => (a.date < b.date ? -1 : 1));
    }

    /** What the filed returns look like when checked against their evidence, plus the cost of correcting each year. */
    function returnsAudit(state, today) {
      const rows = [];
      for (const r of state.taxReturns || []) {
        if (r.kind === "unfiled") {
          const t = engine.computeTax({ fy: r.fy, regime: r.regime || "old", grossSalary: r.grossSalary, exemptAllowances: r.exemptAllowances, deductions: r.deductions, otherIncome: r.otherIncome, gains: r.gains });
          const shortfall = t.totalTax - num(r.tds), ay = engine.ayOf(r.fy);
          rows.push({ id: r.id, fy: r.fy, ay, person: r.person, unfiled: true, correctedTax: t.totalTax, extraTax: Math.max(0, shortfall), findings: [], remedy: shortfall > 0 ? remedies.itrUCost({ ay, additionalTax: shortfall, asOf: today }) : null, note: r.note || "" });
          continue;
        }
        let a; try { a = audit.audit({ fy: r.fy, person: r.person, filed: r.filed, evidence: r.evidence }); } catch (e) { rows.push({ id: r.id, fy: r.fy, person: r.person, error: e.message, findings: [] }); continue; }
        const extra = Math.max(0, a.extraTaxIfCorrected);
        rows.push({
          id: r.id, fy: r.fy, ay: a.ay, person: r.person, form: a.form, regime: a.regime, filedTax: a.filedTax, correctedTax: a.correctedTax, extraTax: extra,
          refundClaimed: a.refundClaimed, refundOnDocuments: a.refundOnDocumentedFigures, findings: a.findings,
          remedy: extra > 0 ? (a.ay === "2026-27" ? remedies.revisedReturn({ ay: a.ay, asOf: today }) : remedies.itrUCost({ ay: a.ay, additionalTax: extra, asOf: today })) : null, note: r.note || "",
        });
      }
      return rows.sort((a, b) => (a.fy < b.fy ? 1 : -1));
    }

    /** The ranked to-do list: what to do next and why. */
    function actions(model, state, today) {
      const out = [];
      const add = (id, severity, title, why, due, extra) => out.push({ id, severity, title, why, due: due || "", ...(extra || {}) });
      const ord = { high: 0, medium: 1, low: 2 };
      for (const latest of (model.returnsAudit || []).filter((r) => !r.unfiled && r.ay === "2026-27" && r.extraTax > 0)) {
        const hi = latest.findings.filter((f) => f.severity === "high").length;
        add(`revise-${latest.person}`, "high", `Revise the FY ${latest.fy} return`, `${hi} high-severity item${hi === 1 ? "" : "s"}. On the documents the ${inr(latest.refundClaimed)} refund would instead be ${latest.refundOnDocuments < 0 ? `about ${inr(-latest.refundOnDocuments)} to pay` : `${inr(latest.refundOnDocuments)}`}. Fee-free until 31 Dec 2026.`, "2026-12-31", { who: latest.person === "Me" ? NAMES.Me : NAMES.Wife });
      }
      for (const r of model.returnsAudit || []) {
        if (r.fy === model.fy || r.ay === "2026-27" || !(r.extraTax > 0) || !r.remedy || !r.remedy.open) continue;
        add(`itru-${r.fy}-${r.person}`, "medium", `Decide on an updated return for FY ${r.fy}`, `About ${inr(r.remedy.totalToPay)} to correct (${r.remedy.pctExtra}% extra on tax and interest); the rate steps up on 1 April. ${r.unfiled ? "No return was filed for this year." : ""}`, r.remedy.lastDate, { who: NAMES[r.person] || r.person });
      }
      const us = sumVal(state.usstocks, "currentValue") || sumVal(state.usstocks);
      const faMissing = (model.returnsAudit || []).some((r) => (r.findings || []).some((f) => f.id === "schedule-fa"));
      if (faMissing && today <= "2026-12-31") {
        const fee = remedies.fastDs({ valueAtMar2026: us, taxedIncome: true, peakValueInr: us, asOf: today });
        add("fast-ds", us > 0 && fee.cost > us * 0.25 ? "low" : "medium", "FAST-DS 2026: decide before 31 Dec", `Scheme cost ${inr(fee.cost)} against a US account worth about ${inr(us)}. ${fee.cost > us * 0.25 ? "The fee is a large share of the account; disclosing it in the revised return is usually cheaper." : "Compare with disclosing it in the revised return."}`, "2026-12-31");
      }
      for (const p of model.people) {
        if (p.plan && p.plan.advanceTax && p.plan.advanceTax.length && p.plan.nextAdvance) add(`adv-${p.who}`, "medium", `Advance tax for ${p.name}`, `Pay ${inr(p.plan.nextAdvance.cumulativeAmount)} in total by ${p.plan.nextAdvance.date} to avoid interest.`, p.plan.nextAdvance.date, { who: p.name });
        if (p.plan && p.plan.balance >= 15000 && p.salary && p.salary.remainingMonths >= 2) {
          const per = Math.round(p.plan.balance / p.salary.remainingMonths / 100) * 100;
          add(`tds-${p.who}`, "low", `${p.name}'s TDS is running about ${inr(p.plan.balance)} above the year's tax`, `Ask payroll to review the monthly TDS (about ${inr(per)} a month less) so the money reaches you now instead of as a refund. Share rent and deduction declarations with them.`, "", { who: p.name });
        }
        for (const l of (p.plan && p.plan.levers) || []) {
          if (l.id === "employer-nps" && l.yearlySaving >= 10000) add(`nps-${p.who}`, "medium", `Employer NPS could save ${p.name} about ${inr(l.yearlySaving)} a year`, l.detail, "");
          if (l.id === "ltcg-harvest" && today >= `${+today.slice(0, 4)}-01-15` && today <= `${+today.slice(0, 4)}-03-31` && l.yearlySaving > 1000) add(`harvest-${p.who}`, "medium", `Book tax-free long-term gains for ${p.name} before 31 March`, l.title + ". " + l.detail, `${+today.slice(0, 4)}-03-31`);
        }
      }
      for (const p of model.people) if (p.salary && p.salary.missingMonths && p.salary.missingMonths.length) add(`missing-${p.who}`, "low", `${p.name}: salary for ${p.salary.missingMonths.join(", ")} is missing from your income records`, "The tax numbers estimate those months from a typical month. Adding the real payslip makes the year's tax and TDS exact.", "", { who: p.name });
      // Decisions the household has already made become dated steps.
      const prof = model.profile || {};
      if (prof.npsStart && today < `${prof.npsStart}-01`) {
        const askBy = addDays(`${prof.npsStart}-01`, -30).slice(0, 10);
        add("nps-open", "medium", "Open your NPS account (Tier I)", `Employer NPS needs your own account (PRAN). Planned employer start: ${prof.npsStart}.`, askBy, { who: NAMES.Me });
        add("nps-hr", "medium", `Ask TCS HR to start employer NPS from ${prof.npsStart}`, "Ask for the effective month in writing, the percentage of basic (up to 14%), and that it is a CTC restructure, not an extra deduction.", askBy, { who: NAMES.Me });
      }
      if (prof.sideBusinessStart && today < addDays(prof.sideBusinessStart, 60)) {
        const st = prof.sideBusinessStart, y1 = +st.slice(0, 4);
        add("biz-setup", "medium", "Side business: set up before the first rupee comes in", "Decide who owns it (the lower-taxed spouse, only if she does the work and the capital is hers), open a separate current account, keep invoices, and note the GST limit (₹20L for services).", addDays(st, -14).slice(0, 10), { who: "Both" });
        add("biz-tax", "low", "Side business: tax steps", `Business income means ITR-3 or ITR-4 (not ITR-2/ITR-1) for the owner, due 31 August ${y1 + 1}. Under the presumptive scheme, advance tax is one payment by 15 March. Ask a CA which scheme fits.`, `${y1 + 1}-03-15`, { who: "Both" });
      }
      // Protection: cover gaps are tax-adjacent (80C/80D in the old regime) and the biggest financial risk.
      const pol = state.insurance || [];
      const has = (who, type) => pol.some((p) => (p.person === who || p.person === "Both") && p.type === type && num(p.cover) > 0);
      if (!has("Me", "Term life")) add("term-me", "high", "Buy term life cover", "No term cover is recorded. A pure term plan of 10–15× yearly income is the usual guide.", "");
      if (!has("Wife", "Term life")) add("term-wife", "medium", "Term life cover for Archana", "No term cover is recorded for her.", "");
      if (!has("Both", "Health") && !pol.some((p) => p.type === "Health" && num(p.cover) > 0)) add("health", "medium", "Record your health cover, and compare personal policies", "No health policy is recorded. Employer group cover ends when the job does; personal cover started now starts its waiting periods now.", "");
      // User-supplied checklist (stored in the vault, so it can hold private items)
      const done = (model.profile && model.profile.done) || {};
      for (const c of (model.profile && model.profile.checklist) || []) if (c && c.id && !done[c.id]) add(`todo-${c.id}`, c.severity || "low", c.title, c.why || "", c.due || "");
      return out.sort((a, b) => ord[a.severity] - ord[b.severity] || (a.due || "9999") .localeCompare(b.due || "9999"));
    }

    /** Move-abroad what-if for a planned departure date. */
    function departureView(dep, fy) {
      if (!dep || !dep.date) return null;
      const out = [];
      for (const yr of [fy, `${fyStartYear(fy) + 1}-${String(fyStartYear(fy) + 2).slice(2)}`]) {
        const startsIn = dep.date >= `${fyStartYear(yr)}-04-01` && dep.date <= `${fyStartYear(yr) + 1}-03-31`;
        const stay = startsIn ? residency.daysInIndiaForDeparture(yr, dep.date) : (dep.date < `${fyStartYear(yr)}-04-01` ? num(dep.visitDays) : 365);
        const prev = Array.from({ length: 10 }, () => ({ resident: true, days: 330 }));
        const st = residency.residentialStatus({ daysInIndia: stay, daysPrev4: 1300, citizen: true, leftForEmployment: true, prevYears: prev });
        out.push({ fy: yr, daysInIndia: stay, status: st.status, globalIncomeTaxed: st.globalIncomeTaxed, note: st.note });
      }
      return { departure: dep.date, latestForNonResidentThisYear: residency.latestDepartureForNonResident(fy), years: out };
    }

    /**
     * Which long-term equity lots to sell (and buy back) to use up a person's unused ₹1.25L exemption, best "gain per rupee sold"
     * first. Funds and demat holdings sell oldest-first, so only the leading run of long-term lots in each holding can be sold.
     * Lots with an unknown buy date (broker imports) are left out. Returns { target, planned, picks[], shortfall }.
     */
    function harvestPlan(state, who, target, today) {
      const lots = gains.buildLots(state, num((state.fx || {}).usdInr) || 95).lots.filter((l) => l.owner === who && (l.cat === "equity" || l.cat === "hybrid") && l.dateKnown !== false);
      const groups = new Map();
      for (const l of lots) { const k = l.kind + "|" + l.name; (groups.get(k) || groups.set(k, []).get(k)).push(l); }
      const cands = [];
      for (const ls of groups.values()) {
        ls.sort((a, b) => (a.date < b.date ? -1 : 1));
        const run = []; for (const l of ls) { if (!gains.holding(l, today).long) break; run.push(l); }
        const gain = run.reduce((a, l) => a + l.qty * l.price - l.cost, 0), value = run.reduce((a, l) => a + l.qty * l.price, 0);
        if (run.length && gain > 0 && value > 0) cands.push({ name: ls[0].name, kind: ls[0].kind, run, gain, value });
      }
      cands.sort((a, b) => b.gain / b.value - a.gain / a.value);
      let remaining = Math.max(0, num(target)); const picks = [];
      for (const c of cands) {
        if (remaining < 1) break;
        let units = 0, value = 0, gain = 0;
        for (const l of c.run) {
          const lg = l.qty * l.price - l.cost;
          if (lg <= 0 || gain + lg <= remaining) { units += l.qty; value += l.qty * l.price; gain += lg; }
          else { const f = (remaining - gain) / lg; units += l.qty * f; value += l.qty * l.price * f; gain += lg * f; break; }
        }
        if (gain > 0) { picks.push({ name: c.name, kind: c.kind, units: Math.round(units * 1000) / 1000, value: r0(value), gain: r0(gain) }); remaining -= gain; }
      }
      return { target: r0(target), planned: r0(num(target) - remaining), picks, shortfall: r0(Math.max(0, remaining)) };
    }

    const FILING = [
      ["form16", "Form 16 from each employer (arrives by mid-June)"], ["ais", "Annual Information Statement and TIS from the portal (AIS menu)"], ["26as", "Form 26AS"],
      ["brokers", "Tax P&L / capital-gains report from every broker and fund house (Zerodha, Groww, Upstox, INDmoney, mutual funds)"],
      ["us", "US account: INDmoney tax report, Form 1042-S, and the peak and year-end value for Schedule FA (calendar year)"], ["form67", "Form 67 for US tax credit, filed before the return, if US dividends were paid"],
      ["interest", "Interest certificates and Form 16A from every bank"], ["epf", "EPF and PPF statements"],
      ["old", "Only if you use the old regime: premium receipts, rent receipts and agreement with landlord PAN, donation receipts"],
      ["audit", "Run this page's check against those documents before anything is filed"], ["archana", "The same for Archana, and file her return on time so her losses carry forward"],
      ["verify", "E-verify the return within 30 days of filing"],
    ];
    /** The July filing checklist for a financial year, with done flags kept in profile.filingDone[fy][id]. */
    function filingChecklist(profile, fy) {
      const done = ((profile || {}).filingDone || {})[fy] || {};
      return FILING.map(([id, title]) => ({ id, title, done: done[id] || null }));
    }

    /** The whole picture for the Tax tab and the daily brief. */
    function build(state, today) {
      const profile = state.taxProfile || {};
      const fy = gains.fyOf(today);
      const model = { asOf: today, fy, ay: engine.ayOf(fy), profile, people: [], returnsAudit: [], deadlines: [], actions: [], family: [], departure: null };
      for (const who of PEOPLE) {
        const inp = personInputs(state, profile, who, fy, today);
        if (!inp) { model.people.push({ who, name: NAMES[who], plan: null, note: "No salary record found for this financial year." }); continue; }
        const plan = planner.plan(inp.plan, today);
        const exemptionLeft = Math.max(0, engine.RULES.equity.exemptionFromFY2425 - Math.max(0, inp.realised.ltcg));
        model.people.push({ who, name: NAMES[who], salary: inp.salary, realised: inp.realised, plan, inputs: inp.plan, exemptionLeft, harvest: exemptionLeft > 1000 ? harvestPlan(state, who, exemptionLeft, today) : null });
      }
      model.returnsAudit = returnsAudit(state, today);
      model.family = (state.taxFamily || []).map((t) => ({ ...t, result: gifts.classifyGift(t, { marriageDate: profile.marriageDate }) }));
      model.departure = departureView(profile.departure, fy);
      model.filing = filingChecklist(profile, fy);
      try {
        model.savings = saver.build(state, model.people, profile, today);
        const growth = profile.salaryGrowthPct != null ? num(profile.salaryGrowthPct) : 8;
        model.nextYear = { growthPct: growth, people: model.people.map((x) => ({ who: x.who, name: x.name, ...(saver.nextYear(x, growth) || {}) })) };
      } catch (e) { model.savings = null; model.savingsError = e.message; }
      model.deadlines = deadlines(model, today);
      model.actions = actions(model, state, today);
      model.law = law.lawStatus(today);
      return model;
    }

    return { build, salaryProjection, salaryFy, personInputs, returnsAudit, deadlines, actions, departureView, harvestPlan, filingChecklist };
  })();

  return { law, engine, remedies, gifts, residency, audit, planner, gains, saver, household };
});
