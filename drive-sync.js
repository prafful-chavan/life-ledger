/**
 * Google Drive sync — stores encrypted vault only (never plaintext finance data).
 * Requires config.js with GOOGLE_CLIENT_ID from Google Cloud Console.
 *
 * Key improvements:
 *  - Token is always stored/cleared from localStorage (never sessionStorage)
 *  - tryRestoreVault() will search Drive even without a cached fileId
 *  - findVaultFile() cleans up duplicate vault files on Drive (keeps newest)
 *  - 401 errors properly clear the localStorage token cache
 *  - Exported pollForChanges() lets auth.js run a background poller
 */
(function () {
  const VAULT_FILENAME = "life-ledger-vault.enc.json";
  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly";
  const FILE_ID_KEY = "lifeLedgerDriveFileId:v1";
  const TOKEN_CACHE_KEY = "lifeLedgerDriveToken:v1";
  const REMOTE_MTIME_KEY = "lifeLedgerRemoteMTime:v1";
  const ETAG_CACHE_KEY = "lifeLedgerVaultETag:v1";

  // Two-minute grace before considering a token expired (avoids mid-request expiry)
  const TOKEN_GRACE_MS = 2 * 60 * 1000;

  let accessToken = null;
  let tokenClient = null;
  let fileId = localStorage.getItem(FILE_ID_KEY) || null;
  let cachedETag = null;
  try { cachedETag = localStorage.getItem(ETAG_CACHE_KEY) || null; } catch(e) {}

  // ─── Token helpers ────────────────────────────────────────────────────────

  function getStoredToken() {
    try {
      const raw = localStorage.getItem(TOKEN_CACHE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.accessToken && data.expiresAt && Date.now() < data.expiresAt - TOKEN_GRACE_MS) {
        return data.accessToken;
      }
    } catch (e) {}
    return null;
  }

  function storeToken(token, expiresIn) {
    try {
      accessToken = token;
      const expiresAt = Date.now() + (expiresIn || 3600) * 1000;
      localStorage.setItem(TOKEN_CACHE_KEY, JSON.stringify({ accessToken, expiresAt }));
    } catch (e) {}
  }

  function clearToken() {
    accessToken = null;
    try {
      localStorage.removeItem(TOKEN_CACHE_KEY);
    } catch (e) {}
  }

  // ─── Client ID ────────────────────────────────────────────────────────────

  function getClientId() {
    return window.LIFE_LEDGER_CONFIG?.GOOGLE_CLIENT_ID || "";
  }

  function isConfigured() {
    const id = getClientId();
    return Boolean(id && !id.includes("YOUR_CLIENT_ID"));
  }

  // ─── Google API loader ────────────────────────────────────────────────────

  function waitForGoogle() {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts?.oauth2) { resolve(); return; }
      let attempts = 0;
      const timer = setInterval(() => {
        attempts += 1;
        if (window.google?.accounts?.oauth2) {
          clearInterval(timer);
          resolve();
        } else if (attempts > 100) {
          clearInterval(timer);
          reject(new Error("Google sign-in failed to load. Check your internet connection."));
        }
      }, 100);
    });
  }

  async function ensureTokenClient() {
    if (!isConfigured()) throw new Error("Add your Google Client ID in config.js.");
    await waitForGoogle();
    if (!tokenClient) {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: getClientId(),
        scope: DRIVE_SCOPE,
        callback: () => {},
      });
    }
  }

  // ─── Token acquisition ────────────────────────────────────────────────────

  /**
   * Request an OAuth2 access token.
   * `silent=true` means we will NOT show a popup — only use the cached token.
   */
  function requestAccessToken(options = {}) {
    return new Promise((resolve, reject) => {
      if (options.silent) {
        reject(new Error("Drive sync offline. Tap ′Sync′ to reconnect Google Drive."));
        return;
      }
      ensureTokenClient()
        .then(() => {
          tokenClient.callback = (response) => {
            if (response.error) {
              reject(new Error(response.error_description || response.error));
              return;
            }
            storeToken(response.access_token, response.expires_in);
            resolve(response.access_token);
          };
          // No prompt so we don't show the account chooser if already signed in
          tokenClient.requestAccessToken({ prompt: "" });
        })
        .catch(reject);
    });
  }

  // ─── Fetch wrapper ────────────────────────────────────────────────────────

  async function driveFetch(url, options = {}) {
    // Restore cached token if needed
    if (!accessToken) {
      accessToken = getStoredToken();
    }
    if (!accessToken) {
      await requestAccessToken(options);
    }

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    };

    // Add ETag for conditional GET (skip if uploading)
    if (options._useETag && cachedETag && !options.method) {
      headers["If-None-Match"] = cachedETag;
    }

    const response = await fetch(url, {
      cache: "no-store",
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Token expired — clear cache and retry (once) with a fresh token
      clearToken();
      if (options.silent) {
        throw new Error("Drive token expired. Tap Sync to reconnect.");
      }
      await requestAccessToken(options);
      // Retry the original request with the new token
      return driveFetch(url, { ...options, _retried: true });
    }

    // Cache ETag from successful responses
    if (response.ok && response.headers.has("etag")) {
      cachedETag = response.headers.get("etag");
      try { localStorage.setItem(ETAG_CACHE_KEY, cachedETag); } catch(e) {}
    }

    return response;
  }

  // ─── File discovery ───────────────────────────────────────────────────────

  /**
   * Find the vault file on Drive. If multiple copies exist (e.g., re-uploads), 
   * keep the newest one and trash any others to avoid confusion.
   */
  async function findVaultFile(options = {}) {
    const query = encodeURIComponent(
      `name='${VAULT_FILENAME}' and trashed=false and mimeType='application/json'`
    );
    const response = await driveFetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name,modifiedTime)&pageSize=10`,
      options
    );
    if (!response.ok) throw new Error("Could not search Google Drive.");
    const data = await response.json();
    const files = data.files || [];
    if (!files.length) return null;

    // Sort newest first
    files.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));

    const primary = files[0].id;

    // Quietly trash any duplicate files in the background
    if (files.length > 1) {
      const duplicates = files.slice(1);
      duplicates.forEach(async (f) => {
        try {
          await driveFetch(
            `https://www.googleapis.com/drive/v3/files/${f.id}`,
            { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }), silent: true }
          );
          console.log(`[drive-sync] Trashed duplicate vault file: ${f.id}`);
        } catch (e) {
          console.warn("[drive-sync] Could not trash duplicate:", e);
        }
      });
    }

    return primary;
  }

  // ─── Load / Save ──────────────────────────────────────────────────────────

  async function loadVault(options = {}) {
    if (!isConfigured()) return null;
    try {
      // Restore cached token first (so we don't show popups)
      if (!accessToken) accessToken = getStoredToken();

      // Resolve file ID — check cache then search Drive
      let id = fileId;
      if (!id) {
        id = await findVaultFile(options);
      }
      if (!id) return null;

      fileId = id;
      localStorage.setItem(FILE_ID_KEY, id);

      const response = await driveFetch(
        `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
        options
      );
      if (!response.ok) {
        if (response.status === 404) {
          // File was deleted from Drive — reset our cached ID so we search again next time
          fileId = null;
          localStorage.removeItem(FILE_ID_KEY);
        }
        return null;
      }
      return response.json();
    } catch (error) {
      console.warn("[drive-sync] Load vault:", error.message);
      return null;
    }
  }

  async function saveVault(vault, options = {}) {
    if (!isConfigured()) return false;
    const body = JSON.stringify(vault);

    // Resolve file ID
    if (!fileId) {
      fileId = await findVaultFile(options);
    }

    if (fileId) {
      // Update existing file
      const response = await driveFetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body,
          ...options,
        }
      );
      if (response.status === 404) {
        // File deleted remotely — create a new one
        fileId = null;
        localStorage.removeItem(FILE_ID_KEY);
        return saveVault(vault, options);
      }
      if (!response.ok) throw new Error(`Failed to update vault on Google Drive (HTTP ${response.status}).`);
    } else {
      // Create new file (multipart upload)
      const metadata = {
        name: VAULT_FILENAME,
        mimeType: "application/json",
        description: "Encrypted Life Ledger vault — do not edit manually",
      };
      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      form.append("file", new Blob([body], { type: "application/json" }));

      if (!accessToken) {
        accessToken = getStoredToken();
        if (!accessToken) await requestAccessToken(options);
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
        clearToken();
        await requestAccessToken(options);
        return saveVault(vault, options);
      }
      if (!response.ok) throw new Error(`Failed to create vault on Google Drive (HTTP ${response.status}).`);
      const created = await response.json();
      fileId = created.id;
      localStorage.setItem(FILE_ID_KEY, fileId);
    }
    return true;
  }

  // ─── Try restore (used during boot) ──────────────────────────────────────

  /**
   * Attempt to silently load the vault from Drive.
   * This will succeed if:
   *   (a) we have a cached access token that's still valid, OR
   *   (b) we have a cached fileId and the token can be refreshed silently by the browser
   *
   * It will NOT show a popup. Returns null on failure.
   */
  async function tryRestoreVault() {
    if (!isConfigured()) return null;
    // We need either a cached token or a cached file ID to proceed silently
    const hasToken = Boolean(getStoredToken());
    const hasFileId = Boolean(localStorage.getItem(FILE_ID_KEY));
    if (!hasToken && !hasFileId) {
      console.log("[drive-sync] tryRestoreVault: no cached token and no file ID, skipping silent restore.");
      return null;
    }
    try {
      // Try silently — if no token, driveFetch will throw (silent=true)
      return await loadVault({ silent: !hasToken });
    } catch (error) {
      console.warn("[drive-sync] Silent restore failed:", error.message);
      return null;
    }
  }

  // ─── Get remote vault metadata (timestamp only, no download) ─────────────

  /**
   * Lightweight metadata-only fetch — returns { id, modifiedTime, size }
   * Costs ~200 bytes vs downloading the full vault.
   * Returns null if offline or no file exists.
   */
  async function getRemoteVaultMeta(options = {}) {
    if (!isConfigured()) return null;
    if (!accessToken) accessToken = getStoredToken();
    if (!accessToken) return null; // can't check without a token

    try {
      let id = fileId;
      if (!id) {
        id = await findVaultFile({ silent: true });
        if (id) {
          fileId = id;
          localStorage.setItem(FILE_ID_KEY, id);
        }
      }
      if (!id) return null;

      const response = await driveFetch(
        `https://www.googleapis.com/drive/v3/files/${id}?fields=id,modifiedTime,size`,
        { silent: true }
      );
      if (!response.ok) return null;
      const meta = await response.json();

      // Cache the remote modifiedTime so we can skip full downloads
      if (meta.modifiedTime) {
        try { localStorage.setItem(REMOTE_MTIME_KEY, meta.modifiedTime); } catch(e) {}
      }

      return meta;
    } catch (e) {
      return null;
    }
  }

  /**
   * Check if the remote vault has changed since our last known modifiedTime.
   * Returns { changed: boolean, remoteMeta: object|null }
   * This is the cheapest possible sync check — metadata only.
   */
  async function hasRemoteChanged() {
    const meta = await getRemoteVaultMeta();
    if (!meta) return { changed: false, remoteMeta: null };

    let lastKnown = null;
    try { lastKnown = localStorage.getItem(REMOTE_MTIME_KEY); } catch(e) {}

    if (!lastKnown) {
      // First time — consider it changed
      return { changed: true, remoteMeta: meta };
    }

    const remoteMs = new Date(meta.modifiedTime).getTime();
    const lastKnownMs = new Date(lastKnown).getTime();

    return {
      changed: remoteMs > lastKnownMs,
      remoteMeta: meta
    };
  }

  /**
   * Update the cached remote modifiedTime after a successful upload.
   */
  function updateCachedRemoteTime(isoTime) {
    try { localStorage.setItem(REMOTE_MTIME_KEY, isoTime); } catch(e) {}
  }

  async function downloadRemoteFileByName(filename, options = {}) {
    if (!isConfigured()) return null;
    try {
      const query = encodeURIComponent(
        `name='${filename}' and trashed=false`
      );
      const response = await driveFetch(
        `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name,modifiedTime)&pageSize=1`,
        { ...options, silent: true }
      );
      if (!response.ok) return null;
      const data = await response.json();
      const files = data.files || [];
      if (!files.length) return null;

      const fileId = files[0].id;
      const fileRes = await driveFetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { ...options, silent: true }
      );
      if (!fileRes.ok) return null;
      const buffer = await fileRes.arrayBuffer();
      return {
        filename,
        buffer,
        modifiedTime: files[0].modifiedTime
      };
    } catch (e) {
      console.warn(`[drive-sync] downloadRemoteFileByName(${filename}):`, e.message);
      return null;
    }
  }

  async function downloadLatestExpenseFile(owner, options = {}) {
    if (!isConfigured()) return null;
    try {
      // Search for any files containing 'Transactions' in the name
      const query = encodeURIComponent("name contains 'Transactions' and trashed=false");
      const response = await driveFetch(
        `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name,modifiedTime)&orderBy=modifiedTime%20desc&pageSize=10`,
        { ...options, silent: true }
      );
      if (!response.ok) return null;
      const data = await response.json();
      const files = data.files || [];
      if (!files.length) return null;

      // Filter in JS by extension and owner name pattern
      const isWife = owner === "Wife";
      const matches = files.filter(f => {
        const name = f.name.toLowerCase();
        const hasExt = name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls");
        if (!hasExt) return false;
        
        // Must start with 'transactions'
        if (!name.startsWith("transactions")) return false;

        if (isWife) {
          return name.includes("_wife");
        } else {
          return !name.includes("_wife");
        }
      });

      if (!matches.length) return null;

      // Sort by modifiedTime descending (newest first)
      matches.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));
      const latest = matches[0];

      console.log(`[drive-sync] Found latest expense file for ${owner}: "${latest.name}" (ID: ${latest.id}, Modified: ${latest.modifiedTime})`);

      const fileRes = await driveFetch(
        `https://www.googleapis.com/drive/v3/files/${latest.id}?alt=media`,
        { ...options, silent: true }
      );
      if (!fileRes.ok) return null;
      const buffer = await fileRes.arrayBuffer();
      return {
        filename: latest.name,
        buffer,
        modifiedTime: latest.modifiedTime
      };
    } catch (e) {
      console.warn(`[drive-sync] downloadLatestExpenseFile(${owner}) failed:`, e.message);
      return null;
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  window.LifeLedgerDrive = {
    async connect() {
      await requestAccessToken({ silent: false });
      return Boolean(accessToken);
    },

    tryRestoreVault,
    getRemoteVaultMeta,
    hasRemoteChanged,
    updateCachedRemoteTime,

    hasLinkedDrive() {
      return Boolean(localStorage.getItem(FILE_ID_KEY));
    },

    hasCachedToken() {
      return Boolean(getStoredToken());
    },

    isConnected() {
      return Boolean(accessToken || getStoredToken() || localStorage.getItem(FILE_ID_KEY));
    },

    status() {
      return {
        configured: isConfigured(),
        connected: Boolean(accessToken || getStoredToken() || fileId),
        fileId,
        tokenExpiry: (() => {
          try {
            const raw = localStorage.getItem(TOKEN_CACHE_KEY);
            if (!raw) return null;
            return JSON.parse(raw).expiresAt || null;
          } catch { return null; }
        })(),
      };
    },

    loadVault,
    saveVault,
    downloadRemoteFileByName,
    downloadLatestExpenseFile,
  };
})();
