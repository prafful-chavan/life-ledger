/** Life Ledger MCP — what is coming up (pure): birthdays, policy renewals, tax dates, salary day, SIP progress. */
const Protection = require("../protection-core.js");
const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const day = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const daysTo = (from, to) => Math.round((day(to) - day(from)) / 86400000);

function nextOccurrence(today, month, d) {
  const y = +today.slice(0, 4);
  let iso = `${y}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (iso < today) iso = `${y + 1}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return iso;
}
const lastDayOfMonth = (today) => new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7), 0)).toISOString().slice(0, 10);

function calendar(state, today, horizonDays = 75) {
  const items = [];
  const add = (date, what, kind, note) => { const d = daysTo(today, date); if (d >= 0 && d <= horizonDays) items.push({ date, inDays: d, what, kind, note: note || null }); };
  for (const [k, p] of Object.entries(state.people || {})) {
    const nb = Protection.nextBirthday(p.dob, today);
    if (nb) add(nb.date, `${k === "me" ? "Prafful" : "Archana"} turns ${nb.turning}`, "birthday");
  }
  for (const p of state.insurance || []) if (p.nextDue) add(p.nextDue.slice(0, 10), `${p.policyName || p.type} renewal (${p.person})`, "renewal", p.premium ? `₹${Math.round(num(p.premium)).toLocaleString("en-IN")}` : null);
  add(lastDayOfMonth(today), "Salary credit day — it pays next month's spending", "salary");
  add(nextOccurrence(today, 12, 15), "Advance tax instalment (only if tax after TDS exceeds ₹10,000)", "tax");
  add(nextOccurrence(today, 3, 15), "Advance tax final instalment", "tax");
  add(nextOccurrence(today, 3, 31), "Last day of the financial year: tax-saving investments (80C), gain/loss harvesting, and ELSS SIPs must be done", "tax");
  add(nextOccurrence(today, 7, 31), "ITR filing due date for salaried individuals", "tax");
  return items.sort((a, b) => a.inDays - b.inDays);
}

function sipProgress(state, today) {
  const month = today.slice(0, 7), target = state.mfMonthlyTarget || {};
  const done = { Me: 0, Wife: 0 };
  for (const t of state.mutualFunds || []) {
    if (t.transactionType === "REDEMPTION") continue;
    if (String(t.purchaseDate || t.date).slice(0, 7) === month) done[t.owner || "Me"] = (done[t.owner || "Me"] || 0) + num(t.invested);
  }
  const dim = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7), 0)).getUTCDate(), dom = +today.slice(8, 10);
  return { month, targetMe: num(target.me), targetWife: num(target.wife), investedMe: Math.round(done.Me), investedWife: Math.round(done.Wife), monthElapsedPct: Math.round((dom / dim) * 100) };
}

module.exports = { calendar, sipProgress };
