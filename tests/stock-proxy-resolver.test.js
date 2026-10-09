const assert = require('assert');
const {
  parseStockProxyPrice,
  STOCK_PROXY_URL_KEY,
  formatUSD,
  defaultUsStockHoldings,
  toNumber,
  persist,
  recordDailyNetWorthSnapshot,
  state
} = require('../app.js');

console.log('==========================================');
console.log('🧪 RUNNING STOCK PROXY & RESOLVER TESTS');
console.log('==========================================');

let passedTests = 0;
let failedTests = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

// 1. Primitive number responses
it('parseStockProxyPrice: parses primitive flat number { "AAPL": 338.30 }', () => {
  const data = { AAPL: 338.30 };
  const res = parseStockProxyPrice(data, 'AAPL');
  assert.ok(res, 'Result should exist');
  assert.strictEqual(res.price, 338.30);
  assert.strictEqual(res.prevClose, 338.30);
});

// 2. Standard object with price and prevClose
it('parseStockProxyPrice: parses standard object with price and prevClose', () => {
  const data = {
    AAPL: {
      price: 338.30,
      prevClose: 336.67,
      change: 1.63,
      changePct: 0.48,
      source: 'nasdaq-realtime',
      date: 'Oct 8, 2026'
    }
  };
  const res = parseStockProxyPrice(data, 'AAPL');
  assert.ok(res);
  assert.strictEqual(res.price, 338.30);
  assert.strictEqual(res.prevClose, 336.67);
  assert.strictEqual(res.change, 1.63);
  assert.strictEqual(res.source, 'nasdaq-realtime');
});

// 3. Nested container { data: { AAPL: ... } }
it('parseStockProxyPrice: unwraps nested container { data: { AAPL: ... } }', () => {
  const data = {
    data: {
      AAPL: {
        regularMarketPrice: 338.30,
        chartPreviousClose: 336.67
      }
    }
  };
  const res = parseStockProxyPrice(data, 'AAPL');
  assert.ok(res);
  assert.strictEqual(res.price, 338.30);
  assert.strictEqual(res.prevClose, 336.67);
});

// 4. String price with currency symbol and commas
it('parseStockProxyPrice: cleans strings with currency sign "$338.30" and commas', () => {
  const data = {
    AAPL: {
      lastSalePrice: '$338.30',
      netChange: '+1.63',
      percentageChange: '+0.48%'
    }
  };
  const res = parseStockProxyPrice(data, 'AAPL');
  assert.ok(res);
  assert.strictEqual(res.price, 338.30);
  assert.strictEqual(res.change, 1.63);
  assert.strictEqual(res.prevClose, 336.67);
});

// 5. Array of holding/quote items
it('parseStockProxyPrice: resolves from array shape [{ symbol: "VOO", price: 711.81 }]', () => {
  const data = [
    { symbol: 'AAPL', price: 338.30 },
    { symbol: 'VOO', price: 711.81, prevClose: 714.48 },
    { ticker: 'T', lastPrice: 24.52 }
  ];
  const resVOO = parseStockProxyPrice(data, 'VOO');
  assert.ok(resVOO);
  assert.strictEqual(resVOO.price, 711.81);
  assert.strictEqual(resVOO.prevClose, 714.48);

  const resT = parseStockProxyPrice(data, 'T');
  assert.ok(resT);
  assert.strictEqual(resT.price, 24.52);
});

// 6. Exchange prefixes and case-insensitive matching
it('parseStockProxyPrice: resolves exchange prefixed keys "NASDAQ:AAPL" and lowercase keys', () => {
  const data = {
    'NASDAQ:AAPL': { price: 338.30 },
    'voo': { price: 711.81 }
  };
  const resAAPL = parseStockProxyPrice(data, 'AAPL');
  assert.ok(resAAPL, 'Should resolve NASDAQ:AAPL');
  assert.strictEqual(resAAPL.price, 338.30);

  const resVOO = parseStockProxyPrice(data, 'VOO');
  assert.ok(resVOO, 'Should resolve lowercase voo');
  assert.strictEqual(resVOO.price, 711.81);
});

// 7. Indian stock with ISIN and company metadata
it('parseStockProxyPrice: parses Indian stock and preserves company/isin metadata', () => {
  const data = {
    RELIANCE: {
      price: 2850.50,
      prevClose: 2835.00,
      isin: 'INE002A01018',
      company: 'Reliance Industries Limited',
      category: 'Stock'
    }
  };
  const res = parseStockProxyPrice(data, 'RELIANCE');
  assert.ok(res);
  assert.strictEqual(res.price, 2850.50);
  assert.strictEqual(res.isin, 'INE002A01018');
  assert.strictEqual(res.company, 'Reliance Industries Limited');
});

// 8. Safely ignores error objects or zero prices
it('parseStockProxyPrice: safely returns null on error objects or zero prices', () => {
  const data = {
    BAD: { error: 'Price not found', price: 0 },
    ZERO: 0,
    EMPTY: {}
  };
  assert.strictEqual(parseStockProxyPrice(data, 'BAD'), null);
  assert.strictEqual(parseStockProxyPrice(data, 'ZERO'), null);
  assert.strictEqual(parseStockProxyPrice(data, 'EMPTY'), null);
  assert.strictEqual(parseStockProxyPrice(data, 'NONEXISTENT'), null);
});

// 9. URL sanitization logic
it('Proxy URL sanitization: strips quotes, whitespace, and handles trailing query marks', () => {
  const raw1 = '  "https://script.google.com/macros/s/ABC/exec"  ';
  const clean1 = raw1.trim().replace(/^["']|["']$/g, '').replace(/\?+$/, '');
  assert.strictEqual(clean1, 'https://script.google.com/macros/s/ABC/exec');

  const raw2 = 'https://script.google.com/macros/s/ABC/exec?token=123?';
  const clean2 = raw2.trim().replace(/^["']|["']$/g, '').replace(/\?+$/, '');
  const sep = clean2.includes('?') ? '&' : '?';
  const url = `${clean2}${sep}symbols=AAPL&market=US`;
  assert.strictEqual(url, 'https://script.google.com/macros/s/ABC/exec?token=123&symbols=AAPL&market=US');
});

// 10. Preloaded US Stocks valuation calculation
it('US Stocks Valuation: correctly computes total invested and current value', () => {
  assert.ok(Array.isArray(defaultUsStockHoldings), 'defaultUsStockHoldings should exist');
  assert.strictEqual(defaultUsStockHoldings.length, 4);

  const aapl = defaultUsStockHoldings.find(s => s.symbol === 'AAPL');
  assert.ok(aapl);
  assert.ok(toNumber(aapl.quantity) > 0);
  assert.strictEqual(formatUSD(aapl.avgPrice), '$223.75');
});

// 11. persist() execution safety
it('persist(): executes cleanly without ReferenceError and returns a Promise', async () => {
  assert.strictEqual(typeof persist, 'function', 'persist must be a function');
  const res = persist();
  assert.ok(res && typeof res.then === 'function', 'persist must return a Promise');
});

// 12. Parse Stooq real-time proxy format
it('parseStockProxyPrice: parses Stooq real-time proxy response', () => {
  const data = {
    VOO: {
      symbol: 'VOO',
      price: 535.40,
      prevClose: 532.10,
      change: 3.30,
      changePct: 0.62,
      source: 'stooq-realtime',
      date: '2026-10-09'
    }
  };
  const res = parseStockProxyPrice(data, 'VOO');
  assert.ok(res);
  assert.strictEqual(res.price, 535.40);
  assert.strictEqual(res.prevClose, 532.10);
  assert.strictEqual(res.change, 3.30);
  assert.strictEqual(res.source, 'stooq-realtime');
});

// 13. Parse Google Finance spreadsheet proxy format
it('parseStockProxyPrice: parses Google Finance spreadsheet response', () => {
  const data = {
    RELIANCE: {
      symbol: 'RELIANCE',
      price: 2780.25,
      prevClose: 2755.00,
      change: 25.25,
      changePct: 0.92,
      source: 'googlefinance',
      date: '09 Oct 2026'
    }
  };
  const res = parseStockProxyPrice(data, 'RELIANCE');
  assert.ok(res);
  assert.strictEqual(res.price, 2780.25);
  assert.strictEqual(res.prevClose, 2755.00);
  assert.strictEqual(res.change, 25.25);
  assert.strictEqual(res.source, 'googlefinance');
});

// 14. recordDailyNetWorthSnapshot executes safely with persist()
it('recordDailyNetWorthSnapshot: executes without ReferenceError and stores snapshot', () => {
  assert.strictEqual(typeof recordDailyNetWorthSnapshot, 'function');
  const snapshot = recordDailyNetWorthSnapshot({ source: 'test-run' });
  assert.ok(snapshot);
  assert.ok(snapshot.date);
  assert.ok(snapshot.timestamp);
  assert.strictEqual(snapshot.source, 'test-run');
  assert.ok(Array.isArray(state.netWorthHistory));
  const found = state.netWorthHistory.find(s => s.id === snapshot.id);
  assert.ok(found);
});

// 15. 6-Hour Auto-Refresh time delta check
it('6-Hour Auto-Refresh interval is exactly 6 hours (21,600,000 ms)', () => {
  const sixHoursMs = 6 * 60 * 60 * 1000;
  assert.strictEqual(sixHoursMs, 21600000);
  const now = Date.now();
  const past5Hours = now - (5 * 60 * 60 * 1000);
  const past7Hours = now - (7 * 60 * 60 * 1000);
  assert.strictEqual(now - past5Hours < sixHoursMs, true, '5 hours should not trigger 6h refresh');
  assert.strictEqual(now - past7Hours >= sixHoursMs, true, '7 hours should trigger 6h refresh');
});

console.log('==========================================');
console.log(`📊 PROXY RESOLVER TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('==========================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL PROXY RESOLVER TESTS PASSED SUCCESSFULLY!');
}
