// The daily brief's numbers (mcp/analysis.js) written from their rules, each threshold tested on both sides.
const assert = require("assert");
const A = require("../mcp/analysis.js");

// ── Gold: weight × the carat rate; the saved value only when there is no weight or no rate ──
{
  const gv = (gp, rows) => Math.round(A.netWorth({ goldPrice: gp, gold: rows }).classes.gold.value);
  assert.strictEqual(gv({ price22k: 9000, price24k: 10000 }, [{ carat: "24K", weightGrams: 1 }, { carat: "22K", weightGrams: 1 }, { carat: "18K", weightGrams: 1 }]), 10000 + 9000 + 7500, "24K at the 24K rate, 22K at the 22K rate, 18K at 18/24 of 24K");
  assert.strictEqual(gv({ price22k: 9000 }, [{ carat: "24K", weightGrams: 1 }, { carat: "18K", weightGrams: 1 }]), Math.round(9000 * 24 / 22 + 9000 * 24 / 22 * 18 / 24), "only a 22K rate: 24K = 22K × 24/22");
  assert.strictEqual(gv({ price24k: 10000 }, [{ carat: "22K", weightGrams: 2 }]), Math.round(2 * 10000 * 22 / 24), "only a 24K rate: 22K = 24K × 22/24");
  assert.strictEqual(gv({ price22k: 9000 }, [{ carat: "22K", value: 5000 }, { carat: "22K", weight: 1 }]), 5000 + 9000, "no weight: the saved value; `weight` is accepted too");
  assert.strictEqual(gv({}, [{ carat: "22K", weightGrams: 3, value: 7777 }]), 7777, "no rate at all: the saved value");
  assert.strictEqual(gv({ price22k: 9000 }, [{ weightGrams: 1 }]), 9000, "no carat: 22K");
}

// ── USD rate: an explicit rate, else the vault's, else the last recorded one ──
assert.strictEqual(A.netWorth({ fx: { usdInr: 95 }, usstocks: [{ currentValue: 10 }] }, 90).fxUsdInr, 90, "an explicit rate wins");
assert.strictEqual(A.netWorth({ fx: { usdInr: 95 }, usstocks: [{ currentValue: 10 }] }).classes.usStocks.value, 950);
assert.strictEqual(A.netWorth({ netWorthHistory: [{ date: "2026-10-18", fxRate: 93 }, { date: "2026-10-19", fxRate: 94 }, { date: "2026-10-20" }] }).fxUsdInr, 94, "the latest record that has a rate");
assert.strictEqual(A.netWorth({}).fxUsdInr, 0, "no rate anywhere: 0, so US shares are not guessed");

// ── What moved since the last recorded day (moves under ₹500 are noise) ──
{
  const yesterday = new Date(Date.now() + 5.5 * 3600000 - 86400000).toISOString().slice(0, 10);
  const prev = { date: yesterday, netWorth: 100000, mutualFunds: 10000, stocks: 20000, gold: 0, bankSaving: 50000, liabilities: 1000 };
  const s = { mutualFunds: [{ currentValue: 10499 }], stocks: [{ currentValue: 20500 }], banksaving: [{ value: 49000 }], liabilities: [{ value: 1500 }], netWorthHistory: [prev] };
  const c = A.netWorth(s).changeVsPrevious;
  assert.strictEqual(c.previousDate, yesterday);
  assert.deepStrictEqual(c.byClass, { stocks: 500, bankSaving: -1000, liabilities: 500 }, "₹499 left out; ₹500 shown; a bigger loan shows as +₹500 of debt");
  assert.strictEqual(c.marketLikeMoves, 500, "only market classes count as market moves");
  const hist = A.netWorth({ netWorthHistory: Array.from({ length: 40 }, (_, i) => ({ date: `2026-09-${String((i % 30) + 1).padStart(2, "0")}`, netWorth: i })).reverse() }).history;
  assert.strictEqual(hist.length, 30, "the last 30 points");
  assert.ok(hist.every((h, i) => i === 0 || hist[i - 1].date <= h.date), "oldest first");
}

// ── Spending report: a month against the six months before it, and the salary that paid it ──
{
  const e = (date, amount, category) => ({ date, amount, category });
  const s = {
    income: [{ date: "2026-08-31", amount: 100000, person: "Me", type: "Salary" }, { date: "2026-07-31", amount: 80000, person: "Me", type: "Salary" }],
    expenses: [e("2026-09-02", 30000, "Rent"), e("2026-09-05", 1000, "Groceries"), e("2026-09-06", 500, "Groceries"), e("2026-09-07", 9000, "EMI- Car, Home, policy"),
      e("2026-09-08", 4000, "Gromming"), e("2026-09-09", 200, "Chai"),
      e("2026-08-02", 20000, "Rent"), e("2026-08-05", 3000, "Groceries"), e("2026-06-02", 40000, "Rent")],
  };
  const r = A.expenseReport(s, "2026-09");
  assert.deepStrictEqual([r.month, r.spent, r.monthIsComplete], ["2026-09", 44700, true]);
  assert.deepStrictEqual([r.salaryThatPaysIt.creditedIn, r.salaryThatPaysIt.net, r.leftFromSalary, r.savingsRatePct], ["2026-08", 100000, 55300, 55.3], "August's salary pays September");
  assert.strictEqual(r.avg6moSpend, Math.round((23000 + 40000) / 2), "the average of the earlier months that have spending (Aug, Jun), not of six");
  const rent = r.categories.find((c) => c.category === "Rent");
  assert.deepStrictEqual([rent.thisMonth, rent.avg6mo, rent.vsAvgPct], [30000, 30000, 0], "Rent: (₹20,000 + ₹40,000) / 2 months");
  const groc = r.categories.find((c) => c.category === "Groceries");
  assert.deepStrictEqual([groc.thisMonth, groc.avg6mo, groc.vsAvgPct], [1500, 1500, 0], "Groceries: ₹3,000 over 2 months");
  assert.ok(r.categories.some((c) => c.category === "Grooming") && r.categories.some((c) => c.category === "EMI - Car, Home, policy"), "category spellings normalised");
  assert.strictEqual(r.categories.find((c) => c.category === "Chai").vsAvgPct, null, "new this month: no comparison");
  assert.ok(r.categories.every((c, i) => i === 0 || r.categories[i - 1].thisMonth >= c.thisMonth), "biggest first");
  assert.deepStrictEqual(r.biggestExpenses.map((x) => x.amount), [30000, 9000, 4000, 1000, 500], "the five biggest, biggest first");
  const sep = r.trend.find((t) => t.month === "2026-09"), aug = r.trend.find((t) => t.month === "2026-08");
  assert.deepStrictEqual([sep.spent, sep.salary, sep.savedPct, aug.salary, aug.savedPct], [44700, 100000, 55.3, 80000, 71.3], "each month against the salary of the month before");
}

// ── Health flags: each threshold from both sides (today 20 Oct: spending averages Apr–Sep) ──
{
  const base = (bank, sepSpend, emi, aug = 100000) => ({
    income: [{ date: "2026-08-31", amount: aug, netSalary: aug, person: "Me", type: "Salary" }],
    expenses: ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08"].map((m) => ({ date: m + "-10", amount: 10000, category: "Home" })).concat({ date: "2026-09-10", amount: sepSpend, category: "Home" }),
    banksaving: [{ value: bank }], liabilities: emi ? [{ value: 100000, emi }] : [], insurance: [], vehicles: [],
  });
  const flag = (s, topic) => A.healthCheck(s, "2026-10-20").flags.find((f) => f.topic === topic);
  assert.strictEqual(flag(base(60000, 10000), "Emergency fund").level, "good", "6 months exactly");
  assert.strictEqual(flag(base(59999, 10000), "Emergency fund").level, "watch");
  assert.strictEqual(flag(base(30000, 10000), "Emergency fund").level, "watch", "3 months exactly");
  assert.strictEqual(flag(base(29999, 10000), "Emergency fund").level, "act");
  assert.strictEqual(flag(base(1, 70000), "Savings rate").level, "good", "30% left of August's ₹1L after September");
  assert.strictEqual(flag(base(1, 71000), "Savings rate").level, "watch", "29%");
  assert.strictEqual(flag(base(1, 85000), "Savings rate").level, "watch", "15% exactly");
  assert.strictEqual(flag(base(1, 85100), "Savings rate").level, "act", "14.9%");
  assert.strictEqual(flag(base(1, 10000, 30000), "Debt load").level, "good", "EMIs 30% of take-home");
  assert.strictEqual(flag(base(1, 10000, 30001), "Debt load").level, "watch");
  assert.strictEqual(flag(base(1, 10000), "Debt load"), undefined, "no EMI: no flag");
  const renew = A.healthCheck({ ...base(1, 10000), insurance: [{ type: "Car", person: "Me", policyName: "Car", premium: 1, frequency: "Yearly", nextDue: "2026-10-19" }] }, "2026-10-20").flags.find((f) => f.topic === "Renewal");
  assert.deepStrictEqual([renew.level, /is overdue/.test(renew.text)], ["act", true], "a renewal date gone is to act on");
}
// ── Second round: cases the mutation test showed were still unchecked ──
{
  const e = (date, amount, category = "Home") => ({ date, amount, category });
  // The six months before, by position (months 4 and 5 back too), and a real change against the average
  const s = { income: [], expenses: [e("2026-09-01", 15000, "Food"), e("2026-05-01", 10000, "Food"), e("2026-04-01", 20000, "Food"), e("2026-02-01", 99999, "Food")] };
  const r = A.expenseReport(s, "2026-09");
  const food = r.categories.find((c) => c.category === "Food");
  assert.deepStrictEqual([food.avg6mo, food.vsAvgPct, r.avg6moSpend], [15000, 0, 15000], "May (4 back) and April (5 back) count; February (7 back) does not");
  const r2 = A.expenseReport({ income: [], expenses: [e("2026-09-01", 18000, "Food"), e("2026-08-01", 12000, "Food")] }, "2026-09");
  assert.strictEqual(r2.categories[0].vsAvgPct, 50, "₹18,000 against a ₹12,000 average is +50%");
  assert.strictEqual(A.expenseReport({ income: [], expenses: [e("2026-10-05", 1)] }, "2026-10").monthIsComplete, false, "the current month is still running");
  assert.strictEqual(A.expenseReport({ income: [], expenses: [e("2026-08-05", 7), e("2026-09-05", 9)] }).month, "2026-09", "no month given: the latest with spending");
  const many = { income: [], expenses: Array.from({ length: 14 }, (_, i) => e(`20${25 + Math.floor((i + 8) / 12)}-${String(((i + 8) % 12) + 1).padStart(2, "0")}-01`, 100)) };
  assert.strictEqual(A.expenseReport(many).trend.length, 12, "the trend is the last 12 months");
}
{
  // Emergency fund counts bank AND fixed deposits; take-home is both salaries; the equity share adds funds, shares and US shares
  const s = {
    income: [{ date: "2026-09-30", amount: 70000, netSalary: 70000, person: "Me", type: "Salary" }, { date: "2026-09-30", amount: 30000, person: "Wife", type: "Salary" }],
    expenses: ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"].map((m) => ({ date: m + "-10", amount: 10000, category: "Home" })),
    banksaving: [{ value: 30000 }], fd: [{ value: 30000 }], liabilities: [{ value: 1, emi: 31000 }],
    mutualFunds: [{ currentValue: 100, fundName: "Some Flexi Cap Fund" }], stocks: [{ currentValue: 200 }], usstocks: [{ currentValue: 1 }], fx: { usdInr: 100 },
    insurance: [{ type: "Term life", person: "Me", cover: 1 }], vehicles: [],
  };
  const flags = A.healthCheck(s, "2026-10-20").flags, f = (t) => flags.find((x) => x.topic === t);
  assert.strictEqual(f("Emergency fund").level, "good", "₹30,000 bank + ₹30,000 FD = 6 months");
  assert.strictEqual(f("Debt load").level, "watch", "₹31,000 EMIs on ₹1L of take-home (both salaries) is 31%");
  assert.ok(/equity is 0\.7% of assets; gold 0%; EPF\/PPF\/FD\/bonds 49\.7%/.test(f("Equity share").text), "₹100 funds + ₹200 shares + $1 × ₹100 = ₹400 of ₹60,400; FD ₹30,000 = 49.7%: " + f("Equity share").text);
  assert.strictEqual(f("Term cover (Me)").level, "act", "cover far below the guide: act");
  assert.strictEqual(f("Term cover (Wife)").level, "watch", "nothing entered: watch");
  assert.ok(f("Fund mix") && f("Fund mix").level === "watch", "one kind of fund over 40% of the fund money is flagged");
}
console.log("analysis oracle tests passed");
