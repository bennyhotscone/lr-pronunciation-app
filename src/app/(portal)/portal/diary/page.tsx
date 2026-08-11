import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/portal-access";
import { DiaryForm } from "@/components/portal/DiaryForm";

export default async function DiaryPage() {
  const session = await requireRole("STUDENT");
  const entries = await prisma.diaryEntry.findMany({
    where: { studentId: session.user.id },
    orderBy: { date: "desc" },
    take: 30,
  });

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">Learning diary</h1>
      <p className="mt-2 text-muted">Short reflections — shared with your teacher.</p>
      <DiaryForm />
      <ul className="mt-6 space-y-3">
        {entries.map((e) => (
          <li key={e.id} className="card rounded-2xl p-4">
            <p className="text-xs text-muted">{e.date.toLocaleString()}</p>
            {e.title ? <p className="font-semibold">{e.title}</p> : null}
            <p className="mt-1 text-sm whitespace-pre-wrap">{e.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
