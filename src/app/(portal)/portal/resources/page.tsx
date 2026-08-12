import { prisma } from "@/lib/db";
import { getActiveClassIdsForStudent, requireRole } from "@/lib/portal-access";
import {
  portalResourceDownloadHref,
  portalResourceReadHref,
} from "@/lib/portal-files";
import { materialKindLabel } from "@/lib/material-kind";
import Link from "next/link";

function isPdf(mime: string | null | undefined, filename: string) {
  return mime === "application/pdf" || /\.pdf$/i.test(filename);
}

export default async function ResourcesPage() {
  const session = await requireRole("STUDENT");
  const classIds = await getActiveClassIdsForStudent(session.user.id);
  const files = await prisma.resource.findMany({
    where: {
      OR: [
        { studentId: session.user.id },
        ...(classIds.length ? [{ classId: { in: classIds } }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">Files & resources</h1>
      <p className="mt-2 text-muted">
        Downloads from your classes. PDFs open in Read / Write mode (tap words to build Target
        vocabulary).
      </p>
      <ul className="mt-6 space-y-3">
        {files.map((f) => (
          <li key={f.id} className="card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
            <div>
              {isPdf(f.mimeType, f.filename) ? (
                <Link
                  href={portalResourceReadHref(
                    f.id,
                    f.materialKind === "EXERCISE" ? "write" : "read",
                  )}
                  className="font-semibold underline-offset-2 hover:underline"
                >
                  {f.title}
                </Link>
              ) : (
                <a
                  href={portalResourceDownloadHref(f.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline-offset-2 hover:underline"
                >
                  {f.title}
                </a>
              )}
              <p className="text-xs text-muted">
                {f.filename}
                {" · "}
                {materialKindLabel(f.materialKind)}
                {f.studentId && !f.classId ? " · Just for you" : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isPdf(f.mimeType, f.filename) ? (
                <>
                  <Link
                    href={portalResourceReadHref(f.id, "read")}
                    className="btn-secondary rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    Read
                  </Link>
                  <Link
                    href={portalResourceReadHref(f.id, "write")}
                    className={`rounded-xl px-3 py-2 text-xs font-bold ${
                      f.materialKind === "EXERCISE"
                        ? "btn-primary"
                        : "btn-secondary"
                    }`}
                  >
                    {f.materialKind === "EXERCISE" ? "Open in write mode" : "Write"}
                  </Link>
                </>
              ) : (
                <a
                  href={portalResourceDownloadHref(f.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary rounded-xl px-3 py-2 text-xs font-bold"
                >
                  Open
                </a>
              )}
            </div>
          </li>
        ))}
        {!files.length ? <li className="text-sm text-muted">No files yet.</li> : null}
      </ul>
    </div>
  );
}
