/**
 * Life Ledger — the share profit and loss panel (strings only; no state, no events). Every text from data is escaped.
 * model = LifeLedgerPnl.build(...) plus open: [“owner|broker”…]. o = { fmt, names }.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerPnlViews = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const h = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nameOf = (names, owner) => (names && names[owner]) || owner;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? `${Number(iso.slice(8))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : "");

  /** Profit and loss to the paisa, with its sign: a broker's figure is checked to the paisa, so it is shown that way. */
  const exact = (n) => `₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const signed = (n) => `${n > 0.004 ? "+" : n < -0.004 ? "−" : ""}${exact(n)}`;
  const tone = (n) => (n > 0.004 ? "good" : n < -0.004 ? "bad" : "flat");
  const money = (n) => `<span class="dv-delta ${tone(n)}">${h(signed(n))}</span>`;
  const maybe = (n, missing) => (n === null || n === undefined ? `<small>${h(missing)}</small>` : h(exact(n)));

  function check(r) {
    if (r.status === "match") return `✓ Matches the broker${r.diff ? ` (${h(exact(r.diff))} rounding)` : ""}`;
    if (r.status === "differs") return `⚠ App adds up to ${h(signed(r.app || 0))}, ${h(exact(r.diff))} ${r.diff > 0 ? "above" : "below"} the broker`;
    if (r.status === "older") return `Broker report ends ${h(day(r.to))}, before the last sale on ${h(day(r.latest))}: the app's own figure`;
    if (r.status === "app") return "No broker report: the app's own figure";
    if (r.status === "extra") return "Not tied to one year";
    return "No shares sold";
  }

  function brokerBlock(owner, b, o, open) {
    const key = `${owner}|${b.broker}`, isOpen = open.has(key), t = b.totals;
    let out = `<tr class="pf-main"><td data-label="Broker"><button class="pf-toggle" type="button" data-act="pnl-open" data-id="${h(key)}" aria-expanded="${isOpen}">${h(b.broker)}<span class="pf-caret" aria-hidden="true">${isOpen ? "▾" : "▸"}</span></button><br><small>${t.sales} sale${t.sales === 1 ? "" : "s"}${t.differs ? ` · ${t.differs} year to look at` : ""}</small></td>
      <td data-label="Profit / loss"><strong>${money(t.profit)}</strong>${t.options ? `<br><small>options ${h(signed(t.options))}</small>` : ""}</td>
      <td data-label="Charges">${maybe(t.charges, "not known")}${t.chargesUnknown && t.charges !== null ? `<br><small>some years not known</small>` : ""}</td>
      <td data-label="After charges">${money(t.after)}</td>
      <td data-label="Dividends">${maybe(t.dividends, "no figure")}</td></tr>`;
    if (isOpen) out += b.years.map((r) => `<tr class="pf-sub"><td data-label="Year"><span class="pf-indent">${r.fy ? `FY ${h(r.fy)}` : "Other"}</span><br><small>${check(r)}${r.note ? `. ${h(r.note)}` : ""}</small></td>
      <td data-label="Profit / loss">${r.shown === null ? "—" : money(r.shown)}${r.options ? `<br><small>options ${h(signed(r.options))}</small>` : ""}</td>
      <td data-label="Charges">${maybe(r.charges, "not known")}</td>
      <td data-label="After charges">${money((r.shown || 0) + (r.options || 0) - (r.charges || 0))}</td>
      <td data-label="Dividends">${maybe(r.dividends, "no figure")}</td></tr>`).join("");
    return out;
  }

  function panel(model, o) {
    const m = model || {}, people = m.people || [], open = new Set(m.open || []);
    if (!people.length) return `<div class="empty-state">No sales recorded yet.</div>`;
    const t = m.totals;
    const card = (label, value, sub) => `<div class="pnl-card"><span>${h(label)}</span><strong>${value}</strong><small>${h(sub)}</small></div>`;
    const cards = `<div class="pnl-cards">${card("Profit from shares sold", money(t.profit + (t.options || 0)), `${t.sales} sales${t.options ? ", options included" : ""}`)}${card("Charges in broker reports", t.charges === null ? "—" : h(exact(t.charges)), t.chargesUnknown ? "some are not known" : "all years that have one")}${card("After those charges", money(t.after), "before tax")}${card("Dividends in broker reports", t.dividends === null ? "—" : h(exact(t.dividends)), "not part of the profit above")}</div>`;
    const tables = people.map((p) => `<h5>${h(nameOf(o.names, p.owner))} · ${money(p.totals.profit + (p.totals.options || 0))} <small>${h(signed(p.totals.after))} after known charges</small></h5>
      <div class="table-wrap"><table class="dv-table pf-table pnl-table"><thead><tr><th>Broker</th><th>Profit / loss</th><th>Charges</th><th>After charges</th><th>Dividends</th></tr></thead><tbody>${p.brokers.map((b) => brokerBlock(p.owner, b, o, open)).join("")}</tbody></table></div>`).join("");
    const owners = people.map((p) => p.owner);
    const years = (m.years || []).map((y) => `<tr><td data-label="Year">FY ${h(y.fy)}</td>${owners.map((w) => `<td data-label="${h(nameOf(o.names, w))}">${y.byOwner[w] === undefined ? "—" : money(y.byOwner[w])}</td>`).join("")}<td data-label="Both"><strong>${money(y.total)}</strong></td></tr>`).join("");
    const byYear = `<h5>Year by year (before charges)</h5><div class="table-wrap"><table class="dv-table pf-table pnl-years"><thead><tr><th>Year</th>${owners.map((w) => `<th>${h(nameOf(o.names, w))}</th>`).join("")}<th>Both</th></tr></thead><tbody>${years}</tbody></table></div>`;
    return `${cards}${tables}${byYear}<p class="dv-note">Indian shares and ETFs that were sold. Shares you still hold, mutual funds and US stocks are not counted here. A broker's charges can include account fees as well as trading costs. These figures are for your records; ask your CA how each sale is taxed.</p>`;
  }

  return { panel, check };
});
