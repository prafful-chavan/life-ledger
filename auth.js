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
      // Merge by id, keeping the version from whichever side has it
      const byId = new Map();
      localArr.forEach(item => { if (item.id) byId.set(item.id, item); });
      remoteArr.forEach(item => { if (item.id && !byId.has(item.id)) byId.set(item.id, item); });
      // Also keep items without ids (shouldn't happen but safety)
      const noIdLocal = localArr.filter(item => !item.id);
      const noIdRemote = remoteArr.filter(item => !item.id);
      merged[key] = [...byId.values(), ...noIdLocal, ...noIdRemote];
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

  async function loadVaultFile() {
    if (window.LifeLedgerVaultStore) {
      const local = await window.LifeLedgerVaultStore.load();
      if (local) return local;
    }

    const remote = await loadVaultFromDrive();
    if (remote && window.LifeLedgerVaultStore) {
      await window.LifeLedgerVaultStore.save(remote);
      return remote;
    }
    return remote;
  }

  async function saveVaultFile(vault) {
    if (!window.LifeLedgerVaultStore) {
      throw new Error("Vault storage is not available.");
    }
    console.log("[auth.js] Saving vault file, size:", JSON.stringify(vault).length, "chars");
    await window.LifeLedgerVaultStore.save(vault);
    vaultMeta = vault;

    if (window.LifeLedgerDrive?.hasLinkedDrive?.()) {
      try {
        console.log("[auth.js] Uploading vault backup to Google Drive...");
        await window.LifeLedgerDrive.saveVault(vault);
        console.log("[auth.js] Google Drive upload completed successfully.");
      } catch (error) {
        console.warn("Drive sync failed:", error);
        toastAuth("Saved on this device. Google Drive sync failed — use Sync now later.");
      }
    }
  }

  async function buildVault(password, innerPayload) {
    const salt = randomBytes(16);
    const key = await deriveAesKey(password, salt);
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
    if (!password || !vaultMeta) throw new Error("Session expired — sign in again");
    const vault = await buildVault(
      password,
      vaultInnerPayload(unlockedPayload.data, unlockedPayload.totpSecret)
    );
    await saveVaultFile(vault);
    console.log("[auth.js] App data persistence completed successfully.");
  }

  function unlockApp(inner, password, isAutoUnlock = false) {
    unlockedPayload = { ...inner, _sessionPassword: password };
    saveRememberedPassword(password);
    showGate("app");
    window.LifeLedgerApp?.bootstrap(inner.data);

    if (window.LifeLedgerDrive?.hasLinkedDrive?.()) {
      const runSync = async () => {
        try {
          const msg = await syncWithDrive(isAutoUnlock);
          updateDriveBadge();
          if (msg.includes("pulled") || msg.includes("restored")) {
            toastAuth(msg);
          }
        } catch (error) {
          console.warn("Auto-sync failed:", error);
        }
      };

      if (isAutoUnlock) {
        setTimeout(runSync, 50);
      } else {
        runSync();
      }
    }
  }

  async function tryAutoUnlock() {
    if (!vaultMeta) return false;
    const remembered = readRememberedPassword();
    if (!remembered) return false;
    try {
      const inner = await openVault(remembered, vaultMeta);
      if (!inner?.data) return false;
      unlockApp(inner, remembered, true);
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
    if (!window.LifeLedgerDrive?.isConnected()) {
      if (silent) return "Not synced: Google Drive not connected.";
      await window.LifeLedgerDrive.connect();
    }

    const remoteVault = await window.LifeLedgerDrive.loadVault({ silent });
    if (!remoteVault) {
      if (vaultMeta) {
        await window.LifeLedgerDrive.saveVault(vaultMeta, { silent });
        return "Synced: Local vault pushed to Google Drive.";
      }
      throw new Error("No vault found to sync.");
    }

    if (!vaultMeta) {
      await window.LifeLedgerVaultStore.save(remoteVault);
      vaultMeta = remoteVault;
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
            const mergedVault = await buildVault(password, mergedInner);
            await saveVaultFile(mergedVault);
            unlockedPayload = { ...mergedInner, _sessionPassword: password };
            window.LifeLedgerApp?.bootstrap(mergedData);
            console.log(`[auth.js] Sync merged: local=${localCount}, remote=${remoteCount}, merged=${mergedCount}`);
            return `Synced: Merged local (${localCount} entries) + Drive (${remoteCount} entries) → ${mergedCount} total.`;
          } else {
            throw new Error("Invalid remote vault structure.");
          }
        } catch (e) {
          if (e.message?.includes("Invalid remote vault")) throw e;
          throw new Error("Google Drive has newer changes, but they couldn't be decrypted with your current password. Please sign out and log back in.");
        }
      } else {
        // Safety check: if local has more entries, don't replace while locked!
        if (vaultMeta && (vaultMeta.entryCount || 0) > (remoteVault.entryCount || 0)) {
          console.warn(`[auth.js] Remote vault has newer timestamp but fewer entries (${remoteVault.entryCount || 0} vs local ${vaultMeta.entryCount || 0}). Postponing sync until unlocked to perform a merge.`);
          return "Not synced: Remote has fewer entries. Unlock to merge.";
        }
        vaultMeta = remoteVault;
        await window.LifeLedgerVaultStore.save(remoteVault);
        return "Synced: Updated local vault from Google Drive. Unlock to view.";
      }
    } else if (localTime > remoteTime) {
      await window.LifeLedgerDrive.saveVault(vaultMeta, { silent });
      return "Synced: Local changes pushed to Google Drive.";
    } else {
      return "Synced: Already up to date.";
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
      const vault = await buildVault(password, inner);
      await saveVaultFile(vault);
      if (legacy) localStorage.removeItem("lifeLedgerData:v1");

      unlockApp(inner, password, false);
    },

    async login(password) {
      if (!vaultMeta) throw new Error("No vault found. Create an account first.");
      let inner;
      try {
        inner = await openVault(password, vaultMeta);
      } catch {
        throw new Error("Wrong password or corrupted vault.");
      }
      if (!inner?.data) throw new Error("Vault format is invalid.");
      unlockApp(inner, password, false);
    },

    async saveAppData(data) {
      await persistAppData(data);
    },

    logout() {
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

    document.getElementById("logoutButton")?.addEventListener("click", () => LifeLedgerAuth.logout());

    document.getElementById("connectDriveButton")?.addEventListener("click", async () => {
      try {
        await LifeLedgerAuth.connectDriveAndSync();
        updateDriveBadge();
        toastAuth("Google Drive connected. Changes sync automatically.");
      } catch (error) {
        toastAuth(error.message);
      }
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

    document.getElementById("syncDriveButton")?.addEventListener("click", async () => {
      const btn = document.getElementById("syncDriveButton");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Syncing…";
      }
      try {
        const msg = await syncWithDrive(false);
        updateDriveBadge();
        toastAuth(msg);
      } catch (error) {
        console.warn(error);
        toastAuth(error.message);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Sync now";
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
    const badge = document.getElementById("driveStatusBadge");
    if (!badge) return;
    const { connected } = LifeLedgerAuth.driveStatus();
    badge.textContent = connected ? "Drive linked" : "Drive offline";
    badge.classList.toggle("good", connected);
  }

  window.LifeLedgerAuth = LifeLedgerAuth;

  document.addEventListener("DOMContentLoaded", async () => {
    bindAuthUi();
    await LifeLedgerAuth.init();
    updateDriveBadge();
  });
})();
