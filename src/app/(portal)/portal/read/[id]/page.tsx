import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole, studentCanAccessResource } from "@/lib/portal-access";
import { PdfWorkspaceViewer } from "@/components/portal/PdfWorkspaceViewer";

export default async function PortalPdfReadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const session = await requireRole("STUDENT");
  const { id } = await params;
  const sp = await searchParams;
  const mode = sp.mode === "write" ? "write" : "read";

  const allowed = await studentCanAccessResource(session.user.id, id);
  if (!allowed) notFound();

  const resource = await prisma.resource.findUnique({ where: { id } });
  if (!resource) notFound();

  const isPdf =
    resource.mimeType === "application/pdf" || /\.pdf$/i.test(resource.filename);
  if (!isPdf) {
    return (
      <div className="space-y-3">
        <Link href="/portal/resources" className="text-sm font-semibold text-desk-accent hover:underline">
          ← Files
        </Link>
        <p className="rounded-xl border border-wood/30 bg-paper px-4 py-3 text-sm text-ink">
          Read / Write mode is for PDF files. This file is{" "}
          <strong>{resource.mimeType || "unknown type"}</strong>.
        </p>
        <a
          href={`/api/portal/resources/${resource.id}/download`}
          className="btn-primary inline-flex rounded-xl px-4 py-2 text-sm font-bold"
        >
          Download instead
        </a>
      </div>
    );
  }

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Link href="/portal" className="font-semibold text-desk-accent hover:underline">
          ← My Desk
        </Link>
        <Link href="/portal/resources" className="font-semibold text-muted hover:text-ink">
          All files
        </Link>
      </div>
      <PdfWorkspaceViewer
        resourceId={resource.id}
        title={resource.title}
        targetLang={profile?.targetLang || "zh-CN"}
        initialMode={mode}
        materialKind={resource.materialKind}
      />
    </div>
  );
}
