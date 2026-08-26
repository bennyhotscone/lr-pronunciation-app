import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isStaff } from "@/lib/portal-access";
import { readPortalFileBytes } from "@/lib/portal-files";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const attachment = await prisma.lessonCaptureAttachment.findUnique({
    where: { id },
    include: { session: { select: { teacherId: true } } },
  });
  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (
    session.user.role !== "ADMIN" &&
    attachment.session.teacherId !== session.user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const file = await readPortalFileBytes({
    blobPath: attachment.blobPath,
    blobUrl: attachment.blobUrl,
  });
  if (!file) {
    return NextResponse.json({ error: "File missing in storage" }, { status: 404 });
  }

  const contentType =
    file.contentType || attachment.mimeType || "application/octet-stream";
  const safeName = attachment.filename.replace(/"/g, "");

  return new NextResponse(Buffer.from(file.bytes), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
