import { randomBytes } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
]);

const MAX_BYTES = 15 * 1024 * 1024;

function hasBlobToken(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function isVercelRuntime(): boolean {
  return process.env.VERCEL === "1";
}

/** Blob on prod; local disk only for `next dev` without a token. Never local on Vercel. */
export function portalStorageMode(): "blob" | "local" | "unavailable" {
  if (hasBlobToken()) return "blob";
  if (!isVercelRuntime()) return "local";
  return "unavailable";
}

export function blobMissingErrorMessage(): string {
  return (
    "Portal file uploads require Vercel Blob. In the Vercel dashboard: Storage → Blob, " +
    "ensure BLOB_READ_WRITE_TOKEN is set for Production, then redeploy. " +
    "Production never writes to the ephemeral filesystem."
  );
}

export function assertAllowedPortalFile(file: File) {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error(
      "Unsupported file type. Use PDF, JPG, PNG, WEBP, DOC, DOCX, or TXT.",
    );
  }
  if (file.size > MAX_BYTES) {
    throw new Error("File too large (max 15MB).");
  }
}

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

/** Authenticated download URL — never expose raw Blob URLs in portal UI. */
export function portalResourceDownloadHref(resourceId: string) {
  return `/api/portal/resources/${resourceId}/download`;
}

/**
 * Portal files only — prefix `portal-files/`.
 * Never write to `studio-audio/`.
 *
 * Same Blob store as Mandarin studio is OK; prefixes keep them separate.
 * Store access mode matches studio (`public`); downloads are still gated by
 * app auth via `/api/portal/resources/[id]/download`.
 */
export async function uploadPortalFile(opts: {
  file: File;
  scope: string; // classId or userId
}): Promise<{
  blobPath: string;
  blobUrl: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}> {
  assertAllowedPortalFile(opts.file);
  const mode = portalStorageMode();
  if (mode === "unavailable") {
    throw new Error(blobMissingErrorMessage());
  }

  const filename = safeFilename(opts.file.name || "file");
  const token = randomBytes(8).toString("hex");
  const blobPath = `portal-files/${opts.scope}/${Date.now()}-${token}-${filename}`;

  if (mode === "blob") {
    const { put } = await import("@vercel/blob");
    const blob = await put(blobPath, opts.file, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
    });
    return {
      blobPath,
      blobUrl: blob.url,
      filename,
      mimeType: opts.file.type,
      sizeBytes: opts.file.size,
    };
  }

  // Local next-dev fallback only (not Vercel)
  const localRel = path.join(
    "portal-uploads",
    opts.scope,
    `${Date.now()}-${token}-${filename}`,
  );
  const abs = path.join(process.cwd(), "public", localRel);
  await mkdir(path.dirname(abs), { recursive: true });
  const buf = Buffer.from(await opts.file.arrayBuffer());
  await writeFile(abs, buf);
  return {
    blobPath,
    blobUrl: `/${localRel.replace(/\\/g, "/")}`,
    filename,
    mimeType: opts.file.type,
    sizeBytes: opts.file.size,
  };
}

export async function readPortalFileBytes(opts: {
  blobPath: string;
  blobUrl: string;
}): Promise<{ bytes: Uint8Array; contentType: string | null } | null> {
  if (opts.blobUrl.startsWith("http")) {
    if (!hasBlobToken()) {
      // Fall back to public HTTP fetch for legacy public Blob URLs
      const res = await fetch(opts.blobUrl);
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      return {
        bytes: new Uint8Array(ab),
        contentType: res.headers.get("content-type"),
      };
    }
    const { get } = await import("@vercel/blob");
    const result = await get(opts.blobPath, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    if (!result || result.statusCode !== 200 || !result.stream) {
      // Pathname lookup failed — try stored URL (public CDN)
      const res = await fetch(opts.blobUrl);
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      return {
        bytes: new Uint8Array(ab),
        contentType: res.headers.get("content-type"),
      };
    }
    const ab = await new Response(result.stream).arrayBuffer();
    return {
      bytes: new Uint8Array(ab),
      contentType: result.blob.contentType ?? null,
    };
  }

  // Local public/ path from next-dev fallback
  const rel = opts.blobUrl.replace(/^\//, "").replace(/\//g, path.sep);
  const abs = path.join(process.cwd(), "public", rel);
  try {
    const buf = await readFile(abs);
    return { bytes: buf, contentType: null };
  } catch {
    return null;
  }
}
