/**
 * Life Ledger — Protection (pure; no DOM): ages and birthdays, insurance renewals and cover checks, vehicle totals,
 * and starter goal suggestions built from the household's own numbers.
 * The cover figures are common rules of thumb, shown as guidance only — never as advice.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerProtection = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const PERIODS = { Monthly: 12, Quarterly: 4, "Half-yearly": 2, Yearly: 1 };
  const MONTHS_STEP = { Monthly: 1, Quarterly: 3, "Half-yearly": 6, Yearly: 12 };
  const isoOf = (y, m, d) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const parts = (iso) => { const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; };
  const utc = (iso) => { const p = parts(iso); return p ? Date.UTC(p.y, p.m - 1, p.d) : NaN; };
  const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);

  function ageOn(dob, today) {
    const b = parts(dob), t = parts(today);
    if (!b || !t) return null;
    let a = t.y - b.y;
    if (t.m < b.m || (t.m === b.m && t.d < b.d)) a--;
    return a;
  }

  /** Next birthday on or after `today`: { date, days, turning }. */
  function nextBirthday(dob, today) {
    const b = parts(dob), t = parts(today);
    if (!b || !t) return null;
    let y = t.y;
    if (b.m < t.m || (b.m === t.m && b.d < t.d)) y++;
    const date = isoOf(y, b.m, b.d);
    return { date, days: daysBetween(today, date), turning: y - b.y };
  }

  const annualPremium = (p) => num(p && p.premium) * (PERIODS[p && p.frequency] || 1);

  /** 'overdue' | 'soon' (within soonDays) | 'ok' | 'none' */
  function dueStatus(nextDue, today, soonDays = 30) {
    if (!parts(nextDue)) return { state: "none", days: null };
    const days = daysBetween(today, nextDue);
    return { state: days < 0 ? "overdue" : days <= soonDays ? "soon" : "ok", days };
  }

  /** The due date after paying: the next period, counted from the current due date. */
  function advanceDue(nextDue, frequency) {
    const p = parts(nextDue);
    if (!p) return nextDue;
    const total = p.m - 1 + (MONTHS_STEP[frequency] || 12);
    const y = p.y + Math.floor(total / 12), m = (total % 12) + 1;
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return isoOf(y, m, Math.min(p.d, last));
  }

  /** Latest monthly net salary per person (Me / Wife), from the income records. */
  function monthlyIncome(state, who) {
    const rows = (state.income || []).filter((i) => (i.person || "Me") === who).sort((a, b) => (a.date < b.date ? 1 : -1));
    const r = rows[0];
    return r ? num(r.netSalary) || num(r.amount) : 0;
  }

  /** Average monthly spending over the last 6 complete months before `today`. */
  function monthlySpending(state, today) {
    const t = parts(today);
    if (!t) return 0;
    const keys = [];
    for (let i = 1; i <= 6; i++) { const d = new Date(Date.UTC(t.y, t.m - 1 - i, 1)); keys.push(d.toISOString().slice(0, 7)); }
    const set = new Set(keys);
    const total = (state.expenses || []).reduce((s, e) => (set.has(String(e.date).slice(0, 7)) ? s + num(e.amount) : s), 0);
    return total / 6;
  }

  const sumOf = (list) => (list || []).reduce((s, x) => s + num(x.value), 0);
  const TERM = "Term life", HEALTH = "Health";
  const coverOf = (state, who, type) => (state.insurance || []).filter((p) => p.type === type && (p.person === who || p.person === "Both")).reduce((s, p) => s + num(p.cover), 0);

  /** Term life cover versus 10–15 × yearly income (a common rule of thumb). */
  function termCheck(state, who) {
    const income = monthlyIncome(state, who) * 12;
    const cover = (state.insurance || []).filter((p) => p.type === TERM && p.person === who).reduce((s, p) => s + num(p.cover), 0);
    const min = income * 10, max = income * 15;
    const status = cover <= 0 ? "not-set" : cover < min ? "low" : "ok";
    return { who, income, cover, min, max, status };
  }

  /** Family health cover versus a common ₹10 lakh baseline. */
  function healthCheck(state, baseline = 1000000) {
    const cover = (state.insurance || []).filter((p) => p.type === HEALTH).reduce((s, p) => s + num(p.cover), 0);
    return { cover, baseline, status: cover <= 0 ? "not-set" : cover < baseline ? "low" : "ok" };
  }

  function summary(state, today) {
    const pol = state.insurance || [];
    const yearly = pol.reduce((s, p) => s + annualPremium(p), 0);
    const income = monthlyIncome(state, "Me") * 12 + monthlyIncome(state, "Wife") * 12;
    const due = pol.map((p) => ({ p, s: dueStatus(p.nextDue, today) })).filter((x) => x.s.state === "overdue" || x.s.state === "soon").sort((a, b) => a.s.days - b.s.days);
    return {
      vehiclesValue: (state.vehicles || []).reduce((s, v) => s + num(v.value), 0),
      yearlyPremium: yearly, premiumShareOfIncome: income > 0 ? (yearly / income) * 100 : null,
      dueSoon: due, term: ["Me", "Wife"].map((w) => termCheck(state, w)), health: healthCheck(state),
    };
  }

  /** Starter goals worked out from the household's own numbers; names already used are left out. */
  function suggestGoals(state, today) {
    const have = new Set((state.goals || []).map((g) => String(g.name || "").toLowerCase()));
    const monthly = monthlySpending(state, today);
    const out = [];
    const round = (v, step) => Math.round(v / step) * step;
    if (monthly > 0 && !have.has("emergency fund")) {
      out.push({
        key: "emergency", name: "Emergency fund", category: "Finance", owner: "Both", track: "",
        target: round(monthly * 6, 10000), saved: Math.round(sumOf(state.banksaving) + sumOf(state.fd)), dueDate: "",
        why: `Six months of your usual spending (about ₹${Math.round(monthly).toLocaleString("en-IN")} a month). Progress starts from your bank savings and FDs.`,
      });
    }
    const me = ((state.people || {}).me || {}).dob;
    if (monthly > 0 && !have.has("retirement corpus")) {
      const p = parts(me);
      out.push({
        key: "retirement", name: "Retirement corpus", category: "Finance", owner: "Both", track: "All my assets",
        target: round(monthly * 12 * 25, 100000), saved: 0, dueDate: p ? isoOf(p.y + 60, p.m, p.d) : "",
        why: "25 × a year of today's spending (the common “4% rule”, before inflation), due when you turn 60. Progress follows all your assets.",
      });
    }
    return out;
  }

  return { ageOn, nextBirthday, annualPremium, dueStatus, advanceDue, monthlyIncome, monthlySpending, termCheck, healthCheck, summary, suggestGoals, coverOf, PERIODS };
});
