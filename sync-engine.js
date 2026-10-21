/**
 * Life Ledger — record-level sync engine (pure, storage/transport agnostic).
 *
 * Every device keeps `meta` next to its data:
 *   meta.u[collection][key] = ms timestamp of the record's last local edit
 *   meta.d[collection][key] = ms timestamp of the record's deletion (tombstone)
 *   meta.k[field]           = ms timestamp of a scalar/object field's last edit
 *   meta.p[collection][key] = ms timestamp of the last change to the record's VOLATILE fields (live prices/values)
 *
 * Volatile fields are refreshed automatically on every device (NAV, share price, derived value). They must NOT count as an
 * "edit": if they did, a device that was offline during a delete would refresh prices on the deleted rows afterwards, its
 * refresh would look newer than the delete, and the deleted rows would come back next to their replacements (duplicates).
 *
 * `stamp(prev, next, meta)` derives meta from a diff, so UI code never has to
 * know about sync. `merge(a, b)` is commutative, associative and idempotent,
 * so devices converge regardless of the order they exchange state in.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerSyncEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const TOMBSTONE_TTL_MS = 120 * 24 * 60 * 60 * 1000;

  const isArr = Array.isArray;

  /** Fields that are re-fetched from the market, per collection. Changing only these is not an edit. */
  const VOLATILE = {
    mutualFunds: ["currentValue", "latestNav", "navDate", "navFetchedAt", "prevNav"],
    stocks: ["currentPrice", "currentValue", "pnl", "prevClose", "priceDate"],
    usstocks: ["currentPrice", "currentValue", "dayPnl", "prevClose", "priceDate"],
    gold: ["value"],
  };
  /**
   * Fields written only by a task outside the app (the Mac's weekly holdings check). Their merge ignores timestamps:
   * a real result always beats an empty one (a freshly restored browser or an old cached copy of the app has no such
   * field and would otherwise erase it), and between two results the later check wins.
   */
  const EXTERNAL = {
    holdingsCheck: (a, b, ta, tb) => {
      const real = (v) => v && typeof v === "object" && !Array.isArray(v);
      if (!real(a) && !real(b)) return { value: a === undefined ? b : a, ts: Math.max(ta, tb) };
      if (!real(a)) return { value: b, ts: tb };
      if (!real(b)) return { value: a, ts: ta };
      const da = String(a.checkedOn || ""), db = String(b.checkedOn || "");
      if (da !== db) return da > db ? { value: a, ts: ta } : { value: b, ts: tb };
      return ta >= tb ? { value: a, ts: ta } : { value: b, ts: tb };
    },
  };
  /** [stable part, volatile part] of a record. */
  function split(coll, item) {
    const vf = VOLATILE[coll];
    if (!vf || !item || typeof item !== "object") return [item, {}];
    const st = {}, vo = {};
    for (const k of Object.keys(item)) (vf.includes(k) ? vo : st)[k] = item[k];
    return [st, vo];
  }

  function recordKey(coll, item) {
    if (item && typeof item === "object") {
      if (coll === "netWorthHistory" && item.date) return "d:" + item.date;
      if (item.id !== undefined && item.id !== null && item.id !== "") return "i:" + item.id;
    }
    return "c:" + JSON.stringify(item);
  }

  function emptyMeta() {
    return { u: {}, d: {}, k: {}, p: {} };
  }

  function cloneMeta(meta) {
    const out = emptyMeta();
    if (!meta) return out;
    ["u", "d", "p"].forEach((t) => {
      for (const coll of Object.keys(meta[t] || {})) out[t][coll] = { ...meta[t][coll] };
    });
    out.k = { ...(meta.k || {}) };
    return out;
  }

  function indexRecords(coll, list) {
    const map = new Map();
    for (const item of list || []) map.set(recordKey(coll, item), item);
    return map;
  }

  function same(a, b) {
    return a === b || JSON.stringify(a) === JSON.stringify(b);
  }

  /** Derive the next meta from what changed between two data snapshots. */
  function stamp(prevData, nextData, meta, now) {
    const out = cloneMeta(meta);
    const prev = prevData || {};
    const next = nextData || {};
    const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
    for (const field of keys) {
      const p = prev[field];
      const n = next[field];
      if (isArr(p) || isArr(n)) {
        const pm = indexRecords(field, isArr(p) ? p : []);
        const nm = indexRecords(field, isArr(n) ? n : []);
        out.u[field] = out.u[field] || {};
        out.d[field] = out.d[field] || {};
        out.p[field] = out.p[field] || {};
        for (const [key, item] of nm) {
          if (!pm.has(key)) {
            out.u[field][key] = now;
            delete out.d[field][key];
          } else if (!same(pm.get(key), item)) {
            const [ps, pv] = split(field, pm.get(key));
            const [ns, nv] = split(field, item);
            if (!same(ps, ns)) { out.u[field][key] = now; delete out.d[field][key]; }   // a real edit
            if (!same(pv, nv)) out.p[field][key] = now;                                  // only prices moved
          }
        }
        for (const key of pm.keys()) {
          if (!nm.has(key)) {
            out.d[field][key] = now;
            delete out.u[field][key];
            delete out.p[field][key];
          }
        }
      } else if (!same(p, n)) {
        out.k[field] = now;
      }
    }
    return out;
  }

  function newer(aItem, aTs, bItem, bTs) {
    if (aTs !== bTs) return aTs > bTs ? "a" : "b";
    return JSON.stringify(aItem) >= JSON.stringify(bItem) ? "a" : "b";
  }

  /**
   * Merge two {data, meta} states. Returns a new {data, meta}.
   * Deterministic: merge(a,b) and merge(b,a) hold the same records.
   */
  function merge(local, remote, now) {
    const L = local || { data: {}, meta: emptyMeta() };
    const R = remote || { data: {}, meta: emptyMeta() };
    const lm = L.meta || emptyMeta();
    const rm = R.meta || emptyMeta();
    const ld = L.data || {};
    const rd = R.data || {};
    const data = {};
    const meta = emptyMeta();
    const fields = [];
    const seen = new Set();
    [...Object.keys(ld), ...Object.keys(rd)].forEach((f) => {
      if (!seen.has(f)) { seen.add(f); fields.push(f); }
    });

    for (const field of fields) {
      const lv = ld[field];
      const rv = rd[field];
      if (isArr(lv) || isArr(rv)) {
        const lmap = indexRecords(field, isArr(lv) ? lv : []);
        const rmap = indexRecords(field, isArr(rv) ? rv : []);
        const lu = (lm.u && lm.u[field]) || {};
        const ru = (rm.u && rm.u[field]) || {};
        const lp = (lm.p && lm.p[field]) || {};
        const rp = (rm.p && rm.p[field]) || {};
        const ldel = (lm.d && lm.d[field]) || {};
        const rdel = (rm.d && rm.d[field]) || {};
        const outList = [];
        const outU = {};
        const outD = {};
        const outP = {};
        const order = [...lmap.keys()];
        for (const k of rmap.keys()) if (!lmap.has(k)) order.push(k);
        const tombKeys = new Set([...Object.keys(ldel), ...Object.keys(rdel)]);

        for (const key of order) {
          const hasL = lmap.has(key);
          const hasR = rmap.has(key);
          let item;
          let ts;
          let pts = Math.max(lp[key] || 0, rp[key] || 0);
          if (hasL && hasR) {
            const lt = lu[key] || 0;
            const rt = ru[key] || 0;
            const lWins = newer(lmap.get(key), lt, rmap.get(key), rt) === "a";
            if (lWins) { item = lmap.get(key); ts = lt; }
            else { item = rmap.get(key); ts = rt; }
            // Live prices come from whichever side refreshed them last, independent of who edited the record last.
            const other = lWins ? rmap.get(key) : lmap.get(key);
            const winP = lWins ? (lp[key] || 0) : (rp[key] || 0);
            const othP = lWins ? (rp[key] || 0) : (lp[key] || 0);
            if (othP > winP && VOLATILE[field]) item = { ...item, ...split(field, other)[1] };
          } else if (hasL) { item = lmap.get(key); ts = lu[key] || 0; }
          else { item = rmap.get(key); ts = ru[key] || 0; }
          const tomb = Math.max(ldel[key] || 0, rdel[key] || 0);
          if (tomb > 0 && tomb >= ts) { outD[key] = tomb; continue; }
          outList.push(item);
          if (ts > 0) outU[key] = ts;
          if (pts > 0) outP[key] = pts;
          if (tomb > 0) outD[key] = tomb;
        }
        for (const key of tombKeys) {
          if (outD[key] === undefined && !lmap.has(key) && !rmap.has(key)) {
            outD[key] = Math.max(ldel[key] || 0, rdel[key] || 0);
          }
        }
        // Drop stale tombstones once every device has long since seen them.
        const horizon = (now || Date.now()) - TOMBSTONE_TTL_MS;
        for (const key of Object.keys(outD)) {
          if (outD[key] < horizon) delete outD[key];
        }
        data[field] = outList;
        meta.u[field] = outU;
        meta.d[field] = outD;
        meta.p[field] = outP;
      } else {
        const lt = (lm.k && lm.k[field]) || 0;
        const rt = (rm.k && rm.k[field]) || 0;
        const hasL = field in ld;
        const hasR = field in rd;
        let value;
        let ts;
        if (EXTERNAL[field]) ({ value, ts } = EXTERNAL[field](hasL ? lv : undefined, hasR ? rv : undefined, lt, rt));
        else if (hasL && hasR) {
          if (newer(lv, lt, rv, rt) === "a") { value = lv; ts = lt; }
          else { value = rv; ts = rt; }
        } else if (hasL) { value = lv; ts = lt; }
        else { value = rv; ts = rt; }
        data[field] = value;
        if (ts > 0) meta.k[field] = ts;
      }
    }
    return { data, meta };
  }

  function canonicalKey(coll, item) {
    return recordKey(coll, item);
  }

  /** Order-independent content equality for two data snapshots. */
  function dataEquals(a, b) {
    a = a || {};
    b = b || {};
    const fields = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const f of fields) {
      const x = a[f];
      const y = b[f];
      if (isArr(x) || isArr(y)) {
        const xs = (isArr(x) ? x : []).map((i) => canonicalKey(f, i) + "=" + JSON.stringify(i)).sort();
        const ys = (isArr(y) ? y : []).map((i) => canonicalKey(f, i) + "=" + JSON.stringify(i)).sort();
        if (xs.length !== ys.length || xs.some((v, i) => v !== ys[i])) return false;
      } else if (!same(x, y)) return false;
    }
    return true;
  }

  function countRecords(data) {
    let n = 0;
    for (const v of Object.values(data || {})) if (isArr(v)) n += v.length;
    return n;
  }

  return { stamp, merge, dataEquals, emptyMeta, recordKey, countRecords, TOMBSTONE_TTL_MS };
});
