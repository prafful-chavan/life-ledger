// Day meter: every number comes from the goal plan; states and edges.
const assert = require("assert");
const M = require("../day-meter-core.js");
const G = require("../goals-plan-core.js");

const TODAY = "2026-11-14";
const goals = [
  { id: "a", name: "Home", target: 3000000, saved: 0, dueDate: "2028-05-26" },
  { id: "b", name: "Watch", target: 800000, saved: 0, dueDate: "2027-06-01" },
  { id: "c", name: "Done one", target: 100, saved: 100, dueDate: "2027-01-01" },
  { id: "d", name: "No date", target: 5000, saved: 0 },
  { id: "e", name: "Weight", kind: "measure", target: 70, unit: "kg" },
];
const plan = (take, spend) => G.plan(goals, TODAY, { takeHomeMonthly: take, spendMonthly: spend });

// built from the real plan
{
  const p = plan(260000, 90000), m = M.meter(p);
  assert.strictEqual(m.need, p.earn.needPerDay); assert.strictEqual(m.have, p.earn.havePerDay);
  assert.strictEqual(m.gap, Math.max(0, p.earn.needPerDay - p.earn.havePerDay)); assert.strictEqual(m.ahead, 0);
  assert.strictEqual(m.pct, Math.round((p.earn.havePerDay / p.earn.needPerDay) * 100));
  assert.strictEqual(m.livingPerDay, p.earn.spendPerDay); assert.strictEqual(m.goalsPerDay, p.savePerDay);
  assert.strictEqual(m.perMonth.need, p.earn.needPerMonth); assert.strictEqual(m.perMonth.have, p.earn.havePerMonth);
  assert.strictEqual(m.perMonth.gap, p.earn.needPerMonth - p.earn.havePerMonth);
  assert.strictEqual(m.openGoals, 2, "the finished goal, the undated one and the measured one are not counted");
  assert.strictEqual(m.next.name, "Watch", "the goal due first"); assert.strictEqual(m.next.days, G.daysLeft("2027-06-01", TODAY));
  assert.strictEqual(m.next.perDay, p.items.find((x) => x.id === "b").perDay);
}
// states at their edges: 70 and 100
const withHave = (need, have) => M.meter({ items: [], savePerDay: 0, earn: { needPerDay: need, havePerDay: have, spendPerDay: 0, needPerMonth: need * 30, havePerMonth: have * 30 } });
assert.strictEqual(withHave(100, 100).state, "covered"); assert.strictEqual(withHave(100, 99).state, "close");
assert.strictEqual(withHave(100, 70).state, "close"); assert.strictEqual(withHave(100, 69).state, "short");
assert.strictEqual(withHave(100, 0).state, "short"); assert.strictEqual(withHave(100, 0).fill, 0);
assert.deepStrictEqual([withHave(100, 150).pct, withHave(100, 150).fill, withHave(100, 150).ahead, withHave(100, 150).gap], [150, 100, 50, 0], "a surplus fills the bar and is not more than full");
assert.deepStrictEqual([withHave(100, 40).fill, withHave(100, 40).gap, withHave(100, 40).ahead], [40, 60, 0]);
assert.strictEqual(withHave(100, 100).gap, 0); assert.strictEqual(withHave(100, 100).ahead, 0);
assert.strictEqual(withHave(100, 99.6).pct, 100, "the percentage is rounded");
assert.strictEqual(withHave(3, 1).pct, 33);
// nothing to show without the household's numbers
assert.strictEqual(M.meter(null), null); assert.strictEqual(M.meter({}), null); assert.strictEqual(M.meter({ earn: null }), null);
assert.strictEqual(M.meter(plan(0, 90000)), null, "no payslips");
assert.strictEqual(M.meter(plan(260000, 0)), null, "no spending history");
assert.strictEqual(M.meter({ earn: { needPerDay: 0, havePerDay: 5 } }), null, "nothing is needed");
// next goal: overdue counts as first; none when no dated money goal is open
{
  const o = M.meter(G.plan([{ id: "x", name: "Late", target: 1000, saved: 0, dueDate: "2026-01-01" }, { id: "y", name: "Soon", target: 1000, saved: 0, dueDate: "2026-12-01" }], TODAY, { takeHomeMonthly: 100000, spendMonthly: 50000 }));
  assert.strictEqual(o.next.name, "Late"); assert.strictEqual(o.next.overdue, true);
  const none = M.meter(G.plan([{ id: "x", name: "A", kind: "measure", target: 1 }], TODAY, { takeHomeMonthly: 100000, spendMonthly: 50000 }));
  assert.strictEqual(none.next, null); assert.strictEqual(none.openGoals, 0);
  // two goals due the same day: the one asking more per day is shown
  const tie = M.meter(G.plan([{ id: "x", name: "Small", target: 1000, saved: 0, dueDate: "2027-01-01" }, { id: "y", name: "Big", target: 900000, saved: 0, dueDate: "2027-01-01" }], TODAY, { takeHomeMonthly: 100000, spendMonthly: 50000 }));
  assert.strictEqual(tie.next.name, "Big");
}
// the markup
const fmt = { inr: (n) => "₹" + Math.round(n).toLocaleString("en-IN") };
const text = (h) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
{
  const m = M.meter(plan(260000, 90000)), h = M.html(m, { fmt, dateText: (s) => "D:" + s });
  const t = text(h);
  assert.ok(t.includes("You need " + fmt.inr(m.need) + " a day. You take home " + fmt.inr(m.have)) && /a day is missing/.test(t));
  assert.ok(/Short · \d+%|Close · \d+%/.test(t) && h.includes(`style="width:${m.fill}%"`) && /dm-(short|close)/.test(h));
  assert.ok(t.includes("Next goal due Watch") && t.includes("D:2027-06-01") && /2 goals/.test(t) && /Per month: need/.test(t));
  const rich = text(M.html(withHave(100, 130), { fmt }));
  assert.ok(/Covered · 130%/.test(rich) && /a day to spare/.test(rich) && /To spare/.test(rich) && !/missing/.test(rich));
  assert.strictEqual(M.html(null, { fmt }), "");
  // one goal, one day: singular words
  const one = text(M.html(M.meter(G.plan([{ id: "x", name: "Only", target: 1000, saved: 0, dueDate: "2026-11-15" }], TODAY, { takeHomeMonthly: 100000, spendMonthly: 50000 })), { fmt, dateText: (s) => s }));
  assert.ok(/1 goal\./.test(one) && /· 1 day ·/.test(one));
  const late = text(M.html(M.meter(G.plan([{ id: "x", name: "Late", target: 1000, saved: 0, dueDate: "2026-01-01" }], TODAY, { takeHomeMonthly: 100000, spendMonthly: 50000 })), { fmt }));
  assert.ok(/overdue · /.test(late));
  // text from the data is escaped
  const ev = M.html(M.meter(G.plan([{ id: "x", name: "<img src=x onerror=alert(1)>", target: 1000, saved: 0, dueDate: "2027-01-01" }], TODAY, { takeHomeMonthly: 100000, spendMonthly: 50000 })), { fmt });
  assert.ok(!/<img/.test(ev) && /&lt;img/.test(ev));
}
assert.deepStrictEqual([M.COVERED_AT, M.CLOSE_AT], [100, 70]);
// blind spots closed after the mutation run
{
  const mk = (list) => M.meter(G.plan(list, TODAY, { takeHomeMonthly: 100000, spendMonthly: 50000 })).next.name;
  assert.strictEqual(mk([{ id: "y", name: "Big", target: 900000, saved: 0, dueDate: "2027-01-01" }, { id: "x", name: "Small", target: 1000, saved: 0, dueDate: "2027-01-01" }]), "Big", "same day, bigger ask first, whatever the input order");
  assert.strictEqual(mk([{ id: "x", name: "Small", target: 1000, saved: 0, dueDate: "2027-01-01" }, { id: "y", name: "Big", target: 900000, saved: 0, dueDate: "2027-01-01" }, { id: "z", name: "Mid", target: 50000, saved: 0, dueDate: "2027-01-01" }]), "Big");
  assert.strictEqual(withHave(100, 130).perMonth.gap, 0, "a surplus has no monthly gap");
  const third = (h) => /<span>(?:To spare|Missing)<\/span><b>([^<]+)<\/b>/.exec(h)[1];
  assert.strictEqual(third(M.html(withHave(100, 130), { fmt })), "₹30"); assert.strictEqual(third(M.html(withHave(100, 40), { fmt })), "₹60");
  assert.strictEqual(M.meter({ earn: { needPerDay: 1, havePerDay: 1, needPerMonth: 30, havePerMonth: 30 } }).need, 1, "a need of ₹1 a day is still a need");
  assert.ok(/₹100/.test(text(M.html(withHave(100, 100), {}))), "the markup works without a formatter");
}
// the goal that drives the need
{
  const p = G.plan([{ id: "big", name: "Portfolio", kind: "networth", target: 200000000, saved: 0, dueDate: "2030-12-31" }, { id: "s", name: "Watch", target: 800000, saved: 0, dueDate: "2027-06-01" }], TODAY, { takeHomeMonthly: 260000, spendMonthly: 90000 });
  const m = M.meter(p, { growthPct: 0 }), big = p.items.find((x) => x.id === "big");
  assert.strictEqual(m.driver.name, "Portfolio"); assert.strictEqual(m.driver.perDay, big.perDay);
  assert.strictEqual(m.driver.needWithout, m.need - big.perDay); assert.strictEqual(m.driver.pctWithout, Math.round((m.have / (m.need - big.perDay)) * 100));
  assert.strictEqual(m.driver.share, Math.round((big.perDay / m.need) * 100)); assert.strictEqual(m.driver.noGrowth, true);
  assert.strictEqual(M.meter(p, { growthPct: 8 }).driver.noGrowth, false, "with a growth rate set the note goes");
  assert.strictEqual(M.meter(p).driver.noGrowth, true, "no option means no growth");
  const t = text(M.html(m, { fmt }));
  assert.ok(/Portfolio asks for/.test(t) && /Without it the need is/.test(t) && /set a yearly growth in Goals/.test(t));
  assert.ok(!/set a yearly growth/.test(text(M.html(M.meter(p, { growthPct: 8 }), { fmt }))));
  // a goal that is not a net-worth goal has no growth note
  const q = G.plan([{ id: "h", name: "Home", target: 30000000, saved: 0, dueDate: "2028-05-26" }, { id: "s", name: "Watch", target: 100000, saved: 0, dueDate: "2027-06-01" }], TODAY, { takeHomeMonthly: 260000, spendMonthly: 90000 });
  assert.strictEqual(M.meter(q).driver.noGrowth, false); assert.ok(!/set a yearly growth/.test(text(M.html(M.meter(q), { fmt }))));
  // no driver when no single goal is a quarter of the need, or when it is the whole need
  const even = G.plan([1, 2, 3, 4, 5].map((i) => ({ id: "g" + i, name: "G" + i, target: 100000, saved: 0, dueDate: "2027-06-01" })), TODAY, { takeHomeMonthly: 100000, spendMonthly: 50000 });
  assert.strictEqual(M.meter(even).driver, null);
  const edge = (share) => M.meter({ items: [{ id: "a", name: "A", kind: "save", perDay: share, days: 10, dueDate: "2027-01-01" }], savePerDay: share, earn: { needPerDay: 100, havePerDay: 10, spendPerDay: 0, needPerMonth: 3000, havePerMonth: 300 } }).driver;
  assert.strictEqual(edge(24), null); assert.strictEqual(edge(25).share, 25); assert.strictEqual(edge(25).needWithout, 75);
  assert.strictEqual(edge(100), null, "a goal that is the whole need leaves nothing to compare");
  assert.strictEqual(edge(99).needWithout, 1, "a ₹1 need left without it is still shown");
  assert.strictEqual(M.meter(p, { growthPct: 0.5 }).driver.noGrowth, false, "any growth above zero counts");
  assert.strictEqual(M.meter(p, { growthPct: 1 }).driver.noGrowth, false);
  assert.strictEqual(M.DRIVER_SHARE, 0.25);
}
console.log("day-meter-core: ok");
