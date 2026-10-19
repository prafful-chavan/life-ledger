#!/usr/bin/env node
/** Runs every tests/*.test.js in its own process and reports. Used by CI, the pre-push hook, and `npm test`. */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const dir = path.join(__dirname, "..", "tests");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".test.js")).sort();
const failed = [];
const t0 = Date.now();
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(dir, f)], { encoding: "utf8", timeout: 120000 });
  if (r.status !== 0) {
    failed.push(f);
    console.error(`\n✗ ${f}\n${((r.stdout || "") + (r.stderr || "")).split("\n").filter((l) => /fail|error|assert|✗|❌|expected|actual/i.test(l)).slice(0, 12).join("\n")}`);
  }
}
console.log(`\n${files.length - failed.length}/${files.length} unit test files passed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (failed.length) { console.error("FAILED: " + failed.join(", ")); process.exit(1); }
