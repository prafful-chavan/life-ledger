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

test("Gold is included in calculatePortfolio1DayChange alongside MF, Indian Stocks, and US Stocks", () => {
  const { calculatePortfolio1DayChange, state } = require("../app.js");

  state.mutualFunds = [
    { fundName: "Test Fund", owner: "Me", latestNav: 110, prevNav: 100, units: 100, isin: "INF123" }
  ];
  state.stocks = [
    { symbol: "TCS", quantity: 10, currentPrice: 3500, prevClose: 3450 }
  ];
  state.usstocks = [
    { symbol: "AAPL", quantity: 5, currentPrice: 200, prevClose: 190 }
  ];
  state.goldPrice = {
    price24k: 15000,
    price22k: 13750,
    prevClose24k: 14800,
    prevClose22k: 13600
  };
  state.gold = [
    { weightGrams: 10, carat: "22K" },
    { weightGrams: 5, carat: "24K" }
  ];

  const result = calculatePortfolio1DayChange();
  assert.ok(result.hasData, "hasData should be true");
  assert.ok(result.totalPortfolioValueINR > 0);
  assert.ok(result.total1DayChangeINR > 0);

  // MF day change: 100 * (110 - 100) = 1,000 INR
  // Indian Stocks day change: 10 * (3500 - 3450) = 500 INR
  // US Stocks day change: 5 * (200 - 190) * USD/INR (fallback 96.7 when no live rate cached) = 4,835 INR
  // Gold 22K day change: 10 * (13750 - 13600) = 1,500 INR
  // Gold 24K day change: 5 * (15000 - 14800) = 1,000 INR
  // Expected Total Day Change: 1000 + 500 + 4225 + 1500 + 1000 = 8,835 INR
  const expectedTotalChange = 1000 + 500 + 4835 + 1500 + 1000;
  assert.strictEqual(Math.round(result.total1DayChangeINR), expectedTotalChange);
});

test("Gold intraday price movement correctly calculates day change for 24K, 22K, and 18K assets", () => {
  const { calculatePortfolio1DayChange, state } = require("../app.js");

  state.mutualFunds = [];
  state.stocks = [];
  state.usstocks = [];
  state.goldPrice = {
    price24k: 15000,
    price22k: 13750,
    prevClose24k: 14800,
    prevClose22k: 13600
  };
  state.gold = [
    { weightGrams: 20, carat: "22K" }
  ];

  const result = calculatePortfolio1DayChange();
  assert.ok(result.hasData);
  // 20g * (13750 - 13600) = 3,000 INR
  assert.strictEqual(Math.round(result.total1DayChangeINR), 3000);
  assert.strictEqual(Math.round(result.totalPortfolioValueINR), 20 * 13750);
});

test("Wipe all previous snapshots and initialize fresh snapshot for today", () => {
  const { recordDailyNetWorthSnapshot, state } = require("../app.js");

  state.netWorthHistory = [
    { id: "nwh-old-1", date: "2026-10-01", netWorth: 1000000 },
    { id: "nwh-old-2", date: "2026-10-02", netWorth: 1050000 }
  ];

  // User requested: wipe previous snapshots and start fresh today
  state.netWorthHistory = [];
  const freshSnap = recordDailyNetWorthSnapshot({ source: "fresh-today" });

  assert.strictEqual(state.netWorthHistory.length, 1);
  assert.strictEqual(state.netWorthHistory[0].source, "fresh-today");
  assert.strictEqual(freshSnap.id, state.netWorthHistory[0].id);
  assert.ok(freshSnap.totalAssets > 0);
  assert.ok(freshSnap.gold !== undefined);
});

test("US stock holdings are converted from USD to INR in net worth totals", () => {
  const { calcUsStockTotalValueINR, getUsdInrRate, state } = require("../app.js");
  state.usstocks = [
    { symbol: "VOO", quantity: 2, currentPrice: 500, avgPrice: 480 }
  ];
  const rate = getUsdInrRate();
  assert.ok(rate > 50 && rate < 200, "USD/INR rate should be sane");
  assert.strictEqual(Math.round(calcUsStockTotalValueINR()), Math.round(2 * 500 * rate));
});

test("settlement rules: each asset class locks only after its own close", () => {
  const { isNetWorthClassSettled, prevBusinessDayISO } = require("../app.js");
  const ist = (iso) => new Date(`${iso}+05:30`).getTime();
  // Indian stocks (Mon 12 Oct 2026): 11:00 live, 16:00 settled; Saturday any time settled
  assert.strictEqual(isNetWorthClassSettled("stocks", ist("2026-10-12T11:00:00"), "2026-10-12"), false);
  assert.strictEqual(isNetWorthClassSettled("stocks", ist("2026-10-12T16:00:00"), "2026-10-12"), true);
  assert.strictEqual(isNetWorthClassSettled("stocks", ist("2026-10-10T11:00:00"), "2026-10-10"), true);
  // A price fetched on a previous day never settles today
  assert.strictEqual(isNetWorthClassSettled("stocks", ist("2026-10-09T16:00:00"), "2026-10-12"), false);
  // Gold: settles from 18:00 IST
  assert.strictEqual(isNetWorthClassSettled("gold", ist("2026-10-12T17:59:00"), "2026-10-12"), false);
  assert.strictEqual(isNetWorthClassSettled("gold", ist("2026-10-12T18:00:00"), "2026-10-12"), true);
  // US stocks: 10:00 IST = 00:30 ET (closed) settled; 22:00 IST = 12:30 ET (open) live
  assert.strictEqual(isNetWorthClassSettled("usStocks", ist("2026-10-12T10:00:00"), "2026-10-12"), true);
  assert.strictEqual(isNetWorthClassSettled("usStocks", ist("2026-10-12T22:00:00"), "2026-10-12"), false);
  // Mutual funds: NAV must be dated at least the previous business day
  assert.strictEqual(prevBusinessDayISO("2026-10-12"), "2026-10-09");
  assert.strictEqual(isNetWorthClassSettled("mutualFunds", ist("2026-10-12T09:00:00"), "2026-10-12", "2026-10-09"), true);
  assert.strictEqual(isNetWorthClassSettled("mutualFunds", ist("2026-10-13T09:00:00"), "2026-10-13", "2026-10-09"), false);
});

test("1-day change counts net holdings only (sold lots excluded)", () => {
  const { calculatePortfolio1DayChange, state } = require("../app.js");
  state.mutualFunds = [];
  state.gold = [];
  state.usstocks = [];
  state.stocks = [
    { symbol: "TCS", owner: "Me", demat: "Z", transactionType: "BUY", quantity: 10, avgPrice: 3000, invested: 30000, purchaseDate: "2026-01-01", currentPrice: 3500, prevClose: 3450 },
    { symbol: "TCS", owner: "Me", demat: "Z", transactionType: "SELL", quantity: 4, avgPrice: 3400, invested: 13600, purchaseDate: "2026-02-01", currentPrice: 3500, prevClose: 3450 },
    { symbol: "INFY", owner: "Me", demat: "Z", transactionType: "BUY", quantity: 5, avgPrice: 1500, invested: 7500, purchaseDate: "2026-01-01", currentPrice: 1600, prevClose: 1600 },
    { symbol: "INFY", owner: "Me", demat: "Z", transactionType: "SELL", quantity: 5, avgPrice: 1600, invested: 8000, purchaseDate: "2026-03-01", currentPrice: 1600, prevClose: 1600 }
  ];
  const r = calculatePortfolio1DayChange();
  // TCS net 6 shares: 6 * (3500 - 3450) = 300; INFY fully sold: contributes nothing
  assert.strictEqual(Math.round(r.classes.stocks.change), 300);
  assert.strictEqual(Math.round(r.classes.stocks.value), 6 * 3500);
});

test("daily snapshot locks a settled class and never mixes in cash flows", () => {
  const { recordDailyNetWorthSnapshot, istTodayISO, state } = require("../app.js");
  const today = istTodayISO();
  state.mutualFunds = [];
  state.gold = [];
  state.usstocks = [];
  state.fd = [];
  state.epf = [];
  state.liabilities = [];
  state.stocks = [
    { symbol: "TCS", owner: "Me", demat: "Z", transactionType: "BUY", quantity: 10, avgPrice: 3000, invested: 30000, purchaseDate: "2026-01-01", currentPrice: 3600, prevClose: 3500 }
  ];
  state.netWorthHistory = [
    { id: "nwh-locked", date: today, timestamp: new Date().toISOString(), netWorth: 1, totalAssets: 1,
      stocks: 33000, changes: { stocks: 500 }, settled: { stocks: true }, asOf: { stocks: "x" }, source: "settle" },
    { id: "nwh-old", date: "2000-01-01", netWorth: 5, totalAssets: 5, stocks: 5 }
  ];
  const snap = recordDailyNetWorthSnapshot({ source: "test" });
  assert.strictEqual(snap.id, "nwh-locked");
  assert.strictEqual(snap.stocks, 33000, "settled class keeps its locked value");
  assert.strictEqual(snap.changes.stocks, 500, "settled class keeps its locked gain/loss");
  assert.strictEqual(snap.dayChange, 500, "day change is market gain/loss only");
  assert.strictEqual(snap.settled.stocks, true);
  assert.strictEqual(snap.settled.mutualFunds, true, "class with no holdings counts as settled");
  assert.strictEqual(snap.netWorth, 33000);
  // older days are never touched
  assert.strictEqual(state.netWorthHistory.find(e => e.id === "nwh-old").netWorth, 5);
});

test("backend ledger rebuilds a missed day using each class's close and holdings owned that day", () => {
  const { buildNetWorthEntryFromLedger } = require("../app.js");
  const ist = (t) => new Date(`2026-10-12T${t}+05:30`).toISOString();
  const st = {
    stocks: [
      { symbol: "TCS", owner: "Me", demat: "Z", transactionType: "BUY", quantity: 10, avgPrice: 3000, invested: 30000, purchaseDate: "2026-01-01" },
      { symbol: "TCS", owner: "Me", demat: "Z", transactionType: "BUY", quantity: 5, avgPrice: 3300, invested: 16500, purchaseDate: "2026-10-13" }
    ],
    usstocks: [{ symbol: "AAPL", owner: "Me", demat: "I", transactionType: "BUY", quantity: 2, avgPrice: 150, invested: 300, purchaseDate: "2026-01-01" }],
    mutualFunds: [{ fundName: "Fund X", owner: "Me", schemeCode: 111, units: 100, invested: 4000, purchaseDate: "2026-01-01", transactionType: "PURCHASE" }],
    gold: [{ weightGrams: 10, carat: "22K", purchaseDate: "2026-01-01" }]
  };
  const records = [
    { date: "2026-10-12", ts: ist("02:00:00"), fx: { usdInr: 95 }, stocks: { TCS: { price: 3500, prevClose: 3400 } }, us: { AAPL: { price: 205, prevClose: 190 } }, mf: { "111": { nav: 49, date: "09-10-2026", prevNav: 48 } }, gold: { price24k: 15000, prevClose24k: 15000 } },
    { date: "2026-10-12", ts: ist("08:00:00"), fx: { usdInr: 96 }, stocks: { TCS: { price: 3500, prevClose: 3400 } }, us: { AAPL: { price: 200, prevClose: 190 } }, mf: { "111": { nav: 50, date: "09-10-2026", prevNav: 49 } }, gold: { price24k: 15100, prevClose24k: 15071 } },
    { date: "2026-10-12", ts: ist("20:00:00"), fx: { usdInr: 97 }, stocks: { TCS: { price: 3600, prevClose: 3500 } }, us: { AAPL: { price: 999, prevClose: 1 } }, mf: { "111": { nav: 50, date: "09-10-2026", prevNav: 49 } }, gold: { price24k: 15142, prevClose24k: 15071 } }
  ];
  const e = buildNetWorthEntryFromLedger({ date: "2026-10-12", records, st, baseEntry: { fd: 1000, liabilities: 500 } });
  assert.strictEqual(e.stocks, 36000, "stocks use the post-close record and only the 10 shares owned that day");
  assert.strictEqual(e.changes.stocks, 1000);
  assert.strictEqual(e.usStocks, 2 * 200 * 96, "US uses the market-closed record (08:00 IST) with its own FX");
  assert.strictEqual(e.changes.usStocks, 2 * 10 * 96);
  assert.strictEqual(e.mutualFunds, 5000);
  assert.strictEqual(e.changes.mutualFunds, 100);
  assert.strictEqual(Math.round(e.gold), Math.round(10 * 15142 * 22 / 24));
  assert.strictEqual(e.final, true);
  assert.strictEqual(e.fd, 1000, "non-market assets carry forward");
  assert.strictEqual(e.netWorth, Number((e.totalAssets - 500).toFixed(2)));
  assert.strictEqual(e.source, "backend-ledger");
});

test("backend ledger marks a class unsettled when its close was never captured", () => {
  const { buildNetWorthEntryFromLedger } = require("../app.js");
  const ist = (t) => new Date(`2026-10-12T${t}+05:30`).toISOString();
  const st = { stocks: [{ symbol: "TCS", owner: "Me", demat: "Z", transactionType: "BUY", quantity: 10, avgPrice: 3000, invested: 30000, purchaseDate: "2026-01-01" }], usstocks: [], mutualFunds: [], gold: [] };
  const records = [{ date: "2026-10-12", ts: ist("11:00:00"), stocks: { TCS: { price: 3500, prevClose: 3400 } } }];
  const e = buildNetWorthEntryFromLedger({ date: "2026-10-12", records, st, baseEntry: {} });
  assert.strictEqual(e.settled.stocks, false, "11:00 IST is before the 15:45 close");
  assert.strictEqual(e.final, false);
  assert.strictEqual(buildNetWorthEntryFromLedger({ date: "2026-10-13", records, st, baseEntry: {} }), null, "no records for that day");
});

console.log("==========================================");
console.log(`📊 NET WORTH HISTORY TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("==========================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("🎉 ALL NET WORTH HISTORY TESTS PASSED SUCCESSFULLY!");
}
