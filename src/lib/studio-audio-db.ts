/**
 * Browser-only store for teacher audio replacements.
 * Vercel cannot write public/; blobs live here for same-browser replay,
 * and teachers download correctly named files to commit.
 */

const DB_NAME = "lr-mandarin-studio-audio-v1";
const STORE = "clips";
const DB_VERSION = 1;

export type StudioLocalClip = {
  rank: number;
  filename: string;
  mime: string;
  blob: Blob;
  savedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "rank" });
      }
    };
  });
}

export async function putStudioClip(
  rank: number,
  filename: string,
  blob: Blob,
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("IDB write failed"));
    };
    tx.objectStore(STORE).put({
      rank,
      filename,
      mime: blob.type || "application/octet-stream",
      blob,
      savedAt: new Date().toISOString(),
    } satisfies StudioLocalClip);
  });
}

export async function getStudioClip(
  rank: number,
): Promise<StudioLocalClip | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(rank);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as StudioLocalClip | undefined) ?? null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error ?? new Error("IDB read failed"));
    };
  });
}

export async function getAllStudioClipRanks(): Promise<number[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAllKeys();
    req.onsuccess = () => {
      db.close();
      resolve((req.result as IDBValidKey[]).map(Number).filter(Number.isFinite));
    };
    req.onerror = () => {
      db.close();
      reject(req.error ?? new Error("IDB keys failed"));
    };
  });
}

export async function deleteStudioClip(rank: number): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("IDB delete failed"));
    };
    tx.objectStore(STORE).delete(rank);
  });
}
