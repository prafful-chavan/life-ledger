// The email's decision rules, each limit tested on both sides (added where the mutation test showed gaps).
const assert = require("assert");
const R = require("../mcp/brief-render.js");

const T = "2026-10-21";
const plus = (n) => new Date(Date.parse(T + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const titles = (pack) => R.todayActions({ calendar: [], sipThisMonth: null, ...pack }, T).map((a) => a.title);

// ── Goals: the shapes returned ──
assert.deepStrictEqual(R.goalNeed({ target: 0, saved: 0, dueDate: plus(30) }, T), { remaining: 0, months: 0, perMonth: 0, done: true }, "no target: nothing to do");
assert.deepStrictEqual(R.goalNeed({ target: 100, saved: 100, dueDate: plus(30) }, T), { remaining: 0, months: 0, perMonth: 0, done: true });
assert.deepStrictEqual(R.goalNeed({ target: 100, saved: 150, dueDate: plus(30) }, T), { remaining: 0, months: 0, perMonth: 0, done: true }, "saved more than the target");
assert.deepStrictEqual(R.goalNeed({ target: 120, saved: 0, dueDate: T }, T), { remaining: 120, months: 0, perMonth: 120, overdue: true }, "due today: the whole amount, now");
assert.deepStrictEqual(R.goalNeed({ target: 120, saved: 0, dueDate: plus(-5) }, T), { remaining: 120, months: 0, perMonth: 120, overdue: true });
assert.deepStrictEqual(R.goalNeed({ target: 120, saved: 0, dueDate: plus(1) }, T), { remaining: 120, months: 1, perMonth: 120 }, "due tomorrow: at least one month");
assert.deepStrictEqual(R.goalNeed({ target: 120, saved: 0, dueDate: plus(30) }, T), { remaining: 120, months: 1, perMonth: 120 }, "30 days is under one month (30.4375 days)");
assert.deepStrictEqual(R.goalNeed({ target: 120, saved: 0, dueDate: plus(32) }, T), { remaining: 120, months: 2, perMonth: 60 }, "just over a month rounds up to 2");

// ── Plain words and their order ──
const st = (o) => R.status(o);
assert.deepStrictEqual([st({ call: "Review" }).rank, st({ call: "Consider trimming" }).rank, st({ call: "Watch" }).rank, st({ call: "Hold — don't add now" }).rank, st({ call: "Hold", verdict: "Doing well" }).rank, st({ call: "Hold", verdict: "Okay" }).rank, st({ call: "Hold", verdict: "Not enough history" }).rank], [3, 3, 2, 2, 0, 1, 1], "how loudly each is shown");
assert.deepStrictEqual([st({ call: "Hold", verdict: "Not enough price history to judge" }).label, st({ call: "Hold", verdict: "Doing great" }).tone, st({ call: "Review" }).tone, st({ call: "Watch" }).tone], ["Too early to tell", "good", "bad", "warn"]);

// ── Today's list: each limit ──
const high = (days, extra = {}) => ({ severity: "high", title: "Deadline", why: "x", due: plus(days), ...extra });
assert.deepStrictEqual(titles({ taxPlan: { actions: [high(75)], people: [] } }), ["Deadline"], "75 days away is still close enough");
assert.deepStrictEqual(titles({ taxPlan: { actions: [high(76)], people: [] } }), [], "76 is not");
assert.deepStrictEqual(titles({ taxPlan: { actions: [{ ...high(10), severity: "medium" }], people: [] } }), [], "only high-priority deadlines");
assert.deepStrictEqual(titles({ taxPlan: { actions: [{ severity: "high", title: "No date", why: "x" }], people: [] } }), ["No date"], "a high item with no date still shows, after the dated ones");
assert.deepStrictEqual(titles({ taxPlan: { actions: [{ severity: "medium", title: "No date, medium", why: "x" }], people: [] } }), [], "…but a medium one without a date does not");
assert.deepStrictEqual(titles({ taxPlan: { actions: [high(30, { title: "B" }), high(10, { title: "A" }), high(30, { title: "C" })], people: [] } }), ["A", "B", "C"], "soonest first; equal dates keep their order");
const sip = (pct, me, wife, im = 0, iw = 0) => ({ taxPlan: { actions: [], people: [] }, sipThisMonth: { monthElapsedPct: pct, targetMe: me, targetWife: wife, investedMe: im, investedWife: iw } });
assert.deepStrictEqual(titles(sip(50, 100, 0)), ["Make this month's SIPs"], "exactly half the month is enough");
assert.deepStrictEqual(titles(sip(49, 100, 0)), []);
assert.deepStrictEqual(titles(sip(60, 0, 100)), ["Make this month's SIPs"], "a target for only Archana counts");
assert.deepStrictEqual(titles(sip(60, 0, 0)), [], "no targets at all: nothing to chase");
assert.deepStrictEqual(titles(sip(60, 100, 100, 0, 1)), [], "either of you investing anything stops the reminder");
assert.deepStrictEqual(titles(sip(60, 100, 100, 1, 0)), []);
const ren = (d) => ({ taxPlan: { actions: [], people: [] }, calendar: [{ kind: "renewal", what: "Policy renewal (Me)", date: plus(d), inDays: d, note: "₹1" }] });
assert.strictEqual(titles(ren(14)).length, 1, "a renewal in 14 days"); assert.strictEqual(titles(ren(15)).length, 0, "15 days is later");
const adv = (d) => ({ taxPlan: { actions: [], people: [{ name: "Prafful", advanceTaxNext: { date: plus(d), cumulative: 15000 } }] } });
assert.deepStrictEqual(titles(adv(21)), ["Advance tax for Prafful"], "advance tax within 21 days"); assert.deepStrictEqual(titles(adv(22)), []);
assert.ok(/Pay ₹15,000 in total by/.test(R.todayActions(adv(10), T)[0].why));

// ── Notices: each limit ──
const ok = { brief: { dataFreshness: { mutualFundsHoursOld: 0, stocksHoursOld: 0, usStocksHoursOld: 0 }, integrity: { alerts: [] } }, lawWatch: { stale: false, changes: [] }, holdingsCheck: { checkedOn: T, status: "ok", gaps: [] } };
const fresh = (h) => ({ ...ok, brief: { ...ok.brief, dataFreshness: { mutualFundsHoursOld: h, stocksHoursOld: 0, usStocksHoursOld: 0 } } });
assert.strictEqual(R.notices(fresh(30), T).length, 0, "30 hours is fine"); assert.strictEqual(R.notices(fresh(31), T).length, 1, "31 is not");
assert.strictEqual(R.notices({ ...ok, brief: { ...ok.brief, integrity: { alerts: [{ level: "watch", text: "A watch note" }, { level: "info", text: "Just info" }] } } }, T).map((n) => n.text).join("|"), "A watch note", "only 'watch' alerts get a line");
const laws = [1, 2, 3].map((i) => ({ headline: "H" + i, effect: "" }));
assert.strictEqual(R.notices({ ...ok, lawWatch: { stale: false, changes: laws } }, T).length, 2, "at most two law updates");
assert.strictEqual(R.notices({ ...ok, holdingsCheck: { checkedOn: plus(-10), status: "ok", gaps: [] } }, T).length, 0, "a 10-day-old holdings check is still fine");
assert.strictEqual(R.notices({ ...ok, holdingsCheck: { checkedOn: plus(-11), status: "ok", gaps: [] } }, T).length, 1, "11 days is overdue");
assert.ok(/last ran on 1 Sep/.test(R.notices({ ...ok, lawWatch: { stale: true, checkedOn: "2026-09-01", changes: [] } }, T)[0].text), "a law check that has fallen behind");
const gaps = [1, 2, 3].map((i) => ({ name: "H" + i, who: "Me", confirmed: true }));
assert.ok(/H1 \(Prafful\), H2 \(Prafful\)\./.test(R.notices({ ...ok, holdingsCheck: { checkedOn: T, status: "gaps", gaps } }, T)[0].text) && !/H3/.test(R.notices({ ...ok, holdingsCheck: { checkedOn: T, status: "gaps", gaps } }, T)[0].text), "at most two holdings named");
console.log("brief edge tests passed");
