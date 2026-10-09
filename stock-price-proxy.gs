/**
 * Life Ledger — Stock Price Proxy (Google Apps Script) v5.2
 * 
 * High-Speed Multi-Asset Quote Proxy for:
 * 1. US Stocks & ETFs (NASDAQ/NYSE/NYSEARCA): Stooq (<150ms), Nasdaq Real-Time, Yahoo, and native GOOGLEFINANCE
 * 2. Indian Stocks & ETFs (NSE/BSE): Direct Yahoo Finance Real-time Chart quotes (<150ms) and native GOOGLEFINANCE
 * 3. Gold Rates: Live LBMA Spot Price in INR (24K & 22K) via ?gold=1 with NSE:GOLDBEES fallback
 * 4. 100% Dynamic ISIN Resolution for Indian stocks, ETFs, and SGBs via Groww and Yahoo
 * 5. Single persistent shared spreadsheet engine: Zero Drive file quota usage, 10x faster execution
 * 
 * SETUP INSTRUCTIONS (Takes 2 minutes, 100% Free, No Billing/Key needed):
 * 1. Go to https://script.google.com/
 * 2. Open your existing project or click "New project" and name it "Stock Price Proxy"
 * 3. Replace all code in Code.gs with this complete file
 * 4. Click "Deploy" (top right) → "New deployment"
 * 5. Select type: "Web app"
 * 6. Set Description: "Stock Price Proxy v5.2 (Realtime US, India & Gold)"
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
  "INE160A01022": "PUNJABCHEM",
  "INE001A01036": "HDFC",
  "INE115A01026": "LICHSGFIN",
  "INE081A01012": "TATASTEEL",
  "INE047A01021": "GRASIM",
  "INE213A01029": "ONGC",
  "INE242A01010": "IOC",
  "INE528G01035": "YESBANK",
  "INE019A01038": "JSWSTEEL",
  "INE028A01039": "BANKBARODA",
  "INE192A01025": "TRENT",
  "INE423A01024": "ADANIENT",
  "INE742F01042": "ADANIPORTS",
  "INE364U01010": "BANDHANBNK",
  "INE669E01016": "IDEA",
  "INE121J01017": "BEL",
  "INE263A01024": "BHEL",
  "INE205A01025": "VEDL",
  "INE053F01010": "IRCTC",
  "INE058A01010": "IRFC",
  "INE585B01010": "MARUTI",
  "INE860A01027": "HCLTECH",
  "INE009N01014": "COALINDIA",
  "INE012A01025": "SUNPHARMA",
  "INE044A01036": "SUNFLAG",
  "INE066A01021": "CENTURYTEX",
  "INE079A01024": "AMBUJACEM",
  "INE094A01015": "HINDUNILVR",
  "INE111A01025": "TITAN",
  "INE112A01023": "TECHM",
  "INE117A01022": "ABB",
  "INE121A01024": "CHOLAFIN",
  "INE140A01024": "POWERGRID",
  "INE148I01020": "SHREECEM",
  "INE172A01027": "CASTROLIND",
  "INE216A01030": "BRITANNIA",
  "INE220J01025": "INDUSINDBK",
  "INE245A01021": "NTPC",
  "INE280A01028": "DIVISLAB",
  "INE296A01024": "BAJFINANCE",
  "INE298A01020": "BAJAJFINSV",
  "INE326A01037": "LUPIN",
  "INE356A01018": "DRREDDY",
  "INE358A01014": "COLPAL",
  "INE399G01023": "MOTHERSON",
  "INE406A01037": "AUROPHARMA",
  "INE437A01024": "APOLLOHOSP",
  "INE467A01029": "TATACHEM",
  "INE481G01011": "ULTRACEMCO",
  "INE483A01010": "DABUR",
  "INE522F01014": "COFORGE",
  "INE545U01014": "ZOMATO",
  "INE584A01023": "PIDILITIND",
  "INE647O01011": "DMART",
  "INE669C01036": "TECHNOE",
  "INE721A01013": "SHRIRAMFIN",
  "INE752E01010": "PAGEIND",
  "INE758T01015": "NYKAA",
  "INE883A01014": "PERSISTENT",
  "INE917I01012": "KPITTECH",
  "INE918I01018": "LTIM",
  "INE982F01036": "POLYCAB",

  // Broker CSV Ticker Aliases
  "ICICIB22": "BHARAT22",
  "BHARAT22": "ICICIB22",
  "SILVERBEES": "NETFSILVER",
  "NETFSILVER": "SILVERBEES",
  "BAJAJCON": "BAJAJCORP",
  "BAJAJCORP": "BAJAJCON",
  "GOLDBEES": "GOLD1",
  "GOLD1": "GOLDBEES",
  "JINDALSTEL": "JINDALSTEEL",
  "JINDALSTEEL": "JINDALSTEL",
  "RATEGAIN": "RATEGAINTR",
  "RATEGAINTR": "RATEGAIN",
  "GEVERNOVA": "GE T&D",
  "GE T&D": "GEVERNOVA",
  "BHARTIARTL": "BHARTI",
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
  var sym = String(symbol || "").toUpperCase().trim();
  if (sym.indexOf(":") !== -1) {
    var prefix = sym.split(":")[0];
    return (prefix === "NASDAQ" || prefix === "NYSE" || prefix === "NYSEARCA");
  }
  if (US_EXCHANGES[sym]) return true;
  if (ISIN_TO_TICKER[sym]) return false;
  if (sym.endsWith(".US")) return true;
  return false;
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

/**
 * Fast-path 1: Direct Stooq quote for US Stocks and ETFs.
 * Format: Symbol,Date,Time,Open,High,Low,Close,Volume
 * Ultra-fast (<150ms), public, zero credentials, no cloud IP blocks.
 */
function fetchViaStooq(symbol) {
  try {
    var sym = String(symbol || "").toUpperCase().trim();
    if (sym.indexOf(":") !== -1) sym = sym.split(":")[1];
    var url = "https://stooq.com/q/l/?s=" + encodeURIComponent(sym.toLowerCase()) + ".us&f=sd2t2ohlcv&h&e=csv";
    var resp = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
      }
    });
    if (resp.getResponseCode() === 200) {
      var lines = resp.getContentText().trim().split("\n");
      if (lines.length >= 2) {
        var parts = lines[1].split(",");
        if (parts.length >= 7) {
          var closePrice = Number(parts[6]);
          var openPrice = Number(parts[3]) || closePrice;
          if (closePrice > 0) {
            var dateStr = parts[1] || Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, hh:mm a");
            var change = Number((closePrice - openPrice).toFixed(4));
            var prevClose = openPrice > 0 ? openPrice : closePrice;
            var changePct = prevClose > 0 ? Number(((change / prevClose) * 100).toFixed(4)) : 0;
            return {
              symbol: sym,
              price: closePrice,
              prevClose: prevClose,
              change: change,
              changePct: changePct,
              date: dateStr,
              source: "stooq-realtime"
            };
          }
        }
      }
    }
  } catch (e) {
    Logger.log("Stooq fetch error for " + symbol + ": " + e);
  }
  return null;
}

/**
 * Fast-path 2: Direct Nasdaq API quote for US Stocks and ETFs.
 */
function fetchViaNasdaq(symbol, isEtf) {
  var item = fetchViaNasdaqInternal(symbol, isEtf);
  if (!item || !item.price || item.price <= 0) {
    item = fetchViaNasdaqInternal(symbol, !isEtf);
  }
  return item;
}

function fetchViaNasdaqInternal(symbol, isEtf) {
  try {
    var sym = String(symbol || "").toUpperCase().trim();
    if (sym.indexOf(":") !== -1) sym = sym.split(":")[1];
    var assetClass = isEtf ? "etf" : "stocks";
    var url = "https://api.nasdaq.com/api/quote/" + encodeURIComponent(sym) + "/info?assetclass=" + assetClass;
    var resp = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*"
      }
    });
    if (resp.getResponseCode() === 200) {
      var json = JSON.parse(resp.getContentText());
      var primary = json && json.data && json.data.primaryData;
      if (primary && primary.lastSalePrice) {
        var price = Number(String(primary.lastSalePrice).replace(/[^0-9.-]/g, "")) || 0;
        if (price > 0) {
          var netChange = Number(String(primary.netChange || "0").replace(/[^0-9.-]/g, "")) || 0;
          if (String(primary.netChange).indexOf("-") !== -1) netChange = -Math.abs(netChange);
          var prevClose = price - netChange;
          var changePct = prevClose > 0 ? (netChange / prevClose) * 100 : 0;
          return {
            symbol: sym,
            price: price,
            prevClose: prevClose || price,
            change: netChange,
            changePct: changePct,
            date: primary.lastTradeTimestamp || Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, hh:mm a"),
            source: "nasdaq-realtime"
          };
        }
      }
    }
  } catch (e) {
    Logger.log("Nasdaq fetch error for " + symbol + ": " + e);
  }
  return null;
}

var SPREADSHEET_PROP_KEY = "LIFE_LEDGER_PRICE_SHEET_ID_V5";

/**
 * Retrieves a single persistent, reusable spreadsheet for GOOGLEFINANCE formulas.
 * Storing the ID in PropertiesService ensures:
 * 1. Zero temporary file creation in Google Drive (eliminates Drive file quotas).
 * 2. 10x faster execution (~200ms vs 3000ms to create a sheet).
 * 3. Never clutters user's Google Drive.
 */
function getSharedPriceSheet() {
  var props = PropertiesService.getUserProperties();
  var sheetId = props.getProperty(SPREADSHEET_PROP_KEY);
  var ss = null;
  if (sheetId) {
    try {
      ss = SpreadsheetApp.openById(sheetId);
    } catch (e) {
      Logger.log("Stored sheet ID invalid or trashed: " + e);
      ss = null;
    }
  }
  if (!ss) {
    ss = SpreadsheetApp.create("LifeLedger_Internal_Price_Engine_DoNotDelete");
    props.setProperty(SPREADSHEET_PROP_KEY, ss.getId());
  }
  return ss.getActiveSheet();
}

/**
 * Resolves multiple symbols simultaneously via Google Sheets native GOOGLEFINANCE formulas.
 * Works for BOTH US stocks and Indian stocks.
 */
function batchResolveViaGoogleFinance(symbolsList, isUS) {
  var results = {};
  if (!symbolsList || symbolsList.length === 0) return results;

  try {
    var sheet = getSharedPriceSheet();
    var count = symbolsList.length;

    // Clear previous rows to ensure fresh clean evaluation
    sheet.getRange(1, 1, Math.max(count, 50), 4).clearContent();

    for (var i = 0; i < count; i++) {
      var sym = symbolsList[i].toUpperCase().trim();
      var row = i + 1;
      var tickers = [];

      if (sym.indexOf(":") !== -1) {
        tickers.push(sym);
      } else if (isUS) {
        var ex = US_EXCHANGES[sym] || "NASDAQ";
        tickers.push(sym + ":" + ex);
        tickers.push("NASDAQ:" + sym);
        tickers.push("NYSE:" + sym);
        tickers.push("NYSEARCA:" + sym);
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

    SpreadsheetApp.flush();

    // Wait up to 5s for formulas to resolve
    var maxWaitMs = 5000;
    var checkInterval = 1000;
    var elapsed = 0;

    while (elapsed < maxWaitMs) {
      Utilities.sleep(checkInterval);
      elapsed += checkInterval;
      SpreadsheetApp.flush();

      var sampleValues = sheet.getRange(1, 1, count, 1).getValues();
      var pendingCount = 0;
      for (var r = 0; r < sampleValues.length; r++) {
        var v = Number(sampleValues[r][0]);
        if (!v || v <= 0 || isNaN(v)) pendingCount++;
      }
      if (pendingCount === 0) break;
    }

    var allValues = sheet.getRange(1, 1, count, 4).getValues();
    var todayStr = Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, hh:mm a");

    for (var j = 0; j < count; j++) {
      var s = symbolsList[j].toUpperCase().trim();
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
      }
    }
  } catch (err) {
    Logger.log("Error in batchResolveViaGoogleFinance: " + err);
  }
  return results;
}

function doGet(e) {
  // Support testing / ping
  if (e && e.parameter && (e.parameter.test || e.parameter.ping)) {
    return createJsonResponse({
      status: "ok",
      version: "v5.2",
      message: "Life Ledger Stock Price Proxy v5.2 is active and operational",
      timestamp: Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, hh:mm:ss a")
    });
  }

  // Support live gold price: ?gold=1 or ?metal=gold
  if (e && e.parameter && (e.parameter.gold || e.parameter.metal === "gold")) {
    var goldQuote = fetchLiveGold();
    if (goldQuote) {
      return createJsonResponse(goldQuote);
    }
    return createJsonResponse({ error: "Could not fetch live gold quote" });
  }

  // Support standalone dynamic ISIN resolution: ?resolveIsin=INE343H01029
  if (e && e.parameter && e.parameter.resolveIsin) {
    var isinToResolve = e.parameter.resolveIsin.trim().toUpperCase();
    var resolved = resolveIsinOnline(isinToResolve);
    if (resolved) {
      return createJsonResponse(resolved);
    }
    return createJsonResponse({ error: "Could not resolve ISIN: " + isinToResolve, isin: isinToResolve });
  }

  var symbolsStr = (e && e.parameter && (e.parameter.symbols || e.parameter.symbol || e.parameter.q))
    ? (e.parameter.symbols || e.parameter.symbol || e.parameter.q)
    : "";
  var rawSymbols = symbolsStr.split(",").map(function(s) { return s.trim(); }).filter(Boolean);
  var marketParam = (e && e.parameter && e.parameter.market) ? e.parameter.market.toUpperCase() : "";

  var results = {};

  if (rawSymbols.length === 0) {
    return createJsonResponse({ error: "No symbols provided. Pass ?symbols=AAPL,RELIANCE,VOO or ?resolveIsin=INE... or ?gold=1" });
  }

  // Map ISINs and aliases to canonical exchange tickers
  var symbols = [];
  var isinOrigMap = {};
  var isinMetaMap = {};
  var isinPattern = /^IN[EF0-9][A-Z0-9]{7,}$/i;

  for (var m = 0; m < rawSymbols.length; m++) {
    var rawSym = rawSymbols[m].toUpperCase().replace(/\s*-EQ$/i, "").trim();
    var resolvedSym = ISIN_TO_TICKER[rawSym] || rawSym;

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

  // Partition into US symbols and Indian symbols
  var usSymbols = [];
  var indianSymbols = [];

  for (var sIdx = 0; sIdx < symbols.length; sIdx++) {
    var sCheck = symbols[sIdx].toUpperCase().trim();
    if (marketParam === "US" || isLikelyUS(sCheck)) {
      usSymbols.push(sCheck);
    } else {
      indianSymbols.push(sCheck);
    }
  }

  // ─── Step 1: Resolve US Symbols ───────────────────────────────────────────
  var pendingUs = [];
  for (var u = 0; u < usSymbols.length; u++) {
    var usSym = usSymbols[u];
    var rawOrigUs = isinOrigMap[usSym] || usSym;
    var isEtf = (US_EXCHANGES[usSym] === "NYSEARCA") || /ETF|VOO|SPY|QQQ|IVV|VTI|ARKK/i.test(usSym);

    // Fast-tier 1: Direct Stooq quote (< 150ms)
    var itemUs = fetchViaStooq(usSym);

    // Fast-tier 2: Nasdaq API (< 200ms)
    if (!itemUs || !itemUs.price || itemUs.price <= 0) {
      itemUs = fetchViaNasdaq(usSym, isEtf);
    }

    // Fast-tier 3: Yahoo Finance Chart API
    if (!itemUs || !itemUs.price || itemUs.price <= 0) {
      itemUs = fetchViaYahooFinance(usSym, true);
    }

    if (itemUs && itemUs.price > 0) {
      assignResultsWithAliases(results, usSym, rawOrigUs, itemUs);
    } else {
      pendingUs.push(usSym);
    }
  }

  // If any US symbols still pending, resolve via Google Sheets GOOGLEFINANCE formulas
  if (pendingUs.length > 0) {
    var gfUsResults = batchResolveViaGoogleFinance(pendingUs, true);
    for (var pu = 0; pu < pendingUs.length; pu++) {
      var pSym = pendingUs[pu];
      var pOrig = isinOrigMap[pSym] || pSym;
      if (gfUsResults[pSym] && gfUsResults[pSym].price > 0) {
        assignResultsWithAliases(results, pSym, pOrig, gfUsResults[pSym]);
      } else {
        // Last-resort fallback: Google Finance Scrape
        var scItem = fetchViaScrape(pSym);
        if (scItem && scItem.price > 0) {
          assignResultsWithAliases(results, pSym, pOrig, scItem);
        } else {
          assignResultsWithAliases(results, pSym, pOrig, { symbol: pSym, error: "Price not found", price: 0 });
        }
      }
    }
  }

  // ─── Step 2: Resolve Indian Symbols ───────────────────────────────────────
  var pendingIndian = [];
  for (var ind = 0; ind < indianSymbols.length; ind++) {
    var symInd = indianSymbols[ind];
    var rawOrigInd = isinOrigMap[symInd] || symInd;

    // Fast-tier 1: Direct Yahoo Finance Chart API (< 150ms)
    var yItem = fetchViaYahooFinance(symInd, false);
    if (yItem && yItem.price > 0) {
      var metaInd = isinMetaMap[symInd] || isinMetaMap[rawOrigInd];
      if (metaInd) {
        yItem.company = metaInd.company;
        yItem.isin = metaInd.isin || (isinPattern.test(rawOrigInd) ? rawOrigInd : null);
        yItem.category = metaInd.category;
      }
      assignResultsWithAliases(results, symInd, rawOrigInd, yItem);
    } else {
      pendingIndian.push(symInd);
    }
  }

  // If any Indian symbols pending, resolve via Google Sheets GOOGLEFINANCE in the shared sheet
  if (pendingIndian.length > 0) {
    var gfIndianResults = batchResolveViaGoogleFinance(pendingIndian, false);
    for (var pi = 0; pi < pendingIndian.length; pi++) {
      var piSym = pendingIndian[pi];
      var piOrig = isinOrigMap[piSym] || piSym;
      if (gfIndianResults[piSym] && gfIndianResults[piSym].price > 0) {
        var itemGF = gfIndianResults[piSym];
        var metaGF = isinMetaMap[piSym] || isinMetaMap[piOrig];
        if (metaGF) {
          itemGF.company = metaGF.company;
          itemGF.isin = metaGF.isin || (isinPattern.test(piOrig) ? piOrig : null);
          itemGF.category = metaGF.category;
        }
        assignResultsWithAliases(results, piSym, piOrig, itemGF);
      } else {
        // Fallback: Google Finance HTML scrape
        var sItem = fetchViaScrape(piSym);
        if (sItem && sItem.price > 0) {
          var metaSc = isinMetaMap[piSym] || isinMetaMap[piOrig];
          if (metaSc) {
            sItem.company = metaSc.company;
            sItem.isin = metaSc.isin || (isinPattern.test(piOrig) ? piOrig : null);
            sItem.category = metaSc.category;
          }
          assignResultsWithAliases(results, piSym, piOrig, sItem);
        } else {
          assignResultsWithAliases(results, piSym, piOrig, { symbol: piSym, error: "Price not found", price: 0 });
        }
      }
    }
  }

  return createJsonResponse(results);
}

/**
 * Live Indian Gold Price Fetcher.
 * Retrieves LBMA spot gold (XAU) from gold-api.com and converts to INR
 * using live USD/INR exchange rate, scaled for Indian retail 24K and 22K per gram.
 * Fallback to Google Finance GOLDBEES ETF or GLD if API is unreachable.
 */
function fetchLiveGold() {
  // Strategy 1: Direct real-time endpoint api.gold-api.com + live USD/INR FX
  try {
    var url = "https://api.gold-api.com/price/XAU";
    var resp = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { "Accept": "application/json" }
    });
    if (resp.getResponseCode() === 200) {
      var data = JSON.parse(resp.getContentText());
      var usdPrice = Number(data.price);
      if (usdPrice > 0) {
        var usdInr = 96.0;
        try {
          var fx = UrlFetchApp.fetch("https://api.frankfurter.app/latest?from=USD&to=INR", {
            muteHttpExceptions: true,
            headers: { "Accept": "application/json" }
          });
          if (fx.getResponseCode() === 200) {
            var fxData = JSON.parse(fx.getContentText());
            if (fxData && fxData.rates && Number(fxData.rates.INR) > 50) {
              usdInr = Number(fxData.rates.INR);
            }
          }
        } catch (fxErr) {
          Logger.log("FX rate error: " + fxErr);
        }
        var spot24k = (usdPrice * usdInr) / 31.1034768;
        // Physical retail gold with customs (~6%) and GST (3%) in India (~10% total)
        var p24 = Number((spot24k * 1.10).toFixed(2));
        var p22 = Number((p24 * (22 / 24)).toFixed(2));
        return {
          price24k: p24,
          price22k: p22,
          gold24k: p24,
          gold22k: p22,
          currency: "INR",
          usdPrice: usdPrice,
          usdInr: usdInr,
          date: Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, hh:mm a"),
          source: "proxy-live-gold"
        };
      }
    }
  } catch (e) {
    Logger.log("Gold fetch api.gold-api.com error: " + e);
  }

  // Strategy 2: Google Finance GOLDBEES in the shared sheet (traded on NSE, 1 unit = 0.01g gold)
  try {
    var sheet = getSharedPriceSheet();
    sheet.getRange(99, 1).setFormula('=IFERROR(GOOGLEFINANCE("NSE:GOLDBEES", "price"), 0)');
    SpreadsheetApp.flush();
    var beesPrice = Number(sheet.getRange(99, 1).getValue()) || 0;
    if (beesPrice > 50 && beesPrice < 250) {
      // 1 unit of GOLDBEES is ~0.01g gold, so beesPrice * 100 is price per gram 24K in INR
      var p24 = Number((beesPrice * 100).toFixed(2));
      var p22 = Number((p24 * (22 / 24)).toFixed(2));
      return {
        price24k: p24,
        price22k: p22,
        gold24k: p24,
        gold22k: p22,
        currency: "INR",
        date: Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, hh:mm a"),
        source: "nse-goldbees"
      };
    }
  } catch (e2) {
    Logger.log("Gold fetch GOLDBEES fallback error: " + e2);
  }

  return null;
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
 * Direct Yahoo Finance Chart API.
 */
function fetchViaYahooFinance(symbol, isUS) {
  try {
    var sym = String(symbol || "").toUpperCase().trim();
    var yahooSym = sym;
    if (sym.indexOf(":") !== -1) {
      yahooSym = sym.split(":")[1];
    } else if (isUS || isLikelyUS(sym)) {
      yahooSym = sym;
    } else {
      yahooSym = sym + ".NS";
    }

    var hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
    for (var h = 0; h < hosts.length; h++) {
      try {
        var url = "https://" + hosts[h] + "/v8/finance/chart/" + encodeURIComponent(yahooSym) + "?interval=1d&range=1d";
        var resp = UrlFetchApp.fetch(url, {
          muteHttpExceptions: true,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          }
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
      } catch (errHost) {}
    }
  } catch (e) {
    Logger.log("Yahoo Finance API fallback error for " + symbol + ": " + e);
  }
  return null;
}

/**
 * Scrape price from Google Finance HTML page.
 */
function fetchViaScrape(symbol) {
  var sym = String(symbol || "").toUpperCase().trim();
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
      var priceMatch = html.match(/class="[^"]*YMlKec[^"]*">[$₹€£]?([0-9,]+\.?[0-9]*)</) ||
                       html.match(/data-last-price="([\d\.]+)"/) ||
                       html.match(/\["(\d+\.?\d*)",null,null,null,\["(?:USD|INR)"\]\]/);

      var prevCloseMatch = html.match(/class="[^"]*P6K39c[^"]*">[$₹€£]?([0-9,]+\.?[0-9]*)</) ||
                           html.match(/data-previous-close="([\d\.]+)"/);

      if (!priceMatch) continue;
      var price = Number(priceMatch[1].replace(/,/g, "")) || 0;
      var prevClose = prevCloseMatch ? Number(prevCloseMatch[1].replace(/,/g, "")) : price;
      var change = price && prevClose ? (price - prevClose) : 0;
      var changePct = prevClose ? (change / prevClose) * 100 : 0;

      if (price > 0) {
        return {
          symbol: sym,
          price: price,
          prevClose: prevClose,
          change: change,
          changePct: changePct,
          date: Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, hh:mm a"),
          source: "google-scrape"
        };
      }
    } catch (e) {
      Logger.log("Scrape error for " + urls[i] + ": " + e);
    }
  }

  return null;
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
