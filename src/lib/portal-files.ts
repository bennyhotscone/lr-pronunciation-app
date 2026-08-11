import { put } from "@vercel/blob";
import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
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

/**
 * Portal files only — prefix `portal-files/`.
 * Never write to `studio-audio/`.
 */
export async function uploadPortalFile(opts: {
  file: File;
  scope: string; // classId or userId
}): Promise<{ blobPath: string; blobUrl: string; filename: string; mimeType: string; sizeBytes: number }> {
  assertAllowedPortalFile(opts.file);
  const filename = safeFilename(opts.file.name || "file");
  const token = randomBytes(8).toString("hex");
  const blobPath = `portal-files/${opts.scope}/${Date.now()}-${token}-${filename}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
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

  // Local fallback for next dev without Blob token
  const localRel = path.join("portal-uploads", opts.scope, `${Date.now()}-${token}-${filename}`);
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
