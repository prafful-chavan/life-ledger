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

module.exports = { itrUTier, itrUCost, estimateInterest, revisedReturn, fastDs, monthsBetween };
