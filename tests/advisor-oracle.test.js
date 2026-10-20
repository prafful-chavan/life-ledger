// The Wealth Advisor's maths and verdict rules, written from their definitions (each threshold from both sides).
const assert = require("assert");
const A = require("../advisor-engine.js");
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// ── Returns over a window: last close against the close on or before the window start ──
{
  const s = { dates: ["2025-12-01", "2026-01-01", "2026-07-01", "2026-10-20"], closes: [90, 100, 120, 150] };
  assert.ok(close(A.returnOver(s, "2026-10-20", 182), 50), "6 months back is 21 Apr: the last close by then is 1 Jan (100); 150/100 = +50%");
  assert.ok(close(A.returnOver(s, "2026-10-20", 111), 25), "111 days back is 1 Jul exactly: 150/120 = +25%");
  assert.strictEqual(A.returnOver(s, "2026-10-20", 365), null, "no close a year back: no 1-year return");
  assert.strictEqual(A.returnOver({ dates: ["2026-10-20"], closes: [10] }, "2026-10-20", 30), null, "one close: nothing to compare");
}

// ── Annual volatility: standard deviation of daily log returns × √252 ──
{
  const closes = [100]; for (let i = 1; i <= 30; i++) closes.push(i % 2 ? 101 : 100);   // ±1% swings, 30 returns
  const r = Math.log(1.01), n = 30, expected = r * Math.sqrt(n / (n - 1)) * Math.sqrt(252) * 100;
  assert.ok(close(A.annualVol({ closes }), expected, 1e-6), `alternating ±1%: ${A.annualVol({ closes })} vs ${expected}`);
  assert.strictEqual(A.annualVol({ closes: closes.slice(0, 29) }), null, "under 30 closes: no estimate");
  assert.ok(close(A.annualVol({ closes: Array(40).fill(100) }), 0), "a flat price has no volatility");
  const withGap = closes.slice(); withGap.splice(5, 0, 0);   // a missing (zero) close is skipped, not a -100% day
  assert.ok(A.annualVol({ closes: withGap }) < expected * 1.2, "a zero close does not blow up the figure");
}

// ── Momentum: the year's high and low, drawdown, position in the range, distance from the 200-day average ──
{
  const dates = [], closes = [];
  for (let i = 0; i < 300; i++) { const d = new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10); dates.push(d); closes.push(i < 150 ? 100 + i : 249 - (i - 150) * 0.5); }
  const m = A.momentum({ dates, closes }, dates[299]);
  const last = closes[299], high = Math.max(...closes), low = Math.min(...closes);
  assert.ok(close(m.drawdown, (last / high - 1) * 100, 1e-9), "drawdown from the year's high");
  assert.ok(close(m.rangePos, ((last - low) / (high - low)) * 100, 1e-9), "where today sits between the year's low and high");
  const ma = closes.slice(100).reduce((a, b) => a + b, 0) / 200;
  assert.ok(close(m.vsMa200, (last / ma - 1) * 100, 1e-9), "against the average of the last 200 closes");
  assert.strictEqual(m.days, 299, "span of the history in days");
  const short = A.momentum({ dates: dates.slice(0, 50), closes: closes.slice(0, 50) }, dates[49]);
  assert.ok(close(short.vsMa200, (closes[49] / (closes.slice(0, 50).reduce((a, b) => a + b, 0) / 50) - 1) * 100, 1e-9), "fewer than 200 closes: the average of what there is");
  assert.strictEqual(A.momentum({ dates: ["2026-01-01"], closes: [1] }, "2026-01-01"), null);
}

// ── XIRR beyond the Excel case: several flows, and returns too large to solve ──
assert.ok(close(A.xirr([{ date: "2021-01-01", amount: -100 }, { date: "2022-01-01", amount: -100 }], 231, "2023-01-01"), 10, 1e-6), "two yearly ₹100 at 10%: 110×1.1 + 110 = 231");
assert.strictEqual(A.xirr([{ date: "2026-01-01", amount: -1 }], 1e9, "2026-01-02"), null, "a return beyond 1,000% a year is not solved (bad data, not a real return)");
assert.ok(close(A.xirr([{ date: "2021-01-01", amount: -100 }], 100, "2023-01-01"), 0, 1e-6), "no growth: 0%");
assert.ok(A.xirr([{ date: "2021-01-01", amount: -100 }], 81, "2023-01-01") < -9.9, "a loss: about -10% a year");

// ── What kind of holding it is ──
assert.strictEqual(A.kindOf({ cls: "stock", name: "Nippon India ETF Nifty IT" }), "etf");
assert.strictEqual(A.kindOf({ cls: "stock", name: "Wipro Ltd", symbol: "WIPRO" }), "stock");
assert.strictEqual(A.kindOf({ cls: "us", name: "Vanguard", symbol: "VOO" }), "etf", "a known ETF ticker");
assert.strictEqual(A.kindOf({ cls: "mf", name: "UTI Nifty 50 Index Fund" }), "index");
assert.strictEqual(A.kindOf({ cls: "mf", name: "Parag Parikh Flexi Cap" }), "active");
assert.strictEqual(A.kindOf({ cls: "fd", name: "x" }), "fd");

// ── Verdicts: status and what to do, at each threshold ──
{
  const h = (o) => ({ cls: "mf", kind: "active", historyDays: 400, weight: 2, mom: { r1y: 10, r6m: 1, r3m: 1, drawdown: -5, vsMa200: 0, ...(o.mom || {}) }, ...o, mom: { r1y: 10, r6m: 1, r3m: 1, drawdown: -5, vsMa200: 0, ...(o.mom || {}) } });
  const v = (o) => A.verdictFor(h(o), {});
  const st = (o) => v(o).status;
  assert.strictEqual(st({ relative1y: 8 }), "great", "8 points ahead of the market and rising");
  assert.strictEqual(st({ relative1y: 8, mom: { r6m: -1 } }), "good", "ahead but falling lately: good, not great");
  assert.strictEqual(st({ relative1y: 7.9 }), "good");
  assert.strictEqual(st({ relative1y: 2 }), "good");
  assert.strictEqual(st({ relative1y: 1.9 }), "ok");
  assert.strictEqual(st({ relative1y: -4.9 }), "ok");
  assert.strictEqual(st({ relative1y: -5 }), "weak");
  assert.strictEqual(st({ relative1y: -9.9 }), "weak");
  assert.strictEqual(st({ relative1y: -10, mom: { r6m: -1 } }), "poor", "10+ points behind and still falling");
  assert.strictEqual(st({ relative1y: -10, mom: { r6m: 1 } }), "weak", "behind but recovering");
  // no benchmark: absolute 1-year return
  assert.strictEqual(st({ mom: { r1y: 15 } }), "good"); assert.strictEqual(st({ mom: { r1y: 14.9 } }), "ok");
  assert.strictEqual(st({ mom: { r1y: 5 } }), "ok"); assert.strictEqual(st({ mom: { r1y: 4.9 } }), "weak");
  assert.strictEqual(st({ mom: { r1y: -10 } }), "weak"); assert.strictEqual(st({ mom: { r1y: -10.1 } }), "poor");
  // a deep fall from the year's high tempers a good verdict; a stock down 30% and still falling is poor
  assert.strictEqual(st({ relative1y: 9, mom: { drawdown: -20 } }), "ok", "20% below the high: no better than ok");
  assert.strictEqual(st({ relative1y: 9, mom: { drawdown: -19.9 } }), "great");
  assert.strictEqual(st({ cls: "stock", kind: "stock", relative1y: 0, mom: { drawdown: -30, r6m: -1 } }), "poor");
  assert.strictEqual(st({ cls: "stock", kind: "stock", relative1y: 0, mom: { drawdown: -30, r6m: 1 } }), "ok", "deep fall but recovering");
  assert.strictEqual(st({ kind: "index", relative1y: 9, mom: { drawdown: -25 } }), "great", "an index fund is not marked down for a market-wide fall");
  // without price history
  const noHist = (o) => A.verdictFor({ cls: "mf", kind: "active", historyDays: 10, weight: 1, ...o }, {}).status;
  assert.strictEqual(noHist({ ageDays: 179, xirr: 50 }), "nodata", "under 180 days old: too early to judge");
  assert.strictEqual(noHist({ ageDays: 400, xirr: 12 }), "good"); assert.strictEqual(noHist({ ageDays: 400, xirr: 11.9 }), "ok");
  assert.strictEqual(noHist({ ageDays: 400, xirr: 8 }), "ok"); assert.strictEqual(noHist({ ageDays: 400, xirr: 7.9 }), "weak");
  assert.strictEqual(noHist({ ageDays: 400, returnPct: 30 }), "nodata", "only a gain versus cost: not enough to judge");
  // moves
  const mv = (o) => v(o).move;
  assert.strictEqual(mv({ relative1y: -10, mom: { r6m: -1 } }), "review");
  assert.strictEqual(mv({ relative1y: -6 }), "watch");
  assert.strictEqual(mv({ kind: "index", relative1y: 3 }), "keep_adding", "a good index fund: keep adding");
  assert.strictEqual(mv({ relative1y: 3 }), "hold", "a good active fund: hold");
  assert.strictEqual(mv({ cls: "stock", kind: "stock", relative1y: 3, weight: 15 }), "dont_add", "15% of the money in one share: don't add");
  assert.strictEqual(mv({ cls: "stock", kind: "stock", relative1y: 3, weight: 14.9 }), "hold");
  assert.strictEqual(mv({ cls: "stock", kind: "stock", relative1y: 3, weight: 8, mom: { vsMa200: 35 } }), "dont_add", "35% above its 200-day average and 8%+ of the money");
  assert.strictEqual(mv({ cls: "stock", kind: "stock", relative1y: 3, weight: 7.9, mom: { vsMa200: 35 } }), "hold");
  assert.strictEqual(A.verdictFor({ cls: "fd", value: 1 }, {}).status, "safe");
  assert.strictEqual(A.verdictFor({ cls: "others", value: 1 }, {}).move, "watch", "untracked assets: keep small, watch");
  // gold without its own history uses the gold price's 1-year move
  const gold = (r1y) => A.verdictFor({ cls: "gold", historyDays: 0 }, { goldBm: { days: 400, r1y } }).status;
  assert.strictEqual(gold(10), "good"); assert.strictEqual(gold(9.9), "ok"); assert.strictEqual(gold(-10), "ok"); assert.strictEqual(gold(-10.1), "weak");
  assert.ok(v({ relative1y: 3, weight: 10 }).reasons.some((r) => /10% of your investments/.test(r)), "a 10% holding says so");
}
// ── Second round: window edges and a steady trend ──
{
  const day = (n) => new Date(Date.UTC(2026, 9, 20) - n * 86400000).toISOString().slice(0, 10);
  // closes exactly 30, 31, 365 and 366 days back, so each window's edge decides the answer
  const s = { dates: [day(366), day(365), day(31), day(30), day(0)], closes: [50, 80, 90, 100, 120] };
  const m = A.momentum(s, day(0));
  assert.ok(close(m.r1m, 20), "1 month = 30 days back exactly: 120/100");
  assert.ok(close(m.r1y, 50), "1 year = 365 days back exactly: 120/80");
  assert.ok(close(m.drawdown, 0) && close(m.rangePos, 100), "the year's window starts 365 days back: the 50 from 366 days back is outside it");
  assert.ok(close(A.returnOver({ dates: [day(10), day(0)], closes: [100, 110] }, day(0), 10), 10), "two closes are enough");
  const steady = [100]; for (let i = 1; i < 40; i++) steady.push(steady[i - 1] * 1.01);
  assert.ok(close(A.annualVol({ closes: steady }), 0, 1e-6), "a price rising exactly 1% a day every day has no volatility");
  assert.ok(A.annualVol({ closes: steady.slice(0, 30) }) !== null, "30 closes are enough");
}
console.log("advisor oracle tests passed");
