const assert = require("assert");
const K = require("../knowledge.js");

const state = {
  expenses: [
    { id: "1", date: "2021-03-05", category: "Eating Out", paidBy: "Me", amount: 500, note: "Lunch at Cafe" },
    { id: "2", date: "2021-03-20", category: "Groceries", paidBy: "Wife", amount: 1500, note: "Weekly" },
    { id: "3", date: "2025-03-07", category: "Eating Out", paidBy: "Wife", amount: 900, note: "Dinner" },
    { id: "4", date: "2025-04-01", category: "Eating Out", paidBy: "Me", amount: 300, note: "Chai" },
    { id: "5", date: "2025-04-02", category: "Travel", paidBy: "Me", amount: 2500, note: "Cab" },
  ],
  workouts: [
    { id: "w1", date: "2026-10-01", type: "Strength", minutes: 45 }, { id: "w2", date: "2026-10-03", type: "Yoga", minutes: 25 },
    { id: "w3", date: "2026-10-08", type: "Strength", minutes: 50 },
  ],
  goals: [{ id: "g1", name: "Home", target: 3000000, saved: 500000, dueDate: "2030-01-01" }],
  habits: [{ id: "h1", name: "Read", streak: 5, history: ["2026-10-01"] }],
  fitnessGoals: { dailySteps: 10000 },
  spendingImport: { ids: ["a", "b"] },
  emptyList: [],
  strings: ["x"],
};

// discovery: arrays of objects are collections; objects are singletons; internals are hidden; nothing hard-coded
const cat = K.catalog(state);
assert.deepStrictEqual(cat.collections.map((c) => c.name).sort(), ["expenses", "goals", "habits", "workouts"]);
assert.deepStrictEqual(cat.objects.map((o) => o.name), ["fitnessGoals"]);
const ex = cat.collections.find((c) => c.name === "expenses");
assert.strictEqual(ex.rows, 5);
assert.strictEqual(ex.dateField, "date");
assert.deepStrictEqual(ex.range, { from: "2021-03-05", to: "2025-04-02" });
assert.ok(ex.fields.find((f) => f.name === "category").values.includes("Travel"), "category values are listed");
assert.ok(K.catalogText(state).includes("expenses: 5 rows"));

// a brand-new collection is queryable with zero wiring
state.bodyMetrics = [{ date: "2026-10-01", weight: 80.2 }, { date: "2026-10-08", weight: 79.6 }];
assert.ok(K.catalog(state).collections.some((c) => c.name === "bodyMetrics"));
let r = K.runTool("query_data", { source: "bodyMetrics", metrics: [{ op: "min", field: "weight" }] }, state);
assert.strictEqual(r.rows[0].min_weight, 79.6);

// aggregation across ALL history, grouped by year / month / field
r = K.runTool("query_data", { source: "expenses", filters: [{ field: "category", op: "=", value: "Eating Out" }], group_by: ["year"], metrics: [{ op: "sum", field: "amount" }, { op: "count" }] }, state);
assert.deepStrictEqual(JSON.parse(JSON.stringify(r.rows)), [{ year: "2021", sum_amount: 500, count: 1 }, { year: "2025", sum_amount: 1200, count: 2 }]);
r = K.runTool("query_data", { source: "expenses", group_by: ["month"], metrics: [{ op: "sum", field: "amount" }] }, state);
assert.deepStrictEqual(r.rows.map((x) => x.month), ["2021-03", "2025-03", "2025-04"], "time groups are chronological");
r = K.runTool("query_data", { source: "expenses", group_by: ["paidBy"], metrics: [{ op: "sum", field: "amount" }, { op: "avg", field: "amount" }] }, state);
assert.strictEqual(r.rows[0].paidBy, "Me", "default order is by the first metric, descending");
assert.strictEqual(r.rows[0].sum_amount, 3300);

// filters: date range, contains, in, between, case-insensitive
r = K.runTool("query_data", { source: "expenses", date_from: "2025-01-01", date_to: "2025-03-31" }, state);
assert.strictEqual(r.matched, 1);
r = K.runTool("query_data", { source: "expenses", filters: [{ field: "note", op: "contains", value: "CAFE" }] }, state);
assert.strictEqual(r.rows[0].id, "1");
r = K.runTool("query_data", { source: "expenses", filters: [{ field: "category", op: "in", value: '["travel","groceries"]' }] }, state);
assert.strictEqual(r.matched, 2, "in-list passed as JSON text still works");
r = K.runTool("query_data", { source: "expenses", filters: [{ field: "amount", op: "between", value: "[400,1000]" }] }, state);
assert.strictEqual(r.matched, 2);
r = K.runTool("query_data", { source: "expenses", filters: [{ field: "amount", op: ">", value: "1000" }], metrics: [{ op: "count" }] }, state);
assert.strictEqual(r.rows[0].count, 2, "numeric filter values are coerced");

// raw rows: newest first, capped
r = K.runTool("query_data", { source: "workouts", limit: 2 }, state);
assert.deepStrictEqual(r.rows.map((x) => x.id), ["w3", "w2"]);
assert.strictEqual(r.truncated, true);
// weekly buckets use Monday
r = K.runTool("query_data", { source: "workouts", group_by: ["week"], metrics: [{ op: "sum", field: "minutes" }] }, state);
assert.deepStrictEqual(r.rows.map((x) => x.week), ["2026-09-28", "2026-10-05"]);

// errors are returned, never thrown
assert.strictEqual(K.runTool("query_data", { source: "nope" }, state).ok, false);
assert.ok(K.runTool("query_data", { source: "nope" }, state).error.includes("Available"));
assert.strictEqual(K.runTool("query_data", { source: "expenses", filters: [{ field: "amount", op: "~~", value: "1" }] }, state).ok, false);
assert.strictEqual(K.runTool("get_object", { name: "spendingImport" }, state).ok, false, "internals are not exposed");
assert.strictEqual(K.runTool("get_object", { name: "fitnessGoals" }, state).value.dailySteps, 10000);
assert.strictEqual(K.runTool("nonsense", {}, state).ok, false);

// calculator: exact, safe, finance helpers
assert.strictEqual(K.calculate("2 + 3 * 4"), 14);
assert.strictEqual(K.calculate("(2+3)*4 - 10/4"), 17.5);
assert.strictEqual(K.calculate("2^3^2"), 512, "right-associative power");
assert.strictEqual(K.calculate("-3 + 5"), 2);
assert.strictEqual(K.calculate("₹1,00,000 * 1.1"), 110000.000000);
assert.strictEqual(K.calculate("round(fv(0.01, 12, -10000, 0))"), 126825);
assert.ok(Math.abs(K.calculate("cagr(100, 200, 5)") - 0.148698) < 1e-6);
assert.strictEqual(K.calculate("round(pmt(0.01, 12, 100000))"), 8885);
for (const bad of ["process.exit()", "require('fs')", "1/0", "2 +", "alert(1)", "a b", "(1+2"]) assert.throws(() => K.calculate(bad), undefined, bad);
assert.strictEqual(K.runTool("calculate", { expression: "10% 3" }, state).result, 1);

// modules: future features plug in without touching the agent
K.registerModule({ id: "demo", title: "Demo", description: "A future section", build: (s, args) => `hello ${args.name || "world"} ${s.goals.length}` });
assert.ok(K.catalog(state).modules.some((m) => m.id === "demo"));
assert.strictEqual(K.runTool("get_module", { id: "demo", args: { name: "Prafful" } }, state).text, "hello Prafful 1");
assert.strictEqual(K.runTool("get_module", { id: "missing" }, state).ok, false);
assert.throws(() => K.registerModule({ id: "bad" }));
K.unregisterModule("demo");

// big results are clipped, not dropped
const big = { items: Array.from({ length: 3000 }, (_, i) => ({ date: "2026-01-01", note: "n".repeat(150), n: i })) };
r = K.runTool("query_data", { source: "items", limit: 100 }, big);
assert.ok(JSON.stringify(r).length <= 24500);
assert.strictEqual(r.truncated, true);

// the tool list is stable and well-formed for function-calling APIs
assert.deepStrictEqual(K.TOOL_SPECS.map((t) => t.name), ["list_sources", "query_data", "get_module", "get_object", "calculate"]);
K.TOOL_SPECS.forEach((t) => { assert.ok(t.description && t.parameters.type === "object"); });

console.log("knowledge tests passed");
