const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const read = (f) => fs.readFileSync(require("path").join(__dirname, "..", f), "utf8");

function setup({ activities = [], days = [], failWith = null, configured = true } = {}) {
  const store = new Map();
  const status = { textContent: "Not checked yet." };
  const listeners = {};
  const state = { activities, fitnessImport: { ids: [], importedAt: null } };
  const calls = { save: 0, render: 0, pulls: [] };
  const win = {
    addEventListener: (e, f) => { listeners[e] = f; },
    LifeLedgerSync: {
      isConfigured: () => configured,
      onStatus() {},
      call: async (op, extra) => { calls.pulls.push([op, extra]); if (failWith) throw new Error(failWith); return { ok: true, days }; },
    },
    LifeLedgerApp: { getState: () => state, renderAll: () => { calls.render++; }, saveData: async () => { calls.save++; } },
    LifeLedgerAuth: { isUnlocked: () => true },
  };
  const ctx = {
    window: win, console, Date, Math, JSON, Promise, Number, String, Array, Object, Set, setTimeout, setInterval: () => 0,
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) },
    navigator: { clipboard: { writeText: async () => {} } },
    document: { hidden: false, activeElement: null, querySelector: () => null, addEventListener() {}, getElementById: (id) => (id === "fitnessSyncStatus" ? status : null) },
  };
  ctx.self = win; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("fitness-core.js"), ctx);
  win.LifeLedgerFitnessCore = ctx.LifeLedgerFitnessCore || win.LifeLedgerFitnessCore;
  vm.runInContext(read("fitness-import.js"), ctx);
  return { win, state, status, calls };
}

const day = { date: "2026-10-15", steps: 8234, walkKm: 5.9, cycleKm: 12.3, activeKcal: 540, workouts: [{ type: "Cycling", start: "2026-10-15T06:10:00+05:30", minutes: 45, km: 12.3, kcal: 300 }] };

(async () => {
  // First import
  let t = setup({ days: [day] });
  await t.win.LifeLedgerFitness.run({ manual: true });
  assert.strictEqual(t.state.activities.length, 2);
  assert.strictEqual(t.calls.save, 1);
  assert.ok(/2 new/.test(t.status.textContent), t.status.textContent);
  assert.ok(t.state.fitnessImport.importedAt && t.state.fitnessImport.ids.length === 2);
  assert.strictEqual(t.calls.pulls[0][0], "fitnessPull");
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(t.calls.pulls[0][1].since), "asks only for the last two weeks");

  // Running again changes nothing and saves nothing
  await t.win.LifeLedgerFitness.run({ manual: true });
  assert.strictEqual(t.state.activities.length, 2);
  assert.strictEqual(t.calls.save, 1, "no pointless save");
  assert.ok(/Up to date/.test(t.status.textContent));

  // Row deleted by the user stays deleted
  t.state.activities = t.state.activities.filter((a) => a.type !== "steps");
  await t.win.LifeLedgerFitness.run({ manual: true });
  assert.strictEqual(t.state.activities.some((a) => a.type === "steps"), false);

  // Hand-entered steps are never doubled
  t = setup({ days: [day], activities: [{ id: "act-1", date: "2026-10-15", type: "steps", steps: 9000 }] });
  await t.win.LifeLedgerFitness.run({ manual: true });
  assert.strictEqual(t.state.activities.filter((a) => a.type === "steps").length, 1);
  assert.ok(/left as you entered/.test(t.status.textContent));

  // A gateway that doesn't know the op yet (old Apps Script) is explained, not a crash
  t = setup({ failWith: "unknown op" });
  await t.win.LifeLedgerFitness.run({ manual: true });
  assert.ok(/Could not check/.test(t.status.textContent));
  assert.strictEqual(t.state.activities.length, 0);

  // Nothing uploaded yet → friendly pointer to setup
  t = setup({ days: [] });
  await t.win.LifeLedgerFitness.run({ manual: true });
  assert.ok(/Set up automatic import/.test(t.status.textContent));

  // Not configured
  t = setup({ configured: false });
  await t.win.LifeLedgerFitness.run({ manual: true });
  assert.ok(/Apps Script URL/.test(t.status.textContent));

  console.log("fitness-import tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
