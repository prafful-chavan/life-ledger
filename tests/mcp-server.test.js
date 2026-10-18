const assert = require("assert");
const V = require("../mcp/vault-client.js");
const S = require("../mcp/server.js");

(async () => {
  // Vault round-trip using the app's scheme (PBKDF2 250k + AES-GCM + gzip), and a wrong password is rejected
  const inner = { data: { hello: "world" } };
  for (const compress of [true, false]) {
    const vault = await V.encryptVault(inner, "pw-123", { compress });
    assert.deepStrictEqual(await V.decryptVault(vault, "pw-123"), inner);
    await assert.rejects(() => V.decryptVault(vault, "nope"));
  }

  // fetchState sends the derived token (never the password) and surfaces gateway errors plainly
  const vault = await V.encryptVault({ data: { expenses: [] } }, "pw-123");
  let sent;
  const reply = (obj) => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(obj) });
  const ok = async (url, init) => { sent = JSON.parse(init.body); return reply({ ok: true, rev: 7, vault }); };
  const got = await V.fetchState({ gatewayUrl: "https://script.google.com/x", password: "pw-123", fetchImpl: ok });
  assert.strictEqual(got.rev, 7);
  assert.strictEqual(sent.op, "pull");
  assert.ok(/^[0-9a-f]{64}$/.test(sent.token) && !JSON.stringify(sent).includes("pw-123"), "token only");
  const bad = async () => reply({ ok: false, error: "unauthorized" });
  // a redirect is followed with a plain GET and no body
  const hops = [];
  const redirecting = async (url, init) => { hops.push(init.method); return hops.length === 1 ? { ok: false, status: 302, headers: { get: () => "https://script.googleusercontent.com/macros/echo?x=1" }, text: async () => "" } : reply({ ok: true, rev: 9, vault }); };
  assert.strictEqual((await V.fetchState({ gatewayUrl: "https://script.google.com/x", password: "pw-123", fetchImpl: redirecting })).rev, 9);
  assert.deepStrictEqual(hops, ["POST", "GET"]);
  await assert.rejects(() => V.fetchState({ gatewayUrl: "https://script.google.com/x", password: "x", fetchImpl: bad }), /Wrong vault password/);

  // MCP protocol
  const state = {
    fx: { usdInr: 90 }, mutualFunds: [], stocks: [], usstocks: [], gold: [], silver: [], crypto: [], fd: [{ value: 1000 }], epf: [], ppf: [], bonds: [], banksaving: [], others: [], vehicles: [{ name: "Altroz", value: 500 }],
    liabilities: [], income: [], expenses: [], goals: [{ name: "Car", target: 100, saved: 25 }], netWorthHistory: [],
    people: { me: { dob: "1995-10-22" } },
    insurance: [{ person: "Me", type: "Term life", insurer: "ACME", policyName: "Secret plan", cover: 5000000, premium: 12000, frequency: "Yearly", nextDue: "2027-01-01", nominee: "SECRET NAME", note: "POLICY-998877" }],
  };
  const loader = async () => state;
  const init = await S.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }, loader);
  assert.strictEqual(init.result.serverInfo.name, "life-ledger");
  assert.strictEqual(await S.handle({ jsonrpc: "2.0", method: "notifications/initialized" }, loader), null, "notifications get no reply");
  const list = await S.handle({ jsonrpc: "2.0", id: 2, method: "tools/list" }, loader);
  assert.ok(list.result.tools.length >= 8 && list.result.tools.every((t) => t.inputSchema && t.description));
  const call = async (name, args) => (await S.handle({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name, arguments: args || {} } }, loader)).result;

  const briefRes = await call("household_brief");
  const text = briefRes.content[0].text;
  assert.ok(!briefRes.isError);
  assert.ok(!/SECRET NAME|POLICY-998877|1995-10-22/.test(text), "nominee, policy note and date of birth never leave");
  const parsed = JSON.parse(text);
  assert.strictEqual(parsed.netWorth.classes.others.value, 500, "vehicles count");
  assert.strictEqual(parsed.protection.people[0].who, "Prafful");
  assert.strictEqual(parsed.goals[0].progressPct, 25);
  const tracked = { ...state, mutualFunds: [{ transactionType: "PURCHASE", currentValue: 600, owner: "Me" }, { transactionType: "REDEMPTION", currentValue: 100, owner: "Me" }, { transactionType: "PURCHASE", currentValue: 50, owner: "Wife" }], goals: [{ name: "MF", target: 1000, saved: 1, track: "Mutual funds", owner: "Both" }, { name: "Mine", target: 1000, saved: 1, track: "Mutual funds", owner: "Me" }] };
  const g2 = JSON.parse((await S.handle({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "goals" } }, async () => tracked)).result.content[0].text);
  assert.deepStrictEqual(g2.map((g) => g.saved), [550, 500], "goals that follow holdings use live values, net of redemptions, by owner");

  const unknown = await S.handle({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "delete_everything" } }, loader);
  assert.ok(unknown.error, "unknown tool is refused");
  const failing = (await S.handle({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "net_worth" } }, async () => { throw new Error("Not set up yet"); })).result;
  assert.ok(failing.isError && /Not set up/.test(failing.content[0].text));
  assert.ok(S.TOOLS.every((t) => !/write|delete|push|set_|update/i.test(t.name)), "read-only by design");
  console.log("mcp-server tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
