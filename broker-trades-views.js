/**
 * Life Ledger — the markup of the "Broker trades" panel (pure: numbers in, HTML out; no DOM, no network).
 *   panel(model, o) — add trade files, what the trades explain for each holding, apply real buy dates
 * model = { tradeCount, range: { from, to } | null, byOwner: { Me: n, Wife: n }, recon: { items, soldSince }, choices: Set(keys), files: [{ name, format, added, duplicates, skipped, errors[] }] }
 * o = { fmt: { inr(n) }, names: { Me, Wife }, dateText(iso), today }.
 * All text that comes from files or data is escaped here. The page puts the result in place and listens to `data-act`.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./dashboard-charts.js"));
  else root.LifeLedgerBrokerTradesViews = factory(root.LifeLedgerDashboardCharts);
})(typeof self !== "undefined" ? self : this, function (Ch) {
  const h = Ch.esc;
  const name = (names, key) => (names && names[key]) || key;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const FORMAT = { "zerodha-tradebook": "Zerodha tradebook", "groww-history": "Groww order history" };
  const STATUS = {
    exact: ["good", "Exact"], short: ["warn", "Partly"], check: ["warn", "Check"], extra: ["flat", "More in files"], none: ["flat", "No trades"],
  };

  function fileResults(files, o) {
    if (!files || !files.length) return "";
    const li = files.map((f) => {
      const bad = f.errors && f.errors.length;
      return `<li><span>${h(f.name)}</span><b>${f.format ? h(FORMAT[f.format] || f.format) : "not read"}</b><small>${f.format ? `${plural(f.added, "new trade")}, ${f.duplicates} already kept${f.skipped ? `, ${plural(f.skipped, "non-equity trade")} skipped` : ""}` : ""}${bad ? `${f.format ? ". " : ""}${h(f.errors.slice(0, 2).join(" "))}${f.errors.length > 2 ? ` (+${f.errors.length - 2} more)` : ""}` : ""}</small></li>`;
    }).join("");
    return `<ul class="up-list bt-files">${li}</ul>`;
  }

  function form(o) {
    return `<div class="up-card bt-add"><h4>Add trade files</h4>
      <p class="dv-note">Trade history from your broker, one file at a time or several together: Zerodha Console → Reports → Tradebook (CSV), Groww → order history (CSV). The files are read on this device and kept, encrypted, in your vault. A trade already kept is never added twice.</p>
      <div class="up-form">
        <label>Whose account<select data-field="owner"><option value="Me">${h(name(o.names, "Me"))}</option><option value="Wife">${h(name(o.names, "Wife"))}</option></select></label>
        <label>Files<input type="file" data-field="files" accept=".csv,text/csv" multiple></label>
      </div>
      <div class="up-actions"><button type="button" class="primary-button up-btn" data-act="bt-read">Read the files</button></div>
      <p class="up-error" role="alert" hidden></p></div>`;
  }

  function row(it, o, choices) {
    const [tone, label] = STATUS[it.status] || STATUS.none;
    const dated = it.alreadyDated;
    const range = it.first ? `${h(o.dateText(it.first))} → ${h(o.dateText(it.last))}` : "";
    const lots = it.lots && it.lots.length ? `${plural(it.lots.length, "lot")} · ` : "";
    const use = dated ? `<span class="dv-delta good">Dated</span>`
      : it.status === "exact" ? `<span class="dv-delta good">Will be dated</span>`
      : it.status === "short" ? `<label class="up-check"><input type="checkbox" data-act="bt-choice" data-key="${h(it.key)}" ${choices && choices.has(it.key) ? "checked" : ""}> <span>Date the ${h(String(it.explainedQty))}, leave ${h(String(it.missingQty))} unknown</span></label>`
      : "";
    return `<tr data-key="${h(it.key)}">
      <td data-label="Share"><strong>${h(it.symbol)}</strong><br><small>${h(name(o.names, it.owner))} · ${h(it.demat)}</small></td>
      <td data-label="Held">${h(String(it.heldQty))}<br><small>avg ${h(o.fmt.inr(it.heldAvg))}</small></td>
      <td data-label="Trades explain">${it.explainedQty > 0 ? h(String(it.explainedQty)) : "—"}<br><small>${lots}${range}</small></td>
      <td data-label="Result"><span class="dv-delta ${tone}">${h(dated ? "Dated" : label)}</span>${it.note ? `<br><small>${h(it.note)}</small>` : ""}</td>
      <td data-label="Use" class="up-actions">${use}</td></tr>`;
  }

  function panel(model, o) {
    const m = model || {}, recon = m.recon || { items: [], soldSince: [] }, items = recon.items || [], choices = m.choices || new Set();
    const count = (s) => items.filter((i) => i.status === s && !i.alreadyDated).length;
    const dated = items.filter((i) => i.alreadyDated).length;
    const exact = count("exact"), chosenShort = items.filter((i) => i.status === "short" && !i.alreadyDated && choices.has(i.key)).length;
    const toApply = exact + chosenShort;
    const owners = Object.entries(m.byOwner || {}).filter(([, n]) => n > 0).map(([k, n]) => `${h(name(o.names, k))} ${n}`).join(", ");
    const summary = m.tradeCount > 0
      ? `<p class="dv-note"><strong>${m.tradeCount}</strong> trade${m.tradeCount === 1 ? "" : "s"} kept${m.range ? `, from ${h(o.dateText(m.range.from))} to ${h(o.dateText(m.range.to))}` : ""}${owners ? ` (${owners})` : ""}. Of your ${items.length} holding${items.length === 1 ? "" : "s"}: <b>${exact}</b> can be dated exactly, <b>${count("short")}</b> partly, <b>${count("check") + count("extra")}</b> need a look, <b>${count("none")}</b> have no trades${dated ? `, <b>${dated}</b> already dated` : ""}.</p>`
      : `<p class="dv-note">No trade files added yet. Once they are, each share you hold is checked against them: the shares left after replaying every buy and sell must match what you hold, in number and in average cost, before any buy date is used.</p>`;
    const table = items.length && m.tradeCount > 0
      ? `<div class="table-wrap"><table class="dv-table up-table bt-table"><thead><tr><th>Share</th><th>Held</th><th>Trades explain</th><th>Result</th><th>Use</th></tr></thead><tbody>${items.map((i) => row(i, o, choices)).join("")}</tbody></table></div>`
      : "";
    const apply = m.tradeCount > 0
      ? `<div class="up-actions"><button type="button" class="primary-button up-btn" data-act="bt-apply" ${toApply ? "" : "disabled"}>${toApply ? `Apply real buy dates to ${plural(toApply, "holding")}` : "Nothing to apply"}</button><button type="button" class="ghost-button up-btn" data-act="bt-clear">Remove the kept trades</button></div>
         <p class="dv-note">Applying splits a holding into one row per buy date. The shares and the money invested stay exactly as they are; the dates are kept after every “Sync Holdings”. Shares the files cannot explain stay as one row whose buy date is marked unknown, never guessed.</p>`
      : "";
    const sold = (recon.soldSince || []).length
      ? `<h5>In the files but no longer held</h5><ul class="up-list">${recon.soldSince.map((s) => `<li><span>${h(s.symbol)} · ${h(name(o.names, s.owner))}</span><b>${h(String(s.qty))} shares</b><small>The files still show these, last trade ${h(o.dateText(s.last))}. If you sold them, record the sale on the Dashboard; otherwise the files may be missing a later sale.</small></li>`).join("")}</ul>` : "";
    return `<div class="bt">${summary}${form(o)}${fileResults(m.files, o)}${table}${apply}${sold}</div>`;
  }

  return { panel, FORMAT };
});
