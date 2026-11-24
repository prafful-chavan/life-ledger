/**
 * Life Ledger — the markup of the Documents page (pure: data in, HTML out; no DOM, no network).
 *   panel(m, o) — folders like Drive (open a folder, see what is inside, go back up), a search box, and what is still to be collected
 * m = { facets, tab, query, filters, searching, results, browse, flat, flatFiles, limit, collect }
 *   facets = LifeLedgerDocs.facets, browse = LifeLedgerDocs.browse (the folder being looked at), collect = LifeLedgerDocs.collectList.
 *   results = the files a search or filter found (shown flat, each with the folder it is in); flatFiles = every file under the folder when "show all" is on.
 * All text from the data is escaped; a link is only drawn when it is a Drive link. The page puts the result in place and listens to `data-act`.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./dashboard-charts.js"), require("./docs-vault-core.js"));
  else root.LifeLedgerDocsViews = factory(root.LifeLedgerDashboardCharts, root.LifeLedgerDocs);
})(typeof self !== "undefined" ? self : this, function (Ch, D) {
  const h = Ch.esc;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const kb = (n) => (n >= 1024 ? (n / 1024).toFixed(1) + " MB" : n + " KB");
  const STATE_TEXT = { COLLECT: "to collect", "COLLECT LATER": "later", CHECK: "check", HAVE: "have it" };
  const FOLDER_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"></path></svg>`;
  const pathAttr = (parts) => h((parts || []).join("/"));

  function row(d, where) {
    const link = D.safeUrl(d.url);
    const meta = [d.person, d.fy, d.kind, d.sizeKb ? kb(d.sizeKb) : ""].filter(Boolean).map(h).join(" · ");
    const open = link
      ? `<a class="ghost-button up-btn dc-open" href="${h(link)}" target="_blank" rel="noopener noreferrer" data-act="docs-open">Open in Drive</a>`
      : `<span class="dv-note up-warn dc-nolink">not linked to Drive yet</span>`;
    const lock = d.status === D.STATUS.LOCKED ? ` <span class="dc-tag up-warn">locked</span>` : "";
    const fp = D.folderParts(d);
    const whereLink = where && fp.length ? `<button type="button" class="dc-where" data-act="docs-go" data-path="${pathAttr(fp)}">in ${h(fp.map(D.folderLabel).join(" › "))}</button>` : "";
    return `<li class="dc-row" data-id="${h(d.id)}"><div class="dc-main"><b>${h(d.name)}</b>${lock}<small>${meta}</small>${d.about ? `<p class="dc-about">${h(d.about)}</p>` : ""}${whereLink}</div>${open}</li>`;
  }

  function fileList(files, limit, where) {
    const lim = Math.max(1, Number(limit) || 60), shown = files.slice(0, lim);
    if (!files.length) return "";
    return `<ul class="up-list dc-list">${shown.map((d) => row(d, where)).join("")}</ul>${files.length > shown.length ? `<div class="up-actions"><button type="button" class="ghost-button up-btn" data-act="docs-more">Show ${Math.min(60, files.length - shown.length)} more (${files.length - shown.length} left)</button></div>` : ""}`;
  }

  function crumbs(b) {
    const last = b.crumbs.length - 1;
    return `<nav class="dc-crumbs" aria-label="Folder path">${b.crumbs.map((c, i) => i === last ? `<b aria-current="page">${h(c.label)}</b>` : `<button type="button" class="dc-crumb" data-act="docs-go" data-path="${pathAttr(c.parts)}">${h(c.label)}</button>`).join('<span aria-hidden="true">›</span>')}</nav>`;
  }

  function folders(b) {
    if (!b.folders.length) return "";
    return `<div class="dc-folders">${b.folders.map((f) => `<button type="button" class="dc-folder" data-act="docs-go" data-path="${pathAttr(f.parts)}"><span class="dc-ico">${FOLDER_ICON}</span><span class="dc-fname">${h(f.label)}</span><small>${plural(f.count, "file")}</small></button>`).join("")}</div>`;
  }

  function browsePart(m) {
    const b = m.browse;
    if (!b.exists) return `${crumbs(b)}<p class="dv-note">That folder is not there any more.</p>`;
    const deep = b.folders.length > 0 && b.total > b.files.length;
    let body;
    if (m.flat) body = `<p class="dv-note">Every file inside, ${b.total} in all.</p>${fileList(m.flatFiles || [], m.limit, true)}`;
    else body = `${folders(b)}${fileList(b.files, m.limit, false)}${!b.folders.length && !b.files.length ? `<p class="dv-note">This folder is empty.</p>` : ""}`;
    const toggle = deep || m.flat ? `<div class="up-actions"><button type="button" class="ghost-button up-btn" data-act="docs-flat">${m.flat ? "Back to folders" : `Show all ${b.total} files inside`}</button></div>` : "";
    return `${crumbs(b)}${toggle}${body}`;
  }

  function searchPart(m) {
    const n = m.results.length;
    return `<p class="dv-note" aria-live="polite">${n === 1 ? "1 match" : n + " matches"}${n ? "." : ""} <button type="button" class="dc-where" data-act="docs-clear">Clear search</button></p>${n ? fileList(m.results, m.limit, true) : `<p class="dv-note">No paper matches. Clear a filter or type fewer words.</p>`}`;
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
    const f = m.filters || {}, fa = m.facets;
    const tab = m.tab === "collect" ? "collect" : "folders";
    const on = [f.type, f.person, f.fy, f.showSetAside].filter(Boolean).length;
    const line = fa.total
      ? `<p class="dc-head"><strong>${plural(fa.total, "paper")}</strong> in Drive${fa.locked ? ` · <span class="up-warn">${fa.locked} locked</span>` : ""}${fa.notInDrive ? ` · <span class="up-warn">${fa.notInDrive} not linked yet</span>` : ""}${fa.setAside ? ` · ${fa.setAside} set aside` : ""}.</p>`
      : `<p class="dv-note">No papers are listed yet. Load the Document Register into the app to see them here.</p>`;
    const find = `<div class="up-card dc-find"><label class="dc-search">Find a paper<input type="search" data-field="q" value="${h(m.query || "")}" placeholder="e.g. gold bill, form 16 2025, car policy" autocomplete="off"></label>
      <details class="dc-filters" ${on ? "open" : ""}><summary>Filters${on ? ` (${on} on)` : ""}</summary><div class="up-form">
        ${select("type", "Kind of paper", fa.types, f.type, "Any kind")}${select("person", "Whose", fa.persons, f.person, "Everyone")}${select("fy", "Tax year", fa.years, f.fy, "Any year")}
        <label class="dc-showset"><input type="checkbox" data-field="showSetAside" ${f.showSetAside ? "checked" : ""}> Show papers set aside</label></div></details></div>`;
    const tabs = `<div class="dc-tabs" role="group" aria-label="Documents sections"><button type="button" class="tab-button ${tab === "folders" ? "active" : ""}" data-act="docs-tab" data-v="folders">Folders</button><button type="button" class="tab-button ${tab === "collect" ? "active" : ""}" data-act="docs-tab" data-v="collect">To collect${m.collect && m.collect.open ? ` (${m.collect.open})` : ""}</button></div>`;
    const body = tab === "collect" ? collect(m.collect) : (m.searching ? searchPart(m) : browsePart(m));
    return `<div class="dc-panel">${line}${find}${tabs}${body}</div>`;
  }

  return { panel, row };
});
