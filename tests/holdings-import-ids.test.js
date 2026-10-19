/** The real Sync Holdings parser, run twice on the same sheet: identical ids; and loading drops leftover copies. */
const assert = require("assert");
const XLSX = require("xlsx");
global.XLSX = XLSX;
const app = require("../app.js");
const HI = require("../holdings-integrity.js");
global.window = { LifeLedgerHoldingsIntegrity: HI };           // the browser has this; the bare Node sandbox does not

const wb = XLSX.utils.book_new();
const mf = [
  { "Scheme Name": "Nippon India Small Cap Fund", "Transaction Type": "PURCHASE", "Units": 100, "NAV": 120, "Amount": 12000, "Date": "2024-01-15", "Owner (Me / Wife)": "Me" },
  { "Scheme Name": "Nippon India Small Cap Fund", "Transaction Type": "PURCHASE", "Units": 100, "NAV": 120, "Amount": 12000, "Date": "2024-01-15", "Owner (Me / Wife)": "Me" },   // an identical second lot
  { "Scheme Name": "Parag Parikh Flexi Cap Fund", "Transaction Type": "PURCHASE", "Units": 50, "NAV": 80, "Amount": 4000, "Date": "2024-02-10", "Owner (Me / Wife)": "Wife" },
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mf), "6. Mutual fund of my");
const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

const first = app.parseMasterHoldingsWorkbook(buffer), second = app.parseMasterHoldingsWorkbook(buffer);
assert.strictEqual(first.mutualFunds.length, 3);
assert.deepStrictEqual(second.mutualFunds.map((r) => r.id), first.mutualFunds.map((r) => r.id), "re-importing the same sheet gives the same ids");
assert.ok(first.mutualFunds.every((r) => HI.isStableId(r.id)), "imported rows carry stable ids");
assert.strictEqual(new Set(first.mutualFunds.map((r) => r.id)).size, 3, "the two identical lots stay two separate rows");

// Loading data that also contains legacy-id copies of imported rows drops the copies, and nothing else
const legacyCopy = { ...first.mutualFunds[2], id: "mf-5a01bf6d-1ce4-436a-9ade-ead7df7a752b" };
const manual = { id: "mf-manual-1", fundName: "Manual Fund", owner: "Me", transactionType: "PURCHASE", units: 1, nav: 10, invested: 10, purchaseDate: "2025-01-01", date: "2025-01-01" };
const loaded = app.normalizeData({ mutualFunds: [...first.mutualFunds, legacyCopy, manual], stocks: [], usstocks: [] });
assert.strictEqual(loaded.mutualFunds.length, 4, "3 imported + 1 manual; the legacy copy is gone");
assert.ok(loaded.mutualFunds.some((r) => r.id === "mf-manual-1"), "a manual lot is untouched");
assert.ok(!loaded.mutualFunds.some((r) => r.id === legacyCopy.id));
console.log("holdings-import-ids tests passed");
