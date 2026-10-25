// Looking up a fund's scheme code: uses the small search endpoint (the 11 MB master list has no CORS header, so browsers cannot read it),
// picks the Direct Growth plan, never accepts a loose match, and a failing service never breaks the caller.
const assert = require("assert");
const store = {};
global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
global.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
const { resolveSchemeCodes } = require("../app.js");

const SEARCH = {
  "hdfc mid cap": [{ schemeCode: 1, schemeName: "HDFC Mid Cap Fund - Regular Plan - Growth Option" }, { schemeCode: 118989, schemeName: "HDFC Mid Cap Fund - Direct Plan - Growth Option" }, { schemeCode: 3, schemeName: "HDFC Mid Cap Fund - Direct Plan - IDCW Option" }],
};
const calls = [];
global.fetch = async (url) => {
  calls.push(String(url));
  const u = new URL(url);
  if (u.pathname === "/mf") throw new TypeError("Failed to fetch");   // the browser cannot read the master list
  if (u.pathname === "/mf/search") { const list = SEARCH[u.searchParams.get("q")] || []; return { ok: true, json: async () => list }; }
  const code = Number(u.pathname.split("/").pop()); const all = Object.values(SEARCH).flat().find((s) => s.schemeCode === code);
  return { ok: Boolean(all), json: async () => (all ? { meta: { scheme_name: all.schemeName }, data: [] } : {}) };
};

(async () => {
  let r = await resolveSchemeCodes(["HDFC Mid Cap Fund Direct Growth"]);
  assert.strictEqual(r["HDFC Mid Cap Fund Direct Growth"].schemeCode, 118989, "the Direct Growth plan, not Regular or IDCW");
  assert.ok(!calls.some((u) => new URL(u).pathname === "/mf"), "the master list is not requested");
  assert.ok(calls.some((u) => u.includes("/mf/search?q=hdfc%20mid%20cap")), "the search endpoint is used");

  r = await resolveSchemeCodes(["Totally Made Up Fund XYZ"]);
  assert.strictEqual(r["Totally Made Up Fund XYZ"], undefined, "nothing found: no guess");

  global.fetch = async () => { throw new TypeError("Failed to fetch"); };
  r = await resolveSchemeCodes(["Some Other Fund Direct Growth"]);
  assert.strictEqual(r["Some Other Fund Direct Growth"], undefined, "a failing service leaves the fund unresolved and does not throw");

  global.fetch = async () => { throw new Error("must not be called"); };
  r = await resolveSchemeCodes(["120828"]);
  assert.strictEqual(r["120828"].schemeCode, 120828, "a six-digit code needs no lookup");
  console.log("mf-resolve-codes: all checks passed");
})().catch((e) => { console.error(e); process.exit(1); });
