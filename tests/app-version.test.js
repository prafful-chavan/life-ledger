// Which release a device is running: read from the page's tags, compared with the live index.html, and boiled down to a short code.
const assert = require("assert");
const V = require("../app-version.js");

// ── reading the numbers ──
assert.deepStrictEqual(V.fromUrls(["app.js?v=1.0.124", "layout.css?v=1.8.28", "https://cdn.example.com/lib.js", "plain.js", "x.js?foo=1"]), { "app.js": "1.0.124", "layout.css": "1.8.28" }, "only files with a ?v= number");
assert.deepStrictEqual(V.fromUrls(["https://prafful-chavan.github.io/life-ledger/app.js?v=1.0.124"]), { "app.js": "1.0.124" }, "a full address works too");
assert.deepStrictEqual(V.fromUrls(["a.js?r=5&v=2.0.0"]), { "a.js": "2.0.0" }, "v among other query parts"); assert.deepStrictEqual(V.fromUrls(["a.js?v=1.0.0&r=5"]), { "a.js": "1.0.0" });
assert.deepStrictEqual(V.fromUrls(["a.js?v=abc"]), {}, "a version starts with a digit"); assert.deepStrictEqual(V.fromUrls([]), {}); assert.deepStrictEqual(V.fromUrls(null), {});
assert.deepStrictEqual(V.fromUrls(["a.js?v=1.0.0-beta2"]), { "a.js": "1.0.0-beta2" });
const html = `<link rel="stylesheet" href="styles.css?v=1.0.20" /><script defer src="app.js?v=1.0.124"></script><script src="https://cdn.example.com/x.js"></script><img src="logo.png?v=3"><a href='single.js?v=1.0.0'>x</a>`;
assert.deepStrictEqual(V.fromHtml(html), { "styles.css": "1.0.20", "app.js": "1.0.124" }, "src and href in double quotes; scripts and styles only");
assert.deepStrictEqual(V.fromHtml(""), {}); assert.deepStrictEqual(V.fromHtml(null), {}); assert.deepStrictEqual(V.fromHtml('<script src = "a.js?v=1.2.3"></script>'), { "a.js": "1.2.3" }, "spaces around =");

// ── the release code ──
const a = { "app.js": "1.0.124", "layout.css": "1.8.28" };
assert.strictEqual(V.releaseCode(a), V.releaseCode({ "layout.css": "1.8.28", "app.js": "1.0.124" }), "the order of the files does not matter");
assert.ok(/^[0-9a-f]{6}$/.test(V.releaseCode(a)), "six hex characters");
assert.notStrictEqual(V.releaseCode(a), V.releaseCode({ ...a, "app.js": "1.0.125" }), "a new number gives a new code"); assert.notStrictEqual(V.releaseCode(a), V.releaseCode({ ...a, "new.js": "1.0.0" }), "a new file too");
assert.notStrictEqual(V.releaseCode({ "app.js": "1.0.12" }), V.releaseCode({ "app.js": "1.0.1" }), "no false matches between nearby numbers");
assert.strictEqual(V.releaseCode({}), V.releaseCode(null), "nothing: one fixed code"); assert.ok(/^[0-9a-f]{6}$/.test(V.releaseCode({})));

// ── the same release, or not ──
assert.deepStrictEqual(V.compare(a, { ...a }), { same: true, changed: [] });
assert.deepStrictEqual(V.compare(a, { ...a, "app.js": "1.0.125" }), { same: false, changed: ["app.js"] }, "a renumbered file");
assert.deepStrictEqual(V.compare(a, { ...a, "new.js": "1.0.0" }), { same: false, changed: ["new.js"] }, "a file added in the new release");
assert.deepStrictEqual(V.compare({ ...a, "old.js": "1.0.0" }, a), { same: false, changed: ["old.js"] }, "a file no longer used");
assert.deepStrictEqual(V.compare(a, { "app.js": "9.9.9", "layout.css": "1.8.28", "zeta.js": "1.0.0" }), { same: false, changed: ["app.js", "zeta.js"] }, "several, sorted");
assert.deepStrictEqual(V.compare({}, {}), { same: true, changed: [] }); assert.deepStrictEqual(V.compare(null, a).changed, ["app.js", "layout.css"], "nothing loaded: everything differs");
assert.strictEqual(V.compare(a, a).same, true);

// the code must be the same on every device and in every version of this function, so a few are pinned
assert.strictEqual(V.releaseCode({ "app.js": "1.0.124", "layout.css": "1.8.28" }), "d394bb"); assert.strictEqual(V.releaseCode({}), "811c9d"); assert.strictEqual(V.releaseCode({ "a.js": "1.0.0" }), "cdc4d9");
assert.deepStrictEqual(V.fromUrls(["a.js?v=1.0.0", "b.js?v=2.0.0", "c.js"]), { "a.js": "1.0.0", "b.js": "2.0.0" }, "every file is read, not only the first");

console.log("app-version tests passed");
