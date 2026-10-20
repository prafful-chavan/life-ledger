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

module.exports = { residentialStatus, daysInIndiaForDeparture, latestDepartureForNonResident };
