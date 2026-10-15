// ═══════════════════════════════════════════════════════════════════════════
// ADVISOR PRICE HISTORY — add as a file in the same Apps Script project.
// GET ?history=TCS.NS,AAPL,mf:119551,^NSEI&days=400
// Returns daily closes (dates ascending) from Yahoo Finance (stocks/ETFs/indices) and mfapi.in
// (mutual fund NAVs). Public market data only; results are cached for 6 hours.
// ═══════════════════════════════════════════════════════════════════════════

var HISTORY_MAX_KEYS = 80;
var HISTORY_CACHE_SECONDS = 6 * 60 * 60;
var HISTORY_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function historyIsoDate_(ms) {
  return Utilities.formatDate(new Date(ms), "UTC", "yyyy-MM-dd");
}

function historyFromYahoo_(text, days) {
  var json = JSON.parse(text);
  var r = json && json.chart && json.chart.result && json.chart.result[0];
  if (!r || !r.timestamp || !r.indicators || !r.indicators.quote || !r.indicators.quote[0]) return null;
  var ts = r.timestamp, cl = r.indicators.quote[0].close || [];
  var d = [], c = [];
  for (var i = 0; i < ts.length; i++) {
    if (cl[i] == null || !(cl[i] > 0)) continue;
    d.push(historyIsoDate_(ts[i] * 1000));
    c.push(Math.round(cl[i] * 100) / 100);
  }
  if (d.length < 2) return null;
  return { d: d.slice(-days), c: c.slice(-days) };
}

function historyFromMfapi_(text, days) {
  var json = JSON.parse(text);
  var rows = json && json.data;
  if (!rows || rows.length < 2) return null;
  var d = [], c = [];
  for (var i = rows.length - 1; i >= 0; i--) {           // API lists newest first
    var m = String(rows[i].date).match(/^(\d{2})-(\d{2})-(\d{4})$/);
    var nav = Number(rows[i].nav);
    if (!m || !(nav > 0)) continue;
    d.push(m[3] + "-" + m[2] + "-" + m[1]);
    c.push(Math.round(nav * 10000) / 10000);
  }
  if (d.length < 2) return null;
  return { d: d.slice(-days), c: c.slice(-days) };
}

function readHistory(listStr, daysStr) {
  var days = Math.max(30, Math.min(800, Number(daysStr) || 400));
  var keys = String(listStr || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  keys = keys.filter(function (k, i) { return keys.indexOf(k) === i; }).slice(0, HISTORY_MAX_KEYS);
  var cache = CacheService.getScriptCache();
  var cacheKeys = keys.map(function (k) { return "hist2:" + days + ":" + k; });
  var cached = cache.getAll(cacheKeys);
  var out = {}, todo = [];
  keys.forEach(function (k, i) {
    var hit = cached[cacheKeys[i]];
    if (hit) { try { out[k] = JSON.parse(hit); return; } catch (e) { /* refetch */ } }
    todo.push(k);
  });

  var reqs = todo.map(function (k) {
    if (k.indexOf("mf:") === 0) return { url: "https://api.mfapi.in/mf/" + encodeURIComponent(k.slice(3)), muteHttpExceptions: true };
    return { url: "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(k) + "?range=2y&interval=1d", muteHttpExceptions: true, headers: { "User-Agent": HISTORY_UA } };
  });
  var resps = reqs.length ? UrlFetchApp.fetchAll(reqs) : [];
  var toCache = {}, missing = [];
  todo.forEach(function (k, i) {
    var series = null;
    try {
      if (resps[i].getResponseCode() === 200) {
        series = k.indexOf("mf:") === 0 ? historyFromMfapi_(resps[i].getContentText(), days) : historyFromYahoo_(resps[i].getContentText(), days);
      }
    } catch (e) { series = null; }
    if (series) { out[k] = series; toCache["hist2:" + days + ":" + k] = JSON.stringify(series); }
    else missing.push(k);
  });
  if (Object.keys(toCache).length) { try { cache.putAll(toCache, HISTORY_CACHE_SECONDS); } catch (e) { /* too large: skip caching */ } }
  return { ok: true, series: out, missing: missing, asOf: new Date().toISOString() };
}
