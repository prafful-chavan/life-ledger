/**
 * Life Ledger — ⌘K command bar ranking (pure; no DOM).
 * rank(query, items) → items that match the query, best first. With no query, items keep their given order.
 * An item is { id, label, hint?, keywords?: string[], group? }.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerCmdk = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const norm = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

  function isSubsequence(q, text) {
    let i = 0;
    for (const c of text) if (c === q[i] && ++i === q.length) return true;
    return q.length === 0;
  }

  /** Higher is better; 0 = no match. */
  function score(query, item) {
    const q = norm(query);
    if (!q) return 1;
    const label = norm(item.label);
    const words = label.split(" ");
    if (label === q) return 100;
    if (label.startsWith(q)) return 90;
    if (words.some((w) => w.startsWith(q))) return 80;
    if (label.includes(q)) return 65;
    const kw = (item.keywords || []).map(norm);
    if (kw.some((k) => k === q)) return 75;
    if (kw.some((k) => k.startsWith(q))) return 60;
    if (kw.some((k) => k.includes(q))) return 45;
    // every typed word hits the label or a keyword ("net hist" → Net worth history)
    const qs = q.split(" ");
    if (qs.length > 1 && qs.every((w) => words.some((x) => x.startsWith(w)) || kw.some((k) => k.includes(w)))) return 55;
    if (q.length >= 3 && isSubsequence(q.replace(/ /g, ""), label.replace(/ /g, ""))) return 20;
    return 0;
  }

  function rank(query, items) {
    const list = Array.isArray(items) ? items : [];
    if (!norm(query)) return list.slice();
    return list
      .map((item, i) => ({ item, s: score(query, item), i }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .map((x) => x.item);
  }

  return { rank, score, norm };
});
