import Link from "next/link";
import { prisma } from "@/lib/db";
import { isAdmin, requireStaff } from "@/lib/portal-access";
import { teacherCreateClassroom } from "@/lib/classroom-actions";
import { AddTeacherForm } from "@/components/portal/AddTeacherForm";
import { redirect } from "next/navigation";

async function createClassroomAction(formData: FormData): Promise<void> {
  "use server";
  await teacherCreateClassroom(formData);
}

export default async function TeacherDashboardPage() {
  const session = await requireStaff();
  const admin = isAdmin(session.user.role);

  const classes = await prisma.class.findMany({
    where: admin
      ? { archivedAt: null }
      : { teacherId: session.user.id, archivedAt: null },
    include: {
      _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // One classroom → go straight to the board (Google Classroom–like)
  if (classes.length === 1) {
    redirect(`/teacher/classes/${classes[0]!.id}`);
  }

  return (
    <div className="blackboard-shell">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-chalk/50">
            {admin ? "Admin · blackboard" : "Teacher · blackboard"}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl font-semibold text-chalk">
            Your classrooms
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-chalk/70">
            A classroom is a shared space for one group — stream, lessons, and files. Students join
            with an invite code (not teacher-created student accounts).
          </p>
        </div>
        {admin ? (
          <Link href="/english-for-mandarin-speakers/studio" className="text-sm font-bold text-chalk-accent underline-offset-2 hover:underline">
            Audio Studio →
          </Link>
        ) : null}
      </div>

      {!classes.length ? (
        <section className="board-panel mt-10 rounded-2xl p-8 text-center sm:p-12">
          <div className="chalk-rail mx-auto mb-6" aria-hidden />
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-chalk">
            Create your classroom
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-chalk/65">
            Name the group (e.g. “Year 9 Period 3”). You&apos;ll get an invite code, link, and QR to
            share — students sign up and join themselves.
          </p>
          <form action={createClassroomAction} className="mx-auto mt-8 max-w-md space-y-3 text-left">
            <input
              name="name"
              required
              placeholder="Classroom name"
              className="w-full rounded-xl border border-chalk/25 bg-black/25 px-4 py-3 text-lg text-chalk placeholder:text-chalk/35"
            />
            <button type="submit" className="btn-chalk w-full rounded-xl px-4 py-3 text-base font-bold">
              Open classroom board
            </button>
          </form>
        </section>
      ) : (
        <div className="mt-8 space-y-4">
          <form action={createClassroomAction} className="board-panel flex flex-wrap gap-2 rounded-xl p-4">
            <input
              name="name"
              required
              placeholder="New classroom name"
              className="min-w-[200px] flex-1 rounded-lg border border-chalk/20 bg-black/20 px-3 py-2 text-chalk"
            />
            <button type="submit" className="btn-chalk rounded-lg px-4 py-2 text-sm font-bold">
              Create classroom
            </button>
          </form>
          <p className="text-xs font-bold uppercase tracking-wide text-chalk/45">Switcher</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {classes.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/teacher/classes/${c.id}`}
                  className="board-panel flex items-center justify-between rounded-xl p-5 transition hover:brightness-110"
                >
                  <div>
                    <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-chalk">
                      {c.name}
                    </p>
                    <p className="text-xs text-chalk/55">
                      {c._count.memberships} students · code {c.inviteCode}
                    </p>
                  </div>
                  <span className="text-chalk-accent" aria-hidden>
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {admin ? <AddTeacherForm /> : null}
    </div>
  );
}
