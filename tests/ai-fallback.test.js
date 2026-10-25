const assert = require("assert");
const AI = require("../ai-agent.js");
AI.setConsentGate(async () => true);   // consent is tested in ai-consent.test.js

const ok = (text) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }), text: async () => "" });
const fail = (status) => ({ ok: false, status, text: async () => "{}", json: async () => ({}) });
const modelOf = (url) => decodeURIComponent(String(url).split("/models/")[1].split(":")[0]);

(async () => {
  AI.setProvider("gemini");
  AI.setGeminiKey("test-key");

  // chain: chosen model first, then the others once each
  AI.setGeminiModel("gemini-2.5-flash");
  assert.deepStrictEqual(AI.geminiModelChain(), ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"]);
  AI.setGeminiModel("gemini-2.5-pro");
  assert.deepStrictEqual(AI.geminiModelChain(), ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"]);

  // limited on the first model → answered by the next one
  let tried = [];
  global.fetch = async (url) => { tried.push(modelOf(url)); return tried.length === 1 ? fail(429) : ok('{"summary":"hi"}'); };
  const r = await AI.generateStructured({ system: "s", user: "u" });
  assert.strictEqual(r.summary, "hi");
  assert.deepStrictEqual(tried, ["gemini-2.5-pro", "gemini-2.5-flash"]);

  // every model limited → the usual quota error (the advisor's back-off keys off "limit")
  tried = [];
  global.fetch = async (url) => { tried.push(modelOf(url)); return fail(429); };
  await assert.rejects(() => AI.generateStructured({ system: "s", user: "u" }), /limit/i);
  assert.strictEqual(tried.length, 4);

  // a bad key stops straight away (no pointless retries on other models)
  tried = [];
  global.fetch = async (url) => { tried.push(modelOf(url)); return fail(403); };
  await assert.rejects(() => AI.generateStructured({ system: "s", user: "u" }), /Invalid Gemini API key/);
  assert.strictEqual(tried.length, 1);

  // an unknown/retired model name (404) is skipped
  tried = [];
  global.fetch = async (url) => { tried.push(modelOf(url)); return tried.length === 1 ? fail(404) : ok('{"summary":"ok"}'); };
  assert.strictEqual((await AI.generateStructured({ system: "s", user: "u" })).summary, "ok");
  console.log("ai-fallback tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
