/**
 * Life Ledger — the Documents vault (pure: no DOM, no network).
 * A list of the household's papers kept in Google Drive. The app keeps only the index (name, kind of paper, who, which
 * year, a short note on what is inside, and the Drive link); the files themselves stay in Drive.
 *   safeUrl(url)                  — a Drive file/folder link or "" (nothing else is ever opened)
 *   clean(rows)                   — records as the app keeps them: trimmed, de-duplicated, bad links dropped
 *   fromRegisterRow(cells)        — one row of the Document Register spreadsheet → a record (or null)
 *   search(docs, query, filters)  — the files that match every word typed and every chosen filter
 *   facets(docs)                  — counts per kind of paper, per person and per year, for the filter chips
 *   collectList(items, progress)  — what is still to be collected, with the household's own ticks and notes
 * Nothing here guesses: a note that is not there stays empty, a link that is not a Drive link is dropped.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerDocs = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const STATUS = { READABLE: "Readable", LOCKED: "Locked", IGNORED: "Set aside" };
  const FILE_URL = /^https:\/\/drive\.google\.com\/(?:file\/d|drive\/folders)\/([A-Za-z0-9_-]{20,80})(?:\/view)?(?:\?usp=[a-z_]{1,20})?$/;
  const COLLECT_STATES = ["COLLECT", "COLLECT LATER", "CHECK", "HAVE"];

  const str = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max || 300);
  const pick = (v, list, dflt) => (list.includes(v) ? v : dflt);

  /** The link if it is a Google Drive file or folder link, otherwise "". Anything else (other sites, javascript:, http:) is refused. */
  function safeUrl(url) {
    const u = String(url == null ? "" : url).trim();
    return FILE_URL.test(u) ? u : "";
  }
  /** The Drive file id inside a safe link, or "". */
  function driveId(url) {
    const m = FILE_URL.exec(safeUrl(url));
    return m ? m[1] : "";
  }
  function fnv(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h.toString(36);
  }
  function statusOf(raw) {
    const s = String(raw || "").toLowerCase();
    if (s.startsWith("locked")) return STATUS.LOCKED;
    if (s.startsWith("ignore") || s.startsWith("set aside")) return STATUS.IGNORED;
    return STATUS.READABLE;
  }
  function fyOf(raw) {
    const m = /^FY(20\d\d)-(\d\d)$/.exec(String(raw || "").trim());
    if (!m) return "";
    return (Number(m[1]) + 1) % 100 === Number(m[2]) ? `FY${m[1]}-${m[2]}` : "";
  }

  /** One record as the app keeps it. Returns null when there is no name to show. */
  function record(r) {
    if (!r || typeof r !== "object") return null;
    const name = str(r.name, 200);
    if (!name) return null;
    const url = safeUrl(r.url);
    const path = str(r.path, 400);
    const id = url ? "doc:" + driveId(url) : "doc:p" + fnv(path || name);
    const size = Number(r.sizeKb);
    return {
      id, name, url, path,
      type: str(r.type, 60) || "Other",
      person: str(r.person, 30),
      fy: fyOf(r.fy),
      kind: str(r.kind, 8).toUpperCase(),
      sizeKb: Number.isFinite(size) && size >= 0 ? Math.round(size) : 0,
      status: statusOf(r.status),
      about: str(r.about, 400),
      folder: str(r.folder, 80),
    };
  }
  /** Clean a list: records with no name are dropped, the same file listed twice is kept once (the one with a link wins). */
  function clean(rows) {
    const out = new Map();
    (Array.isArray(rows) ? rows : []).forEach((r) => {
      const rec = record(r);
      if (!rec) return;
      const prev = out.get(rec.id);
      if (!prev || (!prev.url && rec.url)) out.set(rec.id, rec);
    });
    return [...out.values()];
  }

  /** A row of the Document Register: [type, person, fy, name, kind, sizeKb, status, about, link, folder, subFolder, path]. */
  function fromRegisterRow(c) {
    if (!Array.isArray(c) || c.length < 12) return null;
    const link = /HYPERLINK\("([^"]+)"/.exec(String(c[8] || ""));
    return record({ type: c[0], person: c[1], fy: c[2], name: c[3], kind: c[4], sizeKb: c[5], status: c[6], about: c[7], url: link ? link[1] : c[8], folder: c[9], path: c[11] });
  }

  const hay = (d) => `${d.name} ${d.type} ${d.person} ${d.fy} ${d.about} ${d.path}`.toLowerCase();
  /** Files matching every word of `query` (any order, any case) and every filter: { type, person, fy, status, showSetAside }. Set-aside files are hidden unless asked for. */
  function search(docs, query, filters) {
    const f = filters || {};
    const words = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
    return (docs || [])
      .filter((d) => (f.showSetAside || d.status !== STATUS.IGNORED)
        && (!f.type || d.type === f.type)
        && (!f.person || d.person === f.person)
        && (!f.fy || d.fy === f.fy)
        && (!f.status || d.status === f.status)
        && words.every((w) => hay(d).includes(w)))
      .sort((a, b) => a.type.localeCompare(b.type) || b.fy.localeCompare(a.fy) || a.name.localeCompare(b.name, undefined, { numeric: true }));
  }

  function tally(list, key) {
    const m = new Map();
    list.forEach((d) => { const k = d[key]; if (k) m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].map(([name, count]) => ({ name, count }));
  }
  /** Counts for the filter chips, over the files that are shown (set-aside files are not counted). */
  function facets(docs) {
    const shown = (docs || []).filter((d) => d.status !== STATUS.IGNORED);
    return {
      total: shown.length,
      locked: shown.filter((d) => d.status === STATUS.LOCKED).length,
      notInDrive: shown.filter((d) => !d.url).length,
      setAside: (docs || []).length - shown.length,
      types: tally(shown, "type").sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      persons: tally(shown, "person").sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      years: tally(shown, "fy").sort((a, b) => b.name.localeCompare(a.name)),
    };
  }

  /** The papers still to be collected. `items` are { area, doc, status, helpsApp, where }; `progress` is the household's own { [key]: { done, note } }. */
  function collectKey(it) { return "c" + fnv(`${it.area}|${it.doc}`); }
  function collectList(items, progress) {
    const p = progress && typeof progress === "object" ? progress : {};
    const rows = (Array.isArray(items) ? items : []).map((it) => {
      const area = str(it && it.area, 90), doc = str(it && it.doc, 400);
      if (!area || !doc) return null;
      const status = pick(String(it.status || "").toUpperCase(), COLLECT_STATES, "COLLECT");
      const key = collectKey({ area, doc });
      const mine = p[key] || {};
      return { key, area, doc, status, helpsApp: !!it.helpsApp, where: str(it.where, 120), done: status === "HAVE" || mine.done === true, note: str(mine.note, 300) };
    }).filter(Boolean);
    return {
      rows,
      open: rows.filter((r) => !r.done).length,
      done: rows.filter((r) => r.done).length,
      byArea: tally(rows.filter((r) => !r.done), "area").sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    };
  }

  return { STATUS, COLLECT_STATES, safeUrl, driveId, record, clean, fromRegisterRow, search, facets, collectKey, collectList };
});
