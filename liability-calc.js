/**
 * Life Ledger — liabilities (pure): normalisation and EMI payments.
 * EMI payment on a reducing-balance loan: interest for the month = outstanding × rate / 12,
 * the rest of the EMI reduces the outstanding. Without a rate the whole EMI reduces it.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerLiability = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const num = (v) => {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    const x = Number(String(v == null ? "" : v).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(x) ? x : 0;
  };
  const r2 = (v) => Math.round(v * 100) / 100;

  function normalizeLiability(raw, normalizeOwner) {
    const owner = normalizeOwner ? normalizeOwner(raw.owner || "Both") : raw.owner || "Both";
    return {
      ...raw,
      owner,
      value: Math.max(0, r2(num(raw.value))),
      emi: Math.max(0, r2(num(raw.emi))),
      rate: Math.max(0, num(raw.rate)),
      emiDay: Math.min(31, Math.max(0, Math.round(num(raw.emiDay)))),
      payments: Array.isArray(raw.payments) ? raw.payments : [],
    };
  }

  function monthlyInterest(value, ratePct) {
    return ratePct > 0 ? r2((num(value) * num(ratePct)) / 1200) : 0;
  }

  /** Returns the updated liability after an EMI payment, or throws on bad input. */
  function applyEmiPayment(liab, { amount, date, id }) {
    const amt = r2(num(amount));
    if (!(amt > 0)) throw new Error("Enter an EMI amount greater than zero.");
    const before = r2(num(liab.value));
    if (!(before > 0)) throw new Error("This liability is already fully paid.");
    const interest = Math.min(monthlyInterest(before, liab.rate), amt);
    const principal = Math.min(before, r2(amt - interest));
    const after = r2(before - principal);
    const payment = { id: id || "pay-" + date + "-" + amt, date, amount: amt, interest: r2(interest), principal, before, after };
    return { ...liab, value: after, payments: (liab.payments || []).concat(payment) };
  }

  /** Undo the most recent payment, only if the outstanding hasn't been edited since. */
  function undoLastPayment(liab) {
    const list = liab.payments || [];
    const last = list[list.length - 1];
    if (!last) return { ok: false, reason: "No EMI payment to undo." };
    if (r2(num(liab.value)) !== r2(last.after)) {
      return { ok: false, reason: "The outstanding was edited after that payment, so it can't be undone safely." };
    }
    return { ok: true, liability: { ...liab, value: last.before, payments: list.slice(0, -1) } };
  }

  function paidThisMonth(liab, dateISO) {
    const ym = String(dateISO).slice(0, 7);
    return (liab.payments || []).some((p) => String(p.date).slice(0, 7) === ym);
  }

  return { normalizeLiability, applyEmiPayment, undoLastPayment, monthlyInterest, paidThisMonth };
});
