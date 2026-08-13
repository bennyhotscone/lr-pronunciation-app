import { prisma } from "@/lib/db";
import { normalizeInviteCode } from "@/lib/invite-code";
import { revalidatePath } from "next/cache";

/** Shared join logic (safe to call from RSC pages or server actions). */
export async function enrollStudentWithInviteCode(
  studentId: string,
  rawCode: string,
  options?: { revalidate?: boolean },
) {
  const code = normalizeInviteCode(rawCode);
  if (code.length < 4) {
    return { error: "Enter a valid invite code." as const };
  }

  // Exact match first (codes stored uppercase). Fallback insensitive for mixed-case rows.
  let klass = await prisma.class.findFirst({
    where: { inviteCode: code, archivedAt: null },
  });
  if (!klass) {
    klass = await prisma.class.findFirst({
      where: { inviteCode: { equals: code, mode: "insensitive" }, archivedAt: null },
    });
  }
  if (!klass) {
    return {
      error: "No classroom found for that code. Check it with your teacher." as const,
    };
  }

  await prisma.classMembership.upsert({
    where: {
      classId_studentId: { classId: klass.id, studentId },
    },
    create: { classId: klass.id, studentId, status: "ACTIVE" },
    update: { status: "ACTIVE", leftAt: null },
  });

  // Do not call revalidatePath during RSC page render — it 500s. Only from actions.
  if (options?.revalidate) {
    revalidatePath("/portal");
    revalidatePath("/portal/join");
    revalidatePath(`/portal/classrooms/${klass.id}`);
  }

  return { ok: true as const, classId: klass.id, className: klass.name, code };
}
