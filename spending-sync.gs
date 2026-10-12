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

function dropboxExchangeCode() {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty("DROPBOX_APP_KEY");
  var secret = props.getProperty("DROPBOX_APP_SECRET");
  var code = props.getProperty("DROPBOX_AUTH_CODE");
  if (!key || !secret || !code) throw new Error("Need DROPBOX_APP_KEY, DROPBOX_APP_SECRET and DROPBOX_AUTH_CODE script properties.");
  var res = UrlFetchApp.fetch("https://api.dropbox.com/oauth2/token", {
    method: "post",
    payload: { code: code.trim(), grant_type: "authorization_code" },
    headers: { Authorization: "Basic " + Utilities.base64Encode(key + ":" + secret) },
    muteHttpExceptions: true
  });
  var json = JSON.parse(res.getContentText());
  if (!json.refresh_token) throw new Error("Dropbox said: " + res.getContentText());
  props.setProperty("DROPBOX_REFRESH_TOKEN", json.refresh_token);
  props.deleteProperty("DROPBOX_AUTH_CODE");
  CacheService.getScriptCache().remove("dbx_access"); // drop any token issued with older permissions
  Logger.log("Done. Refresh token saved. Now run dropboxTest.");
}

function dropboxAccessToken_() {
  var props = PropertiesService.getScriptProperties();
  var cache = CacheService.getScriptCache();
  var cached = cache.get("dbx_access");
  if (cached) return cached;
  var key = props.getProperty("DROPBOX_APP_KEY");
  var secret = props.getProperty("DROPBOX_APP_SECRET");
  var refresh = props.getProperty("DROPBOX_REFRESH_TOKEN");
  if (!refresh) throw new Error("Dropbox is not connected yet (run dropboxExchangeCode).");
  var res = UrlFetchApp.fetch("https://api.dropbox.com/oauth2/token", {
    method: "post",
    payload: { grant_type: "refresh_token", refresh_token: refresh },
    headers: { Authorization: "Basic " + Utilities.base64Encode(key + ":" + secret) },
    muteHttpExceptions: true
  });
  var json = JSON.parse(res.getContentText());
  if (!json.access_token) throw new Error("Dropbox token refresh failed: " + res.getContentText());
  cache.put("dbx_access", json.access_token, Math.max(60, (json.expires_in || 14400) - 300));
  return json.access_token;
}

function dropboxRpc_(url, body) {
  var res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + dropboxAccessToken_() },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error("Dropbox " + res.getResponseCode() + ": " + res.getContentText().slice(0, 200));
  return JSON.parse(res.getContentText());
}

// Newest backup file under the Spending app's folder.
function spendingNewest_() {
  var page = dropboxRpc_("https://api.dropboxapi.com/2/files/list_folder", { path: SPENDING_ROOT, recursive: true, limit: 2000 });
  var best = null;
  while (true) {
    page.entries.forEach(function (e) {
      if (e[".tag"] !== "file" || e.size < 10000) return;
      if (!best || e.server_modified > best.server_modified) best = e;
    });
    if (!page.has_more) break;
    page = dropboxRpc_("https://api.dropboxapi.com/2/files/list_folder/continue", { cursor: page.cursor });
  }
  if (!best) throw new Error("No backup files found under " + SPENDING_ROOT);
  return best;
}

function spendingHandle_(op) {
  var f = spendingNewest_();
  var meta = { name: f.name, modified: f.server_modified, size: f.size, hash: f.content_hash };
  if (op === "spendingMeta") return { ok: true, file: meta };
  var res = UrlFetchApp.fetch("https://content.dropboxapi.com/2/files/download", {
    method: "post",
    headers: { Authorization: "Bearer " + dropboxAccessToken_(), "Dropbox-API-Arg": JSON.stringify({ path: f.id }) },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) return { ok: false, error: "Dropbox download " + res.getResponseCode() };
  return { ok: true, file: meta, data: Utilities.base64Encode(res.getContent()) };
}

function dropboxTest() {
  var f = spendingNewest_();
  Logger.log("Newest backup: " + f.name + " (" + f.size + " bytes, modified " + f.server_modified + ")");
}

function dropboxClearCache() {
  CacheService.getScriptCache().remove("dbx_access");
  Logger.log("Cleared cached Dropbox access token.");
}
