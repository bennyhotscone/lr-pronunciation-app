import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/portal-access";
import { assertStudentOwnsAttempt } from "@/lib/story/access";
import { StoryWizard } from "@/components/story/StoryWizard";

export default async function PortalStoryAttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const session = await requireRole("STUDENT");
  const { attemptId } = await params;
  const attempt = await assertStudentOwnsAttempt(attemptId, session.user.id);
  if (!attempt) notFound();

  const a = attempt.assignment;
  const readOnly = attempt.status === "SUBMITTED" || attempt.status === "REVIEWED";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link
        href="/portal"
        className="text-sm font-semibold text-ink/55 underline-offset-2 hover:text-ink hover:underline"
      >
        ← My Desk
      </Link>
      <div className="mt-4">
        <StoryWizard
          attemptId={attempt.id}
          readOnly={readOnly}
          assignment={{
            title: a.title,
            instructions: a.instructions,
            wordTarget: a.wordTarget,
            wordMin: a.wordMin,
            wordMax: a.wordMax,
            cefrLevel: a.cefrLevel,
            grammarFocus: a.grammarFocus,
            vocabList: a.vocabList,
            pasteWordThreshold: a.pasteWordThreshold,
            restrictLargePaste: a.restrictLargePaste,
            teacherMustApprovePlan: a.teacherMustApprovePlan,
            planningRequired: a.planningRequired,
            storyMapRequired: a.storyMapRequired,
            cannotDraftUntilPlanComplete: a.cannotDraftUntilPlanComplete,
            revisionRequired: a.revisionRequired,
            requireCharacter: a.requireCharacter,
            requireSetting: a.requireSetting,
            requireGoal: a.requireGoal,
            requireProblem: a.requireProblem,
            requireChain: a.requireChain,
            requireComplication: a.requireComplication,
            requireClimax: a.requireClimax,
            requireResolution: a.requireResolution,
          }}
          initialStep={attempt.currentStep}
          status={attempt.status}
          planApproval={attempt.planApproval}
          studentTitle={attempt.studentTitle}
          studentTopic={attempt.studentTopic}
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
                  planComplete: attempt.plan.planComplete,
                  events: attempt.plan.events.map((e) => ({
                    id: e.id,
                    label: e.label,
                    cause: e.cause,
                    effect: e.effect,
                    notes: e.notes,
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
          }))}
          teacherFeedback={attempt.feedback?.body ?? null}
        />
      </div>
    </div>
  );
}
