import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/portal-access";
import { StudentAssignTools } from "@/components/portal/StudentAssignTools";
import { getAvatar } from "@/lib/avatars";

export default async function TeacherStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("TEACHER");
  const { id } = await params;

  const student = await prisma.user.findFirst({
    where: { id, role: "STUDENT" },
    include: {
      profile: true,
      memberships: {
        where: { status: "ACTIVE" },
        include: { class: true },
      },
      individualLessons: { orderBy: { date: "desc" }, take: 10 },
      individualResources: { orderBy: { createdAt: "desc" }, take: 10 },
      studentHomework: { orderBy: { createdAt: "desc" }, take: 10 },
      goals: { orderBy: { updatedAt: "desc" }, take: 10 },
      diaryEntries: { orderBy: { date: "desc" }, take: 5 },
    },
  });
  if (!student) notFound();

  const label =
    student.profile?.preferredName || student.profile?.fullName || student.email;
  const avatar = getAvatar(student.profile?.avatarId);

  return (
    <div>
      <Link href="/teacher" className="text-sm font-semibold text-muted hover:text-foreground">
        ← Dashboard
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <span
          className="inline-flex h-12 w-12 items-center justify-center rounded-full text-2xl"
          style={{ background: avatar.bg }}
          aria-hidden
        >
          {avatar.emoji}
        </span>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">{label}</h1>
          <p className="text-sm text-muted">{student.email}</p>
        </div>
      </div>

      <p className="mt-4 text-sm">
        Classes:{" "}
        {student.memberships.length
          ? student.memberships.map((m) => m.class.name).join(", ")
          : "None"}
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="card rounded-2xl p-4">
          <h2 className="text-xs font-bold uppercase text-muted">Just-for-you lessons</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {student.individualLessons.map((l) => (
              <li key={l.id}>{l.title}</li>
            ))}
            {!student.individualLessons.length ? <li className="text-muted">None</li> : null}
          </ul>
        </section>
        <section className="card rounded-2xl p-4">
          <h2 className="text-xs font-bold uppercase text-muted">Just-for-you files</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {student.individualResources.map((r) => (
              <li key={r.id}>
                <a href={r.blobUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                  {r.title}
                </a>
              </li>
            ))}
            {!student.individualResources.length ? <li className="text-muted">None</li> : null}
          </ul>
        </section>
        <section className="card rounded-2xl p-4">
          <h2 className="text-xs font-bold uppercase text-muted">Recent diary</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {student.diaryEntries.map((e) => (
              <li key={e.id}>
                <p className="text-xs text-muted">{e.date.toLocaleDateString()}</p>
                <p>{e.body.slice(0, 140)}</p>
              </li>
            ))}
            {!student.diaryEntries.length ? <li className="text-muted">None</li> : null}
          </ul>
        </section>
        <section className="card rounded-2xl p-4">
          <h2 className="text-xs font-bold uppercase text-muted">Goals</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {student.goals.map((g) => (
              <li key={g.id}>
                {g.title} ({g.progressPct}%)
              </li>
            ))}
            {!student.goals.length ? <li className="text-muted">None</li> : null}
          </ul>
        </section>
      </div>

      <StudentAssignTools studentId={student.id} studentLabel={label} />
    </div>
  );
}
