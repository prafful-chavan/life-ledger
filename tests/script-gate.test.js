const assert = require("assert");
const make = require("../script-gate.js");

const SCRIPT = "https://script.google.com/macros/s/AKfy123/exec";
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // a controllable fake network
  const pending = [];
  const started = [];
  const fakeFetch = (url, init) => new Promise((resolve, reject) => {
    const job = { url, init, resolve: () => resolve({ ok: true, url }), reject };
    started.push(url);
    pending.push(job);
    if (init && init.signal) init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  });
  const gate = make(globalThis, { fetch: fakeFetch, timeouts: [60, 80, 100] });
  const finishOne = async (url) => { const i = pending.findIndex((j) => j.url === url); pending.splice(i, 1)[0].resolve(); await tick(); };

  // ── classification ──────────────────────────────────────────────
  assert.strictEqual(gate.priorityOf(SCRIPT, { method: "POST" }), 0, "sync gateway first");
  assert.strictEqual(gate.priorityOf(SCRIPT + "?syncMeta=1", {}), 0);
  assert.strictEqual(gate.priorityOf(SCRIPT + "?symbols=TCS", {}), 1, "prices");
  assert.strictEqual(gate.priorityOf(SCRIPT + "?history=TCS.NS&days=400", {}), 2, "bulk");
  assert.strictEqual(gate.priorityOf(SCRIPT + "?ledger=1&since=2026-09-01", {}), 2);
  assert.strictEqual(gate.isScript("https://query1.finance.yahoo.com/x"), false);

  // ── non-script traffic is untouched ─────────────────────────────
  const direct = gate("https://api.dropbox.com/x", {});
  await tick();
  assert.strictEqual(started.length, 1, "other hosts pass straight through");
  await finishOne("https://api.dropbox.com/x");
  await direct;
  started.length = 0;

  // ── concurrency cap, bulk limit, and priority order ─────────────
  const results = [];
  const go = (u, init) => gate(u, init).then(() => results.push(u));
  const h1 = go(SCRIPT + "?history=A", {});          // bulk, starts
  const h2 = go(SCRIPT + "?history=B", {});          // bulk, must wait (only one bulk at a time)
  const p1 = go(SCRIPT + "?symbols=P1", {});         // price
  const p2 = go(SCRIPT + "?symbols=P2", {});         // price
  const p3 = go(SCRIPT + "?symbols=P3", {});         // price – over the cap of 3 in flight
  const s1 = go(SCRIPT, { method: "POST" });         // sync – jumps the queue
  await tick();
  assert.deepStrictEqual(started.slice(0, 3), [SCRIPT + "?history=A", SCRIPT + "?symbols=P1", SCRIPT + "?symbols=P2"], "3 in flight, first-come within a priority");
  assert.strictEqual(gate.stats().active, 3);
  assert.strictEqual(gate.stats().queued, 3);
  await finishOne(SCRIPT + "?symbols=P1");           // a slot frees → the sync call goes next, not the older price/bulk jobs
  assert.strictEqual(started[3], SCRIPT, "urgent sync request is served before older lower-priority requests");
  await finishOne(SCRIPT + "?symbols=P2");
  assert.strictEqual(started[4], SCRIPT + "?symbols=P3");
  assert.ok(!started.includes(SCRIPT + "?history=B"), "second bulk request still waits while the first bulk runs");
  await finishOne(SCRIPT + "?history=A");
  await tick();
  assert.ok(started.includes(SCRIPT + "?history=B"), "…and starts when the first bulk finishes");
  for (const u of [SCRIPT, SCRIPT + "?symbols=P3", SCRIPT + "?history=B"]) await finishOne(u);
  await Promise.all([h1, h2, p1, p2, p3, s1]);
  assert.strictEqual(gate.stats().active, 0);
  assert.strictEqual(gate.stats().queued, 0);
  pending.length = 0; started.length = 0;

  // ── a hanging request is aborted instead of blocking forever ─────
  const hung = gate(SCRIPT, { method: "POST" });    // timeout 60 ms in this test
  await assert.rejects(hung, (e) => e.name === "AbortError");
  assert.strictEqual(gate.stats().timedOut, 1);
  assert.strictEqual(gate.stats().active, 0, "the slot is released");
  pending.length = 0;

  // ── a caller's own abort works while the request is still queued ─
  const busy = [1, 2, 3].map((n) => gate(SCRIPT + "?symbols=BUSY" + n, { signal: new AbortController().signal }).catch(() => {}));
  const mine = new AbortController();
  const queued = gate(SCRIPT + "?symbols=MINE", { signal: mine.signal });
  mine.abort();
  await assert.rejects(queued, (e) => e.name === "AbortError");
  assert.ok(!started.includes(SCRIPT + "?symbols=MINE"), "never sent");
  busy.length = 0;
  const already = new AbortController(); already.abort();
  await assert.rejects(gate(SCRIPT, { signal: already.signal }), (e) => e.name === "AbortError");

  console.log("script-gate tests passed");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
