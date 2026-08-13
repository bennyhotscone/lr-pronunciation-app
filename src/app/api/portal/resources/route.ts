import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assertTeacherOwnsClass, isStaff } from "@/lib/portal-access";
import { parseMaterialKind } from "@/lib/material-kind";
import {
  blobMissingErrorMessage,
  portalStorageMode,
  uploadPortalFile,
} from "@/lib/portal-files";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

/**
 * Teacher/Admin upload API (FormData).
 * Fields: file, title?, description?, classId?, studentId?, lessonId?, materialKind?
 * Production requires BLOB_READ_WRITE_TOKEN (no local sandbox).
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

  const description = String(formData.get("description") || "").trim();
  const classId = String(formData.get("classId") || "") || null;
  const studentId = String(formData.get("studentId") || "") || null;
  const lessonId = String(formData.get("lessonId") || "") || null;
  const materialKind = parseMaterialKind(formData.get("materialKind"));

  if (!classId && !studentId) {
    return NextResponse.json(
      { error: "Assign the file to a class or student." },
      { status: 400 },
    );
  }

  try {
    if (classId) await assertTeacherOwnsClass(session.user.id, classId, session.user.role);
  } catch {
    return NextResponse.json({ error: "Class not found or access denied" }, { status: 403 });
  }

  try {
    const { maybeTrimPdfUpload } = await import("@/lib/pdf-trim");
    const trimmed = await maybeTrimPdfUpload(file, formData.get("selectedPages"));
    const scope = classId || studentId!;
    const uploaded = await uploadPortalFile({ file: trimmed.file, scope });

    const resource = await prisma.resource.create({
      data: {
        title: String(formData.get("title") || "").trim() || uploaded.filename,
        description: description || null,
        filename: uploaded.filename,
        blobPath: uploaded.blobPath,
        blobUrl: uploaded.blobUrl,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        classId,
        studentId,
        lessonId,
        uploadedById: session.user.id,
        category: studentId && !classId ? "just-for-you" : "class",
        materialKind,
      },
    });

    if (classId) revalidatePath(`/teacher/classes/${classId}`);
    if (studentId) revalidatePath(`/teacher/students/${studentId}`);
    revalidatePath("/portal");
    revalidatePath("/portal/resources");

    return NextResponse.json({
      ok: true,
      storageMode: mode,
      resource: {
        id: resource.id,
        title: resource.title,
        filename: resource.filename,
        blobPath: resource.blobPath,
        blobUrl: resource.blobUrl,
        mimeType: resource.mimeType,
        downloadUrl: `/api/portal/resources/${resource.id}/download`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    const status = message.includes("Vercel Blob") ? 503 : 400;
    return NextResponse.json({ error: message, storageMode: mode }, { status });
  }
}
