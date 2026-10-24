/**
 * Life Ledger — PWA registration, update prompt and the Settings → Multi-device sync panel.
 */
(function () {
  // ── Service worker + "new version" prompt ──────────────────────────────────
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    const hadController = Boolean(navigator.serviceWorker.controller);
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((err) => console.warn("SW registration failed:", err));
    });
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController) return; // first install, nothing stale to replace
      showUpdateBanner();
    });
  }

  // ── A new release: say so, and update cleanly ───────────────────────────────
  // Only the app's own cached files are cleared; your vault, passwords and settings are not touched.
  async function updateNow() {
    try {
      if ("serviceWorker" in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
      if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
    } catch (e) { /* reload anyway */ }
    location.replace(location.pathname + "?r=" + Date.now());   // a new address, so no stored copy of the page can answer
  }

  function showUpdateBanner() {
    if (document.getElementById("updateBanner")) return;
    const bar = document.createElement("div");
    bar.id = "updateBanner";
    bar.setAttribute("role", "status");
    bar.style.cssText = "position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9999;background:#18223a;color:#fff;padding:10px 14px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.25);display:flex;gap:12px;align-items:center;font-size:14px";
    bar.innerHTML = '<span>A new version is ready.</span><button type="button" style="background:#5ec8a0;border:0;border-radius:8px;padding:6px 12px;font-weight:600;cursor:pointer">Update</button>';
    bar.querySelector("button").addEventListener("click", updateNow);
    document.body.appendChild(bar);
  }

  const AV = () => window.LifeLedgerAppVersion;
  // The release is what index.html itself loads. Taken now, before the app adds heavy files on demand (those have their own numbers
  // and are not part of what index.html lists), so it can be compared with a freshly fetched index.html.
  const pageUrls = [...document.querySelectorAll("script[src], link[rel='stylesheet'][href]")].map((e) => e.getAttribute("src") || e.getAttribute("href"));
  const loadedVersions = () => AV().fromUrls(pageUrls);
  async function liveVersions() {
    const res = await fetch(location.pathname + "?cb=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return AV().fromHtml(await res.text());
  }

  /** Compares this device's release with the live one. quiet = no Settings text, just the banner when there is a newer one. */
  async function checkRelease(quiet) {
    if (!AV() || location.protocol === "file:") return null;
    const mine = loadedVersions();
    const code = AV().releaseCode(mine);
    const badge = document.getElementById("appReleaseCode"), detail = document.getElementById("appVersionDetail"), status = document.getElementById("appVersionStatus"), upd = document.getElementById("appVersionUpdateButton");
    if (badge) badge.textContent = code;
    if (detail) detail.textContent = ["app", "layout", "styles"].map((n) => { const f = Object.keys(mine).find((k) => k.startsWith(n === "app" ? "app.js" : n === "layout" ? "layout.css" : "styles.css")); return f ? `${n} ${mine[f]}` : null; }).filter(Boolean).join(" · ") + ` · ${Object.keys(mine).length} files`;
    try {
      const live = await liveVersions();
      const cmp = AV().compare(mine, live);
      if (status && !quiet) status.textContent = cmp.same ? `You are on the newest release (${code}).` : `A newer release is live (${AV().releaseCode(live)}; ${cmp.changed.length} file${cmp.changed.length === 1 ? "" : "s"} changed). Press Update now.`;
      if (upd) upd.hidden = cmp.same;
      if (!cmp.same) showUpdateBanner();
      return cmp;
    } catch (e) {
      if (status && !quiet) status.textContent = "Could not check (offline?). This device will keep working with the release it has.";
      return null;
    }
  }

  window.addEventListener("load", () => {
    const btn = document.getElementById("appVersionCheckButton"), upd = document.getElementById("appVersionUpdateButton");
    if (btn) btn.addEventListener("click", () => { const s = document.getElementById("appVersionStatus"); if (s) s.textContent = "Checking…"; checkRelease(false); });
    if (upd) upd.addEventListener("click", updateNow);
    const open = document.getElementById("settingsButton");
    if (open) open.addEventListener("click", () => checkRelease(false));
    setTimeout(() => checkRelease(true), 4000);
    setInterval(() => checkRelease(true), 30 * 60 * 1000);
  });
  // A phone or tablet app left suspended for days wakes up on its old code: check as soon as it is shown again
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkRelease(true); });

  // ── Settings panel ─────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const LABELS = { off: "Not configured", syncing: "Syncing…", synced: "Up to date", offline: "Offline", error: "Needs attention" };

  function render(st) {
    const badge = $("syncGatewayBadge");
    if (!badge) return;
    const s = window.LifeLedgerSync?.getStatus?.() || st || {};
    badge.textContent = LABELS[s.state] || s.state || "—";
    const when = s.lastOkAt ? "Last synced " + new Date(s.lastOkAt).toLocaleTimeString() + " · revision " + (s.rev || 0) : "";
    const detail = $("syncGatewayDetail");
    if (detail) {
      detail.textContent = s.state === "off"
        ? "Set your Apps Script URL (Settings → stock price proxy) and deploy the sync gateway to enable this."
        : [s.detail, when].filter(Boolean).join(" — ");
    }
  }

  function fmt(iso) {
    const d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleString();
  }

  async function showHistory() {
    const box = $("syncGatewayHistory");
    box.hidden = false;
    box.textContent = "Loading…";
    try {
      const list = await window.LifeLedgerSync.listBackups();
      if (!list.length) { box.textContent = "No snapshots yet — they are created automatically every few hours and before any large deletion."; return; }
      box.innerHTML = "";
      list.slice(0, 15).forEach((b) => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line, #ddd);font-size:13px";
        const label = document.createElement("span");
        label.textContent = fmt(b.at) + (/shrink/.test(b.name) ? " · before deletion" : /manual/.test(b.name) ? " · manual" : "");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "secondary-button";
        btn.textContent = "Restore";
        btn.addEventListener("click", () => restore(b));
        row.append(label, btn);
        box.appendChild(row);
      });
    } catch (err) {
      box.textContent = "Could not load history: " + err.message;
    }
  }

  async function restore(b) {
    if (!confirm("Restore the snapshot from " + fmt(b.at) + "?\n\nYour current data is saved as a snapshot first, so you can undo this.")) return;
    try {
      await window.LifeLedgerSync.snapshotNow();
      const { data } = await window.LifeLedgerSync.loadBackup(b.id);
      await window.LifeLedgerAuth.saveAppData(data); // stamps the diff so every device follows the restore
      window.LifeLedgerApp.applyRemoteData(data);
      alert("Restored. Other devices will pick this up automatically.");
    } catch (err) {
      alert("Restore failed: " + err.message);
    }
  }

  window.addEventListener("load", () => {
    $("syncGatewayNowButton")?.addEventListener("click", () => window.LifeLedgerSync?.sync("manual"));
    $("syncGatewayHistoryButton")?.addEventListener("click", showHistory);
    const wire = () => window.LifeLedgerSync?.onStatus(render);
    wire();
    render();
    setInterval(render, 15000);
  });
})();
