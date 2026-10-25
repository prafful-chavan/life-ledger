// Nothing is sent to an AI service until the household has agreed: every network path asks the consent gate first.
const assert = require("assert");
const AI = require("../ai-agent.js");
AI.attachKnowledge(require("../knowledge.js"), () => ({ expenses: [], workouts: [], habits: [], goals: [], tasks: [], studies: [], activities: [], income: [], liabilities: [], mutualFunds: [], stocks: [], usstocks: [], chat: [], fitnessGoals: {} }));

const geminiOk = { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"summary":"hi"}' }] } }] }), text: async () => "" };
const routerOk = { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"summary":"hi"}' } }] }), text: async () => "" };

(async () => {
  let sent = [];
  global.fetch = async (url) => { sent.push(String(url)); return /openrouter/.test(url) ? routerOk : geminiOk; };
  AI.setGeminiKey("k"); AI.setOpenRouterKey("k");

  for (const provider of ["gemini", "openrouter"]) {
    AI.setProvider(provider);
    // no gate set at all: refused, nothing sent
    AI.setConsentGate(null); sent = [];
    await assert.rejects(() => AI.generateStructured({ system: "s", user: "u" }), /not approved/, provider + ": no gate");
    assert.deepStrictEqual(sent, [], provider + ": nothing was sent without a gate");
    // the gate says no: refused, nothing sent
    const asked = [];
    AI.setConsentGate(async (p) => { asked.push(p); return false; });
    await assert.rejects(() => AI.generateStructured({ system: "s", user: "u" }), /not approved/, provider + ": declined");
    assert.deepStrictEqual(sent, [], provider + ": nothing was sent after a no"); assert.deepStrictEqual(asked, [provider], "the gate is told which provider");
    // the gate says yes: sent
    AI.setConsentGate(async () => true);
    const r = await AI.generateStructured({ system: "s", user: "u" });
    assert.strictEqual(r.summary, "hi"); assert.strictEqual(sent.length, 1, provider + ": one request after a yes");
    // a gate that throws is a no
    AI.setConsentGate(async () => { throw new Error("dialog failed"); });
    sent = []; await assert.rejects(() => AI.generateStructured({ system: "s", user: "u" }));
    assert.deepStrictEqual(sent, [], provider + ": a failing gate sends nothing");
  }
  // the streaming / tool-using path is gated too — and it does reach the network once consent is given (so this is a real test)
  const run = () => new Promise((resolve) => { AI.streamAgent("hello", "ctx", [], () => {}, () => resolve({ ok: true }), (e) => resolve({ ok: false, err: String((e && e.message) || e) })); });
  for (const provider of ["gemini", "openrouter"]) {
    AI.setProvider(provider);
    AI.setConsentGate(async () => true); sent = [];
    await run();
    assert.ok(sent.length >= 1, provider + ": with consent the streaming path sends");
    AI.setConsentGate(async () => false); sent = [];
    const r = await run();
    assert.deepStrictEqual(sent, [], provider + ": streaming sends nothing without consent"); assert.strictEqual(r.ok, false, "the caller is told it failed");
  }
  console.log("ai-consent: all checks passed");
})().catch((e) => { console.error(e); process.exit(1); });
