#!/usr/bin/env node
/** Refreshes version-lock.json — but only once every changed file has had its ?v= bumped in index.html. */
const fs = require("fs");
const { currentAssets, readLock, problems, LOCK } = require("./version-lock");
const cur = currentAssets(), lock = readLock();
const unbumped = problems(cur, lock).filter((p) => /CHANGED but its version is still/.test(p) || /does not exist/.test(p));
if (unbumped.length) { console.error("Not updating the lock:\n - " + unbumped.join("\n - ")); process.exit(1); }
fs.writeFileSync(LOCK, JSON.stringify(Object.fromEntries(Object.entries(cur).sort(([a], [b]) => a.localeCompare(b))), null, 2) + "\n");
console.log(`version-lock.json updated (${Object.keys(cur).length} files).`);
