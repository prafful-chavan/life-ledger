/**
 * Stock Importer Unit Tests
 * Run with: node tests/stock-importer.test.js
 */

const assert = require('assert');
const { parseBrokerStockCSV, detectBrokerFromHeaders } = require('../app.js');

console.log("==========================================");
console.log("🧪 RUNNING STOCK IMPORTER UNIT TESTS");
console.log("==========================================");

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    testsFailed++;
  }
}

// ----------------------------------------------------------------------
// Test 1: User Template CSV (LifeLedger CSV Export format with headers containing (₹) or special chars)
// ----------------------------------------------------------------------
runTest('Import LifeLedger/Generic Template CSV with Symbol / Ticker and Avg Buy Price (₹)', () => {
  const csvData = `Owner,Symbol / Ticker,Company Name,Exchange,Category,Quantity,Avg Buy Price (₹),Total Invested (₹),Purchase Date,Broker / Demat,Notes
Me,INFY,Infosys,NSE,Stock,10,1550,15500,01/07/2026,Zerodha,
Me,BANK BEES,BANK BEES,NSE,Stock,3,527.63,1582.89,30/03/26,Upstox,
Wife,TATA MOTORS,Tata Motors Ltd,NSE,Stock,20,600,12000,15/05/2025,Groww,`;

  const result = parseBrokerStockCSV(csvData, 'Me');
  assert.strictEqual(result.entries.length, 3, 'Should parse 3 entries');

  const row1 = result.entries[0];
  assert.strictEqual(row1.symbol, 'INFY');
  assert.strictEqual(row1.company, 'Infosys');
  assert.strictEqual(row1.quantity, 10);
  assert.strictEqual(row1.avgPrice, 1550);
  assert.strictEqual(row1.invested, 15500);
  assert.strictEqual(row1.demat, 'Zerodha');
  assert.strictEqual(row1.owner, 'Me');
  assert.strictEqual(row1.purchaseDate, '2026-07-01');

  const row2 = result.entries[1];
  assert.strictEqual(row2.symbol, 'BANKBEES');
  assert.strictEqual(row2.quantity, 3);
  assert.strictEqual(row2.avgPrice, 527.63);
  assert.strictEqual(row2.invested, 1582.89);
  assert.strictEqual(row2.demat, 'Upstox');
  assert.strictEqual(row2.purchaseDate, '2026-03-30');

  const row3 = result.entries[2];
  assert.strictEqual(row3.symbol, 'TATAMOTORS');
  assert.strictEqual(row3.company, 'Tata Motors Ltd');
  assert.strictEqual(row3.quantity, 20);
  assert.strictEqual(row3.owner, 'Wife');
});

// ----------------------------------------------------------------------
// Test 2: Zerodha Holdings CSV format
// ----------------------------------------------------------------------
runTest('Import Zerodha Holdings CSV format', () => {
  const zerodhaCSV = `Instrument,Qty.,Avg. cost,LTP,Cur. val,P&L,Net chg.,Day chg.
RELIANCE-EQ,15,2450.50,2890.00,43350.00,6592.50,17.93,1.2
TCS-EQ,5,3200.00,3800.00,19000.00,3000.00,18.75,-0.5`;

  const result = parseBrokerStockCSV(zerodhaCSV, 'Me');
  assert.strictEqual(result.broker, 'Zerodha');
  assert.strictEqual(result.entries.length, 2);

  const item1 = result.entries[0];
  assert.strictEqual(item1.symbol, 'RELIANCE');
  assert.strictEqual(item1.quantity, 15);
  assert.strictEqual(item1.avgPrice, 2450.50);
  assert.strictEqual(item1.currentPrice, 2890.00);
  assert.strictEqual(item1.invested, 36757.50);
  assert.strictEqual(item1.currentValue, 43350.00);
  assert.strictEqual(item1.demat, 'Zerodha');
});

// ----------------------------------------------------------------------
// Test 3: Upstox Holdings CSV format
// ----------------------------------------------------------------------
runTest('Import Upstox Holdings CSV format', () => {
  const upstoxCSV = `Symbol,Category,Net Qty,Avg. Price,LTP,Current Value,Day P&L,Day %,Overall P&L,Overall %,Exchange
HDFCBANK,Stock,25,1450.00,1650.00,41250.00,250.00,0.61,5000.00,13.79,NSE
NIFTY BEES,ETF,100,220.00,255.00,25500.00,100.00,0.39,3500.00,15.91,NSE`;

  const result = parseBrokerStockCSV(upstoxCSV, 'Me');
  assert.strictEqual(result.broker, 'Upstox');
  assert.strictEqual(result.entries.length, 2);

  const item1 = result.entries[0];
  assert.strictEqual(item1.symbol, 'HDFCBANK');
  assert.strictEqual(item1.quantity, 25);
  assert.strictEqual(item1.avgPrice, 1450.00);
  assert.strictEqual(item1.currentPrice, 1650.00);
  assert.strictEqual(item1.category, 'Stock');

  const item2 = result.entries[1];
  assert.strictEqual(item2.symbol, 'NIFTYBEES');
  assert.strictEqual(item2.category, 'ETF');
});

// ----------------------------------------------------------------------
// Test 4: Groww Holdings CSV format
// ----------------------------------------------------------------------
runTest('Import Groww Holdings CSV format', () => {
  const growwCSV = `Stock Name,ISIN,Quantity,Average buy price,Buy value,Closing price,Closing value,Unrealised P&L
ITC LTD,INE154A01025,50,410.00,20500.00,465.00,23250.00,2750.00
BHARTI AIRTEL LTD,INE397D01024,12,1100.00,13200.00,1420.00,17040.00,3840.00`;

  const result = parseBrokerStockCSV(growwCSV, 'Wife');
  assert.strictEqual(result.broker, 'Groww');
  assert.strictEqual(result.entries.length, 2);

  const item1 = result.entries[0];
  assert.strictEqual(item1.company, 'ITC LTD');
  assert.strictEqual(item1.symbol, 'ITC');
  assert.strictEqual(item1.quantity, 50);
  assert.strictEqual(item1.avgPrice, 410.00);
  assert.strictEqual(item1.invested, 20500.00);
  assert.strictEqual(item1.owner, 'Wife');
  assert.strictEqual(item1.demat, 'Groww');
});

// ----------------------------------------------------------------------
// Test 5: INDmoney Holdings CSV format
// ----------------------------------------------------------------------
runTest('Import INDmoney Holdings CSV format', () => {
  const indmoneyCSV = `Stock Name,Symbol,Market Price,Invested,Current value
Apple Inc,AAPL,190.00,10 × 170,1900.00
Wipro Ltd,WIPRO,480.00,4800.00,4800.00`;

  const result = parseBrokerStockCSV(indmoneyCSV, 'Wife');
  assert.strictEqual(result.broker, 'INDmoney');
  assert.strictEqual(result.entries.length, 2);

  const item1 = result.entries[0];
  assert.strictEqual(item1.company, 'Apple Inc');
  assert.strictEqual(item1.symbol, 'AAPL');
  assert.strictEqual(item1.quantity, 10);
  assert.strictEqual(item1.avgPrice, 170.00);
  assert.strictEqual(item1.currentPrice, 190.00);
});

// ----------------------------------------------------------------------
// Test 6: Pre-loaded Real Portfolio Verification (Upstox + Zerodha)
// ----------------------------------------------------------------------
runTest('Verify pre-loaded Upstox (8 ETFs) + Zerodha (11 Stocks) holdings', () => {
  const { defaultStockHoldings } = require('../app.js');
  assert.strictEqual(defaultStockHoldings.length, 19, 'Should contain 19 pre-loaded holdings');

  const upstoxItems = defaultStockHoldings.filter(s => s.demat === 'Upstox');
  assert.strictEqual(upstoxItems.length, 8, 'Upstox should have 8 ETF holdings');
  const upstoxInvested = upstoxItems.reduce((sum, s) => sum + s.invested, 0);
  const upstoxCurrent = upstoxItems.reduce((sum, s) => sum + s.currentValue, 0);
  assert.strictEqual(Math.round(upstoxCurrent), 847881, 'Upstox Current Value should be ₹8,47,881');

  const zerodhaItems = defaultStockHoldings.filter(s => s.demat === 'Zerodha');
  assert.strictEqual(zerodhaItems.length, 11, 'Zerodha should have 11 stock/bond holdings');
  const zerodhaInvested = zerodhaItems.reduce((sum, s) => sum + s.invested, 0);
  const zerodhaCurrent = zerodhaItems.reduce((sum, s) => sum + s.currentValue, 0);
  assert.strictEqual(zerodhaInvested.toFixed(2), '277195.60', 'Zerodha Invested should be ₹2,77,195.60');
  assert.strictEqual(zerodhaCurrent.toFixed(2), '319895.20', 'Zerodha Current Value should be ₹3,19,895.20');
});

// ----------------------------------------------------------------------
// Test Summary
// ----------------------------------------------------------------------
console.log("==========================================");
console.log(`📊 TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
console.log("==========================================");

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
}
