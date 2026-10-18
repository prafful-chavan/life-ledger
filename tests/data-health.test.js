const assert = require("assert");
const H = require("../data-health.js");

const key = (c) => String(c).toLowerCase().replace(/\s*-\s*/g, "-").replace(/\s+/g, " ").trim();
const base = () => ({
  mutualFunds: [{ fundName: "A", owner: "Me", units: 100, latestNav: 50, navDate: "16-10-2026", transactionType: "PURCHASE" }, { fundName: "A", owner: "Me", units: 20, latestNav: 50, transactionType: "REDEMPTION" }],
  stocks: [{ symbol: "X", quantity: 10, currentPrice: 100, priceDate: "17 Oct 2026, 09:10 PM" }],
  usstocks: [], gold: [{ value: 10000 }], fd: [{ value: 20000 }], epf: [], ppf: [], bonds: [], silver: [], crypto: [], banksaving: [], others: [],
  liabilities: [{ name: "Car", value: 1000, rate: 8 }],
  expenses: [{ date: "2026-10-01", amount: 100, category: "Food", note: "a", paidBy: "Me" }],
  income: [{ person: "Me", date: "2026-08-01" }, { person: "Me", date: "2026-09-01" }],
  goals: [], netWorthHistory: [],
});
const run = (s, reported, extra = {}) => H.run({ state: s, now: "2026-10-17", reported, categoryKey: key, ...extra });
const get = (r, id) => r.checks.find((c) => c.id === id);
const assets = 80 * 50 + 10 * 100 + 10000 + 20000; // 35000

// healthy data: everything passes
let r = run(base(), { netWorth: assets - 1000, totalAssets: assets, advisorTotal: assets });
assert.strictEqual(r.counts.warn, 0, JSON.stringify(r.checks.filter((c) => c.status === "warn")));
assert.strictEqual(get(r, "networth").status, "ok");

// reported net worth that disagrees with the records
r = run(base(), { netWorth: assets - 1000 + 3249, totalAssets: assets + 3249, advisorTotal: assets });
assert.strictEqual(get(r, "networth").status, "warn");
assert.strictEqual(get(r, "advisor-total").status, "warn");

// holdings without a price / out-of-date prices
let s = base(); s.stocks.push({ symbol: "NOPRICE", quantity: 1, currentPrice: 0 }); s.stocks[0].priceDate = "01 Oct 2026, 09:10 PM";
r = run(s, { netWorth: 0, totalAssets: 0, advisorTotal: 0 });
assert.deepStrictEqual(get(r, "prices-missing").items, ["NOPRICE"]);
assert.strictEqual(get(r, "prices-old").status, "warn");

// history rows that do not add up
s = base(); s.netWorthHistory = [{ date: "2026-10-16", mutualFunds: 10, totalAssets: 99, liabilities: 0, netWorth: 99 }];
assert.deepStrictEqual(get(run(s, {}), "history").items, ["2026-10-16"]);

// expenses: bad rows, repeats, spelling variants
s = base(); s.expenses.push({ date: "", amount: 5 }, { date: "2026-10-02", amount: 0 }, { date: "2026-10-01", amount: 100, category: "Food", note: "a", paidBy: "Me" }, { category: "EMI - Car" }, { category: "EMI- Car" });
r = run(s, {});
assert.strictEqual(get(r, "expense-rows").status, "warn");
assert.strictEqual(get(r, "expense-dups").status, "info");
assert.deepStrictEqual(get(r, "categories").items, ["EMI - Car  ≈  EMI- Car"]);

// salary gap
s = base(); s.income.push({ person: "Me", date: "2026-10-01" }, { person: "Me", date: "2026-12-01" });
assert.ok(/2026-11/.test(get(run(s, {}), "income-gaps").items[0]));

// goals: stale hand-typed MF goal, placeholder amounts; a tracked goal is fine
s = base(); s.mutualFunds[0].units = 100000;
s.goals = [{ name: "Mutual Fund Portfolio", target: 1e7, saved: 2000000 }, { name: "Home", target: 2e7, saved: 2000000 }];
r = run(s, {});
assert.strictEqual(get(r, "goals").status, "warn");
assert.ok(get(r, "goals").items.some((x) => /Set .Progress comes from. to Mutual funds/.test(x)));
assert.ok(get(r, "goals").items.some((x) => /exactly the same saved amount/.test(x)));
s.goals = [{ name: "Mutual Fund Portfolio", target: 1e7, saved: 5, track: "Mutual funds" }];
assert.strictEqual(get(run(s, {}), "goals").status, "ok");

// a loan with no rate
s = base(); s.liabilities = [{ name: "Car", value: 40000, rate: 0 }];
assert.strictEqual(get(run(s, {}), "liabilities").status, "info");

// never throws on empty / bad input
assert.doesNotThrow(() => H.run({}));
assert.doesNotThrow(() => H.run(null));

// dismissing a note: hidden from the counts until what it says changes; problems cannot be dismissed
{
  const s = base(); s.liabilities = [{ name: "Car", value: 40000, rate: 0 }];
  const first = get(run(s, {}), "liabilities");
  assert.strictEqual(first.status, "info");
  const r1 = H.run({ state: s, now: "2026-10-17", reported: {}, categoryKey: key, dismissed: { liabilities: first.signature } });
  assert.strictEqual(get(r1, "liabilities").snoozed, true);
  assert.strictEqual(r1.counts.snoozed, 1);
  assert.strictEqual(r1.counts.info, run(s, {}).counts.info - 1, "one fewer note once dismissed");
  s.liabilities = [{ name: "Car", value: 40000, rate: 0 }, { name: "Bike", value: 9000, rate: 0 }];
  const r2 = H.run({ state: s, now: "2026-10-17", reported: {}, categoryKey: key, dismissed: { liabilities: first.signature } });
  assert.strictEqual(get(r2, "liabilities").snoozed, false, "the note changed, so it is back");
  const w = base(); w.stocks.push({ symbol: "NOPRICE", quantity: 1, currentPrice: 0 });
  const wr = H.run({ state: w, now: "2026-10-17", reported: {}, categoryKey: key });
  const prob = get(wr, "prices-missing");
  const wr2 = H.run({ state: w, now: "2026-10-17", reported: {}, categoryKey: key, dismissed: { "prices-missing": prob.signature } });
  assert.strictEqual(get(wr2, "prices-missing").snoozed, false, "a real problem is never snoozed");
}
console.log("data-health tests passed");
