// The morning email: built from the data, never typed by a model. Made-up household throughout (no real data).
const assert = require("assert");
const fs = require("fs"), os = require("os"), path = require("path");
const S = require("../mcp/server.js");
const R = require("../mcp/brief-render.js");
const V = require("../mcp/vault-client.js");

const sal = (person, date, g, net) => ({ id: person + date, person, date, type: "Salary", grossEarnings: g, basicSalary: g * 0.4, hra: g * 0.2, pf: g * 0.12, taxTds: 0, amount: net });
const exp = (date, amount, category, note) => ({ id: date + category + amount, date, amount, category, note: note || "", paidBy: "Me" });
const mfRow = (owner, fundName, id, date, units, invested, nav) => ({ id, owner, fundName, transactionType: "PURCHASE", purchaseDate: date, date, units, invested, nav: invested / units, latestNav: nav, navDate: "2026-10-20", schemeCode: "1" });
const stateOf = () => ({
  fx: { usdInr: 90 },
  income: ["2026-04-30", "2026-05-31", "2026-06-30", "2026-07-31", "2026-08-31", "2026-09-30"].flatMap((d) => [sal("Me", d, 250000, 200000), sal("Wife", d, 60000, 55000)]),
  expenses: ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"].map((m) => exp(m + "-10", 50000, "Home")).concat([exp("2026-10-03", 40000, "Rent", "Flat rent"), exp("2026-10-05", 90000, "Loan", "Car loan prepayment")]),
  mutualFunds: [mfRow("Me", "Alpha Flexi Cap Direct Growth", "m1", "2025-01-01", 100, 10000, 130), mfRow("Wife", "Beta Midcap Direct Growth", "m2", "2025-02-01", 200, 20000, 90)],
  stocks: [{ id: "s1", owner: "Me", symbol: "ACME", company: "Acme Ltd", quantity: 10, invested: 10000, currentPrice: 1200, priceDate: "2026-10-20", purchaseDate: "2026-10-01" }],
  usstocks: [{ id: "u1", owner: "Me", symbol: "AAPL", company: "AAPL", quantity: 2, invested: 300, currentPrice: 200, priceDate: "2026-10-20", purchaseDate: "2025-01-01" }],
  gold: [{ id: "g1", owner: "Me", name: "Chain", carat: "22K", weightGrams: 10, value: 100000 }], goldPrice: { price22k: 9000, price24k: 9800 },
  banksaving: [{ value: 300000 }], fd: [{ value: 1000000 }], epf: [], ppf: [], bonds: [], silver: [], crypto: [], others: [], vehicles: [{ value: 400000 }], liabilities: [{ name: "Car", value: 50000, emi: 0 }],
  goals: [{ id: "gl1", name: "Emergency fund", target: 200000, saved: 150000, dueDate: "2027-03-31", owner: "Both" }, { id: "gl2", name: "Home", target: 20000000, saved: 2000000, dueDate: "2028-05-26", owner: "Both" }],
  insurance: [{ person: "Both", type: "Health", employer: "Yes", cover: 1200000, premium: 0, frequency: "Yearly" }], people: { me: { dob: "1990-03-14" }, wife: { dob: "1992-04-01" } },
  taxProfile: { sideBusinessStart: "2027-01-01" }, taxReturns: [], taxFamily: [], mfMonthlyTarget: { me: 50000, wife: 50000 },
  netWorthHistory: [{ date: "2026-10-18", netWorth: 1735000 }, { date: "2026-10-19", netWorth: 1738000 }],
  activities: [{ date: "2026-10-18", type: "cycling", durationMin: 60, distanceKm: 20 }, { date: "2026-10-12", type: "steps", steps: 9000 }], workouts: [], bodyMetrics: [{ date: "2026-10-19", weight: 80, bodyFat: 22 }],
  habits: [{ name: "SECRET HABIT NAME", streak: 4, bestStreak: 9 }], fitnessGoals: { dailySteps: 10000, weeklyCyclingKm: 50 },
  holdingsCheck: { checkedOn: "2026-10-19", source: "INDmoney", status: "ok", total: 5, matched: 5, ignored: 0, gaps: [] },
});
const ctxFactory = () => ({ history: async () => ({ series: {}, failedKeys: [] }), taxProfile: {} });
const call = async (name, args, state) => JSON.parse((await S.handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args || {} } }, async () => state || stateOf(), ctxFactory)).result.content[0].text);
const strip = (h) => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ");

(async () => {
  const pack = await call("daily_pack");
  const out = await call("render_brief", { notes: { coach: "A calm day.", idea: { title: "An idea", text: "A short idea." }, win: "A real win." } });
  const html = out.html, text = out.text, said = strip(html);

  // ── What the tool returns ──
  assert.strictEqual(out.kind, "brief");
  assert.ok(/^Life Ledger — \w{3} \d{1,2} \w{3}: ₹[\d,]+ \((flat today|up ₹[\d.,]+( \w+)? today|down ₹[\d.,]+( \w+)? today)\)$/.test(out.subject), out.subject);
  assert.ok(html.length < 60000, "the email stays a sensible size: " + html.length);
  assert.ok(pack.selfCheck && pack.selfCheck.taxCases.total >= 29 && pack.selfCheck.taxCases.passed === pack.selfCheck.taxCases.total, "the pack carries the tax-engine self-check");
  assert.deepStrictEqual(pack.dataSource, { fromCache: false }, "a normal run says the data is live");

  // ── Every key figure is the data's own ──
  const money = (v) => "₹" + Math.round(Math.abs(v)).toLocaleString("en-IN");
  const nw = pack.brief.netWorth;
  for (const f of [money(nw.netWorth), money(nw.assets), money(nw.liabilities), money(pack.brief.mutualFunds.totalValue), money(pack.brief.stocks.totalValue), money(pack.brief.usStocks.totalValue)]) assert.ok(said.includes(f), `the email shows ${f}`);
  const exps = pack.brief.expenses;
  assert.ok(said.includes(money(exps.spent)) && said.includes(money(exps.leftFromSalary)) && said.includes(`${Math.round(exps.savingsRatePct)}%`), "this month's spending, what is left, and the rate");
  const sep = exps.trend.find((t) => t.month === "2026-09");
  assert.ok(said.includes(money(sep.spent)) && said.includes(money(sep.salary)) && said.includes(`${sep.savedPct.toFixed(1)}%`), "the last complete month: spent, salary, saved %");
  const me = pack.taxPlan.people[0];
  assert.ok(said.includes(money(me.taxNewRegime)), "income tax for the year");
  assert.ok(said.includes(money(pack.taxPlan.savings.couldSaveThisYear)) && said.includes(money(pack.taxPlan.savings.couldSaveEveryYear)), "the savings Tax page figure");
  assert.ok(text.includes(money(nw.netWorth)) && text.includes(money(pack.brief.mutualFunds.totalValue)), "the plain-text version carries them too");

  // ── Plain words, no jargon ──
  assert.ok(!/\bRSI\b|XIRR|\bpp\b|SMA\b|200-day|sma200|oversold|drawdown/i.test(said + text), "no technical terms in the email");
  assert.ok(/points (better|worse) than the (Nifty 50|S&P 500)/.test(said + text) || !/vs the/.test(said), "comparisons are in plain 'points better than the Nifty 50' words");

  // ── Email-safe HTML ──
  assert.ok(!/<style|<script|\sclass=|<link|<img|javascript:/i.test(html), "inline styles only; nothing Gmail would strip or block");
  assert.ok(/max-width:600px/.test(html) && /role="presentation"/.test(html), "600px wide, table layout");
  assert.ok(html.startsWith("<!doctype html>"), "a full document");

  // ── Private things stay out ──
  assert.ok(!/SECRET HABIT NAME|1990-03-14|1992-04-01/.test(html + text + JSON.stringify(out)), "no habit names or birth dates");

  // ── Layout contents ──
  for (const section of ["Do this today", "Your investments", "Money this month", "Income tax", "Safety net &amp; goals", "Body &amp; habits", "Milestone", "What I need from you", "One idea"]) assert.ok(html.includes(section), "section: " + section);
  assert.ok(/A calm day\./.test(said) && /A short idea\./.test(said) && /A real win\./.test(said), "the three model notes appear");
  assert.ok(/Not set up/.test(said) && /only through your employer/.test(said), "term cover missing and employer-only health cover, in plain words");
  assert.ok(/1 session|2 sessions/.test(said) || /\d+ sessions? in 30 days/.test(said), "sessions, not 'workouts'");

  // ── The model can add three short notes and nothing else ──
  const longNote = "x".repeat(1000);
  const clipped = await call("render_brief", { notes: { coach: longNote, evil: "<script>alert(1)</script>", idea: { title: "<b>t</b>", text: "<img src=x onerror=alert(1)>" }, win: 5 } });
  assert.ok(!/<script|<img|onerror=/i.test(clipped.html.replace(/&lt;[^]*?&gt;/g, "")), "markup in notes is escaped");
  assert.ok(clipped.html.includes("&lt;img"), "…shown as text");
  assert.ok(!clipped.html.includes("x".repeat(400)), "a note is length-limited");

  // ── Goals: the monthly need is the Goals page's formula, worked by hand ──
  assert.deepStrictEqual(R.goalNeed({ target: 2e7, saved: 2e6, dueDate: "2028-05-26" }, "2026-10-21"), { remaining: 18000000, months: 20, perMonth: 900000 }, "₹1.8 Cr over 583 days = 19.2 months → 20 → ₹9,00,000");
  assert.deepStrictEqual(R.goalNeed({ target: 1e7, saved: 4341123, dueDate: "2027-10-22" }, "2026-10-21"), { remaining: 5658877, months: 13, perMonth: 435299 });
  assert.deepStrictEqual(R.goalNeed({ target: 200000, saved: 150000, dueDate: "2027-03-31" }, "2026-10-21"), { remaining: 50000, months: 6, perMonth: 8334 });
  assert.strictEqual(R.goalNeed({ target: 100, saved: 100, dueDate: "2027-01-01" }, "2026-10-21").done, true, "a reached goal");
  assert.strictEqual(R.goalNeed({ target: 100, saved: 10, dueDate: "2026-10-01" }, "2026-10-21").overdue, true, "a missed date asks for the whole rest");
  assert.strictEqual(R.goalNeed({ target: 100, saved: 10 }, "2026-10-21").perMonth, null, "no date, no monthly figure");
  assert.ok(/₹9,00,000 a month for 20 months/.test(said) && /₹8,334 a month for 6 months/.test(said), "and the email shows those");
  assert.ok(/already hold ₹14\.\d+ L|already hold ₹1[34]/.test(said) || /Your bank savings and FDs already hold/.test(said), "an emergency-fund goal far below real cover says so");

  // ── Status words ──
  assert.deepStrictEqual([R.status({ call: "Review" }).label, R.status({ call: "Consider trimming" }).label, R.status({ call: "Watch — weak trend" }).label, R.status({ call: "Hold — don't add now (stretched)" }).label, R.status({ call: "Hold", verdict: "Doing great" }).label, R.status({ call: "Hold", verdict: "Okay" }).label],
    ["Look closely", "Look closely", "Keep an eye", "Don't add more now", "Doing well", "On track"]);

  // ── What to do today ──
  const base = JSON.parse(JSON.stringify(pack));
  const sipNone = R.todayActions({ ...base, taxPlan: { actions: [], people: [] }, calendar: [], sipThisMonth: { monthElapsedPct: 68, targetMe: 50000, targetWife: 50000, investedMe: 0, investedWife: 0 } }, "2026-10-21");
  assert.deepStrictEqual(sipNone.map((a) => a.title), ["Make this month's SIPs"], "late in the month with nothing invested");
  assert.deepStrictEqual(R.todayActions({ taxPlan: { actions: [], people: [] }, calendar: [], sipThisMonth: { monthElapsedPct: 68, targetMe: 50000, targetWife: 50000, investedMe: 50000, investedWife: 0 } }, "2026-10-21"), [], "once something is invested it stops nagging");
  assert.deepStrictEqual(R.todayActions({ taxPlan: { actions: [], people: [] }, calendar: [], sipThisMonth: { monthElapsedPct: 49, targetMe: 50000, targetWife: 0, investedMe: 0, investedWife: 0 } }, "2026-10-21"), [], "early in the month it waits");
  const many = R.todayActions({ taxPlan: { actions: [1, 2, 3, 4, 5].map((i) => ({ severity: "high", title: "A" + i, why: "Why " + i + " is explained in this long first sentence here. More.", due: `2026-11-0${i}` })), people: [] }, calendar: [], sipThisMonth: null }, "2026-10-21");
  assert.deepStrictEqual(many.map((a) => a.title), ["A1", "A2", "A3"], "at most three, soonest first");
  assert.ok(many.every((a) => !/More/.test(a.why)), "a full first sentence is all that is shown");
  const shortLead = R.todayActions({ taxPlan: { actions: [{ severity: "high", title: "T", why: "4 items found. A refund of ₹1,000 would become ₹500 to pay. Third sentence.", due: "2026-11-01" }], people: [] }, calendar: [], sipThisMonth: null }, "2026-10-21")[0].why;
  assert.strictEqual(shortLead, "4 items found. A refund of ₹1,000 would become ₹500 to pay.", "a very short first sentence brings the second along");
  assert.deepStrictEqual(R.todayActions({ taxPlan: { actions: [{ severity: "high", title: "Far", why: "x", due: "2027-06-01" }], people: [] }, calendar: [], sipThisMonth: null }, "2026-10-21"), [], "a deadline months away is not 'today'");
  const ren = R.todayActions({ taxPlan: { actions: [], people: [] }, calendar: [{ kind: "renewal", what: "Car policy renewal (Me)", date: "2026-10-30", inDays: 9, note: "₹12,000" }], sipThisMonth: null }, "2026-10-21");
  assert.ok(ren.length === 1 && /Renew: Car policy/.test(ren[0].title), "a renewal within 14 days");

  // ── Notices appear only when something is off ──
  const fine = { brief: { dataFreshness: { mutualFundsHoursOld: 1, stocksHoursOld: 1, usStocksHoursOld: 1 }, integrity: { alerts: [] } }, lawWatch: { stale: false, changes: [] }, holdingsCheck: { checkedOn: "2026-10-19", status: "ok", gaps: [] } };
  assert.deepStrictEqual(R.notices(fine, "2026-10-21"), [], "nothing to say when all is fine");
  assert.ok(R.notices({ ...fine, brief: { ...fine.brief, dataFreshness: { mutualFundsHoursOld: 40 } } }, "2026-10-21")[0].text.includes("40 hours old"), "old prices");
  assert.ok(/saved copy from 20 Oct 2026/.test(R.notices({ ...fine, dataSource: { fromCache: true, cachedAt: "2026-10-20T04:30:00Z" } }, "2026-10-21")[0].text), "the saved-copy fallback is announced");
  assert.ok(/INDmoney: Alpha \(Prafful\)/.test(R.notices({ ...fine, holdingsCheck: { checkedOn: "2026-10-19", status: "gaps", gaps: [{ name: "Alpha", who: "Me", confirmed: true }, { name: "Gone", who: "Wife", confirmed: false }] } }, "2026-10-21")[0].text), "only gaps seen twice are reported");
  assert.deepStrictEqual(R.notices({ ...fine, holdingsCheck: { checkedOn: "2026-10-19", status: "watch", gaps: [{ name: "Alpha", who: "Me", confirmed: false }] } }, "2026-10-21"), [], "a first-time gap (INDmoney may be behind) is not shown");
  assert.ok(/no result yet/.test(R.notices({ ...fine, holdingsCheck: null }, "2026-10-21")[0].text) && /last ran on 5 Oct 2026/.test(R.notices({ ...fine, holdingsCheck: { checkedOn: "2026-10-05", status: "ok", gaps: [] } }, "2026-10-21")[0].text), "no check yet / an old check");
  assert.ok(/first monthly law check is due/.test(JSON.stringify(pack.lawWatch)) && !R.notices({ ...fine, lawWatch: pack.lawWatch }, "2026-10-21").length, "the law check is not nagged about before its first run is due");
  assert.ok(/Tax law update: Slabs change, new slab for ₹15L/.test(R.notices({ ...fine, lawWatch: { stale: false, changes: [{ headline: "Slabs change", effect: "new slab for ₹15L" }] } }, "2026-10-21")[0].text) && /Tax → Rules/.test(R.notices({ ...fine, lawWatch: { changes: [{ headline: "h", effect: "" }] } }, "2026-10-21")[0].text), "a law change points to the Rules tab");

  // ── A data problem replaces the whole brief ──
  const alertOut = R.renderBrief({ ...base, brief: { ...base.brief, integrity: { ok: false, alerts: [{ level: "critical", topic: "Duplicate rows", text: "Mutual-fund rows look doubled." }] } } }, { now: "2026-10-21" });
  assert.strictEqual(alertOut.kind, "alert");
  assert.ok(/^Life Ledger — DATA ALERT: Duplicate rows$/.test(alertOut.subject) && /doubled/.test(alertOut.text) && /Remove the extra copies/.test(alertOut.html), "says what is wrong and what to do");
  assert.ok(!/Net worth|Your investments|Income tax/.test(alertOut.html + alertOut.text), "no numbers, calls or tax figures from data that failed its check");

  // ── Subject wording ──
  const sub = (delta, netWorth) => R.renderBrief({ ...base, brief: { ...base.brief, netWorth: { ...base.brief.netWorth, netWorth, changeVsPrevious: { delta, byClass: {} } } } }, { now: "2026-10-21" }).subject;
  assert.ok(/₹1,31,65,981 \(flat today\)$/.test(sub(144, 13165981)) && /\(up ₹1\.8 L today\)$/.test(sub(180000, 13165981)) && /\(down ₹44,930 today\)$/.test(sub(-44930, 13165981)), "flat, up, down");

  // ── Weekly and month-end extras ──
  assert.ok(R.intact(R.renderBrief(base, { now: "2026-10-21" }).html) && R.intact(alertOut.html), "both the brief and the alert end with a correct length marker");
  assert.ok(!/[^-]background:/.test(R.renderBrief(base, { now: "2026-10-21" }).html) && !/[^-]background:/.test(alertOut.html), "Gmail strips the background shorthand (header, chips, progress bars); only background-color survives");
  assert.ok(!/This week/.test(R.renderBrief(base, { now: "2026-10-21" }).html) && !/Month-end/.test(R.renderBrief(base, { now: "2026-10-21" }).html), "a plain Wednesday has neither");
  assert.ok(/Month-end/.test(R.renderBrief(base, { now: "2026-10-31" }).html), "the last day of the month");
  assert.ok(/<b>[^<]*<\/b>/.test(R.renderBrief({ ...base, brief: { ...base.brief, netWorth: { ...base.brief.netWorth, history: [{ date: "2026-10-18", netWorth: 100 }] } } }, { now: "2026-10-25" }).html.match(/This week[^]*?<\/table>/)[0]), "Sunday gets the week in review");

  // ── Words inside names are escaped ──
  const evil = JSON.parse(JSON.stringify(base)); evil.funds.rows[0].name = '<b onmouseover="x">Fund</b> & Co';
  const e = R.renderBrief(evil, { now: "2026-10-21" });
  assert.ok(!e.html.includes('<b onmouseover') && e.html.includes("&lt;b onmouseover"), "a fund name cannot inject markup");

  // ── Nothing urgent ──
  const calm = JSON.parse(JSON.stringify(base)); calm.taxPlan.actions = []; calm.sipThisMonth = null; calm.calendar = [];
  assert.ok(/Nothing urgent today/.test(R.renderBrief(calm, { now: "2026-10-21" }).html), "an empty list says so kindly");

  console.log("brief render tests passed");
})().catch((e) => { console.error(e); process.exit(1); });

// ── The saved copy used when the cloud cannot be reached (separate, synchronous setup) ──
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "llcache-")), cacheFile = path.join(dir, "last-vault.json");
  const vault = await V.encryptVault({ data: { marker: "PLAINTEXT-MARKER-123", expenses: [] } }, "pw-1");
  const reply = (o) => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(o) });
  const up = async () => reply({ ok: true, rev: 9, vault, updatedAt: "2026-10-20T01:00:00Z" });
  const down = async () => ({ ok: false, status: 404, headers: { get: () => null }, text: async () => "Not found" });
  const live = await V.fetchState({ gatewayUrl: "https://x", password: "pw-1", fetchImpl: up, cacheFile, now: Date.parse("2026-10-20T04:30:00Z") });
  assert.ok(!live.fromCache && live.data.marker === "PLAINTEXT-MARKER-123");
  const onDisk = fs.readFileSync(cacheFile, "utf8");
  assert.ok(!onDisk.includes("PLAINTEXT-MARKER-123") && !onDisk.includes("pw-1"), "the saved copy is the encrypted blob: nothing readable and no password on disk");
  assert.strictEqual((fs.statSync(cacheFile).mode & 0o777).toString(8), "600", "readable only by you");
  const fallback = await V.fetchState({ gatewayUrl: "https://x", password: "pw-1", fetchImpl: down, cacheFile, attempts: 2, waitMs: 1 });
  assert.deepStrictEqual([fallback.fromCache, fallback.data.marker, fallback.rev, fallback.cachedAt], [true, "PLAINTEXT-MARKER-123", 9, "2026-10-20T04:30:00.000Z"], "when the cloud is down the brief can still run, marked as a saved copy");
  assert.ok(/404/.test(fallback.reason), "and says why");
  await assert.rejects(V.fetchState({ gatewayUrl: "https://x", password: "WRONG", fetchImpl: down, cacheFile, attempts: 2, waitMs: 1 }), /404|Wrong/, "a wrong password never reads the saved copy");
  await assert.rejects(V.fetchState({ gatewayUrl: "https://x", password: "pw-1", fetchImpl: down, attempts: 2, waitMs: 1 }), /404/, "no saved copy asked for: the failure is reported as before");
  fs.writeFileSync(cacheFile, "garbage");
  await assert.rejects(V.fetchState({ gatewayUrl: "https://x", password: "pw-1", fetchImpl: down, cacheFile, attempts: 2, waitMs: 1 }), /404/, "an unreadable saved copy is no better than none");
  const wrongPw = async () => reply({ ok: false, error: "unauthorized" });
  await assert.rejects(V.fetchState({ gatewayUrl: "https://x", password: "bad", fetchImpl: wrongPw, cacheFile: path.join(dir, "other.json"), attempts: 2, waitMs: 1 }), /Wrong vault password/, "a wrong password is still reported, not hidden by a cache");
  console.log("saved-copy tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
