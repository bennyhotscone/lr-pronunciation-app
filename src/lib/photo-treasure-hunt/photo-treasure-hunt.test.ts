import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  COMPRESS_JPEG_QUALITY,
  COMPRESS_RETRY_BYTES,
  COMPRESS_RETRY_QUALITY,
  compressPhoto,
  scaledSize,
  type DecodedImage,
} from "@/lib/photo-treasure-hunt/compress";
import {
  MISSIONS,
  buildShareText,
  countCompleted,
  emptyDrafts,
  missionComplete,
} from "@/lib/photo-treasure-hunt/missions";
import { buildPhotoReportPdf, photoReportFilename } from "@/lib/photo-treasure-hunt/pdf";
import {
  PHOTO_HUNT_DB_NAME,
  PHOTO_HUNT_DB_VERSION,
  openPhotoHuntDb,
  persistEntry,
  persistStudent,
  restoreProgress,
} from "@/lib/photo-treasure-hunt/storage";

const TINY_JPEG = Uint8Array.from(
  Buffer.from(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
    "base64",
  ),
);

function installFakeIndexedDB() {
  const databases = new Map<string, Map<string, Map<string, unknown>>>();

  function openDatabase(name: string) {
    let stores = databases.get(name);
    if (!stores) {
      stores = new Map();
      databases.set(name, stores);
    }
    const names = new Set(stores.keys());
    return {
      objectStoreNames: {
        contains: (storeName: string) => names.has(storeName),
      },
      createObjectStore(storeName: string) {
        names.add(storeName);
        if (!stores!.has(storeName)) stores!.set(storeName, new Map());
      },
      transaction(storeName: string) {
        const bucket = stores!.get(storeName);
        if (!bucket) throw new Error(`Missing store ${storeName}`);
        const tx = {
          error: null as Error | null,
          oncomplete: null as (() => void) | null,
          onerror: null as (() => void) | null,
          onabort: null as (() => void) | null,
          objectStore() {
            return {
              get(key: string) {
                const request = {
                  result: undefined as unknown,
                  error: null as Error | null,
                  onsuccess: null as (() => void) | null,
                  onerror: null as (() => void) | null,
                };
                const value = bucket.get(key);
                queueMicrotask(() => {
                  request.result = value;
                  request.onsuccess?.();
                });
                return request;
              },
              put(value: unknown, key: string) {
                bucket.set(String(key), value);
              },
              delete(key: string) {
                bucket.delete(String(key));
              },
            };
          },
        };
        queueMicrotask(() => {
          tx.oncomplete?.();
        });
        return tx;
      },
    };
  }

  const indexedDB = {
    open(name: string, version: number) {
      expect(name).toBe(PHOTO_HUNT_DB_NAME);
      expect(version).toBe(PHOTO_HUNT_DB_VERSION);
      const request = {
        result: undefined as ReturnType<typeof openDatabase> | undefined,
        error: null as Error | null,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onupgradeneeded: null as (() => void) | null,
      };
      queueMicrotask(() => {
        request.result = openDatabase(name);
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };

  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: indexedDB,
  });
}

describe("photo treasure hunt missions", () => {
  it("keeps all 15 Melbourne challenges", () => {
    expect(MISSIONS.map((mission) => mission.title)).toEqual([
      "Something iridescent",
      "Something translucent",
      "A naturally occurring pattern",
      "An object older than 100 years",
      "An ornate architectural detail",
      "An unusual item in a shop window",
      "Something beautifully handcrafted",
      "A colourful mural",
      "Art that expresses an emotion",
      "An interesting contrast",
      "A word you have never seen before",
      "An example of persuasive advertising",
      "An object with an interesting history",
      "Technology that has changed over time",
      "Something that represents Melbourne",
    ]);
    expect(MISSIONS[0]?.prompt).toBe(
      "Find an object whose colours change when light hits it.",
    );
    expect(MISSIONS[0]?.where).toBe("Opal shop");
    expect(MISSIONS[7]?.where).toBe("Hosier Lane");
    expect(MISSIONS[13]?.where).toBe("ACMI");
    expect(new Set(MISSIONS.map((mission) => mission.symbol)).size).toBe(15);
  });

  it("counts a mission complete only with a photo, a word, and a sentence", () => {
    const drafts = emptyDrafts();
    drafts[0] = { word: "  ", sentence: "A sentence.", hasPhoto: true };
    expect(missionComplete(drafts[0])).toBe(false);
    drafts[0] = { word: "iridescent", sentence: "  ", hasPhoto: true };
    expect(missionComplete(drafts[0])).toBe(false);
    drafts[0] = { word: "iridescent", sentence: "It shines.", hasPhoto: false };
    expect(missionComplete(drafts[0])).toBe(false);
    drafts[0] = { word: "iridescent", sentence: "It shines.", hasPhoto: true };
    expect(countCompleted(drafts)).toBe(1);
  });

  it("builds share text from notes only", () => {
    const drafts = emptyDrafts();
    drafts[0] = { word: "iridescent", sentence: "The opal is iridescent.", hasPhoto: true };
    expect(buildShareText(" Rita ", drafts)).toBe(
      "Rita's Melbourne Photo Hunt\n\n1. Something iridescent\nWords: iridescent\nSentence: The opal is iridescent.",
    );
  });
});

describe("photo treasure hunt IndexedDB", () => {
  it("saves and restores notes, photos, and the student name", async () => {
    installFakeIndexedDB();
    const db = await openPhotoHuntDb();
    await persistStudent(db, "Rita");
    await persistEntry(db, 0, {
      word: "iridescent",
      sentence: "The opal is iridescent.",
      hasPhoto: true,
    });
    const photo = new Blob(["photo-bytes"], { type: "image/jpeg" });
    await db.put("photos", "photo0", photo);

    const restored = await restoreProgress(db, MISSIONS.length);
    expect(restored.student).toBe("Rita");
    expect(restored.drafts[0]).toEqual({
      word: "iridescent",
      sentence: "The opal is iridescent.",
      hasPhoto: true,
    });
    expect(restored.photos[0]).toBe(photo);
    expect(restored.drafts[1]?.hasPhoto).toBe(false);
  });

  it("moves a legacy data-url photo into the photo store", async () => {
    installFakeIndexedDB();
    const db = await openPhotoHuntDb();
    await db.put("entries", "task3", {
      word: "historic",
      sentence: "This clock is old.",
      hasPhoto: true,
      photo: "data:image/jpeg;base64,abc",
    });
    const legacy = new Blob(["legacy"], { type: "image/jpeg" });
    const restored = await restoreProgress(db, MISSIONS.length, async (dataUrl) => {
      expect(dataUrl).toBe("data:image/jpeg;base64,abc");
      return legacy;
    });
    expect(restored.photos[3]).toBe(legacy);
    expect(restored.drafts[3]?.hasPhoto).toBe(true);
    const saved = await db.get("entries", "task3");
    expect(saved).toEqual({
      word: "historic",
      sentence: "This clock is old.",
      hasPhoto: true,
    });
  });

  it("defaults the name to Rita when nothing is stored", async () => {
    installFakeIndexedDB();
    const db = await openPhotoHuntDb();
    const restored = await restoreProgress(db, MISSIONS.length);
    expect(restored.student).toBe("Rita");
    expect(restored.photos.every((photo) => photo === null)).toBe(true);
  });
});

describe("photo compression", () => {
  it("fits the longest edge and compresses again when the file is still large", async () => {
    expect(scaledSize(4000, 3000, 1000)).toEqual({ width: 1000, height: 750 });
    expect(scaledSize(800, 600, 1000)).toEqual({ width: 800, height: 600 });
    expect(() => scaledSize(0, 10, 1000)).toThrow(/Invalid image/);

    const calls: Array<{ width: number; height: number; quality: number }> = [];
    const big = new Blob([new Uint8Array(COMPRESS_RETRY_BYTES + 1)]);
    const small = new Blob([new Uint8Array(20_000)]);
    const decoded = (width: number, height: number): DecodedImage => ({
      width,
      height,
      source: {} as CanvasImageSource,
    });

    const result = await compressPhoto(new Blob(["original"]), {
      decode: async () => decoded(4000, 3000),
      drawToJpeg: async (_image, width, height, quality) => {
        calls.push({ width, height, quality });
        return calls.length === 1 ? big : small;
      },
    });

    expect(result).toBe(small);
    expect(calls).toEqual([
      { width: 1000, height: 750, quality: COMPRESS_JPEG_QUALITY },
      { width: 750, height: 563, quality: COMPRESS_RETRY_QUALITY },
    ]);
  });

  it("skips the second pass when the first jpeg is small enough", async () => {
    let draws = 0;
    const small = new Blob([new Uint8Array(1000)]);
    const result = await compressPhoto(new Blob(["original"]), {
      decode: async () => ({ width: 640, height: 480, source: {} as CanvasImageSource }),
      drawToJpeg: async () => {
        draws += 1;
        return small;
      },
    });
    expect(result).toBe(small);
    expect(draws).toBe(1);
  });
});

describe("photo report PDF", () => {
  it("builds a PDF with a photo, vocabulary, and a sentence", async () => {
    const bytes = await buildPhotoReportPdf({
      studentName: "Rita",
      completed: 1,
      total: 15,
      generatedAt: new Date("2026-10-13T00:00:00Z"),
      sections: [
        {
          index: 1,
          title: "Something iridescent",
          word: "iridescent",
          sentence: "The opal looks iridescent in the light.",
          photo: TINY_JPEG,
          photoType: "jpeg",
        },
      ],
    });
    expect(Buffer.from(bytes.subarray(0, 5)).toString("ascii")).toBe("%PDF-");
    expect(Buffer.from(bytes).includes(Buffer.from(TINY_JPEG))).toBe(true);
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBeGreaterThan(0);
    expect(photoReportFilename("Rita", new Date("2026-10-13T00:00:00Z"))).toBe(
      "Rita-photo-treasure-hunt-2026-10-13.pdf",
    );
  });

  it("still makes a PDF when no missions are filled in", async () => {
    const bytes = await buildPhotoReportPdf({
      studentName: "",
      completed: 0,
      total: 15,
      sections: [],
    });
    expect(Buffer.from(bytes.subarray(0, 5)).toString("ascii")).toBe("%PDF-");
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBeGreaterThan(0);
  });
});
