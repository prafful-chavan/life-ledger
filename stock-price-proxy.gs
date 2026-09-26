/**
 * Life Ledger — Stock Price Proxy (Google Apps Script) v4
 * 
 * Supports BOTH Indian (NSE/BSE) and US (NASDAQ/NYSE/NYSEARCA) stocks.
 * Features 100% Dynamic ISIN Resolution:
 * Any future Indian stock, ETF, or SGB added to the user's sheet with ONLY an ISIN
 * is dynamically identified (company name, canonical exchange ticker, asset type)
 * via Groww and Yahoo Search APIs with zero hardcoding needed.
 * Uses GOOGLEFINANCE formulas with smart exchange detection,
 * Yahoo Finance Chart API fallback (no CORS on Google servers), and
 * Google Finance HTML scrape fallback for 100% data reliability.
 *
 * SETUP INSTRUCTIONS (Takes 2 minutes, 100% Free, No Billing/Key needed):
 * 1. Go to https://script.google.com/
 * 2. Open your existing project or click "New project" and name it "Stock Price Proxy"
 * 3. Replace all code in Code.gs with this complete file
 * 4. Click "Deploy" (top right) → "New deployment"
 * 5. Select type: "Web app"
 * 6. Set Description: "Stock Price Proxy v4 (Dynamic ISIN resolution, Zero hardcoding)"
 * 7. Set Execute as: "Me"
 * 8. Set Who has access: "Anyone"
 * 9. Click "Deploy", authorize access, and copy the Web App URL
 * 10. Open Life Ledger → Settings → 📈 Stock Prices → Paste URL & Save!
 *
 * IMPORTANT: After updating this code, you MUST create a NEW deployment
 * (Deploy → New deployment, not "Manage deployments") for changes to take effect.
 */

// ─── Known US exchange tickers ──────────────────────────────────────────────
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

// ─── Known Indian ISIN to NSE Ticker mapping & Broker Aliases ────────────────
var ISIN_TO_TICKER = {
  // ETFs & Funds
  "INF174KA1HJ8": "GOLDBEES",
  "INF247L01AP3": "MON100",
  "INF204KB15V2": "ITBEES",
  "INF179KC1FB2": "HDFCSML250",
  "INF179KC1HT0": "HDFCMID150",
  "INF204KB14I2": "NIFTYBEES",
  "INF204KB1V68": "MID150BEES",
  "INF204KB15I9": "BANKBEES",
  "INF204KB17I5": "GOLDBEES",
  "INF204KC1402": "SILVERBEES",
  "INF109KB15Y7": "ICICIB22",
  "INF204KB14H4": "JUNIORBEES",
  "INF582M01014": "CPSEETF",

  // Stocks & Equities
  "INE472A01039": "BLUESTARCO",
  "INE188A01015": "FACT",
  "INE176B01034": "HAVELLS",
  "INE749A01030": "JINDALSTEL",
  "INE101A01026": "M&M",
  "INE134E01011": "PFC",
  "INE811K01011": "PRESTIGE",
  "INE020B01018": "RECLTD",
  "INE200M01039": "VBL",
  "INE075A01022": "WIPRO",
  "INE208C01025": "AEGISLOG",
  "INE933K01021": "BAJAJCON",
  "INE200A01026": "GEVERNOVA",
  "INE038A01020": "HINDALCO",
  "INE0J5401028": "HONASA",
  "INE947Q01028": "LAURUSLABS",
  "INE745G01043": "MCX",
  "INE777K01022": "RRKABEL",
  "INE0CLI01024": "RATEGAIN",
  "INE101D01020": "GRANULES",
  "INE034A01011": "ARVIND",
  "INE763I01026": "TRIL",
  "INE068V01023": "GLAND",
  "INE386D01027": "SBCL",
  "INE154A01025": "ITC",
  "INE397D01024": "BHARTIARTL",
  "INE002A01018": "RELIANCE",
  "INE467B01029": "TCS",
  "INE040A01034": "HDFCBANK",
  "INE009A01021": "INFY",
  "INE062A01020": "SBIN",
  "INE090A01021": "ICICIBANK",
  "INE238A01034": "AXISBANK",
  "INE237A01028": "KOTAKBANK",
  "INE018A01030": "LT",
  "INE155A01022": "TATAMOTORS",
  "INE081A01020": "TATASTEEL",
  "INE585B01010": "MARUTI",
  "INE044A01036": "SUNPHARMA",
  "INE280A01028": "TITAN",
  "INE296A01024": "BAJFINANCE",
  "INE918I01026": "BAJAJFINSV",
  "INE021A01026": "ASIANPAINT",
  "INE030A01027": "HINDUNILVR",
  "INE733E01010": "NTPC",
  "INE752E01010": "POWERGRID",
  "INE213A01029": "ONGC",
  "INE522F01014": "COALINDIA",
  "INE423A01024": "ADANIENT",
  "INE742F01042": "ADANIPORTS",
  "INE245A01021": "TATAPOWER",
  "INE758T01015": "ZOMATO",
  "INE414G01012": "JIOFIN",
  "INE066F01020": "HAL",
  "INE263A01024": "BEL",
  "INE249Z01012": "MAZDOCK",
  "INE849A01020": "TRENT",
  "INE205A01025": "VEDL",
  "INE455K01017": "POLYCAB",
  "INE040H01021": "SUZLON",
  "INE053F01010": "IRFC",
  "INE415G01027": "RVNL",
  "INE736A01011": "CDSL",
  "INE118H01025": "BSE",
  "INE059A01026": "CIPLA",
  "INE089A01023": "DRREDDY",
  "INE361B01024": "DIVISLAB",
  "INE669C01036": "TECHM",
  "INE860A01027": "HCLTECH",
  "INE481G01011": "ULTRACEMCO",
  "INE239A01024": "NESTLEIND",
  "INE216A01030": "BRITANNIA",
  "INE016A01026": "DABUR",
  "INE196A01026": "MARICO",
  "INE318A01026": "PIDILITIND",
  "INE463A01038": "BERGEPAINT",
  "INE102D01028": "GODREJCP",
  "INE192A01025": "TATACONSUM",
  "INE066A01021": "EICHERMOT",
  "INE158A01026": "HEROMOTOCO",
  "INE494B01023": "TVSMOTOR",
  "INE214A01020": "ASHOKLEY",
  "INE465A01025": "BHARATFORG",
  "INE775A01035": "MOTHERSON",
  "INE029A01011": "BPCL",
  "INE242A01010": "IOC",
  "INE129A01019": "GAIL",
  "INE271C01023": "DLF",
  "INE053A01032": "INDHOTEL",
  "INE171A01029": "FEDERALBNK",
  "INE092T01019": "IDFCFIRSTB",
  "INE160A01022": "PNB",
  "INE077A01010": "BANKBARODA",
  "INE476A01014": "CANBK",
  "INE692A01016": "UNIONBANK",
  "INE414E01012": "MUTHOOTFIN",
  "INE121A01024": "CHOLAFIN",
  "INE721A01013": "SHRIRAMFIN",

  // Broker Scrip Code / Alias Mapping to Exchange Ticker
  "BHARAT22": "ICICIB22",
  "ICICIB22": "ICICIB22",
  "NETFSILVER": "SILVERBEES",
  "BAJAJCORP": "BAJAJCON",
  "GOLD1": "GOLDBEES",
  "BHARTI": "BHARTIARTL",
  "SBI": "SBIN",
  "TRANS": "TRIL",
  "GE": "GEVERNOVA",
  "R": "RRKABEL"
};

/**
 * Determines if a symbol is a US stock/ETF.
 */
function isLikelyUS(symbol) {
  var sym = symbol.toUpperCase().trim();
  if (sym.indexOf(":") !== -1) {
    var prefix = sym.split(":")[0];
    return (prefix === "NASDAQ" || prefix === "NYSE" || prefix === "NYSEARCA");
  }
  return !!US_EXCHANGES[sym];
}

/**
 * Dynamically resolves an Indian ISIN (INE/INF/IN00) to an exchange ticker,
 * company name, and asset category using Groww and Yahoo Search APIs.
 * Runs server-side on Google Cloud with zero CORS limits.
 */
function resolveIsinOnline(isin) {
  if (!isin) return null;
  var cleanIsin = String(isin).trim().toUpperCase();

  // Fast path: Check static mapping dictionary first
  if (ISIN_TO_TICKER[cleanIsin]) {
    var mappedSym = ISIN_TO_TICKER[cleanIsin];
    return {
      isin: cleanIsin,
      symbol: mappedSym,
      company: mappedSym,
      category: /BEES|ETF/i.test(mappedSym) ? "ETF" : "Stock"
    };
  }

  // 1. Primary: Groww Search API (contains all NSE/BSE stocks, ETFs, SGBs)
  try {
    var growwUrl = "https://groww.in/v1/api/search/v1/entity?app=false&page=0&q=" + encodeURIComponent(cleanIsin) + "&size=5";
    var resp = UrlFetchApp.fetch(growwUrl, {
      muteHttpExceptions: true,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
    });
    if (resp.getResponseCode() === 200) {
      var data = JSON.parse(resp.getContentText());
      var items = data && data.content ? data.content : [];
      var item = null;
      for (var i = 0; i < items.length; i++) {
        if (items[i].isin && items[i].isin.toUpperCase() === cleanIsin) {
          item = items[i];
          break;
        }
      }
      if (!item && items.length > 0) item = items[0];

      if (item) {
        var symbol = item.nse_scrip_code || item.bse_scrip_code || item.symbol;
        if (symbol) {
          symbol = symbol.toUpperCase().trim();
          var company = item.title || item.company_short_name || symbol;
          var entityType = (item.entity_type || "").toUpperCase();
          var category = (entityType === "ETF" || /ETF|BEES/i.test(symbol + " " + company))
            ? "ETF"
            : (/SGB|GOLD.*BOND/i.test(symbol + " " + company) ? "Bond" : "Stock");

          ISIN_TO_TICKER[cleanIsin] = symbol;
          return {
            isin: cleanIsin,
            symbol: symbol,
            company: company,
            category: category
          };
        }
      }
    }
  } catch (err) {
    Logger.log("Groww ISIN search error for " + cleanIsin + ": " + err);
  }

  // 2. Secondary: Yahoo Finance Search API
  try {
    var yahooUrl = "https://query1.finance.yahoo.com/v1/finance/search?q=" + encodeURIComponent(cleanIsin);
    var yResp = UrlFetchApp.fetch(yahooUrl, {
      muteHttpExceptions: true,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
    });
    if (yResp.getResponseCode() === 200) {
      var yData = JSON.parse(yResp.getContentText());
      var quotes = yData && yData.quotes ? yData.quotes : [];
      var q = null;
      for (var k = 0; k < quotes.length; k++) {
        if (quotes[k].symbol && (quotes[k].symbol.endsWith(".NS") || quotes[k].symbol.endsWith(".BO"))) {
          q = quotes[k];
          break;
        }
      }
      if (!q && quotes.length > 0) q = quotes[0];

      if (q && q.symbol) {
        var ySymbol = q.symbol.toUpperCase().replace(/\.(NS|BO)$/i, "").trim();
        var yCompany = q.longname || q.shortname || ySymbol;
        var yCat = (q.quoteType === "ETF" || /ETF|BEES/i.test(ySymbol + " " + yCompany)) ? "ETF" : "Stock";

        ISIN_TO_TICKER[cleanIsin] = ySymbol;
        return {
          isin: cleanIsin,
          symbol: ySymbol,
          company: yCompany,
          category: yCat
        };
      }
    }
  } catch (yErr) {
    Logger.log("Yahoo ISIN search error for " + cleanIsin + ": " + yErr);
  }

  return null;
}

function doGet(e) {
  // Support standalone dynamic ISIN resolution: ?resolveIsin=INE343H01029
  if (e && e.parameter && e.parameter.resolveIsin) {
    var isinToResolve = e.parameter.resolveIsin.trim().toUpperCase();
    var resolved = resolveIsinOnline(isinToResolve);
    if (resolved) {
      return createJsonResponse(resolved);
    }
    return createJsonResponse({ error: "Could not resolve ISIN: " + isinToResolve, isin: isinToResolve });
  }

  var symbolsStr = (e && e.parameter && e.parameter.symbols) ? e.parameter.symbols : "";
  var rawSymbols = symbolsStr.split(",").map(function(s) { return s.trim(); }).filter(Boolean);
  var marketParam = (e && e.parameter && e.parameter.market) ? e.parameter.market.toUpperCase() : "";
  
  var results = {};
  
  if (rawSymbols.length === 0) {
    return createJsonResponse({ error: "No symbols provided. Pass ?symbols=AAPL,RELIANCE,VOO or ?resolveIsin=INE..." });
  }

  // Map ISINs and aliases to canonical exchange tickers
  var symbols = [];
  var isinOrigMap = {};
  var isinMetaMap = {};
  var isinPattern = /^IN[EF0-9][A-Z0-9]{7,}$/i;

  for (var m = 0; m < rawSymbols.length; m++) {
    var rawSym = rawSymbols[m].toUpperCase().replace(/\s*-EQ$/i, "").trim();
    var resolvedSym = ISIN_TO_TICKER[rawSym] || rawSym;

    // Dynamically resolve unknown ISINs on the fly
    if (isinPattern.test(rawSym)) {
      var info = resolveIsinOnline(rawSym);
      if (info && info.symbol) {
        resolvedSym = info.symbol;
        isinMetaMap[resolvedSym] = info;
        isinMetaMap[rawSym] = info;
      }
    }

    symbols.push(resolvedSym);
    isinOrigMap[resolvedSym] = rawSym;
  }

  // Create temporary spreadsheet for GOOGLEFINANCE formulas
  var ss = SpreadsheetApp.create("TempStockFetcher_" + Date.now());
  var sheet = ss.getActiveSheet();

  try {
    // ─── Step 1: Set up GOOGLEFINANCE formulas ──────────────────────────────
    for (var i = 0; i < symbols.length; i++) {
      var sym = symbols[i].toUpperCase().trim();
      var row = i + 1;
      
      var tickers = [];
      if (sym.indexOf(":") !== -1) {
        tickers.push(sym);
      } else if (marketParam === "US" || isLikelyUS(sym)) {
        var exchange = US_EXCHANGES[sym] || "NASDAQ";
        tickers.push(exchange + ":" + sym);
        if (exchange !== "NASDAQ") tickers.push("NASDAQ:" + sym);
        if (exchange !== "NYSE") tickers.push("NYSE:" + sym);
        tickers.push(sym);
      } else {
        tickers.push("NSE:" + sym);
        tickers.push("BOM:" + sym);
        tickers.push(sym);
      }
      
      var attrs = ["price", "closeyest", "change", "changepct"];
      for (var a = 0; a < attrs.length; a++) {
        var formula = "0";
        for (var t = tickers.length - 1; t >= 0; t--) {
          formula = 'IFERROR(GOOGLEFINANCE("' + tickers[t] + '", "' + attrs[a] + '"), ' + formula + ')';
        }
        sheet.getRange(row, a + 1).setFormula("=" + formula);
      }
    }

    // ─── Step 2: Force formula evaluation with retry ────────────────────────
    SpreadsheetApp.flush();
    
    // Wait up to 12s for all formulas to resolve
    var maxWaitMs = 12000;
    var checkInterval = 1000;
    var elapsed = 0;
    
    while (elapsed < maxWaitMs) {
      Utilities.sleep(checkInterval);
      elapsed += checkInterval;
      SpreadsheetApp.flush();
      
      var sampleValues = sheet.getRange(1, 1, symbols.length, 1).getValues();
      var pending = 0;
      for (var r = 0; r < sampleValues.length; r++) {
        var v = Number(sampleValues[r][0]);
        if (!v || v <= 0 || isNaN(v)) pending++;
      }
      if (pending === 0) break;
    }

    // ─── Step 3: Read computed values & apply Yahoo/Scrape fallbacks ────────
    var allValues = sheet.getRange(1, 1, symbols.length, 4).getValues();
    var todayStr = Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, hh:mm a");

    for (var j = 0; j < symbols.length; j++) {
      var s = symbols[j].toUpperCase().trim();
      var rawOrig = isinOrigMap[s] || s;
      var price = Number(allValues[j][0]) || 0;
      var prevClose = Number(allValues[j][1]) || 0;
      var change = Number(allValues[j][2]) || 0;
      var changePct = Number(allValues[j][3]) || 0;

      var resItem = null;
      if (price > 0) {
        resItem = {
          symbol: s,
          price: price,
          prevClose: prevClose || price,
          change: change,
          changePct: changePct,
          date: todayStr,
          source: "googlefinance"
        };
      } else {
        // Fallback 1: Direct Yahoo Finance Chart API (Server-side, no CORS)
        Logger.log("GOOGLEFINANCE returned 0 for " + s + ", trying Yahoo Finance API fallback...");
        resItem = fetchViaYahooFinance(s, marketParam === "US" || isLikelyUS(s));
        
        // Fallback 2: Google Finance HTML scrape
        if (!resItem || !resItem.price || resItem.price <= 0) {
          Logger.log("Yahoo returned 0 for " + s + ", trying Google Finance HTML scrape fallback...");
          resItem = fetchViaScrape(s);
        }
      }

      var meta = isinMetaMap[s] || isinMetaMap[rawOrig];
      if (meta && resItem) {
        resItem.company = meta.company;
        resItem.isin = meta.isin || (isinPattern.test(rawOrig) ? rawOrig : null);
        resItem.category = meta.category;
      }

      assignResultsWithAliases(results, s, rawOrig, resItem);
    }

  } catch (err) {
    Logger.log("Error in doGet: " + err.toString());
    for (var k = 0; k < symbols.length; k++) {
      var sym2 = symbols[k].toUpperCase().trim();
      var rawOrig2 = isinOrigMap[sym2] || sym2;
      if (!results[sym2] || !results[sym2].price) {
        var yRes = fetchViaYahooFinance(sym2, marketParam === "US" || isLikelyUS(sym2));
        var fbItem = (yRes && yRes.price > 0) ? yRes : fetchViaScrape(sym2);
        var meta2 = isinMetaMap[sym2] || isinMetaMap[rawOrig2];
        if (meta2 && fbItem) {
          fbItem.company = meta2.company;
          fbItem.isin = meta2.isin || (isinPattern.test(rawOrig2) ? rawOrig2 : null);
          fbItem.category = meta2.category;
        }
        assignResultsWithAliases(results, sym2, rawOrig2, fbItem);
      }
    }
  } finally {
    try {
      DriveApp.getFileById(ss.getId()).setTrashed(true);
    } catch (cleanupErr) {
      Logger.log("Cleanup error: " + cleanupErr);
    }
  }

  return createJsonResponse(results);
}

/**
 * Assigns result item to canonical ticker, raw requested symbol, and mutual aliases.
 */
function assignResultsWithAliases(results, canonicalSym, rawOrig, item) {
  if (!item) return;
  results[canonicalSym] = item;
  if (rawOrig && rawOrig !== canonicalSym) {
    results[rawOrig] = item;
  }
  if (item.isin && item.isin !== canonicalSym && item.isin !== rawOrig) {
    results[item.isin] = item;
  }
  if (canonicalSym === "ICICIB22") results["BHARAT22"] = item;
  if (canonicalSym === "BHARAT22") results["ICICIB22"] = item;
  if (canonicalSym === "SILVERBEES") results["NETFSILVER"] = item;
  if (canonicalSym === "BAJAJCON") results["BAJAJCORP"] = item;
  if (canonicalSym === "GOLDBEES") results["GOLD1"] = item;
  if (canonicalSym === "GLAND") results["INE068V01023"] = item;
  if (canonicalSym === "SBCL") results["INE386D01027"] = item;
}

/**
 * Fallback 1: Direct Yahoo Finance Chart API.
 * Google Apps Script runs server-side on Google Cloud, so there are ZERO CORS restrictions.
 */
function fetchViaYahooFinance(symbol, isUS) {
  try {
    var sym = symbol.toUpperCase().trim();
    var yahooSym = sym;
    if (sym.indexOf(":") !== -1) {
      yahooSym = sym.split(":")[1];
    } else if (isUS || isLikelyUS(sym)) {
      yahooSym = sym;
    } else {
      yahooSym = sym + ".NS";
    }

    var url = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(yahooSym) + "?interval=1d&range=1d";
    var resp = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
    });

    if (resp.getResponseCode() === 200) {
      var json = JSON.parse(resp.getContentText());
      var meta = json && json.chart && json.chart.result && json.chart.result[0] && json.chart.result[0].meta;
      if (meta && Number(meta.regularMarketPrice) > 0) {
        var price = Number(meta.regularMarketPrice);
        var prevClose = Number(meta.chartPreviousClose || meta.previousClose || price);
        var change = price - prevClose;
        var changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
        return {
          symbol: sym,
          price: price,
          prevClose: prevClose,
          change: change,
          changePct: changePct,
          date: Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, hh:mm a"),
          source: "yahoo-chart"
        };
      }
    }
  } catch (e) {
    Logger.log("Yahoo Finance API fallback error for " + symbol + ": " + e);
  }
  return null;
}

/**
 * Fallback 2: Scrape price from Google Finance HTML page.
 */
function fetchViaScrape(symbol) {
  var sym = symbol.toUpperCase().trim();
  var urls = [];
  
  if (sym.indexOf(":") !== -1) {
    urls.push("https://www.google.com/finance/quote/" + encodeURIComponent(sym));
  } else if (isLikelyUS(sym)) {
    var exchange = US_EXCHANGES[sym] || "NASDAQ";
    urls.push("https://www.google.com/finance/quote/" + sym + ":" + exchange);
    if (exchange === "NYSEARCA") {
      urls.push("https://www.google.com/finance/quote/" + sym + ":NASDAQ");
    }
    urls.push("https://www.google.com/finance/quote/" + sym + ":NYSE");
    urls.push("https://www.google.com/finance/quote/" + sym + ":NASDAQ");
  } else {
    urls.push("https://www.google.com/finance/quote/" + sym + ":NSE");
    urls.push("https://www.google.com/finance/quote/" + sym + ":BOM");
  }
  
  for (var i = 0; i < urls.length; i++) {
    try {
      var response = UrlFetchApp.fetch(urls[i], { muteHttpExceptions: true, followRedirects: true });
      if (response.getResponseCode() !== 200) continue;
      var html = response.getContentText();

      // Modern and legacy Google Finance price matchers
      var priceMatch = html.match(/class="YMlKec fxKbKc">₹?([0-9,]+\.?[0-9]*)</) ||
                       html.match(/data-last-price="([\d\.]+)"/) ||
                       html.match(/\["(\d+\.?\d*)",null,null,null,\["INR"\]\]/);

      var prevCloseMatch = html.match(/class="P6K39c">₹?([0-9,]+\.?[0-9]*)</) ||
                           html.match(/data-previous-close="([\d\.]+)"/);

      if (!priceMatch) continue;
      var price = Number(priceMatch[1].replace(/,/g, "")) || 0;
      if (price <= 0) continue;

      var prevClose = prevCloseMatch ? (Number(prevCloseMatch[1].replace(/,/g, "")) || price) : price;
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

  return { symbol: sym, error: "Price not found after trying " + urls.length + " sources", price: 0 };
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
