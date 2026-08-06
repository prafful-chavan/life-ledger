/**
 * Life Ledger — Stock Price Proxy (Google Apps Script)
 * 
 * Supports BOTH Indian (NSE/BSE) and US (NASDAQ/NYSE/NYSEARCA) stocks.
 * Uses GOOGLEFINANCE formulas with smart exchange detection and
 * a Google Finance HTML scrape fallback for reliability.
 *
 * SETUP INSTRUCTIONS (Takes 2 minutes, 100% Free, No Billing/Key needed):
 * 1. Go to https://script.google.com/
 * 2. Click "New project" and name it "Stock Price Proxy"
 * 3. Paste this complete code into Code.gs
 * 4. Click "Deploy" (top right) → "New deployment"
 * 5. Select type: "Web app"
 * 6. Set Description: "Stock Price Proxy v2"
 * 7. Set Execute as: "Me"
 * 8. Set Who has access: "Anyone"
 * 9. Click "Deploy", authorize access, and copy the Web App URL
 * 10. Open Life Ledger → Settings → 📈 Stock Prices → Paste URL & Save!
 *
 * IMPORTANT: After updating this code, you MUST create a NEW deployment
 * (Deploy → New deployment, not "Manage deployments") for changes to take effect.
 */

// ─── Known US exchange tickers ──────────────────────────────────────────────
// If a symbol contains ":" it already has an exchange prefix.
// Otherwise we detect US stocks by a known-list + fallback heuristics.
var US_EXCHANGES = {
  "AAPL": "NASDAQ", "MSFT": "NASDAQ", "GOOGL": "NASDAQ", "GOOG": "NASDAQ",
  "AMZN": "NASDAQ", "META": "NASDAQ", "TSLA": "NASDAQ", "NVDA": "NASDAQ",
  "NFLX": "NASDAQ", "AMD": "NASDAQ", "INTC": "NASDAQ", "PYPL": "NASDAQ",
  "ADBE": "NASDAQ", "CSCO": "NASDAQ", "AVGO": "NASDAQ", "COST": "NASDAQ",
  "PEP": "NASDAQ", "QCOM": "NASDAQ", "SBUX": "NASDAQ", "ABNB": "NASDAQ",
  "COIN": "NASDAQ", "PLTR": "NASDAQ", "MARA": "NASDAQ", "RIOT": "NASDAQ",
  "SOFI": "NASDAQ", "UBER": "NYSE", "T": "NYSE", "VZ": "NYSE", "KO": "NYSE",
  "DIS": "NYSE", "BA": "NYSE", "GE": "NYSE", "JPM": "NYSE", "V": "NYSE",
  "MA": "NYSE", "WMT": "NYSE", "JNJ": "NYSE", "PG": "NYSE", "XOM": "NYSE",
  "CVX": "NYSE", "HD": "NYSE", "MCD": "NYSE", "NKE": "NYSE", "CRM": "NYSE",
  "BABA": "NYSE", "SNOW": "NYSE", "SQ": "NYSE", "SHOP": "NYSE",
  "VOO": "NYSEARCA", "VTI": "NYSEARCA", "QQQ": "NASDAQ", "SPY": "NYSEARCA",
  "IVV": "NYSEARCA", "SCHD": "NYSEARCA", "VUG": "NYSEARCA", "VTV": "NYSEARCA",
  "ARKK": "NYSEARCA", "VWO": "NYSEARCA", "VEA": "NYSEARCA", "BND": "NYSEARCA",
  "GLD": "NYSEARCA", "SLV": "NYSEARCA", "IWM": "NYSEARCA", "EEM": "NYSEARCA",
  "VGT": "NYSEARCA", "VXUS": "NYSEARCA",
};

/**
 * Determines if a symbol is a US stock/ETF.
 * Returns exchange prefix if US, or empty string if Indian.
 */
function getExchangePrefix(symbol) {
  var sym = symbol.toUpperCase().trim();
  // Already has exchange prefix
  if (sym.indexOf(":") !== -1) return "";
  // Known US stock
  if (US_EXCHANGES[sym]) return US_EXCHANGES[sym];
  // Heuristic: Indian tickers tend to be longer and may have numbers/dots (e.g. TATAMOTORS, HDFCBANK, ITC)
  // US tickers are typically 1-5 chars, all letters
  // This is a best-effort guess for unknown symbols
  return "";
}

function isLikelyUS(symbol) {
  var sym = symbol.toUpperCase().trim();
  if (sym.indexOf(":") !== -1) {
    var prefix = sym.split(":")[0];
    return (prefix === "NASDAQ" || prefix === "NYSE" || prefix === "NYSEARCA");
  }
  return !!US_EXCHANGES[sym];
}

function doGet(e) {
  var symbolsStr = (e && e.parameter && e.parameter.symbols) ? e.parameter.symbols : "";
  var symbols = symbolsStr.split(",").map(function(s) { return s.trim(); }).filter(Boolean);
  
  var results = {};
  
  if (symbols.length === 0) {
    return createJsonResponse({ error: "No symbols provided. Pass ?symbols=AAPL,RELIANCE,VOO" });
  }

  // Create a temporary spreadsheet to use GOOGLEFINANCE function
  var ss = SpreadsheetApp.create("TempStockFetcher_" + Date.now());
  var sheet = ss.getActiveSheet();

  try {
    // ─── Step 1: Set up GOOGLEFINANCE formulas ──────────────────────────────
    for (var i = 0; i < symbols.length; i++) {
      var sym = symbols[i].toUpperCase().trim();
      var row = i + 1;
      
      // Build smart ticker resolution chain
      var tickers = [];
      
      if (sym.indexOf(":") !== -1) {
        // Already has exchange prefix, use as-is
        tickers.push(sym);
      } else if (isLikelyUS(sym)) {
        // US stock: try exchange:SYMBOL first, then bare symbol
        var exchange = US_EXCHANGES[sym] || "NASDAQ";
        tickers.push(exchange + ":" + sym);
        if (exchange !== "NASDAQ") tickers.push("NASDAQ:" + sym);
        if (exchange !== "NYSE") tickers.push("NYSE:" + sym);
        tickers.push(sym); // bare symbol as last resort
      } else {
        // Indian stock: try NSE first, then BOM, then bare
        tickers.push("NSE:" + sym);
        tickers.push("BOM:" + sym);
        tickers.push(sym);
      }
      
      // Build nested IFERROR formula for each attribute
      var attrs = ["price", "closeyest", "change", "changepct"];
      for (var a = 0; a < attrs.length; a++) {
        var formula = "0"; // innermost fallback
        for (var t = tickers.length - 1; t >= 0; t--) {
          formula = 'IFERROR(GOOGLEFINANCE("' + tickers[t] + '", "' + attrs[a] + '"), ' + formula + ')';
        }
        sheet.getRange(row, a + 1).setFormula("=" + formula);
      }
    }

    // ─── Step 2: Force formula evaluation with retry ────────────────────────
    SpreadsheetApp.flush();
    
    // GOOGLEFINANCE can be slow. Wait up to 8 seconds for formulas to resolve.
    var maxWaitMs = 8000;
    var checkInterval = 1500;
    var elapsed = 0;
    
    while (elapsed < maxWaitMs) {
      Utilities.sleep(checkInterval);
      elapsed += checkInterval;
      SpreadsheetApp.flush();
      
      // Check if at least the first symbol resolved
      var testVal = sheet.getRange(1, 1).getValue();
      if (testVal && Number(testVal) > 0) break;
    }

    // ─── Step 3: Read computed values ───────────────────────────────────────
    var allValues = sheet.getRange(1, 1, symbols.length, 4).getValues();
    var todayStr = Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, hh:mm a");

    for (var j = 0; j < symbols.length; j++) {
      var s = symbols[j].toUpperCase().trim();
      var price = Number(allValues[j][0]) || 0;
      var prevClose = Number(allValues[j][1]) || 0;
      var change = Number(allValues[j][2]) || 0;
      var changePct = Number(allValues[j][3]) || 0;

      if (price > 0) {
        results[s] = {
          symbol: s,
          price: price,
          prevClose: prevClose || price,
          change: change,
          changePct: changePct,
          date: todayStr,
          source: "googlefinance"
        };
      } else {
        // Fallback: scrape Google Finance HTML
        Logger.log("GOOGLEFINANCE returned 0 for " + s + ", trying HTML scrape fallback...");
        results[s] = fetchViaScrape(s);
      }
    }

  } catch (err) {
    Logger.log("Error in doGet: " + err.toString());
    // Fallback all via HTTP scrape
    for (var k = 0; k < symbols.length; k++) {
      var sym2 = symbols[k].toUpperCase().trim();
      if (!results[sym2]) {
        results[sym2] = fetchViaScrape(sym2);
      }
    }
  } finally {
    // Delete temporary spreadsheet
    try {
      DriveApp.getFileById(ss.getId()).setTrashed(true);
    } catch (cleanupErr) {
      Logger.log("Cleanup error: " + cleanupErr);
    }
  }

  return createJsonResponse(results);
}

/**
 * Fallback: Scrape price from Google Finance HTML page.
 * Handles both US and Indian tickers with proper exchange prefix.
 */
function fetchViaScrape(symbol) {
  var sym = symbol.toUpperCase().trim();
  
  // Build list of Google Finance URLs to try
  var urls = [];
  
  if (sym.indexOf(":") !== -1) {
    // Already has exchange prefix
    urls.push("https://www.google.com/finance/quote/" + encodeURIComponent(sym));
  } else if (isLikelyUS(sym)) {
    // US stock — try exchange-prefixed first, then bare
    var exchange = US_EXCHANGES[sym] || "NASDAQ";
    urls.push("https://www.google.com/finance/quote/" + sym + ":" + exchange);
    if (exchange === "NYSEARCA") {
      // NYSEARCA ETFs sometimes listed under different names
      urls.push("https://www.google.com/finance/quote/" + sym + ":NASDAQ");
    }
    urls.push("https://www.google.com/finance/quote/" + sym + ":NYSE");
    urls.push("https://www.google.com/finance/quote/" + sym + ":NASDAQ");
  } else {
    // Indian stock
    urls.push("https://www.google.com/finance/quote/" + sym + ":NSE");
    urls.push("https://www.google.com/finance/quote/" + sym + ":BOM");
  }
  
  for (var i = 0; i < urls.length; i++) {
    try {
      var response = UrlFetchApp.fetch(urls[i], { muteHttpExceptions: true, followRedirects: true });
      if (response.getResponseCode() !== 200) continue;
      var html = response.getContentText();

      // Parse price from Google Finance HTML
      var priceMatch = html.match(/data-last-price="([\d\.]+)"/);
      var prevCloseMatch = html.match(/data-previous-close="([\d\.]+)"/);

      var price = priceMatch ? Number(priceMatch[1]) : 0;
      if (price <= 0) continue; // Try next URL

      var prevClose = prevCloseMatch ? Number(prevCloseMatch[1]) : price;
      var change = price && prevClose ? (price - prevClose) : 0;
      var changePct = prevClose ? (change / prevClose) * 100 : 0;

      return {
        symbol: sym,
        price: price,
        prevClose: prevClose,
        change: change,
        changePct: changePct,
        date: Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, hh:mm a"),
        source: "scrape",
        sourceUrl: urls[i]
      };
    } catch (e) {
      Logger.log("Scrape failed for " + urls[i] + ": " + e);
      continue;
    }
  }

  // All attempts failed
  return { symbol: sym, error: "Price not found after trying " + urls.length + " sources", price: 0 };
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
