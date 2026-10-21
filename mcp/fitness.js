/**
 * Life Ledger MCP — fitness and motivation facts (pure). Habit names are deliberately NOT returned: only counts and streaks.
 */
const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const r1 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
const day = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const daysBetween = (a, b) => Math.round((day(b) - day(a)) / 86400000);
const addDays = (iso, n) => new Date(day(iso) + n * 86400000).toISOString().slice(0, 10);

function fitnessReport(state, today) {
  const goals = state.fitnessGoals || {};
  const body = (state.bodyMetrics || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const latest = body[body.length - 1];
  const nearest = (n) => { const target = addDays(today, -n); let best = null; for (const b of body) if (b.date <= target) best = b; return best; };
  const bodyOut = latest ? {
    lastMeasured: latest.date, daysAgo: daysBetween(latest.date, today), weightKg: latest.weight, bmi: latest.bmi, bodyFatPct: latest.bodyFat, visceralFat: latest.visceralFat, muscleKg: latest.muscleMass, bodyAge: latest.bodyAge,
    weightChange: { vs90d: nearest(90) ? r1(latest.weight - nearest(90).weight) : null, vs365d: nearest(365) ? r1(latest.weight - nearest(365).weight) : null },
    bodyFatChange365d: nearest(365) ? r1(latest.bodyFat - nearest(365).bodyFat) : null,
    stale: daysBetween(latest.date, today) > 45,
  } : null;

  const within = (list, from) => (list || []).filter((x) => x.date >= from && x.date <= today);
  const w30 = within(state.workouts, addDays(today, -30)), w7 = within(state.workouts, addDays(today, -6));
  const lastWorkout = (state.workouts || []).map((w) => w.date).sort().pop() || null;
  const acts14 = within(state.activities, addDays(today, -13));
  const stepsByDay = {};
  for (const a of acts14) if (a.type === "steps") stepsByDay[a.date] = Math.max(stepsByDay[a.date] || 0, num(a.steps));
  const stepDays = Object.values(stepsByDay);
  const cycling7 = within(state.activities, addDays(today, -6)).filter((a) => a.type === "cycling").reduce((s, a) => s + num(a.distanceKm), 0);

  // Weekly consistency: how many of the last 8 weeks had ≥ 3 workouts
  let goodWeeks = 0;
  for (let i = 0; i < 8; i++) {
    const to = addDays(today, -7 * i), from = addDays(to, -6);
    if (within(state.workouts, from).filter((w) => w.date <= to).length >= 3) goodWeeks++;
  }

  // Every session counts, as on the Exercise page: strength workouts plus cycling, cardio and any other logged activity
  // except plain step counts (a day of steps is not a session)
  const sessionRows = [
    ...(state.workouts || []).map((w) => ({ date: w.date, minutes: num(w.minutes), kind: "strength" })),
    ...(state.activities || []).filter((a) => a.type !== "steps").map((a) => ({ date: a.date, minutes: num(a.durationMin), kind: a.type || "activity" })),
  ].filter((x) => x.date);
  const s30 = within(sessionRows, addDays(today, -30)), s7 = within(sessionRows, addDays(today, -6));
  const lastSession = sessionRows.map((x) => x.date).filter((d) => d <= today).sort().pop() || null;
  let goodSessionWeeks = 0;
  for (let i = 0; i < 8; i++) { const to = addDays(today, -7 * i), from = addDays(to, -6); if (within(sessionRows, from).filter((x) => x.date <= to).length >= 3) goodSessionWeeks++; }
  const habits = (state.habits || []).map((h) => ({ streakDays: num(h.streak), bestStreak: num(h.bestStreak) }));
  return {
    body: bodyOut,
    sessions: { last30Days: s30.length, minutesLast30Days: s30.reduce((t, x) => t + x.minutes, 0), last7Days: s7.length, daysSinceLast: lastSession ? daysBetween(lastSession, today) : null, activeDaysLast30: new Set(s30.map((x) => x.date)).size, weeksWith3PlusOfLast8: goodSessionWeeks },
    workouts: { last30Days: w30.length, minutesLast30Days: w30.reduce((s, w) => s + num(w.minutes), 0), last7Days: w7.length, daysSinceLast: lastWorkout ? daysBetween(lastWorkout, today) : null, weeksWith3PlusSessionsOfLast8: goodWeeks },
    steps: { avgLast14Days: stepDays.length ? Math.round(stepDays.reduce((s, x) => s + x, 0) / stepDays.length) : null, daysLogged: stepDays.length, goal: goals.dailySteps || null },
    cyclingKmLast7Days: r1(cycling7), cyclingGoalKmPerWeek: goals.weeklyCyclingKm || null,
    habits, habitNote: "Habit names are never shown in briefs; only streak numbers.",
  };
}

/** Round-number net worth milestones and a plain pace estimate from the history we have. */
function milestones(netWorth, history) {
  const steps = [5e6, 7.5e6, 1e7, 1.25e7, 1.5e7, 2e7, 2.5e7, 3e7, 5e7, 1e8];
  const next = steps.find((s) => s > netWorth) || Math.ceil((netWorth + 1) / 5e6) * 5e6;
  const prev = [...steps].reverse().find((s) => s <= netWorth) || 0;
  const h = (history || []).filter((x) => x.netWorth > 0).sort((a, b) => (a.date < b.date ? -1 : 1));
  let perMonth = null, months = null;
  if (h.length >= 2) {
    const first = h[0], last = h[h.length - 1];
    const days = daysBetween(first.date, last.date);
    if (days >= 20) { perMonth = ((last.netWorth - first.netWorth) / days) * 30.4; if (perMonth > 0) months = (next - netWorth) / perMonth; }
  }
  return { next, previous: prev, toGo: Math.round(next - netWorth), progressToNextPct: next > prev ? r1(((netWorth - prev) / (next - prev)) * 100) : null, recentPacePerMonth: perMonth == null ? null : Math.round(perMonth), monthsAtThatPace: months == null ? null : r1(months), paceNote: "Pace mixes SIPs and market moves over the history available; markets make it lumpy." };
}

module.exports = { fitnessReport, milestones };
