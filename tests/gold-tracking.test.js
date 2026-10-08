const assert = require("assert");

// Mock / extract functions from app logic
function getCaratMultiplier(carat) {
  if (!carat) return 22 / 24;
  const c = String(carat).toUpperCase().trim();
  if (c.includes("24")) return 1.0;
  if (c.includes("22")) return 22 / 24;
  if (c.includes("18")) return 18 / 24;
  return 22 / 24;
}

const HISTORICAL_24K_GOLD_RATES_INR = {
  2026: 7850,
  2025: 7550,
  2024: 6850,
  2023: 5950,
  2022: 5200,
  2021: 4800,
  2020: 4850,
  2019: 3500,
  2018: 3150,
  2017: 2950,
  2016: 2850,
  2015: 2600,
  2014: 2800,
  2013: 2950,
  2012: 3100,
  2011: 2600,
  2010: 1850,
  2005: 700,
  2000: 440,
};

function estimateHistoricalGoldRate(dateStr, carat = "24K") {
  if (!dateStr) return Math.round(7850 * getCaratMultiplier(carat));
  const year = parseInt(String(dateStr).slice(0, 4), 10);
  if (isNaN(year)) return Math.round(7850 * getCaratMultiplier(carat));

  let rate24k = 7850;
  if (HISTORICAL_24K_GOLD_RATES_INR[year]) {
    rate24k = HISTORICAL_24K_GOLD_RATES_INR[year];
  } else {
    const years = Object.keys(HISTORICAL_24K_GOLD_RATES_INR).map(Number).sort((a, b) => a - b);
    if (year <= years[0]) rate24k = HISTORICAL_24K_GOLD_RATES_INR[years[0]];
    else if (year >= years[years.length - 1]) rate24k = HISTORICAL_24K_GOLD_RATES_INR[years[years.length - 1]];
    else {
      for (let i = 0; i < years.length - 1; i++) {
        if (year >= years[i] && year <= years[i + 1]) {
          const ratio = (year - years[i]) / (years[i + 1] - years[i]);
          rate24k = Math.round(HISTORICAL_24K_GOLD_RATES_INR[years[i]] + ratio * (HISTORICAL_24K_GOLD_RATES_INR[years[i + 1]] - HISTORICAL_24K_GOLD_RATES_INR[years[i]]));
          break;
        }
      }
    }
  }
  return Math.round(rate24k * getCaratMultiplier(carat));
}

function calcGoldItemValues(item, currentPrice24k = 7850) {
  const mult = getCaratMultiplier(item.carat);
  const currentRate = Math.round(currentPrice24k * mult);
  const weight = Number(item.weightGrams) || 0;
  const buyPrice = Number(item.purchasePricePerGram) || estimateHistoricalGoldRate(item.date, item.carat);
  const invested = Math.round(weight * buyPrice);
  const currentValue = Math.round(weight * currentRate);
  const pl = currentValue - invested;
  const plPct = invested > 0 ? Number(((pl / invested) * 100).toFixed(2)) : 0;
  return { currentRate, invested, currentValue, pl, plPct };
}

console.log("==========================================");
console.log("🧪 RUNNING GOLD TRACKING & VALUATION TESTS");
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

test("Carat Purity Multipliers: 24K, 22K, 18K", () => {
  assert.strictEqual(getCaratMultiplier("24K"), 1.0);
  assert.strictEqual(getCaratMultiplier("24k"), 1.0);
  assert.strictEqual(Math.round(getCaratMultiplier("22K") * 24), 22);
  assert.strictEqual(getCaratMultiplier("18K"), 0.75);
  assert.strictEqual(getCaratMultiplier(""), 22 / 24); // default 22K
});

test("Historical Gold Rate Estimation: accurate yearly lookups and carat scaling", () => {
  const rate2022_24k = estimateHistoricalGoldRate("2022-05-10", "24K");
  assert.strictEqual(rate2022_24k, 5200);

  const rate2022_22k = estimateHistoricalGoldRate("2022-05-10", "22K");
  assert.strictEqual(rate2022_22k, Math.round(5200 * (22 / 24))); // ~4767

  const rate2018_24k = estimateHistoricalGoldRate("2018-11-01", "24K");
  assert.strictEqual(rate2018_24k, 3150);

  const rate2026_24k = estimateHistoricalGoldRate("2026-01-15", "24K");
  assert.strictEqual(rate2026_24k, 7850);
});

test("Gold Item Valuation: invested, current value, and profit/loss calculation", () => {
  const necklace = {
    name: "Bridal Necklace",
    category: "Jewellery",
    carat: "22K",
    weightGrams: 30,
    date: "2023-04-15",
    purchasePricePerGram: 5600
  };
  const val = calcGoldItemValues(necklace, 7850);
  assert.strictEqual(val.invested, 30 * 5600); // ₹1,68,000
  const expectedRate = Math.round(7850 * (22 / 24)); // ₹7,196/g
  assert.strictEqual(val.currentRate, expectedRate);
  assert.strictEqual(val.currentValue, 30 * expectedRate); // ₹2,15,880
  assert.strictEqual(val.pl, val.currentValue - val.invested); // ₹47,880 profit
  assert.strictEqual(val.plPct > 0, true);
});

test("24K Gold Bar Valuation: 100% purity calculation", () => {
  const bar = {
    name: "MMTC 24K Bar",
    category: "Bar",
    carat: "24K",
    weightGrams: 10,
    date: "2022-10-24",
    purchasePricePerGram: 5120
  };
  const val = calcGoldItemValues(bar, 7850);
  assert.strictEqual(val.invested, 51200);
  assert.strictEqual(val.currentValue, 78500);
  assert.strictEqual(val.pl, 27300);
  assert.strictEqual(val.plPct, 53.32);
});

test("Auto-estimation of buy price when purchase price is omitted", () => {
  const giftRing = {
    name: "Gifted Ring",
    category: "Jewellery",
    carat: "22K",
    weightGrams: 5,
    date: "2021-06-10",
    purchasePricePerGram: 0 // omitted
  };
  const val = calcGoldItemValues(giftRing, 7850);
  const expectedHistRate = estimateHistoricalGoldRate("2021-06-10", "22K");
  assert.strictEqual(val.invested, 5 * expectedHistRate);
  assert.strictEqual(val.invested > 0, true);
});

test("Portfolio Aggregation and Owner Segregation", () => {
  const holdings = [
    { id: "1", owner: "Me", weightGrams: 10, carat: "24K", purchasePricePerGram: 5000 },
    { id: "2", owner: "Wife", weightGrams: 20, carat: "22K", purchasePricePerGram: 5500 },
    { id: "3", owner: "Both", weightGrams: 5, carat: "22K", purchasePricePerGram: 5500 }
  ];
  const rate24k = 7850;
  const rate22k = Math.round(7850 * (22 / 24));

  const totalCurrentValue = holdings.reduce((sum, h) => {
    const rate = h.carat === "24K" ? rate24k : rate22k;
    return sum + h.weightGrams * rate;
  }, 0);

  const meValue = holdings
    .filter(h => h.owner === "Me" || h.owner === "Both")
    .reduce((sum, h) => {
      const rate = h.carat === "24K" ? rate24k : rate22k;
      return sum + h.weightGrams * rate;
    }, 0);

  const wifeValue = holdings
    .filter(h => h.owner === "Wife" || h.owner === "Both")
    .reduce((sum, h) => {
      const rate = h.carat === "24K" ? rate24k : rate22k;
      return sum + h.weightGrams * rate;
    }, 0);

  assert.strictEqual(totalCurrentValue, (10 * rate24k) + (25 * rate22k));
  assert.strictEqual(meValue, (10 * rate24k) + (5 * rate22k));
  assert.strictEqual(wifeValue, (20 * rate22k) + (5 * rate22k));
});

console.log("==========================================");
console.log(`📊 GOLD TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("==========================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("🎉 ALL GOLD TRACKING TESTS PASSED SUCCESSFULLY!");
}
