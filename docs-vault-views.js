/**
 * Life Ledger — the markup of the Documents page (pure: data in, HTML out; no DOM, no network).
 *   panel(m, o) — find a paper (search + kind / person / year filters), open it in Drive, and what is still to be collected
 * m = { facets, results, query, filters, limit, collect }  (facets = LifeLedgerDocs.facets, collect = LifeLedgerDocs.collectList).
 * o = { names: { Me, Wife } }. All text from the data is escaped; a link is only drawn when it is a Drive link.
 * The page puts the result in place and listens to `data-act`.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./dashboard-charts.js"), require("./docs-vault-core.js"));
  else root.LifeLedgerDocsViews = factory(root.LifeLedgerDashboardCharts, root.LifeLedgerDocs);
})(typeof self !== "undefined" ? self : this, function (Ch, D) {
  const h = Ch.esc;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const kb = (n) => (n >= 1024 ? (n / 1024).toFixed(1) + " MB" : n + " KB");
  const STATE_TEXT = { COLLECT: "to collect", "COLLECT LATER": "later", CHECK: "check", HAVE: "have it" };

  function row(d) {
    const link = D.safeUrl(d.url);
    const meta = [d.person, d.fy, d.kind, d.sizeKb ? kb(d.sizeKb) : ""].filter(Boolean).map(h).join(" · ");
    const open = link
      ? `<a class="ghost-button up-btn dc-open" href="${h(link)}" target="_blank" rel="noopener noreferrer" data-act="docs-open">Open in Drive</a>`
      : `<span class="dv-note up-warn dc-nolink">not linked to Drive yet</span>`;
    const lock = d.status === D.STATUS.LOCKED ? ` <span class="dc-tag up-warn">locked</span>` : "";
    return `<li class="dc-row" data-id="${h(d.id)}"><span class="dc-type">${h(d.type)}</span><div class="dc-main"><b>${h(d.name)}</b>${lock}<small>${meta}</small>${d.about ? `<p class="dc-about">${h(d.about)}</p>` : ""}</div>${open}</li>`;
  }

  function chips(m) {
    const f = m.filters || {};
    const all = `<button type="button" class="chip ${f.type ? "" : "active"}" data-act="docs-type" data-v="">All <span>${m.facets.total}</span></button>`;
    return all + m.facets.types.map((t) => `<button type="button" class="chip ${f.type === t.name ? "active" : ""}" data-act="docs-type" data-v="${h(t.name)}">${h(t.name)} <span>${t.count}</span></button>`).join("");
  }

  function select(field, label, list, sel, any) {
    return `<label>${h(label)}<select data-field="${field}"><option value="">${h(any)}</option>${list.map((x) => `<option value="${h(x.name)}" ${x.name === sel ? "selected" : ""}>${h(x.name)} (${x.count})</option>`).join("")}</select></label>`;
  }

  function collect(c) {
    if (!c || !c.rows.length) return `<p class="dv-note">Nothing is on the collect list.</p>`;
    const groups = new Map();
    c.rows.forEach((r) => { if (!groups.has(r.area)) groups.set(r.area, []); groups.get(r.area).push(r); });
    const body = [...groups.entries()].map(([area, rows]) => `<details class="dc-area" ${rows.some((r) => !r.done) ? "open" : ""}><summary><b>${h(area)}</b> <span>${rows.filter((r) => !r.done).length} open</span></summary><ul class="up-list">${rows.map((r) => `<li class="dc-collect ${r.done ? "dc-done" : ""}" data-key="${h(r.key)}">
        <label class="dc-check"><input type="checkbox" data-act="docs-done" data-key="${h(r.key)}" ${r.done ? "checked" : ""} ${r.status === "HAVE" ? "disabled" : ""}> <span>${h(r.doc)}</span></label>
        <small>${h(STATE_TEXT[r.status] || r.status)}${r.where ? " · " + h(r.where) : ""}${r.helpsApp ? " · also helps the app" : ""}</small>
        <input type="text" class="dc-note" data-act="docs-note" data-key="${h(r.key)}" value="${h(r.note)}" maxlength="300" placeholder="a note (optional)" aria-label="Note for ${h(r.doc)}"></li>`).join("")}</ul></details>`).join("");
    return `<p class="dv-note"><b>${c.open}</b> still to collect, ${c.done} done.</p>${body}`;
  }

  function panel(m, o) {
    const f = m.filters || {};
    const total = m.results.length, limit = Math.max(1, Number(m.limit) || 60), shown = m.results.slice(0, limit);
    const fa = m.facets;
    const line = fa.total
      ? `<p class="dc-head"><strong>${plural(fa.total, "paper")}</strong> in Drive${fa.locked ? ` · <span class="up-warn">${fa.locked} locked</span>` : ""}${fa.notInDrive ? ` · <span class="up-warn">${fa.notInDrive} not linked yet</span>` : ""}${fa.setAside ? ` · ${fa.setAside} set aside` : ""}.</p>`
      : `<p class="dv-note">No papers are listed yet. Load the Document Register into the app to see them here.</p>`;
    const list = total
      ? `<ul class="up-list dc-list">${shown.map(row).join("")}</ul>${total > shown.length ? `<div class="up-actions"><button type="button" class="ghost-button up-btn" data-act="docs-more">Show ${Math.min(60, total - shown.length)} more (${total - shown.length} left)</button></div>` : ""}`
      : `<p class="dv-note">${fa.total ? "No paper matches. Clear a filter or type fewer words." : ""}</p>`;
    return `<div class="dc-panel">${line}
      <div class="up-card dc-find"><div class="up-form">
        <label class="dc-search">Find a paper<input type="search" data-field="q" value="${h(m.query || "")}" placeholder="e.g. gold bill, form 16 2025, car policy" autocomplete="off"></label>
        ${select("person", "Whose", fa.persons, f.person, "Everyone")}${select("fy", "Tax year", fa.years, f.fy, "Any year")}
        <label class="dc-showset"><input type="checkbox" data-field="showSetAside" ${f.showSetAside ? "checked" : ""}> Show papers set aside</label>
      </div><div class="dc-chips" role="group" aria-label="Kind of paper">${chips(m)}</div></div>
      <p class="dv-note" aria-live="polite">${total === 1 ? "1 match" : total + " matches"}${total ? "." : ""}</p>${list}
      <h4 class="dc-collect-h">To collect</h4>${collect(m.collect)}</div>`;
  }

  return { panel, row };
});
