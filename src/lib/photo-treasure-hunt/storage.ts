import { emptyDrafts, type MissionDraft } from "@/lib/photo-treasure-hunt/missions";

/** Same database name as the original hunt so this origin keeps existing photos. */
export const PHOTO_HUNT_DB_NAME = "RitaPhotoHuntDB";
export const PHOTO_HUNT_DB_VERSION = 2;
export const ENTRY_STORE = "entries";
export const PHOTO_STORE = "photos";

export type StoredEntry = {
  word: string;
  sentence: string;
  hasPhoto: boolean;
  /** Legacy builds stored a data URL on the entry. New saves keep the blob separate. */
  photo?: string;
};

export interface KvStore {
  get(store: string, key: string): Promise<unknown>;
  put(store: string, key: string, value: unknown): Promise<void>;
  delete(store: string, key: string): Promise<void>;
}

export type RestoredProgress = {
  student: string;
  drafts: MissionDraft[];
  photos: Array<Blob | null>;
};

function isStoredEntry(value: unknown): value is StoredEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<StoredEntry>;
  return typeof entry.word === "string" || typeof entry.sentence === "string";
}

export function entryKey(index: number): string {
  return `task${index}`;
}

export function photoKey(index: number): string {
  return `photo${index}`;
}

export async function persistEntry(
  db: KvStore,
  index: number,
  draft: MissionDraft,
): Promise<void> {
  const value: StoredEntry = {
    word: draft.word,
    sentence: draft.sentence,
    hasPhoto: draft.hasPhoto,
  };
  await db.put(ENTRY_STORE, entryKey(index), value);
}

export async function persistStudent(db: KvStore, name: string): Promise<void> {
  await db.put(ENTRY_STORE, "student", name);
}

export async function migrateLegacyPhoto(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error("Legacy photo migration failed");
  return response.blob();
}

export async function restoreProgress(
  db: KvStore,
  missionCount: number,
  migratePhoto: (dataUrl: string) => Promise<Blob> = migrateLegacyPhoto,
): Promise<RestoredProgress> {
  const drafts = emptyDrafts(missionCount);
  const photos: Array<Blob | null> = Array.from({ length: missionCount }, () => null);

  for (let index = 0; index < missionCount; index++) {
    const saved = await db.get(ENTRY_STORE, entryKey(index));
    if (isStoredEntry(saved)) {
      drafts[index] = {
        word: saved.word || "",
        sentence: saved.sentence || "",
        hasPhoto: false,
      };
      const existingPhoto = await db.get(PHOTO_STORE, photoKey(index));
      if (typeof saved.photo === "string" && saved.photo && !(existingPhoto instanceof Blob)) {
        try {
          const blob = await migratePhoto(saved.photo);
          await db.put(PHOTO_STORE, photoKey(index), blob);
          drafts[index] = { ...drafts[index], hasPhoto: true };
          await persistEntry(db, index, drafts[index]);
        } catch (error) {
          console.warn("Legacy photo migration failed", error);
        }
      }
    }

    const photo = await db.get(PHOTO_STORE, photoKey(index));
    if (photo instanceof Blob) {
      photos[index] = photo;
      drafts[index] = { ...drafts[index], hasPhoto: true };
    }
  }

  const storedName = await db.get(ENTRY_STORE, "student");
  const student = typeof storedName === "string" && storedName ? storedName : "Rita";
  return { student, drafts, photos };
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Save failed"));
    tx.onabort = () => reject(tx.error ?? new Error("Save aborted"));
  });
}

export function openPhotoHuntDb(): Promise<KvStore> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PHOTO_HUNT_DB_NAME, PHOTO_HUNT_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ENTRY_STORE)) db.createObjectStore(ENTRY_STORE);
      if (!db.objectStoreNames.contains(PHOTO_STORE)) db.createObjectStore(PHOTO_STORE);
    };
    request.onsuccess = () => {
      const db = request.result;
      resolve({
        async get(store, key) {
          const tx = db.transaction(store, "readonly");
          return requestToPromise(tx.objectStore(store).get(key));
        },
        async put(store, key, value) {
          const tx = db.transaction(store, "readwrite");
          tx.objectStore(store).put(value, key);
          await transactionDone(tx);
        },
        async delete(store, key) {
          const tx = db.transaction(store, "readwrite");
          tx.objectStore(store).delete(key);
          await transactionDone(tx);
        },
      });
    };
    request.onerror = () => reject(request.error ?? new Error("Could not open local storage"));
  });
}
