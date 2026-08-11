import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { Role } from "@prisma/client";
import { redirect } from "next/navigation";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session;
}

export async function requireRole(role: Role) {
  const session = await requireSession();
  if (session.user.role !== role) {
    redirect(session.user.role === "TEACHER" ? "/teacher" : "/portal");
  }
  return session;
}

/** Live membership: student sees class content only while ACTIVE in that class. */
export async function getActiveClassIdsForStudent(studentId: string): Promise<string[]> {
  const rows = await prisma.classMembership.findMany({
    where: { studentId, status: "ACTIVE", class: { archivedAt: null } },
    select: { classId: true },
  });
  return rows.map((r) => r.classId);
}

export async function assertTeacherOwnsClass(teacherId: string, classId: string) {
  const klass = await prisma.class.findFirst({
    where: { id: classId, teacherId, archivedAt: null },
  });
  if (!klass) {
    throw new Error("Class not found or access denied");
  }
  return klass;
}

export async function studentCanAccessClass(studentId: string, classId: string) {
  const m = await prisma.classMembership.findFirst({
    where: {
      studentId,
      classId,
      status: "ACTIVE",
      class: { archivedAt: null },
    },
  });
  return Boolean(m);
}

/** Student may access a lesson if individually assigned OR via ACTIVE class membership. */
export async function studentCanAccessLesson(studentId: string, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return false;
  if (lesson.studentId === studentId) return true;
  if (lesson.classId) {
    return studentCanAccessClass(studentId, lesson.classId);
  }
  return false;
}

export async function studentCanAccessResource(studentId: string, resourceId: string) {
  const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
  if (!resource) return false;
  if (resource.studentId === studentId) return true;
  if (resource.classId) {
    return studentCanAccessClass(studentId, resource.classId);
  }
  if (resource.lessonId) {
    return studentCanAccessLesson(studentId, resource.lessonId);
  }
  return false;
}
