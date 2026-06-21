/**
 * Life Ledger — password-protected encrypted vault (+ Google Drive sync).
 */
(function () {
  const SESSION_KEY = "lifeLedgerSession:v1";
  const REMEMBER_KEY = "lifeLedgerRemember:v1";
  const SESSION_HOURS = 12;
  const REMEMBER_DAYS = 30;
  const PBKDF2_ITERATIONS = 250000;

  let vaultMeta = null;
  let unlockedPayload = null;
  let lastDriveFetchTime = 0;

  function enc() {
    return new TextEncoder();
  }

  function dec() {
    return new TextDecoder();
  }

  function bytesToBase64(bytes) {
    const arr = new Uint8Array(bytes);
    let bin = "";
    const chunkSize = 0xffff;
    for (let i = 0; i < arr.length; i += chunkSize) {
      bin += String.fromCharCode(...arr.subarray(i, i + chunkSize));
    }
    return btoa(bin);
  }

  function base64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function randomBytes(length) {
    return crypto.getRandomValues(new Uint8Array(length));
  }

  async function deriveAesKey(password, salt) {
    const keyMaterial = await crypto.subtle.importKey("raw", enc().encode(password), "PBKDF2", false, [
      "deriveKey",
    ]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  // ─── Compression helpers (native CompressionStream / DecompressionStream) ──
  // These are available in all modern browsers: Chrome 80+, Safari 16.4+, Firefox 113+

  function supportsCompression() {
    return typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";
  }

  async function compressBytes(inputBytes) {
    if (!supportsCompression()) return inputBytes;
    const cs = new CompressionStream("gzip");
    const writer = cs.writable.getWriter();
    writer.write(inputBytes);
    writer.close();
    const chunks = [];
    const reader = cs.readable.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    let totalLen = 0;
    for (const c of chunks) totalLen += c.length;
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) { result.set(c, offset); offset += c.length; }
    return result;
  }

  async function decompressBytes(compressedBytes) {
    if (!supportsCompression()) throw new Error("Decompression not supported");
    const ds = new DecompressionStream("gzip");
    const writer = ds.writable.getWriter();
    writer.write(compressedBytes);
    writer.close();
    const chunks = [];
    const reader = ds.readable.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    let totalLen = 0;
    for (const c of chunks) totalLen += c.length;
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) { result.set(c, offset); offset += c.length; }
    return result;
  }

  async function encryptJson(key, payload) {
    const iv = randomBytes(12);
    const jsonBytes = enc().encode(JSON.stringify(payload));
    // Compress before encrypting to reduce payload size
    let plaintext;
    let compressed = false;
    if (supportsCompression()) {
      try {
        plaintext = await compressBytes(jsonBytes);
        compressed = true;
        const ratio = ((1 - plaintext.length / jsonBytes.length) * 100).toFixed(0);
        console.log(`[auth.js] Vault compressed: ${jsonBytes.length} → ${plaintext.length} bytes (${ratio}% reduction)`);
      } catch (e) {
        console.warn("[auth.js] Compression failed, falling back to uncompressed:", e);
        plaintext = jsonBytes;
      }
    } else {
      plaintext = jsonBytes;
    }
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
    return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(ciphertext), compressed };
  }

  async function decryptJson(key, ivB64, ciphertextB64, isCompressed = false) {
    const iv = base64ToBytes(ivB64);
    const ciphertext = base64ToBytes(ciphertextB64);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    let jsonBytes;
    if (isCompressed && supportsCompression()) {
      try {
        jsonBytes = await decompressBytes(new Uint8Array(plaintext));
      } catch (e) {
        console.warn("[auth.js] Decompression failed, trying as raw JSON:", e);
        jsonBytes = new Uint8Array(plaintext);
      }
    } else {
      jsonBytes = new Uint8Array(plaintext);
    }
    return JSON.parse(dec().decode(jsonBytes));
  }

  function readSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(REMEMBER_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session?.expiresAt || Date.now() > session.expiresAt) {
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(REMEMBER_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  function writeSession(expiresAt) {
    const session = { expiresAt, ok: true };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    unlockedPayload = null;
  }

  function rememberPasswordEnabled() {
    return document.getElementById("rememberDevice")?.checked !== false;
  }

  function readRememberedPassword() {
    try {
      const raw = localStorage.getItem(REMEMBER_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data?.expiresAt || Date.now() > data.expiresAt) {
        localStorage.removeItem(REMEMBER_KEY);
        return null;
      }
      return data.password || null;
    } catch {
      return null;
    }
  }

  function saveRememberedPassword(password) {
    const shortExpiry = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
    if (!rememberPasswordEnabled() || !password) {
      localStorage.removeItem(REMEMBER_KEY);
      writeSession(shortExpiry);
      return;
    }
    const longExpiry = Date.now() + REMEMBER_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(
      REMEMBER_KEY,
      JSON.stringify({
        expiresAt: longExpiry,
        password,
        ok: true,
      })
    );
    writeSession(longExpiry);
  }

  function vaultInnerPayload(data, totpSecret) {
    return {
      totpSecret: totpSecret || null,
      data,
    };
  }

  /**
   * Create a content fingerprint for an item without an id.
   * Uses a fast string hash of key properties to detect duplicates.
   */
  function itemContentKey(item) {
    // For chat messages: role + text + timestamp is unique enough
    if (item.role !== undefined && item.text !== undefined) {
      return `chat:${item.role}:${item.text}:${item.at || ''}`;
    }
    // Fallback: JSON-stringify the whole item (slow but safe)
    return JSON.stringify(item);
  }

  /**
   * Compute a fast hash of vault data content for comparison.
   * Returns a string fingerprint that changes when data changes.
   */
  function vaultDataFingerprint(data) {
    if (!data) return 'null';
    const arrayKeys = [
      'income', 'expenses', 'assets', 'liabilities',
      'mutualFunds', 'stocks', 'fd', 'epf', 'bonds', 'ppf',
      'gold', 'silver', 'crypto', 'usstocks', 'banksaving', 'others',
      'goals', 'tasks', 'studies', 'workouts', 'habits', 'chat'
    ];
    // Count entries and collect all IDs/content keys for a deterministic fingerprint
    const parts = [];
    for (const key of arrayKeys) {
      const arr = Array.isArray(data[key]) ? data[key] : [];
      const ids = arr.map(item => item.id || itemContentKey(item)).sort();
      parts.push(`${key}:${ids.length}:[${ids.join(',')}]`);
    }
    return parts.join('|');
  }

  function mergeVaultData(localData, remoteData) {
    if (!localData) return remoteData;
    if (!remoteData) return localData;
    const merged = { ...localData };
    const arrayKeys = [
      'income', 'expenses', 'assets', 'liabilities',
      'mutualFunds', 'stocks', 'fd', 'epf', 'bonds', 'ppf',
      'gold', 'silver', 'crypto', 'usstocks', 'banksaving', 'others',
      'goals', 'tasks', 'studies', 'workouts', 'habits', 'chat'
    ];
    arrayKeys.forEach(key => {
      const localArr = Array.isArray(localData[key]) ? localData[key] : [];
      const remoteArr = Array.isArray(remoteData[key]) ? remoteData[key] : [];
      if (!localArr.length && !remoteArr.length) { merged[key] = []; return; }
      if (!localArr.length) { merged[key] = remoteArr; return; }
      if (!remoteArr.length) { merged[key] = localArr; return; }

      const mergedList = [];
      const seenIds = new Set();
      // Track content fingerprints for items without IDs (e.g. chat messages)
      const seenContentKeys = new Set();

      const addItem = (item) => {
        if (!item) return;
        if (item.id) {
          // ID-based dedup (standard path)
          if (seenIds.has(item.id)) return;
          seenIds.add(item.id);
        } else {
          // Content-based dedup for items without IDs (chat, etc.)
          const contentKey = itemContentKey(item);
          if (seenContentKeys.has(contentKey)) return;
          seenContentKeys.add(contentKey);
        }
        mergedList.push(item);
      };

      // Keep local first, then remote
      localArr.forEach(addItem);
      remoteArr.forEach(addItem);

      merged[key] = mergedList;
    });
    return merged;
  }

  function countEntries(data) {
    if (!data) return 0;
    return ['income','expenses','assets','liabilities','mutualFunds','stocks',
      'fd','epf','bonds','ppf','gold','silver','crypto','usstocks',
      'banksaving','others','goals','tasks','studies','workouts','habits'
    ].reduce((total, key) => total + (Array.isArray(data[key]) ? data[key].length : 0), 0);
  }

  async function loadVaultFromDrive() {
    if (!window.LifeLedgerDrive?.tryRestoreVault) return null;
    try {
      return await window.LifeLedgerDrive.tryRestoreVault();
    } catch (error) {
      console.warn("Drive restore:", error);
      return null;
    }
  }

  /**
   * Load the vault, preferring whichever copy (local or Drive) is newer.
   * This ensures a fresh device always gets the latest data from Drive.
   */
  async function loadVaultFile() {
    let local = null;
    if (window.LifeLedgerVaultStore) {
      local = await window.LifeLedgerVaultStore.load();
    }

    const remote = await loadVaultFromDrive();

    // Record when we last fetched from Drive so unlockApp can skip redundant sync
    if (remote) lastDriveFetchTime = Date.now();

    if (!local && !remote) return null;
    if (!local) {
      // Fresh device — save Drive vault locally
      if (window.LifeLedgerVaultStore) await window.LifeLedgerVaultStore.save(remote);
      console.log("[auth.js] Loaded vault from Drive (no local copy).");
      return remote;
    }
    if (!remote) {
      console.log("[auth.js] Loaded vault from local storage (Drive unavailable).");
      return local;
    }

    const localTime = new Date(local.updatedAt || 0).getTime();
    const remoteTime = new Date(remote.updatedAt || 0).getTime();

    if (remoteTime > localTime) {
      // Drive has newer data — use it and update local
      if (window.LifeLedgerVaultStore) await window.LifeLedgerVaultStore.save(remote);
      console.log(`[auth.js] Drive vault is newer (${remote.updatedAt} vs local ${local.updatedAt}). Using Drive copy.`);
      return remote;
    }

    console.log(`[auth.js] Local vault is current. Using local copy.`);
    return local;
  }

  let currentSyncState = "synced"; // "syncing", "synced", "failed"

  function updateSyncStatusUI(state) {
    currentSyncState = state;
    const badge = document.getElementById("topbarSyncStatus");
    if (!badge) return;

    if (!window.LifeLedgerDrive?.hasLinkedDrive?.()) {
      badge.style.display = "none";
      return;
    }

    badge.style.display = "flex";
    badge.className = "sync-status " + state;
    
    const iconEl = badge.querySelector(".sync-icon");
    const textEl = badge.querySelector(".sync-text");

    if (state === "syncing") {
      if (iconEl) iconEl.textContent = "⟳";
      if (textEl) textEl.textContent = "Saving to Drive...";
    } else if (state === "synced") {
      if (iconEl) iconEl.textContent = "✓";
      if (textEl) textEl.textContent = "Saved to Drive";
    } else if (state === "failed") {
      if (iconEl) iconEl.textContent = "⚠";
      if (textEl) textEl.textContent = "Sync failed (retry)";
    }
  }

  // Register beforeunload handler to warn users if sync is in progress
  window.addEventListener("beforeunload", (event) => {
    if (currentSyncState === "syncing") {
      event.preventDefault();
      event.returnValue = "Google Drive sync is in progress. Are you sure you want to leave?";
      return event.returnValue;
    }
  });

  let activeUploadPromise = null;
  let nextUploadVault = null;
  let saveGeneration = 0;
  const MAX_UPLOAD_RETRIES = 3;

  function triggerDriveUpload(vault) {
    if (!window.LifeLedgerDrive?.hasLinkedDrive?.()) return;

    saveGeneration++;
    nextUploadVault = vault;

    if (activeUploadPromise) {
      return;
    }

    const runUpload = async () => {
      const currentVault = nextUploadVault;
      const currentGen = saveGeneration;
      nextUploadVault = null;
      if (!currentVault) return;

      updateSyncStatusUI("syncing");

      activeUploadPromise = (async () => {
        let retries = 0;
        while (retries <= MAX_UPLOAD_RETRIES) {
          // If a newer save was queued while we were retrying, abort this one
          if (saveGeneration > currentGen && nextUploadVault) {
            console.log("[auth.js] Newer save queued, skipping current upload.");
            break;
          }
          try {
            console.log(`[auth.js] Uploading vault to Google Drive${retries > 0 ? ` (retry ${retries})` : ''}...`);
            await window.LifeLedgerDrive.saveVault(currentVault);
            // Update cached remote time so background poller knows we're current
            if (currentVault.updatedAt) {
              window.LifeLedgerDrive.updateCachedRemoteTime?.(currentVault.updatedAt);
            }
            console.log("[auth.js] Google Drive upload completed successfully.");
            updateDriveBadge();
            markLastSynced();
            updateSyncStatusUI("synced");
            return; // success
          } catch (error) {
            retries++;
            if (retries > MAX_UPLOAD_RETRIES) {
              console.warn("[auth.js] Drive upload failed after max retries:", error);
              toastAuth("Google Drive sync failed. Will retry on next change.");
              updateSyncStatusUI("failed");
            } else {
              const backoffMs = Math.min(1000 * Math.pow(2, retries - 1), 8000);
              console.warn(`[auth.js] Upload retry ${retries}/${MAX_UPLOAD_RETRIES} in ${backoffMs}ms:`, error.message);
              await new Promise(r => setTimeout(r, backoffMs));
            }
          }
        }
      })();

      await activeUploadPromise;
      activeUploadPromise = null;

      if (nextUploadVault) {
        runUpload();
      }
    };

    runUpload();
  }

  async function saveVaultFile(vault) {
    if (!window.LifeLedgerVaultStore) {
      throw new Error("Vault storage is not available.");
    }
    console.log("[auth] Vault saved locally.");
    await window.LifeLedgerVaultStore.save(vault);
    vaultMeta = vault;

    triggerDriveUpload(vault);
  }

  async function buildVault(password, innerPayload, existingSalt = null, existingKey = null) {
    const salt = existingSalt || randomBytes(16);
    const key = existingKey || await deriveAesKey(password, salt);
    const { iv, ciphertext, compressed } = await encryptJson(key, innerPayload);
    return {
      v: 1,
      salt: bytesToBase64(salt),
      iv,
      ciphertext,
      compressed: compressed || false,
      updatedAt: new Date().toISOString(),
      entryCount: countEntries(innerPayload?.data),
    };
  }

  async function openVault(password, vault) {
    const salt = base64ToBytes(vault.salt);
    const key = await deriveAesKey(password, salt);
    return decryptJson(key, vault.iv, vault.ciphertext, vault.compressed || false);
  }

  function migrateLegacyPlaintext() {
    try {
      const legacy = localStorage.getItem("lifeLedgerData:v1");
      if (!legacy) return null;
      return JSON.parse(legacy);
    } catch {
      return null;
    }
  }

  function showGate(view) {
    document.getElementById("authGate")?.classList.toggle("hidden", view === "app");
    document.getElementById("appShell")?.classList.toggle("hidden", view !== "app");
    document.body.classList.toggle("auth-locked", view !== "app");
  }

  function setAuthMessage(elId, text, isError) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("auth-error", Boolean(isError && text));
  }

  function showAuthPanel(panel) {
    document.querySelectorAll("[data-auth-panel]").forEach((node) => {
      node.hidden = node.dataset.authPanel !== panel;
    });
  }

  async function persistAppData(data) {
    if (!unlockedPayload) throw new Error("Not unlocked");
    console.log("[auth.js] Persisting updated app data to storage...");
    unlockedPayload.data = data;
    const password = unlockedPayload._sessionPassword;
    const salt = unlockedPayload._salt;
    const sessionKey = unlockedPayload._sessionKey;
    if (!password || !vaultMeta) throw new Error("Session expired — sign in again");
    const vault = await buildVault(
      password,
      vaultInnerPayload(unlockedPayload.data, unlockedPayload.totpSecret),
      salt,
      sessionKey
    );
    await saveVaultFile(vault);
    console.log("[auth.js] App data persistence completed successfully.");
  }

  // Background sync poller — metadata-only checks with exponential backoff
  let syncPollerTimer = null;
  const POLL_BASE_MS = 45 * 1000;     // 45 seconds when tab is active
  const POLL_MAX_MS = 3 * 60 * 1000;  // 3 minutes max when idle
  let pollBackoffMultiplier = 1;

  function getPollerInterval() {
    // When tab is hidden, increase interval progressively
    if (document.hidden) {
      pollBackoffMultiplier = Math.min(pollBackoffMultiplier * 2, POLL_MAX_MS / POLL_BASE_MS);
    } else {
      pollBackoffMultiplier = 1;
    }
    return Math.min(POLL_BASE_MS * pollBackoffMultiplier, POLL_MAX_MS);
  }

  function startSyncPoller() {
    stopSyncPoller();
    if (!window.LifeLedgerDrive?.isConnected?.()) return;

    // Reset backoff on tab focus
    const resetBackoff = () => { pollBackoffMultiplier = 1; };
    document.addEventListener("visibilitychange", resetBackoff);

    const scheduleNext = () => {
      const interval = getPollerInterval();
      syncPollerTimer = setTimeout(runPoll, interval);
    };

    const runPoll = async () => {
      if (!unlockedPayload) { stopSyncPoller(); return; }

      // Check if we're on a slow/metered connection — skip polling if so
      try {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (conn && (conn.saveData || conn.effectiveType === "slow-2g" || conn.effectiveType === "2g")) {
          console.log("[auth.js] Skipping poll — slow/metered connection detected.");
          scheduleNext();
          return;
        }
      } catch(e) {}

      try {
        // Lightweight metadata-only check (~200 bytes)
        const { changed, remoteMeta } = await window.LifeLedgerDrive.hasRemoteChanged();
        
        if (changed) {
          console.log("[auth.js] Background poll: remote vault changed, pulling...");
          const msg = await syncWithDrive(true); // full sync only when needed
          if (msg && (msg.includes("Merged") || msg.includes("pulled"))) {
            updateDriveBadge();
            markLastSynced();
            toastAuth("\u2713 " + msg);
            console.log("[auth.js] Background sync:", msg);
          } else if (msg && msg.includes("up to date")) {
            markLastSynced();
          }
        } else {
          // No change — just update the last-synced timestamp silently
          markLastSynced();
        }
      } catch (e) {
        console.warn("[auth.js] Background poll failed:", e.message);
      }

      scheduleNext();
    };

    // Store cleanup ref
    syncPollerTimer = { _resetBackoff: resetBackoff };
    scheduleNext();
  }

  function stopSyncPoller() {
    if (syncPollerTimer) {
      if (syncPollerTimer._resetBackoff) {
        document.removeEventListener("visibilitychange", syncPollerTimer._resetBackoff);
      }
      clearTimeout(syncPollerTimer);
      syncPollerTimer = null;
    }
    pollBackoffMultiplier = 1;
  }

  function unlockApp(inner, password, salt = null, key = null) {
    unlockedPayload = { 
      ...inner, 
      _sessionPassword: password,
      _salt: salt,
      _sessionKey: key
    };
    saveRememberedPassword(password);

    const loader = document.getElementById("appLoading");
    if (loader) {
      loader.classList.remove("hidden");
    }

    showGate("app");

    // Defer bootstrapping slightly to let the browser paint the loading spinner first
    setTimeout(() => {
      try {
        window.LifeLedgerApp?.bootstrap(inner.data);
      } finally {
        if (loader) {
          loader.classList.add("hidden");
        }
      }

      updateSyncStatusUI(window.LifeLedgerDrive?.hasLinkedDrive?.() ? "synced" : "offline");

      if (window.LifeLedgerDrive?.isConnected?.()) {
        // Skip redundant sync if Drive was already fetched recently during init/loadVaultFile
        const skipInitialSync = (Date.now() - lastDriveFetchTime) < 10000;

        if (!skipInitialSync) {
          const runSync = async () => {
            try {
              const msg = await syncWithDrive(true); // silent first run
              updateDriveBadge();
              markLastSynced();
              if (msg && (msg.includes("Merged") || msg.includes("pulled") || msg.includes("restored"))) {
                toastAuth("✓ " + msg);
              }
            } catch (error) {
              console.warn("Auto-sync on unlock failed:", error.message);
            }
          };

          // Slight delay so the UI can render first
          setTimeout(runSync, 300);
        } else {
          console.log("[auth.js] Skipping post-unlock sync — Drive was fetched", ((Date.now() - lastDriveFetchTime) / 1000).toFixed(1), "s ago.");
          updateDriveBadge();
          markLastSynced();
        }

        // Start polling for changes every 60 seconds
        setTimeout(startSyncPoller, 5000);
      }
    }, 50);
  }

  async function tryAutoUnlock() {
    if (!vaultMeta) return false;
    const remembered = readRememberedPassword();
    if (!remembered) return false;
    try {
      const salt = base64ToBytes(vaultMeta.salt);
      const key = await deriveAesKey(remembered, salt);
      const inner = await decryptJson(key, vaultMeta.iv, vaultMeta.ciphertext, vaultMeta.compressed || false);
      if (!inner?.data) return false;
      unlockApp(inner, remembered, salt, key);
      return true;
    } catch {
      localStorage.removeItem(REMEMBER_KEY);
      return false;
    }
  }

  async function performRestore(msgId) {
    try {
      const clientId = window.LIFE_LEDGER_CONFIG?.GOOGLE_CLIENT_ID;
      if (!clientId || clientId.includes("YOUR_CLIENT_ID")) {
        throw new Error("Add your Google Client ID in config.js (see config.example.js).");
      }
      if (!window.LifeLedgerDrive?.loadVault) {
        throw new Error("Google Drive module not loaded.");
      }
      setAuthMessage(msgId, "Connecting to Google Drive…", false);
      const remote = await window.LifeLedgerDrive.loadVault();
      if (remote) {
        setAuthMessage(msgId, "Decrypting and loading data…", false);
        await window.LifeLedgerVaultStore.save(remote);
        vaultMeta = remote;
        if (remote.updatedAt) window.LifeLedgerDrive.updateCachedRemoteTime?.(remote.updatedAt);
        setAuthMessage(msgId, "Almost ready…", false);
        showAuthPanel("login");
        setAuthMessage("loginMessage", "Vault restored from Drive. Enter your password.", false);
        if (await tryAutoUnlock()) {
          toastAuth("Vault restored and unlocked.");
        }
      } else {
        setAuthMessage(msgId, "No vault file found on Drive yet.", true);
      }
    } catch (error) {
      setAuthMessage(msgId, error.message, true);
    }
  }

  async function syncWithDrive(silent = true) {
    if (!window.LifeLedgerDrive?.hasLinkedDrive?.()) {
      return "Not synced: Google Drive not connected.";
    }

    // Flush any pending local saves first
    if (window.LifeLedgerApp?.flushSave) {
      await window.LifeLedgerApp.flushSave();
    }

    // Wait for any active or queued background uploads to complete first
    if (activeUploadPromise || nextUploadVault) {
      console.log("[auth.js] Waiting for active/queued background upload to complete before syncing...");
      while (activeUploadPromise || nextUploadVault) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    updateSyncStatusUI("syncing");

    try {
      if (!window.LifeLedgerDrive?.isConnected()) {
        if (silent) {
          updateSyncStatusUI("failed");
          return "Not synced: Google Drive not connected.";
        }
        await window.LifeLedgerDrive.connect();
      }

      const remoteVault = await window.LifeLedgerDrive.loadVault({ silent });
      if (!remoteVault) {
        if (vaultMeta) {
          await window.LifeLedgerDrive.saveVault(vaultMeta, { silent });
          window.LifeLedgerDrive.updateCachedRemoteTime?.(vaultMeta.updatedAt);
          updateSyncStatusUI("synced");
          return "Synced: Local vault pushed to Google Drive.";
        }
        throw new Error("No vault found to sync.");
      }

      if (!vaultMeta) {
        await window.LifeLedgerVaultStore.save(remoteVault);
        vaultMeta = remoteVault;
        updateSyncStatusUI("synced");
        return "Synced: Vault restored from Google Drive.";
      }

      const localTime = new Date(vaultMeta.updatedAt || 0).getTime();
      const remoteTime = new Date(remoteVault.updatedAt || 0).getTime();

      if (remoteTime > localTime) {
        if (unlockedPayload) {
          const password = unlockedPayload._sessionPassword;
          try {
            const inner = await openVault(password, remoteVault);
            if (inner && inner.data) {
              const localData = unlockedPayload.data;
              const remoteData = inner.data;
              const localCount = countEntries(localData);
              const remoteCount = countEntries(remoteData);

              // Compute fingerprints BEFORE merging to detect if merge changes anything
              const localFingerprint = vaultDataFingerprint(localData);
              const remoteFingerprint = vaultDataFingerprint(remoteData);

              const mergedData = mergeVaultData(localData, remoteData);
              const mergedCount = countEntries(mergedData);
              const mergedFingerprint = vaultDataFingerprint(mergedData);

              // If merged data is identical to local data, no actual new content
              // → just accept the remote timestamp, don't re-save or re-upload
              if (mergedFingerprint === localFingerprint) {
                // Content is identical — update local vault timestamp to match remote
                // so we don't keep re-checking, but do NOT upload back to Drive
                vaultMeta = remoteVault;
                await window.LifeLedgerVaultStore.save(remoteVault);
                window.LifeLedgerDrive.updateCachedRemoteTime?.(remoteVault.updatedAt);
                console.log(`[auth.js] Sync: remote newer but content identical (${localCount} entries). Accepted remote timestamp, no re-upload.`);
                updateSyncStatusUI("synced");
                return `Synced: Already up to date (${localCount} entries).`;
              }

              // Actual new content from remote — rebuild and save+upload
              const mergedInner = vaultInnerPayload(mergedData, inner.totpSecret || unlockedPayload.totpSecret);
              const mergedVault = await buildVault(password, mergedInner, unlockedPayload._salt, unlockedPayload._sessionKey);
              await saveVaultFile(mergedVault);
              unlockedPayload = { 
                ...mergedInner, 
                _sessionPassword: password, 
                _salt: unlockedPayload._salt, 
                _sessionKey: unlockedPayload._sessionKey 
              };
              // Use rAF to avoid layout thrashing during sync re-render
              requestAnimationFrame(() => window.LifeLedgerApp?.bootstrap(mergedData));
              console.log(`[auth.js] Sync merged: local=${localCount}, remote=${remoteCount}, merged=${mergedCount}`);
              updateSyncStatusUI("synced");
              return `Synced: Merged local (${localCount} entries) + Drive (${remoteCount} entries) → ${mergedCount} total.`;
            } else {
              throw new Error("Invalid remote vault structure.");
            }
          } catch (e) {
            updateSyncStatusUI("failed");
            if (e.message?.includes("Invalid remote vault")) throw e;
            throw new Error("Google Drive has newer changes, but they couldn't be decrypted with your current password. Please sign out and log back in.");
          }
        } else {
          // Safety check: if local has more entries, don't replace while locked!
          if (vaultMeta && (vaultMeta.entryCount || 0) > (remoteVault.entryCount || 0)) {
            console.warn(`[auth.js] Remote vault has newer timestamp but fewer entries (${remoteVault.entryCount || 0} vs local ${vaultMeta.entryCount || 0}). Postponing sync until unlocked to perform a merge.`);
            updateSyncStatusUI("failed");
            return "Not synced: Remote has fewer entries. Unlock to merge.";
          }
          vaultMeta = remoteVault;
          await window.LifeLedgerVaultStore.save(remoteVault);
          updateSyncStatusUI("synced");
          return "Synced: Updated local vault from Google Drive. Unlock to view.";
        }
      } else if (localTime > remoteTime) {
        await window.LifeLedgerDrive.saveVault(vaultMeta, { silent });
        window.LifeLedgerDrive.updateCachedRemoteTime?.(vaultMeta.updatedAt);
        updateSyncStatusUI("synced");
        return "Synced: Local changes pushed to Google Drive.";
      } else {
        updateSyncStatusUI("synced");
        return "Synced: Already up to date.";
      }
    } catch (err) {
      updateSyncStatusUI("failed");
      throw err;
    }
  }

  const LifeLedgerAuth = {
    isConfigured() {
      return Boolean(vaultMeta);
    },

    isUnlocked() {
      return Boolean(unlockedPayload && readSession());
    },

    getAppData() {
      return unlockedPayload?.data ?? null;
    },

    async init() {
      const statusEl = document.getElementById("loginMessage");
      if (statusEl) statusEl.textContent = "Loading your vault…";

      vaultMeta = await loadVaultFile();
      const legacy = migrateLegacyPlaintext();

      if (!vaultMeta) {
        showGate("auth");
        // If there's a known Drive link, show the restore panel (not setup)
        if (window.LifeLedgerDrive?.hasLinkedDrive?.()) {
          showAuthPanel("restore");
          setAuthMessage(
            "restoreMessage",
            "Your vault is on Google Drive. Restore it to continue.",
            false
          );
        } else if (legacy) {
          showAuthPanel("setup");
          setAuthMessage(
            "setupHint",
            "Existing data on this device will be encrypted and moved into your vault on setup.",
            false
          );
        } else {
          // No local vault, no Drive link → show restore panel with both options
          showAuthPanel("restore");
          setAuthMessage(
            "restoreMessage",
            "",
            false
          );
        }
        return;
      }

      showGate("auth");
      showAuthPanel("login");
      setAuthMessage("loginMessage", "Enter your password to unlock.", false);

      if (await tryAutoUnlock()) {
        toastAuth("Welcome back — vault unlocked.");
        return;
      }

      if (readSession() && !readRememberedPassword()) {
        setAuthMessage("loginMessage", "Session ended. Enter your password (same one as before).", false);
      }
    },

    async completeSetup(password, confirmPassword) {
      if (password.length < 10) throw new Error("Use at least 10 characters for your password.");
      if (password !== confirmPassword) throw new Error("Passwords do not match.");

      const legacy = migrateLegacyPlaintext();
      const inner = vaultInnerPayload(
        legacy || window.LifeLedgerApp?.defaultData?.() || {},
        null
      );
      const salt = randomBytes(16);
      const key = await deriveAesKey(password, salt);
      const vault = await buildVault(password, inner, salt, key);
      await saveVaultFile(vault);
      if (legacy) localStorage.removeItem("lifeLedgerData:v1");

      unlockApp(inner, password, salt, key);
    },

    async login(password) {
      if (!vaultMeta) throw new Error("No vault found. Create an account first.");
      let inner;
      let salt;
      let key;
      try {
        salt = base64ToBytes(vaultMeta.salt);
        key = await deriveAesKey(password, salt);
        inner = await decryptJson(key, vaultMeta.iv, vaultMeta.ciphertext, vaultMeta.compressed || false);
      } catch {
        throw new Error("Wrong password or corrupted vault.");
      }
      if (!inner?.data) throw new Error("Vault format is invalid.");
      unlockApp(inner, password, salt, key);
    },

    async saveAppData(data) {
      await persistAppData(data);
    },

    logout() {
      stopSyncPoller();
      clearSession();
      unlockedPayload = null;
      showGate("auth");
      showAuthPanel("login");
      setAuthMessage("loginMessage", "Signed out. Enter your password to unlock.", false);
    },

    async connectDriveAndSync() {
      if (!window.LifeLedgerDrive) throw new Error("Google Drive module not loaded.");
      await window.LifeLedgerDrive.connect();
      await syncWithDrive(false);
      return window.LifeLedgerDrive.isConnected();
    },

    driveStatus() {
      return window.LifeLedgerDrive?.status?.() || { connected: false };
    },
  };

  function bindAuthUi() {
    document.getElementById("createVaultButton")?.addEventListener("click", async () => {
      const password = document.getElementById("setupPassword")?.value || "";
      const confirm = document.getElementById("setupPasswordConfirm")?.value || "";
      try {
        await LifeLedgerAuth.completeSetup(password, confirm);
        toastAuth("Vault created and saved on this device.");
      } catch (error) {
        setAuthMessage("setupMessage", error.message, true);
      }
    });

    document.getElementById("loginButton")?.addEventListener("click", async () => {
      const password = document.getElementById("loginPassword")?.value || "";
      try {
        await LifeLedgerAuth.login(password);
      } catch (error) {
        setAuthMessage("loginMessage", error.message, true);
      }
    });

    document.querySelectorAll("#logoutButton, #settingsLogoutButton").forEach(btn => {
      btn.addEventListener("click", () => LifeLedgerAuth.logout());
    });

    document.querySelectorAll("#connectDriveButton, #settingsConnectDriveButton").forEach(btn => {
      btn.addEventListener("click", async () => {
        try {
          await LifeLedgerAuth.connectDriveAndSync();
          updateDriveBadge();
          toastAuth("Google Drive connected. Changes sync automatically.");
        } catch (error) {
          toastAuth(error.message);
        }
      });
    });

    document.getElementById("restoreDriveButton")?.addEventListener("click", () => {
      performRestore("loginMessage");
    });

    document.getElementById("setupRestoreDriveButton")?.addEventListener("click", () => {
      performRestore("setupMessage");
    });

    document.getElementById("restoreFromDriveButton")?.addEventListener("click", () => {
      performRestore("restoreMessage");
    });

    document.getElementById("goToSetupButton")?.addEventListener("click", () => {
      showAuthPanel("setup");
    });

    document.getElementById("goToRestoreButton")?.addEventListener("click", () => {
      showAuthPanel("restore");
    });

    document.querySelectorAll("#syncDriveButton, #settingsSyncDriveButton").forEach(btn => {
      btn.addEventListener("click", async () => {
        const btns = document.querySelectorAll("#syncDriveButton, #settingsSyncDriveButton");
        btns.forEach(b => {
          b.disabled = true;
          b.textContent = "Syncing…";
        });
        try {
          const msg = await syncWithDrive(false);
          updateDriveBadge();
          markLastSynced();
          toastAuth(msg);
        } catch (error) {
          console.warn(error);
          toastAuth(error.message);
        } finally {
          btns.forEach(b => {
            b.disabled = false;
            b.textContent = "⟳ Sync now";
          });
        }
      });
    });

    document.getElementById("topbarSyncStatus")?.addEventListener("click", () => {
      if (currentSyncState === "failed") {
        const syncBtn = document.getElementById("syncDriveButton");
        if (syncBtn && !syncBtn.disabled) {
          syncBtn.click();
        }
      }
    });

    document.querySelectorAll("#loginPassword, #setupPassword, #setupPasswordConfirm, #restorePassword").forEach((input) => {
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        const panel = document.querySelector("[data-auth-panel]:not([hidden])")?.dataset.authPanel;
        if (panel === "login") document.getElementById("loginButton")?.click();
        if (panel === "setup") document.getElementById("createVaultButton")?.click();
        if (panel === "restore") document.getElementById("restoreFromDriveButton")?.click();
      });
    });
  }

  function toastAuth(message) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastAuth.timeout);
    toastAuth.timeout = setTimeout(() => el.classList.remove("show"), 3200);
  }

  function updateDriveBadge() {
    const badges = document.querySelectorAll("#driveStatusBadge, #settingsDriveStatusBadge");
    const { connected } = LifeLedgerAuth.driveStatus();
    badges.forEach(badge => {
      badge.textContent = connected ? "Drive linked ✓" : "Drive offline";
      badge.classList.toggle("good", connected);
    });
  }

  function markLastSynced() {
    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const dateStr = now.toLocaleDateString([], { month: "short", day: "numeric" });
      const label = document.getElementById("lastSyncedLabel");
      const timeEl = document.getElementById("lastSyncedTime");
      if (label) label.style.display = "";
      if (timeEl) timeEl.textContent = `${dateStr}, ${timeStr}`;
      // Persist so page reload shows correct time
      localStorage.setItem("lifeLedgerLastSync", now.toISOString());
    } catch (e) {}
  }

  function restoreLastSyncedLabel() {
    try {
      const raw = localStorage.getItem("lifeLedgerLastSync");
      if (!raw) return;
      const d = new Date(raw);
      const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const dateStr = d.toLocaleDateString([], { month: "short", day: "numeric" });
      const label = document.getElementById("lastSyncedLabel");
      const timeEl = document.getElementById("lastSyncedTime");
      if (label) label.style.display = "";
      if (timeEl) timeEl.textContent = `${dateStr}, ${timeStr}`;
    } catch (e) {}
  }

  window.LifeLedgerAuth = LifeLedgerAuth;

  document.addEventListener("DOMContentLoaded", async () => {
    bindAuthUi();
    restoreLastSyncedLabel();
    await LifeLedgerAuth.init();
    updateDriveBadge();
  });
})();
