/**
 * Life Ledger — Salary tab logic (pure; no DOM, no network).
 *
 * What the Salary tab works out before it draws anything: which income rows are salary, the totals and averages, each
 * person's growth since their first payslip, the household's combined monthly and yearly pay, the progression summary (latest,
 * highest, organisations) and the largest pay components of a month. app.js only draws what this returns.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerSalary = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const byDateAsc = (a, b) => new Date(a.date) - new Date(b.date);

  /** An income row is salary when its type says so (or has none), or it carries a payslip figure. */
  function isSalary(item) {
    return Boolean(/salary/i.test(item.type || "salary") || item.grossEarnings || item.netSalary || item.basicSalary);
  }

  /** Net pay of a row: the payslip's net salary, else the amount. num(value) → number. */
  const netOf = (row, num) => num((row && (row.netSalary || row.amount)) || 0);

  /** Totals across salary rows: net earned, tax deducted at source, months, and the average net per month. */
  function summary(rows, num) {
    let totalNet = 0, totalTds = 0;
    for (const row of rows) { totalNet += netOf(row, num); totalTds += num(row.taxTds || 0); }
    return { totalNet, totalTds, months: rows.length, avgNet: rows.length ? totalNet / rows.length : 0 };
  }

  /** The rows the table shows: newest first, at most `limit`. time(row) → ms. */
  function tableRows(rows, time, limit = 160) {
    return rows.slice().sort((a, b) => time(b) - time(a)).slice(0, limit);
  }

  /**
   * One card per person (their first and latest payslip and the growth between them), plus the household's combined pay.
   * income = every income row (non-salary rows are left out). Growth is a percentage of the first net pay (0 when there was none).
   */
  function personCards(income, num) {
    const groups = new Map();
    for (const row of (income || []).filter(isSalary)) {
      const key = row.person || "Me";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    const people = [...groups.entries()].map(([person, entries]) => {
      const sorted = entries.slice().sort(byDateAsc);
      const firstRow = sorted[0], latestRow = sorted[sorted.length - 1];
      const firstNet = netOf(firstRow, num), latestNet = netOf(latestRow, num);
      return { person, firstRow, latestRow, firstNet, latestNet, growthPct: firstNet ? ((latestNet - firstNet) / firstNet) * 100 : 0 };
    });
    const monthly = people.reduce((t, p) => t + p.latestNet, 0);
    return { people, household: people.length > 1 && monthly > 0 ? { monthly, yearly: monthly * 12 } : null };
  }

  /**
   * The progression summary: your own salary rows when there are any (everyone's otherwise), oldest first, with the first and
   * latest row, the highest net month, the organisations in order, and the growth from the first net pay to the latest. null when
   * there is no salary yet.
   */
  function progression(income, num) {
    const all = (income || []).filter(isSalary).sort(byDateAsc);
    const mine = all.filter((row) => !/wife/i.test(row.person || ""));
    const rows = mine.length ? mine : all;
    if (!rows.length) return null;
    const latest = rows[rows.length - 1], first = rows[0];
    const highestNet = rows.reduce((best, row) => ((row.netSalary || row.amount || 0) > (best.netSalary || best.amount || 0) ? row : best), rows[0]);
    const orgs = [...new Set(rows.map((row) => row.source || row.organization || "Salary"))];
    const firstNet = netOf(first, num), latestNet = netOf(latest, num);
    return { rows, latest, first, highestNet, orgs, firstNet, latestNet, growthPct: firstNet ? ((latestNet - firstNet) / firstNet) * 100 : 0 };
  }

  /** The three largest pay components of a row, as [{label, value}]. fields = [[key, label], …]. */
  function componentParts(item, fields, num) {
    return fields
      .map(([key, label]) => ({ label, value: num(item[key]) }))
      .filter((part) => part.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
  }

  return { isSalary, netOf, summary, tableRows, personCards, progression, componentParts };
});
