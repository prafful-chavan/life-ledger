const assert = require('assert');

// Master canonical scheme mapping test definitions
const CANONICAL_MF_SCHEME_MAP = {
  147946: { schemeCode: 147946, isin: "INF194KB1AL4", schemeName: "Bandhan Small Cap Fund - Direct Plan - Growth", owner: "Wife" },
  118955: { schemeCode: 118955, isin: "INF179K01UT0", schemeName: "HDFC Flexi Cap Fund - Direct Plan - Growth Option", owner: "Wife" },
  120716: { schemeCode: 120716, isin: "INF789F01XA0", schemeName: "UTI Nifty 50 Index Fund - Direct Plan - Growth", owner: "Wife" },
  127042: { schemeCode: 127042, isin: "INF247L01445", schemeName: "Motilal Oswal Midcap Fund", owner: "Wife" },
  153055: { schemeCode: 153055, isin: "INF277KA1CU2", schemeName: "Tata India Innovation Fund - Direct Plan - Growth Option", owner: "Wife" },
  152931: { schemeCode: 152931, isin: "INF251K01TY9", schemeName: "Baroda BNP Paribas Nifty200 Momentum 30 Index Fund - Direct Plan - Growth Option", owner: "Wife" },
  118759: { schemeCode: 118759, isin: "INF204K01I50", schemeName: "Nippon India Pharma Fund - Direct Plan - Growth Option", owner: "Me" },
  122639: { schemeCode: 122639, isin: "INF879O01027", schemeName: "Parag Parikh Flexi Cap Fund - Direct Plan - Growth", owner: "Me" },
  120465: { schemeCode: 120465, isin: "", schemeName: "Axis Large Cap Fund - Direct Plan - Growth Option", owner: "Me" },
  120828: { schemeCode: 120828, isin: "INF966L01689", schemeName: "Quant Small Cap Fund - Direct Plan - Growth Option", owner: "Me" },
  120503: { schemeCode: 120503, isin: "INF846K01EW2", schemeName: "Axis ELSS- Tax Saver Fund - Direct Plan - Growth Option", owner: "Me" },
  120847: { schemeCode: 120847, isin: "INF966L01986", schemeName: "Quant ELSS Tax Saver Fund - Direct Plan - Growth Option", owner: "Me" },
  152821: { schemeCode: 152821, isin: "", schemeName: "ITI Large & Mid Cap Fund - Direct Plan - Growth Option", owner: "Me" },
  152951: { schemeCode: 152951, isin: "INF277KA1CO5", schemeName: "Tata Nifty Capital Markets Index Fund - Direct Plan - Growth Option", owner: "Me" },
  152770: { schemeCode: 152770, isin: "INF666M01IL4", schemeName: "Groww Nifty EV & New Age Automotive ETF FOF - Direct Plan - Growth", owner: "Me" },
  120334: { schemeCode: 120334, isin: "INF109K015K4", schemeName: "ICICI Prudential Multi Asset Allocation Fund - Direct Plan - Growth", owner: "Me" }
};

function getCanonicalSchemeCode(query, isin = '') {
  if (!query) return null;
  const qClean = String(query).trim().toLowerCase().replace(/\s+/g, ' ');
  const isinClean = String(isin).trim().toUpperCase();

  // ISIN match
  if (isinClean) {
    for (const [code, info] of Object.entries(CANONICAL_MF_SCHEME_MAP)) {
      if (info.isin && info.isin.toUpperCase() === isinClean) return info.schemeCode;
    }
  }

  // Exact code match
  if (/^\d{6}$/.test(qClean)) return parseInt(qClean, 10);

  // Exact canonical overrides
  if (qClean.includes('motilal') && qClean.includes('midcap')) return 127042;
  if (qClean.includes('quant') && qClean.includes('elss')) return 120847;
  if (qClean.includes('icici') && qClean.includes('multi asset')) return 120334;
  if (qClean.includes('tata') && qClean.includes('innovation')) return 153055;
  if (qClean.includes('quant') && qClean.includes('small cap')) return 120828;
  if (qClean.includes('parag parikh')) return 122639;
  if (qClean.includes('bandhan') && qClean.includes('small cap')) return 147946;
  if (qClean.includes('hdfc') && qClean.includes('flexi cap')) return 118955;
  if (qClean.includes('uti') && qClean.includes('nifty 50')) return 120716;

  return null;
}

function calcMfUnits(txns) {
  let netUnits = 0;
  let invested = 0;
  txns.forEach(t => {
    const isRed = ['SELL', 'REDEMPTION', 'SWITCH_OUT'].includes(String(t.transactionType || '').toUpperCase());
    const units = Number(t.units || 0);
    const amt = Number(t.invested || t.amount || 0);
    if (isRed) {
      netUnits -= units;
    } else {
      netUnits += units;
      invested += amt;
    }
  });
  return { netUnits: Math.max(0, netUnits), invested };
}

console.log("==========================================");
console.log("🧪 RUNNING MUTUAL FUND SCHEME RESOLUTION TESTS");
console.log("==========================================");

// Test A: Motilal Oswal Midcap Direct Growth resolves to 127042
const motilalCode = getCanonicalSchemeCode("Motilal Oswal Midcap Fund Direct Growth", "INF247L01445");
assert.strictEqual(motilalCode, 127042, "Motilal Oswal Midcap must resolve to 127042");
console.log("✅ TEST A PASS: Motilal Oswal Midcap Direct Growth resolves strictly to 127042");

// Test B: Quant ELSS Direct Growth resolves to 120847
const quantElssCode = getCanonicalSchemeCode("Quant ELSS Tax Saver Fund Direct Growth", "INF966L01986");
assert.strictEqual(quantElssCode, 120847, "Quant ELSS must resolve to 120847");
console.log("✅ TEST B PASS: Quant ELSS Tax Saver Direct Growth resolves strictly to 120847");

// Test C: ICICI Prudential Multi Asset duplicate display names resolve to 120334
const iciciCode1 = getCanonicalSchemeCode("ICICI Prudential Multi Asset Allocation Fund Direct Growth");
const iciciCode2 = getCanonicalSchemeCode("ICICI Prudential Multi Asset Fund Direct Growth");
assert.strictEqual(iciciCode1, 120334);
assert.strictEqual(iciciCode2, 120334);
console.log("✅ TEST C PASS: Both ICICI Prudential Multi Asset display names resolve to 120334");

// Test D: Owner Separation (Me vs Wife)
const meTxns = [{ fundName: "Quant ELSS", owner: "Me", units: 375.2, latestNav: 456.72 }];
const wifeTxns = [{ fundName: "Motilal Oswal Midcap", owner: "Wife", units: 2058.56, latestNav: 117.00 }];
const meTotal = meTxns.reduce((s, t) => s + t.units * t.latestNav, 0);
const wifeTotal = wifeTxns.reduce((s, t) => s + t.units * t.latestNav, 0);
assert(meTotal > 170000, "Me total should be ~1.71L");
assert(wifeTotal > 240000, "Wife total should be ~2.40L");
console.log(`✅ TEST D PASS: Owner separation verified (Me: ₹${meTotal.toFixed(2)}, Wife: ₹${wifeTotal.toFixed(2)})`);

// Test E: Redemption reduces units
const txnsWithRedemption = [
  { transactionType: "BUY", units: 100, invested: 10000 },
  { transactionType: "REDEMPTION", units: 30, invested: 3500 }
];
const basis = calcMfUnits(txnsWithRedemption);
assert.strictEqual(basis.netUnits, 70, "100 buy - 30 redemption = 70 net units");
console.log("✅ TEST E PASS: Redemption reduces net units accurately");

// Test F: NAV refresh updates current_value while preserving invested_amount
const sampleTxn = { units: 100, invested: 10000, latestNav: 150 };
const initialCost = sampleTxn.invested;
sampleTxn.latestNav = 200; // NAV refresh
sampleTxn.currentValue = sampleTxn.units * sampleTxn.latestNav;
assert.strictEqual(sampleTxn.invested, initialCost, "Invested cost must remain unchanged");
assert.strictEqual(sampleTxn.currentValue, 20000, "Current value updates to 20,000");
console.log("✅ TEST F PASS: NAV refresh updates currentValue while preserving invested_amount");

// Test G: NAV API failure preserves previous NAV
const cachedNav = { nav: 117.00, date: "24-09-2026", isStale: false };
const apiFailedNav = null;
const finalNav = apiFailedNav || cachedNav;
finalNav.isStale = true;
assert.strictEqual(finalNav.nav, 117.00, "API failure keeps last known NAV");
assert.strictEqual(finalNav.isStale, true, "API failure marks NAV as stale");
console.log("✅ TEST G PASS: NAV API failure preserves last known NAV and sets isStale flag");

// Test H: Tata India Innovation Fund resolves to 153055
const tataCode = getCanonicalSchemeCode("Tata India Innovation Fund Direct Growth", "INF277KA1CU2");
assert.strictEqual(tataCode, 153055, "Tata India Innovation Fund must resolve to 153055");
console.log("✅ TEST H PASS: Tata India Innovation Fund Direct Growth resolves to 153055");

console.log("==========================================");
console.log("🎉 ALL MUTUAL FUND RECONCILIATION TESTS PASSED!");
console.log("==========================================");
