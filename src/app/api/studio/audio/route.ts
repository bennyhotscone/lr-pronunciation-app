import { NextResponse } from "next/server";
import {
  blobMissingErrorMessage,
  loadOverrides,
  saveAudioOverride,
  storageMode,
} from "@/lib/studio-audio-store";
import { checkStudioPassword, passwordFromRequest } from "@/lib/studio-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — same public override map as /api/studio/overrides. */
export async function GET() {
  try {
    const overrides = await loadOverrides();
    return NextResponse.json(
      { overrides },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load overrides";
    return NextResponse.json({ overrides: {}, error: message }, { status: 200 });
  }
}

/**
 * POST multipart: password (or header), rank, filename (optional), audio file.
 * Stores clip in Vercel Blob (or local public/ when developing) and updates override manifest.
 */
export async function POST(request: Request) {
  const mode = storageMode();
  if (mode === "unavailable") {
    return NextResponse.json(
      { ok: false, error: blobMissingErrorMessage() },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Expected multipart form data" },
      { status: 400 },
    );
  }

  const password = passwordFromRequest(request, form.get("password"));
  if (!checkStudioPassword(password)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const rankRaw = form.get("rank");
  const rank =
    typeof rankRaw === "string" || typeof rankRaw === "number"
      ? Number(rankRaw)
      : NaN;
  if (!Number.isInteger(rank) || rank < 1 || rank > 5000) {
    return NextResponse.json(
      { ok: false, error: "Invalid rank (expected integer 1–5000)" },
      { status: 400 },
    );
  }

  const audioField = form.get("audio") ?? form.get("file");
  if (
    audioField == null ||
    typeof audioField === "string" ||
    typeof (audioField as Blob).arrayBuffer !== "function"
  ) {
    return NextResponse.json(
      { ok: false, error: "Missing audio file field (audio)" },
      { status: 400 },
    );
  }
  const audioBlob = audioField as Blob;

  const wordField = form.get("word");
  const filenameField = form.get("filename");
  let filename =
    typeof filenameField === "string" && filenameField.trim()
      ? filenameField.trim()
      : "";
  if (!filename) {
    const named = audioBlob as Blob & { name?: string };
    if (typeof named.name === "string" && named.name.trim()) {
      filename = named.name.trim();
    }
  }

  if (!filename) {
    const word =
      typeof wordField === "string" && wordField.trim()
        ? wordField.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")
        : "clip";
    const ext =
      (audioBlob.type.includes("webm") && "webm") ||
      (audioBlob.type.includes("mp4") && "m4a") ||
      (audioBlob.type.includes("mpeg") && "mp3") ||
      "webm";
    filename = `${String(rank).padStart(4, "0")}-${word}.${ext}`;
  }

  // Sanitize filename — basename only, expected NNNN-slug.ext
  filename = pathBasename(filename).replace(/[^a-zA-Z0-9._-]/g, "");
  if (!/^\d{4}-.+\.[a-z0-9]+$/i.test(filename)) {
    return NextResponse.json(
      {
        ok: false,
        error: "filename must look like 0012-for.webm (NNNN-word.ext)",
      },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await audioBlob.arrayBuffer());
  if (buffer.byteLength === 0) {
    return NextResponse.json({ ok: false, error: "Empty audio file" }, { status: 400 });
  }
  if (buffer.byteLength > 12 * 1024 * 1024) {
    return NextResponse.json(
      { ok: false, error: "Audio too large (max 12MB)" },
      { status: 400 },
    );
  }

  try {
    const { entry, overrides } = await saveAudioOverride({
      rank,
      filename,
      bytes: buffer,
      contentType: audioBlob.type || "application/octet-stream",
    });
    return NextResponse.json({
      ok: true,
      mode,
      rank,
      entry,
      overrides,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    const status = message.includes("Vercel Blob") ? 503 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

function pathBasename(name: string): string {
  const parts = name.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || name;
}
