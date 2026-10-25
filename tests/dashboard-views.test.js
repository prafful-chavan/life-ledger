// The dashboards' markup: every tab draws for ordinary, thin and hostile data; text from the data is escaped; the buttons carry
// what the page needs; nothing prints NaN or undefined.
const assert = require("assert");
const { noOverlap } = require("./helpers/chart-overlap.js");
const SI = require("../salary-insights-core.js");
const SP = require("../spending-insights-core.js");
const Sal = require("../salary-core.js");
const V = require("../dashboard-views.js");

const num = (v) => { const n = Number(String(v == null ? "" : v).replace(/[^0-9.-]/g, "")); return Number.isFinite(n) ? n : 0; };
const fmt = { inr: (n) => "₹" + Math.round(n).toLocaleString("en-IN"), pct: (n, d) => `${Number(n).toFixed(d === undefined ? 0 : d)}%`, month: (ym) => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(ym.slice(5, 7)) - 1] + " " + ym.slice(0, 4) };
const names = { Me: "Prafful", Wife: "Archana" };
const EVIL = `<img src=x onerror=alert(1)>`;

const slip = (ym, net, o) => ({ type: "Salary", person: "Me", source: "Acme", date: ym + "-28", netSalary: net, amount: net, grossEarnings: Math.round(net * 1.3), taxTds: Math.round(net * 0.2), pf: 5000, ...o });
const income = [];
for (let i = 0; i < 40; i++) {
  const ym = SI.shiftYm("2023-06", i);
  income.push(slip(ym, i < 20 ? 100000 : 150000, { source: i < 20 ? "Acme" : EVIL }));
  if (i >= 20) income.push(slip(ym, 50000, { person: "Wife", source: "Zed & Co" }));
}
income.push(slip("2025-08", 400000, { source: EVIL })); // a bonus month
const model = SI.analyze(income, num, Sal.isSalary, { inflationPct: 5 });

const clean = (html, msg) => { assert.ok(!/NaN|undefined|\[object|Infinity/.test(html), (msg || "") + " " + (html.match(/.{30}(NaN|undefined|\[object|Infinity).{30}/) || [""])[0]); };
const noRawEvil = (html) => assert.ok(!html.includes(EVIL) && !/<img src=x/.test(html), "hostile text is escaped");

// ── salary: every tab ──
for (const [tab] of V.SALARY_TABS) {
  const html = V.salary(model, { tab, person: "Me" }, { fmt, names });
  clean(html, tab); noRawEvil(html);
  assert.ok(html.includes(`data-act="salary-tab" data-id="${tab}"`), "tab buttons");
  assert.ok(html.includes('aria-selected="true"'), "one tab is selected");
}
let html = V.salary(model, { tab: "timeline", person: "Me" }, { fmt, names });
assert.ok(html.includes("Prafful") && html.includes("Archana"), "people are called by name"); assert.ok(html.includes('data-act="person" data-id="Wife"'));
assert.ok(html.includes('data-act="range" data-id="5y"') && html.includes('data-act="range" data-id="all"'), "range buttons");
assert.ok(html.includes("Steady monthly pay") && html.includes("Since first payslip") && html.includes("Growth a year") && html.includes("Take-home share") && html.includes("Next milestone"), "the five headline figures");
assert.ok(html.includes("dv-delta") && html.includes("dc-spark"), "a change chip and a trend line on the headline");
assert.ok(html.includes('class="dc-chart"') && html.includes("<svg"), "the chart is there");
assert.ok(html.includes('data-act="real"') && html.includes("Today's rupees") && !html.includes("Today&#39;s rupees"), "plain text, not escaped twice");
assert.ok(!html.includes('class="dc-real"'), "no today's-rupees line until asked");
assert.ok(V.salary(model, { tab: "timeline", person: "Me", showReal: true }, { fmt, names }).includes('class="dc-real"'));
// the selected month and its buttons
let d = V.salary(model, { tab: "timeline", person: "Me", ym: "2025-08" }, { fmt, names });
assert.ok(d.includes("Aug 2025") && d.includes("One-off") && d.includes("This is a regular month"), "an automatic one-off can be turned back into a regular month");
assert.ok(d.includes('data-act="mark" data-person="Me" data-ym="2025-08" data-mark="regular"')); assert.ok(!d.includes('data-mark="auto"'), "no 'back to automatic' when nothing was marked");
d = V.salary(model, { tab: "timeline", person: "Me", ym: "2024-01" }, { fmt, names });
assert.ok(d.includes("Treat as a one-off") && d.includes('data-mark="oneoff"') && !d.includes("This is a regular month"));
const marked = SI.analyze(income, num, Sal.isSalary, { marks: { Me: { "2024-01": "oneoff", "2025-08": "regular" } }, inflationPct: 5 });
d = V.salary(marked, { tab: "timeline", person: "Me", ym: "2024-01" }, { fmt, names }); assert.ok(d.includes("You marked this as a one-off") && d.includes('data-mark="auto"') && !d.includes("This is a regular month"), "a month the household marked offers the automatic rule");
d = V.salary(marked, { tab: "timeline", person: "Me", ym: "2025-08" }, { fmt, names }); assert.ok(d.includes("You marked this as a regular month") && d.includes('data-mark="oneoff"') && d.includes('data-mark="auto"'));
d = V.salary(model, { tab: "timeline", person: "Me", ym: "1999-01" }, { fmt, names }); assert.ok(d.includes("Sep 2026") || d.includes(fmt.month(model.views.Me.last.ym)), "an unknown month falls back to the latest");
// hikes
html = V.salary(model, { tab: "hikes", person: "Me" }, { fmt, names });
assert.ok(html.includes("Pay ladder") && html.includes("Raises inside a job") && html.includes("Year by year")); assert.ok(html.includes("+"), "a hike has a sign"); assert.ok(html.includes("2025-26") || html.includes("2024-25"));
assert.ok(html.includes("dc-badge-text") && html.includes("dc-b-total"), "the ladder shows the step between jobs"); assert.ok(html.includes("dc-bar"), "a bar for the year's pay");
assert.ok(V.salary(model, { tab: "hikes", person: "Wife" }, { fmt, names }).includes("Only one job so far."), "a single job has no change");
// take-home
html = V.salary(model, { tab: "takehome", person: "Me" }, { fmt, names }); assert.ok(html.includes("Where the gross pay goes") && html.includes("dc-b-net") && html.includes("In your account") && html.includes("Income tax (TDS)"), "a bridge from gross to net");
const nogross = SI.analyze(income.map((r) => ({ ...r, grossEarnings: 0 })), num, Sal.isSalary, {});
html = V.salary(nogross, { tab: "takehome", person: "Me" }, { fmt, names }); clean(html); assert.ok(html.includes("no gross figure"), "no gross: says so rather than inventing a split"); assert.ok(html.includes("—"));
// household
html = V.salary(model, { tab: "household" }, { fmt, names }); assert.ok(html.includes("Household steady pay") && html.includes("Pay split") && html.includes("Archana"), "household headline and the split"); assert.ok(html.includes('data-act="inflation"') && html.includes('value="5"'));
assert.ok(!html.includes('data-act="person"'), "no person switch on the household tab"); assert.ok(html.includes("dc-p0") && html.includes("dc-p1"));
html = V.salary(SI.analyze(income.filter((r) => r.person === "Me"), num, Sal.isSalary, {}), { tab: "household" }, { fmt, names }); clean(html);
// thin data
const one = SI.analyze([slip("2026-09", 100000)], num, Sal.isSalary, {});
for (const [tab] of V.SALARY_TABS) clean(V.salary(one, { tab }, { fmt, names }), "one payslip, " + tab);
assert.ok(V.salary(one, { tab: "timeline" }, { fmt, names }).includes("—"), "a single payslip has no yearly rate");
assert.ok(V.salary(SI.analyze([], num, Sal.isSalary, {}), { tab: "timeline" }, { fmt, names }).includes("Upload your salary workbook"), "no salary: an empty state");
assert.ok(V.salary(model, { tab: "nonsense", person: "Nobody" }, { fmt, names }).includes('aria-selected="true"'), "unknown tab and person fall back");
// gaps are named
const gapped = SI.analyze(income.filter((r) => r.date.slice(0, 7) !== "2024-02"), num, Sal.isSalary, {}); assert.ok(V.salary(gapped, { tab: "timeline", person: "Me" }, { fmt, names }).includes("No payslip for Feb 2024"));
// one-off list
assert.ok(V.salary(model, { tab: "timeline", person: "Me" }, { fmt, names }).includes('data-act="pick" data-ym="2025-08"'));

// ── spending ──
const exp = [];
for (let i = 0; i < 24; i++) {
  const ym = SP.shiftYm("2024-10", i);
  exp.push({ id: "a" + i, date: ym + "-05", amount: 30000, category: "EMI- Car", paidBy: "Me", note: "" });
  exp.push({ id: "b" + i, date: ym + "-09", amount: 8000 + (i % 5) * 500, category: "Groceries", paidBy: "Wife", note: `<b>${EVIL}</b>` });
  exp.push({ id: "c" + i, date: ym + "-12", amount: 6000, category: EVIL, paidBy: "Me", note: "" });
}
exp.push({ id: "big", date: "2026-03-10", amount: 90000, category: "Household items", paidBy: "Me", note: EVIL });
const inc = {}; model.household.rows.forEach((r) => { inc[r.ym] = r.net; });
const sp = SP.analyze(exp, { num, catOf: (e) => e.category || "General", incomeByMonth: inc, today: "2026-09-25", budgets: { Groceries: 9000, [EVIL]: 5000 }, fixed: {} });
for (const [tab] of V.SPEND_TABS) {
  const html2 = V.spending(sp, { tab }, { fmt, names, day: 25 }); clean(html2, tab); noRawEvil(html2);
  assert.ok(html2.includes(`data-act="spend-tab" data-id="${tab}"`));
}
html = V.spending(sp, { tab: "savings" }, { fmt, names, day: 25 }); assert.ok(html.includes("left over") && html.includes("dc-rate") && html.includes("salary credited the month before")); assert.ok(html.includes("A usual month") && html.includes("Kept after spending") && html.includes("Fixed bills") && html.includes("Biggest riser"), "the five headline figures"); assert.ok(html.includes("dc-fixed") && html.includes("dc-level"), "spend columns with the pay line");
html = V.spending(sp, { tab: "categories" }, { fmt, names, day: 25 }); assert.ok(html.includes('data-act="fixed" data-cat="EMI- Car" data-fixed="no"') , "a fixed category offers to become flexible"); assert.ok(html.includes('data-act="fixed" data-cat="Groceries" data-fixed="yes"'));
assert.ok(html.includes("dc-fixed") && html.includes("dc-flex") && html.includes("dc-heat-cell"), "the heat grid");
html = V.spending(sp, { tab: "budgets" }, { fmt, names, day: 25 }); assert.ok(html.includes('data-act="budget-clear" data-cat="Groceries"') && html.includes('data-act="budget"') && html.includes("Set a budget")); assert.ok(html.includes("so far"));
assert.ok(html.includes('data-act="budget-use"') && /data-amount="\d+"/.test(html), "a suggestion button with a number");
html = V.spending(sp, { tab: "unusual" }, { fmt, names, day: 25 }); assert.ok(html.includes("Anatomy of the latest unusual month") && html.includes("Unusual months") && html.includes("Big one-off payments") && html.includes("Who paid") && html.includes("Archana") && html.includes("Prafful")); assert.ok(html.includes("who paid, not who the money was for"));
assert.ok(html.includes("Mar 2026"), "the big purchase month appears");
// empty and thin
assert.ok(V.spending(SP.analyze([], { num, catOf: (e) => e.category, incomeByMonth: {}, today: "2026-09-25" }), { tab: "savings" }, { fmt }).includes("Add or import expenses"));
assert.ok(V.spending(null, { tab: "savings" }, { fmt }).includes("Add or import expenses"));
const thin = SP.analyze([{ id: "x", date: "2026-09-02", amount: 500, category: "Food", paidBy: "Me" }], { num, catOf: (e) => e.category, incomeByMonth: {}, today: "2026-09-25" });
for (const [tab] of V.SPEND_TABS) clean(V.spending(thin, { tab }, { fmt, names, day: 25 }), "thin " + tab);
assert.ok(V.spending(thin, { tab: "savings" }, { fmt, names }).includes("cannot be worked out"), "no pay on record: says so");
assert.ok(V.spending(thin, { tab: "budgets" }, { fmt, names }).includes("No budgets yet"));
// the untracked months are explained
const old = SP.analyze([{ id: "o", date: "2019-06-02", amount: 10000, category: "Food", paidBy: "Me" }, ...exp], { num, catOf: (e) => e.category, incomeByMonth: inc, today: "2026-09-25" });
assert.ok(V.spending(old, { tab: "savings" }, { fmt, names }).includes("Spending is tracked from"), "the start of tracking is stated"); assert.ok(V.spending(old, { tab: "savings" }, { fmt, names }).includes("Jun 2019"));
assert.ok(!V.spending(sp, { tab: "savings" }, { fmt, names }).includes("Spending is tracked from") || sp.tracked.notTracked.length > 0);

// ── no two labels overlap in any chart of any tab ──
{
  const Ch = require("../dashboard-charts.js");
  const everything = [];
  for (const [tab] of V.SALARY_TABS) for (const person of ["Me", "Wife"]) for (const range of ["all", "3y", "1y"]) everything.push(V.salary(model, { tab, person, range, showReal: range === "3y" }, { fmt, names }));
  for (const [tab] of V.SPEND_TABS) everything.push(V.spending(sp, { tab }, { fmt, names, day: 25 }));
  let svgs = 0;
  for (const html of everything) for (const m of html.matchAll(/<svg class="dc-svg"[\s\S]*?<\/svg>/g)) { noOverlap(m[0], "view chart"); svgs++; }
  assert.ok(svgs >= 20, "charts were checked: " + svgs);
}
console.log("dashboard-views: all checks passed");
