/**
 * Life Ledger — Apple Health import (browser side).
 * An iPhone Shortcut uploads each day's steps / distance / calories to your Apps Script; this pulls the last
 * two weeks through the authenticated gateway and merges them into Exercise via LifeLedgerFitnessCore
 * (no duplicates, your own entries win, deleted rows stay deleted).
 */
(function () {
  const AUTO_CHECK_KEY = "lifeLedgerFitnessLastCheck";
  const AUTO_EVERY_MS = 15 * 60 * 1000;
  const AUTO_POLL_MS = 10 * 60 * 1000;
  const LOOKBACK_DAYS = 14;
  let busy = false;
  const $ = (id) => document.getElementById(id);

  function say(text) { const el = $("fitnessSyncStatus"); if (el) el.textContent = text; }

  const istToday = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
  const daysAgo = (n) => new Date(Date.now() + 330 * 60000 - n * 86400000).toISOString().slice(0, 10);
  const fmtWhen = (iso) => { try { return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); } catch { return ""; } };

  function stamp() { try { localStorage.setItem(AUTO_CHECK_KEY, String(Date.now())); } catch { /* ignore */ } }

  async function run(opts) {
    const manual = Boolean(opts && opts.manual);
    if (busy) return;
    const Sync = window.LifeLedgerSync;
    const Core = window.LifeLedgerFitnessCore;
    const app = window.LifeLedgerApp;
    if (!Sync || !Core || !app || !Sync.isConfigured()) { if (manual) say("Needs the Apps Script URL and sync gateway."); return; }
    busy = true;
    try {
      if (manual) say("Checking for new Apple Health data…");
      stamp();
      let res;
      try {
        res = await Sync.call("fitnessPull", { since: daysAgo(LOOKBACK_DAYS) });
      } catch (err) {
        if (manual || !/unknown op/i.test(err.message)) say("Could not check Apple Health data: " + err.message);
        return;
      }
      const days = res.days || [];
      const live = app.getState();
      const prev = live.fitnessImport || { ids: [], importedAt: null };
      if (!days.length) {
        say(prev.importedAt ? "Up to date. Last import " + fmtWhen(prev.importedAt) + "." : "No Apple Health data uploaded yet — see “Set up automatic import” below.");
        return;
      }
      const plan = Core.plan(days, live.activities || [], prev.ids);
      const idsChanged = plan.ids.length !== (prev.ids || []).length;
      if (!plan.add.length && !plan.update.length && !idsChanged) {
        say("Up to date. Latest day received: " + days[days.length - 1].date + ".");
        return;
      }
      live.activities = live.activities || [];
      plan.add.forEach((row) => live.activities.push({ ...row }));
      plan.update.forEach((u) => {
        const a = live.activities.find((x) => x.id === u.id);
        if (a) Object.assign(a, u.row);
      });
      live.fitnessImport = { ids: plan.ids, importedAt: new Date().toISOString() };
      app.renderAll();
      await app.saveData(true);
      const parts = [];
      if (plan.add.length) parts.push(plan.add.length + " new");
      if (plan.update.length) parts.push(plan.update.length + " updated");
      const manualSkips = plan.skipped.filter((s) => s.why === "manual").length;
      if (manualSkips) parts.push(manualSkips + " left as you entered");
      say("Imported from Apple Health: " + (parts.join(", ") || "nothing new") + ". Latest day: " + days[days.length - 1].date + ".");
    } finally {
      busy = false;
    }
  }

  function idleStatus() {
    const el = $("fitnessSyncStatus");
    const fi = window.LifeLedgerApp?.getState?.().fitnessImport;
    if (!el || !/^Not checked yet/.test(el.textContent)) return;
    el.textContent = fi && fi.importedAt ? "Last import " + fmtWhen(fi.importedAt) + ". New days are picked up automatically when you open the app." : "Not set up yet — see “Set up automatic import” below.";
  }

  function dueNow() {
    try { return Date.now() - Number(localStorage.getItem(AUTO_CHECK_KEY) || 0) > AUTO_EVERY_MS; } catch { return true; }
  }

  function userIsBusy() {
    const el = document.activeElement;
    const typing = Boolean(el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    return typing || Boolean(document.querySelector(".modal:not([hidden])"));
  }

  function autoCheck() {
    if (document.hidden || !window.LifeLedgerAuth?.isUnlocked?.() || busy || !dueNow()) return;
    if (userIsBusy()) { setTimeout(autoCheck, 20000); return; }
    run({ manual: false });
  }

  function fillSetup() {
    const el = $("fitnessUploadUrl");
    if (!el) return;
    const url = (localStorage.getItem("lifeLedgerStockProxyUrl") || "").trim();
    el.textContent = url || "(add your Apps Script URL in Settings first)";
  }

  window.LifeLedgerFitness = { run, autoCheck };

  window.addEventListener("load", () => {
    $("fitnessSyncNow")?.addEventListener("click", () => run({ manual: true }));
    fillSetup();
    $("fitnessCopyUrl")?.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText($("fitnessUploadUrl").textContent); say("Address copied."); } catch { say("Select the address and copy it."); }
    });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(autoCheck, 2500); });
    window.addEventListener("pageshow", () => setTimeout(autoCheck, 2500));
    window.addEventListener("focus", () => setTimeout(autoCheck, 2500));
    window.addEventListener("online", () => setTimeout(autoCheck, 2500));
    window.LifeLedgerSync?.onStatus((st) => { if (st.state === "synced") { setTimeout(autoCheck, 2500); setTimeout(idleStatus, 2000); } });
    setInterval(autoCheck, AUTO_POLL_MS);
  });
})();
