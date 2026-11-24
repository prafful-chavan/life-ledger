/**
 * Loads the Document Register into the vault: the index of papers kept in Drive (state.documents) and the list of papers still to collect
 * (state.docCollectItems). Pure: takes the vault data, returns the new data. The household's own ticks and notes (docCollect) are never touched.
 * Nothing is guessed: a row with no name is dropped and counted, a link that is not a Drive link is dropped and counted.
 */
const D = require("../docs-vault-core.js");

/** input = { rows: [register row...], collect: [[area, doc, status, helpsApp, where, note]...] } → { ok:true, after, report } | { ok:false, error } */
function build(before, input) {
  const inp = input || {};
  if (!Array.isArray(inp.rows) || !inp.rows.length) return { ok: false, error: "The register has no rows." };
  const made = inp.rows.map((r) => D.fromRegisterRow(r));
  const docs = D.clean(made.filter(Boolean));
  if (!docs.length) return { ok: false, error: "No row of the register could be read." };
  const noName = made.filter((x) => !x).length;
  const linked = docs.filter((d) => d.url).length;
  if (linked < docs.length * 0.5) return { ok: false, error: `Only ${linked} of ${docs.length} papers have a Drive link; the register looks incomplete.` };
  const items = (Array.isArray(inp.collect) ? inp.collect : []).map((c) => ({ area: c[0], doc: c[1], status: c[2], helpsApp: c[3] === "Yes", where: c[4] }));
  const list = D.collectList(items, {}).rows.map((r) => ({ area: r.area, doc: r.doc, status: r.status, helpsApp: r.helpsApp, where: r.where }));
  const prev = Array.isArray(before.documents) ? before.documents.length : 0;
  const after = { ...before, documents: docs, docCollectItems: list };
  const personal = docs.filter((d) => /[A-Z]{5}\d{4}[A-Z]|\d{12}/.test(d.name + " " + d.about + " " + d.path)).length;
  return { ok: true, after, report: { read: made.length, dropped: noName, duplicatesMerged: made.length - noName - docs.length, papers: docs.length, linked, locked: docs.filter((d) => d.status === D.STATUS.LOCKED).length, setAside: docs.filter((d) => d.status === D.STATUS.IGNORED).length, previous: prev, collect: list.length, bytes: JSON.stringify({ documents: docs, docCollectItems: list }).length, nameHasIdNumber: personal } };
}

/** The change may touch only documents and docCollectItems; every Drive link is a Drive link; ticks and notes stay. */
function guard(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) if (!["documents", "docCollectItems"].includes(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k])) return false;
  if (!Array.isArray(after.documents) || !after.documents.length) return false;
  if (!after.documents.every((d) => d && d.name && (!d.url || D.safeUrl(d.url) === d.url))) return false;
  if (new Set(after.documents.map((d) => d.id)).size !== after.documents.length) return false;
  return JSON.stringify(before.docCollect || {}) === JSON.stringify(after.docCollect || {});
}

module.exports = { build, guard };
