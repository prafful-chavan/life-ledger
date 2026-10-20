/**
 * Life Ledger — holdings checked against an outside reference (INDmoney), pure.
 *
 * ref = { fetchedAt, members: { Me|Wife: { MF|IND_STOCK|US_STOCK: { total, rows: [{ name, units, value }] } } } }
 * (written by the weekly task from INDmoney's own holdings lists). Matching is by name (normalised; the two sides spell
 * funds differently) with equal units as strong evidence. Units decide; values only explain a gap (prices are taken at
 * different times). A gap is "confirmed" only when the previous run saw it too: INDmoney can lag on a linked account for
 * days, and a lag is not an error in the app.
 */
const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const r0 = (v) => Math.round(v);
const CLASSES = ["MF", "IND_STOCK", "US_STOCK"];
const NAMES = { Me: "Prafful", Wife: "Archana" };
const STOP = new Set(["fund", "direct", "plan", "growth", "option", "ltd", "limited", "the", "of", "co", "company", "inc", "corporation", "corp", "and", "regular"]);

function tokens(name) {
  return String(name || "").toLowerCase().replace(/&/g, " and ").replace(/fertiliser/g, "fertilizer").replace(/[^a-z0-9]+/g, " ")
    .split(" ").filter((t) => t && !STOP.has(t));
}
function similarity(a, b) {
  const A = new Set(tokens(a)), B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}
const unitsClose = (a, b) => Math.abs(num(a) - num(b)) <= Math.max(0.06, Math.abs(num(b)) * 0.001);

/** The app's holdings per owner and class: { Me: { MF: [{ name, units, value }] } }. */
function appHoldings(state, usdInr = 0) {
  const out = { Me: { MF: [], IND_STOCK: [], US_STOCK: [] }, Wife: { MF: [], IND_STOCK: [], US_STOCK: [] } };
  const mf = new Map();
  for (const t of state.mutualFunds || []) {
    const who = t.owner === "Wife" ? "Wife" : "Me", k = `${who}|${t.fundName}`;
    const e = mf.get(k) || mf.set(k, { who, name: t.fundName, units: 0, nav: 0 }).get(k);
    e.units += (/^red/i.test(String(t.transactionType || "")) ? -1 : 1) * num(t.units);
    if (num(t.latestNav)) e.nav = num(t.latestNav);
  }
  for (const e of mf.values()) if (e.units > 1e-6) out[e.who].MF.push({ name: e.name, units: e.units, value: e.units * e.nav });
  const stocks = (list, cls, fx) => {
    const g = new Map();
    for (const s of list || []) {
      const who = s.owner === "Wife" ? "Wife" : "Me", sym = String(s.symbol || s.company || "").toUpperCase(), k = `${who}|${sym}`;
      const e = g.get(k) || g.set(k, { who, name: s.company || s.symbol, symbol: sym, units: 0, price: 0 }).get(k);
      e.units += num(s.quantity); if (num(s.currentPrice)) e.price = num(s.currentPrice);
    }
    for (const e of g.values()) if (e.units > 1e-9) out[e.who][cls].push({ name: e.name, symbol: e.symbol, units: e.units, value: e.units * e.price * fx });
  };
  stocks(state.stocks, "IND_STOCK", 1);
  stocks(state.usstocks, "US_STOCK", num(usdInr) || 1);
  return out;
}

/** Pairs each reference row with the app row that best matches it. */
function pair(appRows, refRows) {
  const used = new Set(), pairs = [];
  const scored = [];
  refRows.forEach((r, ri) => appRows.forEach((a, ai) => {
    const s = Math.max(similarity(a.name, r.name), a.symbol && String(r.symbol || "").toUpperCase() === a.symbol ? 1 : 0) + (unitsClose(a.units, r.units) ? 0.5 : 0);
    if (s >= 0.5) scored.push({ ri, ai, s });
  }));
  scored.sort((x, y) => y.s - x.s);
  const refDone = new Set();
  for (const { ri, ai } of scored) { if (refDone.has(ri) || used.has(ai)) continue; refDone.add(ri); used.add(ai); pairs.push([appRows[ai], refRows[ri]]); }
  return { pairs, refOnly: refRows.filter((_, i) => !refDone.has(i)), appOnly: appRows.filter((_, i) => !used.has(i)) };
}

const isIgnored = (ignore, who, name) => (ignore || []).some((x) => x.who === who && similarity(x.name, name) >= 0.6);

/**
 * opts = { today, usdInr, prev (the previous result), ignore: [{ who, name, why }] }
 * Returns the summary saved to the vault (no account numbers, no amounts beyond the gap itself).
 */
function compare(state, ref, opts = {}) {
  const today = opts.today || new Date().toISOString().slice(0, 10);
  const app = appHoldings(state, opts.usdInr);
  const prevGaps = new Set(((opts.prev && opts.prev.gaps) || []).map((g) => `${g.who}|${g.cls}|${g.name}|${g.kind}`));
  const gaps = [], problems = [];
  let total = 0, matched = 0, ignored = 0;
  for (const who of ["Me", "Wife"]) for (const cls of CLASSES) {
    const r = ref && ref.members && ref.members[who] && ref.members[who][cls];
    if (!r) continue;
    const rows = (r.rows || []).filter((x) => num(x.units) > 0);
    // A reference whose rows do not add up to its own total was copied wrongly: do not judge the app on it
    const sum = rows.reduce((t, x) => t + num(x.value), 0);
    if (r.total != null && Math.abs(sum - num(r.total)) > Math.max(5, num(r.total) * 0.0005)) { problems.push(`${NAMES[who]} ${cls}: the INDmoney rows add up to ${r0(sum)}, not its total ${r0(r.total)}`); continue; }
    const { pairs, refOnly, appOnly } = pair(app[who][cls], rows);
    for (const [a, x] of pairs) {
      total++;
      if (unitsClose(a.units, x.units)) { matched++; continue; }
      const price = num(x.units) ? num(x.value) / num(x.units) : 0;
      gaps.push({ who, cls, name: x.name, kind: "units", app: +num(a.units).toFixed(4), ref: +num(x.units).toFixed(4), diffValue: r0((num(a.units) - num(x.units)) * price) });
    }
    for (const x of refOnly) {
      if (isIgnored(opts.ignore, who, x.name)) { ignored++; continue; }
      total++; gaps.push({ who, cls, name: x.name, kind: "missing-in-app", app: 0, ref: +num(x.units).toFixed(4), diffValue: -r0(num(x.value)) });
    }
    for (const a of appOnly) { total++; gaps.push({ who, cls, name: a.name, kind: "not-in-reference", app: +num(a.units).toFixed(4), ref: 0, diffValue: r0(num(a.value)) }); }
  }
  gaps.forEach((g) => { g.confirmed = prevGaps.has(`${g.who}|${g.cls}|${g.name}|${g.kind}`); });
  const status = problems.length ? "bad-reference" : gaps.some((g) => g.confirmed) ? "gaps" : gaps.length ? "watch" : "ok";
  return { checkedOn: today, source: "INDmoney", fetchedAt: (ref && ref.fetchedAt) || today, status, total, matched, ignored, gaps, problems };
}

module.exports = { compare, appHoldings, similarity, tokens };
