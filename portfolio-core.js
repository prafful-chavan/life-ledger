/**
 * Life Ledger — Portfolio mix logic (pure; no DOM, no network).
 *
 * Turns what the household owns into one list of positions (value, owner, kind), then works out: the share of each kind of
 * holding (mutual funds, Indian stocks, US stocks, gold, FDs …), the same split by owner (a pivot), the split by what the money
 * is exposed to (equity, debt, gold, cash), and how that compares with a reference mix.
 *
 * The values come from the app's own net-worth helpers (passed in), so the totals here are the totals everywhere else. Nothing is
 * guessed: a hybrid fund counts half equity and half debt (the advisor's rule), anything not recognised is "other" and says so.
 * The reference mixes are common rules of thumb, not advice and not a regulatory standard.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerPortfolio = factory();
})(typeof self !== "undefined" ? self : this, function () {
  /** A bucket may differ from the reference by this many percentage points before it is called off-mix (the advisor uses the same). */
  const TOLERANCE_PP = 7;
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const r2 = (n) => Math.round(n * 100) / 100;
  const pctOf = (part, total) => (total > 0 ? (part / total) * 100 : 0);

  /** The kinds of holding shown as rows, in display order. `invest: false` = not an investment (left out unless asked for). */
  const KINDS = [
    { key: "mf", label: "Mutual funds", invest: true },
    { key: "stock", label: "Indian stocks & ETFs", invest: true },
    { key: "us", label: "US stocks", invest: true },
    { key: "gold", label: "Gold", invest: true },
    { key: "silver", label: "Silver", invest: true },
    { key: "fd", label: "Fixed deposits", invest: true },
    { key: "epf", label: "EPF", invest: true },
    { key: "ppf", label: "PPF", invest: true },
    { key: "bonds", label: "Bonds", invest: true },
    { key: "bank", label: "Bank savings", invest: true },
    { key: "crypto", label: "Crypto", invest: true },
    { key: "other", label: "Other assets", invest: false },
    { key: "vehicle", label: "Vehicles", invest: false },
  ];
  const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.key, k.label]));
  const GROUPS = [
    { key: "equity", label: "Equity" },
    { key: "debt", label: "Debt" },
    { key: "gold", label: "Gold & silver" },
    { key: "cash", label: "Cash" },
    { key: "other", label: "Other" },
  ];
  const GROUP_LABEL = Object.fromEntries(GROUPS.map((g) => [g.key, g.label]));

  /**
   * Every position the household holds. s = the app's data; h = helpers that value things the way the rest of the app does:
   *   h.mfValue(txns) → rupees of one fund held by one person (net units × latest price)
   *   h.stockValue(txns) → rupees of one Indian stock held by one person at one broker
   *   h.usStockValue(txns) → the same for a US stock, already in rupees
   *   h.goldValue(item) → rupees of one gold item
   * Positions: { kind, name, owner, value, symbol? } with value > 0 only.
   */
  function positionsOf(s, h) {
    const out = [];
    const add = (kind, name, owner, value, extra) => { const v = r2(num(value)); if (v > 0) out.push({ kind, name: String(name || KIND_LABEL[kind]), owner: owner || "Me", value: v, ...(extra || {}) }); };
    const group = (list, keyOf) => {
      const by = new Map();
      for (const t of list || []) { const k = keyOf(t); if (k === null) continue; if (!by.has(k)) by.set(k, []); by.get(k).push(t); }
      return by;
    };
    for (const txns of group(s.mutualFunds, (t) => `${t.fundName || "Unknown"}|${t.owner || "Me"}`).values()) add("mf", txns[0].fundName || "Unknown fund", txns[0].owner, h.mfValue(txns));
    const stockKey = (t) => (!t.symbol && !t.company ? null : `${String(t.symbol || t.company || "Unknown").toUpperCase()}|${t.owner || "Me"}|${t.demat || ""}`);
    for (const txns of group(s.stocks, stockKey).values()) add("stock", txns[0].company || txns[0].symbol, txns[0].owner, h.stockValue(txns), { symbol: txns[0].symbol });
    for (const txns of group(s.usstocks, stockKey).values()) add("us", txns[0].company || txns[0].symbol, txns[0].owner, h.usStockValue(txns), { symbol: txns[0].symbol });
    for (const g of s.gold || []) add("gold", g.name || "Gold", g.owner, h.goldValue(g));
    const plain = (kind, list) => (list || []).forEach((x) => add(kind, x.name || x.note || KIND_LABEL[kind], x.owner, x.value));
    plain("silver", s.silver); plain("crypto", s.crypto); plain("fd", s.fd); plain("epf", s.epf); plain("ppf", s.ppf); plain("bonds", s.bonds);
    plain("bank", s.banksaving); plain("other", s.others); plain("vehicle", s.vehicles);
    return out;
  }

  /** What a position is exposed to: [[group, share], …] adding to 1. groupOf(advisorShape) is the advisor's own classifier. */
  function exposureOf(p, groupOf) {
    const cls = { mf: "mf", stock: "stock", us: "us", gold: "gold", silver: "silver", fd: "fd", epf: "epf", ppf: "ppf", bonds: "bonds", bank: "bank", crypto: "crypto", other: "other", vehicle: "other" }[p.kind] || "other";
    const g = groupOf({ cls, name: p.name, symbol: p.symbol });
    if (g === "hybrid") return [["equity", 0.5], ["debt", 0.5]];
    return [[GROUP_LABEL[g] ? g : "other", 1]];
  }

  /** For a mutual fund: "equity", "hybrid", "debt" or "gold", for the sub-rows. */
  function fundTypeOf(p, groupOf) {
    const g = groupOf({ cls: "mf", name: p.name });
    return g === "hybrid" || g === "debt" || g === "gold" ? g : "equity";
  }
  const FUND_TYPE_LABEL = { equity: "Equity funds", hybrid: "Hybrid & multi-asset funds", debt: "Debt funds", gold: "Gold funds" };

  /**
   * The mix. opts = { groupOf, includeOther }. Investments only unless includeOther (then "Other assets" and vehicles count too, and the
   * total equals the Finance tab's total assets). Returns
   *   total, owners[]: the owners present,
   *   kinds[]: [{ key, label, value, pct, byOwner, positions[], funds? }] largest first,
   *   groups[]: [{ key, label, value, pct, byOwner }] by exposure, in GROUPS order, zero rows kept out,
   *   left: what was left out (value of other assets and vehicles when includeOther is false).
   */
  function allocate(positions, opts) {
    const o = opts || {};
    const groupOf = o.groupOf || (() => "other");
    const kindOk = (k) => (KINDS.find((x) => x.key === k) || {}).invest || o.includeOther;
    const kept = positions.filter((p) => kindOk(p.kind));
    const total = r2(kept.reduce((t, p) => t + p.value, 0));
    const owners = [...new Set(kept.map((p) => p.owner))].sort((a, b) => (a === "Me" ? -1 : b === "Me" ? 1 : a < b ? -1 : 1));
    const split = (list) => Object.fromEntries(owners.map((ow) => [ow, r2(list.filter((p) => p.owner === ow).reduce((t, p) => t + p.value, 0))]));

    const kinds = KINDS.map((k) => {
      const list = kept.filter((p) => p.kind === k.key).sort((a, b) => b.value - a.value);
      const value = r2(list.reduce((t, p) => t + p.value, 0));
      const row = { key: k.key, label: k.label, value, pct: pctOf(value, total), byOwner: split(list), positions: list };
      if (k.key === "mf") {
        row.funds = ["equity", "hybrid", "debt", "gold"].map((t) => {
          const part = list.filter((p) => fundTypeOf(p, groupOf) === t);
          const v = r2(part.reduce((s, p) => s + p.value, 0));
          return { key: t, label: FUND_TYPE_LABEL[t], value: v, pctOfPortfolio: pctOf(v, total), pctOfKind: pctOf(v, value), positions: part };
        }).filter((f) => f.value > 0);
      }
      return row;
    }).filter((r) => r.value > 0).sort((a, b) => b.value - a.value);

    const sums = Object.fromEntries(GROUPS.map((g) => [g.key, { value: 0, byOwner: Object.fromEntries(owners.map((ow) => [ow, 0])) }]));
    for (const p of kept) for (const [g, share] of exposureOf(p, groupOf)) { sums[g].value += p.value * share; sums[g].byOwner[p.owner] += p.value * share; }
    const groups = GROUPS.map((g) => ({ key: g.key, label: g.label, value: r2(sums[g.key].value), pct: pctOf(sums[g.key].value, total), byOwner: Object.fromEntries(owners.map((ow) => [ow, r2(sums[g.key].byOwner[ow])])) })).filter((g) => g.value > 0);

    const left = r2(positions.filter((p) => !kindOk(p.kind)).reduce((t, p) => t + p.value, 0));
    return { total, owners, kinds, groups, left };
  }

  // ── reference mixes ────────────────────────────────────────────────

  /** Common rules of thumb (percent; each adds to 100). */
  const MODELS = {
    aggressive: { label: "Growth (75 / 10 / 10 / 5)", mix: { equity: 75, debt: 10, gold: 10, cash: 5 } },
    balanced: { label: "Balanced (60 / 25 / 10 / 5)", mix: { equity: 60, debt: 25, gold: 10, cash: 5 } },
    conservative: { label: "Cautious (30 / 50 / 10 / 10)", mix: { equity: 30, debt: 50, gold: 10, cash: 10 } },
  };

  const normalize = (mix) => {
    const keys = ["equity", "debt", "gold", "cash"];
    const sum = keys.reduce((t, k) => t + Math.max(0, num(mix[k])), 0);
    if (!(sum > 0)) return null;
    return Object.fromEntries(keys.map((k) => [k, r2((Math.max(0, num(mix[k])) / sum) * 100)]));
  };

  const ageOn = (dob, today) => {
    const d = new Date(dob + "T00:00:00Z"), t = new Date(today + "T00:00:00Z");
    if (!(d.getTime() > 0) || !(t.getTime() > 0)) return null;
    let a = t.getUTCFullYear() - d.getUTCFullYear();
    if (t.getUTCMonth() < d.getUTCMonth() || (t.getUTCMonth() === d.getUTCMonth() && t.getUTCDate() < d.getUTCDate())) a--;
    return a >= 0 && a < 120 ? a : null;
  };

  /**
   * The mix to compare against. id = "target" (the household's own target from the advisor profile), "aggressive", "balanced",
   * "conservative" or "age" (equity = 100 − average age, between 20 and 80; gold 10, cash 5, the rest debt).
   * ctx = { target: {equity,debt,gold,cash}, ages: [numbers] }. Returns { id, label, mix, note } or null when it cannot be worked out.
   */
  function referenceFor(id, ctx) {
    const c = ctx || {};
    if (id === "target") {
      const mix = c.target && normalize(c.target);
      return mix ? { id, label: "My target", mix, note: "The mix set in the advisor profile." } : null;
    }
    if (id === "age") {
      const ages = (c.ages || []).filter((a) => Number.isFinite(a));
      if (!ages.length) return null;
      const age = ages.reduce((t, a) => t + a, 0) / ages.length;
      const equity = Math.max(20, Math.min(80, Math.round(100 - age)));
      return { id, label: "100 minus age", mix: { equity, debt: 100 - equity - 15, gold: 10, cash: 5 }, note: `Equity = 100 − average age (${Math.round(age)}), kept between 20% and 80%; 10% gold, 5% cash, the rest debt.` };
    }
    const m = MODELS[id];
    return m ? { id, label: m.label, mix: { ...m.mix }, note: "A common rule of thumb, not advice." } : null;
  }

  /**
   * Your mix against a reference. groups = allocate().groups; ref = referenceFor(); total = the portfolio's value.
   * One row per bucket (equity, debt, gold, cash): your %, the reference %, the gap in percentage points (yours − reference), the
   * rupees that gap is worth, and a status: "within" (inside ±7 points), "above" or "below".
   */
  function compare(groups, ref, total) {
    if (!ref || !(total > 0)) return [];
    const have = Object.fromEntries(groups.map((g) => [g.key, g.pct]));
    return ["equity", "debt", "gold", "cash"].map((k) => {
      const actual = have[k] || 0, target = ref.mix[k] || 0, gap = actual - target;
      return { key: k, label: GROUP_LABEL[k], actualPct: actual, refPct: target, gapPP: gap, gapRupees: r2((gap / 100) * total), status: Math.abs(gap) <= TOLERANCE_PP ? "within" : gap > 0 ? "above" : "below" };
    });
  }

  return { TOLERANCE_PP, KINDS, GROUPS, MODELS, KIND_LABEL, GROUP_LABEL, FUND_TYPE_LABEL, positionsOf, exposureOf, fundTypeOf, allocate, referenceFor, compare, ageOn, normalize };
});
