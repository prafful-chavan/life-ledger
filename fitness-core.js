/**
 * Life Ledger — Apple Health → Exercise import (pure logic, no DOM, no network).
 *
 * The iPhone Shortcut uploads one summary per day:
 *   { date: "2026-10-15", steps: 8234, walkKm: 5.9, cycleKm: 12.3, activeKcal: 540,
 *     workouts: [{ type: "Cycling", start: "2026-10-15T06:10:00+05:30", minutes: 45, km: 12.3, kcal: 300 }] }
 *
 * plan() turns those days into Exercise activity rows without ever duplicating or overriding what you
 * typed by hand, and without bringing back a row you deleted.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerFitnessCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const AUTO_PREFIX = "ah-";
  const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
  const round = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f) / f; };
  const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));

  /** Apple's workout names → the app's activity types. Walking is already inside the step count. */
  function typeOfWorkout(name) {
    const n = String(name || "").toLowerCase();
    if (/cycl|bike|biking/.test(n)) return "cycling";
    if (/run|jog/.test(n)) return "running";
    if (/walk|hik/.test(n)) return null;
    if (/strength|functional|weight|hiit|core|gym|cross/.test(n)) return "workout";
    return "other";
  }

  const isAuto = (a) => typeof a.id === "string" && a.id.startsWith(AUTO_PREFIX);

  /** Rows one day should produce (ids are stable, so a re-import updates instead of duplicating). */
  function rowsForDay(day) {
    if (!day || !isDay(day.date)) return [];
    const date = day.date;
    const rows = [];
    const workouts = Array.isArray(day.workouts) ? day.workouts : [];
    let workoutKcal = 0;
    let cyclingFromWorkouts = 0;

    workouts.forEach((w, i) => {
      const type = typeOfWorkout(w.type);
      if (!type) return;
      const minutes = Math.round(num(w.minutes));
      const km = round(num(w.km), 2);
      const kcal = Math.round(num(w.kcal));
      workoutKcal += kcal;
      if (type === "cycling") cyclingFromWorkouts += km;
      const start = String(w.start || "");
      // Same ride re-uploaded later keeps its id: keyed by start time when we have it, else position in the day.
      const key = /\d{2}:\d{2}/.test(start) ? start.replace(/\D/g, "").slice(8, 12) : String(i + 1);
      rows.push({
        id: `${AUTO_PREFIX}wk-${date}-${type}-${key}`,
        date, type,
        title: `${String(w.type || type)} (Apple Health)`,
        durationMin: minutes,
        distanceKm: km > 0 ? km : undefined,
        caloriesBurned: kcal > 0 ? kcal : undefined,
        intensity: "Moderate",
        notes: "Imported from Apple Health",
        source: "apple-health",
      });
    });

    // Cycling distance Health knows about that no workout accounts for (e.g. a ride that wasn't recorded as a workout).
    const looseCycle = round(num(day.cycleKm) - cyclingFromWorkouts, 2);
    if (looseCycle >= 0.5) {
      rows.push({
        id: `${AUTO_PREFIX}cyc-${date}`, date, type: "cycling", title: "Cycling (Apple Health)",
        durationMin: 0, distanceKm: looseCycle, intensity: "Moderate",
        notes: "Imported from Apple Health", source: "apple-health",
      });
    }

    const steps = Math.round(num(day.steps));
    if (steps > 0) {
      const restKcal = Math.max(0, Math.round(num(day.activeKcal) - workoutKcal));
      const walk = round(num(day.walkKm), 2);
      rows.push({
        id: `${AUTO_PREFIX}steps-${date}`, date, type: "steps", title: "Steps (Apple Health)",
        durationMin: 0, steps,
        distanceKm: walk > 0 ? walk : undefined,
        caloriesBurned: restKcal > 0 ? restKcal : undefined,
        intensity: "Moderate", notes: "Imported from Apple Health", source: "apple-health",
      });
    }
    return rows;
  }

  const FIELDS = ["date", "type", "title", "durationMin", "steps", "distanceKm", "caloriesBurned"];
  const same = (a, b) => FIELDS.every((k) => (a[k] || 0) === (b[k] || 0) || a[k] === b[k]);

  /**
   * @param days        uploaded daily summaries
   * @param activities  the app's current activities
   * @param knownIds    ids this importer has created before (so a row you deleted is not recreated)
   * @returns { add, update:[{id, row}], skipped:[{id, why}], ids }
   */
  function plan(days, activities, knownIds) {
    const acts = Array.isArray(activities) ? activities : [];
    const known = new Set(knownIds || []);
    const byId = new Map(acts.map((a) => [a.id, a]));
    const manual = acts.filter((a) => !isAuto(a));
    const add = [];
    const update = [];
    const skipped = [];
    const seen = new Set(known);

    (Array.isArray(days) ? days : []).forEach((day) => {
      rowsForDay(day).forEach((row) => {
        const have = byId.get(row.id);
        if (have) {
          if (!same(have, row)) update.push({ id: row.id, row });
          seen.add(row.id);
          return;
        }
        if (known.has(row.id)) { skipped.push({ id: row.id, why: "deleted" }); return; }   // you removed it; keep it removed
        // Something typed by hand for the same day and kind → yours wins, never counted twice.
        const mine = manual.filter((a) => a.date === row.date && a.type === row.type);
        if (row.type === "steps" && mine.length) { skipped.push({ id: row.id, why: "manual" }); seen.add(row.id); return; }
        if (row.type === "cycling" && mine.length) { skipped.push({ id: row.id, why: "manual" }); seen.add(row.id); return; }
        add.push(row);
        seen.add(row.id);
      });
    });
    return { add, update, skipped, ids: [...seen] };
  }

  return { plan, rowsForDay, typeOfWorkout, AUTO_PREFIX, isAuto };
});
