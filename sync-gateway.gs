// ═══════════════════════════════════════════════════════════════════════════
// LIFE LEDGER SYNC GATEWAY (v1) — add as a second file in the same Apps Script
// project as stock-price-proxy.gs, then Deploy → Manage deployments → Edit →
// New version. The gateway stores ONLY the client-side encrypted vault.
//
// Storage : Drive folder "Life Ledger Sync" in the script owner's account
//             state.json            { rev, tokenHash, vault, updatedAt }
//             backups/…             timestamped copies (last 40 kept)
// Safety  : compare-and-swap on `rev` under a script lock → no lost updates;
//           token (derived from your password on-device) guards every call.
// ═══════════════════════════════════════════════════════════════════════════

var SYNC_FOLDER_NAME = "Life Ledger Sync";
var SYNC_STATE_FILE = "state.json";
var SYNC_BACKUP_PREFIX = "backup-";
var SYNC_MAX_BACKUPS = 40;
var SYNC_BACKUP_EVERY_MS = 6 * 60 * 60 * 1000;

function syncFolder_() {
  var it = DriveApp.getFoldersByName(SYNC_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(SYNC_FOLDER_NAME);
}

function syncStateFile_(folder, create) {
  var it = folder.getFilesByName(SYNC_STATE_FILE);
  if (it.hasNext()) return it.next();
  return create ? folder.createFile(SYNC_STATE_FILE, JSON.stringify({ rev: 0 }), MimeType.PLAIN_TEXT) : null;
}

function syncReadState_(folder) {
  var f = syncStateFile_(folder, false);
  if (!f) return { rev: 0 };
  try { return JSON.parse(f.getBlob().getDataAsString()); } catch (e) { return { rev: 0 }; }
}

function syncHash_(token) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token));
  return raw.map(function (b) { return ("0" + (b & 0xff).toString(16)).slice(-2); }).join("");
}

function syncBackups_(folder) {
  var out = [];
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (f.getName().indexOf(SYNC_BACKUP_PREFIX) === 0) out.push(f);
  }
  out.sort(function (a, b) { return b.getName() < a.getName() ? -1 : 1; }); // newest first
  return out;
}

function syncWriteBackup_(folder, state, reason) {
  if (!state || !state.vault) return;
  var stamp = Utilities.formatDate(new Date(), "UTC", "yyyyMMdd'T'HHmmss'Z'");
  var name = SYNC_BACKUP_PREFIX + stamp + "-r" + state.rev + "-" + reason + ".json";
  folder.createFile(name, JSON.stringify({ rev: state.rev, updatedAt: state.updatedAt, vault: state.vault }), MimeType.PLAIN_TEXT);
  var all = syncBackups_(folder);
  for (var i = SYNC_MAX_BACKUPS; i < all.length; i++) all[i].setTrashed(true);
}

// Unauthenticated: only tells a fresh device that a vault exists and its salt
// (the salt is not secret; it's needed before the password can be used).
function syncMeta_() {
  var s = syncReadState_(syncFolder_());
  return { ok: true, gateway: "v1", exists: !!s.vault, rev: s.rev || 0, salt: s.vault ? s.vault.salt : null };
}

function syncHandle_(req) {
  var op = req && req.op;
  if (!op) return { ok: false, error: "missing op" };
  if (!req.token) return { ok: false, error: "missing token" };
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var folder = syncFolder_();
    var state = syncReadState_(folder);
    var h = syncHash_(req.token);
    if (state.tokenHash && state.tokenHash !== h) return { ok: false, error: "unauthorized" };

    if (op === "pull") {
      if (!state.vault) return { ok: true, rev: 0, empty: true };
      if (req.sinceRev && Number(req.sinceRev) === state.rev) return { ok: true, rev: state.rev, unchanged: true };
      return { ok: true, rev: state.rev, vault: state.vault, updatedAt: state.updatedAt };
    }

    if (op === "push") {
      if (!req.vault || !req.vault.ciphertext) return { ok: false, error: "bad vault" };
      var base = Number(req.baseRev || 0);
      if (base !== (state.rev || 0)) {
        return { ok: true, conflict: true, rev: state.rev, vault: state.vault, updatedAt: state.updatedAt };
      }
      // Safety nets: periodic backup, plus a backup before any big shrink.
      var last = syncBackups_(folder)[0];
      var shrink = state.vault && state.vault.entryCount && req.vault.entryCount &&
        req.vault.entryCount < state.vault.entryCount * 0.8;
      var due = !last || (Date.now() - last.getDateCreated().getTime()) > SYNC_BACKUP_EVERY_MS;
      if (state.vault && (shrink || due)) syncWriteBackup_(folder, state, shrink ? "shrink" : "auto");
      var next = {
        rev: (state.rev || 0) + 1,
        tokenHash: state.tokenHash || h,
        vault: req.vault,
        updatedAt: new Date().toISOString()
      };
      syncStateFile_(folder, true).setContent(JSON.stringify(next));
      return { ok: true, rev: next.rev, updatedAt: next.updatedAt };
    }

    if (op === "listBackups") {
      return {
        ok: true,
        backups: syncBackups_(folder).map(function (f) {
          return { id: f.getId(), name: f.getName(), at: f.getDateCreated().toISOString(), size: f.getSize() };
        })
      };
    }

    if (op === "getBackup") {
      var f2 = DriveApp.getFileById(String(req.id));
      var inFolder = false, parents = f2.getParents();
      while (parents.hasNext()) { if (parents.next().getId() === folder.getId()) inFolder = true; }
      if (!inFolder) return { ok: false, error: "not a backup" };
      return { ok: true, backup: JSON.parse(f2.getBlob().getDataAsString()) };
    }

    if (op === "snapshotNow") {
      syncWriteBackup_(folder, state, "manual");
      return { ok: true };
    }

    return { ok: false, error: "unknown op" };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || "{}"); } catch (err) {
    return createJsonResponse({ ok: false, error: "bad json" });
  }
  return createJsonResponse(syncHandle_(body));
}
