/**
 * Life Ledger — Stock Price Proxy (Google Apps Script) v5.6
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
 * 6. Set Description: "Stock Price Proxy v5.6 (Realtime US, India & Gold)"
 * 7. Set Execute as: "Me"
 * 8. Set Who has access: "Anyone"
 * 9. Click "Deploy", authorize access, and copy the Web App URL
 * 10. Open Life Ledger → Settings → 📈 Stock Prices → Paste URL & Save!
 *
 * AUTO-REFRESH (works even when the app is closed) - one-time setup:
 *   In the Apps Script editor pick the function setupAutoRefreshTriggers and click Run (authorize).
 *   It creates triggers: every 6 hours + every night ~11:45 PM IST. Each run saves a price record
 *   (Indian stocks, US stocks, mutual fund NAVs, gold, USD/INR) to a 'PriceLedger' sheet. The app
 *   registers only the ticker symbols / fund codes to track (never quantities or amounts) and,
 *   when opened, back-fills any missed days of net worth history from these records.
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

// Fallback only (GoodReturns unreachable): Mumbai 24K Rs15,142/g on 11 Oct 2026 / LBMA spot at USD/INR 96.73 = ~1.16
var GOLD_INDIA_PREMIUM = 1.16;

var SPREADSHEET_PROP_KEY = "LIFE_LEDGER_PRICE_SHEET_ID_V5";

/**
 * Retrieves a single persistent, reusable spreadsheet for GOOGLEFINANCE formulas.
 * Storing the ID in PropertiesService ensures:
 * 1. Zero temporary file creation in Google Drive (eliminates Drive file quotas).
 * 2. 10x faster execution (~200ms vs 3000ms to create a sheet).
 * 3. Never clutters user's Google Drive.
 */
function getSharedPriceSheet() {
  return getSharedSpreadsheet().getActiveSheet();
}

function getSharedSpreadsheet() {
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
  return ss;
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
        tickers.push(ex + ":" + sym);
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
  // Advisor: daily price history for holdings and benchmarks (public market data)
  if (e && e.parameter && e.parameter.history) {
    return createJsonResponse(readHistory(e.parameter.history, e.parameter.days));
  }

  // Sync gateway: fresh devices ask whether a vault exists (no secrets returned)
  if (e && e.parameter && e.parameter.syncMeta) {
    return createJsonResponse(syncMeta_());
  }

  // Support testing / ping
  if (e && e.parameter && (e.parameter.test || e.parameter.ping)) {
    return createJsonResponse({
      status: "ok",
      version: "v5.6",
      message: "Life Ledger Stock Price Proxy v5.6 is active and operational",
      timestamp: Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, hh:mm:ss a")
    });
  }

  // Batch version (one AMFI download for many funds): ?resolveMfMany=name1||name2||ISIN3
  if (e && e.parameter && e.parameter.resolveMfMany) {
    return createJsonResponse(resolveMfMany(String(e.parameter.resolveMfMany)));
  }
  // Dynamic mutual fund resolution from AMFI's official list: ?resolveMf=<ISIN | scheme code | fund name>
  if (e && e.parameter && e.parameter.resolveMf) {
    return createJsonResponse(resolveMfOnline(String(e.parameter.resolveMf).trim()));
  }

  // Auto-refresh backend: register watchlist, read ledger, manual collect
  if (e && e.parameter && e.parameter.registerWatch) {
    return createJsonResponse(registerWatchlist(e.parameter));
  }
  if (e && e.parameter && e.parameter.ledger) {
    return createJsonResponse(readPriceLedger(e.parameter.since));
  }
  if (e && e.parameter && e.parameter.collect) {
    return createJsonResponse(collectPricesNow("manual"));
  }

  // Support live USD/INR rate: ?fx=1
  if (e && e.parameter && e.parameter.fx) {
    var fxQuote = fetchViaYahooFinance("USDINR=X", true);
    if (fxQuote && fxQuote.price > 50) {
      return createJsonResponse({ usdInr: fxQuote.price, prevClose: fxQuote.prevClose, source: "yahoo-fx", date: fxQuote.date });
    }
    return createJsonResponse({ error: "Could not fetch USD/INR rate" });
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
  // Primary: Yahoo chart (accurate prev close + extended-hours price).
  // GOOGLEFINANCE is only a fallback: it can return multi-day-stale quotes for some ETFs.
  var pendingUs = [];
  for (var u = 0; u < usSymbols.length; u++) {
    var usSym = usSymbols[u];
    var rawOrigUs = isinOrigMap[usSym] || usSym;
    var yUs = fetchViaYahooFinance(usSym, true);
    if (yUs && yUs.price > 0) {
      assignResultsWithAliases(results, usSym, rawOrigUs, yUs);
    } else {
      pendingUs.push(usSym);
    }
  }

  if (pendingUs.length > 0) {
    var gfUsResults = batchResolveViaGoogleFinance(pendingUs, true);
    var stillPendingUs = [];
    for (var g = 0; g < pendingUs.length; g++) {
      var gSym = pendingUs[g];
      if (gfUsResults[gSym] && gfUsResults[gSym].price > 0) {
        assignResultsWithAliases(results, gSym, isinOrigMap[gSym] || gSym, gfUsResults[gSym]);
      } else {
        stillPendingUs.push(gSym);
      }
    }
    pendingUs = stillPendingUs;
  }

  // Fallback: Nasdaq & Web Scrape for any un-resolved US symbols
  for (var pu = 0; pu < pendingUs.length; pu++) {
    var pSym = pendingUs[pu];
    var pOrig = isinOrigMap[pSym] || pSym;
    var isEtf = (US_EXCHANGES[pSym] === "NYSEARCA") || /ETF|VOO|SPY|QQQ|IVV|VTI|ARKK/i.test(pSym);

    var itemUs = fetchViaNasdaq(pSym, isEtf);
    if (itemUs && itemUs.price > 0) {
      assignResultsWithAliases(results, pSym, pOrig, itemUs);
    } else {
      var scItem = fetchViaScrape(pSym);
      if (scItem && scItem.price > 0) {
        assignResultsWithAliases(results, pSym, pOrig, scItem);
      } else {
        assignResultsWithAliases(results, pSym, pOrig, { symbol: pSym, error: "Price not found", price: 0 });
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
/**
 * Indian retail gold rate from GoodReturns (Mumbai) - the same rate INDmoney shows.
 * Returns null if the page layout changes or the site is unreachable.
 */
function fetchGoldFromGoodReturns() {
  try {
    var resp = UrlFetchApp.fetch("https://www.goodreturns.in/gold-rates/mumbai.html", {
      muteHttpExceptions: true,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" }
    });
    if (resp.getResponseCode() !== 200) return null;
    var html = resp.getContentText();
    var m = html.match(/currentMetalPrices\s*=\s*\{[^}]*?'24'\s*:\s*(\d+)[^}]*?'22'\s*:\s*(\d+)[^}]*?'18'\s*:\s*(\d+)/);
    if (!m) return null;
    var p24 = Number(m[1]);
    if (!(p24 >= 5000 && p24 <= 35000)) return null;
    var p22 = Number((p24 * 22 / 24).toFixed(2));

    // Previous close = most recent different rate in the history table
    var pc24 = p24;
    var rowRe = /<td>[A-Z][a-z]{2} \d{1,2}, \d{4}<\/td>\s*<td>\s*(?:&#x20b9;|\u20b9)\s*([\d,]+)/g;
    var row;
    while ((row = rowRe.exec(html)) !== null) {
      var v = Number(row[1].replace(/,/g, ""));
      if (v > 0 && v !== p24) { pc24 = v; break; }
    }
    var pc22 = Number((pc24 * 22 / 24).toFixed(2));
    var ch24 = Number((p24 - pc24).toFixed(2));
    return {
      price24k: p24,
      price22k: p22,
      prevClose24k: pc24,
      prevClose22k: pc22,
      change24k: ch24,
      changePct: pc24 > 0 ? Number(((ch24 / pc24) * 100).toFixed(2)) : 0,
      gold24k: p24,
      gold22k: p22,
      currency: "INR",
      date: Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, hh:mm a"),
      source: "goodreturns-mumbai"
    };
  } catch (e) {
    Logger.log("GoodReturns gold error: " + e);
    return null;
  }
}

function fetchLiveGold() {
  var grQuote = fetchGoldFromGoodReturns();
  if (grQuote) return grQuote;

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
        // Indian base rate (excl. GST) = LBMA spot x GOLD_INDIA_PREMIUM (duty + domestic premium)
        var p24 = Number((spot24k * GOLD_INDIA_PREMIUM).toFixed(2));
        var p22 = Number((p24 * (22 / 24)).toFixed(2));
        var pc24 = p24;
        var pc22 = p22;
        var ch = Number(data.ch || data.change || 0);
        if (data.prev_close_price && Number(data.prev_close_price) > 0) {
          var prevSpot24k = (Number(data.prev_close_price) * usdInr) / 31.1034768;
          pc24 = Number((prevSpot24k * GOLD_INDIA_PREMIUM).toFixed(2));
          pc22 = Number((pc24 * (22 / 24)).toFixed(2));
        } else if (ch !== 0) {
          var prevUsd = usdPrice - ch;
          var prevSpot24k = (prevUsd * usdInr) / 31.1034768;
          pc24 = Number((prevSpot24k * GOLD_INDIA_PREMIUM).toFixed(2));
          pc22 = Number((pc24 * (22 / 24)).toFixed(2));
        }
        var ch24 = Number((p24 - pc24).toFixed(2));
        var chPct = pc24 > 0 ? Number(((ch24 / pc24) * 100).toFixed(2)) : 0;
        return {
          price24k: p24,
          price22k: p22,
          prevClose24k: pc24,
          prevClose22k: pc22,
          change24k: ch24,
          changePct: chPct,
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
    sheet.getRange(99, 2).setFormula('=IFERROR(GOOGLEFINANCE("NSE:GOLDBEES", "closeyest"), 0)');
    SpreadsheetApp.flush();
    var beesPrice = Number(sheet.getRange(99, 1).getValue()) || 0;
    var beesCloseYest = Number(sheet.getRange(99, 2).getValue()) || 0;
    if (beesPrice > 50 && beesPrice < 250) {
      // 1 unit of GOLDBEES is ~0.01g gold, so beesPrice * 100 is price per gram 24K in INR
      var p24 = Number((beesPrice * 100).toFixed(2));
      var p22 = Number((p24 * (22 / 24)).toFixed(2));
      var pc24 = beesCloseYest > 0 ? Number((beesCloseYest * 100).toFixed(2)) : p24;
      var pc22 = Number((pc24 * (22 / 24)).toFixed(2));
      var ch24 = Number((p24 - pc24).toFixed(2));
      var chPct = pc24 > 0 ? Number(((ch24 / pc24) * 100).toFixed(2)) : 0;
      return {
        price24k: p24,
        price22k: p22,
        prevClose24k: pc24,
        prevClose22k: pc22,
        change24k: ch24,
        changePct: chPct,
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
 * - Previous close is taken from the daily candles (second-to-last session). Yahoo's
 *   meta.chartPreviousClose is unreliable (it depends on the requested range).
 * - For US symbols the latest pre/post-market trade is used as the price when it is
 *   newer than the regular close, matching what INDmoney / broker apps display.
 */
function fetchViaYahooFinance(symbol, isUS) {
  try {
    var sym = String(symbol || "").toUpperCase().trim();
    var yahooSym = sym;
    var us = !!isUS;
    if (sym.indexOf(":") !== -1) {
      yahooSym = sym.split(":")[1];
    } else if (isUS || isLikelyUS(sym)) {
      yahooSym = sym;
      us = true;
    } else {
      yahooSym = sym + ".NS";
    }

    var hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
    for (var h = 0; h < hosts.length; h++) {
      try {
        var base = "https://" + hosts[h] + "/v8/finance/chart/" + encodeURIComponent(yahooSym);
        var json = yahooChartJson(base + "?interval=1d&range=5d");
        var result = json && json.chart && json.chart.result && json.chart.result[0];
        var meta = result && result.meta;
        if (!meta || !(Number(meta.regularMarketPrice) > 0)) continue;

        var price = Number(meta.regularMarketPrice);
        var regularPrice = price;

        // Daily closes (drop nulls); last entry is the latest session
        var closes = [];
        var rawCloses = (result.indicators && result.indicators.quote && result.indicators.quote[0] && result.indicators.quote[0].close) || [];
        for (var c = 0; c < rawCloses.length; c++) {
          if (rawCloses[c] !== null && Number(rawCloses[c]) > 0) closes.push(Number(rawCloses[c]));
        }
        var prevClose = closes.length >= 2 ? closes[closes.length - 2] : Number(meta.chartPreviousClose || meta.previousClose || price);

        var source = "yahoo-chart";
        if (us) {
          var ext = yahooChartJson(base + "?interval=5m&range=1d&includePrePost=true");
          var extResult = ext && ext.chart && ext.chart.result && ext.chart.result[0];
          var extCloses = (extResult && extResult.indicators && extResult.indicators.quote && extResult.indicators.quote[0] && extResult.indicators.quote[0].close) || [];
          for (var e = extCloses.length - 1; e >= 0; e--) {
            if (extCloses[e] !== null && Number(extCloses[e]) > 0) {
              if (Number(extCloses[e]) !== regularPrice) source = "yahoo-chart-extended";
              price = Number(extCloses[e]);
              break;
            }
          }
        }

        var change = price - prevClose;
        var changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
        return {
          symbol: sym,
          price: price,
          regularPrice: regularPrice,
          prevClose: prevClose,
          change: change,
          changePct: changePct,
          date: Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, hh:mm a"),
          source: source
        };
      } catch (errHost) {}
    }
  } catch (e) {
    Logger.log("Yahoo Finance API fallback error for " + symbol + ": " + e);
  }
  return null;
}

function yahooChartJson(url) {
  var resp = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "application/json,text/html,application/xhtml+xml,*/*;q=0.8"
    }
  });
  if (resp.getResponseCode() !== 200) return null;
  return JSON.parse(resp.getContentText());
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


// ═══════════════════════════════════════════════════════════════════════════
// AUTO-REFRESH BACKEND: scheduled price collection + PriceLedger
// ═══════════════════════════════════════════════════════════════════════════

var WATCH_PROP_KEY = "LIFE_LEDGER_WATCHLIST_V1";
var LEDGER_SHEET_NAME = "PriceLedger";
var LEDGER_MAX_ROWS = 1500;

/**
 * RUN THIS ONCE from the Apps Script editor (Run -> setupAutoRefreshTriggers).
 * Creates: every 6 hours, and every night around 11:45 PM IST.
 */
function setupAutoRefreshTriggers() {
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    var fn = existing[i].getHandlerFunction();
    if (fn === "scheduledCollectInterval" || fn === "scheduledCollectNightly" || fn === "scheduledCollectMorning") {
      ScriptApp.deleteTrigger(existing[i]);
    }
  }
  ScriptApp.newTrigger("scheduledCollectInterval").timeBased().everyHours(6).create();
  ScriptApp.newTrigger("scheduledCollectNightly").timeBased().atHour(23).nearMinute(45).everyDays(1).inTimezone("Asia/Kolkata").create();
  // Morning pass: the US session has closed (~1:30-2:30 am IST) and mutual-fund NAVs for the previous day are out
  ScriptApp.newTrigger("scheduledCollectMorning").timeBased().atHour(8).nearMinute(45).everyDays(1).inTimezone("Asia/Kolkata").create();
  Logger.log("Auto-refresh triggers created: every 6 hours + nightly ~23:45 IST + morning ~08:45 IST");
}

function scheduledCollectInterval() { collectPricesNow("interval"); }
function scheduledCollectNightly() { collectPricesNow("nightly"); }
function scheduledCollectMorning() { collectPricesNow("morning"); }

/**
 * Stores the symbols to track. Only tickers / fund codes - no quantities or amounts.
 * ?registerWatch=1&stocks=TCS,INFY&us=AAPL,VOO&mf=120847,118759
 */
function registerWatchlist(params) {
  function list(v) {
    return String(v || "").split(",").map(function(x) { return x.trim().toUpperCase(); }).filter(Boolean).slice(0, 150);
  }
  var watch = {
    stocks: list(params.stocks),
    us: list(params.us),
    mf: list(params.mf).filter(function(c) { return /^\d+$/.test(c); }),
    updated: Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd HH:mm")
  };
  PropertiesService.getScriptProperties().setProperty(WATCH_PROP_KEY, JSON.stringify(watch));
  return { status: "ok", stocks: watch.stocks.length, us: watch.us.length, mf: watch.mf.length };
}

function getWatchlist() {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(WATCH_PROP_KEY);
    return raw ? JSON.parse(raw) : { stocks: [], us: [], mf: [] };
  } catch (e) {
    return { stocks: [], us: [], mf: [] };
  }
}

function getLedgerSheet() {
  var ss = getSharedSpreadsheet();
  var sh = ss.getSheetByName(LEDGER_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(LEDGER_SHEET_NAME);
    sh.getRange("A:D").setNumberFormat("@");
    sh.getRange(1, 1, 1, 4).setValues([["dateIST", "slot", "timestamp", "json"]]);
  }
  return sh;
}

/**
 * Fetches every watched price plus gold and USD/INR, then appends ONE record to the ledger.
 */
function collectPricesNow(slot) {
  var watch = getWatchlist();
  var now = new Date();
  var record = {
    date: Utilities.formatDate(now, "Asia/Kolkata", "yyyy-MM-dd"),
    slot: slot || "manual",
    ts: now.toISOString(),
    fx: null,
    gold: null,
    stocks: {},
    us: {},
    mf: {}
  };

  try {
    var fxQ = fetchViaYahooFinance("USDINR=X", true);
    if (fxQ && fxQ.price > 50) record.fx = { usdInr: fxQ.price };
  } catch (e) { Logger.log("collect fx: " + e); }

  try {
    var g = fetchLiveGold();
    if (g && g.price24k > 0) {
      record.gold = { price24k: g.price24k, price22k: g.price22k, prevClose24k: g.prevClose24k, prevClose22k: g.prevClose22k, source: g.source };
    }
  } catch (e2) { Logger.log("collect gold: " + e2); }

  for (var i = 0; i < watch.stocks.length; i++) {
    var sym = watch.stocks[i];
    var resolved = ISIN_TO_TICKER[sym] || sym;
    var q = fetchViaYahooFinance(resolved, false);
    if (q && q.price > 0) record.stocks[sym] = { price: q.price, prevClose: q.prevClose };
  }

  for (var j = 0; j < watch.us.length; j++) {
    var us = watch.us[j];
    var uq = fetchViaYahooFinance(us, true);
    if (!uq || !(uq.price > 0)) {
      uq = fetchViaNasdaq(us, (US_EXCHANGES[us] === "NYSEARCA"));
    }
    if (uq && uq.price > 0) record.us[us] = { price: uq.price, prevClose: uq.prevClose };
  }

  for (var k = 0; k < watch.mf.length; k++) {
    try {
      var resp = UrlFetchApp.fetch("https://api.mfapi.in/mf/" + watch.mf[k], { muteHttpExceptions: true });
      if (resp.getResponseCode() === 200) {
        var d = JSON.parse(resp.getContentText());
        if (d && d.data && d.data[0]) {
          record.mf[watch.mf[k]] = {
            nav: Number(d.data[0].nav),
            date: d.data[0].date,
            prevNav: d.data[1] ? Number(d.data[1].nav) : null,
            prevDate: d.data[1] ? d.data[1].date : null
          };
        }
      }
    } catch (e3) { Logger.log("collect mf " + watch.mf[k] + ": " + e3); }
  }

  var sheet = getLedgerSheet();
  sheet.appendRow([record.date, record.slot, record.ts, JSON.stringify(record)]);
  var rows = sheet.getLastRow();
  if (rows > LEDGER_MAX_ROWS + 1) sheet.deleteRows(2, rows - LEDGER_MAX_ROWS - 1);

  return {
    status: "ok", date: record.date, slot: record.slot,
    counts: { stocks: Object.keys(record.stocks).length, us: Object.keys(record.us).length, mf: Object.keys(record.mf).length, gold: record.gold ? 1 : 0, fx: record.fx ? 1 : 0 }
  };
}

/**
 * Returns ledger records dated >= since (yyyy-MM-dd), max ~45 days.
 */
function readPriceLedger(since) {
  var sheet = getLedgerSheet();
  var last = sheet.getLastRow();
  if (last < 2) return { records: [] };
  var floor = String(since || "");
  var values = sheet.getRange(2, 4, last - 1, 1).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    try {
      var rec = JSON.parse(values[i][0]);
      if (floor && String(rec.date) < floor) continue;
      out.push(rec);
    } catch (e) {}
  }
  return { records: out.slice(-300) };
}


// ═══════════════════════════════════════════════════════════════════════════
// DYNAMIC MUTUAL FUND RESOLVER (AMFI official NAV list: ISIN, code, name, plan, option)
// ═══════════════════════════════════════════════════════════════════════════

var MF_GENERIC_WORDS = {
  "fund": 1, "funds": 1, "mutual": 1, "scheme": 1, "plan": 1, "option": 1, "direct": 1, "regular": 1,
  "growth": 1, "idcw": 1, "dividend": 1, "payout": 1, "reinvestment": 1, "cumulative": 1,
  "the": 1, "of": 1, "and": 1, "amp": 1, "a": 1
};

function mfNormalize(str) {
  return String(str || "").toLowerCase().replace(/[^a-z0-9\s]+/g, " ")
    .replace(/mid\s+cap/g, "midcap").replace(/large\s+cap/g, "largecap").replace(/small\s+cap/g, "smallcap")
    .replace(/multi\s+cap/g, "multicap").replace(/micro\s+cap/g, "microcap").replace(/flexi\s+cap/g, "flexicap")
    .replace(/\s+/g, " ").trim();
}

function mfSignificantTokens(str) {
  var out = [];
  var seen = {};
  var parts = mfNormalize(str).split(" ");
  for (var i = 0; i < parts.length; i++) {
    var w = parts[i];
    if (!w || MF_GENERIC_WORDS[w] || seen[w]) continue;
    seen[w] = 1;
    out.push(w);
  }
  return out;
}

/**
 * A fund name matches only when BOTH names share exactly the same distinguishing words.
 * ("Nifty 50 Index" will never match "Nifty Next 50 Index"; "Large Cap" never "Liquid".)
 */
function mfNamesMatch(query, schemeName) {
  var a = mfSignificantTokens(query);
  var b = mfSignificantTokens(schemeName);
  if (a.length === 0 || a.length !== b.length) return false;
  var set = {};
  for (var i = 0; i < b.length; i++) set[b[i]] = 1;
  for (var j = 0; j < a.length; j++) if (!set[a[j]]) return false;
  return true;
}

function loadAmfiSchemes() {
  var resp = UrlFetchApp.fetch("https://www.amfiindia.com/spages/NAVAll.txt", {
    muteHttpExceptions: true,
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36" }
  });
  if (resp.getResponseCode() !== 200) return [];
  var lines = resp.getContentText().split("\n");
  var out = [];
  for (var i = 0; i < lines.length; i++) {
    var f = lines[i].split(";");
    if (f.length < 8 || !/^\d+$/.test(f[0].trim())) continue;
    out.push({
      code: f[0].trim(), isin1: f[1].trim().toUpperCase(), isin2: f[2].trim().toUpperCase(),
      name: f[3].trim(), plan: f[4].trim(), option: f[5].trim(), nav: Number(f[6]), date: f[7].trim()
    });
  }
  return out;
}

function mfOptionKind(option) {
  if (/idcw|dividend|payout|income distribution|withdrawal/i.test(option)) return "idcw";
  if (/bonus/i.test(option)) return "bonus";
  return "growth";
}

function mfResult(sch, confidence) {
  return {
    status: "ok", confidence: confidence, schemeCode: Number(sch.code),
    schemeName: sch.name + " - " + sch.plan + " - " + sch.option, isin: sch.isin1, nav: sch.nav, navDate: sch.date
  };
}

function resolveMfMany(joined) {
  var queries = joined.split("||").map(function(q) { return q.trim(); }).filter(Boolean).slice(0, 40);
  var all = loadAmfiSchemes();
  var results = {};
  for (var i = 0; i < queries.length; i++) results[queries[i]] = resolveMfOnline(queries[i], all);
  return { status: "ok", results: results };
}

function resolveMfOnline(query, preloaded) {
  if (!query) return { status: "error", error: "Empty query" };
  var all = preloaded || loadAmfiSchemes();
  if (all.length === 0) return { status: "error", error: "Could not load AMFI list" };
  var q = query.toUpperCase().trim();

  // 1. Exact: scheme code or ISIN
  for (var i = 0; i < all.length; i++) {
    var s = all[i];
    if (s.code === q || s.isin1 === q || s.isin2 === q) return mfResult(s, "exact");
  }

  // 2. Name: same distinguishing words + requested plan/option (defaults: Direct, Growth)
  var qn = mfNormalize(query);
  var wantRegular = /\bregular\b/.test(qn);
  var wantKind = /\b(idcw|dividend|payout)\b/.test(qn) ? "idcw" : (/\bbonus\b/.test(qn) ? "bonus" : "growth");
  var matches = [];
  for (var j = 0; j < all.length; j++) {
    var c = all[j];
    if (!mfNamesMatch(query, c.name)) continue;
    var isRegular = /regular/i.test(c.plan);
    if (isRegular !== wantRegular || mfOptionKind(c.option) !== wantKind) continue;
    matches.push(c);
  }
  // Legacy AMFI rows have blank plan/option; prefer fully described rows when both exist
  if (matches.length > 1) {
    var described = matches.filter(function(m) { return m.plan && m.option; });
    if (described.length >= 1) matches = described;
  }
  if (matches.length === 1) return mfResult(matches[0], "high");
  if (matches.length > 1) {
    // Several AMFI rows can be the same fund (e.g. duplicate codes): ambiguous, let the user choose
    return { status: "ambiguous", candidates: matches.slice(0, 5).map(function(m) { return { schemeCode: Number(m.code), schemeName: m.name + " - " + m.plan + " - " + m.option, isin: m.isin1 }; }) };
  }

  // 3. Suggestions only (never auto-applied)
  var qt = mfSignificantTokens(query);
  var scored = [];
  for (var k = 0; k < all.length; k++) {
    var cand = all[k];
    if (/regular/i.test(cand.plan) !== wantRegular || mfOptionKind(cand.option) !== wantKind) continue;
    var ct = mfNormalize(cand.name);
    var hit = 0;
    for (var t = 0; t < qt.length; t++) if (ct.indexOf(qt[t]) !== -1) hit++;
    if (qt.length && hit / qt.length >= 0.6) scored.push({ hit: hit, c: cand });
  }
  scored.sort(function(a, b) { return b.hit - a.hit; });
  return {
    status: "not_found",
    suggestions: scored.slice(0, 5).map(function(x) { return { schemeCode: Number(x.c.code), schemeName: x.c.name + " - " + x.c.plan + " - " + x.c.option, isin: x.c.isin1 }; })
  };
}
