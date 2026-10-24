/**
 * Life Ledger — which release a device is running (pure; no DOM, no network).
 *
 * Every script and style file is loaded as "name?v=1.2.3", and a file's number changes whenever the file does. So the set of
 * numbers on the page IS the release. This reads them from the page's own tags (what the device actually loaded) and from a
 * freshly fetched index.html (what is live now), compares the two, and boils a release down to a short code that is easy to
 * read out between a phone, an iPad and a laptop.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerAppVersion = factory();
})(typeof self !== "undefined" ? self : this, function () {
  /** { "app.js": "1.0.124", … } from a list of URLs such as "app.js?v=1.0.124"; URLs without a ?v= number are ignored. */
  function fromUrls(urls) {
    const out = {};
    for (const u of urls || []) {
      const m = /([^/?#"']+\.(?:js|css))\?(?:[^"'#]*&)?v=([0-9][0-9A-Za-z.\-]*)/.exec(String(u));
      if (m) out[m[1]] = m[2];
    }
    return out;
  }

  /** The same, read out of the text of an index.html: every src="…" and href="…" attribute. */
  function fromHtml(html) {
    const urls = [];
    const re = /\b(?:src|href)\s*=\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(String(html || "")))) urls.push(m[1]);
    return fromUrls(urls);
  }

  /** A short code for a release (six hex characters of a hash of all the numbers); the same release always gives the same code. */
  function releaseCode(versions) {
    const text = Object.keys(versions || {}).sort().map((k) => `${k}=${versions[k]}`).join(";");
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, "0").slice(0, 6);
  }

  /** Does the live release differ from the loaded one? Returns { same, changed: [file…] } (files added, removed or renumbered). */
  function compare(loaded, live) {
    const names = new Set([...Object.keys(loaded || {}), ...Object.keys(live || {})]);
    const changed = [...names].filter((k) => (loaded || {})[k] !== (live || {})[k]).sort();
    return { same: changed.length === 0, changed };
  }

  return { fromUrls, fromHtml, releaseCode, compare };
});
