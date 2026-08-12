import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { studentCanAccessResource } from "@/lib/portal-access";
import { emptyPdfWriteData, parsePdfWriteData } from "@/lib/pdf-write-data";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

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
  const allowed = await studentCanAccessResource(session.user.id, resourceId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const data = parsePdfWriteData(
    body && typeof body === "object" && "data" in body
      ? (body as { data: unknown }).data
      : body,
  );

  // Cap overlay count / text size to keep drafts small.
  if (data.overlays.length > 80) {
    return NextResponse.json({ error: "Too many answer boxes (max 80)." }, { status: 400 });
  }
  for (const o of data.overlays) {
    if (o.text.length > 4000) {
      return NextResponse.json({ error: "Answer text too long." }, { status: 400 });
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
