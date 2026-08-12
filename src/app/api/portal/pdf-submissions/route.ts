import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isStaff } from "@/lib/portal-access";
import { parsePdfWriteData } from "@/lib/pdf-write-data";

export const runtime = "nodejs";

/** Teacher/admin: list PDF worksheet submissions (optional ?classId= & ?studentId=). */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const classId = url.searchParams.get("classId");
  const studentId = url.searchParams.get("studentId");

  const where: {
    classId?: string;
    studentId?: string;
  } = {};
  if (classId) where.classId = classId;
  if (studentId) where.studentId = studentId;

  // Teachers only see submissions in their classes (or individual with no class).
  if (session.user.role === "TEACHER") {
    const owned = await prisma.class.findMany({
      where: { teacherId: session.user.id },
      select: { id: true },
    });
    const ownedIds = owned.map((c) => c.id);
    if (classId && !ownedIds.includes(classId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!classId && !studentId) {
      // default: all owned classes
      const rows = await prisma.pdfSubmission.findMany({
        where: { classId: { in: ownedIds } },
        orderBy: { submittedAt: "desc" },
        take: 50,
        include: {
          student: { include: { profile: true } },
        },
      });
      return NextResponse.json({ submissions: mapRows(rows) });
    }
    if (studentId && !classId) {
      // student page: only if student is in teacher's class OR submission has null class
      const inClass = await prisma.classMembership.findFirst({
        where: {
          studentId,
          status: "ACTIVE",
          class: { teacherId: session.user.id },
        },
      });
      if (!inClass) {
        // still allow if there are individual submissions with classId null
      }
    }
  }

  const rows = await prisma.pdfSubmission.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    take: 50,
    include: {
      student: { include: { profile: true } },
    },
  });

  // Filter teacher visibility for student-scoped queries
  if (session.user.role === "TEACHER" && studentId) {
    const ownedIds = (
      await prisma.class.findMany({
        where: { teacherId: session.user.id },
        select: { id: true },
      })
    ).map((c) => c.id);
    const filtered = rows.filter(
      (r) => !r.classId || ownedIds.includes(r.classId),
    );
    return NextResponse.json({ submissions: mapRows(filtered) });
  }

  return NextResponse.json({ submissions: mapRows(rows) });
}

function mapRows(
  rows: Array<{
    id: string;
    title: string;
    resourceId: string;
    classId: string | null;
    status: string;
    submittedAt: Date;
    data: unknown;
    student: {
      email: string;
      profile: { preferredName: string | null; fullName: string | null } | null;
    };
  }>,
) {
  return rows.map((r) => {
    const data = parsePdfWriteData(r.data);
    const answerCount =
      Object.values(data.fields).filter((v) => v.trim()).length +
      data.overlays.filter((o) => o.text.trim()).length;
    return {
      id: r.id,
      title: r.title,
      resourceId: r.resourceId,
      classId: r.classId,
      status: r.status,
      submittedAt: r.submittedAt.toISOString(),
      answerCount,
      studentLabel:
        r.student.profile?.preferredName ||
        r.student.profile?.fullName ||
        r.student.email,
      studentEmail: r.student.email,
      preview: [
        ...Object.values(data.fields).filter((v) => v.trim()).slice(0, 2),
        ...data.overlays
          .filter((o) => o.text.trim())
          .map((o) => o.text.trim())
          .slice(0, 2),
      ].slice(0, 3),
    };
  });
}
