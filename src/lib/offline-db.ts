/**
 * IndexedDB-backed local store for interactive-block drafts (code-playground code, network-lab packet
 * forms). This is the "don't lose work" layer for the unstable-power/connectivity setting: a draft is
 * written here the instant it changes, so a power cut, a reload, or a dead battery cannot lose it, even
 * before it reaches the server. IndexedDB (not localStorage) because a code project can be large and we
 * want it to survive a reboot.
 *
 * Everything degrades gracefully: if IndexedDB is unavailable (private mode, old browser), the helpers
 * resolve to empty/no-op and the caller falls back to talking to the server directly.
 */

export type LocalDraft = {
  contentId: string;
  state: unknown;
  updatedAt: number;
  /** A monotonically increasing write version, used to avoid clearing `dirty` after a newer edit. */
  v: number;
  /** True until the server has confirmed this exact version. */
  dirty: boolean;
  /** A pending delete (the draft was cleared offline and the server has not been told yet). */
  deleted?: boolean;
};

const DB_NAME = "kat-offline";
const DB_VERSION = 1;
const STORE = "drafts";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function getDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      let req: IDBOpenDBRequest;
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION);
      } catch {
        resolve(null);
        return;
      }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "contentId" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
  }
  return dbPromise;
}

export async function readLocalDraft(contentId: string): Promise<LocalDraft | null> {
  const db = await getDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(contentId);
      req.onsuccess = () => resolve((req.result as LocalDraft) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function writeLocalDraft(draft: LocalDraft): Promise<void> {
  const db = await getDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const t = db.transaction(STORE, "readwrite");
      t.objectStore(STORE).put(draft);
      t.oncomplete = () => resolve();
      t.onerror = () => resolve();
      t.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function deleteLocalDraft(contentId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const t = db.transaction(STORE, "readwrite");
      t.objectStore(STORE).delete(contentId);
      t.oncomplete = () => resolve();
      t.onerror = () => resolve();
      t.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function allLocalDrafts(): Promise<LocalDraft[]> {
  const db = await getDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as LocalDraft[]) ?? []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}
