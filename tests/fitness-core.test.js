const assert = require("assert");
const F = require("../fitness-core.js");

const day = { date: "2026-10-15", steps: 8234, walkKm: 5.9, cycleKm: 12.3, activeKcal: 540,
  workouts: [{ type: "Cycling", start: "2026-10-15T06:10:00+05:30", minutes: 45, km: 12.3, kcal: 300 },
             { type: "Walking", minutes: 20, km: 1.5, kcal: 90 }] };

// One day → a steps row + the ride; walking workouts are already inside steps
{
  const rows = F.rowsForDay(day);
  assert.deepStrictEqual(rows.map((r) => r.type).sort(), ["cycling", "steps"]);
  const ride = rows.find((r) => r.type === "cycling");
  assert.strictEqual(ride.distanceKm, 12.3); assert.strictEqual(ride.durationMin, 45); assert.strictEqual(ride.caloriesBurned, 300);
  assert.strictEqual(ride.id, "ah-wk-2026-10-15-cycling-0610");
  const steps = rows.find((r) => r.type === "steps");
  assert.strictEqual(steps.steps, 8234); assert.strictEqual(steps.distanceKm, 5.9);
  assert.strictEqual(steps.caloriesBurned, 240, "day's active kcal minus the ride, so nothing is counted twice");
}
// Cycling Health knows about but no workout recorded → one distance-only row; a recorded ride isn't doubled
{
  const loose = F.rowsForDay({ date: "2026-10-16", cycleKm: 8.4, steps: 100 });
  assert.ok(loose.some((r) => r.id === "ah-cyc-2026-10-16" && r.distanceKm === 8.4));
  assert.ok(!F.rowsForDay(day).some((r) => r.id.startsWith("ah-cyc-")));
}
// Garbage in → nothing out
assert.deepStrictEqual(F.rowsForDay(null), []);
assert.deepStrictEqual(F.rowsForDay({ date: "15/10/2026", steps: 5 }), []);
assert.deepStrictEqual(F.rowsForDay({ date: "2026-10-15", steps: "abc", workouts: "x" }), []);

// First import adds; a repeat adds nothing
let acts = [];
const p1 = F.plan([day], acts, []);
assert.strictEqual(p1.add.length, 2);
acts = acts.concat(p1.add);
const p2 = F.plan([day], acts, p1.ids);
assert.strictEqual(p2.add.length + p2.update.length, 0, "re-uploading the same day changes nothing");

// The day keeps growing → the same row is updated, not duplicated
const later = { ...day, steps: 11000 };
const p3 = F.plan([later], acts, p1.ids);
assert.strictEqual(p3.add.length, 0);
assert.strictEqual(p3.update.length, 1);
assert.strictEqual(p3.update[0].row.steps, 11000);

// A row you deleted does not come back
const withoutSteps = acts.filter((a) => a.type !== "steps");
const p4 = F.plan([day], withoutSteps, p1.ids);
assert.strictEqual(p4.add.length, 0);
assert.ok(p4.skipped.some((s) => s.why === "deleted"));

// What you typed yourself wins: no second steps/cycling row for that day
const mine = [{ id: "act-1", date: "2026-10-15", type: "steps", steps: 9000 }, { id: "act-2", date: "2026-10-15", type: "cycling", distanceKm: 12, durationMin: 40 }];
const p5 = F.plan([day], mine, []);
assert.strictEqual(p5.add.length, 0);
assert.ok(p5.skipped.every((s) => s.why === "manual"));
// …and a manual row on another day doesn't block this one
assert.strictEqual(F.plan([day], [{ id: "act-3", date: "2026-10-14", type: "steps", steps: 1 }], []).add.length, 2);

// Types
assert.strictEqual(F.typeOfWorkout("Outdoor Cycling"), "cycling");
assert.strictEqual(F.typeOfWorkout("Running"), "running");
assert.strictEqual(F.typeOfWorkout("Walking"), null);
assert.strictEqual(F.typeOfWorkout("Traditional Strength Training"), "workout");
assert.strictEqual(F.typeOfWorkout("Yoga"), "other");
console.log("fitness-core tests passed");
