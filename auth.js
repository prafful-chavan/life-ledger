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
    const bin = String.fromCharCode(...new Uint8Array(bytes));
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
    await window.LifeLedgerVaultStore.save(vault);
    vaultMeta = vault;

    if (window.LifeLedgerDrive?.hasLinkedDrive?.()) {
      try {
        await window.LifeLedgerDrive.saveVault(vault);
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
    unlockedPayload.data = data;
    const password = unlockedPayload._sessionPassword;
    if (!password || !vaultMeta) throw new Error("Session expired — sign in again");
    const vault = await buildVault(
      password,
      vaultInnerPayload(unlockedPayload.data, unlockedPayload.totpSecret)
    );
    await saveVaultFile(vault);
  }

  function unlockApp(inner, password) {
    unlockedPayload = { ...inner, _sessionPassword: password };
    saveRememberedPassword(password);
    showGate("app");
    window.LifeLedgerApp?.bootstrap(inner.data);
  }

  async function tryAutoUnlock() {
    if (!vaultMeta) return false;
    const remembered = readRememberedPassword();
    if (!remembered) return false;
    try {
      const inner = await openVault(remembered, vaultMeta);
      if (!inner?.data) return false;
      unlockApp(inner, remembered);
      return true;
    } catch {
      localStorage.removeItem(REMEMBER_KEY);
      return false;
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
        showAuthPanel("setup");
        if (legacy) {
          setAuthMessage(
            "setupHint",
            "Existing data on this device will be encrypted and moved into your vault on setup.",
            false
          );
        } else {
          setAuthMessage(
            "setupHint",
            "No vault on this device. If you used Google Drive before, click Restore on the sign-in screen after creating once, or restore from Drive.",
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

      unlockApp(inner, password);
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
      unlockApp(inner, password);
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
      if (vaultMeta) await window.LifeLedgerDrive.saveVault(vaultMeta);
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

    document.getElementById("restoreDriveButton")?.addEventListener("click", async () => {
      try {
        setAuthMessage("loginMessage", "Connecting to Google Drive…", false);
        const remote = await loadVaultFromDrive();
        if (remote) {
          await window.LifeLedgerVaultStore.save(remote);
          vaultMeta = remote;
          showAuthPanel("login");
          setAuthMessage("loginMessage", "Vault restored from Drive. Enter your password.", false);
          if (await tryAutoUnlock()) toastAuth("Vault restored and unlocked.");
        } else {
          setAuthMessage("loginMessage", "No vault file found on Drive yet.", true);
        }
      } catch (error) {
        setAuthMessage("loginMessage", error.message, true);
      }
    });

    document.getElementById("syncDriveButton")?.addEventListener("click", async () => {
      try {
        if (LifeLedgerAuth.isUnlocked() && unlockedPayload) {
          await persistAppData(unlockedPayload.data);
        } else {
          vaultMeta = await loadVaultFile();
        }
        updateDriveBadge();
        toastAuth("Synced with Google Drive.");
      } catch (error) {
        toastAuth(error.message);
      }
    });

    document.querySelectorAll("#loginPassword, #setupPassword, #setupPasswordConfirm").forEach((input) => {
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        const panel = document.querySelector("[data-auth-panel]:not([hidden])")?.dataset.authPanel;
        if (panel === "login") document.getElementById("loginButton")?.click();
        if (panel === "setup") document.getElementById("createVaultButton")?.click();
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
