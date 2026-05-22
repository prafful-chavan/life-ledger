/**
 * Google Drive sync — stores encrypted vault only (never plaintext finance data).
 * Requires config.js with GOOGLE_CLIENT_ID from Google Cloud Console.
 */
(function () {
  const VAULT_FILENAME = "life-ledger-vault.enc.json";
  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
  const FILE_ID_KEY = "lifeLedgerDriveFileId:v1";

  let accessToken = null;
  let tokenClient = null;
  let fileId = localStorage.getItem(FILE_ID_KEY) || null;

  const TOKEN_CACHE_KEY = "lifeLedgerDriveToken:v1";

  function getStoredToken() {
    try {
      const raw = sessionStorage.getItem(TOKEN_CACHE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.accessToken && data.expiresAt && Date.now() < data.expiresAt - 120000) {
        return data.accessToken;
      }
    } catch (e) {}
    return null;
  }

  function storeToken(token, expiresIn) {
    try {
      accessToken = token;
      const expiresAt = Date.now() + (expiresIn || 3600) * 1000;
      sessionStorage.setItem(TOKEN_CACHE_KEY, JSON.stringify({ accessToken, expiresAt }));
    } catch (e) {}
  }

  function getClientId() {
    return window.LIFE_LEDGER_CONFIG?.GOOGLE_CLIENT_ID || "";
  }

  function waitForGoogle() {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }
      let attempts = 0;
      const timer = setInterval(() => {
        attempts += 1;
        if (window.google?.accounts?.oauth2) {
          clearInterval(timer);
          resolve();
        } else if (attempts > 80) {
          clearInterval(timer);
          reject(new Error("Google sign-in failed to load. Check your connection."));
        }
      }, 100);
    });
  }

  async function ensureTokenClient() {
    const clientId = getClientId();
    if (!clientId || clientId.includes("YOUR_CLIENT_ID")) {
      throw new Error("Add your Google Client ID in config.js (see config.example.js).");
    }
    await waitForGoogle();
    if (!tokenClient) {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        callback: () => {},
      });
    }
  }

  function requestAccessToken(options = {}) {
    return new Promise((resolve, reject) => {
      ensureTokenClient()
        .then(() => {
          tokenClient.callback = (response) => {
            if (response.error) {
              reject(new Error(response.error_description || response.error));
              return;
            }
            const token = response.access_token;
            storeToken(token, response.expires_in);
            resolve(token);
          };
          const prompt = options.silent ? "" : "select_account";
          tokenClient.requestAccessToken({ prompt });
        })
        .catch(reject);
    });
  }

  async function driveFetch(url, options = {}) {
    if (!accessToken) {
      accessToken = getStoredToken();
      if (!accessToken) await requestAccessToken(options);
    }
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.headers || {}),
      },
    });
    if (response.status === 401) {
      accessToken = null;
      sessionStorage.removeItem(TOKEN_CACHE_KEY);
      await requestAccessToken(options);
      return driveFetch(url, options);
    }
    return response;
  }

  async function findVaultFile(options = {}) {
    const query = encodeURIComponent(
      `name='${VAULT_FILENAME}' and trashed=false and mimeType='application/json'`
    );
    const response = await driveFetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name,modifiedTime)&pageSize=5`,
      options
    );
    if (!response.ok) throw new Error("Could not search Google Drive.");
    const data = await response.json();
    const files = data.files || [];
    if (!files.length) return null;
    files.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));
    return files[0].id;
  }

  async function loadVault(options = {}) {
    if (!getClientId() || getClientId().includes("YOUR_CLIENT_ID")) return null;
    try {
      if (!accessToken) {
        accessToken = getStoredToken();
        if (!accessToken) {
          // If silent is requested, do not call requestAccessToken unless we are silent
          // Actually, findVaultFile or driveFetch will do it.
        }
      }
      const id = fileId || (await findVaultFile(options));
      if (!id) return null;
      fileId = id;
      localStorage.setItem(FILE_ID_KEY, id);
      const response = await driveFetch(
        `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
        options
      );
      if (!response.ok) return null;
      return response.json();
    } catch (error) {
      console.warn("Drive load:", error);
      return null;
    }
  }

  async function saveVault(vault, options = {}) {
    if (!getClientId() || getClientId().includes("YOUR_CLIENT_ID")) return false;
    const body = JSON.stringify(vault);

    if (!fileId) {
      fileId = await findVaultFile(options);
    }

    if (fileId) {
      const response = await driveFetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body,
          ...options,
        }
      );
      if (!response.ok) throw new Error("Failed to update vault on Google Drive.");
    } else {
      const metadata = {
        name: VAULT_FILENAME,
        mimeType: "application/json",
        description: "Encrypted Life Ledger vault — do not edit manually",
      };
      const form = new FormData();
      form.append(
        "metadata",
        new Blob([JSON.stringify(metadata)], { type: "application/json" })
      );
      form.append("file", new Blob([body], { type: "application/json" }));

      if (!accessToken) {
        accessToken = getStoredToken();
        if (!accessToken) {
          await requestAccessToken(options);
        }
      }
      const response = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: form,
        }
      );
      if (response.status === 401) {
        accessToken = null;
        sessionStorage.removeItem(TOKEN_CACHE_KEY);
        await requestAccessToken(options);
        return saveVault(vault, options);
      }
      if (!response.ok) throw new Error("Failed to create vault on Google Drive.");
      const created = await response.json();
      fileId = created.id;
      localStorage.setItem(FILE_ID_KEY, fileId);
    }
    return true;
  }

  async function tryRestoreVault() {
    if (!getClientId() || getClientId().includes("YOUR_CLIENT_ID")) return null;
    if (!localStorage.getItem(FILE_ID_KEY)) return null;
    try {
      return await loadVault();
    } catch (error) {
      console.warn("Drive restore:", error);
      return null;
    }
  }

  window.LifeLedgerDrive = {
    async connect() {
      await requestAccessToken({ silent: false });
      const remote = await loadVault({ silent: false });
      return Boolean(accessToken);
    },

    tryRestoreVault,

    hasLinkedDrive() {
      return Boolean(localStorage.getItem(FILE_ID_KEY));
    },

    hasCachedToken() {
      return Boolean(getStoredToken());
    },

    isConnected() {
      return Boolean(accessToken || localStorage.getItem(FILE_ID_KEY));
    },

    status() {
      const configured = Boolean(getClientId() && !getClientId().includes("YOUR_CLIENT_ID"));
      return {
        configured,
        connected: Boolean(accessToken || fileId),
        fileId,
      };
    },

    loadVault,
    saveVault,
  };
})();
