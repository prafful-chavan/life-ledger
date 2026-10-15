const assert = require("assert");
const ai = require("../ai-agent.js");
const K = require("../knowledge.js");

const state = {
  expenses: [
    { id: "1", date: "2021-03-05", category: "Eating Out", amount: 500 },
    { id: "2", date: "2025-03-07", category: "Eating Out", amount: 900 },
    { id: "3", date: "2025-04-02", category: "Travel", amount: 2500 },
  ],
  workouts: [{ id: "w1", date: "2026-10-01", minutes: 45 }],
  habits: [], goals: [], tasks: [], studies: [], activities: [], income: [], liabilities: [], mutualFunds: [], stocks: [], usstocks: [], chat: [],
  fitnessGoals: { dailySteps: 10000 },
};
ai.attachKnowledge(K, () => state);

function run(question, history = []) {
  return new Promise((resolve) => {
    const chunks = [];
    ai.streamAgent(question, ai.buildDataContext(state), history, (t) => chunks.push(t), (full) => resolve({ ok: true, full, chunks }), (err) => resolve({ ok: false, err, chunks }));
  });
}
const json = (o) => ({ ok: true, status: 200, json: async () => o, text: async () => JSON.stringify(o) });

(async () => {
  // the catalog is part of every context so the model knows what exists
  const ctx = ai.buildDataContext(state);
  assert.ok(ctx.includes("DATA SOURCES YOU CAN QUERY") && ctx.includes("expenses: 3 rows"));

  // ── Gemini: call a tool, then answer ────────────────────────────────
  ai.setProvider("gemini");
  ai.setGeminiKey("test");
  const requests = [];
  global.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    requests.push(body);
    if (requests.length === 1) {
      return json({ candidates: [{ content: { role: "model", parts: [{ functionCall: { name: "query_data", args: { source: "expenses", filters: [{ field: "category", op: "=", value: "Eating Out" }], group_by: ["year"], metrics: [{ op: "sum", field: "amount" }] } }, thoughtSignature: "sig" }] } }] });
    }
    return json({ candidates: [{ content: { role: "model", parts: [{ text: "Eating out cost ₹500 in 2021 and ₹900 in 2025." }] } }] });
  };
  let r = await run("compare my eating out spend 2021 vs 2025");
  assert.ok(r.ok, r.err && r.err.message);
  assert.strictEqual(r.full, "Eating out cost ₹500 in 2021 and ₹900 in 2025.");
  assert.ok(r.chunks[0].includes("🔎"), "shows progress while it works");
  assert.ok(r.chunks[r.chunks.length - 1] === r.full, "the stream ends on the full answer");
  const decl = requests[0].tools[0].functionDeclarations;
  assert.deepStrictEqual(decl.map((d) => d.name), ["list_sources", "query_data", "get_module", "get_object", "calculate"]);
  assert.strictEqual(decl[1].parameters.type, "OBJECT", "Gemini schema types are upper-case");
  assert.strictEqual(decl[1].parameters.properties.group_by.items.type, "STRING");
  const second = requests[1].contents;
  const modelTurn = second[second.length - 2];
  assert.ok(modelTurn.parts[0].functionCall && modelTurn.parts[0].thoughtSignature === "sig", "model turn is echoed back untouched");
  const toolTurn = second[second.length - 1];
  const fr = toolTurn.parts[0].functionResponse;
  assert.strictEqual(fr.name, "query_data");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(fr.response.rows)), [{ year: "2021", sum_amount: 500 }, { year: "2025", sum_amount: 900 }], "the tool ran in code over the real data");
  assert.ok(requests[0].systemInstruction.parts[0].text.includes("TOOLS: you can query"), "tool guidance is in the prompt");

  // ── a model that never stops calling tools is cut off and still answers ──
  requests.length = 0;
  global.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    requests.push(body);
    if (!body.tools) return json({ candidates: [{ content: { parts: [{ text: "Final answer after the tool budget." }] } }] });
    return json({ candidates: [{ content: { parts: [{ functionCall: { name: "calculate", args: { expression: "2+2" } } }] } }] });
  };
  r = await run("loop forever");
  assert.ok(r.ok && r.full === "Final answer after the tool budget.");
  assert.ok(requests.length <= 8, "bounded number of rounds");
  assert.ok(!requests[requests.length - 1].tools, "the last round forces a plain answer");

  // ── tool errors are handed back to the model, not thrown ──
  requests.length = 0;
  global.fetch = async (url, opts) => {
    requests.push(JSON.parse(opts.body));
    if (requests.length === 1) return json({ candidates: [{ content: { parts: [{ functionCall: { name: "query_data", args: { source: "nope" } } }] } }] });
    return json({ candidates: [{ content: { parts: [{ text: "That source does not exist." }] } }] });
  };
  r = await run("bad source");
  assert.ok(r.ok);
  const errResp = requests[1].contents[requests[1].contents.length - 1].parts[0].functionResponse.response;
  assert.strictEqual(errResp.ok, false);
  assert.ok(errResp.error.includes("Available"));

  // ── rate limit surfaces as a clear error ──
  global.fetch = async () => ({ ok: false, status: 429, text: async () => "quota" });
  r = await run("hello");
  assert.ok(!r.ok && /rate limit/i.test(r.err.message));

  // ── OpenRouter: OpenAI-style tool_calls ──
  ai.setProvider("openrouter");
  ai.setOpenRouterKey("or-test");
  const orReq = [];
  global.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    orReq.push(body);
    if (orReq.length === 1) return json({ choices: [{ message: { role: "assistant", content: "", tool_calls: [{ id: "call_1", type: "function", function: { name: "calculate", arguments: JSON.stringify({ expression: "100000 * 1.1" }) } }] } }] });
    return json({ choices: [{ message: { role: "assistant", content: "That is ₹1,10,000." } }] });
  };
  r = await run("what is 1 lakh plus 10 percent");
  assert.ok(r.ok && r.full === "That is ₹1,10,000.");
  assert.strictEqual(orReq[0].tools[0].type, "function");
  const toolMsg = orReq[1].messages[orReq[1].messages.length - 1];
  assert.strictEqual(toolMsg.role, "tool");
  assert.strictEqual(JSON.parse(toolMsg.content).result, 110000);
  assert.ok(orReq[0].messages[0].content.includes("TOOLS: you can query"));

  // ── without knowledge attached the old streaming path is untouched ──
  ai.attachKnowledge(null, null);
  assert.ok(!ai.buildDataContext(state).includes("DATA SOURCES YOU CAN QUERY"));

  console.log("ai-tools tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
