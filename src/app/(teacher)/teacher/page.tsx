import Link from "next/link";
import { prisma } from "@/lib/db";
import { isAdmin, requireStaff } from "@/lib/portal-access";
import { AddStudentForm } from "@/components/portal/AddStudentForm";
import { AddTeacherForm } from "@/components/portal/AddTeacherForm";
import { teacherCreateClass } from "@/lib/portal-actions";
import { BrandMark } from "@/components/BrandMark";

async function createClassAction(formData: FormData): Promise<void> {
  "use server";
  await teacherCreateClass(formData);
}

export default async function TeacherDashboardPage() {
  const session = await requireStaff();
  const admin = isAdmin(session.user.role);

  const [students, classes, teachers] = await Promise.all([
    prisma.user.findMany({
      where: { role: "STUDENT", archivedAt: null },
      include: { profile: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.class.findMany({
      where: admin
        ? { archivedAt: null }
        : { teacherId: session.user.id, archivedAt: null },
      include: {
        _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    admin
      ? prisma.user.findMany({
          where: { role: "TEACHER", archivedAt: null },
          include: { profile: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
          {admin ? "Admin dashboard" : "Teacher dashboard"}
        </h1>
        {admin ? (
          <span className="chip bg-sand-accent/25 text-sand-accent">Admin</span>
        ) : null}
      </div>
      <p className="mt-2 text-muted">
        Classes, students, lessons, files, homework, and classroom posts.
      </p>

      {admin ? (
        <p className="mt-3">
          <Link
            href="/english-for-mandarin-speakers/studio"
            className="text-sm font-bold text-sand-accent underline-offset-2 hover:underline"
          >
            Open Mandarin Audio Studio →
          </Link>
        </p>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <AddStudentForm />

        <div className="card rounded-2xl p-5">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Create class
          </h2>
          <form action={createClassAction} className="mt-4 grid gap-3">
            <input
              name="name"
              required
              placeholder="Class name"
              className="rounded-xl border border-border bg-background/60 px-3 py-2"
            />
            <input
              name="level"
              placeholder="Level (optional)"
              className="rounded-xl border border-border bg-background/60 px-3 py-2"
            />
            <textarea
              name="description"
              rows={2}
              placeholder="Description"
              className="rounded-xl border border-border bg-background/60 px-3 py-2"
            />
            <button type="submit" className="btn-primary rounded-xl px-4 py-2.5 text-sm font-bold">
              Create class
            </button>
          </form>
        </div>
      </div>

      {admin ? (
        <>
          <AddTeacherForm />
          {teachers.length ? (
            <ul className="mt-4 space-y-1 text-sm text-muted">
              {teachers.map((t) => (
                <li key={t.id}>
                  {t.profile?.preferredName || t.profile?.fullName || t.email} — {t.email}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}

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

      <div className="mt-12 opacity-40">
        <BrandMark size={36} />
      </div>
    </div>
  );
}
