// The daily brief's inputs: each figure must come out the same as the app's, and nothing may be claimed that was not entered.
const assert = require("assert");
const S = require("../mcp/server.js");
const { taxPlan } = require("../mcp/taxplan.js");
const Fit = require("../mcp/fitness.js");
const T = require("../tax-core.js");

const sal = (person, date, g) => ({ id: person + date, person, date, type: "Salary", grossEarnings: g, basicSalary: g * 0.4, hra: g * 0.2, pf: g * 0.12, taxTds: 0, amount: g * 0.85 });
const mf = (owner, fund, id, date, units, invested) => ({ id, owner, fundName: fund, transactionType: "PURCHASE", purchaseDate: date, date, units, invested, nav: invested / units, latestNav: 150, navDate: "2026-10-20" });

// ── Tax-free gains you can book: one figure, the Tax page's plan ──
{
  const state = {
    income: ["2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01"].flatMap((d) => [sal("Me", d, 250000), sal("Wife", d, 60000)]),
    mutualFunds: [mf("Wife", "Bandhan Small Cap Direct Growth", "m1", "2024-10-01", 200, 20000), mf("Wife", "HDFC Flexi Cap Direct Growth", "m2", "2025-01-01", 100, 12000), mf("Wife", "UTI Nifty 50 Index Fund Direct Growth", "m3", "2024-11-01", 100, 20000)],
    taxProfile: {}, usstocks: [], stocks: [], fx: { usdInr: 95 },
  };
  const model = T.household.build(state, "2026-10-21"), wife = model.people.find((p) => p.who === "Wife");
  assert.ok(wife.harvest && wife.harvest.planned > 0, "the Tax page plans a tax-free booking for her");
  const report = S.taxReport(state, { usdInr: 95 }, "2026-10-21");
  assert.strictEqual(report.perPerson.Archana.canBookTaxFreeToday, Math.round(wife.harvest.planned), "the daily brief quotes the Tax page's figure, not a second estimate");
  assert.strictEqual(report.perPerson.Prafful.canBookTaxFreeToday, Math.round((model.people.find((p) => p.who === "Me").harvest || { planned: 0 }).planned), "and for the other person too");
}

// ── Side business: the saving is only reported for a profit the household entered ──
{
  const base = { income: [sal("Me", "2026-09-01", 250000), sal("Wife", "2026-09-01", 60000)], taxProfile: { sideBusinessStart: "2027-01-01" } };
  const none = taxPlan(base, "2026-10-21").savings;
  assert.strictEqual(none.sideBusinessTaxSavedIfInLowerTaxedName, null, "no profit entered: no invented saving");
  assert.strictEqual(none.sideBusinessNeedsProfit, true, "but it says the profit is what is missing");
  const entered = taxPlan({ ...base, taxProfile: { ...base.taxProfile, sideBusinessProfit: 300000 } }, "2026-10-21").savings;
  assert.strictEqual(entered.sideBusinessTaxSavedIfInLowerTaxedName.profit, 300000, "the entered profit is the one used");
  assert.strictEqual(entered.sideBusinessTaxSavedIfInLowerTaxedName.profitEntered, true);
  assert.strictEqual(entered.sideBusinessNeedsProfit, false);
  assert.strictEqual(taxPlan({ ...base, taxProfile: {} }, "2026-10-21").savings.sideBusinessNeedsProfit, false, "no business planned: nothing to ask for");
}

// ── Exercise: every session counts, as on the Exercise page ──
{
  const state = {
    workouts: [{ date: "2026-09-23", minutes: 40 }],
    activities: [
      { date: "2026-10-19", type: "cycling", durationMin: 80, distanceKm: 19.62 }, { date: "2026-10-14", type: "cycling", durationMin: 47, distanceKm: 8.37 },
      { date: "2026-10-14", type: "steps", steps: 8900 }, { date: "2026-10-02", type: "cardio", durationMin: 30 }, { date: "2026-08-01", type: "cycling", durationMin: 60 },
    ],
    bodyMetrics: [], fitnessGoals: { dailySteps: 10000, weeklyCyclingKm: 50 },
  };
  const f = Fit.fitnessReport(state, "2026-10-21");
  assert.deepStrictEqual(f.sessions, { last30Days: 4, minutesLast30Days: 40 + 80 + 47 + 30, last7Days: 1, daysSinceLast: 2, activeDaysLast30: 4, weeksWith3PlusOfLast8: 0 },
    "strength + cycling + cardio in the last 30 days (a step count is not a session; August is too old)");
  assert.strictEqual(f.workouts.last30Days, 1, "strength workouts alone are still reported separately");
  assert.strictEqual(f.workouts.daysSinceLast, 28, "...which is where the old 'last workout 28 days ago' came from");
  const empty = Fit.fitnessReport({ workouts: [], activities: [], bodyMetrics: [], fitnessGoals: {} }, "2026-10-21");
  assert.deepStrictEqual([empty.sessions.last30Days, empty.sessions.daysSinceLast], [0, null], "nothing logged: zero sessions and no 'days since'");
  const weeks = { workouts: [], activities: ["2026-10-19", "2026-10-18", "2026-10-17"].map((d) => ({ date: d, type: "cycling", durationMin: 30 })), bodyMetrics: [], fitnessGoals: {} };
  assert.strictEqual(Fit.fitnessReport(weeks, "2026-10-21").sessions.weeksWith3PlusOfLast8, 1, "a week with 3+ sessions counts");
}
console.log("brief source tests passed");
