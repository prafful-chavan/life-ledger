// ═══════════════════════════════════════════════════════════════════════════
// SPENDING TRACKER → LIFE LEDGER (Dropbox reader). Add as a third file.
// Read-only: lists and downloads the newest backup the Spending app wrote to
// Dropbox. Reachable only through the authenticated sync gateway (same token
// as vault sync), never as a public URL.
//
// One-time setup (see README):
//   1. Project Settings → Script properties → add DROPBOX_APP_KEY and
//      DROPBOX_APP_SECRET (from your Dropbox app's Settings tab).
//   2. Run dropboxAuthUrl, open the link from the log, click Allow, copy the code.
//   3. Add script property DROPBOX_AUTH_CODE = that code, then run dropboxExchangeCode.
//   4. Run dropboxTest — it should log the newest backup file name.
// ═══════════════════════════════════════════════════════════════════════════

var SPENDING_ROOT = "/Apps/SpendingTracker";

function spendProp_(name) {
  return PropertiesService.getScriptProperties().getProperty(name);
}

function dropboxAuthUrl() {
  var key = spendProp_("DROPBOX_APP_KEY");
  if (!key) throw new Error("Add script property DROPBOX_APP_KEY first.");
  Logger.log("Open this link, click Allow, and copy the code:\n" +
    "https://www.dropbox.com/oauth2/authorize?client_id=" + encodeURIComponent(key) +
    "&response_type=code&token_access_type=offline");
}

// Source "me" uses DROPBOX_AUTH_CODE / DROPBOX_REFRESH_TOKEN; source "wife" uses the *_WIFE variants.
function spendSuffix_(source) { return source === "wife" ? "_WIFE" : ""; }

function dropboxExchangeCode() { exchangeCode_(""); }
function dropboxExchangeCodeWife() { exchangeCode_("wife"); }

function exchangeCode_(source) {
  var sfx = spendSuffix_(source);
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty("DROPBOX_APP_KEY");
  var secret = props.getProperty("DROPBOX_APP_SECRET");
  var code = props.getProperty("DROPBOX_AUTH_CODE" + sfx);
  if (!key || !secret || !code) throw new Error("Need DROPBOX_APP_KEY, DROPBOX_APP_SECRET and DROPBOX_AUTH_CODE" + sfx + " script properties.");
  var res = UrlFetchApp.fetch("https://api.dropbox.com/oauth2/token", {
    method: "post",
    payload: { code: code.trim(), grant_type: "authorization_code" },
    headers: { Authorization: "Basic " + Utilities.base64Encode(key + ":" + secret) },
    muteHttpExceptions: true
  });
  var json = JSON.parse(res.getContentText());
  if (!json.refresh_token) throw new Error("Dropbox said: " + res.getContentText());
  props.setProperty("DROPBOX_REFRESH_TOKEN" + sfx, json.refresh_token);
  props.deleteProperty("DROPBOX_AUTH_CODE" + sfx);
  CacheService.getScriptCache().remove("dbx_access" + sfx); // drop any token issued with older permissions
  Logger.log("Done. Refresh token saved. Now run dropboxTest.");
}

function dropboxAccessToken_(source) {
  var sfx = spendSuffix_(source);
  var props = PropertiesService.getScriptProperties();
  var cache = CacheService.getScriptCache();
  var cached = cache.get("dbx_access" + sfx);
  if (cached) return cached;
  var key = props.getProperty("DROPBOX_APP_KEY");
  var secret = props.getProperty("DROPBOX_APP_SECRET");
  var refresh = props.getProperty("DROPBOX_REFRESH_TOKEN" + sfx);
  if (!refresh) throw new Error("Dropbox source '" + (source || "me") + "' is not connected yet.");
  var res = UrlFetchApp.fetch("https://api.dropbox.com/oauth2/token", {
    method: "post",
    payload: { grant_type: "refresh_token", refresh_token: refresh },
    headers: { Authorization: "Basic " + Utilities.base64Encode(key + ":" + secret) },
    muteHttpExceptions: true
  });
  var json = JSON.parse(res.getContentText());
  if (!json.access_token) throw new Error("Dropbox token refresh failed: " + res.getContentText());
  cache.put("dbx_access" + sfx, json.access_token, Math.max(60, (json.expires_in || 14400) - 300));
  return json.access_token;
}

function dropboxRpc_(url, body, source) {
  var res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + dropboxAccessToken_(source) },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error("Dropbox " + res.getResponseCode() + ": " + res.getContentText().slice(0, 200));
  return JSON.parse(res.getContentText());
}

var SPENDING_ACTIVE_DAYS = 21;

// Every device running the Spending app writes to its own Auto-<id> folder. A device's newest backup
// can lag another device's, so we return the newest file of EACH recently active device; the app
// merges them (rows are de-duplicated there).
function spendingFiles_(source) {
  var page = dropboxRpc_("https://api.dropboxapi.com/2/files/list_folder", { path: SPENDING_ROOT, recursive: true, limit: 2000 }, source);
  var newestByFolder = {};
  var newestOverall = null;
  while (true) {
    page.entries.forEach(function (e) {
      if (e[".tag"] !== "file" || e.size < 10000) return;
      var parts = String(e.path_display).split("/");          // ["", "Apps", "SpendingTracker", folder, file]
      var folder = parts.length > 4 ? parts[3] : "";
      if (!newestOverall || e.server_modified > newestOverall.server_modified) newestOverall = e;
      if (!/^Auto-/i.test(folder)) return;                    // skip Sync, Exports and old manual backups
      var cur = newestByFolder[folder];
      if (!cur || e.server_modified > cur.server_modified) newestByFolder[folder] = e;
    });
    if (!page.has_more) break;
    page = dropboxRpc_("https://api.dropboxapi.com/2/files/list_folder/continue", { cursor: page.cursor }, source);
  }
  if (!newestOverall) throw new Error("No backup files found under " + SPENDING_ROOT);
  var cutoff = new Date(new Date(newestOverall.server_modified).getTime() - SPENDING_ACTIVE_DAYS * 86400000).toISOString();
  var files = Object.keys(newestByFolder).map(function (k) { return newestByFolder[k]; })
    .filter(function (e) { return e.server_modified >= cutoff; })
    .sort(function (a, b) { return a.server_modified < b.server_modified ? 1 : -1; });
  return files.length ? files : [newestOverall];
}

function spendingNewest_(source) {
  return spendingFiles_(source)[0];
}

function spendingMetaOf_(f) {
  return { id: f.id, name: f.name, path: f.path_display, modified: f.server_modified, size: f.size, hash: f.content_hash };
}

// Listing a Dropbox folder with hundreds of backups takes seconds; one import asks for it once per file,
// so keep the (tiny) result for two minutes.
function spendingFilesCached_(source) {
  var cache = CacheService.getScriptCache();
  var key = "spf:" + (source || "me");
  var hit = cache.get(key);
  if (hit) { try { return JSON.parse(hit); } catch (e) { /* recompute */ } }
  var files = spendingFiles_(source);
  try { cache.put(key, JSON.stringify(files), 120); } catch (e) { /* too large: skip caching */ }
  return files;
}

function spendingHandle_(op, source, fileId) {
  source = source === "wife" ? "wife" : "";
  var answeredBy = source === "wife" ? "wife" : "me";
  var files = spendingFilesCached_(source);
  var metas = files.map(spendingMetaOf_);
  if (op === "spendingMeta") return { ok: true, source: answeredBy, file: metas[0], files: metas };

  // Download one file; only files from the listing above can be requested.
  var f = files[0];
  if (fileId) {
    f = files.filter(function (x) { return x.id === fileId; })[0];
    if (!f) return { ok: false, error: "unknown backup file" };
  }
  var res = UrlFetchApp.fetch("https://content.dropboxapi.com/2/files/download", {
    method: "post",
    headers: { Authorization: "Bearer " + dropboxAccessToken_(source), "Dropbox-API-Arg": JSON.stringify({ path: f.id }) },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) return { ok: false, error: "Dropbox download " + res.getResponseCode() };
  return { ok: true, source: answeredBy, file: spendingMetaOf_(f), data: Utilities.base64Encode(res.getContent()) };
}

function dropboxTestWife() { dropboxTest("wife"); }

function dropboxTest(source) {
  if (typeof source !== "string") source = "";
  var f = spendingNewest_(source);
  Logger.log("Newest backup: " + f.name + " (" + f.size + " bytes, modified " + f.server_modified + ")");
}

function dropboxClearCache() {
  CacheService.getScriptCache().removeAll(["dbx_access", "dbx_access_WIFE"]);
  Logger.log("Cleared cached Dropbox access token.");
}

// Which Dropbox account is each source linked to? Compares what each token can see (names/sizes only).
function dropboxCompare() {
  ["", "wife"].forEach(function (source) {
    try {
      var top = dropboxRpc_("https://api.dropboxapi.com/2/files/list_folder", { path: SPENDING_ROOT, recursive: false, limit: 50 }, source);
      var names = top.entries.map(function (e) { return e.name; });
      var f = spendingNewest_(source);
      Logger.log((source || "me") + ": folders=" + JSON.stringify(names) + " | newest=" + f.name + " " + f.size + "B " + f.server_modified + " hash=" + String(f.content_hash).slice(0, 10));
    } catch (e) {
      Logger.log((source || "me") + ": " + e.message);
    }
  });
}

// Shows the 10 most recently saved files the Spending app wrote to Dropbox (names, folders, times,
// sizes only). If the newest one is old, the Spending app has stopped backing up — not this importer.
function dropboxRecent(source) {
  if (typeof source !== "string") source = "";
  var page = dropboxRpc_("https://api.dropboxapi.com/2/files/list_folder", { path: SPENDING_ROOT, recursive: true, limit: 2000 }, source);
  var files = [];
  while (true) {
    page.entries.forEach(function (e) { if (e[".tag"] === "file") files.push(e); });
    if (!page.has_more) break;
    page = dropboxRpc_("https://api.dropboxapi.com/2/files/list_folder/continue", { cursor: page.cursor }, source);
  }
  files.sort(function (a, b) { return a.server_modified < b.server_modified ? 1 : -1; });
  Logger.log("Total files: " + files.length + ". Newest 10:");
  files.slice(0, 10).forEach(function (f) {
    Logger.log(f.server_modified + "  " + f.size + "B  " + f.path_display);
  });
}
function dropboxRecentWife() { dropboxRecent("wife"); }
