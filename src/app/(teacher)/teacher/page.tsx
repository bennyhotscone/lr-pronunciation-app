import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/portal-access";
import { AddStudentForm } from "@/components/portal/AddStudentForm";
import { teacherCreateClass } from "@/lib/portal-actions";

export default async function TeacherDashboardPage() {
  const session = await requireRole("TEACHER");
  const [students, classes] = await Promise.all([
    prisma.user.findMany({
      where: { role: "STUDENT", archivedAt: null },
      include: { profile: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.class.findMany({
      where: { teacherId: session.user.id, archivedAt: null },
      include: {
        _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
        Teacher dashboard
      </h1>
      <p className="mt-2 text-muted">
        Create once, share many — classes, students, lessons, files and homework.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <AddStudentForm />

        <div className="card rounded-2xl p-5">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Create class
          </h2>
          <form action={teacherCreateClass} className="mt-4 grid gap-3">
            <input
              name="name"
              required
              placeholder="Class name"
              className="rounded-xl border border-border bg-white px-3 py-2"
            />
            <input
              name="level"
              placeholder="Level (optional)"
              className="rounded-xl border border-border bg-white px-3 py-2"
            />
            <textarea
              name="description"
              rows={2}
              placeholder="Description"
              className="rounded-xl border border-border bg-white px-3 py-2"
            />
            <button type="submit" className="btn-primary rounded-xl px-4 py-2.5 text-sm font-bold">
              Create class
            </button>
          </form>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Classes</h2>
        <ul className="mt-3 space-y-2">
          {classes.map((c) => (
            <li key={c.id}>
              <Link
                href={`/teacher/classes/${c.id}`}
                className="card flex items-center justify-between rounded-2xl p-4 transition hover:-translate-y-0.5"
              >
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-muted">
                    {c._count.memberships} enrolled
                    {c.level ? ` · ${c.level}` : ""}
                  </p>
                </div>
                <span aria-hidden>→</span>
              </Link>
            </li>
          ))}
          {!classes.length ? <li className="text-sm text-muted">No classes yet.</li> : null}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Students</h2>
        <ul className="mt-3 space-y-2">
          {students.map((s) => (
            <li key={s.id}>
              <Link
                href={`/teacher/students/${s.id}`}
                className="card flex items-center justify-between rounded-2xl p-4"
              >
                <div>
                  <p className="font-semibold">
                    {s.profile?.preferredName || s.profile?.fullName || s.email}
                  </p>
                  <p className="text-xs text-muted">{s.email}</p>
                </div>
                <span aria-hidden>→</span>
              </Link>
            </li>
          ))}
          {!students.length ? <li className="text-sm text-muted">No students yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
