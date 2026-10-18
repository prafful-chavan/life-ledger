/**
 * Life Ledger MCP — technical read of one price series (pure). Series = { dates: [ISO], closes: [number] }, oldest first.
 * These are price-pattern facts plus reference levels. They say nothing about a company's business or valuation.
 */
const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
const r1 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);

const sma = (closes, n) => (closes.length >= n ? closes.slice(-n).reduce((s, x) => s + x, 0) / n : null);

/** Wilder's RSI(14). */
function rsi(closes, n = 14) {
  if (closes.length < n + 1) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i++) { const d = closes[i] - closes[i - 1]; if (d >= 0) gain += d; else loss -= d; }
  gain /= n; loss /= n;
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
  }
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}

/** Average absolute daily move over the last n sessions, as a % of price (a plain-language "how jumpy"). */
function typicalMovePct(closes, n = 20) {
  if (closes.length < n + 1) return null;
  let s = 0;
  for (let i = closes.length - n; i < closes.length; i++) s += Math.abs(closes[i] / closes[i - 1] - 1);
  return (s / n) * 100;
}

const daysBefore = (dates, iso, days) => {
  const t = new Date(iso).getTime() - days * 86400000;
  for (let i = dates.length - 1; i >= 0; i--) if (new Date(dates[i]).getTime() <= t) return i;
  return -1;
};
const returnOver = (series, days) => {
  const i = daysBefore(series.dates, series.dates[series.dates.length - 1], days);
  return i < 0 ? null : (series.closes[series.closes.length - 1] / series.closes[i] - 1) * 100;
};

function technicals(series) {
  if (!series || !series.closes || series.closes.length < 30) return null;
  const c = series.closes.map(num).filter((x) => x > 0), d = series.dates;
  if (c.length < 30) return null;
  const last = c[c.length - 1];
  const yr = c.slice(-252), hi52 = Math.max(...yr), lo52 = Math.min(...yr);
  const s20 = sma(c, 20), s50 = sma(c, 50), s200 = sma(c, 200);
  const low60 = Math.min(...c.slice(-60)), high60 = Math.max(...c.slice(-60));
  const rs = rsi(c);
  let trend = "Not enough history";
  if (s50 && s200) trend = last > s50 && s50 > s200 ? "Uptrend" : last < s50 && s50 < s200 ? "Downtrend" : last < s50 && last > s200 ? "Pullback in an uptrend" : last > s50 && last < s200 ? "Recovering" : "Sideways";
  else if (s50) trend = last > s50 ? "Above 50-day average" : "Below 50-day average";
  const rsiNote = rs == null ? null : rs >= 70 ? "Overbought (stretched up)" : rs <= 30 ? "Oversold (stretched down)" : rs >= 55 ? "Firm" : rs <= 45 ? "Soft" : "Neutral";
  return {
    last: r2(last), asOf: d[d.length - 1], sessions: c.length,
    r1m: r1(returnOver({ dates: d, closes: c }, 30)), r3m: r1(returnOver({ dates: d, closes: c }, 91)), r6m: r1(returnOver({ dates: d, closes: c }, 182)), r1y: r1(returnOver({ dates: d, closes: c }, 365)),
    sma20: r2(s20), sma50: r2(s50), sma200: r2(s200), rsi14: r1(rs), rsiNote,
    hi52: r2(hi52), lo52: r2(lo52), fromHi52Pct: r1((last / hi52 - 1) * 100), rangePos52Pct: hi52 > lo52 ? r1(((last - lo52) / (hi52 - lo52)) * 100) : null,
    low60: r2(low60), high60: r2(high60), typicalDailyMovePct: r1(typicalMovePct(c)), trend,
  };
}

/**
 * Reference levels in price terms (not advice): where the picture would turn bearish, and where the first and stretch
 * upside markers sit. Stop-side = the higher of the 200-day average and the 60-day low (just under it), kept below the price;
 * upside = the 52-week high, then a 2:1 reward-to-risk stretch from the current price.
 */
function levels(t) {
  if (!t) return null;
  const last = t.last;
  let floor = Math.max(t.sma200 && t.sma200 < last ? t.sma200 : 0, t.low60 * 0.99);
  if (!(floor > 0) || floor >= last) floor = last * (1 - Math.max(0.06, (t.typicalDailyMovePct || 1.5) * 4 / 100));
  const risk = last - floor;
  const nearTarget = t.hi52 > last * 1.02 ? t.hi52 : last + risk;
  const stretch = Math.max(last + 2 * risk, nearTarget * 1.05);
  return {
    reviewBelow: r2(floor), reviewBelowPct: r1((floor / last - 1) * 100),
    firstTarget: r2(nearTarget), firstTargetPct: r1((nearTarget / last - 1) * 100),
    stretchTarget: r2(stretch), stretchTargetPct: r1((stretch / last - 1) * 100),
    basis: "Review-below = higher of the 200-day average and the 60-day low (a break under it would weaken the trend). First target = 52-week high; stretch = a 2:1 reward-to-risk extension.",
  };
}

module.exports = { technicals, levels, rsi, sma, returnOver };
