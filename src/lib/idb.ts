import type { Pin } from '../types';

const DB_NAME = 'lebanon-adventure';
const DB_VERSION = 1;
const STORE = 'pins';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const req = run(transaction.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export const pinStore = {
  all: () => tx<Pin[]>('readonly', (s) => s.getAll() as IDBRequest<Pin[]>),
  put: (pin: Pin) => tx('readwrite', (s) => s.put(pin) as IDBRequest<IDBValidKey>),
  remove: (id: string) => tx('readwrite', (s) => s.delete(id) as unknown as IDBRequest<undefined>),
};
