import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/portal-access";
import { GoalProgressForm } from "@/components/portal/GoalProgressForm";

export default async function GoalsPage() {
  const session = await requireRole("STUDENT");
  const goals = await prisma.goal.findMany({
    where: { studentId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">Goals</h1>
      <p className="mt-2 text-muted">Track progress — saved to your account.</p>
      <ul className="mt-6 space-y-4">
        {goals.map((g) => (
          <li key={g.id} className="card rounded-2xl p-4">
            <p className="font-semibold">{g.title}</p>
            {g.description ? <p className="mt-1 text-sm text-muted">{g.description}</p> : null}
            <div className="progress-bar mt-3">
              <span style={{ width: `${g.progressPct}%` }} />
            </div>
            <GoalProgressForm
              goalId={g.id}
              progressPct={g.progressPct}
              studentNotes={g.studentNotes || ""}
            />
          </li>
        ))}
        {!goals.length ? <li className="text-sm text-muted">No goals yet.</li> : null}
      </ul>
    </div>
  );
}
