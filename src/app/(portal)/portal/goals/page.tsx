import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/portal-access";
import { GoalProgressForm } from "@/components/portal/GoalProgressForm";
import { GoalChecklistReadOnly } from "@/components/portal/GoalChecklistReadOnly";
import { LearningPyramid } from "@/components/portal/LearningPyramid";

export default async function GoalsPage() {
  const session = await requireRole("STUDENT");
  const goals = await prisma.goal.findMany({
    where: { studentId: session.user.id },
    include: {
      checklistItems: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const active = goals.filter((g) => g.status === "ACTIVE");

  return (
    <div className="desk-shell">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
        Learning targets
      </h1>
      <p className="mt-2 text-muted">
        Pyramid view of your goals — general foundation at the base, specialized work at the tip.
        Only your teacher confirms checklist items; you can leave notes.
      </p>

      <section className="mt-6 rounded-2xl p-2 sm:p-3">
        <LearningPyramid
          goals={active.map((g) => ({
            id: g.id,
            title: g.title,
            description: g.description,
            progressPct: g.progressPct,
            source: g.source,
            pyramidTier: g.pyramidTier,
            checklistItems: g.checklistItems,
          }))}
        />
      </section>

      <h2 className="mt-10 font-[family-name:var(--font-display)] text-xl font-semibold">
        All targets & notes
      </h2>
      <ul className="mt-4 space-y-4">
        {goals.map((g) => {
          const selfHelp = g.source === "STUDENT_HELP";
          return (
            <li key={g.id} className="card rounded-2xl p-4">
              <div className="mb-1 flex flex-wrap gap-1.5">
                <span
                  className={`rounded px-2 py-0.5 text-[0.65rem] font-bold uppercase ${
                    selfHelp
                      ? "bg-desk-accent/15 text-desk-accent"
                      : "bg-[#ebe8e0] text-muted"
                  }`}
                >
                  {selfHelp ? "Extra help request" : "Class focus"}
                </span>
                <span className="rounded bg-[#f3f2ee] px-2 py-0.5 text-[0.65rem] font-semibold text-muted ring-1 ring-border">
                  Tier {g.pyramidTier}
                </span>
                {g.topicTag ? (
                  <span className="rounded bg-[#f3f2ee] px-2 py-0.5 text-[0.65rem] font-semibold text-muted ring-1 ring-border">
                    {g.topicTag}
                  </span>
                ) : null}
              </div>
              <p className="font-semibold">{g.title}</p>
              {g.description ? <p className="mt-1 text-sm text-muted">{g.description}</p> : null}
              <div className="progress-bar mt-3">
                <span style={{ width: `${g.progressPct}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted">{g.progressPct}% confirmed by teacher</p>
              <GoalChecklistReadOnly items={g.checklistItems} />
              <GoalProgressForm goalId={g.id} studentNotes={g.studentNotes || ""} />
            </li>
          );
        })}
        {!goals.length ? (
          <li className="text-sm text-muted">
            No learning targets yet. Ask for more help on a lesson topic, or wait for your teacher
            to set targets for you.
          </li>
        ) : null}
      </ul>
    </div>
  );
}