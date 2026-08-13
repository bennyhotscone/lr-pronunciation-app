import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/portal-access";
import { StudentAssignTools } from "@/components/portal/StudentAssignTools";
import { StudentPasswordTools } from "@/components/portal/StudentPasswordTools";
import { TeacherGoalChecklist } from "@/components/portal/TeacherGoalChecklist";
import { getAvatar } from "@/lib/avatars";
import { TeacherPdfSubmissions } from "@/components/portal/TeacherPdfSubmissions";
import { GuidedStoryAssignForm } from "@/components/story/GuidedStoryAssignForm";
import { TeacherMoneyAward } from "@/components/portal/TeacherMoneyAward";
import { getOrCreateWalletBalance } from "@/lib/class-money-actions";

export default async function TeacherStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const student = await prisma.user.findFirst({
    where: { id, role: "STUDENT" },
    include: {
      profile: true,
      memberships: {
        where: { status: "ACTIVE" },
        include: { class: true },
      },
      goals: {
        orderBy: { updatedAt: "desc" },
        take: 10,
        include: { checklistItems: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!student) notFound();

  const label =
    student.profile?.preferredName || student.profile?.fullName || student.email;
  const avatar = getAvatar(student.profile?.avatarId);
  const moneyBalance = await getOrCreateWalletBalance(student.id);

  return (
    <div>
      <Link href="/teacher" className="text-sm font-semibold text-muted hover:text-foreground">
        ← Classrooms
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

      <section className="card mt-6 rounded-2xl p-4">
        <h2 className="text-xs font-bold uppercase text-muted">Classrooms</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {student.memberships.map((m) => (
            <li key={m.id}>
              <Link
                href={`/teacher/classes/${m.classId}`}
                className="font-semibold underline-offset-2 hover:underline"
              >
                {m.class.name}
              </Link>
            </li>
          ))}
          {!student.memberships.length ? (
            <li className="text-muted">Not in a classroom yet — share an invite code.</li>
          ) : null}
        </ul>
      </section>

      <section className="card mt-4 rounded-2xl p-4">
        <h2 className="text-xs font-bold uppercase text-muted">Skills &amp; competencies</h2>
        <p className="mt-1 text-xs text-muted">
          Confirm competency checks when the student can do them — students can&apos;t tick teacher
          skills themselves.
        </p>
        <ul className="mt-3 space-y-4">
          {student.goals.map((g) => (
            <li key={g.id} className="rounded-xl border border-border bg-white/50 p-3">
              <p className="text-sm font-semibold">
                {g.title} <span className="font-normal text-muted">({g.progressPct}%)</span>
              </p>
              {g.description ? <p className="mt-1 text-xs text-muted">{g.description}</p> : null}
              <TeacherGoalChecklist goalId={g.id} items={g.checklistItems} />
            </li>
          ))}
          {!student.goals.length ? (
            <li className="text-sm text-muted">None yet — add below.</li>
          ) : null}
        </ul>
      </section>

      <TeacherPdfSubmissions studentId={student.id} />
      <TeacherMoneyAward
        studentId={student.id}
        studentLabel={label}
        balance={moneyBalance}
      />
      <GuidedStoryAssignForm studentId={student.id} />
      <StudentPasswordTools studentId={student.id} />
      <StudentAssignTools studentId={student.id} studentLabel={label} />
    </div>
  );
}
