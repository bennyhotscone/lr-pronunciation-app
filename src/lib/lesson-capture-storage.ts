import { randomBytes } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { portalStorageMode } from "@/lib/portal-files";

const BLOB_PREFIX = "lesson-capture/frames";
const MAX_FRAME_BYTES = 5 * 1024 * 1024;

export function captureFrameStorageReady(): boolean {
  return portalStorageMode() !== "unavailable";
}

export function captureFrameStorageError(): string {
  if (portalStorageMode() !== "unavailable") return "";
  return (
    "Lesson Capture frame uploads require Vercel Blob. In the Vercel dashboard: Storage → Blob, " +
    "ensure BLOB_READ_WRITE_TOKEN is set for Production, then redeploy. " +
    "Production never writes to the ephemeral filesystem."
  );
}

export async function uploadCaptureFrame(opts: {
  sessionId: string;
  frameIndex: number;
  bytes: Buffer;
  mimeType: string;
}): Promise<{ blobPath: string; blobUrl: string; sizeBytes: number }> {
  if (opts.bytes.byteLength > MAX_FRAME_BYTES) {
    throw new Error("Frame too large (max 5MB).");
  }
  if (opts.bytes.byteLength === 0) {
    throw new Error("Empty frame.");
  }
  const mode = portalStorageMode();
  if (mode === "unavailable") {
    throw new Error(captureFrameStorageError());
  }

  const ext =
    opts.mimeType.includes("png") ? "png" :
    opts.mimeType.includes("jpeg") || opts.mimeType.includes("jpg") ? "jpg" :
    "webp";
  const token = randomBytes(6).toString("hex");
  const blobPath = `${BLOB_PREFIX}/${opts.sessionId}/${opts.frameIndex}-${token}.${ext}`;

  if (mode === "blob") {
    const { put } = await import("@vercel/blob");
    const blob = await put(blobPath, opts.bytes, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
      contentType: opts.mimeType || "image/webp",
    });
    return { blobPath, blobUrl: blob.url, sizeBytes: opts.bytes.byteLength };
  }

  const localRel = path.join(
    "lesson-capture-frames",
    opts.sessionId,
    `${opts.frameIndex}-${token}.${ext}`,
  );
  const abs = path.join(process.cwd(), "public", localRel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, opts.bytes);
  return {
    blobPath,
    blobUrl: `/${localRel.replace(/\\/g, "/")}`,
    sizeBytes: opts.bytes.byteLength,
  };
}

export async function readCaptureFrameBytes(opts: {
  blobPath: string;
  blobUrl: string;
}): Promise<{ bytes: Buffer; contentType: string | null } | null> {
  if (opts.blobUrl.startsWith("http")) {
    if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
      try {
        const { get } = await import("@vercel/blob");
        const result = await get(opts.blobPath, {
          access: "public",
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        if (result?.statusCode === 200 && result.stream) {
          const ab = await new Response(result.stream).arrayBuffer();
          return {
            bytes: Buffer.from(ab),
            contentType: result.blob.contentType ?? null,
          };
        }
      } catch {
        /* fall through to HTTP */
      }
    }
    const res = await fetch(opts.blobUrl);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return {
      bytes: Buffer.from(ab),
      contentType: res.headers.get("content-type"),
    };
  }

  const rel = opts.blobUrl.replace(/^\//, "").replace(/\//g, path.sep);
  const abs = path.join(process.cwd(), "public", rel);
  try {
    const buf = await readFile(abs);
    return { bytes: buf, contentType: null };
  } catch {
    return null;
  }
}

export async function deleteCaptureFrameBlob(opts: {
  blobPath: string;
  blobUrl: string;
}): Promise<void> {
  if (!opts.blobPath.startsWith(`${BLOB_PREFIX}/`)) return;

  if (opts.blobUrl.startsWith("http")) {
    if (portalStorageMode() === "blob" && process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
      try {
        const { del } = await import("@vercel/blob");
        await del(opts.blobPath, { token: process.env.BLOB_READ_WRITE_TOKEN });
      } catch {
        /* ignore */
      }
    }
    return;
  }

  const rel = opts.blobUrl.replace(/^\//, "").replace(/\//g, path.sep);
  const abs = path.join(process.cwd(), "public", rel);
  try {
    await unlink(abs);
  } catch {
    /* ignore */
  }
}