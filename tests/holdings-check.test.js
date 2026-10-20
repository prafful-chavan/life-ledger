// Holdings checked against INDmoney: matching, ignore list, lag vs confirmed gaps, a bad reference copy,
// and the one-field vault write (compare-and-swap, the vault's salt kept, the app's sync stamp).
const assert = require("assert");
const { compare, similarity } = require("../mcp/holdings-check.js");
const V = require("../mcp/vault-client.js");
const E = require("../sync-engine.js");

const state = {
  fx: { usdInr: 95 },
  mutualFunds: [
    { owner: "Me", fundName: "HDFC Flexi Cap Direct Plan Growth", units: 100, latestNav: 2000, transactionType: "PURCHASE" },
    { owner: "Me", fundName: "HDFC Flexi Cap Direct Plan Growth", units: 10, latestNav: 2000, transactionType: "REDEMPTION" },
    { owner: "Wife", fundName: "Bandhan Small Cap Fund Direct Growth", units: 5081.94, latestNav: 55.798 },
  ],
  stocks: [{ owner: "Me", symbol: "FACT", company: "Fertilisers & Chemicals Travancore Ltd", quantity: 37, currentPrice: 723.3 }],
  usstocks: [{ owner: "Me", symbol: "AAPL", company: "Apple", quantity: 3.3125628, currentPrice: 340 }],
};
const ref = (wifeUnits = 5081.92, extraWife = []) => ({
  fetchedAt: "2026-10-21",
  members: {
    Me: {
      MF: { total: 90 * 2000, rows: [{ name: "HDFC Flexi Cap Fund -Direct Plan - Growth Option", units: 90, value: 90 * 2000 }] },
      IND_STOCK: { total: 26762.1, rows: [{ name: "Fertilizers & Chemicals Travancore Ltd", units: 37, value: 26762.1 }] },
      US_STOCK: { total: 107108.76, rows: [{ name: "Apple", symbol: "AAPL", units: 3.3125628, value: 107108.76 }] },
    },
    Wife: {
      MF: { total: wifeUnits * 55.798 + extraWife.reduce((t, x) => t + x.value, 0), rows: [{ name: "Bandhan Small Cap Fund Direct Growth", units: wifeUnits, value: wifeUnits * 55.798 }, ...extraWife] },
    },
  },
});

assert.ok(similarity("HDFC Flexi Cap Direct Plan Growth", "HDFC Flexi Cap Fund -Direct Plan - Growth Option") === 1, "fund names in two spellings");
assert.ok(similarity("Fertilisers & Chemicals Travancore Ltd", "Fertilizers & Chemicals Travancore Ltd") === 1, "British and American spelling");

// Everything matches (redemption netted; units within rounding)
let r = compare(state, ref(), { today: "2026-10-21" });
assert.deepStrictEqual([r.status, r.matched, r.total, r.gaps.length], ["ok", 4, 4, 0]);

// INDmoney behind by 3 SIPs: a new gap is "watch" the first week, "gaps" when the next run still sees it
const lag = ref(4820.5);
r = compare(state, lag, { today: "2026-10-14" });
assert.strictEqual(r.status, "watch");
assert.deepStrictEqual([r.gaps[0].who, r.gaps[0].kind, r.gaps[0].confirmed], ["Wife", "units", false]);
assert.strictEqual(r.gaps[0].diffValue, Math.round((5081.94 - 4820.5) * 55.798), "the gap in rupees at INDmoney's price");
const again = compare(state, lag, { today: "2026-10-21", prev: r });
assert.deepStrictEqual([again.status, again.gaps[0].confirmed], ["gaps", true], "seen twice: confirmed");
assert.strictEqual(compare(state, ref(), { today: "2026-10-21", prev: r }).status, "ok", "the lag cleared");

// A holding only in INDmoney: a gap, unless it is on the ignore list
const cpse = [{ name: "CPSE ETF", units: 2, value: 176 }];
r = compare(state, ref(5081.92, cpse), { today: "2026-10-21" });
assert.ok(r.gaps.some((g) => g.kind === "missing-in-app" && g.name === "CPSE ETF"));
r = compare(state, ref(5081.92, cpse), { today: "2026-10-21", ignore: [{ who: "Wife", name: "CPSE ETF" }] });
assert.deepStrictEqual([r.status, r.ignored], ["ok", 1], "ignored holdings are counted, not flagged");

// A holding only in the app
r = compare({ ...state, stocks: [...state.stocks, { owner: "Me", symbol: "WIPRO", company: "Wipro Ltd", quantity: 93, currentPrice: 182 }] }, ref(), { today: "2026-10-21" });
assert.ok(r.gaps.some((g) => g.kind === "not-in-reference" && /Wipro/.test(g.name)));

// A reference copied wrongly (rows do not add up to INDmoney's own total) is not used to judge the app
const bad = ref(); bad.members.Me.MF.total = 999999;
r = compare(state, bad, { today: "2026-10-21" });
assert.strictEqual(r.status, "bad-reference");
console.log("holdings comparison tests passed");

// ── The one-field vault write ──
(async () => {
  const pw = "test-password";
  const salt = Buffer.alloc(16, 7);
  const data = { income: [{ id: "a" }], mutualFunds: [{ id: "m" }], taxProfile: { x: 1 } };
  let server = { rev: 5, vault: { ...(await V.encryptVault({ data, sync: E.emptyMeta(), totpSecret: null }, pw, { salt })), entryCount: 2 } };
  let interloper = 1;   // another device saves once between our read and our push
  const pushes = [];
  const fetchImpl = async (url, init) => {
    const req = JSON.parse(init.body);
    const reply = (o) => ({ ok: true, status: 200, headers: new Map(), text: async () => JSON.stringify(o) });
    if (req.op === "pull") return reply({ ok: true, rev: server.rev, vault: server.vault });
    if (req.op === "push") {
      pushes.push(req);
      if (interloper-- > 0) { server = { ...server, rev: server.rev + 1 }; return reply({ ok: true, conflict: true, rev: server.rev }); }
      if (req.baseRev !== server.rev) return reply({ ok: true, conflict: true, rev: server.rev });
      server = { rev: server.rev + 1, vault: req.vault };
      return reply({ ok: true, rev: server.rev });
    }
  };
  const value = { checkedOn: "2026-10-21", status: "ok", matched: 4, total: 4, gaps: [] };
  const res = await V.updateField({ gatewayUrl: "https://example.test/gw", password: pw, field: "holdingsCheck", value, fetchImpl, now: 1790000000000 });
  assert.deepStrictEqual([res.rev, res.attempts], [7, 2], "retried once after a conflict");
  assert.strictEqual(pushes[1].baseRev, 6, "the retry is guarded by the revision it re-read");
  const inner = await V.decryptVault(server.vault, pw);
  assert.deepStrictEqual(inner.data.holdingsCheck, value);
  assert.deepStrictEqual([inner.data.income, inner.data.mutualFunds, inner.data.taxProfile], [data.income, data.mutualFunds, data.taxProfile], "nothing else changed");
  assert.strictEqual(inner.sync.k.holdingsCheck, 1790000000000, "stamped so it wins the merge on every device");
  assert.strictEqual(Object.keys(inner.sync.k).length, 1, "only this field stamped");
  assert.strictEqual(server.vault.salt, salt.toString("base64"), "the vault's salt is kept");
  assert.strictEqual(server.vault.entryCount, 2, "the entry count the gateway checks is unchanged");
  // The merge on a device that has the old copy takes the new field
  const merged = E.merge({ data, meta: E.emptyMeta() }, { data: inner.data, meta: inner.sync });
  assert.deepStrictEqual(merged.data.holdingsCheck, value, "an app device picks it up when it syncs");
  await assert.rejects(V.updateField({ gatewayUrl: "x", password: pw, field: "mutualFunds", value: {}, fetchImpl }), /not allowed/, "only the whitelisted field can be written");
  console.log("vault field write tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
