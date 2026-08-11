import { auth } from "@/auth";
import { isStaff } from "@/lib/portal-access";
import {
  blobMissingErrorMessage,
  portalStorageMode,
  uploadPortalFile,
} from "@/lib/portal-files";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Session basket upload — staff only.
 * Stores under portal-files/session-basket/{userId}/…
 * Does not create a Resource row until attached to a lesson/post.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mode = portalStorageMode();
  if (mode === "unavailable") {
    return NextResponse.json(
      { error: blobMissingErrorMessage(), storageMode: mode },
      { status: 503 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }

  try {
    const uploaded = await uploadPortalFile({
      file,
      scope: `session-basket/${session.user.id}`,
      skipMimeCheck: true,
    });
    return NextResponse.json({
      ok: true,
      storageMode: mode,
      item: {
        id: `${Date.now()}-${uploaded.filename}`,
        filename: uploaded.filename,
        blobPath: uploaded.blobPath,
        blobUrl: uploaded.blobUrl,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        addedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    const status = message.includes("Vercel Blob") ? 503 : 400;
    return NextResponse.json({ error: message, storageMode: mode }, { status });
  }
}
