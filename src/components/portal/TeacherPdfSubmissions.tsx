import Link from "next/link";
import { prisma } from "@/lib/db";
import { parsePdfWriteData } from "@/lib/pdf-write-data";

function studentLabel(user: {
  email: string;
  profile: { preferredName: string | null; fullName: string | null } | null;
}) {
  return user.profile?.preferredName || user.profile?.fullName || user.email;
}

export async function TeacherPdfSubmissions({
  classId,
  studentId,
}: {
  classId?: string;
  studentId?: string;
}) {
  const where: { classId?: string; studentId?: string } = {};
  if (classId) where.classId = classId;
  if (studentId) where.studentId = studentId;

  const rows = await prisma.pdfSubmission.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    take: 30,
    include: {
      student: { include: { profile: true } },
    },
  });

  // Resolve resource titles
  const resourceIds = [...new Set(rows.map((r) => r.resourceId))];
  const resources = resourceIds.length
    ? await prisma.resource.findMany({
        where: { id: { in: resourceIds } },
        select: { id: true, title: true, filename: true },
      })
    : [];
  const titleById = new Map(resources.map((r) => [r.id, r.title || r.filename]));

  return (
    <section className="card mt-4 rounded-2xl p-4">
      <h2 className="text-xs font-bold uppercase text-muted">PDF worksheet submissions</h2>
      <p className="mt-1 text-xs text-muted">
        Students submit from Write mode on exercise PDFs. Answers below (text snapshot).
      </p>
      {rows.length ? (
        <ul className="mt-3 space-y-3">
          {rows.map((r) => {
            const data = parsePdfWriteData(r.data);
            const answers = [
              ...Object.entries(data.fields)
                .filter(([, v]) => v.trim())
                .map(([k, v]) => `${k}: ${v}`),
              ...data.overlays.filter((o) => o.text.trim()).map((o) => o.text.trim()),
            ];
            return (
              <li key={r.id} className="rounded-xl border border-border bg-white/60 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">
                    {studentId ? r.title : `${studentLabel(r.student)} · ${r.title}`}
                  </p>
                  <p className="text-xs text-muted">
                    {r.submittedAt.toLocaleString()} · {r.status}
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted">
                  File: {titleById.get(r.resourceId) || r.resourceId}
                  {" · "}
                  <Link
                    href={`/api/portal/resources/${r.resourceId}/download`}
                    className="font-semibold text-desk-accent hover:underline"
                    target="_blank"
                  >
                    Open PDF
                  </Link>
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink/80">
                  {answers.slice(0, 12).map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                  {!answers.length ? <li className="text-muted">No text answers.</li> : null}
                  {answers.length > 12 ? (
                    <li className="text-xs text-muted">+{answers.length - 12} more</li>
                  ) : null}
                </ol>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">No PDF submissions yet.</p>
      )}
    </section>
  );
}
