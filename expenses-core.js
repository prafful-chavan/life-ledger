/**
 * Life Ledger — Expenses tab logic (pure; no DOM, no network).
 *
 * What the Expenses tab computes before it draws anything: expenses grouped by month, one month's rows filtered by owner
 * and search text, the total, the categories, the sort order and the page. The screen code in app.js only draws what this
 * returns, so every rule here can be tested on its own.
 *
 * The helpers that live in app.js (reading a date, spelling a category, turning text into a number) are passed in rather
 * than copied, so there is still one definition of each.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerExpenses = factory();
})(typeof self !== "undefined" ? self : this, function () {
  /**
   * Groups expenses by month ("2026-10"). Each bucket holds the month's total, its categories and its rows.
   * d = { monthKey(date) → "YYYY-MM" or "", num(value) → number, category(expense) → name }
   */
  function monthIndex(expenses, d) {
    const byMonth = new Map();
    for (const expense of expenses || []) {
      const key = d.monthKey(expense.date);
      if (!key) continue;                                  // an expense with no readable date belongs to no month
      if (!byMonth.has(key)) byMonth.set(key, { total: 0, categories: {}, rows: [] });
      const bucket = byMonth.get(key), amount = d.num(expense.amount), cat = d.category(expense);
      bucket.total += amount;
      bucket.categories[cat] = (bucket.categories[cat] || 0) + amount;
      bucket.rows.push(expense);
    }
    return byMonth;
  }

  /** Months that have expenses, newest first. */
  function listMonths(index) {
    return [...index.keys()].sort().reverse();
  }

  /** The month to show: the one chosen if it still has expenses, else the newest, else none. */
  function pickMonth(months, wanted) {
    return wanted && months.includes(wanted) ? wanted : months[0] || "";
  }

  /** Does this expense match what was typed in the search box? (case-insensitive; category, note, who paid, amount, date) */
  function matchesSearch(item, text) {
    if (!text) return true;
    return [item.category, item.note, item.paidBy, item.amount, item.date].some((v) => String(v || "").toLowerCase().includes(text));
  }

  /**
   * One month's rows as the screen shows them.
   * o = { owner: "Both"|"Me"|"Wife", search, page (0-based), pageSize, normalizeOwner, category, num, time(item) → ms }
   * An expense paid by "Both" shows under each person. Returns the total, the count, the average, the categories (largest
   * first), the top one, and the rows of the page (newest first). The page is kept inside the pages that exist.
   */
  function monthView(rows, o) {
    const text = String(o.search || "").toLowerCase().trim();
    const owner = o.owner || "Both";
    const filtered = (rows || []).filter((item) => {
      const who = o.normalizeOwner(item.paidBy || "Both");
      if (owner !== "Both" && who !== owner && who !== "Both") return false;
      return matchesSearch(item, text);
    });
    const total = filtered.reduce((t, r) => t + o.num(r.amount), 0);
    const byCat = {};
    for (const item of filtered) { const c = o.category(item); byCat[c] = (byCat[c] || 0) + o.num(item.amount); }
    const categories = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const sorted = filtered.slice().sort((a, b) => o.time(b) - o.time(a));
    const size = Math.max(1, o.pageSize || 80);
    const totalPages = Math.max(1, Math.ceil(sorted.length / size));
    const page = Math.min(totalPages - 1, Math.max(0, o.page || 0));
    const pageRows = sorted.slice(page * size, (page + 1) * size);
    return {
      total, count: sorted.length, average: sorted.length ? total / sorted.length : 0, categories,
      top: { name: categories[0] ? categories[0][0] : "-", value: categories[0] ? categories[0][1] : 0 },
      pageRows, page, totalPages,
    };
  }

  return { monthIndex, listMonths, pickMonth, matchesSearch, monthView };
});
