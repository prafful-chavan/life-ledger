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
// Test 13: calcStockTotalValue — verify sold positions are excluded from total value
// ----------------------------------------------------------------------
runTest('calcStockTotalValue: excludes fully sold positions and does not count SELL rows towards valuation', () => {
  const { calcStockTotalValue } = require('../app.js');

  const stockList = [
    // Symbol 1: Active holding (Buy 10 @ 100, CMP 150) -> Value = 10 * 150 = 1500
    { symbol: 'INFY', owner: 'Me', demat: 'Zerodha', transactionType: 'BUY', quantity: 10, avgPrice: 100, currentPrice: 150 },
    // Symbol 2: Fully sold holding (Buy 5 @ 200, Sell 5 @ 250, CMP 300) -> Value = 0 (should NOT be 5 * 300)
    { symbol: 'TCS', owner: 'Me', demat: 'Zerodha', transactionType: 'BUY', quantity: 5, avgPrice: 200, currentPrice: 300 },
    { symbol: 'TCS', owner: 'Me', demat: 'Zerodha', transactionType: 'SELL', quantity: 5, avgPrice: 250, currentPrice: 300 },
  ];

  const totalVal = calcStockTotalValue(stockList);
  assert.strictEqual(totalVal, 1500, 'Total valuation should be 1500 (INFY only), fully-sold TCS must be 0');
});

// ----------------------------------------------------------------------
// Test 14: calcStockCostBasis — Realized P&L accuracy on multi-lot sales
// ----------------------------------------------------------------------
runTest('calcStockCostBasis: accurately computes realizedGain from sold shares using FIFO cost', () => {
  const { calcStockCostBasis } = require('../app.js');

  // Lot 1: Buy 10 @ ₹100 = ₹1,000 cost (date 2023-01-01)
  // Lot 2: Buy 10 @ ₹200 = ₹2,000 cost (date 2023-06-01)
  // Sell 12 @ ₹250 = ₹3,000 proceeds (date 2024-01-01)
  // FIFO cost consumed = (10 * 100) + (2 * 200) = 1000 + 400 = ₹1,400
  // Realized gain = ₹3,000 - ₹1,400 = ₹1,600
  // Remaining: 8 shares from lot 2 @ ₹200 = ₹1,600 cost basis
  const txns = [
    { transactionType: 'BUY',  quantity: 10, avgPrice: 100, invested: 1000, purchaseDate: '2023-01-01' },
    { transactionType: 'BUY',  quantity: 10, avgPrice: 200, invested: 2000, purchaseDate: '2023-06-01' },
    { transactionType: 'SELL', quantity: 12, avgPrice: 250, invested: 3000, purchaseDate: '2024-01-01' },
  ];

  const res = calcStockCostBasis(txns);
  assert.strictEqual(res.netQty, 8, 'Remaining netQty should be 8');
  assert.strictEqual(res.invested, 1600, 'Remaining cost basis should be 1600 (8 * 200)');
  assert.strictEqual(res.realizedGain, 1600, 'Realized gain should be 3000 proceeds - 1400 FIFO cost = 1600');
});

// ----------------------------------------------------------------------
// Test 15: Mutual Fund Tab Name Matching (6. Mutual fund of my / 7. mutual fund of my wife)
// ----------------------------------------------------------------------
runTest('parseMasterHoldingsWorkbook: correctly maps "6. Mutual fund of my" and "7. mutual fund of my wife"', () => {
  const XLSX = require('xlsx');
  global.XLSX = XLSX;
  const app = require('../app.js');

  if (typeof app.parseMasterHoldingsWorkbook !== 'function') return;

  const wb = XLSX.utils.book_new();
  const mfMyData = [
    { "Scheme Name": "Nippon India Small Cap Fund", "Transaction Type": "PURCHASE", "Units": 100, "NAV": 120, "Amount": 12000, "Date": "2024-01-15", "Owner (Me / Wife)": "Me" }
  ];
  const mfWifeData = [
    { "Scheme Name": "Parag Parikh Flexi Cap Fund", "Transaction Type": "PURCHASE", "Units": 50, "NAV": 80, "Amount": 4000, "Date": "2024-02-10", "Owner (Me / Wife)": "Wife" }
  ];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mfMyData), "6. Mutual fund of my");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mfWifeData), "7. mutual fund of my wife");

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const res = app.parseMasterHoldingsWorkbook(buffer);

  assert.strictEqual(res.mutualFunds.length, 2, 'Should parse 2 mutual fund records');
  const myFund = res.mutualFunds.find(f => f.fundName.includes('Nippon'));
  const wifeFund = res.mutualFunds.find(f => f.fundName.includes('Parag'));

  assert.ok(myFund, 'My fund should exist');
  assert.strictEqual(myFund.owner, 'Me', 'My fund owner should be Me');
  assert.ok(wifeFund, 'Wife fund should exist');
  assert.strictEqual(wifeFund.owner, 'Wife', 'Wife fund owner should be Wife');
});

// ----------------------------------------------------------------------
// Test 16: Prevent header text "Owner (Me / Wife)" from misclassifying rows to Wife
// ----------------------------------------------------------------------
runTest('normalizeOwner & matchHoldingsOwner: protects "Owner (Me / Wife)" header string from misclassifying as Wife', () => {
  const { normalizeOwner, matchHoldingsOwner } = require('../app.js');

  assert.strictEqual(normalizeOwner('Owner (Me / Wife)'), 'Me', 'Header text "Owner (Me / Wife)" should normalize to Me');
  assert.strictEqual(normalizeOwner('Me / Wife'), 'Me', 'Header text "Me / Wife" should normalize to Me');
  assert.strictEqual(normalizeOwner('Wife'), 'Wife', '"Wife" should normalize to Wife');
  assert.strictEqual(normalizeOwner('Me'), 'Me', '"Me" should normalize to Me');

  assert.strictEqual(matchHoldingsOwner('Me', 'Me'), true, 'Me owner matches Me filter');
  assert.strictEqual(matchHoldingsOwner('Wife', 'Me'), false, 'Wife owner does not match Me filter');
  assert.strictEqual(matchHoldingsOwner('Me', 'Both'), true, 'Me owner matches Both filter');
  assert.strictEqual(matchHoldingsOwner('Wife', 'Both'), true, 'Wife owner matches Both filter');
});

// ----------------------------------------------------------------------
// Test 17: User Real US Stocks Tab (My_US_Stocks) with Stock Symbol, Holding Since, Quantity, Avg. Price ($), Total Value ($)
// ----------------------------------------------------------------------
runTest('parseMasterHoldingsWorkbook: correctly parses "My_US_Stocks" tab with exact user fractional holdings and dates', () => {
  const XLSX = require('xlsx');
  global.XLSX = XLSX;
  const app = require('../app.js');

  const wb = XLSX.utils.book_new();
  const usStockData = [
    { "Stock Symbol": "META", "Holding Since": "17 Apr 2026, 8:47 PM", "Quantity": "0.154829703", "Avg. Price ($)": "683.3960019", "Total Value ($)": "105.81" },
    { "Stock Symbol": "QQQM", "Holding Since": "24 Aug 2026, 9:48 PM", "Quantity": "0.350314339", "Avg. Price ($)": "292.1376279", "Total Value ($)": "102.34" },
    { "Stock Symbol": "VOO", "Holding Since": "21 May 2026, 1:18 PM", "Quantity": "0.596376748", "Avg. Price ($)": "692.6326343", "Total Value ($)": "413.069998" },
    { "Stock Symbol": "AAPL", "Holding Since": "11 Dec 2023, 10:57 PM", "Quantity": "3.312562802", "Avg. Price ($)": "231.7752299", "Total Value ($)": "767.770005" },
    { "Stock Symbol": "T", "Holding Since": "11 Dec 2023, 11:01 PM", "Quantity": "3.844429144", "Avg. Price ($)": "18.18715013", "Total Value ($)": "69.91921" }
  ];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(usStockData), "My_US_Stocks");

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const res = app.parseMasterHoldingsWorkbook(buffer);

  assert.strictEqual(res.usstocks.length, 5, 'Should parse 5 US stock records');

  const meta = res.usstocks.find(s => s.symbol === 'META');
  assert.ok(meta, 'META should be parsed');
  assert.strictEqual(meta.quantity, 0.154829703, 'META quantity should preserve exact 9-decimal precision');
  assert.strictEqual(meta.avgPrice, 683.3960019, 'META avgPrice should preserve exact precision');
  assert.strictEqual(meta.currentValue, 105.81, 'META currentValue should be 105.81');
  assert.strictEqual(meta.purchaseDate, '2026-04-17', 'META purchase date should be parsed as 2026-04-17');

  const voo = res.usstocks.find(s => s.symbol === 'VOO');
  assert.ok(voo, 'VOO should be parsed');
  assert.strictEqual(voo.category, 'ETF', 'VOO should be tagged as ETF');
});

// ----------------------------------------------------------------------
// Test 18: ISIN & Company Name Ticker Resolution for Groww & NSDL CAS exports
// ----------------------------------------------------------------------
runTest('resolveNseSymbol & parseMasterHoldingsWorkbook: resolves exact NSE tickers via ISIN & full company names', () => {
  const XLSX = require('xlsx');
  global.XLSX = XLSX;
  const app = require('../app.js');

  const wb = XLSX.utils.book_new();
  const growwData = [
    { "Stock Name": "GE VERNOVA T&D INDIA LTD", "ISIN": "INE200A01026", "Quantity": 3, "Average buy price": 3250.73, "Buy value": 9752.19, "Closing price": 4406.50, "Closing value": 13219.50 },
    { "Stock Name": "R R KABEL LIMITED", "ISIN": "INE777K01022", "Quantity": 3, "Average buy price": 2392.00, "Buy value": 7176.00, "Closing price": 2789.60, "Closing value": 8368.80 },
    { "Stock Name": "TRANS & RECTI. LTD", "ISIN": "INE763I01026", "Quantity": 5, "Average buy price": 650.00, "Buy value": 3250.00, "Closing price": 720.00, "Closing value": 3600.00 },
    { "Stock Name": "BAJAJ CONSUMER CARE LTD", "ISIN": "INE933K01021", "Quantity": 10, "Average buy price": 210.00, "Buy value": 2100.00, "Closing price": 240.00, "Closing value": 2400.00 },
  ];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(growwData), "Wife_Groww");

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const res = app.parseMasterHoldingsWorkbook(buffer);

  assert.strictEqual(res.stocks.length, 4, 'Should parse 4 Groww stock records');

  const ge = res.stocks.find(s => s.company.includes('GE VERNOVA'));
  assert.ok(ge, 'GE Vernova should exist');
  assert.strictEqual(ge.symbol, 'GEVERNOVA', 'ISIN INE200A01026 should resolve symbol to GEVERNOVA');

  const rr = res.stocks.find(s => s.company.includes('R R KABEL'));
  assert.ok(rr, 'RR Kabel should exist');
  assert.strictEqual(rr.symbol, 'RRKABEL', 'ISIN INE777K01022 should resolve symbol to RRKABEL');

  const tril = res.stocks.find(s => s.company.includes('TRANS & RECTI'));
  assert.ok(tril, 'Transformers & Rectifiers should exist');
  assert.strictEqual(tril.symbol, 'TRIL', 'ISIN INE763I01026 should resolve symbol to TRIL');

  const bajaj = res.stocks.find(s => s.company.includes('BAJAJ CONSUMER'));
  assert.ok(bajaj, 'Bajaj Consumer should exist');
  assert.strictEqual(bajaj.symbol, 'BAJAJCON', 'ISIN INE933K01021 should resolve symbol to BAJAJCON');
});

// ----------------------------------------------------------------------
// Test 19: Minimal 3-Column Stock Sheet Parsing (Stock Name/ISIN | Quantity | Avg Price)
// ----------------------------------------------------------------------
runTest('parseMasterHoldingsWorkbook: parses minimal 3-column stock sheet and auto-generates all metrics', () => {
  const XLSX = require('xlsx');
  global.XLSX = XLSX;
  const app = require('../app.js');

  const wb = XLSX.utils.book_new();
  const minimalStockData = [
    { "Stock Name": "AEGIS LOGISTICS LIMITED", "Quantity": 10, "Avg Price": 450.50 },
    { "ISIN": "INE200A01026", "Quantity": 3, "Avg Price": 3250.73 },
    { "Stock Name": "NIFTY BEES", "Quantity": 100, "Avg Price": 220.00 }
  ];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(minimalStockData), "My_Zerodha");

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const res = app.parseMasterHoldingsWorkbook(buffer);

  assert.strictEqual(res.stocks.length, 3, 'Should parse 3 minimal stock records');

  const aegis = res.stocks.find(s => s.symbol === 'AEGISLOG');
  assert.ok(aegis, 'AEGISLOG should be resolved from company name');
  assert.strictEqual(aegis.quantity, 10);
  assert.strictEqual(aegis.avgPrice, 450.50);
  assert.strictEqual(aegis.invested, 4505.00);

  const ge = res.stocks.find(s => s.symbol === 'GEVERNOVA');
  assert.ok(ge, 'GEVERNOVA should be resolved from ISIN INE200A01026');
  assert.strictEqual(ge.quantity, 3);
  assert.strictEqual(ge.invested, 9752.19);
});

// ----------------------------------------------------------------------
// Test 20: User Master ISIN & Quantity Scheme Verification
// ----------------------------------------------------------------------
runTest('parseMasterHoldingsWorkbook: parses user exact ISIN + Qty + AVG master tables accurately', () => {
  const XLSX = require('xlsx');
  global.XLSX = XLSX;
  const app = require('../app.js');

  const wb = XLSX.utils.book_new();

  // Tab 1: upstock
  const upstockData = [
    { "ISIN": "INF174KA1HJ8", "Qty": "1,523", "AVG": "80.21" },
    { "ISIN": "INF247L01AP3", "Qty": "441", "AVG": "193.28" },
    { "ISIN": "INF204KB15V2", "Qty": "3,262", "AVG": "39.45" },
    { "ISIN": "INF179KC1FB2", "Qty": "464", "AVG": "170.49" },
    { "ISIN": "INF179KC1HT0", "Qty": "1,678", "AVG": "21.12" },
    { "ISIN": "INF204KB14I2", "Qty": "569", "AVG": "264.94" },
    { "ISIN": "INF204KB1V68", "Qty": "221", "AVG": "217.54" },
    { "ISIN": "INF204KB15I9", "Qty": "149", "AVG": "543.48" }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(upstockData), "upstock");

  // Tab 2: my-zerodha
  const zerodhaData = [
    { "ISIN": "INE472A01039", "Qty": "19", "AVG": "1534.29" },
    { "ISIN": "INE188A01015", "Qty": "37", "AVG": "855.23" },
    { "ISIN": "INE176B01034", "Qty": "13", "AVG": "1533.61" },
    { "ISIN": "INE749A01030", "Qty": "19", "AVG": "753.02" },
    { "ISIN": "INE101A01026", "Qty": "11", "AVG": "2441.3" },
    { "ISIN": "INE134E01011", "Qty": "60", "AVG": "401.31" },
    { "ISIN": "INE811K01011", "Qty": "10", "AVG": "1667.95" },
    { "ISIN": "INE020B01018", "Qty": "70", "AVG": "438.62" },
    { "ISIN": "INE200M01039", "Qty": "56", "AVG": "506.77" },
    { "ISIN": "INE075A01022", "Qty": "93", "AVG": "262.32" }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(zerodhaData), "my-zerodha");

  // Tab 3: wife groww
  const growwData = [
    { "ISIN": "INE208C01025", "Qty": "7", "AVG": "1297" },
    { "ISIN": "INE933K01021", "Qty": "30", "AVG": "517.4" },
    { "ISIN": "INE200A01026", "Qty": "3", "AVG": "3250.73" },
    { "ISIN": "INE038A01020", "Qty": "9", "AVG": "1043.7" },
    { "ISIN": "INE0J5401028", "Qty": "28", "AVG": "366.47" },
    { "ISIN": "INE947Q01028", "Qty": "6", "AVG": "1653.2" },
    { "ISIN": "INE745G01043", "Qty": "3", "AVG": "3005" },
    { "ISIN": "INF204KB17I5", "Qty": "840", "AVG": "90.47" },
    { "ISIN": "INF204KB1V68", "Qty": "18", "AVG": "206.6" },
    { "ISIN": "INF204KB14I2", "Qty": "490", "AVG": "263.67" },
    { "ISIN": "INF204KC1402", "Qty": "50", "AVG": "240.24" },
    { "ISIN": "INE777K01022", "Qty": "3", "AVG": "2392" },
    { "ISIN": "INE0CLI01024", "Qty": "14", "AVG": "962.15" },
    { "ISIN": "INE763I01026", "Qty": "14", "AVG": "534.41" }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(growwData), "wife groww");

  // Tab 4: wife indmoney
  const indData = [
    { "ISIN": "INF109KB15Y7", "Qty": "311", "AVG": "112.26" },
    { "ISIN": "INF247L01AP3", "Qty": "200", "AVG": "221.8" },
    { "ISIN": "INF179KC1FB2", "Qty": "239", "AVG": "166.38" }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(indData), "wife indmoney");

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const res = app.parseMasterHoldingsWorkbook(buffer);

  assert.strictEqual(res.stocks.length, 35, 'Should parse all 35 Indian stock holdings across 4 tabs');

  const blue = res.stocks.find(s => s.symbol === 'BLUESTARCO');
  assert.ok(blue, 'Blue Star should exist from ISIN INE472A01039');
  assert.strictEqual(blue.quantity, 19);
  assert.strictEqual(blue.avgPrice, 1534.29);
  assert.strictEqual(blue.company, 'Blue Star Ltd');

  const ge = res.stocks.find(s => s.symbol === 'GEVERNOVA');
  assert.ok(ge, 'GE Vernova should exist from ISIN INE200A01026');
  assert.strictEqual(ge.company, 'GE Vernova T&D India Ltd');

  const bharat = res.stocks.find(s => s.symbol === 'BHARAT22');
  assert.ok(bharat, 'Bharat 22 ETF should exist from ISIN INF109KB15Y7');
  assert.strictEqual(bharat.company, 'ICICI Prudential Bharat 22 ETF');
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
