import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveClassIdsForStudent, requireRole } from "@/lib/portal-access";
import { getAvatar } from "@/lib/avatars";
import { portalResourceDownloadHref } from "@/lib/portal-files";

export default async function MyDeskPage() {
  const session = await requireRole("STUDENT");
  const studentId = session.user.id;
  const classIds = await getActiveClassIdsForStudent(studentId);
  const profile = await prisma.studentProfile.findUnique({ where: { userId: studentId } });
  const avatar = getAvatar(profile?.avatarId || session.user.avatarId);
  const name =
    profile?.preferredName || session.user.preferredName || session.user.name || "there";

  const [latestLesson, homework, newFiles, justForYou, goals, classes, recommendations] =
    await Promise.all([
      prisma.lesson.findFirst({
        where: {
          OR: [{ studentId }, ...(classIds.length ? [{ classId: { in: classIds } }] : [])],
        },
        orderBy: { date: "desc" },
        include: { class: { select: { name: true } } },
      }),
      prisma.homework.findMany({
        where: {
          OR: [{ studentId }, ...(classIds.length ? [{ classId: { in: classIds } }] : [])],
          status: "ASSIGNED",
        },
        orderBy: { dueAt: "asc" },
        take: 8,
        include: { class: { select: { name: true } } },
      }),
      prisma.resource.findMany({
        where: {
          OR: [
            { studentId },
            ...(classIds.length ? [{ classId: { in: classIds } }] : []),
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.resource.findMany({
        where: { studentId, classId: null },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.goal.findMany({
        where: { studentId, status: "ACTIVE" },
        orderBy: { updatedAt: "desc" },
        take: 4,
      }),
      prisma.class.findMany({
        where: { id: { in: classIds } },
        orderBy: { name: "asc" },
      }),
      prisma.recommendation.findMany({
        where: {
          approval: "APPROVED",
          OR: [{ studentId }, ...(classIds.length ? [{ classId: { in: classIds } }] : [])],
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  const justForYouLessons = await prisma.lesson.findMany({
    where: { studentId },
    orderBy: { date: "desc" },
    take: 4,
  });

  return (
    <div>
      <div className="flex items-center gap-4">
        <span
          className="inline-flex h-16 w-16 items-center justify-center rounded-full text-4xl shadow-sm"
          style={{ background: avatar.bg }}
          aria-hidden
        >
          {avatar.emoji}
        </span>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
            My Desk
          </h1>
          <p className="mt-1 text-muted">Welcome back, {name}.</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <section className="card rounded-2xl p-5 md:col-span-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Latest lesson</h2>
          {latestLesson ? (
            <div className="mt-2">
              <p className="font-[family-name:var(--font-display)] text-xl font-semibold">
                {latestLesson.title}
              </p>
              <p className="mt-1 text-sm text-muted">
                {latestLesson.date.toLocaleDateString()}
                {latestLesson.class ? ` · ${latestLesson.class.name}` : " · Just for you"}
              </p>
              {latestLesson.summary ? (
                <p className="mt-2 text-sm leading-relaxed">{latestLesson.summary}</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">No lessons yet — check back after class.</p>
          )}
        </section>

        <section className="card rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Homework</h2>
            <Link href="/portal/lessons" className="text-xs font-bold text-foreground">
              View all
            </Link>
          </div>
          {homework.length ? (
            <ul className="mt-3 space-y-3">
              {homework.map((h) => (
                <li key={h.id} className="border-b border-border/60 pb-2 last:border-0">
                  <p className="font-semibold">{h.title}</p>
                  <p className="text-xs text-muted">
                    {h.dueAt ? `Due ${h.dueAt.toLocaleDateString()}` : "No due date"}
                    {h.class ? ` · ${h.class.name}` : " · Just for you"}
                  </p>
                  <p className="mt-1 text-sm">{h.instructions}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">No open homework.</p>
          )}
        </section>

        <section className="card rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">New files</h2>
            <Link href="/portal/resources" className="text-xs font-bold text-foreground">
              All files
            </Link>
          </div>
          {newFiles.length ? (
            <ul className="mt-3 space-y-2">
              {newFiles.map((f) => (
                <li key={f.id}>
                  <a
                    href={portalResourceDownloadHref(f.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-foreground underline-offset-2 hover:underline"
                  >
                    {f.title}
                  </a>
                  <p className="text-xs text-muted">{f.filename}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">No files yet.</p>
          )}
        </section>

        <section className="card rounded-2xl p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Just for you</h2>
          {justForYou.length || justForYouLessons.length ? (
            <ul className="mt-3 space-y-2">
              {justForYouLessons.map((l) => (
                <li key={l.id} className="text-sm">
                  <span className="chip bg-coral/15">Lesson</span> {l.title}
                </li>
              ))}
              {justForYou.map((f) => (
                <li key={f.id} className="text-sm">
                  <span className="chip bg-amber/25">File</span>{" "}
                  <a href={portalResourceDownloadHref(f.id)} target="_blank" rel="noopener noreferrer" className="font-semibold underline-offset-2 hover:underline">
                    {f.title}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">No individual assignments right now.</p>
          )}
        </section>

        <section className="card rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Goals</h2>
            <Link href="/portal/goals" className="text-xs font-bold">
              Open
            </Link>
          </div>
          {goals.length ? (
            <ul className="mt-3 space-y-2">
              {goals.map((g) => (
                <li key={g.id}>
                  <p className="font-semibold">{g.title}</p>
                  <div className="progress-bar mt-1">
                    <span style={{ width: `${g.progressPct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">Your teacher can set goals for you.</p>
          )}
        </section>

        <section className="card rounded-2xl p-5 md:col-span-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Your classes</h2>
          {classes.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {classes.map((c) => (
                <li key={c.id} className="chip bg-teal/15">
                  {c.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">You are not enrolled in a class yet.</p>
          )}
        </section>

        {recommendations.length ? (
          <section className="card rounded-2xl p-5 md:col-span-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
              Recommended practice
            </h2>
            <ul className="mt-3 space-y-2">
              {recommendations.map((r) => (
                <li key={r.id}>
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline-offset-2 hover:underline">
                      {r.title}
                    </a>
                  ) : (
                    <span className="font-semibold">{r.title}</span>
                  )}
                  {r.description ? <p className="text-sm text-muted">{r.description}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
