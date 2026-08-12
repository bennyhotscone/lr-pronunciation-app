import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { allowsPdfWriteMode } from "@/lib/material-kind";
import { studentCanAccessResource } from "@/lib/portal-access";
import {
  emptyPdfWriteData,
  parsePdfWriteData,
  stripEmptyOverlays,
} from "@/lib/pdf-write-data";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function assertExerciseWriteAccess(studentId: string, resourceId: string) {
  const allowed = await studentCanAccessResource(studentId, resourceId);
  if (!allowed) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    select: { materialKind: true },
  });
  if (!resource) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!allowsPdfWriteMode(resource.materialKind)) {
    return {
      error: NextResponse.json(
        {
          error:
            "Write mode is only for Exercises/Activities. Explanations/Notes are read-only.",
        },
        { status: 403 },
      ),
    };
  }
  return { resource };
}

export async function GET(_request: Request, context: Ctx) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: resourceId } = await context.params;
  const allowed = await studentCanAccessResource(session.user.id, resourceId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const draft = await prisma.pdfWriteDraft.findUnique({
    where: {
      studentId_resourceId: {
        studentId: session.user.id,
        resourceId,
      },
    },
  });

  return NextResponse.json({
    data: draft ? parsePdfWriteData(draft.data) : emptyPdfWriteData(),
    updatedAt: draft?.updatedAt?.toISOString() ?? null,
  });
}

export async function PUT(request: Request, context: Ctx) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: resourceId } = await context.params;
  const gate = await assertExerciseWriteAccess(session.user.id, resourceId);
  if ("error" in gate && gate.error) return gate.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const data = stripEmptyOverlays(
    parsePdfWriteData(
      body && typeof body === "object" && "data" in body
        ? (body as { data: unknown }).data
        : body,
    ),
  );

  if (data.overlays.length > 80) {
    return NextResponse.json({ error: "Too many text boxes (max 80)." }, { status: 400 });
  }
  for (const o of data.overlays) {
    if (o.text.length > 4000) {
      return NextResponse.json({ error: "Text box content too long." }, { status: 400 });
    }
  }

  const draft = await prisma.pdfWriteDraft.upsert({
    where: {
      studentId_resourceId: {
        studentId: session.user.id,
        resourceId,
      },
    },
    create: {
      studentId: session.user.id,
      resourceId,
      data,
    },
    update: { data },
  });

  return NextResponse.json({
    ok: true,
    updatedAt: draft.updatedAt.toISOString(),
    data: parsePdfWriteData(draft.data),
  });
}
