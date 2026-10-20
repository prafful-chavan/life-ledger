#!/usr/bin/env node
/**
 * Mutation test for the money engines: breaks the code one small way at a time (a < becomes <=, a + becomes -, a rate
 * changes) and checks that the tests notice. A mutant the tests miss ("survivor") is a blind spot in the tests.
 * Works on a throwaway copy of the repo, so the real files are never touched.
 *
 *   node tools/mutation-test.js                 # tax engine + capital gains
 *   node tools/mutation-test.js --file advisor-engine.js --fn xirr
 */
const fs = require("fs"), os = require("os"), path = require("path"), { spawnSync } = require("child_process");

const REPO = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FILE = opt("--file", "tax-core.js");
const FNS = (opt("--fn", "slabTax,equityGainsTax,hraExemption,capDeductions,computeTax,holding,taxIfSold")).split(",");
const TESTS = (opt("--tests", "tax-oracle,finance-oracle,tax-edges,tax-system,tax-household,tax-saver,tax-integration")).split(",").map((t) => `tests/${t}.test.js`);

// The lines of each named function (from its "function name(" line to the matching closing brace at the same indent)
const src = fs.readFileSync(path.join(REPO, FILE), "utf8").split("\n");
const ranges = [];
for (const fn of FNS) {
  const start = src.findIndex((l) => new RegExp(`function ${fn}\\s*\\(`).test(l));
  if (start < 0) { console.error(`function ${fn} not found in ${FILE}`); process.exit(2); }
  const indent = src[start].match(/^\s*/)[0];
  let end = start + 1;
  while (end < src.length && !(src[end].startsWith(indent + "}") && src[end].trim().startsWith("}"))) end++;
  ranges.push([fn, start, end]);
}

const OPS = [
  [/ <= /, " < "], [/ < /, " <= "], [/ >= /, " > "], [/ > /, " >= "], [/ === /, " !== "], [/ !== /, " === "],
  [/ \+ /, " - "], [/ - /, " + "], [/ \* /, " / "], [/Math\.min\(/, "Math.max("], [/Math\.max\(/, "Math.min("],
  [/(?<![\w.])(\d+(?:\.\d+)?)(?![\w.])/, (m) => String(Number(m) + (Number.isInteger(Number(m)) ? 1 : 0.5))],
];

const mutants = [];
for (const [fn, a, b] of ranges) for (let i = a + 1; i < b; i++) {
  const line = src[i];
  if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;   // comments
  for (const [re, rep] of OPS) {
    const g = new RegExp(re.source, "g");
    let m;
    while ((m = g.exec(line))) {
      const before = line.slice(0, m.index), after = line.slice(m.index + m[0].length);
      if ((before.match(/["'`]/g) || []).length % 2 === 1) continue;   // inside a string
      const changed = before + (typeof rep === "function" ? m[0].replace(m[1] || m[0], rep(m[1] || m[0])) : rep) + after;
      if (changed !== line) mutants.push({ fn, line: i + 1, from: line.trim(), to: changed.trim(), text: changed });
    }
  }
}

// Throwaway copy of the repo (code and tests only)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ll-mut-"));
for (const f of fs.readdirSync(REPO)) if (/\.js$/.test(f)) fs.copyFileSync(path.join(REPO, f), path.join(tmp, f));
for (const d of ["tests", "tools", "mcp"]) fs.cpSync(path.join(REPO, d), path.join(tmp, d), { recursive: true, filter: (p) => !/node_modules|e2e/.test(p) });

const runTests = () => TESTS.every((t) => spawnSync(process.execPath, [t], { cwd: tmp, timeout: 20000, stdio: "ignore" }).status === 0);
if (!runTests()) { console.error("The unmutated code fails its own tests; fix that first."); process.exit(2); }

const survivors = [];
let killed = 0;
mutants.forEach((mu, n) => {
  const lines = src.slice(); lines[mu.line - 1] = mu.text;
  fs.writeFileSync(path.join(tmp, FILE), lines.join("\n"));
  if (runTests()) survivors.push(mu); else killed++;
  if (process.stdout.isTTY) process.stdout.write(`\r${n + 1}/${mutants.length}`);
});
fs.rmSync(tmp, { recursive: true, force: true });

const score = mutants.length ? Math.round((killed / mutants.length) * 1000) / 10 : 100;
console.log(`\n${FILE} [${FNS.join(", ")}]: ${killed}/${mutants.length} mutants caught (${score}%), ${survivors.length} survived`);
for (const s of survivors) console.log(`  ${s.fn} line ${s.line}:\n    - ${s.from}\n    + ${s.to}`);
if (args.includes("--json")) fs.writeFileSync(opt("--json"), JSON.stringify({ file: FILE, fns: FNS, total: mutants.length, killed, score, survivors }, null, 1));
