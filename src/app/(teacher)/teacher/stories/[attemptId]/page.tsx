import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/portal-access";
import { assertTeacherCanReviewAttempt } from "@/lib/story/access";
import { TeacherStoryReview } from "@/components/story/TeacherStoryReview";

export default async function TeacherStoryAttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const session = await requireStaff();
  const { attemptId } = await params;
  const attempt = await assertTeacherCanReviewAttempt(
    attemptId,
    session.user.id,
    session.user.role,
  );
  if (!attempt) notFound();

  const student = await prisma.user.findUnique({
    where: { id: attempt.studentId },
    include: { profile: true },
  });
  const studentLabel =
    student?.profile?.preferredName ||
    student?.profile?.fullName ||
    student?.email ||
    "Student";

  const backHref = attempt.assignment.classId
    ? `/teacher/classes/${attempt.assignment.classId}`
    : `/teacher/students/${attempt.studentId}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link
        href={backHref}
        className="text-sm font-semibold text-muted underline-offset-2 hover:text-foreground hover:underline"
      >
        ← Back
      </Link>
      <div className="mt-4">
        <TeacherStoryReview
          attemptId={attempt.id}
          status={attempt.status}
          planApproval={attempt.planApproval}
          teacherMustApprovePlan={attempt.assignment.teacherMustApprovePlan}
          assignment={{
            title: attempt.assignment.title,
            instructions: attempt.assignment.instructions,
            wordTarget: attempt.assignment.wordTarget,
            cefrLevel: attempt.assignment.cefrLevel,
            grammarFocus: attempt.assignment.grammarFocus,
            vocabList: attempt.assignment.vocabList,
            vocabMinCount: attempt.assignment.vocabMinCount,
            vocabRequireAll: attempt.assignment.vocabRequireAll,
          }}
          plan={
            attempt.plan
              ? {
                  characterName: attempt.plan.characterName,
                  characterTraits: attempt.plan.characterTraits,
                  characterWant: attempt.plan.characterWant,
                  settingPlace: attempt.plan.settingPlace,
                  settingTime: attempt.plan.settingTime,
                  settingMood: attempt.plan.settingMood,
                  goalType: attempt.plan.goalType,
                  goalText: attempt.plan.goalText,
                  problemType: attempt.plan.problemType,
                  problemText: attempt.plan.problemText,
                  complicationText: attempt.plan.complicationText,
                  climaxIdea: attempt.plan.climaxIdea,
                  resolutionText: attempt.plan.resolutionText,
                  events: attempt.plan.events.map((e) => ({
                    label: e.label,
                    cause: e.cause,
                    effect: e.effect,
                  })),
                }
              : null
          }
          sections={attempt.sections.map((s) => ({
            kind: s.kind,
            body: s.body,
            wordCount: s.wordCount,
          }))}
          revisions={attempt.revisions.map((r) => ({
            passKind: r.passKind,
            completed: r.completed,
            issues: r.issues,
            completedAt: r.completedAt?.toISOString() ?? null,
          }))}
          integrity={attempt.integrity.map((e) => ({
            kind: e.kind,
            meta: e.meta,
            createdAt: e.createdAt.toISOString(),
          }))}
          feedback={attempt.feedback?.body ?? null}
          studentLabel={studentLabel}
        />
      </div>
    </div>
  );
}
