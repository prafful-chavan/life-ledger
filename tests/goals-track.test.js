const assert = require("assert");
const app = require("../app.js");

const mf = (fundName, owner, units, nav, type = "PURCHASE") => ({ fundName, owner, units, latestNav: nav, nav, transactionType: type, invested: units * nav });
app.__setStateForTest({
  mutualFunds: [mf("A Fund", "Me", 100, 50), mf("B Fund", "Wife", 40, 25), mf("A Fund", "Me", 20, 50, "REDEMPTION")],
  stocks: [],
  gold: [{ owner: "Wife", value: 100000 }, { owner: "Me", value: 50000 }],
  goals: [
    { id: "g1", name: "MF", owner: "Both", target: 1000000, saved: 2000000, track: "Mutual funds", dueDate: "2027-10-22" },
    { id: "g2", name: "My MF", owner: "Me", target: 1000000, saved: 1, track: "Mutual funds" },
    { id: "g3", name: "Her gold", owner: "Wife", target: 500000, saved: 1, track: "Gold" },
    { id: "g4", name: "Manual", owner: "Both", target: 500000, saved: 12345, track: "Entered by me" },
    { id: "g5", name: "Old goal, no track field", owner: "Both", target: 500000, saved: 777 },
  ],
});

const by = (id) => app.liveGoals().find((g) => g.id === id);
assert.strictEqual(by("g1").saved, 100 * 50 - 20 * 50 + 40 * 25, "family: all funds, redemption subtracted");
assert.strictEqual(by("g1").tracked, true);
assert.strictEqual(by("g2").saved, 80 * 50, "owner filter: only my funds");
assert.strictEqual(by("g3").saved, 100000, "gold follows the owner");
assert.strictEqual(by("g4").saved, 12345, "typed progress is untouched");
assert.strictEqual(by("g4").tracked, undefined);
assert.strictEqual(by("g5").saved, 777, "goals saved before this feature keep working");

// state itself is never rewritten with the live figure
const stored = [{ id: "g1", owner: "Both", target: 9, saved: 5, track: "Mutual funds" }];
app.__setStateForTest({ mutualFunds: [mf("A Fund", "Me", 100, 50)], stocks: [], gold: [], goals: stored });
assert.strictEqual(app.liveGoals()[0].saved, 5000);
assert.strictEqual(stored[0].saved, 5, "stored goal keeps the typed number");
assert.strictEqual(app.goalTrackedValue({ owner: "Both", track: "Mutual funds" }), 5000);

// USD→INR: a new browser with no local copy uses the rate remembered in the vault, not a hard-coded guess
app.__setStateForTest({ fx: { usdInr: 94.95, at: "2026-10-18T10:00:00.000Z" }, mutualFunds: [], stocks: [], gold: [], goals: [] });
assert.strictEqual(app.getUsdInrRate(), 94.95, "vault copy used when nothing is cached locally");
app.__setStateForTest({ mutualFunds: [], stocks: [], gold: [], goals: [] });
assert.strictEqual(app.getUsdInrRate(), 96.7, "last resort only when nothing is known at all");
console.log("goals-track tests passed");
