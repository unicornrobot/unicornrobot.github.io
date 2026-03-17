// idb.js — lightweight IndexedDB wrapper for saving reading snapshots
// Each record: { id (auto), timestamp, vizKey, vizLabel, averages[], imageDataUrl }

const ReadingsDB = (() => {
    const DB_NAME    = 'unicornReadings';
    const DB_VERSION = 1;
    const STORE      = 'readings';

    let _db = null;

    function open() {
        if (_db) return Promise.resolve(_db);
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('vizKey',    'vizKey',    { unique: false });
                }
            };
            req.onsuccess = e => { _db = e.target.result; resolve(_db); };
            req.onerror   = e => reject(e.target.error);
        });
    }

    function save(record) {
        // record: { vizKey, vizLabel, averages, imageDataUrl }
        return open().then(db => new Promise((resolve, reject) => {
            const tx  = db.transaction(STORE, 'readwrite');
            const req = tx.objectStore(STORE).add({
                ...record,
                timestamp: Date.now()
            });
            req.onsuccess = () => resolve(req.result); // returns new id
            req.onerror   = e => reject(e.target.error);
        }));
    }

    function getAll() {
        return open().then(db => new Promise((resolve, reject) => {
            const tx  = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror   = e => reject(e.target.error);
        }));
    }

    function getByViz(vizKey) {
        return open().then(db => new Promise((resolve, reject) => {
            const tx    = db.transaction(STORE, 'readonly');
            const index = tx.objectStore(STORE).index('vizKey');
            const req   = index.getAll(vizKey);
            req.onsuccess = () => resolve(req.result);
            req.onerror   = e => reject(e.target.error);
        }));
    }

    function count() {
        return open().then(db => new Promise((resolve, reject) => {
            const req = db.transaction(STORE, 'readonly').objectStore(STORE).count();
            req.onsuccess = () => resolve(req.result);
            req.onerror   = e => reject(e.target.error);
        }));
    }

    function clearAll() {
        return open().then(db => new Promise((resolve, reject) => {
            const req = db.transaction(STORE, 'readwrite').objectStore(STORE).clear();
            req.onsuccess = () => resolve();
            req.onerror   = e => reject(e.target.error);
        }));
    }

    // Export all records as a JSON blob download
    function exportJSON() {
        return getAll().then(records => {
            const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = `unicorn-readings-${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        });
    }

    return { save, getAll, getByViz, count, clearAll, exportJSON };
})();
