import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { allowsPdfWriteMode } from "@/lib/material-kind";
import { studentCanAccessResource } from "@/lib/portal-access";
import { parsePdfWriteData } from "@/lib/pdf-write-data";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Submit current write draft as homework for the teacher. */
export async function POST(request: Request, context: Ctx) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: resourceId } = await context.params;
  const allowed = await studentCanAccessResource(session.user.id, resourceId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
  if (!resource) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowsPdfWriteMode(resource.materialKind)) {
    return NextResponse.json(
      {
        error:
          "Write mode is only for Exercises/Activities. Explanations/Notes are read-only.",
      },
      { status: 403 },
    );
  }

  let noteTitle: string | null = null;
  try {
    const body = await request.json();
    if (body && typeof body.title === "string") noteTitle = body.title.trim() || null;
  } catch {
    // empty body ok
  }

  const draft = await prisma.pdfWriteDraft.findUnique({
    where: {
      studentId_resourceId: {
        studentId: session.user.id,
        resourceId,
      },
    },
  });
  const data = parsePdfWriteData(draft?.data);
  const hasContent =
    Object.values(data.fields).some((v) => v.trim()) ||
    data.overlays.some((o) => o.text.trim());
  if (!hasContent) {
    return NextResponse.json(
      { error: "Add at least one text box with content before submitting." },
      { status: 400 },
    );
  }

  const submission = await prisma.pdfSubmission.create({
    data: {
      studentId: session.user.id,
      resourceId,
      classId: resource.classId,
      title: noteTitle || `Worksheet: ${resource.title}`,
      data,
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    submissionId: submission.id,
    submittedAt: submission.submittedAt.toISOString(),
  });
}
