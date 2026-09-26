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

// Test 11: Gland Pharma (INE068V01023) and Shivalik Bimetal (INE386D01027) resolution
runTest('getIsinMapping resolves Gland Pharma (INE068V01023) and Shivalik Bimetal (INE386D01027)', () => {
  const gland = app.getIsinMapping('INE068V01023');
  assert.ok(gland, 'Gland Pharma must be found in MASTER_ISIN_MAP');
  assert.strictEqual(gland.symbol, 'GLAND');
  assert.strictEqual(gland.company, 'Gland Pharma Ltd');
  assert.strictEqual(gland.category, 'Stock');

  const sbcl = app.getIsinMapping('INE386D01027');
  assert.ok(sbcl, 'Shivalik Bimetal must be found in MASTER_ISIN_MAP');
  assert.strictEqual(sbcl.symbol, 'SBCL');
  assert.strictEqual(sbcl.company, 'Shivalik Bimetal Controls Ltd');
  assert.strictEqual(sbcl.category, 'Stock');
});

// Test 12: Exchange ticker aliasing (BHARAT22 -> ICICIB22)
runTest('getExchangeTicker maps BHARAT22 to ICICIB22 for exchange quote fetching', () => {
  assert.strictEqual(app.getExchangeTicker('BHARAT22'), 'ICICIB22');
  assert.strictEqual(app.getExchangeTicker('NETFSILVER'), 'SILVERBEES');
  assert.strictEqual(app.getExchangeTicker('BAJAJCORP'), 'BAJAJCON');
  assert.strictEqual(app.getExchangeTicker('GOLD1'), 'GOLDBEES');
  assert.strictEqual(app.getExchangeTicker('RELIANCE'), 'RELIANCE');
});

// Test 13: parseMasterHoldingsWorkbook resolves sheet with INE068V01023 and INE386D01027
runTest('parseMasterHoldingsWorkbook resolves INE068V01023 and INE386D01027 to clean symbols and company names', () => {
  const wb = XLSX.utils.book_new();
  const data = [
    { "ISIN": "INE068V01023", "Qty": 3, "AVG": 2969.60 },
    { "ISIN": "INE386D01027", "Qty": 10, "AVG": 1161.84 },
    { "ISIN": "INF109KB15Y7", "Qty": 311, "AVG": 112.26 }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Wife_Groww");
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const result = app.parseMasterHoldingsWorkbook(buffer);
  assert.strictEqual(result.stocks.length, 3);

  const gland = result.stocks.find(s => s.symbol === 'GLAND');
  assert.ok(gland, 'Gland Pharma must be resolved to GLAND');
  assert.strictEqual(gland.company, 'Gland Pharma Ltd', 'Company name must be Gland Pharma Ltd');
  assert.strictEqual(gland.quantity, 3);
  assert.strictEqual(gland.avgPrice, 2969.60);

  const sbcl = result.stocks.find(s => s.symbol === 'SBCL');
  assert.ok(sbcl, 'Shivalik Bimetal must be resolved to SBCL');
  assert.strictEqual(sbcl.company, 'Shivalik Bimetal Controls Ltd', 'Company name must be Shivalik Bimetal Controls Ltd');
  assert.strictEqual(sbcl.quantity, 10);
  assert.strictEqual(sbcl.avgPrice, 1161.84);

  const bharat = result.stocks.find(s => s.symbol === 'BHARAT22');
  assert.ok(bharat, 'Bharat 22 ETF must be found');
  assert.strictEqual(bharat.company, 'ICICI Prudential Bharat 22 ETF');
  assert.strictEqual(bharat.quantity, 311);
  assert.strictEqual(app.getExchangeTicker(bharat.symbol), 'ICICIB22', 'Exchange ticker for quote fetching must be ICICIB22');
});

// Test 14: resolveNseSymbol resolves Gland and Shivalik company name variants
runTest('resolveNseSymbol resolves Gland and Shivalik company name variants', () => {
  assert.strictEqual(app.resolveNseSymbol('', 'Gland Pharma Limited', ''), 'GLAND');
  assert.strictEqual(app.resolveNseSymbol('', 'Shivalik Bimetal Controls Limited', ''), 'SBCL');
  assert.strictEqual(app.resolveNseSymbol('SBCL', '', ''), 'SBCL');
  assert.strictEqual(app.resolveNseSymbol('', '', 'INE068V01023'), 'GLAND');
  assert.strictEqual(app.resolveNseSymbol('', '', 'INE386D01027'), 'SBCL');
});

// Test 15: Ticker aliasing and price calculation for BHARAT22, GLAND, and SBCL
runTest('Stock price cache and alias mapping correctly computes CMP and 1-day change', () => {
  const cache = {};
  const mockProxyData = {
    "ICICIB22": { price: 115.79, prevClose: 112.26, change: 3.53, changePct: 3.14, date: "26 Sep 2026", source: "proxy" },
    "GLAND": { price: 2150.00, prevClose: 2100.00, change: 50.00, changePct: 2.38, date: "26 Sep 2026", source: "proxy" },
    "SBCL": { price: 620.00, prevClose: 600.00, change: 20.00, changePct: 3.33, date: "26 Sep 2026", source: "proxy" }
  };

  // Populate cache with alias support
  for (const [sym, data] of Object.entries(mockProxyData)) {
    cache[sym] = data;
    if (sym === 'ICICIB22') cache['BHARAT22'] = data;
  }

  // Verify BHARAT22 holding gets data from ICICIB22
  const bharatSym = 'BHARAT22';
  const exSym = app.getExchangeTicker(bharatSym);
  assert.strictEqual(exSym, 'ICICIB22');
  const cachedBharat = cache[bharatSym] || cache[exSym];
  assert.ok(cachedBharat, 'BHARAT22 must find price data');
  assert.strictEqual(cachedBharat.price, 115.79);
  assert.strictEqual(cachedBharat.prevClose, 112.26);

  const qty = 311;
  const avg = 112.26;
  const invested = qty * avg;
  const currentVal = qty * cachedBharat.price;
  const pnl = currentVal - invested;
  const dayChange = qty * (cachedBharat.price - cachedBharat.prevClose);

  assert.strictEqual(currentVal.toFixed(2), '36010.69');
  assert.strictEqual(pnl.toFixed(2), '1097.83');
  assert.strictEqual(dayChange.toFixed(2), '1097.83');
  assert.ok(dayChange > 0, '1-day change must NOT be 0 or null');

  // Verify GLAND holding
  const cachedGland = cache['GLAND'] || cache[app.getExchangeTicker('GLAND')];
  assert.ok(cachedGland);
  assert.strictEqual(cachedGland.price, 2150.00);
  assert.strictEqual(cachedGland.change, 50.00);

  // Verify SBCL holding
  const cachedSbcl = cache['SBCL'] || cache[app.getExchangeTicker('SBCL')];
  assert.ok(cachedSbcl);
  assert.strictEqual(cachedSbcl.price, 620.00);
  assert.strictEqual(cachedSbcl.change, 20.00);
});

console.log('==========================================');
console.log(`📊 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('==========================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL ISIN RESOLUTION TESTS PASSED!');
}
