/**
 * Vault persistence via IndexedDB (large encrypted payloads exceed localStorage).
 */
(function () {
  const DB_NAME = "life-ledger-db";
  const DB_VERSION = 1;
  const STORE = "vault";
  const VAULT_KEY = "main";
  const LEGACY_LOCAL_KEY = "lifeLedgerVault:v1";

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB is not available in this browser."));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function idbGet(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbSet(key, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE).put(value, key);
    });
  }

  const BACKUP_LOCAL_KEY = "lifeLedgerVault:backup";

  function readLegacyLocalVault() {
    try {
      const raw = localStorage.getItem(LEGACY_LOCAL_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function isValidVault(vault) {
    return (
      vault &&
      typeof vault === "object" &&
      vault.v &&
      vault.salt &&
      vault.iv &&
      vault.ciphertext
    );
  }

  window.LifeLedgerVaultStore = {
    async load() {
      let vault = null;
      try {
        vault = await idbGet(VAULT_KEY);
      } catch (err) {
        console.warn("IndexedDB load failed:", err);
      }

      if (isValidVault(vault)) {
        return vault;
      } else if (vault) {
        console.warn("IndexedDB vault failed integrity check.");
      }

      // Fallback 1: LocalStorage backup
      try {
        const backupRaw = localStorage.getItem(BACKUP_LOCAL_KEY);
        if (backupRaw) {
          const backupVault = JSON.parse(backupRaw);
          if (isValidVault(backupVault)) {
            console.log("IndexedDB empty/evicted/corrupted. Restored vault from localStorage backup.");
            // Re-populate IndexedDB in background
            idbSet(VAULT_KEY, backupVault).catch(err => 
              console.warn("Failed to restore IndexedDB from backup:", err)
            );
            return backupVault;
          } else {
            console.warn("LocalStorage backup vault failed integrity check.");
          }
        }
      } catch (err) {
        console.warn("LocalStorage backup load failed:", err);
      }

      // Fallback 2: Legacy local vault
      const legacy = readLegacyLocalVault();
      if (isValidVault(legacy)) {
        await this.save(legacy);
        localStorage.removeItem(LEGACY_LOCAL_KEY);
        return legacy;
      }
      return null;
    },

    async save(vault) {
      let idbSuccess = false;

      // Primary write to IndexedDB
      try {
        await idbSet(VAULT_KEY, vault);
        idbSuccess = true;
      } catch (err) {
        console.warn("IndexedDB save failed:", err);
      }

      // Secondary write/backup to localStorage (as long as it fits)
      try {
        if (vault) {
          const json = JSON.stringify(vault);
          localStorage.setItem(BACKUP_LOCAL_KEY, json);
          // If IndexedDB failed, localStorage is our only copy — verify it saved
          if (!idbSuccess) {
            const verify = localStorage.getItem(BACKUP_LOCAL_KEY);
            if (!verify) {
              throw new Error("Both IndexedDB and localStorage save failed.");
            }
            console.warn("IndexedDB failed but localStorage backup succeeded.");
          }
        } else {
          localStorage.removeItem(BACKUP_LOCAL_KEY);
        }
      } catch (err) {
        console.warn("Failed to write vault backup to localStorage (likely quota exceeded):", err);
        if (!idbSuccess) {
          throw new Error("Could not save vault to any storage. Check your browser storage settings.");
        }
      }

      try {
        localStorage.removeItem(LEGACY_LOCAL_KEY);
      } catch {
        /* ignore */
      }
      return true;
    },

    async clear() {
      try {
        await idbSet(VAULT_KEY, null);
      } catch (err) {
        console.warn("IndexedDB clear failed:", err);
      }
      try {
        localStorage.removeItem(BACKUP_LOCAL_KEY);
        localStorage.removeItem(LEGACY_LOCAL_KEY);
      } catch {
        /* ignore */
      }
    },
  };
})();
