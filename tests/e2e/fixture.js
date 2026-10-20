/**
 * Made-up household for the end-to-end check. Every number is chosen so the totals are known in advance,
 * which lets the runner compare what each page shows with an independent calculation.
 */
function pad(n) { return String(n).padStart(2, "0"); }
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function build(now = new Date()) {
  const today = iso(now);
  const stamp = `${now.getDate()} ${MON[now.getMonth()]} ${now.getFullYear()}, 09:10 PM`;
  const yest = new Date(now.getTime() - 86400000);
  const navDate = `${pad(yest.getDate())}-${pad(yest.getMonth() + 1)}-${yest.getFullYear()}`;
  const monthsAgo = (k, day = 1) => iso(new Date(now.getFullYear(), now.getMonth() - k, day));

  const mf = (id, fund, owner, units, nav, type = "PURCHASE") => ({
    id, fundName: fund, owner, units, nav, latestNav: nav, prevNav: nav, navDate, navFetchedAt: now.getTime(), schemeCode: "1" + id.length,
    transactionType: type, invested: units * nav * 0.8, purchaseDate: monthsAgo(4), date: monthsAgo(4), currentValue: units * nav,
  });
  const stock = (id, symbol, company, owner, qty, price) => ({
    id, symbol, company, owner, quantity: qty, avgPrice: price * 0.9, invested: qty * price * 0.9, currentPrice: price, prevClose: price * 0.99,
    currentValue: qty * price, priceDate: stamp, purchaseDate: monthsAgo(3), date: monthsAgo(3), category: "Stock", demat: "Test",
  });
  const flat = (id, owner, value, note) => ({ id, owner, value, note, date: monthsAgo(2) });

  const state = {
    mutualFunds: [
      mf("mf-a1", "Alpha Flexi Cap Fund Direct Growth", "Me", 1000, 50),
      mf("mf-b1", "Beta Index Fund Direct Growth", "Wife", 200, 100),
      mf("mf-b2", "Beta Index Fund Direct Growth", "Wife", 50, 100, "REDEMPTION"),
    ],
    stocks: [stock("stk-1", "AAA", "AAA Ltd", "Me", 10, 100), stock("stk-2", "BBB", "BBB Ltd", "Wife", 5, 200)],
    usstocks: [{ id: "uss-1", symbol: "ZZZ", company: "ZZZ Inc", owner: "Me", quantity: 2, avgPrice: 90, invested: 180, currentPrice: 100, prevClose: 99, currentValue: 200, priceDate: stamp, purchaseDate: monthsAgo(3), date: monthsAgo(3), category: "Stock", demat: "Test" }],
    gold: [{ id: "gold-ring-1", name: "Ring", owner: "Wife", carat: "22K", weightGrams: 10, purchasePricePerGram: 6000, invested: 60000, value: 100000, category: "Jewellery", date: monthsAgo(6) }],
    fd: [flat("fd-1", "Me", 200000, "FD")],
    epf: [flat("epf-1", "Me", 100000, "EPF")],
    ppf: [flat("ppf-1", "Me", 50000, "PPF")],
    bonds: [flat("bonds-1", "Me", 10000, "Bond")],
    silver: [flat("silver-1", "Me", 5000, "Silver")],
    crypto: [flat("crypto-1", "Wife", 2000, "Crypto")],
    banksaving: [flat("bank-1", "Me", 30000, "Bank")],
    others: [flat("others-1", "Wife", 20000, "Other")],
    liabilities: [{ id: "liab-1", name: "Car Loan", owner: "Me", category: "Car Loan", value: 40000, emi: 5000, emiDay: 5, rate: 8, payments: {} }],
    income: [
      ...[3, 2, 1].flatMap((k) => [
        { id: `inc-me-${k}`, person: "Me", date: monthsAgo(k), source: "Acme", type: "Salary", amount: 200000, netSalary: 200000, grossEarnings: 260000, basicSalary: 80000, hra: 40000, pf: 9600, taxTds: 48000, professionalTax: 200, organization: "Acme" },
        { id: `inc-w-${k}`, person: "Wife", date: monthsAgo(k), source: "Beta", type: "Salary", amount: 60000, netSalary: 60000, grossEarnings: 62000, basicSalary: 31000, hra: 12000, pf: 3700, taxTds: 0, professionalTax: 200, organization: "Beta" },
      ]),
    ],
    expenses: [
      { id: "e1", date: monthsAgo(1, 3), amount: 30000, category: "Rent", note: "rent", paidBy: "Me" },
      { id: "e2", date: monthsAgo(0, 1), amount: 20000, category: "EMI - Car, Home", note: "emi", paidBy: "Me" },
      { id: "e3", date: monthsAgo(0, 1), amount: 5000, category: "EMI- Car, Home", note: "emi extra", paidBy: "Me" },
      { id: "e4", date: monthsAgo(1, 9), amount: 10000, category: "Groceries", note: "food", paidBy: "Wife" },
      { id: "e6", date: monthsAgo(1, 12), amount: 15000, category: "Shopping", note: "clothes", paidBy: "Me" },
      // this month has expenses but no income yet: savings must compare LAST month's income with LAST month's spending
      { id: "e5", date: monthsAgo(0, 1) <= today ? monthsAgo(0, 1) : today, amount: 90000, category: "Travel", note: "trip", paidBy: "Me" },
    ],
    goals: [
      { id: "goal-1", name: "Mutual Fund Portfolio", category: "Finance", owner: "Both", target: 1000000, saved: 1, track: "Mutual funds", dueDate: iso(new Date(now.getFullYear() + 1, now.getMonth(), 15)) },
      { id: "goal-2", name: "Trip", category: "Travel", owner: "Me", target: 100000, saved: 25000, dueDate: iso(new Date(now.getFullYear() + 1, now.getMonth(), 20)) },
    ],
    goldPrice: { price24k: 14000, price22k: 12833.33, prevClose24k: 13900, prevClose22k: 12741.67, source: "test" },
    vehicles: [{ id: "veh-test-1", name: "Test car", type: "Car", owner: "Me", purchaseDate: monthsAgo(24), purchasePrice: 800000, value: 100000, note: "" }],
    insurance: [
      { id: "ins-test-1", person: "Both", type: "Health", insurer: "Acme Health", policyName: "Family floater", cover: 1000000, premium: 24000, frequency: "Yearly", nextDue: iso(new Date(now.getTime() + 10 * 86400000)), nominee: "", note: "" },
      { id: "ins-test-2", person: "Me", type: "Term life", insurer: "Acme Life", policyName: "", cover: 30000000, premium: 18000, frequency: "Yearly", nextDue: iso(new Date(now.getTime() + 200 * 86400000)), nominee: "Archana", note: "" },
    ],
    protectionSeeded: true,
    // Tax page: made-up profile, one filed return with unsupported claims, one unfiled year, one family transfer
    taxProfile: { marriageDate: "2024-06-30", rentMonthly: { Me: 15000 }, parentsSenior: true, checklist: [{ id: "will", title: "Make a will", why: "Test item", severity: "high" }], done: {} },
    taxReturns: [
      { id: "taxr-test-1", fy: "2025-26", person: "Me", filed: { form: "ITR-1", regime: "new", grossSalary: 3000000, exemptAllowances: 200000, employerNps: 100000, otherIncome: 0, totalTax: 0, taxesPaid: 500000 }, evidence: { form16: { gross: 3000000, exemptions: 0, employerNps: 0 }, npsAccount: false, ais: { salary: 3000000, interest: 20000 } } },
      { id: "taxr-test-2", kind: "unfiled", fy: "2021-22", person: "Me", regime: "old", grossSalary: 1300000, exemptAllowances: 170000, deductions: 140000, otherIncome: 100, tds: 70000 },
    ],
    taxFamily: [{ id: "taxf-test-1", date: "2024-05-14", amount: 500000, from: "Me", to: "Wife", relation: "spouse", viaOther: true }],
    habits: [{ id: "habit-1", name: "Walk", frequency: "Daily", owner: "Me", streak: 2, bestStreak: 5, history: [] }],
    tasks: [{ id: "task-1", text: "Pay rent", area: "Finance", date: today, done: false }],
    workouts: [], activities: [], studies: [], assets: [], netWorthHistory: [], interviewTrackerEntries: [],
  };

  // Independent expectations (US stocks depend on the live exchange rate, so they are added by the runner)
  const mfNet = 1000 * 50 + (200 - 50) * 100;
  const stocks = 10 * 100 + 5 * 200;
  const rest = 100000 /* vehicle */ + 100000 + 200000 + 100000 + 50000 + 10000 + 5000 + 2000 + 30000 + 20000;
  const assetsWithoutUs = mfNet + stocks + rest;
  const lastMonthIncome = 260000;
  const thisMonthExpenses = 20000 + 5000 + 90000;   // spent after the latest salary arrived
  return {
    state,
    expected: {
      mfNet, assetsWithoutUs, goldTyped: 100000, goldLive: Math.round(10 * 12833.33 * 100) / 100, liabilities: 40000,
      savedCycle: lastMonthIncome - thisMonthExpenses,
      savingsRatePct: Math.round(((lastMonthIncome - thisMonthExpenses) / lastMonthIncome) * 100),
      emiTotal: 25000,
    },
  };
}

module.exports = { build };
