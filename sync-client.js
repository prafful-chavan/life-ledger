/**
 * Life Ledger — sync client for the Apps Script sync gateway.
 *
 * Responsibilities: talk to the gateway (pull / compare-and-swap push),
 * merge via LifeLedgerSyncEngine, retry on conflicts, poll while visible and
 * react to focus / online events. Crypto and persistence stay in auth.js and
 * are injected through init() so this module has no hidden dependencies.
 */
(function () {
  const STATE_KEY = "lifeLedgerSync:v1";
  const PROXY_KEY = "lifeLedgerStockProxyUrl";
  const POLL_MS = 45 * 1000;
  const MAX_ROUNDS = 5;
  const AUTH_SALT = "life-ledger/sync-auth/v1";

  let host = null;
  let token = null;
  let tokenFor = null;
  let running = null;
  let again = false;
  let dirty = false;
  let dirtyGen = 0;
  let pollTimer = null;
  let status = { state: "off", detail: "", at: 0 };
  const listeners = new Set();

  const Engine = () => window.LifeLedgerSyncEngine;

  function readState() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || "{}") || {}; } catch { return {}; }
  }
  function writeState(patch) {
    try { localStorage.setItem(STATE_KEY, JSON.stringify({ ...readState(), ...patch })); } catch { /* ignore */ }
  }

  function proxyUrl() {
    try { return (localStorage.getItem(PROXY_KEY) || "").trim(); } catch { return ""; }
  }

  function setStatus(state, detail) {
    status = { state, detail: detail || "", at: Date.now() };
    listeners.forEach((fn) => { try { fn(status); } catch { /* ignore */ } });
  }

  async function deriveToken(password) {
    if (token && tokenFor === password) return token;
    const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: new TextEncoder().encode(AUTH_SALT), iterations: 100000, hash: "SHA-256" },
      km,
      256
    );
    token = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
    tokenFor = password;
    return token;
  }

  async function post(body) {
    const url = proxyUrl();
    if (!url) throw new Error("no-gateway");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
      redirect: "follow",
    });
    if (!res.ok) throw new Error("Gateway HTTP " + res.status);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Gateway error");
    return json;
  }

  async function probe() {
    const url = proxyUrl();
    if (!url) return null;
    try {
      const res = await fetch(url + (url.includes("?") ? "&" : "?") + "syncMeta=1", { redirect: "follow" });
      const json = await res.json();
      return json && json.gateway ? json : null;
    } catch {
      return null;
    }
  }

  function userIsTyping() {
    const el = document.activeElement;
    return Boolean(el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.type !== "checkbox" && el.type !== "button");
  }

  async function round() {
    const E = Engine();
    if (host.beforeSync) await host.beforeSync();
    const state = readState();
    const token_ = await deriveToken(host.getPassword());
    const pulled = await post({ op: "pull", token: token_, sinceRev: state.rev || 0 });

    let local = host.getLocal();
    let remoteData = null;
    const rev = pulled.rev || 0;
    const genAtMerge = dirtyGen;

    if (pulled.vault && !pulled.unchanged) {
      const remoteInner = await host.decryptVault(pulled.vault);
      const remote = { data: remoteInner.data, meta: remoteInner.sync || E.emptyMeta() };
      remoteData = remote.data;
      if (userIsTyping()) { setStatus("synced", "Update waiting — finish typing"); return { retry: 3000 }; }
      // The host merges into the app's LIVE data in one step (see auth.js), so edits made while
      // we were waiting on the network or decrypting are kept.
      const r = await host.mergeRemote(remote);
      local = { data: r.data, meta: r.meta, vault: r.vault };
      if (!r.remoteBehind && dirtyGen === genAtMerge) {
        writeState({ rev, lastOkAt: Date.now() });
        return { done: true };
      }
    } else if (!dirty && pulled.rev) {
      writeState({ rev, lastOkAt: Date.now() });
      return { done: true };
    }

    // Safety net: never push a sudden pile of extra copies of rows the cloud already holds. That is what an out-of-date copy
    // of the app looks like after an import replaced the holdings; the cure is on this device (Data health → remove copies).
    const HI = window.LifeLedgerHoldingsIntegrity;
    if (HI && remoteData) {
      const hits = HI.duplicateSurge(remoteData, local.data);
      if (hits.length) {
        console.warn("[sync] push blocked: duplicate surge", hits);
        return { blocked: true, detail: "Sync paused to protect your data: this device has many repeated holdings rows that the cloud does not. Open Data health and remove the extra copies, or reload the page." };
      }
    }

    // Push our (possibly merged) state, guarded by the revision we merged against.
    const pushed = await post({ op: "push", token: token_, baseRev: rev, vault: local.vault });
    if (pushed.conflict) return { conflict: true };
    // Only clear the flag if nothing was saved while this round was running.
    if (dirtyGen === genAtMerge) dirty = false;
    writeState({ rev: pushed.rev, lastOkAt: Date.now() });
    return { done: true };
  }

  async function runOnce(reason) {
    if (!host || !host.isReady()) return;
    if (!proxyUrl()) { setStatus("off"); return; }
    if (typeof navigator !== "undefined" && navigator.onLine === false) { setStatus("offline"); return; }
    setStatus("syncing", reason || "");
    try {
      for (let i = 0; i < MAX_ROUNDS; i++) {
        const r = await round();
        if (r.retry) { setTimeout(() => api.sync("deferred"), r.retry); return; }
        if (r.blocked) { setStatus("error", r.detail); return; }
        if (r.done) { setStatus("synced"); return; }
      }
      setStatus("error", "Too many concurrent changes — will retry");
    } catch (err) {
      if (err.name === "AbortError") setStatus("error", "Sync timed out — retrying");
      else if (err.message === "unauthorized") setStatus("error", "Sync password mismatch — sign in again");
      else setStatus(navigator.onLine === false ? "offline" : "error", err.message);
    }
  }

  const api = {
    init(h) {
      host = h;
      document.addEventListener("visibilitychange", () => { if (!document.hidden) api.sync("visible"); });
      window.addEventListener("focus", () => api.sync("focus"));
      window.addEventListener("online", () => api.sync("online"));
    },

    onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    getStatus() { return { ...status, rev: readState().rev || 0, lastOkAt: readState().lastOkAt || 0 }; },
    isConfigured() { return Boolean(proxyUrl()); },
    probe,

    /** Run a sync cycle; coalesces concurrent requests into one extra pass. */
    sync(reason) {
      if (running) { again = true; return running; }
      running = (async () => {
        try {
          do { again = false; await runOnce(reason); } while (again);
        } finally { running = null; }
      })();
      return running;
    },

    /** Call after any local change has been durably saved. */
    markDirty() {
      dirty = true;
      dirtyGen++;
      clearTimeout(api._debounce);
      api._debounce = setTimeout(() => api.sync("local-change"), 1500);
    },

    start() {
      api.stop();
      api.sync("start");
      pollTimer = setInterval(() => { if (!document.hidden) api.sync("poll"); }, POLL_MS);
    },

    stop() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
      clearTimeout(api._debounce);
    },

    /** Authenticated gateway call for add-on features (e.g. spending import). */
    async call(op, extra) {
      const t = await deriveToken(host.getPassword());
      return post({ op, token: t, ...(extra || {}) });
    },

    async listBackups() {
      const t = await deriveToken(host.getPassword());
      return (await post({ op: "listBackups", token: t })).backups || [];
    },

    async loadBackup(id) {
      const t = await deriveToken(host.getPassword());
      const res = await post({ op: "getBackup", token: t, id });
      const inner = await host.decryptVault(res.backup.vault);
      return { data: inner.data, at: res.backup.updatedAt, rev: res.backup.rev };
    },

    async snapshotNow() {
      const t = await deriveToken(host.getPassword());
      await post({ op: "snapshotNow", token: t });
    },

    /** Forget cached secrets (sign-out). */
    reset() {
      token = null;
      tokenFor = null;
      dirty = false;
      api.stop();
      setStatus("off");
    },
  };

  window.LifeLedgerSync = api;
})();
