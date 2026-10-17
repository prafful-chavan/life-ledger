const assert = require("assert");
const C = require("../cmdk-core.js");

const items = [
  { id: "dashboard", label: "Dashboard", keywords: ["home", "overview"] },
  { id: "finance", label: "Finance", keywords: ["money", "expenses", "salary", "net worth"] },
  { id: "advisor", label: "Wealth Advisor", keywords: ["portfolio", "invest", "mutual funds", "stocks"] },
  { id: "goals", label: "Goals", keywords: ["targets", "savings"] },
  { id: "exercise", label: "Exercise", keywords: ["steps", "cycling", "workout", "health"] },
  { id: "habits", label: "Habits", keywords: ["streak", "routine"] },
  { id: "theme", label: "Toggle dark mode", keywords: ["theme", "light", "appearance"] },
];
const ids = (q) => C.rank(q, items).map((i) => i.id);

// No query keeps the given order
assert.deepStrictEqual(ids(""), items.map((i) => i.id));
assert.deepStrictEqual(ids("   "), items.map((i) => i.id));

// Label matches beat keyword matches
assert.strictEqual(ids("fin")[0], "finance");
assert.strictEqual(ids("goals")[0], "goals");
assert.strictEqual(ids("advisor")[0], "advisor", "a word inside the label counts");
assert.strictEqual(ids("wealth")[0], "advisor");

// Keywords find pages by what you're thinking of
assert.strictEqual(ids("steps")[0], "exercise");
assert.strictEqual(ids("cycling")[0], "exercise");
assert.strictEqual(ids("portfolio")[0], "advisor");
assert.strictEqual(ids("home")[0], "dashboard");
assert.ok(ids("theme").includes("theme"));
assert.ok(ids("dark").includes("theme"), "a word in the label");

// Several words
assert.strictEqual(ids("mutual funds")[0], "advisor");
assert.strictEqual(ids("net worth")[0], "finance");

// Typos / abbreviations still find something sensible
assert.strictEqual(ids("hbts")[0], "habits");
assert.strictEqual(ids("xyzzy").length, 0, "nothing matches nonsense");

// Case and punctuation don't matter; input is never mutated
assert.strictEqual(ids("FINANCE!")[0], "finance");
const copy = JSON.stringify(items);
C.rank("fin", items);
assert.strictEqual(JSON.stringify(items), copy);

// Bad input
assert.deepStrictEqual(C.rank("x", null), []);
assert.strictEqual(C.score("a", { label: null }), 0);
console.log("cmdk-core tests passed");
