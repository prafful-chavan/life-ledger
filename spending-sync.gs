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

// Newest backup file under the Spending app's folder.
function spendingNewest_(source) {
  var page = dropboxRpc_("https://api.dropboxapi.com/2/files/list_folder", { path: SPENDING_ROOT, recursive: true, limit: 2000 }, source);
  var best = null;
  while (true) {
    page.entries.forEach(function (e) {
      if (e[".tag"] !== "file" || e.size < 10000) return;
      if (!best || e.server_modified > best.server_modified) best = e;
    });
    if (!page.has_more) break;
    page = dropboxRpc_("https://api.dropboxapi.com/2/files/list_folder/continue", { cursor: page.cursor }, source);
  }
  if (!best) throw new Error("No backup files found under " + SPENDING_ROOT);
  return best;
}

function spendingHandle_(op, source) {
  source = source === "wife" ? "wife" : "";
  var f = spendingNewest_(source);
  var meta = { name: f.name, modified: f.server_modified, size: f.size, hash: f.content_hash };
  var answeredBy = source === "wife" ? "wife" : "me";
  if (op === "spendingMeta") return { ok: true, source: answeredBy, file: meta };
  var res = UrlFetchApp.fetch("https://content.dropboxapi.com/2/files/download", {
    method: "post",
    headers: { Authorization: "Bearer " + dropboxAccessToken_(source), "Dropbox-API-Arg": JSON.stringify({ path: f.id }) },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) return { ok: false, error: "Dropbox download " + res.getResponseCode() };
  return { ok: true, source: answeredBy, file: meta, data: Utilities.base64Encode(res.getContent()) };
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
