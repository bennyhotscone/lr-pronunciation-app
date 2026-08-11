import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/portal-access";
import { GoalProgressForm } from "@/components/portal/GoalProgressForm";
import { GoalChecklistReadOnly } from "@/components/portal/GoalChecklistReadOnly";
import { GoalChecklistStudent } from "@/components/portal/GoalChecklistStudent";

export default async function GoalsPage() {
  const session = await requireRole("STUDENT");
  const goals = await prisma.goal.findMany({
    where: { studentId: session.user.id },
    include: {
      checklistItems: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">Goals</h1>
      <p className="mt-2 text-muted">
        Teacher goals stay teacher-checked for accountability. Self-study goals from “I need more
        help” are yours to tick as you practise.
      </p>
      <ul className="mt-6 space-y-4">
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
                  {selfHelp ? "Self-study" : "Teacher goal"}
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
              <p className="mt-1 text-xs text-muted">{g.progressPct}% complete</p>
              {selfHelp ? (
                <GoalChecklistStudent items={g.checklistItems} />
              ) : (
                <GoalChecklistReadOnly items={g.checklistItems} />
              )}
              <GoalProgressForm goalId={g.id} studentNotes={g.studentNotes || ""} />
            </li>
          );
        })}
        {!goals.length ? <li className="text-sm text-muted">No goals yet.</li> : null}
      </ul>
    </div>
  );
}
