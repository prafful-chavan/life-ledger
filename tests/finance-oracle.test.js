// Money maths against outside references (written from the source before running the code):
// XIRR against Excel's documented example; holding periods and debt-fund rules against the Income-tax Act.
const assert = require("assert");
const A = require("../advisor-engine.js");
const G = require("../tax-core.js").gains;

// ── XIRR ──
const xirr = A.xirr || (A._test && A._test.xirr);
assert.ok(typeof xirr === "function", "advisor-engine exposes xirr");
// Microsoft Excel XIRR documentation: -10,000 on 1-Jan-2008; 2,750 on 1-Mar-2008; 4,250 on 30-Oct-2008; 3,250 on 15-Feb-2009;
// 2,750 on 1-Apr-2009 → 0.373362535 (37.34%)
const excel = xirr([{ date: "2008-01-01", amount: -10000 }, { date: "2008-03-01", amount: 2750 }, { date: "2008-10-30", amount: 4250 }, { date: "2009-02-15", amount: 3250 }], 2750, "2009-04-01");
assert.ok(Math.abs(excel - 37.3362535) < 0.0001, `Excel's example: ${excel}`);
// ₹100 grows to ₹121 over exactly 730 days (no leap day): 10% a year
assert.ok(Math.abs(xirr([{ date: "2021-01-01", amount: -100 }], 121, "2023-01-01") - 10) < 1e-6, "10% over two 365-day years");
assert.strictEqual(xirr([{ date: "2021-01-01", amount: 100 }], 121, "2023-01-01"), null, "no investment, no return");

// ── Capital gains on a sale today (Income-tax Act) ──
const lot = (o) => ({ kind: "mf", name: "F", owner: "Me", cat: "equity", qty: 1, cost: 100000, price: 150000, ...o });
const sell = (l, today = "2026-10-20") => G.taxIfSold([lot(l)], today, { slab: { Me: 30 }, exemptionLeft: { Me: 0 } })[0];
// Sec 2(42A): listed equity / equity MF is long-term only if held MORE than 12 months
assert.strictEqual(sell({ date: "2025-10-20" }).tax, Math.round(50000 * 0.20 * 1.04), "exactly 12 months is still short-term (20%)");
assert.strictEqual(sell({ date: "2025-10-19" }).tax, Math.round(50000 * 0.125 * 1.04), "12 months and a day is long-term (12.5%)");
// Sec 50AA: debt funds bought on or after 1-Apr-2023 are short-term at the slab rate however long they are held
assert.strictEqual(sell({ cat: "debt", date: "2023-04-01" }).tax, Math.round(50000 * 0.30 * 1.04), "post-Mar-2023 debt fund: slab rate");
// Debt funds bought before 1-Apr-2023: long-term after 24 months, 12.5% without indexation (sec 112, from 23-Jul-2024)
assert.strictEqual(sell({ cat: "debt", date: "2020-01-01" }).tax, Math.round(50000 * 0.125 * 1.04), "pre-Apr-2023 debt fund held 24+ months: 12.5%");
assert.strictEqual(sell({ cat: "debt", date: "2023-03-01", }, "2024-12-01").tax, Math.round(50000 * 0.30 * 1.04), "pre-Apr-2023 debt fund under 24 months: slab rate");
console.log("finance oracle tests passed");
