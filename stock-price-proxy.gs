/**
 * Life Ledger — Stock Price Proxy (Google Apps Script)
 * 
 * SETUP INSTRUCTIONS (Takes 2 minutes, 100% Free, No Billing/Key needed):
 * 1. Go to https://script.google.com/
 * 2. Click "New project" and name it "Stock Price Proxy"
 * 3. Paste this complete code into Code.gs
 * 4. Click "Deploy" (top right) → "New deployment"
 * 5. Select type: "Web app"
 * 6. Set Description: "Stock Price Proxy v1"
 * 7. Set Execute as: "Me"
 * 8. Set Who has access: "Anyone"
 * 9. Click "Deploy", authorize access, and copy the Web App URL (starts with https://script.google.com/macros/s/...)
 * 10. Open Life Ledger → Settings → 📈 Stock Prices → Paste URL & Save!
 */

function doGet(e) {
  var symbolsStr = (e && e.parameter && e.parameter.symbols) ? e.parameter.symbols : "";
  var symbols = symbolsStr.split(",").map(function(s) { return s.trim(); }).filter(Boolean);
  
  var results = {};
  
  if (symbols.length === 0) {
    return createJsonResponse({ error: "No symbols provided. Pass ?symbols=RELIANCE,INFY,TATAMOTORS" });
  }

  // Create a temporary spreadsheet to use GOOGLEFINANCE function for fast parallel resolution
  var ss = SpreadsheetApp.create("TempStockFetcher");
  var sheet = ss.getActiveSheet();

  try {
    // Populate formulas in column A & B
    for (var i = 0; i < symbols.length; i++) {
      var sym = symbols[i];
      var directTicker = sym;
      var nseTicker = sym.indexOf(":") !== -1 ? sym : "NSE:" + sym;
      var bseTicker = sym.indexOf(":") !== -1 ? sym : "BOM:" + sym;

      var row = i + 1;
      // Formula for price, prevclose, change, changepercent (supports US stocks like AAPL, VOO, META, T & Indian stocks)
      sheet.getRange(row, 1).setFormula('=IFERROR(GOOGLEFINANCE("' + directTicker + '", "price"), IFERROR(GOOGLEFINANCE("' + nseTicker + '", "price"), IFERROR(GOOGLEFINANCE("' + bseTicker + '", "price"), 0)))');
      sheet.getRange(row, 2).setFormula('=IFERROR(GOOGLEFINANCE("' + directTicker + '", "closeyest"), IFERROR(GOOGLEFINANCE("' + nseTicker + '", "closeyest"), IFERROR(GOOGLEFINANCE("' + bseTicker + '", "closeyest"), 0)))');
      sheet.getRange(row, 3).setFormula('=IFERROR(GOOGLEFINANCE("' + directTicker + '", "change"), IFERROR(GOOGLEFINANCE("' + nseTicker + '", "change"), 0))');
      sheet.getRange(row, 4).setFormula('=IFERROR(GOOGLEFINANCE("' + directTicker + '", "changepct"), IFERROR(GOOGLEFINANCE("' + nseTicker + '", "changepct"), 0))');
    }

    SpreadsheetApp.flush(); // Force formula evaluation

    // Read computed values
    var priceValues = sheet.getRange(1, 1, symbols.length, 1).getValues();
    var closeValues = sheet.getRange(1, 2, symbols.length, 1).getValues();
    var changeValues = sheet.getRange(1, 3, symbols.length, 1).getValues();
    var changePctValues = sheet.getRange(1, 4, symbols.length, 1).getValues();

    var todayStr = Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, hh:mm a");

    for (var j = 0; j < symbols.length; j++) {
      var s = symbols[j];
      var price = Number(priceValues[j][0]) || 0;
      var prevClose = Number(closeValues[j][0]) || 0;
      var change = Number(changeValues[j][0]) || 0;
      var changePct = Number(changePctValues[j][0]) || 0;

      if (price > 0) {
        results[s.toUpperCase()] = {
          symbol: s.toUpperCase(),
          price: price,
          prevClose: prevClose || price,
          change: change,
          changePct: changePct,
          date: todayStr
        };
      } else {
        // Fallback: direct Google Finance HTTP fetch if GOOGLEFINANCE formula was delayed
        results[s.toUpperCase()] = fetchViaScrape(s);
      }
    }

  } catch (err) {
    Logger.log("Error evaluating formulas: " + err);
    // Fallback all via HTTP scrape
    for (var k = 0; k < symbols.length; k++) {
      results[symbols[k].toUpperCase()] = fetchViaScrape(symbols[k]);
    }
  } finally {
    // Delete temporary spreadsheet
    DriveApp.getFileById(ss.getId()).setTrashed(true);
  }

  return createJsonResponse(results);
}

function fetchViaScrape(symbol) {
  try {
    var ticker = symbol.indexOf(":") !== -1 ? symbol : "NSE:" + symbol;
    var url = "https://www.google.com/finance/quote/" + ticker;
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var html = response.getContentText();

    // Parse price from Google Finance HTML (data-last-price)
    var priceMatch = html.match(/data-last-price="([\d\.]+)"/);
    var prevCloseMatch = html.match(/data-previous-close="([\d\.]+)"/);

    var price = priceMatch ? Number(priceMatch[1]) : 0;
    var prevClose = prevCloseMatch ? Number(prevCloseMatch[1]) : price;
    var change = price && prevClose ? (price - prevClose) : 0;
    var changePct = prevClose ? (change / prevClose) * 100 : 0;

    return {
      symbol: symbol.toUpperCase(),
      price: price,
      prevClose: prevClose,
      change: change,
      changePct: changePct,
      date: Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, hh:mm a")
    };
  } catch (e) {
    return { symbol: symbol.toUpperCase(), error: "Price not found" };
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
