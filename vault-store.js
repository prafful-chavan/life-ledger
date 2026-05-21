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

  function readLegacyLocalVault() {
    try {
      const raw = localStorage.getItem(LEGACY_LOCAL_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  window.LifeLedgerVaultStore = {
    async load() {
      let vault = await idbGet(VAULT_KEY);
      if (vault) return vault;

      const legacy = readLegacyLocalVault();
      if (legacy) {
        await this.save(legacy);
        localStorage.removeItem(LEGACY_LOCAL_KEY);
        return legacy;
      }
      return null;
    },

    async save(vault) {
      await idbSet(VAULT_KEY, vault);
      try {
        localStorage.removeItem(LEGACY_LOCAL_KEY);
      } catch {
        /* ignore */
      }
      return true;
    },

    async clear() {
      await idbSet(VAULT_KEY, null);
      localStorage.removeItem(LEGACY_LOCAL_KEY);
    },
  };
})();
