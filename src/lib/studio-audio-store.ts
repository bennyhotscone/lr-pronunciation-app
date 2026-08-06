import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  OVERRIDES_BLOB_PATH,
  OVERRIDES_PUBLIC_REL,
  type AudioOverrideEntry,
  type AudioOverrideMap,
} from "@/lib/audio-overrides";

const BLOB_PREFIX = "studio-audio";

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

async function readOverridesFromBlob(): Promise<AudioOverrideMap> {
  const { head } = await import("@vercel/blob");
  try {
    const meta = await head(OVERRIDES_BLOB_PATH);
    const res = await fetch(meta.url, { cache: "no-store" });
    if (!res.ok) return {};
    const data = (await res.json()) as AudioOverrideMap;
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

async function writeOverridesToBlob(map: AudioOverrideMap): Promise<string> {
  const { put } = await import("@vercel/blob");
  const blob = await put(OVERRIDES_BLOB_PATH, JSON.stringify(map, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
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
  let url: string;

  if (mode === "blob") {
    const { put } = await import("@vercel/blob");
    const pathname = `${BLOB_PREFIX}/${input.filename}`;
    const blob = await put(pathname, input.bytes, {
      access: "public",
      contentType: input.contentType || "application/octet-stream",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    url = blob.url;
  } else {
    const dir = path.join(process.cwd(), "public", "audio", "mandarin-vocab");
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, input.filename);
    await writeFile(filePath, input.bytes);
    url = `/audio/mandarin-vocab/${input.filename}`;
  }

  const key = String(input.rank).padStart(4, "0");
  const entry: AudioOverrideEntry = {
    url,
    filename: input.filename,
    updatedAt,
  };
  const overrides = await loadOverrides();
  overrides[key] = entry;

  if (mode === "blob") {
    await writeOverridesToBlob(overrides);
  } else {
    await writeOverridesToLocal(overrides);
  }

  return { entry, overrides, mode };
}
