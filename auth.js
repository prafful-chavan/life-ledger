/**
 * Life Ledger — client-side auth, TOTP (Authy / Authenticator), and encrypted vault.
 * Data at rest is AES-256-GCM; only ciphertext is stored on Google Drive or in localStorage.
 */
(function () {
  const VAULT_LOCAL_KEY = "lifeLedgerVault:v1";
  const SESSION_KEY = "lifeLedgerSession:v1";
  const SESSION_HOURS = 12;
  const PBKDF2_ITERATIONS = 250000;
  const TOTP_PERIOD = 30;
  const TOTP_DIGITS = 6;
  const TOTP_WINDOW = 1;
  const ISSUER = "Life Ledger";

  let vaultMeta = null;
  let unlockedPayload = null;
  let setupTotpSecret = null;

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

  function generateTotpSecret() {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const bytes = randomBytes(20);
    let secret = "";
    for (let i = 0; i < 20; i++) secret += alphabet[bytes[i] % 32];
    return secret;
  }

  function base32Decode(secret) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const cleaned = secret.replace(/\s/g, "").toUpperCase().replace(/=+$/, "");
    let bits = "";
    for (const char of cleaned) {
      const val = alphabet.indexOf(char);
      if (val < 0) continue;
      bits += val.toString(2).padStart(5, "0");
    }
    const bytes = new Uint8Array(Math.floor(bits.length / 8));
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(bits.slice(i * 8, (i + 1) * 8), 2);
    }
    return bytes;
  }

  async function hmacSha1(keyBytes, messageBytes) {
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    return new Uint8Array(await crypto.subtle.sign("HMAC", key, messageBytes));
  }

  async function totpAt(secret, counter) {
    const key = base32Decode(secret);
    const msg = new Uint8Array(8);
    let temp = counter;
    for (let i = 7; i >= 0; i--) {
      msg[i] = temp & 0xff;
      temp = Math.floor(temp / 256);
    }
    const hmac = await hmacSha1(key, msg);
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    return String(code % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
  }

  async function verifyTotp(secret, code) {
    if (!secret || !/^\d{6}$/.test(String(code || "").trim())) return false;
    const now = Math.floor(Date.now() / 1000 / TOTP_PERIOD);
    const entered = String(code).trim();
    for (let w = -TOTP_WINDOW; w <= TOTP_WINDOW; w++) {
      if ((await totpAt(secret, now + w)) === entered) return true;
    }
    return false;
  }

  function totpUri(secret, accountLabel) {
    const label = encodeURIComponent(`${ISSUER}:${accountLabel || "vault"}`);
    const params = new URLSearchParams({
      secret,
      issuer: ISSUER,
      algorithm: "SHA1",
      digits: String(TOTP_DIGITS),
      period: String(TOTP_PERIOD),
    });
    return `otpauth://totp/${label}?${params.toString()}`;
  }

  function readSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session?.expiresAt || Date.now() > session.expiresAt) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  function writeSession() {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ expiresAt: Date.now() + SESSION_HOURS * 60 * 60 * 1000, ok: true })
    );
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    unlockedPayload = null;
  }

  async function loadVaultFile() {
    if (window.LifeLedgerDrive?.isConnected()) {
      const remote = await window.LifeLedgerDrive.loadVault();
      if (remote) {
        localStorage.setItem(VAULT_LOCAL_KEY, JSON.stringify(remote));
        return remote;
      }
    }
    try {
      const local = localStorage.getItem(VAULT_LOCAL_KEY);
      return local ? JSON.parse(local) : null;
    } catch {
      return null;
    }
  }

  async function saveVaultFile(vault) {
    localStorage.setItem(VAULT_LOCAL_KEY, JSON.stringify(vault));
    vaultMeta = vault;
    if (window.LifeLedgerDrive?.isConnected()) {
      await window.LifeLedgerDrive.saveVault(vault);
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

  function renderTotpQr(secret) {
    const uri = totpUri(secret, "Life Ledger");
    const qrImg = document.getElementById("totpQr");
    const secretEl = document.getElementById("totpSecretDisplay");
    if (qrImg) {
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(uri)}`;
      qrImg.alt = "QR code for Authy or Authenticator";
    }
    if (secretEl) secretEl.textContent = secret;
  }

  async function persistAppData(data) {
    if (!unlockedPayload) throw new Error("Not unlocked");
    unlockedPayload.data = data;
    const password = unlockedPayload._sessionPassword;
    if (!password || !vaultMeta) throw new Error("Session expired — sign in again");
    const vault = await buildVault(password, {
      totpSecret: unlockedPayload.totpSecret,
      data: unlockedPayload.data,
    });
    await saveVaultFile(vault);
  }

  async function tryResumeSession() {
    if (!readSession() || !vaultMeta) return false;
    return false;
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

    getTotpUri() {
      return setupTotpSecret ? totpUri(setupTotpSecret, "Life Ledger") : "";
    },

    async init() {
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
        }
        return;
      }

      showGate("auth");
      showAuthPanel("login");
      await tryResumeSession();
    },

    async completeSetup(password, confirmPassword, totpCode) {
      if (password.length < 10) throw new Error("Use at least 10 characters for your password.");
      if (password !== confirmPassword) throw new Error("Passwords do not match.");
      if (!setupTotpSecret) throw new Error("2FA is not ready. Refresh and try again.");
      if (!(await verifyTotp(setupTotpSecret, totpCode))) {
        throw new Error("Invalid 2FA code. Check Authy and try again.");
      }

      const legacy = migrateLegacyPlaintext();
      const inner = {
        totpSecret: setupTotpSecret,
        data: legacy || window.LifeLedgerApp?.defaultData?.() || {},
      };
      const vault = await buildVault(password, inner);
      await saveVaultFile(vault);
      if (legacy) localStorage.removeItem("lifeLedgerData:v1");

      unlockedPayload = { ...inner, _sessionPassword: password };
      writeSession();
      setupTotpSecret = null;
      showGate("app");
      window.LifeLedgerApp?.bootstrap(inner.data);
    },

    beginSetup() {
      setupTotpSecret = generateTotpSecret();
      renderTotpQr(setupTotpSecret);
      showAuthPanel("setup-totp");
    },

    async login(password, totpCode) {
      if (!vaultMeta) throw new Error("No vault found. Create an account first.");
      let inner;
      try {
        inner = await openVault(password, vaultMeta);
      } catch {
        throw new Error("Wrong password or corrupted vault.");
      }
      if (!(await verifyTotp(inner.totpSecret, totpCode))) {
        throw new Error("Invalid 2FA code.");
      }
      unlockedPayload = { ...inner, _sessionPassword: password };
      writeSession();
      showGate("app");
      window.LifeLedgerApp?.bootstrap(inner.data);
    },

    async saveAppData(data) {
      await persistAppData(data);
    },

    logout() {
      clearSession();
      unlockedPayload = null;
      showGate("auth");
      showAuthPanel("login");
      window.location.reload();
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
    document.getElementById("beginSetupButton")?.addEventListener("click", () => {
      setAuthMessage("setupMessage", "");
      const password = document.getElementById("setupPassword")?.value || "";
      const confirm = document.getElementById("setupPasswordConfirm")?.value || "";
      if (password.length < 10) {
        setAuthMessage("setupMessage", "Use at least 10 characters.", true);
        return;
      }
      if (password !== confirm) {
        setAuthMessage("setupMessage", "Passwords do not match.", true);
        return;
      }
      LifeLedgerAuth._setupPassword = password;
      LifeLedgerAuth.beginSetup();
    });

    document.getElementById("finishSetupButton")?.addEventListener("click", async () => {
      const code = document.getElementById("setupTotpCode")?.value || "";
      try {
        await LifeLedgerAuth.completeSetup(LifeLedgerAuth._setupPassword, LifeLedgerAuth._setupPassword, code);
        toastAuth("Vault created. Connect Google Drive in the sidebar when ready.");
      } catch (error) {
        setAuthMessage("setupTotpMessage", error.message, true);
      }
    });

    document.getElementById("loginButton")?.addEventListener("click", async () => {
      const password = document.getElementById("loginPassword")?.value || "";
      const code = document.getElementById("loginTotpCode")?.value || "";
      try {
        await LifeLedgerAuth.login(password, code);
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
        await window.LifeLedgerDrive.connect();
        vaultMeta = await loadVaultFile();
        if (vaultMeta) {
          showAuthPanel("login");
          setAuthMessage("loginMessage", "Vault loaded from Drive. Enter password and 2FA.", false);
        } else {
          setAuthMessage("loginMessage", "No vault file found on Drive. Create a vault first.", true);
        }
      } catch (error) {
        setAuthMessage("loginMessage", error.message, true);
      }
    });

    document.getElementById("syncDriveButton")?.addEventListener("click", async () => {
      try {
        vaultMeta = await loadVaultFile();
        if (LifeLedgerAuth.isUnlocked() && unlockedPayload) {
          await persistAppData(unlockedPayload.data);
        }
        updateDriveBadge();
        toastAuth("Synced with Google Drive.");
      } catch (error) {
        toastAuth(error.message);
      }
    });

    document
      .querySelectorAll(
        "#loginPassword, #loginTotpCode, #setupPassword, #setupPasswordConfirm, #setupTotpCode"
      )
      .forEach((input) => {
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            const panel = document.querySelector("[data-auth-panel]:not([hidden])")?.dataset.authPanel;
            if (panel === "login") document.getElementById("loginButton")?.click();
            if (panel === "setup") document.getElementById("beginSetupButton")?.click();
            if (panel === "setup-totp") document.getElementById("finishSetupButton")?.click();
          }
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
