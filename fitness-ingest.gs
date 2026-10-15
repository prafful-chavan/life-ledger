// ═══════════════════════════════════════════════════════════════════════════
// APPLE HEALTH → LIFE LEDGER (fitness upload). Add as another file in the same
// Apps Script project, then Deploy → Manage deployments → Edit → New version.
//
// An iPhone Shortcut posts one small summary per day (steps, distances, calories) to the web-app URL with a
// secret key. This file checks the key, cleans the numbers and keeps the last ~400 days in the
// "Life Ledger Sync" Drive folder. The app reads them back through the authenticated sync gateway.
//
// One-time setup: run fitnessSetupKey once and copy the key from the log (View → Logs / Execution log).
// ═══════════════════════════════════════════════════════════════════════════

var FITNESS_FILE = "fitness.json";
var FITNESS_KEEP_DAYS = 400;

function fitnessSetupKey() {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty("FITNESS_KEY");
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "").slice(0, 12);
    props.setProperty("FITNESS_KEY", key);
  }
  Logger.log("Your fitness upload key (keep it private):\n" + key);
  return key;
}

function fitnessKeyOk_(given) {
  var real = PropertiesService.getScriptProperties().getProperty("FITNESS_KEY");
  if (!real || typeof given !== "string" || given.length !== real.length) return false;
  var diff = 0;
  for (var i = 0; i < real.length; i++) diff |= real.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

function fitnessNum_(v, max) {
  var n = Number(String(v == null ? "" : v).replace(/,/g, "").trim());
  if (!isFinite(n) || n <= 0) return 0;
  return n > max ? 0 : Math.round(n * 100) / 100;
}

function fitnessTodayIST_() {
  return Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd");
}

// One cleaned day, or null when it is unusable. Nothing the phone sends is trusted.
function fitnessCleanDay_(d) {
  if (!d || typeof d !== "object") return null;
  var date = String(d.date || fitnessTodayIST_()).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  var out = {
    date: date,
    steps: Math.round(fitnessNum_(d.steps, 200000)),
    walkKm: fitnessNum_(d.walkKm, 300),
    cycleKm: fitnessNum_(d.cycleKm, 1000),
    activeKcal: Math.round(fitnessNum_(d.activeKcal, 20000)),
    workouts: []
  };
  var ws = Array.isArray(d.workouts) ? d.workouts.slice(0, 20) : [];
  ws.forEach(function (w) {
    if (!w || typeof w !== "object") return;
    out.workouts.push({
      type: String(w.type || "Workout").slice(0, 40),
      start: String(w.start || "").slice(0, 32),
      minutes: Math.round(fitnessNum_(w.minutes, 1440)),
      km: fitnessNum_(w.km, 1000),
      kcal: Math.round(fitnessNum_(w.kcal, 20000))
    });
  });
  if (!out.steps && !out.walkKm && !out.cycleKm && !out.activeKcal && !out.workouts.length) return null;
  return out;
}

function fitnessFile_(folder, create) {
  var it = folder.getFilesByName(FITNESS_FILE);
  if (it.hasNext()) return it.next();
  return create ? folder.createFile(FITNESS_FILE, JSON.stringify({ days: {} }), MimeType.PLAIN_TEXT) : null;
}

function fitnessRead_(folder) {
  var f = fitnessFile_(folder, false);
  if (!f) return { days: {} };
  try {
    var j = JSON.parse(f.getBlob().getDataAsString());
    return j && j.days ? j : { days: {} };
  } catch (e) { return { days: {} }; }
}

// Called from the gateway for op "fitnessIngest". Accepts { key, days:[…] } or a single flat day.
function fitnessIngest_(req) {
  if (!fitnessKeyOk_(req && req.key)) return { ok: false, error: "unauthorized" };
  var raw = Array.isArray(req.days) ? req.days.slice(0, 60) : [req];
  var clean = [];
  raw.forEach(function (d) { var c = fitnessCleanDay_(d); if (c) clean.push(c); });
  if (!clean.length) return { ok: false, error: "no usable data in the upload" };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var folder = syncFolder_();
    var state = fitnessRead_(folder);
    clean.forEach(function (c) { c.updatedAt = new Date().toISOString(); state.days[c.date] = c; });
    var dates = Object.keys(state.days).sort();
    while (dates.length > FITNESS_KEEP_DAYS) delete state.days[dates.shift()];
    fitnessFile_(folder, true).setContent(JSON.stringify(state));
    return { ok: true, saved: clean.length, days: dates.length, latest: dates[dates.length - 1] };
  } finally {
    lock.releaseLock();
  }
}

// Called from the gateway for op "fitnessPull" (already authenticated with the vault token, no lock needed).
function fitnessPull_(folder, since) {
  var state = fitnessRead_(folder);
  var from = /^\d{4}-\d{2}-\d{2}$/.test(String(since || "")) ? since : "0000-00-00";
  var days = Object.keys(state.days).sort().filter(function (d) { return d >= from; }).map(function (d) { return state.days[d]; });
  return { ok: true, days: days };
}
