import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assertTeacherOwnsClass, isStaff, studentCanAccessClass } from "@/lib/portal-access";
import type { StoryAssignment, StoryAttempt } from "@prisma/client";

export type StoryAttemptBundle = StoryAttempt & {
  assignment: StoryAssignment;
  plan: (Awaited<ReturnType<typeof prisma.storyPlan.findUnique>> & {
    events: Awaited<ReturnType<typeof prisma.storyPlanEvent.findMany>>;
  }) | null;
  sections: Awaited<ReturnType<typeof prisma.storyDraftSection.findMany>>;
  revisions: Awaited<ReturnType<typeof prisma.storyRevision.findMany>>;
  integrity: Awaited<ReturnType<typeof prisma.storyIntegrityEvent.findMany>>;
  feedback: Awaited<ReturnType<typeof prisma.storyTeacherFeedback.findUnique>>;
};

export async function loadStoryAttemptBundle(attemptId: string) {
  return prisma.storyAttempt.findUnique({
    where: { id: attemptId },
    include: {
      assignment: true,
      plan: { include: { events: { orderBy: { sortOrder: "asc" } } } },
      sections: true,
      revisions: { orderBy: { createdAt: "asc" } },
      integrity: { orderBy: { createdAt: "asc" } },
      feedback: true,
    },
  });
}

export async function assertStudentOwnsAttempt(attemptId: string, studentId: string) {
  const attempt = await loadStoryAttemptBundle(attemptId);
  if (!attempt || attempt.studentId !== studentId) return null;
  return attempt;
}

export async function assertTeacherCanReviewAttempt(attemptId: string, userId: string, role: string) {
  const attempt = await loadStoryAttemptBundle(attemptId);
  if (!attempt) return null;
  const a = attempt.assignment;
  if (a.classId) {
    try {
      await assertTeacherOwnsClass(userId, a.classId, role as "ADMIN" | "TEACHER" | "STUDENT");
      return attempt;
    } catch {
      return null;
    }
  }
  if (a.createdById === userId || role === "ADMIN") return attempt;
  // Individual homework: teacher who created assignment
  if (a.homeworkId) {
    const hw = await prisma.homework.findUnique({ where: { id: a.homeworkId } });
    if (hw && (hw.createdById === userId || role === "ADMIN")) return attempt;
  }
  return null;
}

/** Student may open an assignment if class member or individually assigned / free practice owner. */
export async function studentCanAccessAssignment(studentId: string, assignmentId: string) {
  const a = await prisma.storyAssignment.findUnique({ where: { id: assignmentId } });
  if (!a) return false;
  if (a.isFreePractice) {
    const existing = await prisma.storyAttempt.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId } },
    });
    return Boolean(existing) || a.createdById === studentId;
  }
  if (a.studentId && a.studentId === studentId) return true;
  if (a.classId) return studentCanAccessClass(studentId, a.classId);
  if (a.homeworkId) {
    const hw = await prisma.homework.findUnique({ where: { id: a.homeworkId } });
    if (!hw) return false;
    if (hw.studentId === studentId) return true;
    if (hw.classId) return studentCanAccessClass(studentId, hw.classId);
  }
  return false;
}

export async function requireStudentSession() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDENT") return null;
  return session;
}

export async function requireStaffSession() {
  const session = await auth();
  if (!session?.user?.id || !isStaff(session.user.role)) return null;
  return session;
}
