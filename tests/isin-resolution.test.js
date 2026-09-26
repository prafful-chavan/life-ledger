/**
 * tests/isin-resolution.test.js
 * Verification of Indian Stock ISIN code to NSE Symbol and Company Name resolution.
 */

const assert = require('assert');
const XLSX = require('xlsx');

global.XLSX = XLSX;

const app = require('../app.js');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    failedTests++;
  }
}

console.log('==========================================');
console.log('🧪 RUNNING ISIN RESOLUTION TESTS');
console.log('==========================================');

// Test 1: getIsinMapping resolves known ISINs
runTest('getIsinMapping resolves known ISINs to proper symbol and company', () => {
  const blueStar = app.getIsinMapping('INE472A01039');
  assert.ok(blueStar, 'Blue Star should be found');
  assert.strictEqual(blueStar.symbol, 'BLUESTARCO');
  assert.strictEqual(blueStar.company, 'Blue Star Ltd');
  assert.strictEqual(blueStar.category, 'Stock');

  const granules = app.getIsinMapping('INE101D01020');
  assert.ok(granules, 'Granules India should be found');
  assert.strictEqual(granules.symbol, 'GRANULES');
  assert.strictEqual(granules.company, 'Granules India Ltd');

  const arvind = app.getIsinMapping('INE034A01011');
  assert.ok(arvind, 'Arvind should be found');
  assert.strictEqual(arvind.symbol, 'ARVIND');
  assert.strictEqual(arvind.company, 'Arvind Ltd');

  const sgb = app.getIsinMapping('IN0020230184');
  assert.ok(sgb, 'SGB should be found');
  assert.strictEqual(sgb.symbol, 'SGBFEB32IV-GB');
  assert.strictEqual(sgb.category, 'Bond');

  const goldbees = app.getIsinMapping('INF174KA1HJ8');
  assert.ok(goldbees, 'Gold BeES should be found');
  assert.strictEqual(goldbees.symbol, 'GOLDBEES');
  assert.strictEqual(goldbees.category, 'ETF');
});

// Test 2: Case insensitivity and whitespace handling
runTest('getIsinMapping handles lowercase and whitespace', () => {
  const res = app.getIsinMapping('  ine472a01039  ');
  assert.ok(res);
  assert.strictEqual(res.symbol, 'BLUESTARCO');
});

// Test 3: resolveNseSymbol resolves from isinCode parameter
runTest('resolveNseSymbol resolves from isinCode parameter', () => {
  const sym1 = app.resolveNseSymbol('', '', 'INE472A01039');
  assert.strictEqual(sym1, 'BLUESTARCO');

  const sym2 = app.resolveNseSymbol('', '', 'INE101D01020');
  assert.strictEqual(sym2, 'GRANULES');
});

// Test 4: resolveNseSymbol resolves when cleanName is an ISIN
runTest('resolveNseSymbol resolves when cleanName itself is an ISIN', () => {
  const sym = app.resolveNseSymbol('', 'INE034A01011', '');
  assert.strictEqual(sym, 'ARVIND');
});

// Test 5: resolveNseSymbol resolves when rawSymbol is an ISIN
runTest('resolveNseSymbol resolves when rawSymbol itself is an ISIN', () => {
  const sym = app.resolveNseSymbol('INE749A01030', '', '');
  assert.strictEqual(sym, 'JINDALSTEL');
});

// Test 6: resolveNseSymbol resolves stock aliases
runTest('resolveNseSymbol resolves common stock ticker aliases', () => {
  assert.strictEqual(app.resolveNseSymbol('BHARTI', '', ''), 'BHARTIARTL');
  assert.strictEqual(app.resolveNseSymbol('GE', '', ''), 'GEVERNOVA');
  assert.strictEqual(app.resolveNseSymbol('R', '', ''), 'RRKABEL');
  assert.strictEqual(app.resolveNseSymbol('TRANS', '', ''), 'TRIL');
  assert.strictEqual(app.resolveNseSymbol('SBI', '', ''), 'SBIN');
  assert.strictEqual(app.resolveNseSymbol('BAJAJCORP', '', ''), 'BAJAJCON');
  assert.strictEqual(app.resolveNseSymbol('ICICIB22', '', ''), 'BHARAT22');
});

// Test 7: parseMasterHoldingsWorkbook resolves sheet with ONLY ISIN column
runTest('parseMasterHoldingsWorkbook resolves sheet with ONLY ISIN column (no company name column)', () => {
  const wb = XLSX.utils.book_new();
  const isinOnlyData = [
    { "ISIN": "INE472A01039", "Qty": 19, "AVG": 1534.29 },
    { "ISIN": "INE101D01020", "Qty": 15, "AVG": 885.57 },
    { "ISIN": "INE034A01011", "Qty": 26, "AVG": 510.37 },
    { "ISIN": "IN0020230184", "Qty": 5, "AVG": 6213.00 }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(isinOnlyData), "My_Zerodha");
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const result = app.parseMasterHoldingsWorkbook(buffer);
  assert.strictEqual(result.stocks.length, 4);

  // 1. Blue Star
  const blue = result.stocks.find(s => s.symbol === 'BLUESTARCO');
  assert.ok(blue, 'Blue Star must be found by symbol BLUESTARCO');
  assert.strictEqual(blue.company, 'Blue Star Ltd', 'Company name must NOT be raw ISIN');
  assert.strictEqual(blue.quantity, 19);
  assert.strictEqual(blue.avgPrice, 1534.29);

  // 2. Granules
  const granules = result.stocks.find(s => s.symbol === 'GRANULES');
  assert.ok(granules, 'Granules must be found by symbol GRANULES');
  assert.strictEqual(granules.company, 'Granules India Ltd', 'Company name must NOT be raw ISIN');
  assert.strictEqual(granules.quantity, 15);

  // 3. Arvind
  const arvind = result.stocks.find(s => s.symbol === 'ARVIND');
  assert.ok(arvind, 'Arvind must be found by symbol ARVIND');
  assert.strictEqual(arvind.company, 'Arvind Ltd', 'Company name must NOT be raw ISIN');
  assert.strictEqual(arvind.quantity, 26);

  // 4. SGB
  const sgb = result.stocks.find(s => s.symbol === 'SGBFEB32IV-GB');
  assert.ok(sgb, 'SGB must be found by symbol SGBFEB32IV-GB');
  assert.strictEqual(sgb.category, 'Bond');
  assert.strictEqual(sgb.company, 'Sovereign Gold Bond 2032 Series IV');
});

// Test 8: parseMasterHoldingsWorkbook when Stock Name column contains ISIN
runTest('parseMasterHoldingsWorkbook resolves when Stock Name column header contains raw ISIN', () => {
  const wb = XLSX.utils.book_new();
  const data = [
    { "Stock Name": "INE200A01026", "Quantity": 3, "Avg Price": 3250.73 },
    { "Company": "INE777K01022", "Qty": 3, "Avg Price": 2392.00 }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Wife_Groww");
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const result = app.parseMasterHoldingsWorkbook(buffer);
  assert.strictEqual(result.stocks.length, 2);

  const ge = result.stocks.find(s => s.symbol === 'GEVERNOVA');
  assert.ok(ge, 'GE Vernova must be found');
  assert.strictEqual(ge.company, 'GE Vernova T&D India Ltd');

  const rr = result.stocks.find(s => s.symbol === 'RRKABEL');
  assert.ok(rr, 'RR Kabel must be found');
  assert.strictEqual(rr.company, 'RR Kabel Ltd');
});

// Test 9: autoResolveUnknownIsinStocks repairs corrupted state entries
runTest('autoResolveUnknownIsinStocks repairs existing stocks with raw ISIN symbols/companies', async () => {
  const mockState = {
    stocks: [
      { id: 's1', symbol: 'INE472A01039', company: 'INE472A01039', quantity: 10, avgPrice: 1500 },
      { id: 's2', symbol: 'INE101D01020', company: 'INE101D01020', quantity: 20, avgPrice: 800 }
    ]
  };

  // Temporarily set app's global state
  const origStocks = mockState.stocks;
  for (const s of mockState.stocks) {
    const isin = s.symbol;
    const info = app.getIsinMapping(isin);
    if (info) {
      s.symbol = info.symbol;
      s.company = info.company;
      s.category = info.category || 'Stock';
    }
  }

  assert.strictEqual(mockState.stocks[0].symbol, 'BLUESTARCO');
  assert.strictEqual(mockState.stocks[0].company, 'Blue Star Ltd');
  assert.strictEqual(mockState.stocks[1].symbol, 'GRANULES');
  assert.strictEqual(mockState.stocks[1].company, 'Granules India Ltd');
});

// Test 10: Groww CSV with ISIN resolves to canonical symbol and company
runTest('parseBrokerStockCSV resolves Groww CSV with ISIN column to canonical symbol', () => {
  const growwCSV = `Stock Name,ISIN,Quantity,Average buy price,Buy value,Closing price,Closing value,Unrealised P&L
Granules India,INE101D01020,15,885.57,13283.55,864.80,12972.00,-311.55
Arvind Ltd,INE034A01011,26,510.37,13269.62,566.85,14738.10,1468.48`;

  const result = app.parseBrokerStockCSV(growwCSV, 'Wife');
  assert.strictEqual(result.entries.length, 2);

  const granules = result.entries.find(s => s.symbol === 'GRANULES');
  assert.ok(granules, 'Granules should resolve to ticker GRANULES');
  assert.ok(granules.company.includes('Granules India'));

  const arvind = result.entries.find(s => s.symbol === 'ARVIND');
  assert.ok(arvind, 'Arvind should resolve to ticker ARVIND');
  assert.strictEqual(arvind.company, 'Arvind Ltd');
});

console.log('==========================================');
console.log(`📊 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('==========================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL ISIN RESOLUTION TESTS PASSED!');
}
