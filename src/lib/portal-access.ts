import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { Role } from "@prisma/client";
import { redirect } from "next/navigation";

export function isStaff(role: Role | undefined | null): boolean {
  return role === "ADMIN" || role === "TEACHER";
}

export function isAdmin(role: Role | undefined | null): boolean {
  return role === "ADMIN";
}

export function homeForRole(role: Role | undefined | null): string {
  if (isStaff(role)) return "/teacher";
  return "/portal";
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session;
}

/** Exact role match; redirects other signed-in users to their home. */
export async function requireRole(role: Role) {
  const session = await requireSession();
  if (session.user.role !== role) {
    redirect(homeForRole(session.user.role));
  }
  return session;
}

/** Teacher dashboard + tools: ADMIN or TEACHER. */
export async function requireStaff() {
  const session = await requireSession();
  if (!isStaff(session.user.role)) {
    redirect("/portal");
  }
  return session;
}

/** Mandarin Studio + admin-only actions. */
export async function requireAdmin() {
  const session = await requireSession();
  if (!isAdmin(session.user.role)) {
    redirect(homeForRole(session.user.role));
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

/**
 * Class ownership for staff.
 * Teachers: only classes they teach.
 * Admins: any non-archived class (or classes they teach).
 */
export async function assertTeacherOwnsClass(userId: string, classId: string, role?: Role) {
  const sessionRole = role ?? (await auth())?.user?.role;
  if (sessionRole === "ADMIN") {
    const klass = await prisma.class.findFirst({
      where: { id: classId, archivedAt: null },
    });
    if (!klass) throw new Error("Class not found or access denied");
    return klass;
  }
  const klass = await prisma.class.findFirst({
    where: { id: classId, teacherId: userId, archivedAt: null },
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

export async function studentCanAccessClassPost(studentId: string, postId: string) {
  const post = await prisma.classPost.findUnique({ where: { id: postId } });
  if (!post) return false;
  return studentCanAccessClass(studentId, post.classId);
}
