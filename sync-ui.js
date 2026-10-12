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
      if (document.getElementById("updateBanner")) return;
      const bar = document.createElement("div");
      bar.id = "updateBanner";
      bar.setAttribute("role", "status");
      bar.style.cssText = "position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9999;background:#18223a;color:#fff;padding:10px 14px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.3);display:flex;gap:12px;align-items:center;font-size:14px;max-width:calc(100vw - 32px)";
      bar.innerHTML = '<span>A new version is ready.</span><button type="button" style="background:#5ec8a0;border:0;border-radius:8px;padding:6px 12px;font-weight:600;cursor:pointer">Reload</button>';
      bar.querySelector("button").addEventListener("click", () => location.reload());
      document.body.appendChild(bar);
    });
  }

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
