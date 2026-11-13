/**
 * Life Ledger — Portfolio breakdown (pure; no DOM, no network).
 *
 * Portfolio mix says how much is equity, debt, gold and cash. This goes one level down inside the EQUITY part:
 * large cap and index, flexi cap, mid, small, sector and thematic, international, tax-saver, hybrid (its equity half), direct stocks.
 * It names the biggest single holdings and the biggest sector, and it sets the year's gains and losses next to the ₹1.25 lakh a year
 * of long-term equity gains that is tax-free.
 *
 * A fund is placed by the words in its name. A name that matches nothing goes to "Not classified" and is listed, never guessed into a
 * bucket. The sector of a DIRECT stock is not recorded in the app, so direct stocks are one bucket and the sector view says so.
 * Fund overlap (two funds holding the same shares) is not measured: the app does not have the funds' own holdings.
 * Information from the household's records, not advice.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./portfolio-core.js"));
  else root.LifeLedgerBreakdown = factory(root.LifeLedgerPortfolio);
})(typeof self !== "undefined" ? self : this, function (PF) {
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const r2 = (n) => Math.round(n * 100) / 100;
  const pct = (part, total) => (total > 0 ? (part / total) * 100 : 0);

  /** In display order. */
  const BUCKETS = [
    { key: "large", label: "Large cap & index" },
    { key: "flexi", label: "Flexi / multi cap" },
    { key: "largemid", label: "Large & mid cap" },
    { key: "mid", label: "Mid cap" },
    { key: "small", label: "Small cap" },
    { key: "sector", label: "Sector & thematic" },
    { key: "factor", label: "Factor / strategy index" },
    { key: "elss", label: "Tax-saver (ELSS)" },
    { key: "intl", label: "International" },
    { key: "hybrid", label: "Hybrid (equity half)" },
    { key: "direct", label: "Direct stocks" },
    { key: "other", label: "Not classified" },
  ];
  const BUCKET_LABEL = Object.fromEntries(BUCKETS.map((b) => [b.key, b.label]));

  const has = (n, re) => re.test(String(n || "").toLowerCase().replace(/[-_]+/g, " "));
  const INTL = /nasdaq|s&p ?500|\bus\b|u\.s\.|overseas|international|global|hang seng|world|fang|mafang|emerging market/;
  const SECTOR = /pharma|health|banking|bank\b|financial|capital markets|\bit\b|technology|tech\b|infra|psu|manufactur|consumption|consumer|defen[cs]e|energy|\bev\b|automotive|auto\b|innovation|digital|realty|real estate|power|commodit|transport|logistics|housing/;
  const FACTOR = /momentum|quality 30|nifty quality|alpha 50|nifty alpha|alpha low|low vol|value 20|equal weight|multi ?factor|smart beta/;

  /** Which equity bucket a mutual fund belongs in, from its name. Hybrid, debt and gold funds are handled by the caller. */
  function classifyFund(name) {
    const n = String(name || "");
    if (has(n, /elss|tax ?saver/)) return "elss";
    if (has(n, INTL)) return "intl";
    if (has(n, /large\s*(&|and)\s*mid/)) return "largemid";
    if (has(n, /small ?cap/)) return "small";
    if (has(n, /mid ?cap|midcap/) && !has(n, /large/)) return "mid";
    if (has(n, FACTOR)) return "factor";
    if (has(n, SECTOR)) return "sector";
    if (has(n, /flexi|multi ?cap|focused|value fund|contra|dividend yield/)) return "flexi";
    if (has(n, /large ?cap|bluechip|blue chip|nifty ?50\b|sensex|nifty next|nifty 100|top 100|nifty index/)) return "large";
    return "other";
  }

  /** The sector label of a sector/thematic fund, from its name. */
  function sectorOf(name) {
    const n = String(name || "").toLowerCase().replace(/[-_]+/g, " ");
    const table = [[/pharma|health/, "Pharma & healthcare"], [/bank|financial|capital markets/, "Financials"], [/\bit\b|technology|tech\b|digital/, "Technology"], [/\bev\b|automotive|auto\b/, "Auto & EV"], [/infra|realty|real estate|housing/, "Infrastructure & real estate"], [/psu/, "PSU"], [/manufactur/, "Manufacturing"], [/consumption|consumer/, "Consumption"], [/defen[cs]e/, "Defence"], [/energy|power/, "Energy & power"], [/innovation/, "Innovation (thematic)"]];
    for (const [re, label] of table) if (re.test(n)) return label;
    return "Other thematic";
  }

  /** Where a direct stock or ETF (kind "stock") sits. Gold and silver ETFs are not equity: the advisor's own classifier leaves them out before this is asked. */
  function classifyStock(name, category) {
    const n = String(name || "");
    if (has(n, INTL)) return "intl";
    if (String(category || "").toUpperCase() === "ETF" || has(n, /\betf\b|bees\b/)) {
      if (has(n, /small ?cap/)) return "small";
      if (has(n, /mid ?cap|midcap/)) return "mid";
      if (has(n, FACTOR)) return "factor";
      if (has(n, SECTOR)) return "sector";
      return "large";
    }
    return "direct";
  }

  /**
   * The equity part of the household's holdings, split into buckets.
   * positions = portfolio-core positionsOf(); groupOf = the advisor's classifier (the same one the Portfolio mix uses), so the total
   * equals the Portfolio mix "Equity" row exactly. A position's equity share is whatever portfolio-core's exposureOf says (a hybrid
   * fund counts half). Returns { total, buckets[{ key, label, value, pct, holdings[{ name, owner, value, pct }] }], top[], sectors[], notes[] }.
   */
  function breakdown(positions, groupOf) {
    const items = [];
    for (const p of positions || []) {
      const eq = PF.exposureOf(p, groupOf).filter(([g]) => g === "equity").reduce((t, [, share]) => t + share, 0);
      if (!(eq > 0)) continue;
      const value = r2(p.value * eq);
      if (!(value > 0)) continue;
      let bucket;
      if (p.kind === "mf") bucket = PF.fundTypeOf(p, groupOf) === "hybrid" ? "hybrid" : classifyFund(p.name);
      else if (p.kind === "us") bucket = "intl";
      else if (p.kind === "stock") bucket = classifyStock(p.name, p.category);
      else bucket = "other";
      items.push({ name: p.name, owner: p.owner, value, bucket, kind: p.kind });
    }
    const total = r2(items.reduce((t, i) => t + i.value, 0));
    const buckets = BUCKETS.map((b) => {
      // the same share at two brokers is one holding of one person
      const merged = new Map();
      for (const i of items.filter((x) => x.bucket === b.key)) { const k = i.name + "|" + i.owner; const e = merged.get(k) || merged.set(k, { name: i.name, owner: i.owner, value: 0 }).get(k); e.value += i.value; }
      const holdings = [...merged.values()].sort((a, c) => c.value - a.value).map((i) => ({ name: i.name, owner: i.owner, value: r2(i.value), pct: pct(i.value, total) }));
      const value = r2(holdings.reduce((t, h) => t + h.value, 0));
      return { key: b.key, label: b.label, value, pct: pct(value, total), holdings };
    }).filter((b) => b.value > 0).sort((a, b) => b.value - a.value);

    // One row per name (the same fund held by two people is one holding)
    const byName = new Map();
    for (const i of items) { const e = byName.get(i.name) || byName.set(i.name, { name: i.name, value: 0, owners: new Set() }).get(i.name); e.value += i.value; e.owners.add(i.owner); }
    const top = [...byName.values()].sort((a, b) => b.value - a.value).slice(0, 5).map((e) => ({ name: e.name, value: r2(e.value), pct: pct(e.value, total), owners: [...e.owners] }));

    const sectorMap = new Map();
    for (const i of items) if (i.bucket === "sector") { const k = sectorOf(i.name); const e = sectorMap.get(k) || sectorMap.set(k, { label: k, value: 0, names: new Set() }).get(k); e.value += i.value; e.names.add(i.name); }
    const sectors = [...sectorMap.values()].sort((a, b) => b.value - a.value).map((e) => ({ label: e.label, value: r2(e.value), pct: pct(e.value, total), names: [...e.names] }));

    const notes = [];
    const direct = buckets.find((b) => b.key === "direct"), other = buckets.find((b) => b.key === "other");
    if (direct) notes.push(`The sector of your ${direct.holdings.length} direct stock${direct.holdings.length === 1 ? "" : "s"} (${direct.pct.toFixed(1)}% of equity) is not recorded, so it is not in the sector view.`);
    if (other) notes.push(`${other.holdings.length} holding${other.holdings.length === 1 ? "" : "s"} could not be placed from the name: ${other.holdings.map((h) => h.name).join(", ")}.`);
    notes.push("Overlap between funds (the same shares inside two funds) is not measured: the funds' own holdings are not in the app.");
    return { total, buckets, top, sectors, notes };
  }

  /**
   * The year's gains and losses per owner, next to the tax-free long-term limit.
   *   perLot = tax-core gains.unrealised(lots, today).perLot (each: owner, name, cat, gain, long, termUnknown)
   *   realised = tax-core gains.realisedThisFY(...) (owners{ equityLT … }, rows[])
   *   opts = { exemption: rupees a year that is tax-free (from the tax engine) }
   * Per owner: unrealised gains, unrealised losses (with the biggest three), the long-term equity gain sitting in open lots,
   * the long-term equity gain already booked this year, and what is left of the limit.
   */
  function gainsView(perLot, realised, opts) {
    const exemption = opts && Number.isFinite(Number(opts.exemption)) ? Number(opts.exemption) : null;
    const owners = new Set([...(perLot || []).map((l) => l.owner || "Me"), ...Object.keys((realised && realised.owners) || {})]);
    const out = [];
    for (const owner of owners) {
      const mine = (perLot || []).filter((l) => (l.owner || "Me") === owner);
      const eq = (l) => l.cat === "equity" || l.cat === "hybrid";
      const known = mine.filter((l) => !l.termUnknown);
      const lossLots = mine.filter((l) => num(l.gain) < 0).sort((a, b) => a.gain - b.gain);
      const r = (realised && realised.owners && realised.owners[owner]) || {};
      const used = Math.max(0, num(r.equityLT));
      out.push({
        owner,
        unrealisedGain: r2(mine.filter((l) => num(l.gain) > 0).reduce((t, l) => t + l.gain, 0)),
        unrealisedLoss: r2(lossLots.reduce((t, l) => t + l.gain, 0)),
        biggestLosses: lossLots.slice(0, 3).map((l) => ({ name: l.name, gain: r2(l.gain) })),
        longEquityGainOpen: r2(known.filter((l) => eq(l) && l.long && l.gain > 0).reduce((t, l) => t + l.gain, 0)),
        unknownTermLots: mine.filter((l) => l.termUnknown).length,
        realisedShort: r2(num(r.equityST) + num(r.otherST)),
        realisedLong: r2(num(r.equityLT) + num(r.otherLT)),
        realisedUnknownTerm: r2(num(r.unknownTerm)),
        exemptionUsed: exemption === null ? null : r2(Math.min(exemption, used)),
        exemptionLeft: exemption === null ? null : r2(Math.max(0, exemption - used)),
      });
    }
    return out.sort((a, b) => (a.owner === "Me" ? -1 : b.owner === "Me" ? 1 : a.owner < b.owner ? -1 : 1));
  }

  return { BUCKETS, BUCKET_LABEL, classifyFund, classifyStock, sectorOf, breakdown, gainsView };
});
