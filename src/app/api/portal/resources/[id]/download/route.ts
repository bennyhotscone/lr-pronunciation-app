import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { studentCanAccessResource } from "@/lib/portal-access";
import { readPortalFileBytes } from "@/lib/portal-files";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function teacherCanAccessResource(teacherId: string, resourceId: string) {
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: { class: { select: { teacherId: true } } },
  });
  if (!resource) return false;
  if (resource.uploadedById === teacherId) return true;
  if (resource.class?.teacherId === teacherId) return true;
  // Individual assignments: any teacher (same as teacher student pages)
  if (resource.studentId) return true;
  return false;
}

/**
 * Authenticated file download.
 * Authorization: class membership / individual assignment (students),
 * or uploader / class teacher (teachers).
 * Does not require the client to know the underlying Blob URL.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const resource = await prisma.resource.findUnique({ where: { id } });
  if (!resource) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const role = session.user.role;
  let allowed = false;
  if (role === "TEACHER") {
    allowed = await teacherCanAccessResource(session.user.id, id);
  } else if (role === "STUDENT") {
    allowed = await studentCanAccessResource(session.user.id, id);
  }

  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const file = await readPortalFileBytes({
    blobPath: resource.blobPath,
    blobUrl: resource.blobUrl,
  });
  if (!file) {
    return NextResponse.json({ error: "File missing in storage" }, { status: 404 });
  }

  const contentType =
    file.contentType || resource.mimeType || "application/octet-stream";
  const safeName = resource.filename.replace(/"/g, "");

  return new NextResponse(Buffer.from(file.bytes), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Portal-Blob-Path": resource.blobPath,
    },
  });
}
