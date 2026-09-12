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
// Test 6: Pre-loaded Real Portfolio Verification (Upstox, Zerodha, Groww, INDmoney)
// ----------------------------------------------------------------------
runTest('Verify pre-loaded 36 holdings across Upstox, Zerodha, Groww, INDmoney', () => {
  const { defaultStockHoldings } = require('../app.js');
  assert.strictEqual(defaultStockHoldings.length, 36, 'Should contain 36 pre-loaded holdings');

  // Me - Upstox (8 ETFs)
  const upstoxItems = defaultStockHoldings.filter(s => s.demat === 'Upstox');
  assert.strictEqual(upstoxItems.length, 8, 'Upstox should have 8 ETF holdings');
  const upstoxCurrent = upstoxItems.reduce((sum, s) => sum + s.currentValue, 0);
  assert.strictEqual(Math.round(upstoxCurrent), 847881, 'Upstox Current Value should be ₹8,47,881');

  // Me - Zerodha (11 Stocks & Bonds)
  const zerodhaItems = defaultStockHoldings.filter(s => s.demat === 'Zerodha');
  assert.strictEqual(zerodhaItems.length, 11, 'Zerodha should have 11 stock/bond holdings');
  const zerodhaInvested = zerodhaItems.reduce((sum, s) => sum + s.invested, 0);
  const zerodhaCurrent = zerodhaItems.reduce((sum, s) => sum + s.currentValue, 0);
  assert.strictEqual(zerodhaInvested.toFixed(2), '277195.60', 'Zerodha Invested should be ₹2,77,195.60');
  assert.strictEqual(zerodhaCurrent.toFixed(2), '319895.20', 'Zerodha Current Value should be ₹3,19,895.20');

  // Wife - Groww (14 Stocks & ETFs)
  const growwItems = defaultStockHoldings.filter(s => s.demat === 'Groww');
  assert.strictEqual(growwItems.length, 14, 'Groww should have 14 holdings for Wife');
  const growwInvested = growwItems.reduce((sum, s) => sum + s.invested, 0);
  const growwCurrent = growwItems.reduce((sum, s) => sum + s.currentValue, 0);
  assert.strictEqual(Math.round(growwInvested), 320745, 'Groww Invested should be ₹3,20,745');
  assert.strictEqual(Math.round(growwCurrent), 364889, 'Groww Current Value should be ₹3,64,889');

  // Wife - INDmoney (3 ETFs)
  const indmoneyItems = defaultStockHoldings.filter(s => s.demat === 'INDmoney');
  assert.strictEqual(indmoneyItems.length, 3, 'INDmoney should have 3 ETF holdings for Wife');
  const indmoneyInvested = indmoneyItems.reduce((sum, s) => sum + s.invested, 0);
  const indmoneyCurrent = indmoneyItems.reduce((sum, s) => sum + s.currentValue, 0);
  assert.strictEqual(indmoneyInvested.toFixed(2), '119037.68', 'INDmoney Invested should be ₹1,19,037.68');
  assert.strictEqual(indmoneyCurrent.toFixed(2), '140226.82', 'INDmoney Current Value should be ₹1,40,226.82');
});

// ----------------------------------------------------------------------
// Test 7: US Stocks Portfolio Verification (AAPL, T, VOO, META)
// ----------------------------------------------------------------------
runTest('Verify pre-loaded US Stocks holdings (AAPL, T, VOO, META)', () => {
  const { defaultUsStockHoldings, formatUSD } = require('../app.js');
  assert.strictEqual(defaultUsStockHoldings.length, 4, 'Should contain 4 pre-loaded US stock holdings');

  const symbols = defaultUsStockHoldings.map(s => s.symbol);
  assert.deepStrictEqual(symbols, ['AAPL', 'T', 'VOO', 'META']);

  const investedUSD = defaultUsStockHoldings.reduce((sum, s) => sum + s.invested, 0);
  const currentUSD = defaultUsStockHoldings.reduce((sum, s) => sum + s.currentValue, 0);
  
  assert.strictEqual(investedUSD.toFixed(2), '1150.18', 'US Invested Value should be $1,150.18');
  assert.strictEqual(currentUSD.toFixed(2), '1395.83', 'US Current Value should be $1,395.83');
  assert.strictEqual(formatUSD(investedUSD), '$1,150.18', 'formatUSD should format $1,150.18');
});

// ----------------------------------------------------------------------
// Test 8: calcStockCostBasis — FIFO with partial sell
// ----------------------------------------------------------------------
runTest('calcStockCostBasis: FIFO partial sell reduces netQty and cost basis correctly', () => {
  const { calcStockCostBasis } = require('../app.js');

  // Scenario: Buy 10 shares at ₹100 each (invested ₹1000), then sell 4 shares
  // Expected: netQty=6, invested=₹600 (remaining 60% of cost basis)
  const txns = [
    { transactionType: 'BUY',  quantity: 10, avgPrice: 100, invested: 1000, purchaseDate: '2024-01-10' },
    { transactionType: 'SELL', quantity: 4,  avgPrice: 120, invested: 480,  purchaseDate: '2024-06-01' },
  ];
  const result = calcStockCostBasis(txns);
  assert.strictEqual(result.netQty, 6, 'Net qty should be 6 after selling 4 of 10');
  assert.strictEqual(result.invested.toFixed(2), '600.00', 'Remaining cost basis should be ₹600 (60% of 1000)');
  assert.strictEqual(result.avgPrice.toFixed(2), '100.00', 'Avg price should be ₹100');
  assert.strictEqual(result.boughtQty, 10, 'Total bought should be 10');
  assert.strictEqual(result.soldQty, 4, 'Total sold should be 4');
});

// ----------------------------------------------------------------------
// Test 9: calcStockCostBasis — FIFO fully sold position (should show netQty=0)
// ----------------------------------------------------------------------
runTest('calcStockCostBasis: FIFO fully sold position returns netQty=0 (hidden from Holdings)', () => {
  const { calcStockCostBasis } = require('../app.js');

  // Scenario: Buy 5 at ₹200, sell all 5 → fully exited position
  const txns = [
    { transactionType: 'BUY',  quantity: 5, avgPrice: 200, invested: 1000, purchaseDate: '2024-02-01' },
    { transactionType: 'SELL', quantity: 5, avgPrice: 250, invested: 1250, purchaseDate: '2024-09-01' },
  ];
  const result = calcStockCostBasis(txns);
  assert.strictEqual(result.netQty, 0, 'Fully sold position should have netQty=0');
  assert.strictEqual(result.invested, 0, 'Fully sold position should have zero remaining cost basis');
});

// ----------------------------------------------------------------------
// Test 10: calcStockCostBasis — Multi-lot FIFO, sell spans two lots
// ----------------------------------------------------------------------
runTest('calcStockCostBasis: FIFO sell consuming across multiple buy lots', () => {
  const { calcStockCostBasis } = require('../app.js');

  // Lot 1: Buy 5 @ ₹100 = ₹500  (oldest)
  // Lot 2: Buy 5 @ ₹200 = ₹1000 (newer)
  // Sell 7: consume all of lot 1 (5 units) + 2 from lot 2
  // Remaining: 3 units from lot 2 → cost = 3/5 * 1000 = ₹600
  const txns = [
    { transactionType: 'BUY',  quantity: 5, avgPrice: 100, invested: 500,  purchaseDate: '2023-01-01' },
    { transactionType: 'BUY',  quantity: 5, avgPrice: 200, invested: 1000, purchaseDate: '2023-06-01' },
    { transactionType: 'SELL', quantity: 7, avgPrice: 180, invested: 1260, purchaseDate: '2024-01-01' },
  ];
  const result = calcStockCostBasis(txns);
  assert.strictEqual(result.netQty, 3, 'After selling 7 of 10, should have 3 left');
  assert.strictEqual(result.invested.toFixed(2), '600.00', 'Remaining cost = 3/5 of lot2 = 600');
  assert.strictEqual(result.avgPrice.toFixed(2), '200.00', 'Avg cost of remaining units from lot2 = 200');
});

// ----------------------------------------------------------------------
// Test 11: calcStockCostBasis — Upstox "Side=SELL" / Zerodha "trade_type=SELL" variants
// ----------------------------------------------------------------------
runTest('calcStockCostBasis: handles SELL transactionType from Upstox (Side) and Zerodha (trade_type) after parsing', () => {
  const { calcStockCostBasis } = require('../app.js');

  // After parseMasterHoldingsWorkbook maps "Side=SELL" → transactionType="SELL"
  // and "trade_type=BUY" → transactionType="BUY", the FIFO function should handle them identically
  const txns = [
    // Zerodha-sourced BUY (trade_type mapped → transactionType=BUY)
    { transactionType: 'BUY',  quantity: 8, avgPrice: 500, invested: 4000, purchaseDate: '2024-03-01' },
    // Upstox-sourced SELL (Side mapped → transactionType=SELL)
    { transactionType: 'SELL', quantity: 3, avgPrice: 600, invested: 1800, purchaseDate: '2024-07-01' },
  ];
  const result = calcStockCostBasis(txns);
  assert.strictEqual(result.netQty, 5, 'Net qty should be 5 (8 bought - 3 sold)');
  // Remaining = 5/8 of ₹4000 = ₹2500
  assert.strictEqual(result.invested.toFixed(2), '2500.00', 'Remaining cost = 5/8 * 4000 = 2500');
});

// ----------------------------------------------------------------------
// Test 12: calcStockCostBasis — US stocks with fractional quantities
// ----------------------------------------------------------------------
runTest('calcStockCostBasis: handles US stocks with fractional shares (e.g. VOO fractional)', () => {
  const { calcStockCostBasis } = require('../app.js');

  // US stocks: Buy 1.5 shares @ $400 = $600, sell 0.5 → net 1.0 share, cost = 2/3 * 600 = $400
  const txns = [
    { transactionType: 'BUY',  quantity: 1.5, avgPrice: 400, invested: 600, purchaseDate: '2024-04-01' },
    { transactionType: 'SELL', quantity: 0.5, avgPrice: 450, invested: 225, purchaseDate: '2024-08-01' },
  ];
  const result = calcStockCostBasis(txns);
  assert.ok(Math.abs(result.netQty - 1.0) < 0.0001, `Net qty should be 1.0, got ${result.netQty}`);
  assert.ok(Math.abs(result.invested - 400) < 0.01, `Remaining cost should be ~$400, got ${result.invested}`);
  assert.ok(Math.abs(result.avgPrice - 400) < 0.01, `Avg price should be ~$400, got ${result.avgPrice}`);
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
