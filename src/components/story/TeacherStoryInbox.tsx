import Link from "next/link";
import { prisma } from "@/lib/db";

export async function TeacherStoryInbox({ classId }: { classId: string }) {
  const attempts = await prisma.storyAttempt.findMany({
    where: {
      assignment: { classId, isFreePractice: false },
    },
    include: {
      assignment: { select: { title: true } },
      student: { include: { profile: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  return (
    <section className="card rounded-xl p-4">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
        Guided Story attempts
      </h2>
      <ul className="mt-2 space-y-2 text-sm">
        {attempts.map((a) => {
          const label =
            a.student.profile?.preferredName ||
            a.student.profile?.fullName ||
            a.student.email;
          return (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-ink">{label}</p>
                <p className="text-xs text-ink/50">
                  {a.assignment.title} · {a.status}
                  {a.planApproval !== "NOT_REQUIRED" ? ` · plan ${a.planApproval}` : ""}
                </p>
              </div>
              <Link
                href={`/teacher/stories/${a.id}`}
                className="text-xs font-bold text-desk-accent underline-offset-2 hover:underline"
              >
                Review
              </Link>
            </li>
          );
        })}
        {!attempts.length ? (
          <li className="text-ink/45">No Guided Story attempts yet.</li>
        ) : null}
      </ul>
    </section>
  );
}
