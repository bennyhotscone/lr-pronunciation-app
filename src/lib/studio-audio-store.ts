import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  OVERRIDES_BLOB_PATH,
  OVERRIDES_PUBLIC_REL,
  OVERRIDES_VERSION_PREFIX,
  audioOverrideTombstone,
  isActiveAudioOverride,
  mergeAudioOverrideMaps,
  rankKey,
  type AudioOverrideEntry,
  type AudioOverrideMap,
} from "@/lib/audio-overrides";

const BLOB_PREFIX = "studio-audio";

/** Same-isolate sticky map so GETs right after POST do not lose the write. */
let lastWritten: { map: AudioOverrideMap; at: number } | null = null;

function hasBlobToken(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function isVercelRuntime(): boolean {
  return process.env.VERCEL === "1";
}

export function storageMode(): "blob" | "local" | "unavailable" {
  if (hasBlobToken()) return "blob";
  if (!isVercelRuntime()) return "local";
  return "unavailable";
}

export function blobMissingErrorMessage(): string {
  return (
    "Permanent save requires Vercel Blob. In the Vercel dashboard: Storage → Create Database → Blob, " +
    "then add BLOB_READ_WRITE_TOKEN to this project's Environment Variables (Production) and redeploy. " +
    "Also set MANDARIN_STUDIO_PASSWORD if you have not already."
  );
}

async function streamToText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const res = new Response(stream);
  return res.text();
}

function looksLikeOverrideMap(data: unknown): data is AudioOverrideMap {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  // Reject pointer envelopes if we ever store them
  if ("latest" in data && "url" in data && Object.keys(data).length <= 3) {
    return false;
  }
  return true;
}

async function parseOverrideStream(
  stream: ReadableStream<Uint8Array>,
): Promise<AudioOverrideMap | null> {
  try {
    const raw = await streamToText(stream);
    const data = JSON.parse(raw) as unknown;
    return looksLikeOverrideMap(data) ? data : null;
  } catch {
    return null;
  }
}

async function readOverridesFromBlob(): Promise<AudioOverrideMap> {
  const { get, list } = await import("@vercel/blob");
  const maps: AudioOverrideMap[] = [];

  try {
    const listed = await list({ prefix: OVERRIDES_VERSION_PREFIX, limit: 1000 });
    const recent = [...listed.blobs]
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
      .slice(0, 15);
    for (const item of recent) {
      try {
        const result = await get(item.pathname, {
          access: "public",
          useCache: false,
        });
        if (result?.statusCode === 200 && result.stream) {
          const map = await parseOverrideStream(result.stream);
          if (map) maps.push(map);
        }
      } catch {
        /* skip broken snapshot */
      }
    }
  } catch {
    /* list unavailable — fall through to legacy */
  }

  try {
    const result = await get(OVERRIDES_BLOB_PATH, {
      access: "public",
      useCache: false,
    });
    if (result?.statusCode === 200 && result.stream) {
      const map = await parseOverrideStream(result.stream);
      if (map) maps.push(map);
    }
  } catch {
    /* legacy missing */
  }

  let merged = mergeAudioOverrideMaps(...maps);
  if (
    lastWritten &&
    Date.now() - lastWritten.at < 15_000
  ) {
    merged = mergeAudioOverrideMaps(merged, lastWritten.map);
  }
  return merged;
}

async function writeOverridesToBlob(map: AudioOverrideMap): Promise<string> {
  const { put } = await import("@vercel/blob");
  // Append-only snapshot (never overwritten → no stale CDN bytes for this URL)
  const versioned = `${OVERRIDES_VERSION_PREFIX}${Date.now()}.json`;
  const blob = await put(versioned, JSON.stringify(map, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    cacheControlMaxAge: 60 * 60 * 24 * 365,
  });
  // Legacy fixed path for older code + human inspection
  await put(OVERRIDES_BLOB_PATH, JSON.stringify(map, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
  lastWritten = { map, at: Date.now() };
  return blob.url;
}

function localOverridesPath(): string {
  return path.join(process.cwd(), "public", OVERRIDES_PUBLIC_REL);
}

async function readOverridesFromLocal(): Promise<AudioOverrideMap> {
  try {
    const raw = await readFile(localOverridesPath(), "utf8");
    const data = JSON.parse(raw) as AudioOverrideMap;
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

async function writeOverridesToLocal(map: AudioOverrideMap): Promise<void> {
  const file = localOverridesPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(map, null, 2), "utf8");
}

export async function loadOverrides(): Promise<AudioOverrideMap> {
  const mode = storageMode();
  if (mode === "blob") return readOverridesFromBlob();
  if (mode === "local") return readOverridesFromLocal();
  // Production without blob: still try public fallback file if committed
  return readOverridesFromLocal();
}

export async function saveAudioOverride(input: {
  rank: number;
  filename: string;
  bytes: Buffer;
  contentType: string;
}): Promise<{ entry: AudioOverrideEntry; overrides: AudioOverrideMap; mode: "blob" | "local" }> {
  const mode = storageMode();
  if (mode === "unavailable") {
    throw new Error(blobMissingErrorMessage());
  }

  const updatedAt = new Date().toISOString();
  const key = String(input.rank).padStart(4, "0");
  let url: string;

  if (mode === "blob") {
    const { put } = await import("@vercel/blob");
    // Unique pathname per save so CDN cannot serve a previous clip at the same URL.
    const pathname = `${BLOB_PREFIX}/${key}-${Date.now()}-${input.filename}`;
    const blob = await put(pathname, input.bytes, {
      access: "public",
      contentType: input.contentType || "application/octet-stream",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
    url = blob.url;
  } else {
    const dir = path.join(process.cwd(), "public", "audio", "mandarin-vocab");
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, input.filename);
    await writeFile(filePath, input.bytes);
    url = `/audio/mandarin-vocab/${input.filename}`;
  }

  const entry: AudioOverrideEntry = {
    url,
    filename: input.filename,
    updatedAt,
  };

  // Merge against whatever we can read, write, and verify so a stale CDN snapshot
  // cannot drop this rank (or wipe a sibling rank) from the returned map.
  let overrides: AudioOverrideMap = { [key]: entry };
  for (let attempt = 0; attempt < 3; attempt++) {
    const loaded = await loadOverrides();
    overrides = mergeAudioOverrideMaps(loaded, { [key]: entry });
    if (mode === "blob") {
      await writeOverridesToBlob(overrides);
    } else {
      await writeOverridesToLocal(overrides);
    }
    const verify = await loadOverrides();
    if (verify[key]?.url === entry.url) {
      overrides = mergeAudioOverrideMaps(verify, { [key]: entry });
      return { entry, overrides, mode };
    }
    await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
  }

  overrides = mergeAudioOverrideMaps(await loadOverrides(), { [key]: entry });
  return { entry, overrides, mode };
}

/**
 * Remove a rank’s permanent override. Writes a tombstone so stale CDN snapshots
 * cannot revive the cleared URL via merge.
 */
export async function deleteAudioOverride(
  rank: number,
): Promise<{ overrides: AudioOverrideMap; mode: "blob" | "local" }> {
  const mode = storageMode();
  if (mode === "unavailable") {
    throw new Error(blobMissingErrorMessage());
  }

  const key = rankKey(rank);
  const tombstone = audioOverrideTombstone();
  let overrides: AudioOverrideMap = { [key]: tombstone };

  for (let attempt = 0; attempt < 3; attempt++) {
    const loaded = await loadOverrides();
    overrides = mergeAudioOverrideMaps(loaded, { [key]: tombstone });
    if (mode === "blob") {
      await writeOverridesToBlob(overrides);
    } else {
      await writeOverridesToLocal(overrides);
    }
    const verify = await loadOverrides();
    if (!isActiveAudioOverride(verify[key])) {
      const merged = mergeAudioOverrideMaps(verify, { [key]: tombstone });
      return { overrides: merged, mode };
    }
    await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
  }

  const merged = mergeAudioOverrideMaps(await loadOverrides(), {
    [key]: tombstone,
  });
  return { overrides: merged, mode };
}
