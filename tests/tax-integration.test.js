const assert = require("assert");
const A = require("../advisor-engine.js");
const Ctx = require("../advisor-context.js");
const DH = require("../data-health.js");
const { household: H } = require("../tax-core.js");

// ── Wealth Advisor: sale advice quotes the tax engine's figure, never a vague "check the tax" ──
const taxIfSold = { "in:ACME": { key: "in:ACME", gain: 400000, tax: 36400, exemptUsed: 125000 }, "in:BETA": { key: "in:BETA", gain: 50000, tax: null, taxRange: [6500, 10400], unknownDates: true } };
const res = A.analyze({ now: "2026-10-20", holdings: [{ key: "in:ACME", cls: "stock", name: "Acme", value: 500000, invested: 100000 }, { key: "in:BETA", cls: "stock", name: "Beta", value: 480000, invested: 430000 }], tax: { taxIfSold, harvest: [] } });
const conc = res.signals.find((x) => x.id === "conc-in:ACME");
assert.ok(conc && conc.why.some((w) => /tax about ₹36,400/.test(w) && /₹1,25,000 of the gain falls inside/.test(w)));
assert.ok(!conc.why.some((w) => /check the tax/.test(w)), "no vague tax hint once the number is known");
assert.ok(res.signals.find((x) => x.id === "conc-in:BETA").why.some((w) => /₹6,500–₹10,400/.test(w) && /buy dates are not in your records/.test(w)));
assert.deepStrictEqual(res.holdings.find((h) => h.key === "in:ACME").tax, { gain: 400000, tax: 36400, taxRange: null, exemptUsed: 125000, unknownDates: false });
// Without the tax model the advisor still works and says nothing about tax
const plain = A.analyze({ now: "2026-10-20", holdings: [{ key: "in:ACME", cls: "stock", name: "Acme", value: 500000, invested: 100000 }] });
assert.ok(plain.signals.find((x) => x.id === "conc-in:ACME").why.every((w) => !/tax/i.test(w)) && plain.holdings[0].tax === null);
// Harvest season: one info signal per person, labelled as a tax move
const season = A.analyze({ now: "2027-02-10", holdings: [], tax: { taxIfSold: {}, harvest: [{ who: "Prafful", amount: 55432, by: "2027-03-31" }] } });
const hv = season.signals.find((x) => x.id === "tax-harvest-Prafful");
assert.ok(hv && hv.action === "TAX" && hv.actionLabel === "Tax move" && /₹55,432/.test(hv.title));

// ── Hey Prafful: the compact tax briefing rides along with the portfolio context ──
const row = (person, date, g, tds) => ({ id: person + date, person, date, type: "Salary", grossEarnings: g, basicSalary: g * 0.3, hra: g * 0.2, pf: g * 0.12, taxTds: tds, amount: g - tds });
const state = { income: ["2026-04-30", "2026-05-31", "2026-06-30"].map((d) => row("Me", d, 260000, 40000)), taxProfile: {}, taxReturns: [], taxFamily: [{ id: "f", date: "2024-05-14", amount: 500000, relation: "spouse", note: "PRIVATE NOTE" }] };
const m = H.build(state, "2026-10-20");
const compact = H.briefing(m, { compact: true }), full = H.briefing(m);
assert.ok(/=== TAX/.test(compact) && /Prafful: projected salary/.test(compact) && /get_module \{id: "tax"\}/.test(compact));
assert.ok(full.length > compact.length && /TOP ACTIONS/.test(full));
assert.ok(!/PRIVATE NOTE/.test(full), "family-money notes never go to the AI");
const text = Ctx.build({ result: plain, input: { cash: {}, profile: {}, tax: { brief: compact } }, extras: null });
assert.ok(text.includes("=== TAX"), "the advisor context carries the tax briefing");

// ── Data health: a salary paid without the gross breakdown is flagged (the tax estimate cannot use it) ──
const dh = DH.run({ state: { income: [{ person: "Wife", date: "2026-08-31", type: "Salary", amount: 57000, grossEarnings: 0 }, { person: "Wife", date: "2026-09-30", type: "Salary", amount: 57000, grossEarnings: 60837 }] }, now: "2026-10-20", reported: {} });
const sb = dh.checks.find((c) => c.id === "salary-breakdown");
assert.strictEqual(sb.status, "info"); assert.ok(sb.items.length === 1 && /Archana · 2026-08/.test(sb.items[0]));
assert.strictEqual(DH.run({ state: { income: [{ person: "Me", date: "2026-09-30", type: "Salary", amount: 200000, grossEarnings: 260000 }] }, now: "2026-10-20", reported: {} }).checks.find((c) => c.id === "salary-breakdown").status, "ok");

// ── Protection page and Tax page use the same insurance rule ──
const P = require("../protection-core.js");
const ins = { ...state, insurance: [{ person: "Me", type: "Term life", cover: 100000 }] };
const mi = H.build(ins, "2026-10-20");
const t = P.termCheck(ins, "Me");
assert.strictEqual(t.status, "low");
assert.ok(mi.actions.some((a) => a.id === "term-me" && /below the guide/.test(a.title)), "same 'below the guide' verdict as the Protection page");
console.log("tax integration tests passed");
