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

  async function encryptJson(key, payload) {
    const iv = randomBytes(12);
    const plaintext = enc().encode(JSON.stringify(payload));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
    return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(ciphertext) };
  }

  async function decryptJson(key, ivB64, ciphertextB64) {
    const iv = base64ToBytes(ivB64);
    const ciphertext = base64ToBytes(ciphertextB64);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return JSON.parse(dec().decode(plaintext));
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

      const addItem = (item) => {
        if (!item) return;
        if (item.id) {
          if (seenIds.has(item.id)) return;
          seenIds.add(item.id);
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

  function triggerDriveUpload(vault) {
    if (!window.LifeLedgerDrive?.hasLinkedDrive?.()) return;

    nextUploadVault = vault;

    if (activeUploadPromise) {
      return;
    }

    const runUpload = async () => {
      const currentVault = nextUploadVault;
      nextUploadVault = null;
      if (!currentVault) return;

      updateSyncStatusUI("syncing");

      activeUploadPromise = (async () => {
        try {
          console.log("[auth.js] Uploading vault backup to Google Drive in background...");
          await window.LifeLedgerDrive.saveVault(currentVault);
          console.log("[auth.js] Google Drive upload completed successfully.");
          updateDriveBadge();
          markLastSynced();
          updateSyncStatusUI("synced");
        } catch (error) {
          console.warn("Drive sync failed:", error);
          toastAuth("Google Drive sync failed. Will retry on next change.");
          updateSyncStatusUI("failed");
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
    console.log("[auth.js] Saving vault file locally, size:", JSON.stringify(vault).length, "chars");
    await window.LifeLedgerVaultStore.save(vault);
    vaultMeta = vault;

    triggerDriveUpload(vault);
  }

  async function buildVault(password, innerPayload, existingSalt = null, existingKey = null) {
    const salt = existingSalt || randomBytes(16);
    const key = existingKey || await deriveAesKey(password, salt);
    const { iv, ciphertext } = await encryptJson(key, innerPayload);
    return {
      v: 1,
      salt: bytesToBase64(salt),
      iv,
      ciphertext,
      updatedAt: new Date().toISOString(),
      entryCount: countEntries(innerPayload?.data),
    };
  }

  async function openVault(password, vault) {
    const salt = base64ToBytes(vault.salt);
    const key = await deriveAesKey(password, salt);
    return decryptJson(key, vault.iv, vault.ciphertext);
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

  // Background sync poller — runs every 60 seconds while the app is unlocked
  let syncPollerTimer = null;

  function startSyncPoller() {
    stopSyncPoller();
    if (!window.LifeLedgerDrive?.isConnected?.()) return;

    syncPollerTimer = setInterval(async () => {
      if (!unlockedPayload) { stopSyncPoller(); return; }
      try {
        const msg = await syncWithDrive(true); // silent — no popup
        if (msg && (msg.includes("Merged") || msg.includes("pulled"))) {
          updateDriveBadge();
          markLastSynced();
          toastAuth("\u2713 " + msg);
          console.log("[auth.js] Background sync:", msg);
        } else if (msg && msg.includes("up to date")) {
          markLastSynced(); // still update timestamp even if no changes
        }
      } catch (e) {
        // Silent failure — don't bother the user unless they explicitly sync
        console.warn("[auth.js] Background sync failed:", e.message);
      }
    }, 60 * 1000); // every 60 seconds
  }

  function stopSyncPoller() {
    if (syncPollerTimer) {
      clearInterval(syncPollerTimer);
      syncPollerTimer = null;
    }
  }

  function unlockApp(inner, password, salt = null, key = null) {
    unlockedPayload = { 
      ...inner, 
      _sessionPassword: password,
      _salt: salt,
      _sessionKey: key
    };
    saveRememberedPassword(password);
    showGate("app");
    window.LifeLedgerApp?.bootstrap(inner.data);

    updateSyncStatusUI(window.LifeLedgerDrive?.hasLinkedDrive?.() ? "synced" : "offline");

    if (window.LifeLedgerDrive?.isConnected?.()) {
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

      // Start polling for changes every 60 seconds
      setTimeout(startSyncPoller, 5000);
    }
  }

  async function tryAutoUnlock() {
    if (!vaultMeta) return false;
    const remembered = readRememberedPassword();
    if (!remembered) return false;
    try {
      const salt = base64ToBytes(vaultMeta.salt);
      const key = await deriveAesKey(remembered, salt);
      const inner = await decryptJson(key, vaultMeta.iv, vaultMeta.ciphertext);
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
        await window.LifeLedgerVaultStore.save(remote);
        vaultMeta = remote;
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
              // Safety: if local has significantly more data, don't overwrite — merge instead
              const mergedData = mergeVaultData(localData, remoteData);
              const mergedCount = countEntries(mergedData);
              // Rebuild vault with merged data
              const mergedInner = vaultInnerPayload(mergedData, inner.totpSecret || unlockedPayload.totpSecret);
              const mergedVault = await buildVault(password, mergedInner, unlockedPayload._salt, unlockedPayload._sessionKey);
              await saveVaultFile(mergedVault);
              unlockedPayload = { 
                ...mergedInner, 
                _sessionPassword: password, 
                _salt: unlockedPayload._salt, 
                _sessionKey: unlockedPayload._sessionKey 
              };
              window.LifeLedgerApp?.bootstrap(mergedData);
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
        inner = await decryptJson(key, vaultMeta.iv, vaultMeta.ciphertext);
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
