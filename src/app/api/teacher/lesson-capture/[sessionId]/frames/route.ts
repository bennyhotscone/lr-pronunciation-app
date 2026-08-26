import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  captureFrameStorageError,
  captureFrameStorageReady,
  uploadCaptureFrame,
} from "@/lib/lesson-capture-storage";
import { isStaff } from "@/lib/portal-access";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!captureFrameStorageReady()) {
    return NextResponse.json({ error: captureFrameStorageError() }, { status: 503 });
  }

  const { sessionId } = await context.params;
  const capture = await prisma.lessonCaptureSession.findUnique({
    where: { id: sessionId },
    select: { teacherId: true, status: true },
  });
  if (!capture) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.user.role !== "ADMIN" && capture.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (capture.status !== "ACTIVE") {
    return NextResponse.json({ error: "Session not active" }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form" }, { status: 400 });
  }

  const frameIndex = Number(form.get("frameIndex"));
  if (!Number.isInteger(frameIndex) || frameIndex < 0) {
    return NextResponse.json({ error: "Invalid frameIndex" }, { status: 400 });
  }

  const fileField = form.get("file");
  if (
    fileField == null ||
    typeof fileField === "string" ||
    typeof (fileField as Blob).arrayBuffer !== "function"
  ) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }
  const blob = fileField as Blob;
  const mimeType = blob.type || "image/webp";
  const bytes = Buffer.from(await blob.arrayBuffer());
  if (!bytes.byteLength) {
    return NextResponse.json({ error: "Empty frame" }, { status: 400 });
  }

  try {
    const uploaded = await uploadCaptureFrame({
      sessionId,
      frameIndex,
      bytes,
      mimeType,
    });

    const row = await prisma.lessonCaptureFrame.upsert({
      where: { sessionId_frameIndex: { sessionId, frameIndex } },
      create: {
        sessionId,
        frameIndex,
        blobPath: uploaded.blobPath,
        blobUrl: uploaded.blobUrl,
        mimeType,
        sizeBytes: uploaded.sizeBytes,
      },
      update: {
        blobPath: uploaded.blobPath,
        blobUrl: uploaded.blobUrl,
        mimeType,
        sizeBytes: uploaded.sizeBytes,
        capturedAt: new Date(),
      },
    });

    const frameCount = await prisma.lessonCaptureFrame.count({ where: { sessionId } });
    await prisma.lessonCaptureSession.update({
      where: { id: sessionId },
      data: { framesCaptured: frameCount },
    });

    return NextResponse.json({
      ok: true,
      frameId: row.id,
      frameIndex: row.frameIndex,
      sizeBytes: uploaded.sizeBytes,
      frameCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const capture = await prisma.lessonCaptureSession.findUnique({
    where: { id: sessionId },
    select: { teacherId: true, framesCaptured: true },
  });
  if (!capture) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (session.user.role !== "ADMIN" && capture.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const frameCount = await prisma.lessonCaptureFrame.count({ where: { sessionId } });
  return NextResponse.json({
    ok: true,
    frameCount: Math.max(frameCount, capture.framesCaptured),
  });
}