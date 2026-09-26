/**
 * tests/exercise-tracking.test.js
 * Test suite for full-fledged exercise tracking app features:
 * - Daily steps, cycling, running, gym workouts, active calories burned
 * - Speed, pace, and MET-based calorie calculations
 * - Unified activity model and legacy workout compatibility
 * - Apple Fitness style rings and today metrics
 * - LLM Connect engine prompt generation & JSON export
 */

const assert = require('assert');
const app = require('../app.js');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     ${err.message}`);
    failedTests++;
  }
}

console.log('==========================================');
console.log('🧪 RUNNING EXERCISE & ACTIVITY TRACKING TESTS');
console.log('==========================================');

// 1. Calorie calculations (MET tables)
runTest('calcCaloriesBurned: calculates steps calories accurately with weight scaling', () => {
  // 10,000 steps at 75kg -> ~400 kcal
  const cal75 = app.calcCaloriesBurned('steps', 0, 0, 10000, 'Moderate', 75);
  assert.strictEqual(cal75, 400, '10,000 steps at 75kg should be 400 kcal');

  // Scales with weight: 10,000 steps at 90kg -> (90/75)*400 = 480 kcal
  const cal90 = app.calcCaloriesBurned('steps', 0, 0, 10000, 'Moderate', 90);
  assert.strictEqual(cal90, 480, '10,000 steps at 90kg should be 480 kcal');

  // 5,000 steps at 75kg -> 200 kcal
  const calHalf = app.calcCaloriesBurned('steps', 0, 0, 5000, 'Moderate', 75);
  assert.strictEqual(calHalf, 200, '5,000 steps at 75kg should be 200 kcal');
});

runTest('calcCaloriesBurned: calculates cycling calories based on speed and duration', () => {
  // Fast ride: 24 km in 60 mins = 24 km/h -> MET 10.0 * 75kg * 1h = 750 kcal
  const calFast = app.calcCaloriesBurned('cycling', 60, 24, 0, 'High', 75);
  assert.strictEqual(calFast, 750, '24 km/h cycling for 1h at 75kg should burn 750 kcal');

  // Leisure ride: 12 km in 60 mins = 12 km/h (<16 km/h) -> MET 4.0 * 75kg * 1h = 300 kcal
  const calLeisure = app.calcCaloriesBurned('cycling', 60, 12, 0, 'Low', 75);
  assert.strictEqual(calLeisure, 300, '12 km/h cycling for 1h at 75kg should burn 300 kcal');

  // Distance only fallback: 20 km at 75kg -> 20 * 30 = 600 kcal
  const calDistOnly = app.calcCaloriesBurned('cycling', 0, 20, 0, 'Moderate', 75);
  assert.strictEqual(calDistOnly, 600, '20 km cycling distance-only should burn ~600 kcal');
});

runTest('calcCaloriesBurned: calculates running and strength training calories', () => {
  // Running: 5 km at 75kg -> 5 * 75 * 1.036 = ~389 kcal
  const calRun = app.calcCaloriesBurned('running', 30, 5, 0, 'Moderate', 75);
  assert.strictEqual(calRun, 389, '5km running at 75kg should burn 389 kcal');

  // Strength training: 45 min (0.75h) at 75kg (MET 5.0 moderate) -> 5 * 75 * 0.75 = 281 kcal
  const calGym = app.calcCaloriesBurned('workout', 45, 0, 0, 'Moderate', 75);
  assert.strictEqual(calGym, 281, '45m gym at 75kg moderate should burn 281 kcal');
});

// 2. Speed and pace calculators
runTest('calcCyclingSpeed: computes km/h accurately', () => {
  assert.strictEqual(app.calcCyclingSpeed(25, 60), '25.0');
  assert.strictEqual(app.calcCyclingSpeed(22.5, 55), '24.5');
  assert.strictEqual(app.calcCyclingSpeed(0, 50), null);
  assert.strictEqual(app.calcCyclingSpeed(20, 0), null);
});

runTest('calcRunningPace: computes mm:ss per km accurately', () => {
  assert.strictEqual(app.calcRunningPace(5, 25), '5:00 /km');
  assert.strictEqual(app.calcRunningPace(5, 28), '5:36 /km');
  assert.strictEqual(app.calcRunningPace(10, 45), '4:30 /km');
  assert.strictEqual(app.calcRunningPace(0, 25), null);
});

// 3. Unified Activity Model & Legacy Workouts
runTest('getAllUnifiedActivities: combines activities and legacy workouts seamlessly', () => {
  // Mock state
  const prevActs = app.state.activities;
  const prevWorks = app.state.workouts;

  app.state.activities = [
    { id: 'act-test-1', date: '2026-09-20', type: 'cycling', title: 'Sunday Ride', distanceKm: 30, durationMin: 70, caloriesBurned: 520 },
    { id: 'act-test-2', date: '2026-09-21', type: 'steps', title: 'Daily Walk', steps: 9200, durationMin: 60, caloriesBurned: 368 }
  ];

  app.state.workouts = [
    { id: 'work-test-1', date: '2026-09-19', type: 'Strength Training', minutes: 50, intensity: 'High', exercises: [{ name: 'Deadlift', sets: [{ weight: 100, reps: 5 }] }] }
  ];

  const unified = app.getAllUnifiedActivities();
  assert.strictEqual(unified.length, 3, 'Should combine 2 activities and 1 legacy workout');

  // Verify fields on legacy workout
  const legacyEntry = unified.find(u => u.id === 'work-test-1');
  assert.ok(legacyEntry, 'Legacy workout should be present');
  assert.strictEqual(legacyEntry.type, 'workout');
  assert.strictEqual(legacyEntry.durationMin, 50);
  assert.ok(legacyEntry.caloriesBurned > 0, 'Should auto-calculate calories for legacy workout');
  assert.strictEqual(legacyEntry.exercises[0].name, 'Deadlift');

  // Test year & month filtering
  const sept2026 = app.getAllUnifiedActivities(2026, 8); // 8 is September (0-indexed)
  assert.strictEqual(sept2026.length, 3, 'All 3 should be in Sept 2026');

  const aug2026 = app.getAllUnifiedActivities(2026, 7);
  assert.strictEqual(aug2026.length, 0, 'No activities in Aug 2026');

  // Restore state
  app.state.activities = prevActs;
  app.state.workouts = prevWorks;
});

// 4. Today fitness metrics & goal calculations
runTest('getTodayFitnessMetrics: calculates today totals and percent of goals', () => {
  const prevActs = app.state.activities;
  const prevGoals = app.state.fitnessGoals;

  const today = app.todayISO();
  app.state.fitnessGoals = { dailySteps: 10000, activeCalories: 500, activeMinutes: 45, weeklyCyclingKm: 50 };
  app.state.activities = [
    { id: 'act-today-1', date: today, type: 'steps', title: 'Morning Walk', steps: 8000, durationMin: 50, caloriesBurned: 320 },
    { id: 'act-today-2', date: today, type: 'cycling', title: 'Ride', distanceKm: 15, durationMin: 35, caloriesBurned: 280 }
  ];

  const metrics = app.getTodayFitnessMetrics();
  assert.strictEqual(metrics.todaySteps, 8000);
  assert.strictEqual(metrics.todayCalories, 600);
  assert.strictEqual(metrics.todayMinutes, 85);
  assert.strictEqual(metrics.todayCyclingKm, 15);
  assert.strictEqual(metrics.pctSteps, 80); // 8000 / 10000 = 80%
  assert.strictEqual(metrics.pctCalories, 120); // 600 / 500 = 120%
  assert.ok(metrics.pctMinutes > 100);

  // Restore
  app.state.activities = prevActs;
  app.state.fitnessGoals = prevGoals;
});

// 5. LLM Connect Engine
runTest('buildFitnessLlmSummary: produces rich prompts and valid JSON payloads', () => {
  const prevActs = app.state.activities;
  const today = app.todayISO();

  app.state.activities = [
    { id: 'act-1', date: today, type: 'cycling', title: 'Highway 25K', distanceKm: 25, durationMin: 60, caloriesBurned: 550, notes: 'Good cadence' },
    { id: 'act-2', date: today, type: 'steps', title: 'Office steps', steps: 10200, durationMin: 65, caloriesBurned: 408 }
  ];

  // Test comprehensive coaching prompt
  const prompt = app.buildFitnessLlmSummary('comprehensive', '30');
  assert.ok(prompt.includes('FITNESS & HEALTH PERFORMANCE AUDIT'), 'Should include audit header');
  assert.ok(prompt.includes('Prafful Chavan'), 'Should include user name');
  assert.ok(prompt.includes('Total Active Calories Burned'), 'Should summarize calories');
  assert.ok(prompt.includes('Cycling Volume'), 'Should summarize cycling');
  assert.ok(prompt.includes('Total Steps Walked'), 'Should summarize steps');
  assert.ok(prompt.includes('COACHING PROMPT OBJECTIVE'), 'Should include LLM instructions');

  // Test cycling prompt mode
  const cyclingPrompt = app.buildFitnessLlmSummary('cycling', '30');
  assert.ok(cyclingPrompt.includes('cycling performance, pacing, and endurance progress'), 'Should target cycling coaching');

  // Test raw JSON payload
  const rawJson = app.buildFitnessLlmSummary('rawjson', '30');
  const parsed = JSON.parse(rawJson);
  assert.strictEqual(parsed.user, 'Prafful Chavan');
  assert.ok(parsed.aggregateTotals.totalCaloriesBurned > 0);
  assert.ok(parsed.aggregateTotals.totalSteps >= 10200);
  assert.ok(parsed.aggregateTotals.totalCyclingKm >= 25);
  assert.ok(Array.isArray(parsed.recentActivities));

  // Restore
  app.state.activities = prevActs;
});

// 6. Data normalization and backward compatibility
runTest('normalizeData: correctly normalizes activities and fitnessGoals', () => {
  const rawData = {
    activities: [
      { type: 'steps', steps: 7000 }
    ],
    fitnessGoals: {
      dailySteps: 12000
    }
  };

  const normalized = app.normalizeData(rawData);
  assert.ok(Array.isArray(normalized.activities));
  assert.strictEqual(normalized.activities.length, 1);
  assert.ok(normalized.activities[0].id.startsWith('act-'), 'Should assign act- ID');
  assert.strictEqual(normalized.fitnessGoals.dailySteps, 12000);
  assert.strictEqual(normalized.fitnessGoals.activeCalories, 500, 'Should retain default activeCalories');
  assert.strictEqual(normalized.fitnessGoals.weeklyCyclingKm, 50, 'Should retain default weeklyCyclingKm');
});

console.log('==========================================');
console.log(`📊 EXERCISE TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('==========================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL EXERCISE TRACKING TESTS PASSED SUCCESSFULLY!');
}
