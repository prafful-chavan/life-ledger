/**
 * Life Ledger — the markup of the 12-month outgo calendar (pure: numbers in, HTML out; no DOM, no network).
 *   panel(cal, outgoings, o) — the year at a glance, month by month, what is overdue or missing an amount, and the household's recurring outgoings with a form to add one
 * cal = LifeLedgerOutgo.build(...), outgoings = the household's own recurring outgoings (state.outgoings).
 * o = { fmt: { inr(n) }, names: { Me, Wife, Both }, dateText(iso), errors: [] }.
 * All text from the data is escaped here. The page puts the result in place and listens to `data-act`.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./dashboard-charts.js"));
  else root.LifeLedgerOutgoViews = factory(root.LifeLedgerDashboardCharts);
})(typeof self !== "undefined" ? self : this, function (Ch) {
  const h = Ch.esc;
  const name = (names, key) => (names && names[key]) || key;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const KINDS = ["Rent", "Investment", "Insurance", "Loan EMI", "Bill", "Subscription", "Fee", "Other"];
  const FREQ = ["Monthly", "Quarterly", "Half-yearly", "Yearly", "Once"];
  const SOURCE = { insurance: "from Protection", liabilities: "from Liabilities", outgoings: "yours" };

  function monthRow(m, max, o, open) {
    const pct = max > 0 ? Math.round((m.total / max) * 100) : 0;
    const items = m.items.map((i) => `<li><span>${h(o.dateText(i.date))}</span><b>${h(i.name)}</b><span class="oc-amt ${i.amount === null ? "up-warn" : ""}">${i.amount === null ? "amount missing" : h(o.fmt.inr(i.amount))}</span><small>${h(i.kind)}${i.frequency && i.frequency !== "Once" ? " · " + h(i.frequency.toLowerCase()) : ""} · ${h(SOURCE[i.source] || i.source || "")}${i.owner ? " · " + h(name(o.names, i.owner)) : ""}</small></li>`).join("");
    return `<details class="oc-month" ${open ? "open" : ""} data-month="${h(m.key)}">
      <summary><span class="oc-label">${h(m.label)}</span><span class="oc-bar" aria-hidden="true"><i style="width:${pct}%"></i></span><b class="oc-total">${m.total > 0 ? h(o.fmt.inr(m.total)) : "—"}</b></summary>
      ${m.items.length ? `<ul class="up-list oc-items">${items}</ul>` : `<p class="dv-note">Nothing recorded for this month.</p>`}
      <p class="dv-note oc-cum">Paid out by the end of ${h(m.label)}, from today: <b>${h(o.fmt.inr(m.cumulative))}</b></p></details>`;
  }

  function mine(list, o) {
    if (!list || !list.length) return `<p class="dv-note">You have not added any recurring outgoing yet. Rent, PPF or SIP instalments, fees, subscriptions and bills that are not in Protection or Liabilities go here.</p>`;
    const rows = list.map((x) => `<tr data-id="${h(x.id)}"><td data-label="What"><strong>${h(x.name)}</strong><br><small>${h(x.kind || "Other")} · ${h(name(o.names, x.owner || "Both"))}</small></td><td data-label="Amount">${h(o.fmt.inr(x.amount))}</td><td data-label="How often">${h(x.frequency)}</td><td data-label="Next due">${h(o.dateText(x.nextDate))}${x.endDate ? `<br><small>until ${h(o.dateText(x.endDate))}</small>` : ""}</td><td data-label="" class="up-actions"><button type="button" class="ghost-button up-btn" data-act="oc-del" data-id="${h(x.id)}">Remove</button></td></tr>`).join("");
    return `<div class="table-wrap"><table class="dv-table up-table oc-table"><thead><tr><th>What</th><th>Amount</th><th>How often</th><th>Next due</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function form(o) {
    const opt = (list, sel) => list.map((k) => `<option value="${h(k)}" ${k === sel ? "selected" : ""}>${h(k)}</option>`).join("");
    return `<div class="up-card oc-add"><h4>Add a recurring outgoing</h4>
      <div class="up-form">
        <label>What is it for<input type="text" data-field="name" placeholder="e.g. Rent, Nagpur flat" maxlength="80"></label>
        <label>Amount each time (₹)<input type="number" min="0" step="any" inputmode="decimal" data-field="amount"></label>
        <label>How often<select data-field="frequency">${opt(FREQ, "Monthly")}</select></label>
        <label>Next due date<input type="date" data-field="nextDate"></label>
        <label>Last date (optional)<input type="date" data-field="endDate"></label>
        <label>Kind<select data-field="kind">${opt(KINDS, "Other")}</select></label>
        <label>Whose<select data-field="owner"><option value="Both">${h(name(o.names, "Both"))}</option><option value="Me">${h(name(o.names, "Me"))}</option><option value="Wife">${h(name(o.names, "Wife"))}</option></select></label>
      </div>
      <div class="up-actions"><button type="button" class="primary-button up-btn" data-act="oc-add">Add</button></div>
      <p class="up-error" role="alert" ${o.errors && o.errors.length ? "" : "hidden"}>${h((o.errors || []).join(" "))}</p></div>`;
  }

  function panel(cal, outgoings, o) {
    const c = cal || { months: [], total: 0, perMonthAverage: 0, heaviest: [], overdue: [], missing: [], undated: [] };
    const max = Math.max(0, ...c.months.map((m) => m.total));
    const heavy = new Set((c.heaviest || []).map((x) => x.key));
    const top = c.heaviest && c.heaviest.length ? `Heaviest: ${c.heaviest.map((x) => `<b>${h(x.label)}</b> ${h(o.fmt.inr(x.total))}`).join(", ")}.` : "";
    const headline = c.months.length && c.total > 0
      ? `<p class="oc-head"><strong>${h(o.fmt.inr(c.total))}</strong> goes out over the next ${c.months.length} months (to ${h(o.dateText(c.to))}), about <strong>${h(o.fmt.inr(c.perMonthAverage))}</strong> a month. ${top}</p>`
      : `<p class="dv-note">Nothing with an amount is recorded for the next ${c.months.length || 12} months. Insurance premiums come from the Protection page; add the rest below.</p>`;
    const overdue = c.overdue.length ? `<div class="up-card oc-over"><h4>Not marked paid</h4><ul class="up-list">${c.overdue.map((x) => `<li><span>${h(x.name)}</span><b class="up-warn">${h(o.dateText(x.date))}</b><small>${x.amount === null ? "amount missing" : h(o.fmt.inr(x.amount))} · ${h(SOURCE[x.source] || x.source || "")}. The date has passed; mark it paid (Protection) or move its date.</small></li>`).join("")}</ul></div>` : "";
    const missing = c.missing.length ? `<p class="dv-note up-warn">${plural(c.missing.length, "item")} with no amount, not counted in the totals: ${c.missing.map((x) => h(x.name)).join(", ")}. Add the amount where it is recorded.</p>` : "";
    const undated = c.undated.length ? `<p class="dv-note">${plural(c.undated.length, "item")} with no due date, not in the calendar: ${c.undated.map((x) => h(x.name)).join(", ")}.</p>` : "";
    const months = c.months.map((m, i) => monthRow(m, max, o, i === 0 || heavy.has(m.key))).join("");
    return `<div class="oc">${headline}${overdue}${missing}${undated}<div class="oc-months">${months}</div>
      <h5>Your recurring outgoings</h5>${mine(outgoings, o)}${form(o)}
      <p class="dv-note">Only what is recorded is shown: premiums from Protection, EMIs from Liabilities (an amount and a day of the month), and what you add here. Nothing is estimated. Information, not advice.</p></div>`;
  }

  return { panel, KINDS, FREQ };
});
