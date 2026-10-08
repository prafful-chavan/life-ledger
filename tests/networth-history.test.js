const assert = require("assert");

// Mock / extract functions and test state
function toNumber(val) {
  if (val === null || val === undefined || val === "") return 0;
  const num = Number(val);
  return Number.isNaN(num) ? 0 : num;
}

function normalizeNetWorthHistoryEntry(entry) {
  return {
    id: entry.id || "nwh-test-1",
    date: entry.date || "2026-10-08",
    timestamp: entry.timestamp || new Date().toISOString(),
    netWorth: toNumber(entry.netWorth),
    totalAssets: toNumber(entry.totalAssets),
    totalLiabilities: toNumber(entry.totalLiabilities),
    dayChange: toNumber(entry.dayChange),
    dayChangePct: toNumber(entry.dayChangePct),
    mutualFunds: toNumber(entry.mutualFunds),
    stocks: toNumber(entry.stocks),
    usStocks: toNumber(entry.usStocks),
    gold: toNumber(entry.gold),
    silver: toNumber(entry.silver),
    crypto: toNumber(entry.crypto),
    fd: toNumber(entry.fd),
    epf: toNumber(entry.epf),
    ppf: toNumber(entry.ppf),
    bonds: toNumber(entry.bonds),
    bankSaving: toNumber(entry.bankSaving),
    others: toNumber(entry.others),
    liabilities: toNumber(entry.liabilities),
    source: entry.source || "snapshot"
  };
}

function computeNetWorthBreakdown(state) {
  const mutualFunds = (state.mutualFunds || []).reduce((sum, item) => sum + toNumber(item.value), 0);
  const stocks = (state.stocks || []).reduce((sum, item) => sum + toNumber(item.value), 0);
  const usStocks = (state.usstocks || []).reduce((sum, item) => sum + toNumber(item.value), 0);
  const gold = (state.gold || []).reduce((sum, item) => sum + toNumber(item.value), 0);
  const silver = (state.silver || []).reduce((sum, item) => sum + toNumber(item.value), 0);
  const crypto = (state.crypto || []).reduce((sum, item) => sum + toNumber(item.value), 0);
  const fd = (state.fd || []).reduce((sum, item) => sum + toNumber(item.value), 0);
  const epf = (state.epf || []).reduce((sum, item) => sum + toNumber(item.value), 0);
  const ppf = (state.ppf || []).reduce((sum, item) => sum + toNumber(item.value), 0);
  const bonds = (state.bonds || []).reduce((sum, item) => sum + toNumber(item.value), 0);
  const bankSaving = (state.banksaving || []).reduce((sum, item) => sum + toNumber(item.value), 0);
  const others = (state.others || []).reduce((sum, item) => sum + toNumber(item.value), 0);
  const liabilities = (state.liabilities || []).reduce((sum, item) => sum + toNumber(item.value), 0);

  const totalAssets = Number((mutualFunds + stocks + usStocks + gold + silver + crypto + fd + epf + ppf + bonds + bankSaving + others).toFixed(2));
  const netWorth = Number((totalAssets - liabilities).toFixed(2));

  return {
    mutualFunds,
    stocks,
    usStocks,
    gold,
    silver,
    crypto,
    fd,
    epf,
    ppf,
    bonds,
    bankSaving,
    others,
    liabilities,
    totalAssets,
    netWorth
  };
}

function recordDailyNetWorthSnapshotMock(state, today = "2026-10-08", mockDayChange = null) {
  if (!state.netWorthHistory) state.netWorthHistory = [];

  const breakdown = computeNetWorthBreakdown(state);
  const existingIndex = state.netWorthHistory.findIndex(entry => entry.date === today);

  const previousEntry = state.netWorthHistory
    .filter(entry => entry.date < today)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  let dayChange = 0;
  let dayChangePct = 0;

  if (mockDayChange && mockDayChange.hasData && mockDayChange.total1DayChangeINR !== 0) {
    dayChange = Number(mockDayChange.total1DayChangeINR.toFixed(2));
    dayChangePct = Number(mockDayChange.changePct.toFixed(2));
  } else if (previousEntry && previousEntry.netWorth > 0) {
    dayChange = Number((breakdown.netWorth - previousEntry.netWorth).toFixed(2));
    dayChangePct = Number(((dayChange / previousEntry.netWorth) * 100).toFixed(2));
  }

  const snapshot = {
    id: existingIndex >= 0 ? state.netWorthHistory[existingIndex].id : `nwh-${today}`,
    date: today,
    timestamp: new Date().toISOString(),
    netWorth: breakdown.netWorth,
    totalAssets: breakdown.totalAssets,
    totalLiabilities: breakdown.liabilities,
    dayChange,
    dayChangePct,
    ...breakdown,
    source: "test"
  };

  if (existingIndex >= 0) {
    state.netWorthHistory[existingIndex] = snapshot;
  } else {
    state.netWorthHistory.unshift(snapshot);
  }

  state.netWorthHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
  return snapshot;
}

function generateNetWorthCSVString(history) {
  const headers = [
    "Date",
    "Net Worth (INR)",
    "1-Day Change (INR)",
    "1-Day Change (%)",
    "Total Assets (INR)",
    "Total Liabilities (INR)",
    "Mutual Funds (INR)",
    "Indian Stocks (INR)",
    "US Stocks (INR)",
    "Gold (INR)",
    "Silver (INR)",
    "Crypto (INR)",
    "Fixed Deposits (INR)",
    "EPF (INR)",
    "PPF (INR)",
    "Bonds (INR)",
    "Bank Savings (INR)",
    "Other Assets (INR)",
    "Liabilities (INR)",
    "Source",
    "Timestamp"
  ];

  const rows = history.map(item => [
    item.date,
    (item.netWorth ?? 0).toFixed(2),
    (item.dayChange ?? 0).toFixed(2),
    (item.dayChangePct ?? 0).toFixed(2),
    (item.totalAssets ?? 0).toFixed(2),
    (item.totalLiabilities ?? 0).toFixed(2),
    (item.mutualFunds ?? 0).toFixed(2),
    (item.stocks ?? 0).toFixed(2),
    (item.usStocks ?? 0).toFixed(2),
    (item.gold ?? 0).toFixed(2),
    (item.silver ?? 0).toFixed(2),
    (item.crypto ?? 0).toFixed(2),
    (item.fd ?? 0).toFixed(2),
    (item.epf ?? 0).toFixed(2),
    (item.ppf ?? 0).toFixed(2),
    (item.bonds ?? 0).toFixed(2),
    (item.bankSaving ?? 0).toFixed(2),
    (item.others ?? 0).toFixed(2),
    (item.liabilities ?? 0).toFixed(2),
    item.source || "snapshot",
    item.timestamp || ""
  ]);

  return [
    headers.join(","),
    ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
  ].join("\n");
}

console.log("==========================================");
console.log("🧪 RUNNING NET WORTH HISTORY & TRACKER TESTS");
console.log("==========================================");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`, err);
    failed++;
  }
}

test("Asset & Liability Breakdown Aggregation", () => {
  const mockState = {
    mutualFunds: [{ value: 500000 }],
    stocks: [{ value: 300000 }],
    usstocks: [{ value: 150000 }],
    gold: [{ value: 409624.92 }],
    silver: [{ value: 50000 }],
    crypto: [{ value: 25000 }],
    fd: [{ value: 200000 }],
    epf: [{ value: 450000 }],
    ppf: [{ value: 150000 }],
    bonds: [{ value: 50000 }],
    banksaving: [{ value: 80000 }],
    others: [{ value: 10000 }],
    liabilities: [{ value: 200000 }]
  };

  const breakdown = computeNetWorthBreakdown(mockState);
  const expectedTotalAssets = 500000 + 300000 + 150000 + 409624.92 + 50000 + 25000 + 200000 + 450000 + 150000 + 50000 + 80000 + 10000;
  assert.strictEqual(breakdown.totalAssets, Number(expectedTotalAssets.toFixed(2)));
  assert.strictEqual(breakdown.liabilities, 200000);
  assert.strictEqual(breakdown.netWorth, Number((expectedTotalAssets - 200000).toFixed(2)));
  assert.strictEqual(breakdown.gold, 409624.92);
});

test("Daily Snapshot Creation with Dashboard 1-Day Change synchronization", () => {
  const mockState = {
    mutualFunds: [{ value: 500000 }],
    stocks: [{ value: 300000 }],
    gold: [{ value: 409624.92 }],
    liabilities: [{ value: 100000 }],
    netWorthHistory: []
  };

  const dayChangeMetrics = {
    hasData: true,
    total1DayChangeINR: 14500.50,
    changePct: 1.22
  };

  const snap = recordDailyNetWorthSnapshotMock(mockState, "2026-10-08", dayChangeMetrics);
  assert.strictEqual(snap.date, "2026-10-08");
  assert.strictEqual(snap.dayChange, 14500.50);
  assert.strictEqual(snap.dayChangePct, 1.22);
  assert.strictEqual(snap.totalAssets, 1209624.92);
  assert.strictEqual(snap.netWorth, 1109624.92);
  assert.strictEqual(mockState.netWorthHistory.length, 1);
});

test("Same-Day Refresh Updates existing snapshot instead of duplicating", () => {
  const mockState = {
    mutualFunds: [{ value: 500000 }],
    stocks: [{ value: 300000 }],
    gold: [{ value: 409624.92 }],
    liabilities: [],
    netWorthHistory: []
  };

  // Initial snapshot
  recordDailyNetWorthSnapshotMock(mockState, "2026-10-08", { hasData: true, total1DayChangeINR: 5000, changePct: 0.42 });
  assert.strictEqual(mockState.netWorthHistory.length, 1);
  assert.strictEqual(mockState.netWorthHistory[0].dayChange, 5000);

  // Prices refreshed, value increased by ₹10,000
  mockState.stocks[0].value = 310000;
  recordDailyNetWorthSnapshotMock(mockState, "2026-10-08", { hasData: true, total1DayChangeINR: 15000, changePct: 1.25 });

  // Must still be 1 entry for 2026-10-08 with updated valuation
  assert.strictEqual(mockState.netWorthHistory.length, 1);
  assert.strictEqual(mockState.netWorthHistory[0].stocks, 310000);
  assert.strictEqual(mockState.netWorthHistory[0].dayChange, 15000);
  assert.strictEqual(mockState.netWorthHistory[0].dayChangePct, 1.25);
});

test("Historical Multi-Day Progression and Date Sorting", () => {
  const mockState = {
    mutualFunds: [{ value: 400000 }],
    liabilities: [],
    netWorthHistory: [
      { date: "2026-10-06", netWorth: 380000, totalAssets: 380000, dayChange: 0, dayChangePct: 0 },
      { date: "2026-10-07", netWorth: 390000, totalAssets: 390000, dayChange: 10000, dayChangePct: 2.63 }
    ]
  };

  // Add 8 Oct snapshot
  recordDailyNetWorthSnapshotMock(mockState, "2026-10-08", null);

  assert.strictEqual(mockState.netWorthHistory.length, 3);
  // Must be sorted latest date first (8 Oct -> 7 Oct -> 6 Oct)
  assert.strictEqual(mockState.netWorthHistory[0].date, "2026-10-08");
  assert.strictEqual(mockState.netWorthHistory[1].date, "2026-10-07");
  assert.strictEqual(mockState.netWorthHistory[2].date, "2026-10-06");

  // Since mockDayChange was null, 8 Oct dayChange is diff against 7 Oct (400000 - 390000 = +10000)
  assert.strictEqual(mockState.netWorthHistory[0].dayChange, 10000);
  assert.strictEqual(mockState.netWorthHistory[0].dayChangePct, 2.56);
});

test("CSV Export String Generation with All Assets and Liabilities", () => {
  const history = [
    {
      date: "2026-10-08",
      timestamp: "2026-10-08T18:30:00.000Z",
      netWorth: 2500000.50,
      dayChange: 25000.00,
      dayChangePct: 1.01,
      totalAssets: 2700000.50,
      totalLiabilities: 200000.00,
      mutualFunds: 1000000.00,
      stocks: 800000.00,
      usStocks: 200000.00,
      gold: 409624.92,
      silver: 50000.00,
      crypto: 20000.00,
      fd: 100000.00,
      epf: 50000.00,
      ppf: 30000.00,
      bonds: 20000.00,
      bankSaving: 25000.00,
      others: 5375.58,
      liabilities: 200000.00,
      source: "auto-refresh"
    }
  ];

  const csv = generateNetWorthCSVString(history);
  const lines = csv.trim().split("\n");

  assert.strictEqual(lines.length, 2); // Header + 1 row
  assert.strictEqual(lines[0].includes("Net Worth (INR)"), true);
  assert.strictEqual(lines[0].includes("1-Day Change (INR)"), true);
  assert.strictEqual(lines[0].includes("Mutual Funds (INR)"), true);
  assert.strictEqual(lines[0].includes("Gold (INR)"), true);
  assert.strictEqual(lines[0].includes("Liabilities (INR)"), true);

  // Check row data contains expected numbers
  assert.strictEqual(lines[1].includes('"2026-10-08"'), true);
  assert.strictEqual(lines[1].includes('"2500000.50"'), true);
  assert.strictEqual(lines[1].includes('"25000.00"'), true);
  assert.strictEqual(lines[1].includes('"409624.92"'), true);
  assert.strictEqual(lines[1].includes('"200000.00"'), true);
});

test("Normalization safely sanitizes missing and invalid fields", () => {
  const raw = {
    date: "2026-10-08",
    netWorth: "1500000",
    totalAssets: 1600000,
    totalLiabilities: "100000",
    dayChange: null,
    dayChangePct: undefined,
    gold: "409624.92"
  };

  const normalized = normalizeNetWorthHistoryEntry(raw);
  assert.strictEqual(normalized.netWorth, 1500000);
  assert.strictEqual(normalized.totalLiabilities, 100000);
  assert.strictEqual(normalized.dayChange, 0);
  assert.strictEqual(normalized.dayChangePct, 0);
  assert.strictEqual(normalized.gold, 409624.92);
  assert.strictEqual(typeof normalized.id, "string");
});

console.log("==========================================");
console.log(`📊 NET WORTH HISTORY TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("==========================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("🎉 ALL NET WORTH HISTORY TESTS PASSED SUCCESSFULLY!");
}
