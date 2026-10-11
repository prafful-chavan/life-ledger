const assert = require("assert");
const { parseInterviewTrackerCSV, mergeInterviewEntries, itvMapOutcomeToFeedback, itvParseImportDate } = require("../app.js");

let failed = 0;
function test(name, fn) {
  try { fn(); console.log("  ✅ PASS:", name); }
  catch (e) { failed++; console.log("  ❌ FAIL:", name, e.message); }
}

const HEADER = "Interview Date,Company Name,Role / Position,Outcome / Feedback,Round / Stage,Email Subject Line,Recruiter Name,HR Contact Number,Interviewer Name,Interviewer LinkedIn,Questions Asked,Notes,Verification";

test("maps free-text outcomes to the four tracker feedback values", () => {
  assert.strictEqual(itvMapOutcomeToFeedback("Completed (Rejected)"), "Negative");
  assert.strictEqual(itvMapOutcomeToFeedback("Completed (Not Selected / Rejected after Client Discussion)"), "Negative");
  assert.strictEqual(itvMapOutcomeToFeedback("No Show / Candidate Did Not Attend (Removed from Process)"), "Negative");
  assert.strictEqual(itvMapOutcomeToFeedback("Selected / Joined HashedIn"), "Positive");
  assert.strictEqual(itvMapOutcomeToFeedback("Completed (Round 1 Cleared; Moved to Round 2)"), "Positive");
  assert.strictEqual(itvMapOutcomeToFeedback("Offer Received"), "Positive");
  assert.strictEqual(itvMapOutcomeToFeedback("Cancelled by Candidate (Client Meeting Conflict)"), "Hold");
  assert.strictEqual(itvMapOutcomeToFeedback("Cancelled / Reschedule Requested"), "Hold");
  assert.strictEqual(itvMapOutcomeToFeedback("Assessment Invited"), "Pending");
  assert.strictEqual(itvMapOutcomeToFeedback("Completed"), "Pending");
  assert.strictEqual(itvMapOutcomeToFeedback(""), "Pending");
});

test("parses day-first and ISO dates, rejects junk", () => {
  assert.strictEqual(itvParseImportDate("17/03/2022"), "2022-03-17");
  assert.strictEqual(itvParseImportDate("7-1-2021"), "2021-01-07");
  assert.strictEqual(itvParseImportDate("2026-10-08"), "2026-10-08");
  assert.strictEqual(itvParseImportDate("31/13/2022"), "");
  assert.strictEqual(itvParseImportDate("tomorrow"), "");
});

test("imports rows, turns NA into empty cells and keeps outcome detail in notes", () => {
  const csv = `﻿${HEADER}\n` +
    `17/03/2022,ExampleCorp,GCP Infrastructure Engineer,"Cancelled by Candidate (Client Meeting Conflict)",Round 1 - Technical,Interview Prafful,Jane Recruiter,NA,NA,NA,NA,"Slot 12:30, moved",✅ Verified\n` +
    `08/10/2026,Capgemini,"K8s, Terraform DevOps",Completed,Round 1,NA,NA,NA,"Balaji, Krishnendu",NA,NA,NA,NA\n`;
  const { entries, skipped, error } = parseInterviewTrackerCSV(csv);
  assert.strictEqual(error, "");
  assert.strictEqual(skipped, 0);
  assert.strictEqual(entries.length, 2);
  assert.strictEqual(entries[0].date, "2022-03-17");
  assert.strictEqual(entries[0].feedback, "Hold");
  assert.strictEqual(entries[0].hrContact, "");
  assert.strictEqual(entries[0].recruiter, "Jane Recruiter");
  assert.ok(entries[0].notes.includes("Outcome: Cancelled by Candidate"));
  assert.ok(entries[0].notes.includes("Slot 12:30, moved"));
  assert.ok(entries[0].notes.includes("Source check: ✅ Verified"));
  assert.strictEqual(entries[1].role, "K8s, Terraform DevOps", "quoted commas stay inside one cell");
  assert.strictEqual(entries[1].interviewer, "Balaji, Krishnendu");
});

test("skips unreadable rows and reports a clear error for unknown files", () => {
  const bad = parseInterviewTrackerCSV(`${HEADER}\nnot-a-date,Acme,,Completed,,,,,,,,,\n`);
  assert.strictEqual(bad.entries.length, 0);
  assert.strictEqual(bad.skipped, 1);
  assert.ok(parseInterviewTrackerCSV("a,b,c\n1,2,3\n").error.length > 0);
});

test("merge adds only new entries (same date + company + round counts as a duplicate)", () => {
  const existing = [{ id: "itv-1", date: "2022-03-17", company: "ExampleCorp", round: "Round 1 - Technical" }];
  const incoming = [
    { date: "2022-03-17", company: "EXAMPLECORP", round: "round 1 - technical" },
    { date: "2022-03-18", company: "ExampleCorp", round: "Round 2" },
    { date: "2022-03-18", company: "ExampleCorp", round: "Round 2" }
  ];
  const { added, duplicates } = mergeInterviewEntries(existing, incoming);
  assert.strictEqual(added.length, 1);
  assert.strictEqual(duplicates, 2);
  assert.ok(added[0].id.startsWith("itv-"));
});

if (failed > 0) process.exit(1);
console.log("🎉 ALL INTERVIEW IMPORT TESTS PASSED");
