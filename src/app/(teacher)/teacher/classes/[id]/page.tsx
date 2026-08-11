import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertTeacherOwnsClass, requireRole } from "@/lib/portal-access";
import { ClassTools } from "@/components/portal/ClassTools";
import { portalResourceDownloadHref } from "@/lib/portal-files";

export default async function TeacherClassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("TEACHER");
  const { id } = await params;

  let klass;
  try {
    klass = await assertTeacherOwnsClass(session.user.id, id);
  } catch {
    notFound();
  }

  const [memberships, lessons, resources, homework, allStudents] = await Promise.all([
    prisma.classMembership.findMany({
      where: { classId: id, status: "ACTIVE" },
      include: { student: { include: { profile: true } } },
    }),
    prisma.lesson.findMany({
      where: { classId: id },
      orderBy: { date: "desc" },
    }),
    prisma.resource.findMany({
      where: { classId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.homework.findMany({
      where: { classId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { role: "STUDENT", archivedAt: null },
      include: { profile: true },
      orderBy: { email: "asc" },
    }),
  ]);

  const studentOptions = allStudents.map((s) => ({
    id: s.id,
    label: `${s.profile?.preferredName || s.profile?.fullName || s.email} (${s.email})`,
  }));

  return (
    <div>
      <Link href="/teacher" className="text-sm font-semibold text-muted hover:text-foreground">
        ← Dashboard
      </Link>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold">
        {klass.name}
      </h1>
      {klass.description ? <p className="mt-2 text-muted">{klass.description}</p> : null}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <section className="card rounded-2xl p-4">
          <h2 className="text-xs font-bold uppercase text-muted">Lessons</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {lessons.slice(0, 5).map((l) => (
              <li key={l.id}>{l.title}</li>
            ))}
            {!lessons.length ? <li className="text-muted">None yet</li> : null}
          </ul>
        </section>
        <section className="card rounded-2xl p-4">
          <h2 className="text-xs font-bold uppercase text-muted">Files</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {resources.slice(0, 5).map((r) => (
              <li key={r.id}>
                <a href={portalResourceDownloadHref(r.id)} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                  {r.title}
                </a>
              </li>
            ))}
            {!resources.length ? <li className="text-muted">None yet</li> : null}
          </ul>
        </section>
        <section className="card rounded-2xl p-4">
          <h2 className="text-xs font-bold uppercase text-muted">Homework</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {homework.slice(0, 5).map((h) => (
              <li key={h.id}>{h.title}</li>
            ))}
            {!homework.length ? <li className="text-muted">None yet</li> : null}
          </ul>
        </section>
      </div>

      <ClassTools
        classId={id}
        students={studentOptions}
        enrolledIds={memberships.map((m) => m.studentId)}
        lessons={lessons.map((l) => ({ id: l.id, title: l.title }))}
      />
    </div>
  );
}
