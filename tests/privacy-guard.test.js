/** The repository is public. Private tax documents must be git-ignored and never tracked. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const root = path.join(__dirname, "..");
const git = (...args) => spawnSync("git", args, { cwd: root, encoding: "utf8" });

const ignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
assert.ok(/^tax-docs\/$/m.test(ignore), ".gitignore must ignore tax-docs/");
for (const pattern of ["*Form16*", "*ITR-V*", "*26AS*"]) assert.ok(ignore.includes(pattern), `.gitignore must also catch ${pattern} anywhere`);

if (git("rev-parse", "--is-inside-work-tree").stdout.trim() === "true") {
  const tracked = git("ls-files").stdout.split("\n").filter(Boolean);
  const leaked = tracked.filter((f) => /^tax-docs\//.test(f) || /form-?16|itr-v|26as/i.test(path.basename(f)));
  assert.deepStrictEqual(leaked, [], "private tax documents are tracked by git: " + leaked.join(", "));
  // git itself agrees that new files in the folder would be ignored
  const probe = git("check-ignore", "-q", "tax-docs/FY-2024-25/Prafful/Form16_test.pdf");
  assert.strictEqual(probe.status, 0, "git must ignore a file dropped into tax-docs/");
  assert.strictEqual(git("check-ignore", "-q", "Form16_TCS_2025.pdf").status, 0, "a Form 16 anywhere in the repo is ignored");
}
console.log("privacy-guard tests passed");
