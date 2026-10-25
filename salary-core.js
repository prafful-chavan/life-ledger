/**
 * Life Ledger — Salary tab logic (pure; no DOM, no network).
 *
 * What the Salary tab works out before it draws anything: which income rows are salary, the totals and averages, the table's
 * rows and the largest pay components of a month. (The growth dashboard's rules are in salary-insights-core.js.) app.js only
 * draws what this returns.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerSalary = factory();
})(typeof self !== "undefined" ? self : this, function () {
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

  /** The three largest pay components of a row, as [{label, value}]. fields = [[key, label], …]. */
  function componentParts(item, fields, num) {
    return fields
      .map(([key, label]) => ({ label, value: num(item[key]) }))
      .filter((part) => part.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
  }

  return { isSalary, netOf, summary, tableRows, componentParts };
});
