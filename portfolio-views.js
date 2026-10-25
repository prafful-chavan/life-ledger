/**
 * Life Ledger — the markup of the Portfolio mix card (pure: numbers in, HTML out; no DOM, no network).
 *
 * A ring chart and a pivot table (kind of holding × owner) side by side, then the household's mix against a reference mix.
 * All text from the data (fund and stock names) is escaped here. The page puts the result in place and listens to `data-act`.
 *
 * model = { alloc (portfolio-core allocate), ref (referenceFor or null), rows (compare), ui }, o = { fmt, names }.
 * fmt = { inr(n) whole rupees, pct(n, digits) "12%" }.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./dashboard-charts.js"), require("./portfolio-core.js"));
  else root.LifeLedgerPortfolioViews = factory(root.LifeLedgerDashboardCharts, root.LifeLedgerPortfolio);
})(typeof self !== "undefined" ? self : this, function (Ch, PF) {
  const h = Ch.esc;
  const VIEWS = [["kind", "By holding type"], ["group", "By what it is in"]];
  const REFERENCES = [["target", "My target"], ["balanced", "Balanced"], ["aggressive", "Growth"], ["conservative", "Cautious"], ["age", "100 − age"]];
  const SHOW_HOLDINGS = 8;
  const name = (names, key) => (names && names[key]) || key;
  const gap = (n, fmt) => `${n >= 0 ? "+" : "−"}${fmt.pct(Math.abs(n), 1)}`;

  function seg(list, active, act) {
    return `<div class="dv-seg small" role="tablist">${list.map(([id, label]) => `<button class="dv-seg-btn${id === active ? " active" : ""}" type="button" role="tab" aria-selected="${id === active}" data-act="${act}" data-id="${h(id)}">${h(label)}</button>`).join("")}</div>`;
  }

  /** The colour class of the n-th row in the ring and the table. */
  const colorOf = (i) => `pf-c${i % 12}`;

  function ownerCells(byOwner, owners, fmt, names) {
    return owners.map((ow) => `<td data-label="${h(name(names, ow))}">${byOwner[ow] ? fmt.inr(byOwner[ow]) : "—"}</td>`).join("");
  }

  /** Rows of the pivot: the main row of a kind, and under it (when opened) its parts and holdings. */
  function pivotRows(alloc, ui, o) {
    const { fmt, names } = o, owners = alloc.owners;
    const open = new Set(ui.open || []);
    const head = `<tr><th>${ui.view === "group" ? "What it is in" : "Holding type"}</th>${owners.map((ow) => `<th>${h(name(names, ow))}</th>`).join("")}<th>Total</th><th>Share</th></tr>`;
    const rows = (ui.view === "group" ? alloc.groups : alloc.kinds);
    const ownerHeaders = owners.map((ow) => name(names, ow));
    const holdingRows = (positions, indent) => {
      const shown = positions.slice(0, SHOW_HOLDINGS);
      const more = positions.length - shown.length;
      return shown.map((p) => `<tr class="pf-sub"><td data-label="Holding"><span class="pf-indent${indent ? " deep" : ""}">${h(p.name)}</span></td>${owners.map((ow) => `<td data-label="${h(name(names, ow))}">${p.owner === ow ? fmt.inr(p.value) : "—"}</td>`).join("")}<td data-label="Total">${fmt.inr(p.value)}</td><td data-label="Share">${h(fmt.pct((p.value / alloc.total) * 100, 1))}</td></tr>`).join("")
        + (more > 0 ? `<tr class="pf-sub"><td colspan="${owners.length + 3}" data-label=""><span class="pf-indent${indent ? " deep" : ""} dv-hint">+ ${more} smaller holding${more === 1 ? "" : "s"}</span></td></tr>` : "");
    };
    const body = rows.map((r, i) => {
      const expandable = ui.view !== "group" && r.positions && r.positions.length > 0;
      const isOpen = expandable && open.has(r.key);
      const label = expandable
        ? `<button class="pf-toggle" type="button" data-act="pf-open" data-id="${h(r.key)}" aria-expanded="${isOpen}"><i class="pf-sw ${colorOf(i)}"></i>${h(r.label)}<span class="pf-caret">${isOpen ? "▾" : "▸"}</span></button>`
        : `<span class="pf-plain"><i class="pf-sw ${colorOf(i)}"></i>${h(r.label)}</span>`;
      let out = `<tr class="pf-main"><td data-label="${ui.view === "group" ? "What it is in" : "Holding type"}">${label}</td>${ownerCells(r.byOwner, owners, fmt, names)}<td data-label="Total"><strong>${fmt.inr(r.value)}</strong></td><td data-label="Share"><div class="dv-cellbar"><span>${h(fmt.pct(r.pct, 1))}</span>${Ch.bar({ pct: r.pct, label: `${r.label} ${fmt.pct(r.pct, 1)}` })}</div></td></tr>`;
      if (isOpen) {
        if (r.funds) {
          out += r.funds.map((f) => `<tr class="pf-sub pf-part"><td data-label="Type"><span class="pf-indent">${h(f.label)}</span> <small>${h(fmt.pct(f.pctOfKind, 0))} of funds</small></td>${owners.map((ow) => `<td data-label="${h(name(names, ow))}">${(() => { const v = f.positions.filter((p) => p.owner === ow).reduce((t, p) => t + p.value, 0); return v ? fmt.inr(v) : "—"; })()}</td>`).join("")}<td data-label="Total">${fmt.inr(f.value)}</td><td data-label="Share">${h(fmt.pct(f.pctOfPortfolio, 1))}</td></tr>`).join("");
        }
        out += holdingRows(r.positions, Boolean(r.funds));
      }
      return out;
    }).join("");
    const foot = `<tr class="pf-total"><td data-label="">Total</td>${owners.map((ow) => `<td data-label="${h(name(names, ow))}">${fmt.inr(alloc.kinds.reduce((t, k) => t + (k.byOwner[ow] || 0), 0))}</td>`).join("")}<td data-label="Total"><strong>${fmt.inr(alloc.total)}</strong></td><td data-label="Share">100%</td></tr>`;
    return { head, body, foot, ownerHeaders };
  }

  function compareBlock(model, o) {
    const { fmt } = o, { alloc, ref, rows } = model;
    if (!ref) return `<div class="empty-state">Set a target mix in the Advisor profile, or pick another reference above.</div>`;
    const mine = alloc.groups.map((g) => ({ label: g.label, value: g.value, cls: `pf-g-${g.key}` }));
    const theirs = ["equity", "debt", "gold", "cash"].map((k) => ({ label: PF.GROUP_LABEL[k], value: ref.mix[k], cls: `pf-g-${k}` }));
    const legend = `<div class="dv-legend">${["equity", "debt", "gold", "cash", "other"].map((k) => `<span><i class="dv-swatch pf-g-${k}"></i>${h(PF.GROUP_LABEL[k])}</span>`).join("")}</div>`;
    const statusText = { within: "In range", above: "Above", below: "Below" };
    const table = rows.map((r) => `<tr><td data-label="Bucket"><strong>${h(r.label)}</strong></td><td data-label="You">${h(fmt.pct(r.actualPct, 1))}</td><td data-label="Reference">${h(fmt.pct(r.refPct, 1))}</td>
      <td data-label="Gap">${h(gap(r.gapPP, fmt))} pts</td><td data-label="Worth">${r.gapRupees >= 0 ? "+" : "−"}${fmt.inr(Math.abs(r.gapRupees))}</td>
      <td data-label="Status"><span class="dv-delta ${r.status === "within" ? "good" : "flat"}">${h(statusText[r.status])}</span></td></tr>`).join("");
    return `<div class="pf-bars"><div class="pf-bar-row"><span>You</span>${Ch.stack(mine, "Your mix")}</div><div class="pf-bar-row"><span>${h(ref.label)}</span>${Ch.stack(theirs, "Reference mix")}</div></div>${legend}
      <div class="table-wrap"><table class="dv-table"><thead><tr><th>Bucket</th><th>You</th><th>Reference</th><th>Gap</th><th>Worth</th><th>Status</th></tr></thead><tbody>${table}</tbody></table></div>
      <p class="dv-note">${h(ref.note)} “In range” means within ${PF.TOLERANCE_PP} percentage points of the reference. A gap is information, not an instruction: the right mix depends on your goals, time horizon and tax, and a hybrid fund counts half equity and half debt.</p>`;
  }

  /** The Portfolio mix card. */
  function portfolio(model, o) {
    const { alloc, ui } = model, { fmt, names } = o;
    if (!alloc || !(alloc.total > 0)) return `<div class="empty-state">Add holdings (mutual funds, stocks, FDs, gold …) to see your portfolio mix.</div>`;
    const view = ui.view === "group" ? "group" : "kind";
    const rows = view === "group" ? alloc.groups : alloc.kinds;
    const items = rows.map((r, i) => ({ key: r.key, label: r.label, value: r.value, text: fmt.inr(r.value), cls: colorOf(i) }));
    const ring = Ch.donut({ items, top: fmt.inr(alloc.total), bottom: ui.includeOther ? "all assets" : "investments", label: "Share of your portfolio by " + (view === "group" ? "what it is in" : "holding type") });
    const legend = rows.map((r, i) => `<div class="pf-leg"><i class="pf-sw ${colorOf(i)}"></i><span class="pf-leg-name">${h(r.label)}</span><b>${h(fmt.pct(r.pct, 1))}</b></div>`).join("");
    const pv = pivotRows(alloc, { ...ui, view }, o);
    const refTabs = seg(REFERENCES, ui.reference, "pf-ref");
    const left = alloc.left > 0 ? `<p class="dv-note">${fmt.inr(alloc.left)} of other assets (vehicles, misc.) is not counted here. <button class="pf-link" type="button" data-act="pf-other">Include it</button></p>` : (ui.includeOther ? `<p class="dv-note">Counting every asset, as in Finance. <button class="pf-link" type="button" data-act="pf-other">Investments only</button></p>` : "");
    return `<div class="pf-top">${seg(VIEWS, view, "pf-view")}</div>
      <div class="pf-grid"><div class="pf-ring"><div class="dc-chart pf-donut">${ring}</div><div class="pf-legend">${legend}</div></div>
      <div class="pf-pivot"><div class="table-wrap"><table class="dv-table pf-table"><thead>${pv.head}</thead><tbody>${pv.body}${pv.foot}</tbody></table></div>${left}</div></div>
      <section class="dv-card pf-compare"><header class="dv-card-head"><div><h4>Your mix against a reference</h4><p>How the portfolio is split between equity, debt, gold and cash, next to a standard reference mix.</p></div><div class="dv-tools">${refTabs}</div></header>${compareBlock(model, o)}</section>`;
  }

  return { VIEWS, REFERENCES, SHOW_HOLDINGS, portfolio };
});
