// Guards that stop security regressions from being slipped in by accident: the page's Content-Security-Policy, where code may be
// loaded from and data sent to, no inline handlers, no relay sites, no password written to storage, no eval.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

const html = read("index.html");
const cspRaw = (html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/) || [])[1];
assert.ok(cspRaw, "index.html carries a Content-Security-Policy");
const csp = Object.fromEntries(cspRaw.split(";").map((d) => d.trim()).filter(Boolean).map((d) => { const [name, ...v] = d.split(/\s+/); return [name, v]; }));

// ── the policy itself ──
assert.deepStrictEqual(csp["default-src"], ["'self'"], "everything not listed is blocked");
assert.ok(!csp["script-src"].includes("'unsafe-inline'"), "no inline scripts"); assert.ok(!csp["script-src"].includes("'unsafe-eval'"), "no eval");
assert.ok(!csp["script-src"].includes("*") && !csp["connect-src"].includes("*"), "no wildcards for code or data");
assert.deepStrictEqual(csp["object-src"], ["'none'"]); assert.deepStrictEqual(csp["base-uri"], ["'self'"]); assert.deepStrictEqual(csp["form-action"], ["'self'"]);
for (const list of [csp["script-src"], csp["connect-src"]]) for (const src of list.filter((x) => x.startsWith("http"))) assert.ok(src.startsWith("https://"), "https only: " + src);
assert.ok(html.includes('name="referrer" content="no-referrer"'), "the address is not sent to other sites");
assert.ok(/root\.top !== root\.self/.test(read("script-gate.js")), "the app refuses to run inside a frame");

// ── code may only come from the places the policy allows ──
const hostOf = (u) => (u.match(/^https?:\/\/([a-zA-Z0-9.-]+)/) || [])[1];
const allowedHosts = (list) => list.filter((x) => x.startsWith("https://")).map((x) => x.replace("https://", ""));
const scriptHosts = allowedHosts(csp["script-src"]), connectHosts = allowedHosts(csp["connect-src"]);
const inList = (host, list) => list.some((a) => a === host || (a.startsWith("*.") && host.endsWith(a.slice(1))));
for (const m of html.matchAll(/<script[^>]*\ssrc="(https?:\/\/[^"]+)"/g)) assert.ok(inList(hostOf(m[1]), scriptHosts), "script host not in the policy: " + m[1]);
for (const m of html.matchAll(/<link[^>]*\shref="(https?:\/\/[^"]+)"/g)) if (/rel="stylesheet"/.test(m[0])) assert.ok(inList(hostOf(m[1]), allowedHosts(csp["style-src"])), "stylesheet host not in the policy: " + m[1]);
const BROWSER_JS = fs.readdirSync(ROOT).filter((f) => f.endsWith(".js") && !/^(sw|config|interview-db)\.js$|\.test\.js$/.test(f));
for (const f of BROWSER_JS) {
  const src = read(f);
  for (const m of src.matchAll(/fetch\(\s*[`"'](https?:\/\/[^`"'$/?]+)/g)) assert.ok(inList(hostOf(m[1]), connectHosts), `${f}: fetches ${m[1]}, which the policy does not allow (add it deliberately to connect-src)`);
  for (const m of src.matchAll(/(?:XLSX_URL|SQLJS_BASE)\s*=\s*"(https?:\/\/[^"]+)"/g)) assert.ok(inList(hostOf(m[1]), scriptHosts), `${f}: loads code from ${m[1]}, not allowed by script-src`);
}

// ── no inline handlers, no eval, no relay sites, no password in storage ──
assert.ok(!/\son(click|change|input|load|error|submit|focus|blur|keydown|keyup)\s*=/i.test(html), "no inline event handlers in index.html");
for (const f of BROWSER_JS) {
  const src = read(f);
  assert.ok(!/\son(click|change|input|load|error|submit)\s*=\s*["']/i.test(src), `${f}: no inline event handlers in generated markup (the policy blocks them)`);
  assert.ok(!/\beval\s*\(|new\s+Function\s*\(/.test(src), `${f}: no eval / new Function`);
  assert.ok(!/allorigins|codetabs|corsproxy/i.test(src), `${f}: no third-party relay sites (they see what you look up and could return false prices)`);
  for (const line of src.split("\n")) if (/(localStorage|sessionStorage)\.setItem\(/.test(line) && /password/i.test(line) && !/remember(Password)?Enabled|PASSWORD_HINT/.test(line)) assert.fail(`${f}: a line stores something called password in browser storage: ${line.trim().slice(0, 100)}`);
}
assert.ok(!/password\s*[:,]/.test((read("auth.js").match(/localStorage\.setItem\(\s*REMEMBER_MARK[\s\S]{0,120}/) || [""])[0]), "the remembered marker holds no password");

console.log("security-guards: all checks passed");
