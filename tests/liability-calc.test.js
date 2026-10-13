const assert = require("assert");
const L = require("../liability-calc.js");

// Normalisation: strings from forms/CSV become numbers, junk becomes 0, negatives clamp
const n = L.normalizeLiability({ id: "l1", name: "Car loan", value: "₹ 4,50,000", emi: "16300", rate: "9.5", emiDay: "40", owner: "x" }, () => "Me");
assert.strictEqual(n.value, 450000);
assert.strictEqual(n.emi, 16300);
assert.strictEqual(n.rate, 9.5);
assert.strictEqual(n.emiDay, 31);
assert.strictEqual(n.owner, "Me");
assert.strictEqual(L.normalizeLiability({ value: -5 }).value, 0);
assert.deepStrictEqual(L.normalizeLiability({}).payments, []);

// Reducing-balance EMI: interest first, rest reduces the outstanding
let loan = { ...n };
loan = L.applyEmiPayment(loan, { amount: 16300, date: "2026-10-10" });
const interest = Math.round((450000 * 9.5) / 1200 * 100) / 100; // 3562.5
assert.strictEqual(loan.payments[0].interest, interest);
assert.strictEqual(loan.value, Math.round((450000 - (16300 - interest)) * 100) / 100);
assert.strictEqual(L.paidThisMonth(loan, "2026-10-25"), true);
assert.strictEqual(L.paidThisMonth(loan, "2026-11-01"), false);

// No rate: the full EMI reduces the outstanding; never below zero
const plain = L.applyEmiPayment({ value: 10000, rate: 0, payments: [] }, { amount: 4000, date: "2026-10-01" });
assert.strictEqual(plain.value, 6000);
assert.strictEqual(L.applyEmiPayment({ value: 3000, rate: 0 }, { amount: 5000, date: "2026-10-01" }).value, 0);
assert.throws(() => L.applyEmiPayment({ value: 100 }, { amount: 0, date: "2026-10-01" }));
assert.throws(() => L.applyEmiPayment({ value: 0 }, { amount: 100, date: "2026-10-01" }));

// Undo restores exactly; refuses after a manual edit
const u = L.undoLastPayment(plain);
assert.ok(u.ok);
assert.strictEqual(u.liability.value, 10000);
assert.strictEqual(u.liability.payments.length, 0);
assert.strictEqual(L.undoLastPayment({ ...plain, value: 5500 }).ok, false);
assert.strictEqual(L.undoLastPayment({ value: 1, payments: [] }).ok, false);

console.log("liability-calc tests passed");
