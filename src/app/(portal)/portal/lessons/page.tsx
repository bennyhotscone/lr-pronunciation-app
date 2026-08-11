import { prisma } from "@/lib/db";
import { getActiveClassIdsForStudent, requireRole } from "@/lib/portal-access";

export default async function LessonsPage() {
  const session = await requireRole("STUDENT");
  const classIds = await getActiveClassIdsForStudent(session.user.id);
  const lessons = await prisma.lesson.findMany({
    where: {
      OR: [
        { studentId: session.user.id },
        ...(classIds.length ? [{ classId: { in: classIds } }] : []),
      ],
    },
    orderBy: { date: "desc" },
    include: { class: { select: { name: true } } },
  });

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">Lessons</h1>
      <p className="mt-2 text-muted">Class lessons and items assigned just for you.</p>
      <ul className="mt-6 space-y-3">
        {lessons.map((l) => (
          <li key={l.id} className="card rounded-2xl p-4">
            <p className="font-semibold">{l.title}</p>
            <p className="text-xs text-muted">
              {l.date.toLocaleDateString()}
              {l.class ? ` · ${l.class.name}` : " · Just for you"}
            </p>
            {l.summary ? <p className="mt-2 text-sm">{l.summary}</p> : null}
            {l.tags.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {l.tags.map((t) => (
                  <span key={t} className="chip bg-accent-soft">
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
          </li>
        ))}
        {!lessons.length ? <li className="text-sm text-muted">No lessons yet.</li> : null}
      </ul>
    </div>
  );
}
